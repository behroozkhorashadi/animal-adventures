// Terrain height function, zone lookup and simple collision world.
import { WORLD, ZoneId, ANTARCTICA, VILLAGE, JUNGLE, JUNGLE_FEATURES } from './config';

// ---- deterministic value noise -------------------------------------------------
function hash(x: number, z: number): number {
  let h = (x * 374761393 + z * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function smooth(t: number) { return t * t * (3 - 2 * t); }
export function noise2(x: number, z: number): number {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  const u = smooth(xf), v = smooth(zf);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}
export function fbm(x: number, z: number, oct = 4): number {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += a * noise2(x * f, z * f); n += a; a *= 0.5; f *= 2.03; }
  return s / n; // 0..1
}

export function smoothstep(e0: number, e1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

// Seeded RNG for layout
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- layout features ------------------------------------------------------------
export const PITS = [
  { x: 155, z: -28, r: 11, zone: 'savanna' as ZoneId },
  { x: -158, z: 30, r: 10, zone: 'swamp' as ZoneId },
  { x: -40, z: 292, r: 10, zone: 'antarctica' as ZoneId },
];
export const WATER_LEVEL = 0;

function forestH(x: number, z: number): number {
  let h = (fbm(x * 0.025 + 10, z * 0.025) - 0.5) * 7 + (fbm(x * 0.09, z * 0.09) - 0.5) * 1.2;
  // flatten starting clearing
  const dc = Math.hypot(x - 0, z - 0);
  h *= smoothstep(10, 24, dc);
  // gentle bowl for the hidden clearing
  const dh = Math.hypot(x + 50, z - 45);
  h = h * smoothstep(5, 12, dh) + 0.6 * (1 - smoothstep(5, 12, dh));
  return h + 0.2;
}

function savannaH(x: number, z: number): number {
  let h = (fbm(x * 0.018 + 40, z * 0.018 + 7) - 0.5) * 5 + (fbm(x * 0.07, z * 0.07) - 0.5) * 0.6;
  return h + 0.6;
}

function swampH(x: number, z: number): number {
  // mostly just above / below the water line with muddy islands
  const n = fbm(x * 0.04 - 30, z * 0.04 + 12);
  let h = (n - 0.52) * 2.4;
  const islands = fbm(x * 0.09 + 5, z * 0.09 - 3);
  if (islands > 0.58) h += (islands - 0.58) * 4;
  return h;
}

const FLAT_SPOTS: { x: number; z: number; r: number; h?: number }[] = [
  { x: 37, z: 37, r: 11 }, { x: -28, z: 8, r: 7 }, { x: -22, z: -34, r: 10 }, { x: 22, z: -22, r: 7 },
  { x: -50, z: 45, r: 11 },
  { x: 167, z: 35, r: 14 }, { x: 118, z: -34, r: 8 },
];
function rawAt(x: number, z: number) {
  const E = WORLD.zoneEdge;
  return x > E ? savannaH(x, z) : x < -E ? swampH(x, z) : forestH(x, z);
}

function baseHeight(x: number, z: number): number {
  const E = WORLD.zoneEdge;
  let h: number;
  if (x > E - 8) {
    const w = smoothstep(E - 8, E + 8, x);
    h = forestH(x, z) * (1 - w) + savannaH(x, z) * w;
  } else if (x < -E + 8) {
    const w = smoothstep(-E + 8, -E - 8, x);
    h = forestH(x, z) * (1 - w) + swampH(x, z) * w;
  } else h = forestH(x, z);

  // gate corridors: flat, safe crossing
  for (const gx of [E, -E]) {
    const d = Math.abs(x - gx);
    if (d < 16 && Math.abs(z) < 12) {
      const w = (1 - smoothstep(6, 16, d)) * (1 - smoothstep(6, 12, Math.abs(z)));
      h = h * (1 - w) + 0.35 * w;
    }
  }
  // flat pads under landmarks so their rocks/platforms sit nicely
  for (const s of FLAT_SPOTS) {
    const d = Math.hypot(x - s.x, z - s.z);
    if (d < s.r) {
      if (s.h === undefined) s.h = rawAt(s.x, s.z);
      const w = 1 - smoothstep(s.r * 0.55, s.r, d);
      h = h * (1 - w) + s.h * w;
    }
  }
  // raise terrain near the outer border so the world feels enclosed
  // north of the forest: the big hill, then the village farmland
  const E2 = WORLD.zoneEdge;
  const inCol = Math.abs(x) < E2 + 7;
  if (inCol && z > 50) {
    const w = smoothstep(62, 80, z);
    h = h * (1 - w) + villageH(x, z) * w;
    h += 6.5 * Math.exp(-(((z - VILLAGE.ridgeZ) / 6.5) ** 2)); // the hill you climb over
  }
  let bx = Math.min(x - WORLD.minX, WORLD.maxX - x);
  const bz = Math.min(z - WORLD.minZ, (inCol ? VILLAGE.maxZ : WORLD.maxZ) - z);
  if (inCol && z > 70) bx = Math.min(bx, E2 - Math.abs(x) + 2 + (1 - smoothstep(70, 82, z)) * 20); // hills along the village sides
  const b = Math.min(bx, bz);
  if (b < 10) h += (10 - b) * (10 - b) * 0.07;
  return h;
}

// ---- Human Village: gentle farmland with flat pads for buildings ----------
const VILLAGE_FLAT = [
  { x: 0, z: 100, r: 16 }, { x: -28, z: 128, r: 12 }, { x: 28, z: 135, r: 13 }, { x: -8, z: 145, r: 9 },
  { x: 8, z: 125, r: 5 },
  { x: 16, z: 84, r: 8 }, { x: -18, z: 82, r: 8 }, { x: 52, z: 128, r: 8 }, { x: -52, z: 132, r: 8 }, { x: -10, z: 130, r: 7 },
];
function villageH(x: number, z: number): number {
  let h = 0.6 + (fbm(x * 0.03 + 11, z * 0.03 + 90) - 0.5) * 1.8;
  for (const s of VILLAGE_FLAT) {
    const d = Math.hypot(x - s.x, z - s.z);
    if (d < s.r) { const w = 1 - smoothstep(s.r * 0.55, s.r, d); h = h * (1 - w) + 0.6 * w; }
  }
  return h;
}

// ---- Antarctica: snowy island with ice cliffs dropping into the sea ----------
const ANT_FLAT = [
  { x: 0, z: 266, r: 16, h: 0.8 }, { x: -40, z: 292, r: 17, h: 0.8 }, { x: 35, z: 282, r: 10, h: 0.9 },
  { x: -30, z: 340, r: 14, h: 0.7 }, { x: 20, z: 340, r: 9, h: 1.0 }, { x: 48, z: 362, r: 11, h: 1.0 },
];
/** The Fish Lagoon in Antarctica: icy water where penguins can swim and catch fish. */
export const FISH_LAGOON = { x: 55, z: 315, r: 11 };
function antarcticaH(x: number, z: number): number {
  const A = ANTARCTICA;
  let h = 1.2 + (fbm(x * 0.03 + 70, z * 0.03 - 20) - 0.5) * 6 + (fbm(x * 0.12, z * 0.12) - 0.5) * 0.5;
  h = Math.max(h, 0.35);
  for (const s of ANT_FLAT) {
    const d = Math.hypot(x - s.x, z - s.z);
    if (d < s.r) { const w = 1 - smoothstep(s.r * 0.5, s.r, d); h = h * (1 - w) + s.h * w; }
  }
  { const d = Math.hypot(x - FISH_LAGOON.x, z - FISH_LAGOON.z); if (d < FISH_LAGOON.r) { const w = 1 - smoothstep(FISH_LAGOON.r - 3, FISH_LAGOON.r, d); h = h * (1 - w) - 1.5 * w; } }
  const out = Math.max(A.minX - x, x - A.maxX, A.minZ - z, z - A.maxZ);
  if (out > -3) h -= smoothstep(-3, 6, out) * 18; // ice cliffs into the ocean
  return h;
}

/** Jungle Island: rolling jungle hills, a sandy beach in the south, a cliff with a waterfall and its pool. */
function jungleH(x: number, z: number): number {
  const A = JUNGLE, F = JUNGLE_FEATURES;
  let h = 1.3 + (fbm(x * 0.03 + 11, z * 0.03 - 7) - 0.5) * 4.5 + (fbm(x * 0.1, z * 0.1 + 3) - 0.5) * 0.4;
  h = Math.max(h, 0.6);
  // the beach: gently sloping sand down to the sea
  const beach = 0.15 + Math.max(0, z - A.minZ) * 0.025;
  const wb = 1 - smoothstep(624, 646, z);
  h = h * (1 - wb) + beach * wb;
  // the waterfall cliff and its pool
  const dp = Math.hypot(x - F.plateau.x, z - F.plateau.z);
  if (dp < F.plateau.r + 3) { const w = 1 - smoothstep(F.plateau.r - 1, F.plateau.r + 3, dp); h = h * (1 - w) + F.plateau.h * w; }
  const dl = Math.hypot(x - F.pool.x, z - F.pool.z);
  if (dl < F.pool.r + 2) { const w = 1 - smoothstep(F.pool.r - 2, F.pool.r + 2, dl); h = h * (1 - w) - 1.3 * w; }
  // the edges drop into the sea
  const out = Math.max(A.minX - x, x - A.maxX, -1e9, z - A.maxZ);
  if (out > -4) h -= smoothstep(-4, 6, out) * 14;
  if (z < A.minZ + 2) h -= (A.minZ + 2 - z) * 0.08;
  return h;
}

/** Height of the terrain surface (ignores rocks/platforms). */
export function terrainHeight(x: number, z: number): number {
  if (z < -300) return 0; // inside your house (a flat floor)
  let h = z > 500 ? jungleH(x, z) : z > 200 ? antarcticaH(x, z) : baseHeight(x, z);
  for (const p of PITS) {
    const d = Math.hypot(x - p.x, z - p.z);
    if (d < p.r + 1) h = h * smoothstep(p.r - 2.2, p.r + 0.5, d) + -30 * (1 - smoothstep(p.r - 2.2, p.r + 0.5, d));
  }
  return h;
}

export function zoneAt(x: number, z = 0): ZoneId {
  if (z < -300) return x >= 100 ? 'village' : 'forest'; // rooms: the barn and human houses belong to the village
  if (z > 500) return 'jungle';
  if (z > 200) return 'antarctica';
  if (z > VILLAGE.ridgeZ + 2 && Math.abs(x) < WORLD.zoneEdge) return 'village';
  if (x > WORLD.zoneEdge) return 'savanna';
  if (x < -WORLD.zoneEdge) return 'swamp';
  return 'forest';
}

export function inPit(x: number, z: number, margin = 0): boolean {
  return PITS.some((p) => Math.hypot(x - p.x, z - p.z) < p.r + margin);
}

/** Muddy/shallow swamp water (slows most animals). */
export function isMud(x: number, z: number): boolean {
  return zoneAt(x, z) === 'swamp' && terrainHeight(x, z) < WATER_LEVEL - 0.05;
}

// ---- colliders -------------------------------------------------------------------
// Cylinders and boxes. `top` is the walkable top surface height (use a big value
// for things you cannot stand on, like tree trunks).
// `bottom` (optional) makes a collider float: things below it can walk underneath (upstairs floors, upstairs furniture).
export interface CylCollider { kind: 'cyl'; x: number; z: number; r: number; top: number; tall?: boolean; bottom?: number }
export interface BoxCollider { kind: 'box'; minX: number; maxX: number; minZ: number; maxZ: number; top: number; tall?: boolean; bottom?: number }
export type Collider = CylCollider | BoxCollider;

export class CollisionWorld {
  colliders: Collider[] = [];
  // coarse grid for fast lookup
  private grid = new Map<string, Collider[]>();
  private cell = 8;

  add(c: Collider) {
    this.colliders.push(c);
    const [x0, x1, z0, z1] = c.kind === 'cyl' ? [c.x - c.r, c.x + c.r, c.z - c.r, c.z + c.r] : [c.minX, c.maxX, c.minZ, c.maxZ];
    for (let gx = Math.floor(x0 / this.cell); gx <= Math.floor(x1 / this.cell); gx++)
      for (let gz = Math.floor(z0 / this.cell); gz <= Math.floor(z1 / this.cell); gz++) {
        const k = gx + ',' + gz;
        let a = this.grid.get(k);
        if (!a) this.grid.set(k, (a = []));
        a.push(c);
      }
    return c;
  }
  remove(c: Collider) {
    this.colliders = this.colliders.filter((o) => o !== c);
    for (const [k, a] of this.grid) this.grid.set(k, a.filter((o) => o !== c));
  }
  near(x: number, z: number): Collider[] {
    const out: Collider[] = [];
    const gx = Math.floor(x / this.cell), gz = Math.floor(z / this.cell);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const a = this.grid.get(gx + i + ',' + (gz + j));
      if (a) for (const c of a) if (!out.includes(c)) out.push(c);
    }
    return out;
  }

  /** Highest surface under (x,z) that an object whose feet are at `y` can stand on. */
  groundAt(x: number, z: number, y: number, stepUp: number, radius = 0): number {
    let g = terrainHeight(x, z);
    for (const c of this.near(x, z)) {
      if (c.top > y + stepUp) continue;
      if (contains(c, x, z, -radius * 0.5)) g = Math.max(g, c.top);
    }
    return g;
  }

  /** Push a circle at (x,z) out of any collider taller than the feet height. */
  resolve(pos: { x: number; z: number }, y: number, radius: number, stepUp: number) {
    for (const c of this.near(pos.x, pos.z)) {
      if (c.top <= y + stepUp) continue;
      if (c.bottom !== undefined && y + 1.0 < c.bottom) continue; // you're underneath it
      if (c.kind === 'cyl') {
        const dx = pos.x - c.x, dz = pos.z - c.z;
        const d = Math.hypot(dx, dz), min = c.r + radius;
        if (d < min) {
          if (d < 1e-4) { pos.x += min; continue; }
          pos.x = c.x + (dx / d) * min;
          pos.z = c.z + (dz / d) * min;
        }
      } else {
        const cx = Math.max(c.minX, Math.min(pos.x, c.maxX));
        const cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
        const dx = pos.x - cx, dz = pos.z - cz;
        const d = Math.hypot(dx, dz);
        if (d < radius) {
          if (d < 1e-4) {
            // inside the box: push out the shortest way
            const opts = [
              [c.minX - radius - pos.x, 0], [c.maxX + radius - pos.x, 0],
              [0, c.minZ - radius - pos.z], [0, c.maxZ + radius - pos.z],
            ];
            opts.sort((a, b) => Math.abs(a[0] + a[1]) - Math.abs(b[0] + b[1]));
            pos.x += opts[0][0]; pos.z += opts[0][1];
          } else {
            pos.x = cx + (dx / d) * radius;
            pos.z = cz + (dz / d) * radius;
          }
        }
      }
    }
  }

  /** Is a point inside something solid (used for coin placement & camera). */
  blocked(x: number, z: number, y: number, pad = 0): boolean {
    for (const c of this.near(x, z)) if (c.top > y && (c.bottom === undefined || y >= c.bottom) && contains(c, x, z, -pad)) return true;
    return false;
  }
}

function contains(c: Collider, x: number, z: number, shrink: number): boolean {
  if (c.kind === 'cyl') return Math.hypot(x - c.x, z - c.z) < c.r - shrink;
  return x > c.minX + shrink && x < c.maxX - shrink && z > c.minZ + shrink && z < c.maxZ - shrink;
}
