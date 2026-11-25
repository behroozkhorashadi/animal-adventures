// The inside of your home: a room (bigger for bigger homes) with a bed,
// a fridge, a stove with a cooking pot, a rug, a table and a lamp.
import * as THREE from 'three';
import { CollisionWorld, Collider } from './terrain';
import { plankTexture } from './textures';

export const INTERIOR = { x: 0, z: -400 };
// ---- little furniture & props used to fill the rooms ------------------------------------------
const PM = new Map<number, THREE.MeshStandardMaterial>();
const pm = (c: number, rough = 0.8) => { let x = PM.get(c * 10 + Math.round(rough * 9)); if (!x) { x = new THREE.MeshStandardMaterial({ color: c, roughness: rough }); PM.set(c * 10 + Math.round(rough * 9), x); } return x; };
function pbox(g: THREE.Object3D, c: number, w: number, h: number, d: number, x: number, y: number, z: number, rough = 0.8) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), pm(c, rough)); b.position.set(x, y, z); g.add(b); return b;
}
function pball(g: THREE.Object3D, c: number, r: number, x: number, y: number, z: number, rough = 0.8) {
  const b = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 9), pm(c, rough)); b.position.set(x, y, z); g.add(b); return b;
}
/** A cuddly teddy bear sitting up. */
function teddy(g: THREE.Object3D, x: number, y: number, z: number, c = 0xc08a5a, s = 1, ry = 0) {
  const t = new THREE.Group(); t.position.set(x, y, z); t.scale.setScalar(s); t.rotation.y = ry; g.add(t);
  pball(t, c, 0.13, 0, 0.13, 0).scale.set(1, 1.1, 0.9);
  pball(t, c, 0.1, 0, 0.32, 0.02);
  for (const sx of [-1, 1]) { pball(t, c, 0.04, sx * 0.08, 0.41, 0.0); pball(t, c, 0.045, sx * 0.13, 0.15, 0.06); pball(t, c, 0.05, sx * 0.07, 0.03, 0.1); }
  pball(t, 0xf0d8b8, 0.045, 0, 0.3, 0.1);
  pball(t, 0x222222, 0.015, 0, 0.32, 0.14); for (const sx of [-1, 1]) pball(t, 0x222222, 0.014, sx * 0.04, 0.36, 0.1);
  pbox(t, 0xe4475b, 0.12, 0.04, 0.03, 0, 0.22, 0.1);
}
/** A potted plant. */
function plant(g: THREE.Object3D, x: number, y: number, z: number, tall = 1) {
  const p = new THREE.Group(); p.position.set(x, y, z); g.add(p);
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.32, 12), pm(0xc0683a)); pot.position.y = 0.16; p.add(pot);
  for (let k = 0; k < 6; k++) { const leaf = pball(p, k % 2 ? 0x3d8a4a : 0x4fa85a, 0.16 * tall, Math.cos(k) * 0.12, 0.42 + (k % 3) * 0.16 * tall, Math.sin(k) * 0.12); leaf.scale.y = 1.4; }
}
/** A framed picture with a simple painted scene. */
function framedPic(g: THREE.Object3D, x: number, y: number, z: number, ry: number, kind: number, w = 0.6, h = 0.45) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 96;
  const x2 = c.getContext('2d')!;
  const bg = ['#bfe6ff', '#ffe0ec', '#e8ffd8', '#fff1c8', '#e6dcff'][kind % 5]; x2.fillStyle = bg; x2.fillRect(0, 0, 128, 96);
  x2.font = '54px sans-serif'; x2.textAlign = 'center'; x2.textBaseline = 'middle';
  x2.fillText(['🐾', '🌈', '🌻', '⭐', '🦋', '🏡', '🌙', '🐣'][kind % 8], 64, 52);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const f = new THREE.Group(); f.position.set(x, y, z); f.rotation.y = ry; g.add(f);
  f.add(new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, h + 0.08, 0.04), pm([0xf4c430, 0x8a5a2b, 0xffffff, 0xe86aa8][kind % 4])));
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t })); pic.position.z = 0.025; f.add(pic);
}
/** A chest of drawers with knobs (front faces +z in its own space). */
function dresser(g: THREE.Object3D, x: number, y: number, z: number, ry: number, c: number, w = 1.1) {
  const d = new THREE.Group(); d.position.set(x, y, z); d.rotation.y = ry; g.add(d);
  pbox(d, c, w, 0.85, 0.45, 0, 0.43, 0);
  for (let r = 0; r < 3; r++) { pbox(d, 0xffffff, w - 0.12, 0.22, 0.02, 0, 0.17 + r * 0.26, 0.23, 0.6); pball(d, 0xd8b44a, 0.025, 0, 0.17 + r * 0.26, 0.25, 0.3); }
  return d;
}
/** A tall wardrobe with two doors. */
function wardrobe(g: THREE.Object3D, x: number, y: number, z: number, ry: number, c: number) {
  const d = new THREE.Group(); d.position.set(x, y, z); d.rotation.y = ry; g.add(d);
  pbox(d, c, 1.2, 2.0, 0.55, 0, 1.0, 0);
  pbox(d, 0x000000, 0.02, 1.85, 0.01, 0, 1.0, 0.28);
  for (const sx of [-1, 1]) pball(d, 0xd8b44a, 0.03, sx * 0.08, 1.05, 0.29, 0.3);
  pbox(d, 0xf4ece0, 0.5, 0.3, 0.3, 0.2, 2.15, 0); // a box on top
  return d;
}
const SIZES: [number, number][] = [[7, 6], [9, 8], [12, 10], [16, 12]];
const WALL_H = 4;
/** Upstairs floor height (your house only). */
export const FLOOR2 = WALL_H + 0.2;
const UP_H = 3.4;

export interface Spot { x: number; z: number; r: number; y?: number }
export interface Seat extends Spot { sitX: number; sitY: number; sitZ: number; yaw: number; kind: 'couch' | 'chair' | 'desk' }

export class Interior {
  group = new THREE.Group();
  door!: THREE.Object3D;
  bed!: Spot; fridge!: Spot; stove!: Spot;
  couch!: Seat; chair!: Seat;
  private tv?: { canvas: HTMLCanvasElement; tex: THREE.CanvasTexture; last: number };
  southZ = 0;
  bounds = { minX: 0, maxX: 0, minZ: 0, maxZ: 0, maxY: 0 };      // camera area: living room + bedrooms
  mainBounds = { minX: 0, maxX: 0, minZ: 0, maxZ: 0, maxY: 0 };  // just the living room
  private colliders: Collider[] = [];
  /** Add a collider that is removed when the house is rebuilt. */
  addCollider(c: Parameters<CollisionWorld['add']>[0]) { const k = this.collision.add(c); this.colliders.push(k); return k; }
  /** The 5 pens in the upstairs Pet Room: pen centre, its rotation (gate faces local +z), and where you stand to visit. */
  petPens: { x: number; z: number; ry: number; front: { x: number; z: number } }[] = [];
  petRoom: { minX: number; maxX: number; minZ: number; maxZ: number; y: number } | null = null;
  private doorCollider: Collider | null = null;
  pot!: THREE.Group;

  origin: { x: number; z: number };
  constructor(private scene: THREE.Scene, private collision: CollisionWorld, origin = INTERIOR) {
    this.origin = origin;
    scene.add(this.group);
  }

  get spawnInside() { return { x: this.origin.x, z: this.southZ - 2.6 }; }
  get doorInside() { return { x: this.origin.x, z: this.southZ - 0.9 }; }

  wingN = 0; wingS = 0;
  hasUpstairs = false;
  desk!: Seat; babyBed!: Spot;
  tub!: Spot; sink!: Spot; toilet!: Spot; toys!: Spot; stairsBottom!: Spot; stairsTop!: Spot;
  private upBounds = { minX: 0, maxX: 0, minZ: 0, maxZ: 0, maxY: 0, minY: 0 };
  /** Camera area for where you are: downstairs (with the stair hall) or upstairs. */
  boundsFor(y: number) { return this.hasUpstairs && y > FLOOR2 - 1.2 ? this.upBounds : this.bounds; }

  momBed!: Spot; dadBed!: Spot;
  /** Seats at the family table (you sit in `chair`). */
  familySeats: Record<string, Seat> = {};
  /** Where plates go on the table, by who sits there. */
  platesAt: Record<string, { x: number; z: number }> = {};
  private wingLampSpots: [number, number][] = [];
  build(tier: number, own = true, look?: { wall: number; floor: number; rug: number; sofa: number }, theme?: string) {
    this.nightlights = [];
    this.group.clear();
    for (const c of this.colliders) this.collision.remove(c);
    this.colliders = [];
    if (this.doorCollider) { this.collision.remove(this.doorCollider); this.doorCollider = null; }
    const [w, d] = SIZES[Math.min(tier, SIZES.length - 1)];
    const cx = this.origin.x, cz = this.origin.z;
    const N = cz - d / 2, S = cz + d / 2, W = cx - w / 2, E = cx + w / 2;
    this.southZ = S;
    const WD = own ? 7.4 : 6;   // the bedroom wing is deeper in your own house (more room upstairs too)
    this.bounds = { minX: W + 0.35, maxX: E - 0.35, minZ: N - WD - 0.2 + 0.35, maxZ: S - 0.35, maxY: WALL_H - 0.35 };
    this.mainBounds = { minX: W + 0.35, maxX: E - 0.35, minZ: N + 0.35, maxZ: S - 0.35, maxY: WALL_H - 0.35 };
    const m = (c: number, map: THREE.Texture | null = null, rough = 0.8) => new THREE.MeshStandardMaterial({ color: c, map, roughness: rough });
    const box = (mat: THREE.Material, bw: number, bh: number, bd: number, x: number, y: number, z: number, shadow = true) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), mat); b.position.set(x, y, z);
      b.castShadow = shadow; b.receiveShadow = true; this.group.add(b); return b;
    };
    // with an upstairs, downstairs walls stop at the upstairs floor so you can walk over them up there
    const WT = own ? FLOOR2 : 100;
    const solid = (minX: number, maxX: number, minZ: number, maxZ: number, top = WT) => {
      this.colliders.push(this.collision.add({ kind: 'box', minX, maxX, minZ, maxZ, top, tall: top >= 100 }));
    };
    this.hasUpstairs = own;
    this.petPens = []; this.petRoom = null;
    const doorZ = S - 1.2; // doorway to the stair hall (east wall, your house)
    // floor, walls, ceiling
    const floorTex = plankTexture(look?.floor ?? 0xa87a4c, true); floorTex.repeat.set(w / 3, d / 3);
    box(m(0xffffff, floorTex), w, 0.1, d, cx, -0.05, cz, false);
    const wallCols = [0xf1e3c8, 0xdfeedd, 0xe7ddf2, 0xf4dccd];
    const wall = m(look?.wall ?? wallCols[tier % wallCols.length], null, 0.95);
    // north wall with a doorway in the middle (to the bedrooms behind)
    const nSide = (w - 1.4) / 2;
    box(wall, nSide + 0.2, WALL_H, 0.2, W - 0.2 + (nSide + 0.2) / 2, WALL_H / 2, N - 0.1, false);
    box(wall, nSide + 0.2, WALL_H, 0.2, E + 0.2 - (nSide + 0.2) / 2, WALL_H / 2, N - 0.1, false);
    box(wall, 1.4, WALL_H - 2.3, 0.2, cx, 2.3 + (WALL_H - 2.3) / 2, N - 0.1, false);
    box(wall, 0.2, WALL_H, d + 0.4, W - 0.1, WALL_H / 2, cz, false);
    if (own) {
      const nLen = doorZ - 0.7 - (N - 0.2), sLen = S + 0.2 - (doorZ + 0.7);
      box(wall, 0.2, WALL_H, nLen, E + 0.1, WALL_H / 2, N - 0.2 + nLen / 2, false);
      box(wall, 0.2, WALL_H, sLen, E + 0.1, WALL_H / 2, doorZ + 0.7 + sLen / 2, false);
      box(wall, 0.2, WALL_H - 2.3, 1.4, E + 0.1, 2.3 + (WALL_H - 2.3) / 2, doorZ, false);
    } else box(wall, 0.2, WALL_H, d + 0.4, E + 0.1, WALL_H / 2, cz, false);
    const sideW = (w - 1.4) / 2;
    box(wall, sideW, WALL_H, 0.2, W + sideW / 2, WALL_H / 2, S + 0.1, false);
    box(wall, sideW, WALL_H, 0.2, E - sideW / 2, WALL_H / 2, S + 0.1, false);
    box(wall, 1.4, WALL_H - 2.3, 0.2, cx, 2.3 + (WALL_H - 2.3) / 2, S + 0.1, false);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m(0xf8f4ea));
    ceil.rotation.x = Math.PI / 2; ceil.position.set(cx, WALL_H, cz); this.group.add(ceil); // one-sided: you can see in from above
    // the bedroom wing behind the north wall: two rooms split by a wall, each with its own bed
    const wS = N - 0.2, wN = wS - WD;
    this.wingN = wN; this.wingS = wS;
    const wf = plankTexture(0x9a6e44, true); wf.repeat.set(w / 3, WD / 3);
    box(m(0xffffff, wf), w, 0.1, WD, cx, -0.05, (wN + wS) / 2, false);
    const wingWall = m(own ? 0xf3e2ea : (look?.wall ?? wallCols[(tier + 1) % wallCols.length]), null, 0.95);
    box(wingWall, w + 0.4, WALL_H, 0.2, cx, WALL_H / 2, wN - 0.1, false);
    box(wingWall, 0.2, WALL_H, WD + 0.4, W - 0.1, WALL_H / 2, (wN + wS) / 2, false);
    box(wingWall, 0.2, WALL_H, WD + 0.4, E + 0.1, WALL_H / 2, (wN + wS) / 2, false);
    box(wingWall, 0.16, WALL_H, WD - 2.2, cx, WALL_H / 2, wN + (WD - 2.2) / 2, false); // divider
    const wc = new THREE.Mesh(new THREE.PlaneGeometry(w, WD), m(0xf8f4ea)); wc.rotation.x = Math.PI / 2; wc.position.set(cx, WALL_H, (wN + wS) / 2); this.group.add(wc);
    solid(W - 1, cx - 0.7, N - 0.35, N + 0.1); solid(cx + 0.7, E + 1, N - 0.35, N + 0.1);
    solid(W - 1, E + 1, wN - 1, wN); solid(W - 1, W, wN - 1, S + 1);
    if (own) { solid(E, E + 1, wN - 1, N); solid(E - 0.05, E + 0.2, N - 0.2, doorZ - 0.7); solid(E - 0.05, E + 0.2, doorZ + 0.7, S + 1); }
    else solid(E, E + 1, wN - 1, S + 1);
    solid(cx - 0.12, cx + 0.12, wN, wN + WD - 2.2);
    const names = own ? ["Mom's Room 💗", "Dad's Room 💙"] : ['Bedroom', 'Bedroom'];
    const quilt = [0xe86a9a, 0x4a8ad8];
    [-1, 1].forEach((side, k) => {
      const bx2 = cx + side * w / 4, bz2 = wN + 1.45;
      const bw = new THREE.MeshStandardMaterial({ color: 0xffffff, map: plankTexture(0x9b7048, false), roughness: 0.9 });
      box(bw, 1.6, 0.4, 2.6, bx2, 0.2, bz2);
      box(m(0xf6f2ea), 1.5, 0.22, 2.4, bx2, 0.5, bz2);
      box(m(quilt[k], null, 0.95), 1.56, 0.12, 1.6, bx2, 0.62, bz2 + 0.45);
      box(m(0xffffff), 1.1, 0.16, 0.45, bx2, 0.68, bz2 - 0.85);
      box(bw, 1.7, 1.3, 0.12, bx2, 0.65, wN + 0.12);
      solid(bx2 - 0.8, bx2 + 0.8, bz2 - 1.3, bz2 + 1.3, 0.68);
      const rug = new THREE.Mesh(new THREE.CircleGeometry(0.9, 20), m(quilt[k], null, 1)); rug.rotation.x = -Math.PI / 2; rug.position.set(bx2, 0.01, bz2 + 2.1); this.group.add(rug);
      const c = document.createElement('canvas'); c.width = 256; c.height = 64;
      const g = c.getContext('2d')!; g.fillStyle = '#fffaf0'; g.beginPath(); g.roundRect(2, 2, 252, 60, 14); g.fill();
      g.fillStyle = '#5a3a22'; g.font = 'bold 34px Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(names[k], 128, 34);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshBasicMaterial({ map: t, transparent: true }));
      sign.position.set(bx2, 2.1, wN + 0.02); this.group.add(sign);
      if (own) this.addNightlight(bx2 - side * 1.0, wN + 0.12, k === 0 ? 0xb07aff : 0x6aaeff, 'star');
      (k === 0 ? (this.momBed = { x: bx2, z: bz2 + 0.3, r: 2 }) : (this.dadBed = { x: bx2, z: bz2 + 0.3, r: 2 }));
      // fill the room: wardrobe on the outside wall, dresser + mirror on the middle wall, plant, pictures, armchair
      const outX = side < 0 ? W : E, inX = cx;
      const furn = [0xf4e6d0, 0x8a6a4a][k];
      wardrobe(this.group, outX - side * 0.33, 0, wN + 3.6, -side * Math.PI / 2, furn);
      solid(Math.min(outX - side * 0.62, outX), Math.max(outX - side * 0.62, outX), wN + 2.95, wN + 4.25, 100);
      dresser(this.group, inX + side * 0.32, 0, wN + 3.4, side * Math.PI / 2, furn);
      solid(Math.min(inX + side * 0.08, inX + side * 0.56), Math.max(inX + side * 0.08, inX + side * 0.56), wN + 2.85, wN + 3.95, 0.86);
      const mir = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.9), new THREE.MeshStandardMaterial({ color: 0xdfeef6, roughness: 0.05, metalness: 0.9 }));
      mir.position.set(inX + side * 0.1, 1.6, wN + 3.4); mir.rotation.y = side * Math.PI / 2; this.group.add(mir);
      pball(this.group, [0xe86a9a, 0x4a8ad8][k], 0.08, inX + side * 0.35, 0.95, wN + 3.05); // vase of flowers
      for (let q = 0; q < 3; q++) pball(this.group, [0xffd34a, 0xff8ac0, 0xffffff][q], 0.05, inX + side * 0.35 + (q - 1) * 0.06, 1.08, wN + 3.05);
      pbox(this.group, 0x5a3a22, 0.3, 0.06, 0.2, inX + side * 0.32, 0.89, wN + 3.75); // jewellery box / watch tray
      plant(this.group, outX - side * 0.4, 0, wN + 5.0, 1.1);
      framedPic(this.group, outX - side * 0.11, 1.7, wN + 1.5, -side * Math.PI / 2, k * 3 + 1, 0.8, 0.6);
      framedPic(this.group, inX + side * 0.1, 1.9, wN + 1.0, side * Math.PI / 2, k * 3 + 2);
      // a bedside table with a book and an alarm clock
      const btx = bx2 + side * 1.15, btz = wN + 1.3;
      pbox(this.group, furn, 0.5, 0.55, 0.45, btx, 0.28, btz); pbox(this.group, 0xe4475b, 0.25, 0.05, 0.18, btx - 0.05, 0.58, btz);
      pball(this.group, 0xffffff, 0.07, btx + 0.12, 0.64, btz - 0.08);
      solid(btx - 0.26, btx + 0.26, btz - 0.24, btz + 0.24, 0.56);
      // a comfy armchair
      const acx = bx2 + side * 0.2, acz = wN + 4.4;
      const ac = new THREE.Group(); ac.position.set(acx, 0, acz); ac.rotation.y = Math.PI + side * 0.4; this.group.add(ac);
      pbox(ac, [0xf4a6c0, 0x7a9ad8][k], 0.8, 0.4, 0.75, 0, 0.25, 0, 0.95); pbox(ac, [0xf4a6c0, 0x7a9ad8][k], 0.8, 0.6, 0.15, 0, 0.6, -0.32, 0.95);
      for (const sx of [-0.38, 0.38]) pbox(ac, [0xe88aaa, 0x5a7ac0][k], 0.12, 0.3, 0.75, sx, 0.55, 0, 0.95);
      solid(acx - 0.45, acx + 0.45, acz - 0.45, acz + 0.45, 0.5);
      if (k === 0) teddy(this.group, bx2 + 0.45, 0.72, bz2 - 0.7, 0xf4c4d4, 0.9, 0.3); else pbox(this.group, 0x2f6a3a, 0.35, 0.06, 0.25, bx2 - 0.3, 0.7, bz2 + 0.2); // Mom's teddy, Dad's book

    });
    this.wingLampSpots = [[cx - w / 4 - 1.15, wN + 0.45], [cx + w / 4 + 1.15, wN + 0.45]];
    solid(W - 1, cx - 0.7, S, S + 1); solid(cx + 0.7, E + 1, S, S + 1);
    // the front door (pivot on its left edge)
    const doorPivot = new THREE.Group(); doorPivot.position.set(cx - 0.6, 0, S + 0.05); this.group.add(doorPivot);
    const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 0.08), m(0x6a3f22, plankTexture(0x6a3f22, false)));
    doorMesh.position.set(0.6, 1.1, 0); doorMesh.castShadow = true; doorPivot.add(doorMesh);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), m(0xd8b44a, null, 0.3)); knob.position.set(1.05, 1.1, -0.07); doorPivot.add(knob);
    this.door = doorPivot;
    // windows (glow like daylight)
    const glass = new THREE.MeshStandardMaterial({ color: 0xbfe3ff, emissive: 0x9fd0ff, emissiveIntensity: 0.6 });
    for (const zz of [cz - d * 0.2, cz + d * 0.2]) {
      const a = box(glass, 0.05, 1.1, 1.3, W + 0.01, 2.2, zz, false); a.castShadow = false;
      if (!own || zz < cz) { const b = box(glass, 0.05, 1.1, 1.3, E - 0.01, 2.2, zz, false); b.castShadow = false; }
    }
    // rug
    const rug = new THREE.Mesh(new THREE.CircleGeometry(Math.min(w, d) * 0.22, 28), m(look?.rug ?? 0xb8433a, null, 1));
    rug.rotation.x = -Math.PI / 2; rug.position.set(cx - 0.6, 0.01, cz + 0.4); rug.receiveShadow = true; this.group.add(rug);
    const wood = m(0xffffff, plankTexture(0x9b7048, false));
    // the big family table with four chairs (you, Mom, Dad and Baby Pip)
    {
      const tx = cx + w * 0.22, tz = cz - 0.2;
      box(wood, 2.2, 0.08, 1.2, tx, 0.78, tz);
      box(m(0xfff6e8, null, 0.9), 2.25, 0.01, 1.25, tx, 0.825, tz); // tablecloth
      for (const [ox, oz] of [[-1.0, -0.5], [1.0, -0.5], [-1.0, 0.5], [1.0, 0.5]]) box(wood, 0.08, 0.78, 0.08, tx + ox, 0.39, tz + oz);
      solid(tx - 1.12, tx + 1.12, tz - 0.62, tz + 0.62, 0.82);
      const seatCols = [0xd8453a, 0xe86a9a, 0x4a8ad8, 0xf4c430];
      const seats: [string, number, number, number][] = [['me', -0.55, -1.0, 0], ['Mom', 0.55, -1.0, 0], ['Baby Pip', -0.55, 1.0, Math.PI], ['Dad', 0.55, 1.0, Math.PI]];
      seats.forEach(([who, ox, oz, yaw], k) => {
        const sx = tx + ox, sz = tz + oz, back = yaw === 0 ? -0.28 : 0.28;
        box(wood, 0.55, 0.08, 0.55, sx, 0.5, sz);
        for (const [lx, lz] of [[-0.23, -0.23], [0.23, -0.23], [-0.23, 0.23], [0.23, 0.23]]) box(wood, 0.05, 0.5, 0.05, sx + lx, 0.25, sz + lz);
        box(wood, 0.55, 0.7, 0.05, sx, 0.85, sz + back);
        box(m(seatCols[k], null, 0.9), 0.48, 0.06, 0.48, sx, 0.56, sz);
        solid(sx - 0.28, sx + 0.28, sz - 0.28, sz + 0.28, 0.58);
        const seat: Seat = { x: sx + (ox < 0 ? -0.55 : 0.55), z: sz, r: 1.4, sitX: sx, sitY: 0.58, sitZ: sz, yaw, kind: 'chair' };
        if (who === 'me') this.chair = seat; else this.familySeats[who] = seat;
        this.platesAt[who] = { x: sx, z: tz + (yaw === 0 ? -0.32 : 0.32) };
      });
    }
    // bed (north-west corner) for human homes — your own bed is upstairs
    const bx = W + 1.1, bz = N + 1.5;
    if (!own) {
      box(wood, 1.6, 0.4, 2.6, bx, 0.2, bz);
      box(m(0xf6f2ea), 1.5, 0.22, 2.4, bx, 0.5, bz);
      box(m([0x3b8fd9, 0x4f8a3b, 0xe45a8a, 0xf4b532][tier % 4], null, 0.95), 1.56, 0.12, 1.6, bx, 0.62, bz + 0.45);
      box(m(0xffffff), 1.1, 0.16, 0.45, bx, 0.68, bz - 0.85);
      box(wood, 1.7, 1.2, 0.12, bx, 0.6, N + 0.15);
      solid(bx - 0.8, bx + 0.8, bz - 1.3, bz + 1.3, 0.68);
      this.bed = { x: bx, z: bz, r: 2.2 };
    }
    this.lampShades = []; this.lampLights = []; this.lamps = [];
    if (!own) this.addLamp(bx + 1.3, N + 0.5, Math.max(w, d));
    for (const [lx, lz] of this.wingLampSpots) this.addLamp(lx, lz, 8);
    // fridge (north-east corner)
    const fx = E - 0.6, fz = N + 0.5;
    box(m(0xf4f6f8, null, 0.35), 1.0, 2.0, 0.85, fx, 1.0, fz);
    box(m(0xdfe3e6, null, 0.35), 0.98, 0.02, 0.02, fx, 1.3, fz + 0.43);
    box(m(0x9aa3aa, null, 0.3), 0.05, 0.5, 0.05, fx - 0.38, 1.6, fz + 0.46);
    box(m(0x9aa3aa, null, 0.3), 0.05, 0.35, 0.05, fx - 0.38, 0.95, fz + 0.46);
    solid(fx - 0.5, fx + 0.5, fz - 0.45, fz + 0.45);
    this.fridge = { x: fx, z: fz + 0.4, r: 1.9 };
    // stove with the cooking pot
    const sx = E - 1.9, sz = N + 0.45;
    box(m(0x3a3d42, null, 0.5), 1.1, 0.95, 0.8, sx, 0.47, sz);
    this.pot = buildPot(false);
    this.pot.position.set(sx, 0.95, sz); this.pot.scale.setScalar(0.75);
    this.group.add(this.pot);
    solid(sx - 0.55, sx + 0.55, sz - 0.4, sz + 0.4);
    this.stove = { x: sx, z: sz + 0.4, r: 1.9 };
    // TV on a stand against the west wall, and a couch facing it
    {
      const tvz = cz + d * 0.3;
      box(wood, 0.5, 0.6, 1.6, W + 0.3, 0.3, tvz);
      box(m(0x1a1a1c, null, 0.4), 0.08, 0.95, 1.6, W + 0.32, 1.12, tvz);
      const c = document.createElement('canvas'); c.width = 256; c.height = 160;
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 0.82), new THREE.MeshBasicMaterial({ map: tex }));
      screen.rotation.y = Math.PI / 2; screen.position.set(W + 0.37, 1.12, tvz); this.group.add(screen);
      this.tv = { canvas: c, tex, last: -1 };
      solid(W - 0.2, W + 0.55, tvz - 0.8, tvz + 0.8);
      const cxp = W + Math.min(3.2, w * 0.33);
      const sofa = m(look?.sofa ?? [0x3d6fa8, 0x7a4fa0, 0x3f8a5a, 0xb0563a][tier % 4], null, 0.95);
      box(sofa, 0.85, 0.42, 2.0, cxp, 0.21, tvz);
      box(sofa, 0.8, 0.12, 1.8, cxp - 0.02, 0.48, tvz);
      box(sofa, 0.25, 0.75, 2.0, cxp + 0.32, 0.6, tvz);
      for (const oz of [-1.0, 1.0]) box(sofa, 0.85, 0.6, 0.18, cxp, 0.3, tvz + oz);
      solid(cxp - 0.42, cxp + 0.45, tvz - 1.05, tvz + 1.05, 0.55);
      this.addLamp(cxp + 0.1, tvz + 1.45, Math.max(w, d));
      this.couch = { x: cxp - 0.6, z: tvz, r: 1.7, sitX: cxp - 0.05, sitY: 0.55, sitZ: tvz, yaw: -Math.PI / 2, kind: 'couch' };
    }
    // a picture above the bedroom doorway
    const frame = box(m(0x8a5a2b), 1.3, 0.95, 0.06, cx, 3.15, N + 0.03, false);
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.75), m(0x7ab0d8));
    pic.position.set(frame.position.x, 3.15, N + 0.07); this.group.add(pic);
    const hill = new THREE.Mesh(new THREE.CircleGeometry(0.4, 16, 0, Math.PI), m(0x4f8a3b)); hill.position.set(frame.position.x - 0.15, 2.78, N + 0.08); this.group.add(hill);
    const sun = new THREE.Mesh(new THREE.CircleGeometry(0.1, 12), m(0xf4c430)); sun.position.set(frame.position.x + 0.3, 3.35, N + 0.08); this.group.add(sun);
    if (theme) this.addDecor(theme, W, E, N, S, cx, cz, w, d);
    if (own) this.buildUpstairs(tier, W, E, N, S, cx, cz, w, d, doorZ, m, box, solid);
    this.setDoor(false);
    this.setLamps(this.lampsOn);
    this.nightOn = null;
  }

  /** Things that make each human home feel like its owner's. */
  private addDecor(theme: string, W: number, E: number, N: number, S: number, cx: number, cz: number, w: number, d: number) {
    const m = (c: number, rough = 0.7) => new THREE.MeshStandardMaterial({ color: c, roughness: rough });
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) => {
      const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = true; this.group.add(o); return o;
    };
    const ball = (r: number) => new THREE.SphereGeometry(r, 14, 10);
    const blk = (a: number, b: number, c: number) => new THREE.BoxGeometry(a, b, c);
    const solidCyl = (x: number, z: number, r: number) => this.colliders.push(this.collision.add({ kind: 'cyl', x, z, r, top: 100, tall: true }));
    const poster = (x: number, y: number, z: number, ry: number, draw: (g: CanvasRenderingContext2D) => void) => {
      const c = document.createElement('canvas'); c.width = 192; c.height = 256; const g = c.getContext('2d')!; draw(g);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.07), new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 }));
      p.position.set(x, y, z); p.rotation.y = ry; this.group.add(p);
    };
    const tx = cx + w * 0.18, tz = cz + 0.6, tableY = 0.8;      // the table top
    const se = { x: E - 0.8, z: S - 0.9 };                        // free south-east corner
    const southWallZ = S - 0.06, eastWallX = E - 0.06;
    if (theme === 'kitchen') {
      // fruit bowl, a pot rack with hanging pans, a basket of veggies
      add(new THREE.SphereGeometry(0.28, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), m(0xf4f0e6, 0.4), tx, tableY + 0.28, tz);
      [0xe4475b, 0xf2c14e, 0x4f8a3b, 0xf08a3c].forEach((c, k) => add(ball(0.1), m(c, 0.4), tx + Math.cos(k * 1.6) * 0.12, tableY + 0.12, tz + Math.sin(k * 1.6) * 0.12));
      add(blk(0.05, 0.05, 1.8), m(0x555555, 0.3), eastWallX - 0.15, 2.6, cz);
      for (let k = 0; k < 3; k++) { add(new THREE.CylinderGeometry(0.2, 0.18, 0.14, 14), m(0x2a2a2c, 0.4), eastWallX - 0.3, 2.25, cz - 0.6 + k * 0.6); add(blk(0.03, 0.3, 0.03), m(0x555555), eastWallX - 0.2, 2.45, cz - 0.6 + k * 0.6); }
      add(new THREE.CylinderGeometry(0.35, 0.28, 0.35, 14), m(0xb08a5a, 1), se.x, 0.18, se.z);
      [0xe8742a, 0x4f8a3b, 0xd8452e].forEach((c, k) => add(ball(0.1), m(c), se.x - 0.12 + k * 0.12, 0.42, se.z));
      solidCyl(se.x, se.z, 0.4);
      poster(cx - 2.2, 2.3, southWallZ, Math.PI, (g) => { g.fillStyle = '#fff4e0'; g.fillRect(0, 0, 192, 256); g.fillStyle = '#d8452e'; g.font = 'bold 34px sans-serif'; g.textAlign = 'center'; g.fillText('SOUP', 96, 60); g.fillText('OF THE', 96, 100); g.fillText('DAY', 96, 140); g.font = '70px sans-serif'; g.fillText('🍲', 96, 225); });
    } else if (theme === 'bakery') {
      // a cake on a stand, bread on a shelf, flour sacks
      add(new THREE.CylinderGeometry(0.22, 0.22, 0.04, 16), m(0xffffff, 0.3), tx, tableY + 0.12, tz);
      add(new THREE.CylinderGeometry(0.03, 0.06, 0.1, 8), m(0xffffff, 0.3), tx, tableY + 0.05, tz);
      add(new THREE.CylinderGeometry(0.18, 0.18, 0.2, 16), m(0xf7d6e0, 0.5), tx, tableY + 0.24, tz);
      add(ball(0.04), m(0xd0102a), tx, tableY + 0.37, tz);
      add(blk(1.6, 0.06, 0.35), m(0x8a6440), cx - 2, 1.6, southWallZ - 0.18);
      for (let k = 0; k < 4; k++) add(ball(0.17), m(0xc8823a, 0.8), cx - 2.6 + k * 0.4, 1.75, southWallZ - 0.2, 1.4, 0.8, 1);
      for (let k = 0; k < 2; k++) add(ball(0.32), m(0xf4f0e6, 1), se.x - 0.3 + k * 0.55, 0.32, se.z, 1, 1.2, 0.9);
      solidCyl(se.x, se.z, 0.55);
    } else if (theme === 'cabin') {
      // hay bale, rain boots, a hanging lantern, a rooster picture
      const hay = add(new THREE.CylinderGeometry(0.55, 0.55, 1.1, 16), m(0xd9b45a, 1), se.x, 0.55, se.z); hay.rotation.z = Math.PI / 2;
      solidCyl(se.x, se.z, 0.6);
      for (const k of [0, 1]) add(blk(0.18, 0.4, 0.3), m(0x3d7a3a, 0.4), cx + 1.2 + k * 0.25, 0.2, S - 0.45);
      add(ball(0.18), new THREE.MeshStandardMaterial({ color: 0xffe0a0, emissive: 0xffb040, emissiveIntensity: 1.2 }), cx - 1.2, 3.3, cz);
      add(blk(0.02, 0.6, 0.02), m(0x333333), cx - 1.2, 3.7, cz);
      poster(eastWallX, 2.3, cz, -Math.PI / 2, (g) => { g.fillStyle = '#f4e3c0'; g.fillRect(0, 0, 192, 256); g.font = '110px sans-serif'; g.textAlign = 'center'; g.fillText('🐓', 96, 160); g.fillStyle = '#6a3f22'; g.font = 'bold 26px sans-serif'; g.fillText('GOOD MORNING', 96, 225); });
    } else if (theme === 'garden') {
      // plants everywhere
      const pot = (x: number, z: number, s = 1) => {
        add(new THREE.CylinderGeometry(0.25 * s, 0.2 * s, 0.4 * s, 12), m(0xb0563a, 0.8), x, 0.2 * s, z);
        add(ball(0.38 * s), m(0x3f8a3a, 0.9), x, 0.62 * s, z, 1, 1.2, 1);
        for (let k = 0; k < 3; k++) add(ball(0.07 * s), m([0xe4475b, 0xf2c14e, 0xb56be0][k]), x + (k - 1) * 0.16 * s, 0.9 * s, z - 0.25 * s);
        solidCyl(x, z, 0.3 * s);
      };
      pot(se.x, se.z, 1.3); pot(E - 0.6, cz - 0.4, 1); pot(cx + 1.2, S - 0.5, 0.9);
      add(new THREE.CylinderGeometry(0.12, 0.1, 0.18, 10), m(0xb0563a), tx, tableY + 0.09, tz);
      add(ball(0.16), m(0x4f9a3a), tx, tableY + 0.28, tz);
      for (let k = 0; k < 5; k++) add(new THREE.ConeGeometry(0.06, 0.6, 5), m(0x4f8a3b), cx - 1.5 + k * 0.1, 3.6, cz - 1, 1, 1, 1).rotation.x = Math.PI;
      poster(cx - 2.2, 2.3, southWallZ, Math.PI, (g) => { g.fillStyle = '#e2f2d6'; g.fillRect(0, 0, 192, 256); g.font = '90px sans-serif'; g.textAlign = 'center'; g.fillText('🌻', 96, 130); g.fillStyle = '#3d6a2e'; g.font = 'bold 28px sans-serif'; g.fillText('GROW!', 96, 215); });
    } else if (theme === 'fun') {
      // bean bag, toy blocks, a ball, rocket posters
      add(ball(0.55), m(0xe45a8a, 0.9), se.x, 0.35, se.z, 1.1, 0.65, 1.1);
      solidCyl(se.x, se.z, 0.6);
      const cols = [0xe4475b, 0xf2c14e, 0x3b8fd9, 0x4f8a3b];
      for (let k = 0; k < 6; k++) add(blk(0.28, 0.28, 0.28), m(cols[k % 4], 0.5), cx + 1.0 + (k % 3) * 0.3, 0.14 + Math.floor(k / 3) * 0.28, S - 0.6);
      add(ball(0.22), m(0xd8452e, 0.4), cx - 1.0, 0.22, S - 0.8);
      add(blk(0.3, 0.06, 0.18), m(0x30343a, 0.4), tx, tableY + 0.04, tz);
      poster(cx - 2.2, 2.3, southWallZ, Math.PI, (g) => { g.fillStyle = '#1d2a5a'; g.fillRect(0, 0, 192, 256); g.fillStyle = '#fff3a0'; for (let i = 0; i < 20; i++) g.fillRect((i * 53) % 192, (i * 97) % 256, 3, 3); g.font = '100px sans-serif'; g.textAlign = 'center'; g.fillText('🚀', 96, 160); });
      poster(eastWallX, 2.3, cz, -Math.PI / 2, (g) => { g.fillStyle = '#7fd8ff'; g.fillRect(0, 0, 192, 256); g.font = '100px sans-serif'; g.textAlign = 'center'; g.fillText('🎮', 96, 150); g.fillStyle = '#1d2a3a'; g.font = 'bold 30px sans-serif'; g.fillText('PLAY!', 96, 225); });
    } else if (theme === 'farm') {
      // fireplace with a warm glow and a rocking chair
      const fx = eastWallX - 0.4, fz = cz;
      add(blk(0.8, 1.6, 1.8), m(0x8a857c, 1), fx, 0.8, fz);
      add(blk(0.2, 0.8, 1.0), new THREE.MeshStandardMaterial({ color: 0x331a0a, emissive: 0xff6a00, emissiveIntensity: 1.1 }), fx - 0.32, 0.45, fz);
      add(blk(0.9, 0.12, 2.0), m(0x6a3f22), fx, 1.65, fz);
      this.colliders.push(this.collision.add({ kind: 'box', minX: fx - 0.45, maxX: fx + 0.45, minZ: fz - 0.95, maxZ: fz + 0.95, top: 100, tall: true }));
      const rc = new THREE.Group(); rc.position.set(fx - 1.5, 0, fz + 0.8); rc.rotation.y = -Math.PI / 2; this.group.add(rc);
      const wood = m(0x8a5a32);
      const seat = new THREE.Mesh(blk(0.6, 0.08, 0.6), wood); seat.position.y = 0.5; rc.add(seat);
      const back = new THREE.Mesh(blk(0.6, 0.8, 0.06), wood); back.position.set(0, 0.9, -0.28); rc.add(back);
      for (const sx of [-0.28, 0.28]) { const rock = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.03, 6, 16, Math.PI / 2), wood); rock.rotation.set(0, Math.PI / 2, Math.PI * 1.25); rock.position.set(sx, 0.5, 0); rc.add(rock); }
      solidCyl(fx - 1.5, fz + 0.8, 0.4);
      add(new THREE.CylinderGeometry(0.1, 0.12, 0.3, 12), m(0xf4f0e6, 0.4), tx, tableY + 0.15, tz);
    }
  }

  /** Your house: a stair hall beside the living room, and upstairs a hallway with My Room, a Bathroom and a Playroom. */
  private buildUpstairs(tier: number, W: number, E: number, N: number, S: number, cx: number, cz: number, w: number, d: number, doorZ: number,
    m: (c: number, map?: THREE.Texture | null, rough?: number) => THREE.MeshStandardMaterial,
    box: (mat: THREE.Material, bw: number, bh: number, bd: number, x: number, y: number, z: number, shadow?: boolean) => THREE.Mesh,
    solid: (minX: number, maxX: number, minZ: number, maxZ: number, top?: number) => void) {
    const Y = FLOOR2, AW = 2.6, A0 = E + 0.2, Ea = A0 + AW, wN = this.wingN;
    const up = (minX: number, maxX: number, minZ: number, maxZ: number, top: number, bottom = Y) =>
      this.colliders.push(this.collision.add({ kind: 'box', minX, maxX, minZ, maxZ, top, bottom, tall: top >= 100 }));
    // ---- stair hall (downstairs)
    const hallWall = m(0xe8dcc8, null, 0.95);
    box(m(0xffffff, plankTexture(0xa87a4c, true)), AW, 0.1, d, A0 + AW / 2, -0.05, cz, false);
    box(hallWall, 0.2, WALL_H, d + 0.4, Ea + 0.1, WALL_H / 2, cz, false);
    box(hallWall, AW + 0.2, WALL_H, 0.2, A0 + AW / 2, WALL_H / 2, S + 0.1, false);
    solid(Ea, Ea + 1, N - 1, S + 1, 100); solid(E, Ea + 1, S, S + 1);
    // ---- the stairs: 12 steps climbing north
    const steps = 12, rise = Y / steps, run = 0.34, z0 = Math.min(doorZ - 0.75, N + steps * run + 0.02);
    const stepMat = m(0xffffff, plankTexture(0x8a5a32, true));
    for (let i = 0; i < steps; i++) {
      const top = (i + 1) * rise, zA = z0 - (i + 1) * run, zB = z0 - i * run;
      box(stepMat, AW - 0.1, top, run, A0 + AW / 2, top / 2, (zA + zB) / 2);
      solid(A0, Ea, zA, zB, top);
    }
    const topZ = z0 - steps * run;
    const rail = m(0x6a3f22, null, 0.6);
    for (let i = 0; i <= steps; i += 2) { const p = box(rail, 0.06, 1.0, 0.06, A0 + 0.05, i * rise + 0.5, z0 - i * run); p.castShadow = false; }
    this.stairsBottom = { x: A0 + AW / 2, z: z0 + 0.55, r: 1.5, y: 0 };
    this.stairsTop = { x: A0 + AW / 2, z: topZ - 0.9, r: 1.6, y: Y };
    // ---- upstairs floors: over the living room, the bedroom wing, and a big landing beside the stairs
    const upFloor = m(0xffffff, plankTexture(0xc8a070, true));
    const fN = wN - 0.2;
    box(upFloor, w + 0.4, 0.2, S - fN + 0.2, cx, Y - 0.1, (fN + S + 0.2) / 2, false);
    up(W - 0.2, E + 0.2, fN, S + 0.2, Y, Y - 0.25);
    box(upFloor, AW + 0.2, 0.2, topZ - fN, A0 + AW / 2, Y - 0.1, (fN + topZ) / 2, false);
    up(E, Ea + 0.2, fN, topZ, Y, Y - 0.25);
    // ---- upstairs walls: outside walls, My Room's wall, the bathroom/playroom walls
    const H = UP_H;
    const plain = m(0xf4ece0, null, 0.95), mine = m([0xf6d6e6, 0xe6dcf6, 0xd6eef6, 0xf6ead6][tier % 4], null, 0.95), tile = m(0xcfe8f2, null, 0.4), play = m(0xfff3c4, null, 0.95);
    const wallX = (mat: THREE.Material, x: number, z1: number, z2: number) => { box(mat, 0.2, H, z2 - z1, x, Y + H / 2, (z1 + z2) / 2, false); up(x - 0.12, x + 0.12, z1, z2, 100); };
    const wallZ = (mat: THREE.Material, z: number, x1: number, x2: number) => { box(mat, x2 - x1, H, 0.2, (x1 + x2) / 2, Y + H / 2, z, false); up(x1, x2, z - 0.12, z + 0.12, 100); };
    const wallZDoor = (mat: THREE.Material, z: number, x1: number, x2: number, doorX: number) => {
      wallZ(mat, z, x1, doorX - 0.65); wallZ(mat, z, doorX + 0.65, x2);
      box(mat, 1.3, H - 2.2, 0.2, doorX, Y + 2.2 + (H - 2.2) / 2, z, false);
    };
    wallX(plain, W - 0.3, fN, S + 0.3);           // west
    wallZ(plain, fN - 0.1, W - 0.3, Ea + 0.2);     // north
    const hN = Math.min(N + 0.6, topZ - 0.1);     // south side of the hallway (the bathroom & playroom wall)
    const zRoom = hN - 2.6;                         // My Room's south wall: a nice wide hallway in between
    wallX(plain, Ea + 0.1, fN, S + 0.3);          // east
    wallZ(plain, S + 0.3, W - 0.3, Ea + 0.2);      // south
    wallZDoor(mine, zRoom, W - 0.3, Ea + 0.1, cx);
    const bathDoorX = (W + cx) / 2, playDoorX = (cx + E) / 2;
    wallZ(plain, hN, W - 0.3, bathDoorX - 0.65); wallZ(plain, hN, bathDoorX + 0.65, playDoorX - 0.65); wallZ(plain, hN, playDoorX + 0.65, E + 0.2);
    for (const dx of [bathDoorX, playDoorX]) box(plain, 1.3, H - 2.2, 0.2, dx, Y + 2.2 + (H - 2.2) / 2, hN, false);
    wallX(plain, cx, hN, S + 0.3);                 // bathroom | playroom
    wallX(plain, E + 0.1, hN, S + 0.3);            // playroom | stairwell
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(Ea - W + 0.5, S - fN + 0.6), m(0xfdfaf4)); ceil.rotation.x = Math.PI / 2; ceil.position.set((W + Ea) / 2, Y + H, (fN + S) / 2); this.group.add(ceil);
    this.upBounds = { minX: W - 0.1, maxX: Ea - 0.1, minZ: fN + 0.2, maxZ: S + 0.1, maxY: Y + H - 0.3, minY: Y + 0.3 };
    (this.bounds as { maxX: number }).maxX = Ea - 0.35;
    // room signs above the doorways (seen from the hallway)
    const doorSign = (text: string, x: number, z: number, ry: number, color = '#c0467a') => {
      const sc = document.createElement('canvas'); sc.width = 512; sc.height = 128;
      const sg = sc.getContext('2d')!; sg.fillStyle = '#fffaf4'; sg.beginPath(); sg.roundRect(4, 4, 504, 120, 30); sg.fill();
      sg.fillStyle = color; sg.font = 'bold 60px Nunito, sans-serif'; sg.textAlign = 'center'; sg.textBaseline = 'middle'; sg.fillText(text, 256, 68);
      const st = new THREE.CanvasTexture(sc); st.colorSpace = THREE.SRGBColorSpace;
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshBasicMaterial({ map: st, transparent: true }));
      sign.position.set(x, Y + 2.55, z); sign.rotation.y = ry; this.group.add(sign);
    };
    doorSign('My Room 🌸', cx, zRoom + 0.12, 0);
    doorSign('Bathroom 🛁', bathDoorX, hN - 0.12, Math.PI, '#2f7aa8');
    doorSign('Playroom 🧸', playDoorX, hN - 0.12, Math.PI, '#b07a00');
    // hallway runner rug
    const runner = new THREE.Mesh(new THREE.PlaneGeometry(Ea - W - 0.6, 1.4), m(0xb57ad8, null, 1)); runner.rotation.x = -Math.PI / 2; runner.position.set((W + Ea) / 2, Y + 0.01, (zRoom + hN) / 2); this.group.add(runner);

    // ---- MY ROOM (over the bedroom wing): bed, Baby Pip's bed, desk, bookshelf, paintings
    const wood = m(0xffffff, plankTexture(0xb08050, false));
    const bx = W + 1.1, bz = fN + 1.5;
    box(wood, 1.6, 0.4, 2.6, bx, Y + 0.2, bz);
    box(m(0xf6f2ea), 1.5, 0.22, 2.4, bx, Y + 0.5, bz);
    box(m(0xe86aa8, null, 0.95), 1.56, 0.12, 1.6, bx, Y + 0.62, bz + 0.45);
    box(m(0xffffff), 1.1, 0.16, 0.45, bx, Y + 0.68, bz - 0.85);
    box(wood, 1.7, 1.2, 0.12, bx, Y + 0.6, fN + 0.05);
    up(bx - 0.8, bx + 0.8, bz - 1.3, bz + 1.3, Y + 0.68);
    this.bed = { x: bx, z: bz, r: 2.2, y: Y };
    const kx = bx + 1.75, kz = fN + 1.15;
    box(wood, 1.1, 0.35, 1.8, kx, Y + 0.18, kz);
    box(m(0xfff7d6), 1.0, 0.18, 1.7, kx, Y + 0.44, kz);
    box(m(0xf4c430, null, 0.95), 1.04, 0.1, 1.0, kx, Y + 0.54, kz + 0.35);
    for (const sx of [-0.52, 0.52]) box(wood, 0.06, 0.7, 1.8, kx + sx, Y + 0.45, kz);
    up(kx - 0.55, kx + 0.55, kz - 0.9, kz + 0.9, Y + 0.55);
    this.babyBed = { x: kx, z: kz + 0.2, r: 1.5, y: Y + 0.55 };
    // nightlights above the beds where you can see them
    this.addNightlight(bx, fN + 0.06, 0xff8ac0, 'moon', false, Y, 1.55, 1.6);
    this.addNightlight(kx, fN + 0.06, 0xffe066, 'star', false, Y, 1.35, 1.4);
    // and a big glowing moon lamp on a little table right next to the beds
    {
      const ntx = kx + 0.95, ntz = fN + 0.45;
      pbox(this.group, 0xf6d6e6, 0.5, 0.6, 0.45, ntx, Y + 0.3, ntz);
      up(ntx - 0.26, ntx + 0.26, ntz - 0.24, ntz + 0.24, Y + 0.62);
      const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffe08a, emissiveIntensity: 0.15, roughness: 0.5 });
      const moon = new THREE.Mesh(new THREE.SphereGeometry(0.18, 20, 14), lampMat); moon.position.set(ntx - 0.1, Y + 0.85, ntz); this.group.add(moon);
      pbox(this.group, 0x8a5a2b, 0.18, 0.06, 0.18, ntx - 0.1, Y + 0.64, ntz);
      const ml = new THREE.PointLight(0xffd8a0, 0, 4.5, 1.5); ml.position.set(ntx, Y + 1.0, ntz + 0.2); this.group.add(ml);
      this.nightlights.push({ mat: lampMat, light: ml });
      teddy(this.group, ntx + 0.15, Y + 0.6, ntz + 0.08, 0xd8a070, 0.45, 0.4);
    }
    this.addLamp(W + 0.4, zRoom - 0.5, 8, Y);
    // desk against the north wall, chair facing it
    const dx = Math.min(kx + 2.6, Ea - 3.2), dz = fN + 0.45;
    box(wood, 1.8, 0.08, 0.75, dx, Y + 0.78, dz);
    for (const [ox, oz] of [[-0.82, -0.3], [0.82, -0.3], [-0.82, 0.3], [0.82, 0.3]]) box(wood, 0.07, 0.78, 0.07, dx + ox, Y + 0.39, dz + oz);
    up(dx - 0.9, dx + 0.9, dz - 0.38, dz + 0.38, Y + 0.82);
    box(m(0x3b8fd9), 0.4, 0.04, 0.3, dx - 0.3, Y + 0.84, dz).rotation.y = 0.2;
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), m(0x4a8ad8, null, 0.4)); globe.position.set(dx + 0.55, Y + 1.05, dz - 0.1); this.group.add(globe);
    box(m(0x8a5a2b), 0.05, 0.12, 0.05, dx + 0.55, Y + 0.88, dz - 0.1);
    const chz = dz + 0.85;
    box(m(0xe86aa8, null, 0.9), 0.55, 0.08, 0.55, dx, Y + 0.5, chz);
    for (const [ox, oz] of [[-0.23, -0.23], [0.23, -0.23], [-0.23, 0.23], [0.23, 0.23]]) box(wood, 0.05, 0.5, 0.05, dx + ox, Y + 0.25, chz + oz);
    box(wood, 0.55, 0.6, 0.05, dx, Y + 0.85, chz + 0.27);
    up(dx - 0.28, dx + 0.28, chz - 0.28, chz + 0.28, Y + 0.54);
    this.desk = { x: dx, z: chz + 0.45, r: 1.6, y: Y, sitX: dx, sitY: Y + 0.54, sitZ: chz, yaw: Math.PI, kind: 'desk' };
    // bookshelf on the east wall, rug, window
    const shelfX = Ea - 0.3, shelfZ = (fN + zRoom) / 2;
    const shelf = new THREE.Group(); shelf.position.set(shelfX, Y, shelfZ); shelf.rotation.y = -Math.PI / 2; this.group.add(shelf);
    const sb = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.8, 0.4), wood); sb.position.y = 0.9; shelf.add(sb);
    const bookCols = [0xe4475b, 0xf2c14e, 0x3b8fd9, 0x4f8a3b, 0xb56be0];
    for (let r = 0; r < 3; r++) for (let i = 0; i < 7; i++) { const bk = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.38, 0.28), m(bookCols[(i + r) % 5])); bk.position.set(-0.55 + i * 0.18, 0.35 + r * 0.55, 0.06); shelf.add(bk); }
    up(shelfX - 0.25, shelfX + 0.25, shelfZ - 0.72, shelfZ + 0.72, 100);
    const rug = new THREE.Mesh(new THREE.CircleGeometry(1.3, 28), m(0xb57ad8, null, 1)); rug.rotation.x = -Math.PI / 2; rug.position.set((W + Ea) / 2, Y + 0.01, (fN + zRoom) / 2 + 0.4); this.group.add(rug);
    const glass = new THREE.MeshStandardMaterial({ color: 0xbfe3ff, emissive: 0x9fd0ff, emissiveIntensity: 0.6 });
    box(glass, 0.05, 1.1, 1.4, W - 0.19, Y + 1.9, (fN + zRoom) / 2 + 0.6, false).castShadow = false;
    // paintings
    const paint = (x: number, z: number, ry: number, kind: number) => {
      const c = document.createElement('canvas'); c.width = 256; c.height = 192;
      const g = c.getContext('2d')!;
      if (kind === 0) {
        const sky = g.createLinearGradient(0, 0, 0, 192); sky.addColorStop(0, '#ff9a5c'); sky.addColorStop(1, '#ffd36a'); g.fillStyle = sky; g.fillRect(0, 0, 256, 192);
        g.fillStyle = '#ff6a3d'; g.beginPath(); g.arc(128, 120, 40, 0, 7); g.fill();
        g.fillStyle = '#4f8a3b'; g.beginPath(); g.ellipse(70, 192, 120, 70, 0, 0, 7); g.fill(); g.fillStyle = '#3d6e2e'; g.beginPath(); g.ellipse(210, 200, 110, 60, 0, 0, 7); g.fill();
      } else if (kind === 1) {
        g.fillStyle = '#1d2a5a'; g.fillRect(0, 0, 256, 192);
        g.fillStyle = '#fff3a0'; for (let i = 0; i < 30; i++) { g.beginPath(); g.arc((i * 97) % 256, (i * 53) % 130, 1.5 + (i % 3), 0, 7); g.fill(); }
        g.beginPath(); g.arc(200, 45, 22, 0, 7); g.fill(); g.fillStyle = '#1d2a5a'; g.beginPath(); g.arc(210, 40, 20, 0, 7); g.fill();
        g.fillStyle = '#2f4a2a'; g.fillRect(0, 160, 256, 32);
      } else if (kind === 2) {
        g.fillStyle = '#e6f4fb'; g.fillRect(0, 0, 256, 192);
        g.fillStyle = '#3d8a5a'; for (const fx of [100, 128, 156]) g.fillRect(fx - 2, 70, 4, 70);
        const fc = ['#e4475b', '#f2c14e', '#b56be0'];
        [100, 128, 156].forEach((fx, i) => { g.fillStyle = fc[i]; for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(fx + Math.cos(k) * 12, 62 + Math.sin(k) * 12, 9, 0, 7); g.fill(); } g.fillStyle = '#fff'; g.beginPath(); g.arc(fx, 62, 7, 0, 7); g.fill(); });
        g.fillStyle = '#3b8fd9'; g.beginPath(); g.roundRect(100, 130, 56, 50, 12); g.fill();
      } else {
        g.fillStyle = '#fde7f1'; g.fillRect(0, 0, 256, 192);
        g.fillStyle = '#c99a6a'; g.beginPath(); g.arc(128, 110, 50, 0, 7); g.fill();
        g.beginPath(); g.ellipse(95, 60, 14, 30, -0.3, 0, 7); g.fill(); g.beginPath(); g.ellipse(161, 60, 14, 30, 0.3, 0, 7); g.fill();
        g.fillStyle = '#222'; g.beginPath(); g.arc(110, 100, 6, 0, 7); g.arc(146, 100, 6, 0, 7); g.fill();
        g.strokeStyle = '#222'; g.lineWidth = 4; g.beginPath(); g.arc(128, 118, 16, 0.2, Math.PI - 0.2); g.stroke();
        g.fillStyle = '#e4475b'; g.beginPath(); g.moveTo(215, 40); g.bezierCurveTo(240, 10, 255, 50, 215, 75); g.bezierCurveTo(175, 50, 190, 10, 215, 40); g.fill();
      }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const fr = new THREE.Group(); fr.position.set(x, Y + 2.1, z); fr.rotation.y = ry; this.group.add(fr);
      fr.add(new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.98, 0.05), m(0x8a5a2b)));
      const pic = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.83), new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 })); pic.position.z = 0.03; fr.add(pic);
    };
    paint(dx + 1.6 < Ea - 0.8 ? dx + 1.6 : dx - 1.6, fN + 0.02, 0, 0);
    paint(W - 0.19, (fN + zRoom) / 2 - 0.9, Math.PI / 2, 1);
    paint(W + 1.5, zRoom - 0.12, Math.PI, 3);
    paint(cx + 2.0 < Ea - 1 ? cx + 2.0 : Ea - 1.2, zRoom - 0.12, Math.PI, 2);
    {
      const G = this.group, midZ = (fN + zRoom) / 2;
      // cuddly toys on the beds, a toy chest at the foot of yours, a dresser, a plant, floor cushions
      teddy(G, bx + 0.35, Y + 0.68, bz - 0.75, 0xc08a5a, 1, 0.2);
      teddy(G, bx - 0.3, Y + 0.68, bz - 0.8, 0xf4f0ea, 0.8, -0.3);
      teddy(G, kx, Y + 0.6, kz - 0.5, 0xf4c4d4, 0.6);
      const tcz = bz + 1.75;
      pbox(G, 0xe86aa8, 1.0, 0.5, 0.5, bx, Y + 0.25, tcz); pbox(G, 0xf4c430, 1.04, 0.08, 0.54, bx, Y + 0.52, tcz);
      up(bx - 0.52, bx + 0.52, tcz - 0.27, tcz + 0.27, Y + 0.56);
      const drx = Math.min(cx + 1.8, Ea - 1.6);
      dresser(G, drx, Y, zRoom - 0.33, Math.PI, 0xfff3f8);
      up(drx - 0.56, drx + 0.56, zRoom - 0.58, zRoom - 0.08, Y + 0.86);
      plant(G, drx + 0.35, Y + 0.86, zRoom - 0.33, 0.6);
      pball(G, 0x3b8fd9, 0.08, drx - 0.3, Y + 0.94, zRoom - 0.33, 0.3); // a snow globe
      plant(G, Ea - 0.45, Y, zRoom - 0.5, 1.2);
      for (const [ox, col] of [[-0.5, 0xffd34a], [0.5, 0x7ac0e8]] as const) {
        const cu = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.38, 0.18, 16), pm(col, 0.95)); cu.position.set((W + Ea) / 2 + 1.4 + ox, Y + 0.09, midZ + 1.4); G.add(cu);
      }
      // a mobile of stars and moons over Baby Pip's bed
      pbox(G, 0xffffff, 0.02, 0.6, 0.02, kx, Y + 1.9, kz - 0.1);
      for (let q = 0; q < 5; q++) { const a = (q / 5) * Math.PI * 2; pball(G, [0xffe066, 0xff8ac0, 0x9fd0ff, 0xb5a0ff, 0xffffff][q], 0.06, kx + Math.cos(a) * 0.3, Y + 1.5 - (q % 2) * 0.1, kz - 0.1 + Math.sin(a) * 0.3, 0.4); }
      // twinkly fairy lights along the top of the wall (they glow at night)
      const fairy = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffd070, emissiveIntensity: 0.1 });
      for (let q = 0; q < 16; q++) { const fx = W + 0.3 + (q / 15) * (Ea - W - 0.6); const b = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), fairy); b.position.set(fx, Y + 2.9 - Math.abs(Math.sin(q * 1.3)) * 0.12, fN + 0.08); G.add(b); }
      const fl = new THREE.PointLight(0xffd8a0, 0, 5, 1.6); fl.position.set((W + Ea) / 2, Y + 2.6, fN + 0.6); G.add(fl);
      this.nightlights.push({ mat: fairy, light: fl });
      // a shelf above the desk with trophies and a little plant
      pbox(G, 0xb08050, 1.6, 0.06, 0.25, dx, Y + 1.75, fN + 0.13);
      for (const ox of [-0.5, 0]) { pbox(G, 0xf4c430, 0.12, 0.2, 0.12, dx + ox, Y + 1.88, fN + 0.13, 0.3); pball(G, 0xf4c430, 0.08, dx + ox, Y + 2.02, fN + 0.13, 0.3); }
      plant(G, dx + 0.5, Y + 1.78, fN + 0.15, 0.4);
      // ---- HALLWAY: family photos, a little table with flowers, a clock, plants and ceiling lights
      const hz = (zRoom + hN) / 2;
      framedPic(G, W + 1.1, Y + 1.7, zRoom + 0.12, 0, 0, 0.55, 0.42);
      framedPic(G, cx + 1.3, Y + 1.75, zRoom + 0.12, 0, 5, 0.55, 0.42);
      framedPic(G, cx - 1.2 > W + 0.6 ? cx - 1.2 : W + 0.6, Y + 1.85, zRoom + 0.12, 0, 7, 0.4, 0.32);
      pbox(G, 0x8a5a2b, 1.0, 0.06, 0.38, cx, Y + 0.8, hN - 0.3);
      for (const ox of [-0.45, 0.45]) pbox(G, 0x8a5a2b, 0.05, 0.8, 0.3, cx + ox, Y + 0.4, hN - 0.3);
      up(cx - 0.52, cx + 0.52, hN - 0.5, hN - 0.1, Y + 0.84);
      const vase = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.25, 10), pm(0x3fae9a, 0.3)); vase.position.set(cx - 0.25, Y + 0.96, hN - 0.3); G.add(vase);
      for (let q = 0; q < 4; q++) pball(G, [0xff6a8a, 0xffd34a, 0xb07aff, 0xffffff][q], 0.06, cx - 0.25 + (q - 1.5) * 0.06, Y + 1.15 + (q % 2) * 0.05, hN - 0.3);
      framedPic(G, cx + 0.15, Y + 1.5, hN - 0.12, Math.PI, 1, 0.5, 0.4);
      const clock = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 20), pm(0xffffff, 0.4)); clock.rotation.x = Math.PI / 2; clock.position.set(cx, Y + 2.35, hN - 0.13); G.add(clock);
      pbox(G, 0x222222, 0.02, 0.14, 0.02, cx, Y + 2.4, hN - 0.16); pbox(G, 0x222222, 0.1, 0.02, 0.02, cx + 0.04, Y + 2.35, hN - 0.16);
      plant(G, W + 0.35, Y, hz, 1.0);
      for (const lx of [(W + cx) / 2, (cx + Ea) / 2]) {
        const sh = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), pm(0xfff1c8, 0.5)); sh.position.set(lx, Y + H - 0.35, hz); sh.rotation.x = Math.PI; G.add(sh);
        pbox(G, 0x333333, 0.02, 0.3, 0.02, lx, Y + H - 0.17, hz);
      }
    }

    // ---- BATHROOM (west half over the living room): bathtub with a duck, toilet, sink with a mirror
    const bW = W, bE = cx, bN = hN, bS = S;
    box(tile, bE - bW - 0.1, 1.2, 0.05, (bW + bE) / 2, Y + 0.6, bS + 0.17, false);
    box(tile, 0.05, 1.2, bS - bN, bW - 0.17, Y + 0.6, (bN + bS) / 2, false);
    const white = m(0xfafafa, null, 0.25);
    const tubX = (bW + bE) / 2, tubZ = bS - 0.55;
    box(white, Math.min(2.0, bE - bW - 0.6), 0.6, 0.95, tubX, Y + 0.3, tubZ);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(1.8, bE - bW - 0.8), 0.75), new THREE.MeshStandardMaterial({ color: 0x8fd0f0, roughness: 0.1, transparent: true, opacity: 0.85 }));
    water.rotation.x = -Math.PI / 2; water.position.set(tubX, Y + 0.56, tubZ); this.group.add(water);
    const duck = new THREE.Group(); duck.position.set(tubX + 0.3, Y + 0.6, tubZ); this.group.add(duck);
    const yel = m(0xf6d23a, null, 0.4);
    const db = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), yel); db.scale.set(1.3, 0.8, 1); duck.add(db);
    const dh = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), yel); dh.position.set(0.08, 0.09, 0); duck.add(dh);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.06, 6), m(0xf08a2a)); beak.rotation.z = -Math.PI / 2; beak.position.set(0.15, 0.09, 0); duck.add(beak);
    up(tubX - 1.0, tubX + 1.0, tubZ - 0.48, tubZ + 0.48, Y + 0.6);
    this.tub = { x: tubX, z: tubZ - 0.9, r: 1.5, y: Y };
    // toilet
    const toX = bW + 0.45, toZ = bN + 0.9;
    const tg = new THREE.Group(); tg.position.set(toX, Y, toZ); tg.rotation.y = Math.PI / 2; this.group.add(tg);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.42, 14), white); bowl.position.set(0, 0.21, 0.05); tg.add(bowl);
    const seat = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.04, 6, 16), white); seat.rotation.x = Math.PI / 2; seat.position.set(0, 0.43, 0.05); tg.add(seat);
    const tank = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.18), white); tank.position.set(0, 0.62, -0.22); tg.add(tank);
    up(toX - 0.3, toX + 0.35, toZ - 0.3, toZ + 0.3, 100);
    this.toilet = { x: toX + 0.8, z: toZ, r: 1.3, y: Y };
    // sink and mirror
    const siX = bW + 0.35, siZ = Math.min(bN + 2.2, tubZ - 1.2);
    box(white, 0.5, 0.15, 0.6, siX, Y + 0.85, siZ);
    box(white, 0.12, 0.85, 0.12, siX - 0.1, Y + 0.42, siZ);
    const mirror = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.8), new THREE.MeshStandardMaterial({ color: 0xdfeef6, roughness: 0.05, metalness: 0.9 }));
    mirror.position.set(bW - 0.18, Y + 1.6, siZ); mirror.rotation.y = Math.PI / 2; this.group.add(mirror);
    const tb = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.12, 8), m(0x3fae9a)); tb.position.set(siX + 0.12, Y + 0.98, siZ + 0.18); this.group.add(tb);
    up(siX - 0.28, siX + 0.28, siZ - 0.32, siZ + 0.32, 100);
    this.sink = { x: siX + 0.8, z: siZ, r: 1.3, y: Y };
    // towels and a bath mat
    box(m(0xf08ab0, null, 1), 0.5, 0.7, 0.05, bE - 0.6, Y + 1.3, bS + 0.15, false);
    box(m(0x8fd0f0, null, 1), 0.05, 0.7, 0.5, bE - 0.17, Y + 1.3, bN + 1.2, false);
    const mat = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.6), m(0x6ab0d8, null, 1)); mat.rotation.x = -Math.PI / 2; mat.position.set(tubX, Y + 0.012, tubZ - 0.9); this.group.add(mat);
    {
      const G = this.group;
      // shampoo bottles and soap on the tub, a toy boat in the water
      for (let q = 0; q < 3; q++) { const bt = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.2, 10), pm([0xe86aa8, 0x3fae9a, 0xf4c430][q], 0.3)); bt.position.set(tubX - 0.85 + q * 0.13, Y + 0.7, tubZ + 0.35); G.add(bt); }
      pbox(G, 0xfff0f6, 0.12, 0.05, 0.08, tubX + 0.8, Y + 0.63, tubZ + 0.35, 0.3);
      pbox(G, 0xe4475b, 0.22, 0.06, 0.1, tubX - 0.3, Y + 0.58, tubZ - 0.1, 0.4); pbox(G, 0xffffff, 0.02, 0.16, 0.12, tubX - 0.3, Y + 0.68, tubZ - 0.1, 0.4);
      // a shower curtain on a rail
      pbox(G, 0xcccccc, Math.min(2.0, bE - bW - 0.6), 0.03, 0.03, tubX, Y + 2.1, tubZ - 0.5, 0.3);
      const cur = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 1.5), new THREE.MeshStandardMaterial({ color: 0xbfe8ff, side: THREE.DoubleSide, roughness: 0.6 })); cur.position.set(tubX - Math.min(2.0, bE - bW - 0.6) / 2 + 0.3, Y + 1.35, tubZ - 0.5); G.add(cur);
      // toilet paper, a cabinet with bottles, a laundry basket, a plant and a little step stool
      const tp = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.11, 10), pm(0xffffff)); tp.rotation.z = Math.PI / 2; tp.position.set(bW - 0.1, Y + 0.7, toZ + 0.45); G.add(tp);
      const cbx = bE - 0.28, cbz = (bN + bS) / 2 - 0.4;
      pbox(G, 0xfafafa, 0.45, 1.0, 0.8, cbx, Y + 0.5, cbz, 0.4); pbox(G, 0xd8eef6, 0.02, 0.85, 0.35, cbx - 0.23, Y + 0.5, cbz - 0.2, 0.3); pbox(G, 0xd8eef6, 0.02, 0.85, 0.35, cbx - 0.23, Y + 0.5, cbz + 0.2, 0.3);
      for (let q = 0; q < 3; q++) { const bt = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.18 + q * 0.04, 10), pm([0x9fd0ff, 0xffb3c7, 0xc8f0b0][q], 0.3)); bt.position.set(cbx, Y + 1.1 + q * 0.02, cbz - 0.25 + q * 0.25); G.add(bt); }
      up(cbx - 0.25, cbx + 0.25, cbz - 0.42, cbz + 0.42, 100);
      const lb = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.2, 0.5, 14), pm(0xd8b878, 0.95)); lb.position.set(bE - 0.4, Y + 0.25, bN + 0.5); G.add(lb);
      pball(G, 0xe86aa8, 0.12, bE - 0.45, Y + 0.5, bN + 0.48); pball(G, 0x7ac0e8, 0.1, bE - 0.32, Y + 0.52, bN + 0.55);
      up(bE - 0.66, bE - 0.14, bN + 0.24, bN + 0.76, 100);
      plant(G, bW + 0.35, Y, bS - 0.3, 0.8);
      pbox(G, 0x7ac08a, 0.4, 0.22, 0.3, siX + 0.45, Y + 0.11, siZ, 0.6); // step stool for reaching the sink
      framedPic(G, bW - 0.16, Y + 1.7, toZ + 0.9, Math.PI / 2, 4, 0.45, 0.35);
    }

    // ---- PLAYROOM (east half over the living room): toy box, blocks, ball, bean bag, play tent
    const pW = cx, pE = E, pN = hN, pS = S;
    const tbx = pE - 0.6, tbz = pN + 0.6;
    box(m(0x3fae9a), 0.9, 0.55, 0.55, tbx, Y + 0.28, tbz);
    box(m(0xf4c430), 0.94, 0.08, 0.6, tbx, Y + 0.58, tbz);
    up(tbx - 0.47, tbx + 0.47, tbz - 0.3, tbz + 0.3, Y + 0.6);
    const cols = [0xe4475b, 0xf2c14e, 0x3b8fd9, 0x4f8a3b];
    for (let k = 0; k < 6; k++) box(m(cols[k % 4], null, 0.5), 0.28, 0.28, 0.28, pW + 0.6 + (k % 3) * 0.3, Y + 0.14 + Math.floor(k / 3) * 0.28, pS - 0.6);
    const ballM = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), m(0xd8452e, null, 0.4)); ballM.position.set((pW + pE) / 2, Y + 0.22, (pN + pS) / 2 + 0.3); this.group.add(ballM);
    const bean = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 10), m(0x8a5ad8, null, 0.9)); bean.scale.set(1.1, 0.65, 1.1); bean.position.set(pE - 0.75, Y + 0.35, pS - 0.8); this.group.add(bean);
    up(pE - 1.3, pE - 0.2, pS - 1.35, pS - 0.25, Y + 0.6);
    const tent = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.6, 6, 1, true), new THREE.MeshStandardMaterial({ color: 0xf4a6c0, side: THREE.DoubleSide, roughness: 0.9 }));
    tent.position.set(pW + 0.9, Y + 0.8, pN + 1.2); this.group.add(tent);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.18), new THREE.MeshStandardMaterial({ color: 0xf4c430, side: THREE.DoubleSide })); flag.position.set(pW + 1.05, Y + 1.75, pN + 1.2); this.group.add(flag);
    up(pW + 0.3, pW + 1.5, pN + 0.6, pN + 1.8, 100);
    this.toys = { x: (pW + pE) / 2, z: (pN + pS) / 2 + 0.3, r: 1.6, y: Y };
    const star = document.createElement('canvas'); star.width = 192; star.height = 256;
    { const g = star.getContext('2d')!; g.fillStyle = '#fff3c4'; g.fillRect(0, 0, 192, 256); g.font = '90px sans-serif'; g.textAlign = 'center'; g.fillText('🧸', 96, 120); g.fillText('🎈', 96, 220); }
    const st2 = new THREE.CanvasTexture(star); st2.colorSpace = THREE.SRGBColorSpace;
    const pst = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.07), new THREE.MeshStandardMaterial({ map: st2 })); pst.position.set((pW + pE) / 2, Y + 2.0, pS + 0.17); pst.rotation.y = Math.PI; this.group.add(pst);
    {
      const G = this.group, pz = (pN + pS) / 2;
      // an easel with a painting
      const ex = pE - 0.45, ez = pz - 0.4;
      for (const oz of [-0.25, 0.25]) { const leg = pbox(G, 0x8a5a2b, 0.05, 1.5, 0.05, ex, Y + 0.72, ez + oz); leg.rotation.z = 0.12; }
      const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128;
      { const g = cv.getContext('2d')!; g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#ffd34a'; g.beginPath(); g.arc(90, 35, 20, 0, 7); g.fill(); g.fillStyle = '#4f8a3b'; g.fillRect(0, 95, 128, 33); g.fillStyle = '#e4475b'; g.fillRect(25, 60, 40, 35); g.fillStyle = '#8a5a2b'; g.beginPath(); g.moveTo(20, 60); g.lineTo(45, 38); g.lineTo(70, 60); g.fill(); }
      const ct = new THREE.CanvasTexture(cv); ct.colorSpace = THREE.SRGBColorSpace;
      const canvasM = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), new THREE.MeshStandardMaterial({ map: ct })); canvasM.position.set(ex - 0.08, Y + 1.15, ez); canvasM.rotation.y = -Math.PI / 2; canvasM.rotation.z = 0; G.add(canvasM);
      pbox(G, 0x8a5a2b, 0.08, 0.04, 0.7, ex - 0.06, Y + 0.78, ez);
      up(ex - 0.3, ex + 0.2, ez - 0.4, ez + 0.4, 100);
      // a rocking horse
      const rh = new THREE.Group(); rh.position.set(pE - 1.1, Y, pN + 1.7); rh.rotation.y = -Math.PI / 2; G.add(rh);
      for (const sx of [-0.18, 0.18]) { const rock = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.03, 6, 20, Math.PI * 0.5), pm(0x8a5a2b)); rock.rotation.set(0, 0, Math.PI * 1.25); rock.position.set(0, 0.62, sx); rock.rotation.y = Math.PI / 2; G.add(rock); rock.removeFromParent(); rh.add(rock); }
      pbox(rh, 0xf4f0ea, 0.7, 0.28, 0.25, 0, 0.55, 0); pbox(rh, 0xf4f0ea, 0.15, 0.4, 0.15, 0.3, 0.8, 0);
      pbox(rh, 0xf4f0ea, 0.3, 0.16, 0.16, 0.42, 0.98, 0); pbox(rh, 0xe4475b, 0.25, 0.05, 0.27, -0.05, 0.71, 0);
      pbox(rh, 0x8a5a2b, 0.08, 0.3, 0.08, -0.35, 0.65, 0); for (const sx of [-0.25, 0.25]) for (const sz of [-0.09, 0.09]) pbox(rh, 0xf4f0ea, 0.06, 0.4, 0.06, sx, 0.25, sz);
      up(pE - 1.5, pE - 0.7, pN + 1.4, pN + 2.0, 100);
      // a little tea-party table with stools and teacups
      const ttx = (pW + pE) / 2 - 0.2, ttz = pz - 1.0;
      const tt = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.05, 20), pm(0xffb3c7)); tt.position.set(ttx, Y + 0.5, ttz); G.add(tt);
      pbox(G, 0xf4f0ea, 0.08, 0.5, 0.08, ttx, Y + 0.25, ttz);
      for (let q = 0; q < 3; q++) { const a = q * 2.1; const st = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.3, 14), pm([0x7ac0e8, 0xffd34a, 0xc8f0b0][q])); st.position.set(ttx + Math.cos(a) * 0.72, Y + 0.15, ttz + Math.sin(a) * 0.72); G.add(st);
        const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.06, 10), pm(0xffffff, 0.3)); cup.position.set(ttx + Math.cos(a) * 0.28, Y + 0.56, ttz + Math.sin(a) * 0.28); G.add(cup); }
      pball(G, 0xffffff, 0.09, ttx, Y + 0.6, ttz, 0.3); // teapot
      teddy(G, ttx + Math.cos(2.1) * 0.72, Y + 0.3, ttz + Math.sin(2.1) * 0.72, 0xc08a5a, 0.7, -2.1 + Math.PI / 2);
      up(ttx - 0.47, ttx + 0.47, ttz - 0.47, ttz + 0.47, Y + 0.53);
      // a toy train
      for (let q = 0; q < 3; q++) {
        const cx2 = pW + 0.9 + q * 0.42, cz2 = pS - 1.5;
        pbox(G, [0xe4475b, 0x3b8fd9, 0xf4c430][q], 0.38, 0.2, 0.24, cx2, Y + 0.16, cz2, 0.4);
        if (q === 0) { pbox(G, 0x333333, 0.14, 0.2, 0.18, cx2 - 0.08, Y + 0.36, cz2); }
        for (const sx of [-0.12, 0.12]) for (const sz of [-0.13, 0.13]) { const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 10), pm(0x222222)); wh.rotation.x = Math.PI / 2; wh.position.set(cx2 + sx, Y + 0.06, cz2 + sz); G.add(wh); }
      }
      // a shelf of stuffed animals, a dollhouse, and paper stars hanging from the ceiling
      pbox(G, 0xb08050, 1.4, 0.06, 0.28, pW + 1.0, Y + 1.35, pS + 0.06);
      [0xf4c4d4, 0xd8a070, 0xf4f0ea].forEach((c, q) => teddy(G, pW + 0.55 + q * 0.45, Y + 1.38, pS + 0.06, c, 0.55, Math.PI));
      const dh = new THREE.Group(); dh.position.set(pE - 0.5, Y, pS - 1.9); dh.rotation.y = -Math.PI / 2; G.add(dh);
      pbox(dh, 0xffe0ec, 0.9, 0.7, 0.4, 0, 0.35, 0); pbox(dh, 0xe86aa8, 0.95, 0.06, 0.45, 0, 0.72, 0);
      const dr = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.35, 4), pm(0xe86aa8)); dr.rotation.y = Math.PI / 4; dr.scale.set(1, 1, 0.5); dr.position.y = 0.92; dh.add(dr);
      for (const sx of [-0.25, 0.25]) for (const sy of [0.2, 0.5]) pbox(dh, 0xbfe6ff, 0.18, 0.15, 0.01, sx, sy, 0.21, 0.3);
      up(pE - 0.75, pE - 0.25, pS - 2.4, pS - 1.4, 100);
      for (let q = 0; q < 6; q++) {
        const sxp = pW + 0.7 + (q / 5) * (pE - pW - 1.4), szp = pN + 1.0 + (q % 3) * ((pS - pN - 2) / 2);
        pbox(G, 0xffffff, 0.01, 0.5, 0.01, sxp, Y + H - 0.25, szp);
        pball(G, [0xffe066, 0xff8ac0, 0x9fd0ff][q % 3], 0.1, sxp, Y + H - 0.55, szp, 0.4).scale.set(1, 1, 0.3);
      }
    }
    void play;
  }

  lampsOn = false;
  lamps: Spot[] = [];
  private lampShades: THREE.MeshStandardMaterial[] = [];
  private lampLights: THREE.PointLight[] = [];
  private addLamp(x: number, z: number, roomSize: number, y0 = 0) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.7, 6), new THREE.MeshStandardMaterial({ color: 0x333333 }));
    pole.position.set(x, y0 + 0.85, z); this.group.add(pole);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.05, 14), new THREE.MeshStandardMaterial({ color: 0x333333 }));
    foot.position.set(x, y0 + 0.03, z); this.group.add(foot);
    const mat = new THREE.MeshStandardMaterial({ color: 0xfff1c8, emissive: 0xffc870, emissiveIntensity: 0, side: THREE.DoubleSide });
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.35, 14, 1, true), mat);
    shade.position.set(x, y0 + 1.8, z); this.group.add(shade);
    const light = new THREE.PointLight(0xffd59a, 0, roomSize * 1.4, 1.3);
    light.position.set(x, y0 + 1.7, z); this.group.add(light);
    this.lampShades.push(mat); this.lampLights.push(light);
    this.lamps.push({ x, z, r: 1.5, y: y0 });
    this.colliders.push(this.collision.add({ kind: 'cyl', x, z, r: 0.2, top: y0 > 0 ? 100 : (this.hasUpstairs ? FLOOR2 : 100), bottom: y0 > 0 ? y0 : undefined, tall: true }));
  }
  /** Turn every lamp in the house on or off. */
  /** Little plug-in nightlights by each bed: on at night, off in the day. */
  private nightlights: { mat: THREE.MeshStandardMaterial; light: THREE.PointLight }[] = [];
  private nightOn: boolean | null = null;
  private addNightlight(x: number, z: number, color: number, shape: 'moon' | 'star', onWestWall = false, y0 = 0, height = 0.55, scale = 1) {
    const g = new THREE.Group(); g.position.set(x, y0 + height, z); g.scale.setScalar(scale);
    if (onWestWall) g.rotation.y = Math.PI / 2;
    const plug = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.05), new THREE.MeshStandardMaterial({ color: 0xf4f2ec })); g.add(plug);
    const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.1, roughness: 0.4 });
    const shp = new THREE.Shape();
    if (shape === 'star') {
      for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.05 : 0.12, a = Math.PI / 2 + (i / 10) * Math.PI * 2; i ? shp.lineTo(Math.cos(a) * r, Math.sin(a) * r) : shp.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    } else {
      shp.absarc(0, 0, 0.12, Math.PI * 0.3, Math.PI * 1.7, false);
      shp.absarc(0.05, 0, 0.09, Math.PI * 1.55, Math.PI * 0.45, true);
    }
    const glow = new THREE.Mesh(new THREE.ExtrudeGeometry(shp, { depth: 0.03, bevelEnabled: false }), mat);
    glow.position.set(0, 0.06, 0.03); g.add(glow);
    const light = new THREE.PointLight(color, 0, 3.5, 1.6); light.position.set(0, 0.1, 0.25); g.add(light);
    this.group.add(g);
    this.nightlights.push({ mat, light });
  }
  setNightlights(on: boolean) {
    if (this.nightOn === on) return;
    this.nightOn = on;
    for (const n of this.nightlights) { n.mat.emissiveIntensity = on ? 2.2 : 0.1; n.light.intensity = on ? 2.4 : 0; }
  }

  setLamps(on: boolean) {
    this.lampsOn = on;
    for (const m of this.lampShades) m.emissiveIntensity = on ? 1.4 : 0;
    for (const l of this.lampLights) l.intensity = on ? 16 : 0;
  }

  /** A little cartoon plays on the TV. */
  updateTV(t: number) {
    const tv = this.tv; if (!tv || t - tv.last < 0.08) return;
    tv.last = t;
    const g = tv.canvas.getContext('2d')!;
    const W = 256, H = 160;
    const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#6ec1ff'); sky.addColorStop(1, '#d8f1ff');
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    g.fillStyle = '#ffd23a'; g.beginPath(); g.arc(210, 32, 18 + Math.sin(t * 3) * 2, 0, 7); g.fill();
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 3; i++) { const x = ((t * 18 + i * 95) % 300) - 40; g.beginPath(); g.arc(x, 30 + i * 12, 14, 0, 7); g.arc(x + 16, 26 + i * 12, 17, 0, 7); g.arc(x + 32, 30 + i * 12, 13, 0, 7); g.fill(); }
    g.fillStyle = '#5aa83a'; g.fillRect(0, 118, W, 42);
    // a bouncing cartoon chicken chasing a ball
    const bx = ((t * 60) % 320) - 30, by = 112 - Math.abs(Math.sin(t * 5)) * 40;
    g.fillStyle = '#e8463a'; g.beginPath(); g.arc(bx + 40, by + 4, 9, 0, 7); g.fill();
    const cx = bx, cy = 104 - Math.abs(Math.sin(t * 6)) * 14;
    g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(cx, cy, 16, 13, 0, 0, 7); g.fill();
    g.beginPath(); g.arc(cx + 12, cy - 12, 8, 0, 7); g.fill();
    g.fillStyle = '#e8463a'; g.beginPath(); g.arc(cx + 12, cy - 21, 4, 0, 7); g.fill();
    g.fillStyle = '#f2b134'; g.beginPath(); g.moveTo(cx + 19, cy - 13); g.lineTo(cx + 26, cy - 11); g.lineTo(cx + 19, cy - 9); g.fill();
    g.fillStyle = '#111'; g.beginPath(); g.arc(cx + 14, cy - 14, 1.6, 0, 7); g.fill();
    g.strokeStyle = '#f2b134'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx - 3, cy + 12); g.lineTo(cx - 5, cy + 20); g.moveTo(cx + 4, cy + 12); g.lineTo(cx + 6, cy + 20); g.stroke();
    tv.tex.needsUpdate = true;
  }

  /** Door state also blocks/unblocks the doorway. */
  setDoor(open: boolean) {
    this.door.rotation.y = open ? 1.45 : 0;
    if (!open && !this.doorCollider) this.doorCollider = this.collision.add({ kind: 'box', minX: this.origin.x - 0.7, maxX: this.origin.x + 0.7, minZ: this.southZ, maxZ: this.southZ + 0.6, top: 100, tall: true });
    if (open && this.doorCollider) { this.collision.remove(this.doorCollider); this.doorCollider = null; }
  }
}

/** A black cooking pot. With fire=true it sits on a campfire (outdoors). */
export function buildPot(fire: boolean): THREE.Group {
  const g = new THREE.Group();
  const iron = new THREE.MeshStandardMaterial({ color: 0x2a2a2c, roughness: 0.45, metalness: 0.5 });
  const pot = new THREE.Mesh(new THREE.SphereGeometry(0.5, 18, 12, 0, Math.PI * 2, Math.PI * 0.32, Math.PI * 0.68), iron);
  pot.position.y = fire ? 0.75 : 0.42; pot.castShadow = true; g.add(pot);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.05, 8, 24), iron); rim.rotation.x = Math.PI / 2; rim.position.y = pot.position.y + 0.42; g.add(rim);
  const soup = new THREE.Mesh(new THREE.CircleGeometry(0.4, 20), new THREE.MeshStandardMaterial({ color: 0xc8823a, roughness: 0.3, emissive: 0x5a2a00, emissiveIntensity: 0.3 }));
  soup.rotation.x = -Math.PI / 2; soup.position.y = pot.position.y + 0.36; soup.name = 'soup'; g.add(soup);
  if (fire) {
    const stone = new THREE.MeshStandardMaterial({ color: 0x8a877f, roughness: 1 });
    for (let i = 0; i < 9; i++) { const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.17), stone); const a = (i / 9) * Math.PI * 2; s.position.set(Math.cos(a) * 0.75, 0.1, Math.sin(a) * 0.75); s.castShadow = true; g.add(s); }
    const logM = new THREE.MeshStandardMaterial({ color: 0x5a3f28, roughness: 1 });
    for (let i = 0; i < 3; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.9, 6), logM); l.rotation.set(Math.PI / 2, i * 1.05, 0.25); l.position.y = 0.12; g.add(l); }
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.6, 10), new THREE.MeshStandardMaterial({ color: 0xffa020, emissive: 0xff6a00, emissiveIntensity: 1.6, transparent: true, opacity: 0.85 }));
    flame.position.y = 0.32; flame.name = 'flame'; g.add(flame);
    for (const sx of [-0.62, 0.62]) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.5, 6), iron); st.position.set(sx, 0.75, 0); g.add(st); }
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.3, 6), iron); bar.rotation.z = Math.PI / 2; bar.position.y = 1.48; g.add(bar);
  }
  return g;
}
