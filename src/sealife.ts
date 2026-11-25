import * as THREE from 'three';
import { CollisionWorld } from './terrain';

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

/** Your Aquarium: a big dark-blue room with a HUGE glass tank full of your sea pets. */
export const AQUA = { x: 0, z: -1900, halfW: 26, halfD: 26, tank: { hw: 12, hd: 12, h: 6.5 } };

interface TankPet { idx: number; rig: SeaRig; a: number; r: number; y: number; speed: number; scale: number; cx: number; cz: number }
export class Aquarium {
  group = new THREE.Group();
  pets: TankPet[] = [];
  bubbles: THREE.Mesh[] = [];
  constructor(scene: THREE.Scene, collision: CollisionWorld) {
    const A = AQUA, T = A.tank, g = this.group;
    g.visible = false; scene.add(g);
    // floor and walls
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(A.halfW * 2, A.halfD * 2), mat(0x1a3a5a, { roughness: 0.4 })); floor.rotation.x = -Math.PI / 2; floor.position.set(A.x, 0.01, A.z); g.add(floor);
    const wallM = mat(0x163050), H = 9;
    const wall = (w: number, d: number, px: number, pz: number) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, H, d), wallM); m.position.set(px, H / 2, pz); g.add(m); collision.add({ kind: 'box', minX: px - w / 2, maxX: px + w / 2, minZ: pz - d / 2, maxZ: pz + d / 2, top: 100, tall: true }); };
    wall(A.halfW * 2 + 1, 0.5, A.x, A.z - A.halfD); wall(A.halfW * 2 + 1, 0.5, A.x, A.z + A.halfD); wall(0.5, A.halfD * 2, A.x - A.halfW, A.z); wall(0.5, A.halfD * 2, A.x + A.halfW, A.z);
    // the tank: sand, glass, water, rocks, coral and seaweed
    const sand = new THREE.Mesh(new THREE.BoxGeometry(T.hw * 2, 0.4, T.hd * 2), mat(0xe8d49a)); sand.position.set(A.x, 0.2, A.z); g.add(sand);
    const water = new THREE.Mesh(new THREE.BoxGeometry(T.hw * 2 - 0.2, T.h - 0.6, T.hd * 2 - 0.2), new THREE.MeshStandardMaterial({ color: 0x2a9ad8, transparent: true, opacity: 0.28, roughness: 0.05, depthWrite: false }));
    water.position.set(A.x, 0.4 + (T.h - 0.6) / 2, A.z); water.renderOrder = 2; g.add(water);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(T.hw * 2, T.h, T.hd * 2), new THREE.MeshStandardMaterial({ color: 0xcff0ff, transparent: true, opacity: 0.12, roughness: 0.02, depthWrite: false, side: THREE.DoubleSide }));
    glass.position.set(A.x, T.h / 2, A.z); glass.renderOrder = 3; g.add(glass);
    const frame = mat(0xffffff);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.25, T.h, 0.25), frame); post.position.set(A.x + sx * T.hw, T.h / 2, A.z + sz * T.hd); g.add(post); }
    for (const sz of [-1, 1]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(T.hw * 2, 0.2, 0.25), frame); rail.position.set(A.x, T.h, A.z + sz * T.hd); g.add(rail); }
    for (const sx of [-1, 1]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.2, T.hd * 2), frame); rail.position.set(A.x + sx * T.hw, T.h, A.z); g.add(rail); }
    collision.add({ kind: 'box', minX: A.x - T.hw - 0.2, maxX: A.x + T.hw + 0.2, minZ: A.z - T.hd - 0.2, maxZ: A.z + T.hd + 0.2, top: 100, tall: true });
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    for (let k = 0; k < 14; k++) { const rk = new THREE.Mesh(new THREE.DodecahedronGeometry(rnd(0.4, 1.1), 0), mat(0x7a7a8a)); rk.position.set(A.x + rnd(-T.hw + 1, T.hw - 1), 0.5, A.z + rnd(-T.hd + 1, T.hd - 1)); g.add(rk); }
    const corals = [0xff6a8a, 0xffa04a, 0xc86aff, 0xffe04a, 0x4ad8c8];
    for (let k = 0; k < 26; k++) {
      const cx = A.x + rnd(-T.hw + 1, T.hw - 1), cz = A.z + rnd(-T.hd + 1, T.hd - 1);
      if (k % 2) { for (let j = 0; j < 4; j++) { const br = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, rnd(0.6, 1.4), 6), mat(corals[k % 5])); br.position.set(cx + rnd(-0.3, 0.3), 0.9, cz + rnd(-0.3, 0.3)); br.rotation.set(rnd(-0.5, 0.5), 0, rnd(-0.5, 0.5)); g.add(br); } }
      else { for (let j = 0; j < 3; j++) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, rnd(1.5, 3.5), 5), mat(0x3aa84a)); w.position.set(cx + rnd(-0.4, 0.4), 1.5, cz + rnd(-0.4, 0.4)); w.rotation.z = rnd(-0.2, 0.2); w.userData.sway = Math.random() * 6; g.add(w); this.weeds.push(w); } }
    }
    const chest = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 0.8), mat(0x8a5a2a)); chest.position.set(A.x + 5, 0.8, A.z - 6); chest.rotation.y = 0.4; g.add(chest);
    for (let k = 0; k < 40; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), new THREE.MeshStandardMaterial({ color: 0xdff4ff, transparent: true, opacity: 0.6 })); b.position.set(A.x + rnd(-T.hw + 1, T.hw - 1), rnd(0.5, T.h - 0.5), A.z + rnd(-T.hd + 1, T.hd - 1)); g.add(b); this.bubbles.push(b); }
    // lights
    const top = new THREE.PointLight(0x9ad8ff, 10, 80, 1.2); top.position.set(A.x, 14, A.z); g.add(top);
    g.add(new THREE.HemisphereLight(0x8ac8ff, 0x0a1a3a, 0.9));
    // way out + sign
    const lbl = (text: string, w: number) => {
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128;
      const gx = cv.getContext('2d')!; gx.fillStyle = '#eaf6ff'; gx.beginPath(); gx.roundRect(4, 4, 504, 120, 26); gx.fill();
      gx.fillStyle = '#1a5a9a'; gx.font = 'bold 50px Nunito, sans-serif'; gx.textAlign = 'center'; gx.textBaseline = 'middle'; gx.fillText(text, 256, 66, 490);
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
      return new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide }));
    };
    const door = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.4), mat(0xbfe8ff, { emissive: 0x6ac8ff, emissiveIntensity: 1.2, side: THREE.DoubleSide }));
    door.position.set(A.x, 1.7, A.z + A.halfD - 0.3); door.rotation.y = Math.PI; g.add(door);
    const out = lbl('🚪 Way out', 2.6); out.position.set(A.x, 3.8, A.z + A.halfD - 0.35); out.rotation.y = Math.PI; g.add(out);
    const title = lbl('🐠 My Aquarium 🐋', 10); title.position.set(A.x, 7.5, A.z - A.halfD + 0.4); g.add(title);
  }
  weeds: THREE.Mesh[] = [];
  fill(list: { species: string }[]) {
    this.clear();
    const T = AQUA.tank;
    list.forEach((q, idx) => {
      const kind = q.species as SeaSpecies; if (!SEA_INFO[kind]) return;
      const rig = buildSeaCreature(kind);
      const scale = Math.min(SEA_INFO[kind].size, 5.5);
      rig.root.scale.setScalar(scale);
      this.group.add(rig.root);
      const r = kind === 'whale' || kind === 'narwhal' ? T.hw - 4 : 2 + Math.random() * (T.hw - 4.5);
      this.pets.push({ idx, rig, a: Math.random() * 6.28, r, y: kind === 'starfish' ? 0.5 : kind === 'octopus' ? 1 : 1.3 + Math.random() * (T.h - 3), speed: (kind === 'starfish' ? 0 : kind === 'jellyfish' || kind === 'seahorse' ? 0.15 : 0.35 + Math.random() * 0.2) * (idx % 2 ? 1 : -1), scale, cx: (Math.random() - 0.5) * 3, cz: (Math.random() - 0.5) * 3 });
    });
  }
  clear() { for (const p of this.pets) p.rig.root.removeFromParent(); this.pets = []; }
  update(dt: number, t: number, inside: boolean) {
    this.group.visible = inside;
    if (!inside) return;
    const A = AQUA, T = A.tank;
    for (const p of this.pets) {
      p.a += p.speed * dt;
      const x = A.x + p.cx + Math.cos(p.a) * p.r, z = A.z + p.cz + Math.sin(p.a) * p.r;
      const y = p.y + Math.sin(t * 0.8 + p.idx) * (p.rig.kind === 'jellyfish' ? 0.6 : 0.25);
      p.rig.root.position.set(x, y, z);
      if (p.speed) p.rig.root.rotation.y = Math.atan2(-Math.sin(p.a) * Math.sign(p.speed), Math.cos(p.a) * Math.sign(p.speed));
      animateSea(p.rig, t + p.idx, 1);
    }
    for (const b of this.bubbles) { b.position.y += dt * 0.8; if (b.position.y > T.h - 0.4) b.position.y = 0.5; }
    for (const w of this.weeds) w.rotation.z = Math.sin(t + (w.userData.sway as number)) * 0.15;
  }
}
