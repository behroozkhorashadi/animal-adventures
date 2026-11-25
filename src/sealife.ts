import * as THREE from 'three';
import { CollisionWorld, Collider } from './terrain';

/** Sea creatures you can befriend while swimming, and keep in your Aquarium. */
export type SeaSpecies = 'whale' | 'narwhal' | 'dolphin' | 'turtle' | 'octopus' | 'clownfish' | 'jellyfish' | 'seahorse' | 'shark' | 'starfish';
export const SEA_INFO: Record<SeaSpecies, { name: string; emoji: string; size: number; names: string[] }> = {
  whale: { name: 'Whale', emoji: '🐋', size: 5, names: ['Bubbles', 'Big Blue', 'Splashy', 'Moby'] },
  narwhal: { name: 'Narwhal', emoji: '🦄', size: 3.4, names: ['Sparkle', 'Twinkle', 'Unicorny', 'Pearl'] },
  dolphin: { name: 'Dolphin', emoji: '🐬', size: 2.2, names: ['Flipper', 'Echo', 'Skippy', 'Splash'] },
  turtle: { name: 'Sea Turtle', emoji: '🐢', size: 1.4, names: ['Shelly', 'Crush', 'Myrtle', 'Tank'] },
  octopus: { name: 'Octopus', emoji: '🐙', size: 1.3, names: ['Inky', 'Wiggles', 'Squishy', 'Otto'] },
  clownfish: { name: 'Clownfish', emoji: '🐠', size: 0.6, names: ['Coral', 'Sunny', 'Stripes', 'Nemo-ish'] },
  jellyfish: { name: 'Jellyfish', emoji: '🪼', size: 1.0, names: ['Jelly', 'Wobble', 'Glow', 'Bloop'] },
  seahorse: { name: 'Seahorse', emoji: '🌊', size: 0.8, names: ['Twirl', 'Prancer', 'Curly', 'Goldie'] },
  shark: { name: 'Friendly Shark', emoji: '🦈', size: 2.6, names: ['Chompy', 'Finn', 'Bruce', 'Smiley'] },
  starfish: { name: 'Starfish', emoji: '⭐', size: 0.7, names: ['Patty', 'Starry', 'Twinkle', 'Pinky'] },
};
export const SEA_SPECIES = Object.keys(SEA_INFO) as SeaSpecies[];

const mat = (c: number, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, ...o });
const eyes = (g: THREE.Group, x: number, y: number, z: number, r: number) => {
  for (const sx of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat(0xffffff)); w.position.set(sx * x, y, z); g.add(w);
    const p = new THREE.Mesh(new THREE.SphereGeometry(r * 0.55, 8, 6), mat(0x111111)); p.position.set(sx * (x + r * 0.35), y, z + r * 0.45); g.add(p);
  }
};

/** A sea creature about 1 unit long, facing +z. `tail` wiggles, `fins` flap. */
export interface SeaRig { root: THREE.Group; tail: THREE.Object3D | null; fins: THREE.Object3D[]; legs: THREE.Object3D[]; kind: SeaSpecies }
export function buildSeaCreature(kind: SeaSpecies): SeaRig {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const fins: THREE.Object3D[] = [], legs: THREE.Object3D[] = [];
  let tail: THREE.Object3D | null = null;
  const fishTail = (color: number, z: number, w: number) => {
    const t = new THREE.Group(); t.position.z = z; body.add(t);
    for (const sx of [-1, 1]) { const f = new THREE.Mesh(new THREE.ConeGeometry(w * 0.35, w, 4), mat(color)); f.rotation.x = -Math.PI / 2; f.rotation.z = sx * 0.9; f.position.set(sx * w * 0.3, 0, -w * 0.3); f.scale.set(1, 1, 0.25); t.add(f); }
    tail = t;
  };
  switch (kind) {
    case 'whale': case 'narwhal': {
      const c = kind === 'whale' ? 0x3a6aa8 : 0x9aa8b8;
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 14), mat(c)); b.scale.set(0.55, 0.45, 1); body.add(b);
      const belly = new THREE.Mesh(new THREE.SphereGeometry(0.5, 18, 12), mat(kind === 'whale' ? 0xe8eef8 : 0xf4f4f8)); belly.scale.set(0.45, 0.3, 0.85); belly.position.set(0, -0.08, 0.04); body.add(belly);
      if (kind === 'narwhal') for (let k = 0; k < 7; k++) { const sp = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 5), mat(0x5a6878)); sp.position.set((k % 2 ? 1 : -1) * 0.22, 0.12, -0.2 + k * 0.08); body.add(sp); }
      eyes(body, 0.2, 0.02, 0.36, 0.035);
      const tl = new THREE.Group(); tl.position.z = -0.48; body.add(tl);
      const stalk = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35, 10), mat(c)); stalk.rotation.x = -Math.PI / 2; stalk.position.z = -0.1; tl.add(stalk);
      for (const sx of [-1, 1]) { const fl = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 6), mat(c)); fl.scale.set(1, 0.12, 0.45); fl.position.set(sx * 0.17, 0, -0.3); fl.rotation.y = sx * 0.4; tl.add(fl); }
      tail = tl;
      for (const sx of [-1, 1]) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), mat(c)); f.scale.set(1, 0.15, 0.5); f.position.set(sx * 0.28, -0.1, 0.15); f.rotation.z = sx * -0.4; body.add(f); fins.push(f); }
      if (kind === 'narwhal') { const horn = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.7, 10), mat(0xfff4d8, { emissive: 0x554422, emissiveIntensity: 0.3 })); horn.rotation.x = Math.PI / 2; horn.position.set(0, 0.04, 0.8); body.add(horn); }
      else { const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.02, 6), mat(0x1a2a3a)); spout.position.set(0, 0.22, 0.15); body.add(spout); }
      break;
    }
    case 'dolphin': case 'shark': {
      const c = kind === 'dolphin' ? 0x8aa0b8 : 0x6a7888;
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.5, 18, 12), mat(c)); b.scale.set(0.3, 0.3, 1); body.add(b);
      const belly = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 10), mat(0xf0f0f4)); belly.scale.set(0.24, 0.2, 0.85); belly.position.y = -0.07; body.add(belly);
      if (kind === 'dolphin') { const beak = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.2, 10), mat(c)); beak.rotation.x = Math.PI / 2; beak.position.set(0, -0.04, 0.55); body.add(beak); }
      else { const smile = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.012, 6, 12, Math.PI), mat(0xffffff)); smile.rotation.x = Math.PI / 2; smile.rotation.z = Math.PI; smile.position.set(0, -0.08, 0.43); body.add(smile); }
      eyes(body, 0.12, 0.05, 0.36, 0.035);
      const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.1, kind === 'shark' ? 0.32 : 0.22, 4), mat(c)); dorsal.scale.z = 0.35; dorsal.position.set(0, 0.22, -0.05); dorsal.rotation.x = -0.3; body.add(dorsal);
      for (const sx of [-1, 1]) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.22, 4), mat(c)); f.rotation.z = sx * 2.1; f.scale.z = 0.3; f.position.set(sx * 0.17, -0.08, 0.12); body.add(f); fins.push(f); }
      fishTail(c, -0.5, 0.3);
      break;
    }
    case 'turtle': {
      const shell = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x4a8a3a)); shell.scale.set(1, 0.6, 1.2); body.add(shell);
      for (let k = 0; k < 5; k++) { const plate = new THREE.Mesh(new THREE.CircleGeometry(0.09, 6), mat(0x2a5a2a)); plate.rotation.x = -Math.PI / 2 + 0.2; plate.position.set(((k % 3) - 1) * 0.15, 0.2 + (k === 1 ? 0.03 : 0), (Math.floor(k / 3) - 0.3) * 0.22); body.add(plate); }
      const under = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.06, 16), mat(0xd8c890)); under.scale.z = 1.2; body.add(under);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), mat(0x8ab86a)); head.position.set(0, 0.05, 0.55); body.add(head);
      eyes(body, 0.07, 0.1, 0.62, 0.025);
      for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), mat(0x8ab86a)); f.scale.set(1.4, 0.2, 0.6); f.position.set(sx * 0.42, 0, sz * 0.28); body.add(f); (sz > 0 ? fins : legs).push(f); }
      break;
    }
    case 'octopus': {
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), mat(0xb05ab8)); head.scale.set(1, 1.2, 1); head.position.y = 0.25; body.add(head);
      eyes(body, 0.11, 0.2, 0.25, 0.06);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2, arm = new THREE.Group(); arm.position.set(Math.cos(a) * 0.18, -0.02, Math.sin(a) * 0.18); arm.rotation.y = -a + Math.PI / 2; body.add(arm);
        for (let j = 0; j < 4; j++) { const seg = new THREE.Mesh(new THREE.SphereGeometry(0.07 - j * 0.012, 8, 6), mat(0xc07ac8)); seg.position.set(0, -j * 0.04, 0.08 + j * 0.1); arm.add(seg); }
        legs.push(arm);
      }
      break;
    }
    case 'clownfish': {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), mat(0xff7a1a)); b.scale.set(0.35, 0.5, 0.9); body.add(b);
      for (const z of [0.2, -0.12]) { const st = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 6, 16), mat(0xffffff)); st.scale.set(0.9, 1.25, 1); st.position.z = z; body.add(st); }
      eyes(body, 0.12, 0.06, 0.32, 0.05);
      fishTail(0xff7a1a, -0.42, 0.35);
      for (const sx of [-1, 1]) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), mat(0xff9a3a)); f.scale.set(0.2, 0.8, 1); f.position.set(sx * 0.18, -0.05, 0.08); body.add(f); fins.push(f); }
      break;
    }
    case 'jellyfish': {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.4, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xff8ad8, { transparent: true, opacity: 0.7, emissive: 0xff4ab8, emissiveIntensity: 0.4 })); body.add(dome);
      eyes(body, 0.12, 0.2, 0.3, 0.04);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        const tn = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.008, 0.8, 5), mat(0xffb8e8, { transparent: true, opacity: 0.8 }));
        tn.position.set(Math.cos(a) * 0.25, -0.4, Math.sin(a) * 0.25); body.add(tn); legs.push(tn);
      }
      break;
    }
    case 'seahorse': {
      const c = 0xffc83a;
      for (let k = 0; k < 6; k++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.13 - k * 0.012, 10, 8), mat(c)); s.position.set(0, 0.3 - k * 0.12, (k > 3 ? -(k - 3) * 0.08 : 0) + Math.sin(k) * 0.03); body.add(s); }
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), mat(c)); head.position.set(0, 0.45, 0.05); body.add(head);
      const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.18, 8), mat(c)); snout.rotation.x = Math.PI / 2; snout.position.set(0, 0.43, 0.2); body.add(snout);
      eyes(body, 0.08, 0.5, 0.08, 0.03);
      const tl = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.03, 6, 12, Math.PI * 1.4), mat(c)); tl.position.set(0, -0.42, -0.25); tl.rotation.y = Math.PI / 2; body.add(tl); tail = tl;
      const fin = new THREE.Mesh(new THREE.CircleGeometry(0.1, 8), mat(0xffe07a, { side: THREE.DoubleSide })); fin.position.set(0, 0.15, -0.13); fin.rotation.y = Math.PI / 2; body.add(fin); fins.push(fin);
      break;
    }
    case 'starfish': {
      for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; const arm = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.45, 6), mat(0xff6a7a)); arm.rotation.z = -Math.PI / 2; arm.rotation.y = -a; arm.position.set(Math.cos(a) * 0.22, 0, Math.sin(a) * 0.22); arm.scale.set(1, 1, 0.45); body.add(arm); legs.push(arm); }
      const mid = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), mat(0xff8a9a)); mid.scale.y = 0.45; body.add(mid);
      eyes(body, 0.05, 0.07, 0.08, 0.03);
      break;
    }
  }
  root.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = true; });
  return { root, tail, fins, legs, kind };
}
/** Swimmy animation. */
export function animateSea(r: SeaRig, t: number, speed = 1) {
  if (r.tail) r.tail.rotation.y = Math.sin(t * 5 * speed) * 0.35;
  r.fins.forEach((f, k) => { f.rotation.x = Math.sin(t * 4 * speed + k) * 0.3; });
  if (r.kind === 'octopus') r.legs.forEach((l, k) => { l.rotation.x = Math.sin(t * 3 + k) * 0.35 - 0.2; });
  else if (r.kind === 'jellyfish') { r.root.children[0].scale.set(1 + Math.sin(t * 3) * 0.08, 1 - Math.sin(t * 3) * 0.08, 1 + Math.sin(t * 3) * 0.08); r.legs.forEach((l, k) => { l.rotation.z = Math.sin(t * 2 + k) * 0.25; }); }
  else if (r.kind === 'turtle') r.fins.forEach((f, k) => { f.rotation.y = Math.sin(t * 2.5 + k * Math.PI) * 0.5; });
  else if (r.kind === 'starfish') r.root.rotation.y += 0.002;
}

/** Your Aquarium: a HUGE dark-blue room with a giant glass tank in the middle and a
 *  little home tank for each sea pet along the walls (each one sized to fit its animal). */
export const AQUA = { x: 0, z: -1900, halfW: 44, halfD: 44, tank: { hw: 17, hd: 17, h: 8.5 } };

/** What kind of home each sea pet likes. */
const HOME_OF: Record<SeaSpecies, 'ocean' | 'reef' | 'kelp' | 'beach'> = {
  whale: 'ocean', narwhal: 'ocean', dolphin: 'ocean', shark: 'ocean',
  clownfish: 'reef', seahorse: 'reef', starfish: 'reef', turtle: 'beach', octopus: 'kelp', jellyfish: 'kelp',
};
const HOME_LOOK = {
  ocean: { water: 0x2a6ac8, sand: 0xc8c0a0, label: '🌊 Deep ocean' },
  reef: { water: 0x3ac8e8, sand: 0xf4e4b0, label: '🪸 Coral reef' },
  kelp: { water: 0x1a4a7a, sand: 0x8a8a7a, label: '🌿 Kelp forest' },
  beach: { water: 0x4ab8d8, sand: 0xf0dca0, label: '🏝️ Sandy shore' },
};
/** A home tank: its middle, half-size, height, and which way its glass front faces. */
export interface OwnTank { x: number; z: number; hw: number; hd: number; h: number; face: 'n' | 's' | 'e' | 'w' }
/** How big a home tank should be for this animal. */
function tankSize(k: SeaSpecies) {
  const sz = Math.min(SEA_INFO[k].size, 5.5);
  return { w: Math.max(3.2, Math.min(13, sz * 2.3 + 1.6)), d: Math.max(3, Math.min(9, sz * 1.5 + 2)), h: Math.max(2.6, Math.min(7.5, sz * 1.1 + 2)) };
}
/** Line the home tanks up along the back wall, then the left and right walls. */
export function layoutTanks(list: { species: string }[]): OwnTank[] {
  const A = AQUA, out: OwnTank[] = [];
  const walls = [
    { face: 's' as const, from: A.x - A.halfW + 2, to: A.x + A.halfW - 2 },   // back wall (glass faces you as you walk in)
    { face: 'e' as const, from: A.z - A.halfD + 12, to: A.z + A.halfD - 8 },  // left wall
    { face: 'w' as const, from: A.z - A.halfD + 12, to: A.z + A.halfD - 8 },  // right wall
  ];
  let w = 0, cur = walls[0].from;
  for (const q of list) {
    const k = (SEA_INFO[q.species as SeaSpecies] ? q.species : 'clownfish') as SeaSpecies, t = tankSize(k);
    while (w < walls.length && cur + t.w > walls[w].to) { w++; if (w < walls.length) cur = walls[w].from; }
    if (w >= walls.length) { out.push({ x: A.x, z: A.z, hw: 1, hd: 1, h: 2, face: 's' }); continue; }   // no room left: shares the big tank
    const mid = cur + t.w / 2; cur += t.w + 1.4;
    const W = walls[w];
    if (W.face === 's') out.push({ x: mid, z: A.z - A.halfD + 0.6 + t.d / 2, hw: t.w / 2, hd: t.d / 2, h: t.h, face: 's' });
    else if (W.face === 'e') out.push({ x: A.x - A.halfW + 0.6 + t.d / 2, z: mid, hw: t.d / 2, hd: t.w / 2, h: t.h, face: 'e' });
    else out.push({ x: A.x + A.halfW - 0.6 - t.d / 2, z: mid, hw: t.d / 2, hd: t.w / 2, h: t.h, face: 'w' });
  }
  return out;
}

interface TankPet { idx: number; rig: SeaRig; a: number; r: number; y: number; speed: number; scale: number; cx: number; cz: number; home: { x: number; z: number; hw: number; hd: number; h: number }; cur?: THREE.Vector3; hop?: number }
export class Aquarium {
  group = new THREE.Group();
  pets: TankPet[] = [];
  bubbles: THREE.Mesh[] = [];
  weeds: THREE.Mesh[] = [];
  /** 'big' = everyone in the giant tank, 'own' = everyone in their own home tank. */
  mode: 'big' | 'own' = 'big';
  tanks: OwnTank[] = [];
  private tankGroup = new THREE.Group();
  /** Swimming with you in the big tank: the ball you throw, and who's bringing it back. */
  ball: THREE.Mesh | null = null;
  ballVel = new THREE.Vector3();
  ballState: 'none' | 'flying' | 'carried' = 'none';
  carrier: TankPet | null = null;
  onFetch?: (idx: number) => void;
  /** Throw a ball in the big tank: everyone races for it! */
  throwBall(from: THREE.Vector3, yaw: number) {
    if (this.ballState !== 'none') return false;
    if (!this.ball) { this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), mat(0xff5a7a, { emissive: 0x802030, emissiveIntensity: 0.3 })); this.group.add(this.ball); }
    this.ball.visible = true; this.ball.position.set(from.x + Math.sin(yaw) * 0.8, from.y + 0.4, from.z + Math.cos(yaw) * 0.8);
    this.ballVel.set(Math.sin(yaw) * 7, 1.2, Math.cos(yaw) * 7); this.ballState = 'flying'; this.carrier = null;
    return true;
  }
  nearestPet(pos: THREE.Vector3, r = 2.6) {
    let best: TankPet | null = null, bd = r;
    for (const p of this.pets) { const q = p.rig.root.position; const d = q.distanceTo(pos) - p.scale * 0.3; if (d < bd) { bd = d; best = p; } }
    return best;
  }
  private tankCols: Collider[] = [];
  private lbl(text: string, w: number, sub = '') {
    const H = sub ? 200 : 128;
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = H;
    const gx = cv.getContext('2d')!; gx.fillStyle = '#eaf6ff'; gx.beginPath(); gx.roundRect(4, 4, 504, H - 8, 26); gx.fill();
    gx.fillStyle = '#1a5a9a'; gx.font = 'bold 50px Nunito, sans-serif'; gx.textAlign = 'center'; gx.textBaseline = 'middle'; gx.fillText(text, 256, 66, 490);
    if (sub) { gx.fillStyle = '#4a7aa0'; gx.font = 'bold 38px Nunito, sans-serif'; gx.fillText(sub, 256, 145, 490); }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.Mesh(new THREE.PlaneGeometry(w, (w * H) / 512), new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide }));
  }
  constructor(scene: THREE.Scene, private collision: CollisionWorld) {
    const A = AQUA, T = A.tank, g = this.group;
    g.visible = false; scene.add(g); g.add(this.tankGroup);
    // floor and walls
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(A.halfW * 2, A.halfD * 2), mat(0x1a3a5a, { roughness: 0.4 })); floor.rotation.x = -Math.PI / 2; floor.position.set(A.x, 0.01, A.z); g.add(floor);
    const wallM = mat(0x163050), H = 11;
    const wall = (w: number, d: number, px: number, pz: number) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, H, d), wallM); m.position.set(px, H / 2, pz); g.add(m); collision.add({ kind: 'box', minX: px - w / 2, maxX: px + w / 2, minZ: pz - d / 2, maxZ: pz + d / 2, top: 100, tall: true }); };
    wall(A.halfW * 2 + 1, 0.5, A.x, A.z - A.halfD); wall(A.halfW * 2 + 1, 0.5, A.x, A.z + A.halfD); wall(0.5, A.halfD * 2, A.x - A.halfW, A.z); wall(0.5, A.halfD * 2, A.x + A.halfW, A.z);
    // the giant tank: sand, glass, water, rocks, coral and seaweed
    const sand = new THREE.Mesh(new THREE.BoxGeometry(T.hw * 2, 0.4, T.hd * 2), mat(0xe8d49a)); sand.position.set(A.x, 0.2, A.z); g.add(sand);
    const water = new THREE.Mesh(new THREE.BoxGeometry(T.hw * 2 - 0.2, T.h - 0.6, T.hd * 2 - 0.2), new THREE.MeshStandardMaterial({ color: 0x2a9ad8, transparent: true, opacity: 0.32, roughness: 0.05, depthWrite: false }));
    water.position.set(A.x, 0.4 + (T.h - 0.6) / 2, A.z); water.renderOrder = 2; g.add(water);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(T.hw * 2, T.h, T.hd * 2), new THREE.MeshStandardMaterial({ color: 0xcff0ff, transparent: true, opacity: 0.12, roughness: 0.02, depthWrite: false, side: THREE.DoubleSide }));
    glass.position.set(A.x, T.h / 2, A.z); glass.renderOrder = 3; g.add(glass);
    const frame = mat(0xffffff);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.25, T.h, 0.25), frame); post.position.set(A.x + sx * T.hw, T.h / 2, A.z + sz * T.hd); g.add(post); }
    for (const sz of [-1, 1]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(T.hw * 2, 0.2, 0.25), frame); rail.position.set(A.x, T.h, A.z + sz * T.hd); g.add(rail); }
    for (const sx of [-1, 1]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.2, T.hd * 2), frame); rail.position.set(A.x + sx * T.hw, T.h, A.z); g.add(rail); }
    collision.add({ kind: 'box', minX: A.x - T.hw - 0.2, maxX: A.x + T.hw + 0.2, minZ: A.z - T.hd - 0.2, maxZ: A.z + T.hd + 0.2, top: 100, tall: true });
    this.decorate(g, A.x, A.z, T.hw, T.hd, T.h, 'reef', 1.6);
    const chest = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 0.9), mat(0x8a5a2a)); chest.position.set(A.x + 6, 0.85, A.z - 7); chest.rotation.y = 0.4; g.add(chest);
    const bigSign = this.lbl('🌊 The Big Tank', 7, 'Everyone swims together!'); bigSign.position.set(A.x, T.h + 1.6, A.z + T.hd + 0.2); g.add(bigSign);
    // lights
    const top = new THREE.PointLight(0x9ad8ff, 14, 140, 1.1); top.position.set(A.x, 18, A.z); g.add(top);
    g.add(new THREE.HemisphereLight(0x8ac8ff, 0x0a1a3a, 1.0));
    // way out + title
    const door = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.4), mat(0xbfe8ff, { emissive: 0x6ac8ff, emissiveIntensity: 1.2, side: THREE.DoubleSide }));
    door.position.set(A.x, 1.7, A.z + A.halfD - 0.3); door.rotation.y = Math.PI; g.add(door);
    const out = this.lbl('🚪 Way out', 2.6); out.position.set(A.x, 3.8, A.z + A.halfD - 0.35); out.rotation.y = Math.PI; g.add(out);
    const title = this.lbl('🐠 My Aquarium 🐋', 14); title.position.set(A.x, 9.5, A.z - A.halfD + 0.4); g.add(title);
  }
  /** Sand, rocks, coral, seaweed and bubbles inside a tank, to match the home. */
  private decorate(g: THREE.Object3D, cx: number, cz: number, hw: number, hd: number, h: number, home: keyof typeof HOME_LOOK, density = 1) {
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    const n = Math.max(2, Math.round(hw * hd * 0.18 * density));
    const corals = [0xff6a8a, 0xffa04a, 0xc86aff, 0xffe04a, 0x4ad8c8];
    for (let k = 0; k < n; k++) {
      const x = cx + rnd(-hw + 0.5, hw - 0.5), z = cz + rnd(-hd + 0.5, hd - 0.5);
      const pick = home === 'reef' ? k % 3 : home === 'kelp' ? (k % 4 ? 1 : 2) : home === 'beach' ? (k % 3 ? 2 : 1) : (k % 4 ? 2 : 1);
      if (pick === 0) { for (let j = 0; j < 4; j++) { const br = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, rnd(0.4, 1.2), 6), mat(corals[k % 5])); br.position.set(x + rnd(-0.25, 0.25), 0.7, z + rnd(-0.25, 0.25)); br.rotation.set(rnd(-0.5, 0.5), 0, rnd(-0.5, 0.5)); g.add(br); } }
      else if (pick === 1) { const tall = home === 'kelp' ? rnd(2, h - 0.8) : rnd(0.8, Math.min(3, h - 0.8)); const wd = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, tall, 5), mat(home === 'kelp' ? 0x5a8a2a : 0x3aa84a)); wd.position.set(x, 0.4 + tall / 2, z); wd.userData.sway = Math.random() * 6; g.add(wd); this.weeds.push(wd); }
      else { const rk = new THREE.Mesh(new THREE.DodecahedronGeometry(rnd(0.25, Math.min(0.9, hw * 0.25)), 0), mat(home === 'beach' ? 0x9a8a7a : 0x6a6a7a)); rk.position.set(x, 0.45, z); g.add(rk); }
    }
    if (home === 'beach') { const isle = new THREE.Mesh(new THREE.SphereGeometry(Math.min(hw, hd) * 0.5, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xf0dca0)); isle.scale.y = 0.35; isle.position.set(cx - hw * 0.3, 0.4, cz); g.add(isle); }
    const nb = Math.max(4, Math.round(hw * hd * 0.15));
    for (let k = 0; k < nb; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), new THREE.MeshStandardMaterial({ color: 0xdff4ff, transparent: true, opacity: 0.6 })); b.position.set(cx + rnd(-hw + 0.3, hw - 0.3), rnd(0.5, h - 0.4), cz + rnd(-hd + 0.3, hd - 0.3)); b.userData.top = h - 0.4; g.add(b); this.bubbles.push(b); }
  }
  /** Build a little home tank for each sea pet, each one the right size and style. */
  private buildTanks(list: { species: string; name: string }[]) {
    this.tankGroup.clear(); for (const c of this.tankCols) this.collision.remove(c); this.tankCols = [];
    this.bubbles = this.bubbles.filter((b) => b.parent && b.parent !== this.tankGroup);
    this.weeds = this.weeds.filter((w) => w.parent && w.parent !== this.tankGroup);
    this.tanks = layoutTanks(list);
    const g = this.tankGroup;
    this.tanks.forEach((t, i) => {
      if (t.hw <= 1) return;
      const q = list[i], k = q.species as SeaSpecies, home = HOME_OF[k] ?? 'reef', look = HOME_LOOK[home];
      const sand = new THREE.Mesh(new THREE.BoxGeometry(t.hw * 2, 0.4, t.hd * 2), mat(look.sand)); sand.position.set(t.x, 0.2, t.z); g.add(sand);
      const water = new THREE.Mesh(new THREE.BoxGeometry(t.hw * 2 - 0.15, t.h - 0.5, t.hd * 2 - 0.15), new THREE.MeshStandardMaterial({ color: look.water, transparent: true, opacity: 0.35, roughness: 0.05, depthWrite: false }));
      water.position.set(t.x, 0.4 + (t.h - 0.5) / 2, t.z); water.renderOrder = 2; g.add(water);
      const glass = new THREE.Mesh(new THREE.BoxGeometry(t.hw * 2, t.h, t.hd * 2), new THREE.MeshStandardMaterial({ color: 0xcff0ff, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }));
      glass.position.set(t.x, t.h / 2, t.z); glass.renderOrder = 3; g.add(glass);
      const frame = mat(0xffffff);
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.15, t.h, 0.15), frame); post.position.set(t.x + sx * t.hw, t.h / 2, t.z + sz * t.hd); g.add(post); }
      const lid = new THREE.Mesh(new THREE.BoxGeometry(t.hw * 2 + 0.1, 0.12, t.hd * 2 + 0.1), frame); lid.position.set(t.x, t.h, t.z); g.add(lid);
      this.decorate(g, t.x, t.z, t.hw, t.hd, t.h, home, 1);
      // the name sign on the glass front
      const sign = this.lbl(`${SEA_INFO[k]?.emoji ?? '🐟'} ${q.name}`, Math.min(4, Math.max(2.4, (t.face === 's' ? t.hw : t.hd) * 1.6)), `${SEA_INFO[k]?.name ?? k} · ${look.label}`);
      if (t.face === 's') { sign.position.set(t.x, t.h + 0.8, t.z + t.hd + 0.05); }
      else if (t.face === 'e') { sign.position.set(t.x + t.hw + 0.05, t.h + 0.8, t.z); sign.rotation.y = Math.PI / 2; }
      else { sign.position.set(t.x - t.hw - 0.05, t.h + 0.8, t.z); sign.rotation.y = -Math.PI / 2; }
      g.add(sign);
      this.tankCols.push(this.collision.add({ kind: 'box', minX: t.x - t.hw - 0.15, maxX: t.x + t.hw + 0.15, minZ: t.z - t.hd - 0.15, maxZ: t.z + t.hd + 0.15, top: 100, tall: true }) as Collider);
    });
  }
  fill(list: { species: string; name: string }[], mode: 'big' | 'own' = this.mode) {
    this.clear();
    this.mode = mode;
    this.buildTanks(list);
    const A = AQUA, T = A.tank;
    list.forEach((q, idx) => {
      const kind = q.species as SeaSpecies; if (!SEA_INFO[kind]) return;
      const rig = buildSeaCreature(kind);
      const own = this.tanks[idx], inOwn = mode === 'own' && own && own.hw > 1;
      const home = inOwn ? { x: own.x, z: own.z, hw: own.hw, hd: own.hd, h: own.h } : { x: A.x, z: A.z, hw: T.hw, hd: T.hd, h: T.h };
      // a sea pet fills its own home nicely; in the big tank big animals stay big
      const scale = inOwn ? Math.min(SEA_INFO[kind].size, Math.min(home.hw, home.hd) * 1.3, home.h * 0.8) : Math.min(SEA_INFO[kind].size, 6.5);
      rig.root.scale.setScalar(scale);
      this.group.add(rig.root);
      const room = Math.min(home.hw, home.hd);
      const r = Math.max(0.2, room - Math.max(0.6, scale * 0.45) - (inOwn ? 0.2 : 1));
      const still = kind === 'starfish', slow = kind === 'jellyfish' || kind === 'seahorse';
      const y = kind === 'starfish' ? 0.5 : kind === 'octopus' ? 0.9 : Math.max(0.6 + scale * 0.3, Math.min(home.h - 0.6 - scale * 0.3, 1 + Math.random() * (home.h - 2)));
      this.pets.push({ idx, rig, a: Math.random() * 6.28, r: inOwn ? Math.min(r, room * 0.7) : (kind === 'whale' || kind === 'narwhal' ? r : 2 + Math.random() * Math.max(0.5, r - 2)), y, speed: (still ? 0 : slow ? 0.15 : 0.35 + Math.random() * 0.2) * (idx % 2 ? 1 : -1) * (inOwn ? 1.3 : 1), scale, cx: inOwn ? 0 : (Math.random() - 0.5) * 3, cz: inOwn ? 0 : (Math.random() - 0.5) * 3, home });
    });
  }
  clear() { for (const p of this.pets) p.rig.root.removeFromParent(); this.pets = []; }
  /** Where a pet's tank is (for visiting). */
  tankNear(x: number, z: number) {
    const A = AQUA, T = A.tank;
    if (Math.abs(x - A.x) < T.hw + 4 && Math.abs(z - A.z) < T.hd + 4) return 'big';
    const i = this.tanks.findIndex((t) => t.hw > 1 && Math.abs(x - t.x) < t.hw + 3 && Math.abs(z - t.z) < t.hd + 3);
    return i;
  }
  update(dt: number, t: number, inside: boolean, swimmer: THREE.Vector3 | null = null) {
    this.group.visible = inside;
    if (!inside) return;
    const A = AQUA, T = A.tank;
    // the ball drifts through the water
    const b = this.ball;
    if (b && this.ballState === 'flying') {
      this.ballVel.multiplyScalar(Math.max(0, 1 - dt * 1.2)); this.ballVel.y -= dt * 0.6;
      b.position.addScaledVector(this.ballVel, dt);
      b.position.x = Math.max(A.x - T.hw + 0.5, Math.min(A.x + T.hw - 0.5, b.position.x));
      b.position.z = Math.max(A.z - T.hd + 0.5, Math.min(A.z + T.hd - 0.5, b.position.z));
      b.position.y = Math.max(0.7, Math.min(T.h - 0.8, b.position.y));
    }
    if (!swimmer && this.ballState !== 'none') { this.ballState = 'none'; if (b) b.visible = false; }
    for (const p of this.pets) {
      p.a += p.speed * dt;
      const H = p.home;
      const inBig = H.hw === T.hw;
      if (swimmer && inBig) {
        // playing with you! Everyone swims around you (or races for the ball)
        if (!p.cur) p.cur = p.rig.root.position.clone();
        let tx: number, ty: number, tz: number, sp = 2.2;
        if (this.ballState === 'flying' && b) { tx = b.position.x; ty = b.position.y; tz = b.position.z; sp = 3.6 + (p.idx % 3) * 0.3; }
        else if (this.ballState === 'carried' && this.carrier === p) { tx = swimmer.x; ty = swimmer.y; tz = swimmer.z; sp = 3.2; }
        else {
          const k = this.pets.indexOf(p), ring = 2.2 + (k % 3) * 1.3 + p.scale * 0.35, a = t * 0.5 * (k % 2 ? 1 : -1) + k * 1.9;
          tx = swimmer.x + Math.cos(a) * ring; ty = swimmer.y + Math.sin(t * 0.7 + k) * 0.6; tz = swimmer.z + Math.sin(a) * ring;
        }
        tx = Math.max(A.x - T.hw + 0.4 + p.scale * 0.4, Math.min(A.x + T.hw - 0.4 - p.scale * 0.4, tx));
        tz = Math.max(A.z - T.hd + 0.4 + p.scale * 0.4, Math.min(A.z + T.hd - 0.4 - p.scale * 0.4, tz));
        ty = Math.max(0.6 + p.scale * 0.25, Math.min(T.h - 0.6 - p.scale * 0.25, ty));
        const d = Math.hypot(tx - p.cur.x, ty - p.cur.y, tz - p.cur.z);
        if (d > 0.05) {
          const st = Math.min(d, sp * dt);
          const dx = (tx - p.cur.x) / d, dz = (tz - p.cur.z) / d;
          p.cur.x += dx * st; p.cur.y += ((ty - p.cur.y) / d) * st; p.cur.z += dz * st;
          if (Math.hypot(dx, dz) > 0.2) { const want = Math.atan2(dx, dz); let dr = want - p.rig.root.rotation.y; while (dr > Math.PI) dr -= Math.PI * 2; while (dr < -Math.PI) dr += Math.PI * 2; p.rig.root.rotation.y += dr * Math.min(1, dt * 4); }
        }
        if (this.ballState === 'flying' && b && p.cur.distanceTo(b.position) < 0.6 + p.scale * 0.3) { this.ballState = 'carried'; this.carrier = p; }
        if (this.ballState === 'carried' && this.carrier === p && b) {
          b.position.set(p.cur.x + Math.sin(p.rig.root.rotation.y) * p.scale * 0.5, p.cur.y, p.cur.z + Math.cos(p.rig.root.rotation.y) * p.scale * 0.5);
          if (p.cur.distanceTo(swimmer) < 1.6 + p.scale * 0.4) { this.ballState = 'none'; b.visible = false; this.carrier = null; p.hop = 1; this.onFetch?.(p.idx); }
        }
        if ((p.hop ?? 0) > 0) p.hop! -= dt;
        p.rig.root.position.set(p.cur.x, p.cur.y + ((p.hop ?? 0) > 0 ? Math.abs(Math.sin(p.hop! * 9)) * 0.3 : 0), p.cur.z);
        animateSea(p.rig, t * 1.6 + p.idx, 1.5);
        continue;
      }
      p.cur = undefined;
      // an oval swim path that fits the tank
      const rx = Math.min(p.r, H.hw - p.scale * 0.45), rz = Math.min(p.r * (H.hd / Math.max(H.hw, 0.1)), H.hd - p.scale * 0.45);
      const x = H.x + p.cx + Math.cos(p.a) * Math.max(0.1, rx), z = H.z + p.cz + Math.sin(p.a) * Math.max(0.1, rz);
      const y = p.y + Math.sin(t * 0.8 + p.idx) * (p.rig.kind === 'jellyfish' ? 0.5 : 0.2);
      p.rig.root.position.set(x, y, z);
      if (p.speed) p.rig.root.rotation.y = Math.atan2(-Math.sin(p.a) * Math.sign(p.speed) * rx, Math.cos(p.a) * Math.sign(p.speed) * rz);
      animateSea(p.rig, t + p.idx, 1);
    }
    for (const b of this.bubbles) { b.position.y += dt * 0.8; const top = (b.userData.top as number) ?? AQUA.tank.h - 0.4; if (b.position.y > top) b.position.y = 0.5; }
    for (const w of this.weeds) w.rotation.z = Math.sin(t + (w.userData.sway as number)) * 0.15;
  }
}
