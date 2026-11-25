// Jungle Island: a sunny beach with palm trees, crabs and turtles; thick jungle with giant trees,
// hanging vines, a waterfall, treetop walkways to climb, monkeys and parrots.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { JUNGLE, JUNGLE_FEATURES } from './config';
import { terrainHeight, fbm, rng, smoothstep, CollisionWorld } from './terrain';
import { FOOD_SPAWNS, OPP_SPAWNS, MAP_SPOTS } from './layout';
import { SECRET_SPOTS } from './secretspots';
import { AnimalRig, buildOpponent, animateRig } from './animals';
import { softDotTexture } from './textures';

const F = JUNGLE_FEATURES;

/** Colour every vertex of a geometry (so many parts can share one material). */
function tint(g: THREE.BufferGeometry, c: number) {
  const col = new THREE.Color(c), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = col.r; a[i * 3 + 1] = col.g; a[i * 3 + 2] = col.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
function clean(g: THREE.BufferGeometry) { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'color'].includes(k)) n.deleteAttribute(k); return n; }
function merged(parts: THREE.BufferGeometry[]) { return mergeGeometries(parts.map(clean))!; }

function palmGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  // a gently curving trunk
  let x = 0, y = 0;
  for (let i = 0; i < 6; i++) {
    const seg = new THREE.CylinderGeometry(0.17 - i * 0.012, 0.2 - i * 0.012, 1.0, 8);
    seg.rotateZ(-0.08 * i); seg.translate(x, y + 0.5, 0);
    parts.push(tint(seg, i % 2 ? 0x8a6a42 : 0x9a7a50));
    x += Math.sin(0.08 * i) * 1.0; y += Math.cos(0.08 * i) * 1.0;
  }
  // fronds
  for (let k = 0; k < 8; k++) {
    const leaf = new THREE.PlaneGeometry(0.7, 2.8, 1, 4);
    const p = leaf.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) { const ly = p.getY(i); p.setZ(i, -((ly + 1.4) ** 2) * 0.12); p.setX(i, p.getX(i) * (1 - Math.abs(ly) / 1.6)); }
    leaf.rotateX(-Math.PI / 2 + 0.25); leaf.translate(0, 0, 1.4); leaf.rotateY((k / 8) * Math.PI * 2);
    leaf.translate(x, y + 0.1, 0);
    parts.push(tint(leaf, k % 2 ? 0x3f9a3a : 0x2f8a32));
  }
  for (let k = 0; k < 3; k++) { const c = new THREE.SphereGeometry(0.15, 8, 6); c.translate(x + Math.cos(k * 2.1) * 0.2, y - 0.15, Math.sin(k * 2.1) * 0.2); parts.push(tint(c, 0x5a3a1e)); }
  return merged(parts);
}
function jungleTreeGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  const trunk = new THREE.CylinderGeometry(0.45, 0.7, 8, 10); trunk.translate(0, 4, 0); parts.push(tint(trunk, 0x6a5038));
  for (let k = 0; k < 4; k++) { const r = new THREE.ConeGeometry(0.35, 1.6, 4); r.rotateZ(0.6); r.translate(0.55, 0.5, 0); r.rotateY(k * Math.PI / 2 + 0.4); parts.push(tint(r, 0x5a4430)); } // buttress roots
  const blobs: [number, number, number, number, number][] = [[0, 8.6, 0, 3.0, 0x2f7a2a], [1.8, 7.8, 0.6, 2.2, 0x3a8a32], [-1.6, 7.9, -0.8, 2.3, 0x286a24], [0.3, 7.6, -1.9, 2.0, 0x3f9036], [-0.6, 9.6, 0.8, 1.8, 0x48a03c]];
  for (const [bx, by, bz, r, c] of blobs) { const s = new THREE.IcosahedronGeometry(r, 1); s.scale(1, 0.62, 1); s.translate(bx, by, bz); parts.push(tint(s, c)); }
  return merged(parts);
}
function fernGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 6; k++) {
    const leaf = new THREE.PlaneGeometry(0.5, 1.4, 1, 3);
    const p = leaf.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) { const ly = p.getY(i); p.setZ(i, -((ly + 0.7) ** 2) * 0.25); }
    leaf.rotateX(-Math.PI / 2 + 0.6); leaf.translate(0, 0.2, 0.6); leaf.rotateY((k / 6) * Math.PI * 2);
    parts.push(tint(leaf, k % 2 ? 0x3a8a30 : 0x52a83c));
  }
  return merged(parts);
}

export class Jungle {
  root = new THREE.Group();
  private monkeys: { rig: AnimalRig; swing: THREE.Group | null; phase: number; base: THREE.Vector3 }[] = [];
  private parrots: { g: THREE.Group; wings: THREE.Mesh[]; r: number; cx: number; cz: number; y: number; a: number; sp: number }[] = [];
  private crabs: { g: THREE.Group; x0: number; z: number; t: number; sp: number }[] = [];
  private turtles: { g: THREE.Group; a: number; cx: number; cz: number; r: number }[] = [];
  private fallTex!: THREE.CanvasTexture;
  private foam!: THREE.Mesh;
  chatterAt = 0;
  /** Height of the treetop walkways (the same everywhere so the bridges are flat). */
  walkY = 0;

  constructor(scene: THREE.Scene, private collision: CollisionWorld) {
    scene.add(this.root);
    this.walkY = Math.max(...F.treetops.map((t) => terrainHeight(t.x, t.z))) + F.treetops[0].top;
    this.buildTerrain();
    this.buildWater();
    this.buildWaterfall();
    this.buildTrees();
    this.buildTreetops();
    this.buildCritters();
  }

  private clear(x: number, z: number, d = 3) {
    if (Math.hypot(x - F.entry.x, z - F.entry.z) < 9) return false;
    if (Math.hypot(x - F.pool.x, z - F.pool.z) < F.pool.r + 2.5) return false;
    if (Math.hypot(x - F.plateau.x, z - F.plateau.z) < F.plateau.r + 1) return false;
    if (F.treetops.some((t) => Math.hypot(x - t.x, z - t.z) < 5.5)) return false;
    for (let i = 0; i < F.treetops.length; i++) {           // keep the space under the bridges clear
      const a = F.treetops[i], b = F.treetops[(i + 1) % F.treetops.length];
      const t = Math.max(0, Math.min(1, ((x - a.x) * (b.x - a.x) + (z - a.z) * (b.z - a.z)) / ((b.x - a.x) ** 2 + (b.z - a.z) ** 2)));
      if (Math.hypot(x - (a.x + (b.x - a.x) * t), z - (a.z + (b.z - a.z) * t)) < 3) return false;
    }
    for (const s of FOOD_SPAWNS) if (Math.hypot(x - s.x, z - s.z) < d) return false;
    for (const s of OPP_SPAWNS) if (Math.hypot(x - s.x, z - s.z) < d + 1) return false;
    for (const s of MAP_SPOTS) if (Math.hypot(x - s.x, z - s.z) < d) return false;
    for (const s of SECRET_SPOTS) if (Math.hypot(x - s.x, z - s.z) < 6 || Math.hypot(x - s.mapX, z - s.mapZ) < 2.5) return false;
    return true;
  }

  private buildTerrain() {
    const x0 = -110, x1 = 110, z0 = 575, z1 = 790;
    const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0, 150, 150);
    geo.rotateX(-Math.PI / 2); geo.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const col = new Float32Array(pos.count * 3);
    const sand = new THREE.Color(0xf0dfae), wet = new THREE.Color(0xcdb37a), g1 = new THREE.Color(0x3f7a2a), g2 = new THREE.Color(0x2c5e1e), soil = new THREE.Color(0x5e4a2c), rock = new THREE.Color(0x7a7468), deep = new THREE.Color(0x2a5a5a), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), h = terrainHeight(x, z);
      pos.setY(i, h);
      c.copy(g1).lerp(g2, fbm(x * 0.08, z * 0.08, 3));
      c.lerp(soil, smoothstep(0.62, 0.75, fbm(x * 0.05 + 9, z * 0.05)) * 0.6);
      const sandW = 1 - smoothstep(628, 642, z);
      c.lerp(sand, sandW);
      if (h < 0.45 && sandW > 0.5) c.lerp(wet, 0.6);
      if (Math.hypot(x - F.plateau.x, z - F.plateau.z) < F.plateau.r + 3 && h > 1.8 && h < F.plateau.h - 0.2) c.lerp(rock, 0.85); // cliff face
      if (h < -0.2) c.lerp(deep, Math.min(1, -h / 2));
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
    mesh.receiveShadow = true;
    this.root.add(mesh);
  }

  private buildWater() {
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), new THREE.MeshStandardMaterial({ color: 0x1f9ec0, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.88 }));
    sea.rotation.x = -Math.PI / 2; sea.position.set(0, 0, 680); this.root.add(sea);
    // a frothy wave line along the beach
    this.foam = new THREE.Mesh(new THREE.PlaneGeometry(170, 1.4), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false }));
    this.foam.rotation.x = -Math.PI / 2; this.foam.position.set(0, 0.04, JUNGLE.minZ - 3); this.root.add(this.foam);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(F.pool.r + 0.6, 32), new THREE.MeshStandardMaterial({ color: 0x3ab4c8, roughness: 0.1, transparent: true, opacity: 0.85 }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(F.pool.x, 0.02, F.pool.z); this.root.add(pool);
    // the pool is deep, but everyone can swim in it now!
  }

  private buildWaterfall() {
    const c = document.createElement('canvas'); c.width = 64; c.height = 256;
    const g = c.getContext('2d')!;
    for (let y = 0; y < 256; y += 4) for (let x = 0; x < 64; x += 4) { const v = 200 + Math.random() * 55; g.fillStyle = `rgba(${v},${v + 5 > 255 ? 255 : v + 5},255,${0.55 + Math.random() * 0.4})`; g.fillRect(x, y, 4, 6 + Math.random() * 10); }
    this.fallTex = new THREE.CanvasTexture(c); this.fallTex.wrapT = THREE.RepeatWrapping; this.fallTex.repeat.set(1, 2);
    const dz = F.plateau.z - F.pool.z, dx = F.plateau.x - F.pool.x, d = Math.hypot(dx, dz);
    const ex = F.pool.x + (dx / d) * (F.pool.r - 1.5), ez = F.pool.z + (dz / d) * (F.pool.r - 1.5);
    const fall = new THREE.Mesh(new THREE.PlaneGeometry(4.2, F.plateau.h + 0.6), new THREE.MeshStandardMaterial({ map: this.fallTex, transparent: true, emissive: 0x6aa8c8, emissiveIntensity: 0.25, side: THREE.DoubleSide, depthWrite: false }));
    fall.position.set(ex, (F.plateau.h + 0.6) / 2 - 0.2, ez); fall.rotation.y = Math.atan2(dx, dz); this.root.add(fall);
    const mist = new THREE.SpriteMaterial({ map: softDotTexture(), color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false });
    for (let k = 0; k < 6; k++) { const s = new THREE.Sprite(mist); s.position.set(ex + (k - 2.5) * 0.8, 0.6 + (k % 2) * 0.4, ez - (dz / d) * 1.2); s.scale.setScalar(2.4); this.root.add(s); }
    // mossy rocks around the pool
    const rockM = new THREE.MeshStandardMaterial({ color: 0x6a7a5a, roughness: 1 });
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2, r = F.pool.r + 1.2;
      const x = F.pool.x + Math.cos(a) * r, z = F.pool.z + Math.sin(a) * r;
      if (Math.hypot(x - ex, z - ez) < 3) continue;
      const s = 0.5 + (k % 3) * 0.3;
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(s), rockM); m.position.set(x, terrainHeight(x, z) + s * 0.3, z); m.castShadow = true; this.root.add(m);
    }
  }

  private instanced(geo: THREE.BufferGeometry, pts: [number, number, number, number][], scale: (a: number) => number, collide = 0) {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide });
    const im = new THREE.InstancedMesh(geo, mat, pts.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    pts.forEach(([x, z, a, b], i) => {
      const s = scale(a);
      m.compose(new THREE.Vector3(x, terrainHeight(x, z) - 0.1, z), q.setFromEuler(e.set(0, b * Math.PI * 2, 0)), new THREE.Vector3(s, s, s));
      im.setMatrixAt(i, m);
      if (collide) this.collision.add({ kind: 'cyl', x, z, r: collide * s, top: 100, tall: true });
    });
    im.castShadow = true; im.receiveShadow = true;
    this.root.add(im);
  }

  private buildTrees() {
    const r = rng(7311);
    const pick = (n: number, x0: number, x1: number, z0: number, z1: number, d: number, ok: (x: number, z: number) => boolean) => {
      const out: [number, number, number, number][] = [];
      for (let i = 0; i < n * 30 && out.length < n; i++) {
        const x = x0 + r() * (x1 - x0), z = z0 + r() * (z1 - z0);
        if (!ok(x, z) || !this.clear(x, z, d) || out.some((p) => Math.hypot(p[0] - x, p[1] - z) < d)) continue;
        out.push([x, z, r(), r()]);
      }
      return out;
    };
    // palm trees along the beach
    const palms = pick(26, -74, 74, 604, 640, 5, (x, z) => terrainHeight(x, z) > 0.25);
    this.instanced(palmGeometry(), palms, (a) => 0.9 + a * 0.5, 0.25);
    // giant jungle trees
    const trees = pick(85, -74, 74, 642, 756, 6.5, (x, z) => terrainHeight(x, z) > 0.5);
    this.instanced(jungleTreeGeometry(), trees, (a) => 0.85 + a * 0.45, 0.6);
    // hanging vines (from the canopies)
    const vineGeo = merged([tint(new THREE.CylinderGeometry(0.035, 0.035, 1, 5), 0x3a7a28)]);
    const vm = new THREE.InstancedMesh(vineGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), trees.length * 3);
    const m = new THREE.Matrix4();
    let n = 0;
    for (const [x, z, a] of trees) for (let k = 0; k < 3; k++) {
      const s = 0.85 + a * 0.45, len = 2.5 + ((k * 7 + a * 10) % 3);
      const vx = x + Math.cos(k * 2.2 + a * 6) * 1.6 * s, vz = z + Math.sin(k * 2.2 + a * 6) * 1.6 * s;
      m.compose(new THREE.Vector3(vx, terrainHeight(x, z) + 7.3 * s - len / 2, vz), new THREE.Quaternion(), new THREE.Vector3(1, len, 1));
      vm.setMatrixAt(n++, m);
    }
    vm.count = n; this.root.add(vm);
    // ferns, big leaves and flowers on the jungle floor
    this.instanced(fernGeometry(), pick(260, -76, 76, 636, 758, 1.6, (x, z) => terrainHeight(x, z) > 0.4), (a) => 0.8 + a * 0.9);
    const flowers = pick(90, -76, 76, 636, 758, 2, (x, z) => terrainHeight(x, z) > 0.4);
    const fg = merged([tint(new THREE.SphereGeometry(0.16, 8, 6).translate(0, 0.35, 0), 0xff4a8a), tint(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 4).translate(0, 0.17, 0), 0x3a7a28), tint(new THREE.SphereGeometry(0.06, 6, 4).translate(0, 0.42, 0.1), 0xffd34a)]);
    this.instanced(fg, flowers, (a) => 0.8 + a * 0.8);
  }

  /** Treetop walkways: climb the log steps, walk the platforms and wobbly rope bridges high above the jungle floor. */
  private buildTreetops() {
    const Y = this.walkY;
    const wood = new THREE.MeshStandardMaterial({ color: 0xa87a4a, roughness: 0.85 }), dark = new THREE.MeshStandardMaterial({ color: 0x7a5232, roughness: 0.9 });
    const rope = new THREE.MeshStandardMaterial({ color: 0xd8c08a, roughness: 1 });
    const tree = jungleTreeGeometry();
    const tm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
    for (const t of F.treetops) {
      const g0 = terrainHeight(t.x, t.z);
      const big = new THREE.Mesh(tree, tm); big.position.set(t.x, g0 - 0.1, t.z); big.scale.set(1.3, Math.max(1.1, (Y + 3.5 - g0) / 8), 1.3); big.castShadow = true; this.root.add(big);
      this.collision.add({ kind: 'cyl', x: t.x, z: t.z, r: 0.85, top: 100, tall: true });
      // a round wooden platform around the trunk
      const deck = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.18, 20), wood); deck.position.set(t.x, Y - 0.09, t.z); deck.castShadow = true; deck.receiveShadow = true; this.root.add(deck);
      this.collision.add({ kind: 'cyl', x: t.x, z: t.z, r: 2.4, top: Y, bottom: Y - 0.6, tall: false });
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 5), dark); post.position.set(t.x + Math.cos(a) * 2.3, Y + 0.4, t.z + Math.sin(a) * 2.3); this.root.add(post); }
      const rail = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.04, 4, 28), rope); rail.rotation.x = Math.PI / 2; rail.position.set(t.x, Y + 0.75, t.z); this.root.add(rail);
    }
    // rope bridges between the platforms (made of little walkable steps so they work at any angle)
    for (let i = 0; i < F.treetops.length; i++) {
      const a = F.treetops[i], b = F.treetops[(i + 1) % F.treetops.length];
      const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), ux = dx / d, uz = dz / d;
      const start = 2.2, end = d - 2.2, len = end - start;
      const mid = new THREE.Group(); mid.position.set(a.x + ux * (start + len / 2), Y - 0.08, a.z + uz * (start + len / 2)); mid.rotation.y = Math.atan2(dx, dz); this.root.add(mid);
      for (let s = 0; s < len; s += 0.5) { const plank = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.08, 0.4), s % 1 ? wood : dark); plank.position.set(0, -Math.sin((s / len) * Math.PI) * 0.12, s - len / 2 + 0.25); mid.add(plank); }
      for (const sx of [-0.7, 0.7]) { const r1 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, len, 4), rope); r1.rotation.x = Math.PI / 2; r1.position.set(sx, 0.75, 0); mid.add(r1); }
      for (let s = 0; s <= len; s += 0.6) this.collision.add({ kind: 'cyl', x: a.x + ux * (start + s), z: a.z + uz * (start + s), r: 0.7, top: Y, bottom: Y - 0.6, tall: false });
    }
    // log steps spiralling up to the first platform
    const A = F.treetops[0], ga = terrainHeight(A.x, A.z);
    const steps = Math.ceil((Y - ga) / 0.65);
    for (let k = 1; k <= steps; k++) {
      const ang = -Math.PI / 2 - k * 0.55, rr = 3.6 + (k % 2) * 0.2;
      const x = A.x + Math.cos(ang) * rr, z = A.z + Math.sin(ang) * rr;
      const top = Math.min(Y, ga + k * 0.65), g0 = terrainHeight(x, z);
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, top - g0 + 0.3, 12), dark); log.position.set(x, (top + g0 - 0.3) / 2, z); log.castShadow = true; this.root.add(log);
      const ring = new THREE.Mesh(new THREE.CircleGeometry(0.55, 12), new THREE.MeshStandardMaterial({ color: 0xd8b880 })); ring.rotation.x = -Math.PI / 2; ring.position.set(x, top + 0.005, z); this.root.add(ring);
      this.collision.add({ kind: 'cyl', x, z, r: 0.55, top, tall: false });
    }
    // a little lookout hut with a leafy roof on the second platform
    const B = F.treetops[1];
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.8, 1.6, 10), new THREE.MeshStandardMaterial({ color: 0xc8a050, roughness: 1 })); roof.position.set(B.x, Y + 3.4, B.z); roof.castShadow = true; this.root.add(roof);
    for (const [ox, oz] of [[-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8], [1.8, 1.8]]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 6), dark); p.position.set(B.x + ox * 0.9, Y + 1.3, B.z + oz * 0.9); this.root.add(p); }
  }

  private buildCritters() {
    const r = rng(99);
    // monkeys: some sit up on the platforms and in the trees, some swing on vines
    const spots: [number, number, number, boolean][] = [];
    const Y = this.walkY;
    for (const t of F.treetops) spots.push([t.x + 1.5, Y, t.z + 0.8, false]);
    for (let i = 0; i < 6; i++) { const x = -60 + r() * 120, z = 650 + r() * 100; if (this.clear(x, z, 2)) spots.push([x, terrainHeight(x, z) + 4.5 + r() * 1.5, z, true]); }
    for (const [x, y, z, swings] of spots) {
      const rig = buildOpponent('monkey', 0.9);
      let swing: THREE.Group | null = null;
      if (swings) {
        swing = new THREE.Group(); swing.position.set(x, y + 2.4, z); this.root.add(swing);
        const vine = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.4, 5), new THREE.MeshStandardMaterial({ color: 0x3a7a28 })); vine.position.y = -1.2; swing.add(vine);
        rig.root.position.set(0, -2.4 - rig.height * 0.4, 0); rig.root.rotation.x = Math.PI; swing.add(rig.root);  // hanging upside down by its tail!
      } else { rig.root.position.set(x, y, z); rig.root.rotation.y = r() * 6; this.root.add(rig.root); }
      this.monkeys.push({ rig, swing, phase: r() * 6, base: new THREE.Vector3(x, y, z) });
    }
    // parrots flying round in circles
    const cols = [0xe4302a, 0x2a7ae4, 0x2ac85a, 0xf6c42a, 0xe85ad8, 0x2ad8d0];
    for (let i = 0; i < 6; i++) {
      const g = new THREE.Group(); this.root.add(g);
      const m = new THREE.MeshStandardMaterial({ color: cols[i], roughness: 0.6 });
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), m); body.scale.set(0.8, 0.8, 1.6); g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), m); head.position.set(0, 0.08, 0.24); g.add(head);
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.1, 6), new THREE.MeshStandardMaterial({ color: 0xf6e080 })); beak.rotation.x = Math.PI / 2; beak.position.set(0, 0.06, 0.34); g.add(beak);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.4), new THREE.MeshStandardMaterial({ color: cols[(i + 2) % 6] })); tail.position.set(0, 0, -0.38); g.add(tail);
      const wings: THREE.Mesh[] = [];
      for (const sx of [-1, 1]) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.02, 0.2), new THREE.MeshStandardMaterial({ color: cols[(i + 1) % 6] })); w.geometry.translate(sx * 0.22, 0, 0); g.add(w); wings.push(w); }
      this.parrots.push({ g, wings, r: 8 + r() * 10, cx: -40 + r() * 80, cz: 660 + r() * 80, y: 9 + r() * 4, a: r() * 6, sp: (0.4 + r() * 0.3) * (i % 2 ? 1 : -1) });
    }
    // crabs scuttling sideways on the beach
    for (let i = 0; i < 9; i++) {
      const g = new THREE.Group(); this.root.add(g);
      const m = new THREE.MeshStandardMaterial({ color: 0xe4502a, roughness: 0.5 });
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), m); body.scale.set(1.3, 0.55, 1); body.position.y = 0.16; g.add(body);
      for (const sx of [-1, 1]) {
        const claw = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), m); claw.scale.set(1, 0.7, 1.3); claw.position.set(sx * 0.3, 0.18, 0.2); g.add(claw);
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), new THREE.MeshBasicMaterial({ color: 0x111111 })); eye.position.set(sx * 0.07, 0.32, 0.15); g.add(eye);
        for (let k = 0; k < 3; k++) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.22, 4), m); leg.rotation.z = sx * 1.0; leg.position.set(sx * 0.3, 0.08, -0.1 + k * 0.1); g.add(leg); }
      }
      const x0 = -66 + r() * 132, z = 606 + r() * 18;
      this.crabs.push({ g, x0, z, t: r() * 10, sp: 0.6 + r() * 0.6 });
    }
    // sea turtles plodding along the sand
    for (let i = 0; i < 3; i++) {
      const g = new THREE.Group(); this.root.add(g);
      const shell = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x5a7a3a, roughness: 0.6 })); shell.scale.set(1, 0.6, 1.25); shell.position.y = 0.12; g.add(shell);
      const skin = new THREE.MeshStandardMaterial({ color: 0x9ab07a, roughness: 0.8 });
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), skin); head.position.set(0, 0.18, 0.7); g.add(head);
      for (const [fx, fz] of [[-0.5, 0.35], [0.5, 0.35], [-0.4, -0.4], [0.4, -0.4]]) { const fl = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.05, 0.18), skin); fl.position.set(fx, 0.08, fz); fl.rotation.y = fx * 0.6; g.add(fl); }
      this.turtles.push({ g, a: r() * 6, cx: -40 + i * 40, cz: 614 + r() * 8, r: 4 + r() * 3 });
    }
  }

  /** Returns true when a monkey chatters (so the game can play the sound). */
  update(dt: number, t: number, focus: THREE.Vector3): boolean {
    const here = focus.z > 500;
    this.root.visible = focus.z > 450;
    if (!here) return false;
    this.fallTex.offset.y -= dt * 1.6;
    (this.foam.material as THREE.MeshBasicMaterial).opacity = 0.35 + Math.sin(t * 1.3) * 0.2;
    this.foam.position.z = JUNGLE.minZ - 3 + Math.sin(t * 1.3) * 0.8;
    for (const m of this.monkeys) {
      animateRig(m.rig, dt, { speed: 0, airborne: false, attack: null, attackT: 0, windup: 0 });
      if (m.swing) m.swing.rotation.z = Math.sin(t * 1.6 + m.phase) * 0.55;
      else m.rig.root.rotation.y += Math.sin(t * 0.7 + m.phase) * dt * 0.8;
    }
    for (const p of this.parrots) {
      p.a += p.sp * dt;
      p.g.position.set(p.cx + Math.cos(p.a) * p.r, p.y + Math.sin(p.a * 3) * 0.5, p.cz + Math.sin(p.a) * p.r);
      p.g.rotation.y = Math.atan2(-Math.sin(p.a) * Math.sign(p.sp), Math.cos(p.a) * Math.sign(p.sp));
      const flap = Math.sin(t * 14 + p.a * 5) * 0.7;
      p.wings[0].rotation.z = flap; p.wings[1].rotation.z = -flap;
    }
    for (const c of this.crabs) {
      c.t += dt * c.sp;
      const x = c.x0 + Math.sin(c.t) * 3;
      c.g.position.set(x, terrainHeight(x, c.z), c.z);
      c.g.rotation.z = Math.sin(c.t * 12) * 0.08;
    }
    for (const tu of this.turtles) {
      tu.a += dt * 0.08;
      const x = tu.cx + Math.cos(tu.a) * tu.r, z = tu.cz + Math.sin(tu.a) * tu.r * 0.5;
      tu.g.position.set(x, terrainHeight(x, z), z);
      tu.g.rotation.y = Math.atan2(-Math.sin(tu.a), Math.cos(tu.a) * 0.5);
    }
    if (t > this.chatterAt) {
      this.chatterAt = t + 6 + Math.random() * 8;
      return this.monkeys.some((m) => m.base.distanceTo(focus) < 25);
    }
    return false;
  }
}
