// Procedural "stylised realistic" animal models with a simple animation rig.
import * as THREE from 'three';
import { furTexture, FurStyle } from './textures';
import { Species, OppSpecies, SkinDef, SEA_PLAYERS } from './config';
import { buildSeaCreature, animateSea, SeaRig, SeaSpecies } from './sealife';

export type RigKind = 'quad' | 'chicken' | 'penguin' | 'bunny' | 'human' | 'sea';

export interface AnimalRig {
  root: THREE.Group;      // placed at the feet; rotation.y = yaw
  body: THREE.Group;      // everything above the feet; bobs / tilts
  head: THREE.Object3D;
  legs: { pivot: THREE.Object3D; phase: number; front: boolean }[];
  tail?: THREE.Object3D;
  ears: THREE.Object3D[];
  wings: THREE.Object3D[];
  kind: RigKind;
  height: number;
  radius: number;
  materials: THREE.MeshStandardMaterial[];
  headBase: THREE.Vector3;
  phase: number;
  eyes: THREE.Object3D[];
  idleT: number;
  blinkAt: number;
}

export interface AnimState {
  speed: number;        // horizontal speed (m/s)
  airborne: boolean;
  attack: 'scratch' | 'bite' | 'special' | null;
  attackT: number;      // 0..1 progress
  windup: number;       // 0..1 crouch for telegraphs
}

const SPHERE = new THREE.SphereGeometry(1, 18, 12);
const SPHERE_LO = new THREE.SphereGeometry(1, 12, 8);

class Builder {
  mats: THREE.MeshStandardMaterial[] = [];
  mat(color: number, style: FurStyle = 'fur', opts: { pattern?: string; patternColor?: number; rough?: number } = {}) {
    const m = new THREE.MeshStandardMaterial({
      map: style === 'smooth' && !opts.pattern ? null : furTexture(color, style, opts.pattern, opts.patternColor),
      color: style === 'smooth' && !opts.pattern ? color : 0xffffff,
      roughness: opts.rough ?? 0.92,
      metalness: 0,
    });
    this.mats.push(m);
    return m;
  }
  plain(color: number, rough = 0.6) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: rough });
    this.mats.push(m);
    return m;
  }
}

function ell(parent: THREE.Object3D, mat: THREE.Material, s: [number, number, number], p: [number, number, number], r: [number, number, number] = [0, 0, 0], lo = false) {
  const m = new THREE.Mesh(lo ? SPHERE_LO : SPHERE, mat);
  m.scale.set(...s); m.position.set(...p); m.rotation.set(...r);
  m.castShadow = true;
  parent.add(m);
  return m;
}
function cone(parent: THREE.Object3D, mat: THREE.Material, rad: number, h: number, p: [number, number, number], r: [number, number, number] = [0, 0, 0], seg = 10) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(rad, h, seg), mat);
  m.position.set(...p); m.rotation.set(...r); m.castShadow = true;
  parent.add(m); return m;
}
function cyl(parent: THREE.Object3D, mat: THREE.Material, rt: number, rb: number, h: number, p: [number, number, number], r: [number, number, number] = [0, 0, 0]) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 10), mat);
  m.position.set(...p); m.rotation.set(...r); m.castShadow = true;
  parent.add(m); return m;
}
function eyes(b: Builder, head: THREE.Object3D, x: number, y: number, z: number, size: number, iris?: number, slit = false) {
  const eye = b.plain(iris ?? 0x120d0a, 0.15);
  const pupil = b.plain(0x0a0806, 0.1);
  const shine = b.plain(0xffffff, 0.2);
  for (const sx of [-1, 1]) {
    const e = ell(head, eye, [size, size, size], [sx * x, y, z], [0, 0, 0], true); e.name = 'eye';
    // a coloured eye gets a dark pupil (a cat's is a tall slit); it's a child so it blinks with the eye
    if (iris !== undefined) ell(e, pupil, slit ? [0.32, 0.85, 0.3] : [0.5, 0.5, 0.3], [0, 0, 0.78], [0, 0, 0], true);
    ell(head, shine, [size * 0.3, size * 0.3, size * 0.3], [sx * x + size * 0.25, y + size * 0.35, z + size * 0.75], [0, 0, 0], true);
  }
}
function pivot(parent: THREE.Object3D, p: [number, number, number]) {
  const o = new THREE.Group(); o.position.set(...p); parent.add(o); return o;
}

function newRig(kind: RigKind, b: Builder): AnimalRig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  return { root, body, head: body, legs: [], ears: [], wings: [], kind, height: 1, radius: 0.4, materials: b.mats, headBase: new THREE.Vector3(), phase: Math.random() * 10, eyes: [], idleT: Math.random() * 10, blinkAt: 2 + Math.random() * 3 };
}

// ----------------------------------------------------------------------------
// Bird & bunny starters
// ----------------------------------------------------------------------------
function buildChicken(skin: SkinDef['colors'], pattern?: string): AnimalRig {
  const b = new Builder();
  const rig = newRig('chicken', b);
  const feather = b.mat(skin.primary, 'feather', { pattern, patternColor: skin.extra });
  const wingM = b.mat(skin.secondary, 'feather', { pattern, patternColor: skin.extra });
  const red = b.mat(skin.accent, 'smooth', { rough: 0.5 });
  const yellow = b.plain(0xe8b33a, 0.5);
  const B = rig.body;
  ell(B, feather, [0.27, 0.27, 0.34], [0, 0.5, 0]);
  ell(B, feather, [0.2, 0.22, 0.2], [0, 0.55, 0.2]); // chest
  // tail feathers fan
  for (let i = -2; i <= 2; i++) ell(B, feather, [0.05, 0.2, 0.12], [i * 0.05, 0.72, -0.28], [-0.5, 0, i * 0.18]);
  // wings
  for (const sx of [-1, 1]) {
    const w = pivot(B, [sx * 0.24, 0.6, 0.05]);
    ell(w, wingM, [0.06, 0.15, 0.24], [0, -0.07, -0.05], [0.15, 0, 0]);
    rig.wings.push(w);
  }
  // neck + head
  const head = pivot(B, [0, 0.78, 0.22]);
  ell(head, feather, [0.1, 0.12, 0.1], [0, -0.04, -0.02]);
  ell(head, feather, [0.12, 0.12, 0.12], [0, 0.06, 0]);
  cone(head, yellow, 0.035, 0.11, [0, 0.04, 0.15], [Math.PI / 2, 0, 0], 8);
  for (let i = 0; i < 3; i++) ell(head, red, [0.025, 0.045, 0.035], [0, 0.17 + (i === 1 ? 0.02 : 0), 0.04 - i * 0.045], [0, 0, 0], true);
  ell(head, red, [0.025, 0.05, 0.025], [0, -0.04, 0.11], [0, 0, 0], true);
  eyes(b, head, 0.085, 0.08, 0.06, 0.02);
  rig.head = head;
  // legs
  for (const sx of [-1, 1]) {
    const p = pivot(B, [sx * 0.1, 0.32, 0.02]);
    cyl(p, yellow, 0.025, 0.02, 0.32, [0, -0.16, 0]);
    for (const a of [-0.5, 0, 0.5]) cyl(p, yellow, 0.012, 0.012, 0.12, [Math.sin(a) * 0.05, -0.31, Math.cos(a) * 0.05], [Math.PI / 2, 0, -a]);
    rig.legs.push({ pivot: p, phase: sx > 0 ? 0 : Math.PI, front: true });
  }
  rig.height = 0.95; rig.radius = 0.35;
  return rig;
}

/** A kid! Shirt = primary, trousers/skirt = secondary, hair = accent. Girls have long hair and a skirt. */
function buildHuman(c: SkinDef['colors'], girl: boolean): AnimalRig {
  const b = new Builder();
  const rig = newRig('human', b);
  const shirt = b.mat(c.primary, 'smooth', { rough: 0.85 }), pants = b.mat(c.secondary, 'smooth', { rough: 0.85 });
  const skin = b.plain(c.extra ?? 0xf1c8a5, 0.7), hair = b.mat(c.accent, 'fur'), shoe = b.plain(0x3a2a22, 0.6);
  const B = rig.body;
  ell(B, shirt, [0.2, 0.26, 0.14], [0, 1.0, 0]);                 // body
  ell(B, pants, [0.19, 0.12, 0.13], [0, 0.74, 0]);                // hips
  if (girl) cone(B, pants, 0.27, 0.34, [0, 0.7, 0], [0, 0, 0], 14);   // a twirly skirt
  cyl(B, skin, 0.05, 0.06, 0.1, [0, 1.27, 0]);                    // neck
  const head = pivot(B, [0, 1.42, 0.0]);
  ell(head, skin, [0.16, 0.18, 0.16], [0, 0, 0]);
  ell(head, hair, [0.17, 0.12, 0.17], [0, 0.08, -0.02]);         // hair on top
  ell(head, hair, [0.17, 0.16, 0.08], [0, 0.0, -0.1]);           // hair at the back
  if (girl) { ell(head, hair, [0.15, 0.26, 0.07], [0, -0.14, -0.12]); ell(head, hair, [0.07, 0.17, 0.06], [0.14, -0.08, -0.02]); ell(head, hair, [0.07, 0.17, 0.06], [-0.14, -0.08, -0.02]); }
  ell(head, skin, [0.035, 0.05, 0.03], [0.16, 0, 0], [0, 0, 0], true); ell(head, skin, [0.035, 0.05, 0.03], [-0.16, 0, 0], [0, 0, 0], true); // ears
  ell(head, b.plain(0xd8584a, 0.6), [0.05, 0.015, 0.02], [0, -0.08, 0.15], [0, 0, 0], true); // smile
  ell(head, b.plain(0xf0a0a0, 0.8), [0.03, 0.02, 0.01], [0.09, -0.04, 0.14], [0, 0, 0], true); ell(head, b.plain(0xf0a0a0, 0.8), [0.03, 0.02, 0.01], [-0.09, -0.04, 0.14], [0, 0, 0], true); // rosy cheeks
  eyes(b, head, 0.06, 0.02, 0.145, 0.025);
  rig.head = head;
  for (const sx of [-1, 1]) {
    const arm = pivot(B, [sx * 0.24, 1.18, 0]);
    cyl(arm, shirt, 0.05, 0.045, 0.24, [0, -0.11, 0]);
    cyl(arm, skin, 0.04, 0.035, 0.22, [0, -0.33, 0]);
    ell(arm, skin, [0.045, 0.05, 0.045], [0, -0.46, 0], [0, 0, 0], true);
    rig.wings.push(arm);
    const leg = pivot(B, [sx * 0.09, 0.68, 0]);
    cyl(leg, girl ? skin : pants, 0.06, 0.05, 0.6, [0, -0.3, 0]);
    ell(leg, shoe, [0.06, 0.05, 0.1], [0, -0.62, 0.03], [0, 0, 0], true);
    rig.legs.push({ pivot: leg, phase: sx > 0 ? 0 : Math.PI, front: true });
  }
  rig.height = 1.62; rig.radius = 0.32;
  return rig;
}

function buildPenguin(skin: SkinDef['colors']): AnimalRig {
  const b = new Builder();
  const rig = newRig('penguin', b);
  const back = b.mat(skin.primary, 'feather', { rough: 0.6 });
  const belly = b.mat(skin.secondary, 'feather', { rough: 0.7 });
  const accent = b.mat(skin.accent, 'smooth', { rough: 0.5 });
  const beakM = b.plain(0x2a2522, 0.4);
  const feetM = b.plain(0xe08a3a, 0.6);
  const B = rig.body;
  ell(B, back, [0.3, 0.44, 0.27], [0, 0.55, -0.02]);
  ell(B, belly, [0.25, 0.38, 0.2], [0, 0.5, 0.1]);
  const head = pivot(B, [0, 0.98, 0.02]);
  ell(head, back, [0.17, 0.16, 0.17], [0, 0, 0]);
  ell(head, accent, [0.04, 0.07, 0.06], [-0.13, -0.04, 0.03], [0, 0, 0.4], true);
  ell(head, accent, [0.04, 0.07, 0.06], [0.13, -0.04, 0.03], [0, 0, -0.4], true);
  cone(head, beakM, 0.035, 0.16, [0, -0.02, 0.2], [Math.PI / 2 + 0.15, 0, 0], 8);
  eyes(b, head, 0.08, 0.04, 0.13, 0.022);
  rig.head = head;
  for (const sx of [-1, 1]) {
    const w = pivot(B, [sx * 0.28, 0.78, 0]);
    ell(w, back, [0.04, 0.26, 0.1], [sx * 0.02, -0.22, 0], [0, 0, sx * 0.15]);
    rig.wings.push(w);
  }
  for (const sx of [-1, 1]) {
    const p = pivot(B, [sx * 0.11, 0.12, 0.04]);
    ell(p, feetM, [0.08, 0.03, 0.13], [0, -0.09, 0.06], [0, 0, 0], true);
    rig.legs.push({ pivot: p, phase: sx > 0 ? 0 : Math.PI, front: true });
  }
  ell(B, back, [0.08, 0.04, 0.1], [0, 0.18, -0.26], [0.5, 0, 0], true); // tail
  rig.height = 1.15; rig.radius = 0.35;
  return rig;
}

function buildBunny(skin: SkinDef['colors'], pattern?: string): AnimalRig {
  const b = new Builder();
  const rig = newRig('bunny', b);
  const fur = b.mat(skin.primary, 'fur', { pattern, patternColor: skin.extra });
  const light = b.mat(skin.secondary, 'fur');
  const pink = b.mat(skin.accent, 'smooth', { rough: 0.7 });
  const dark = skin.extra !== undefined ? b.mat(skin.extra, 'fur') : fur;
  const B = rig.body;
  ell(B, fur, [0.22, 0.21, 0.3], [0, 0.3, -0.02]);
  ell(B, fur, [0.2, 0.2, 0.18], [0, 0.27, -0.16]); // haunch
  ell(B, light, [0.15, 0.15, 0.14], [0, 0.29, 0.14]); // chest
  ell(B, light, [0.09, 0.09, 0.09], [0, 0.36, -0.33]); // tail puff
  const head = pivot(B, [0, 0.5, 0.22]);
  ell(head, dark, [0.14, 0.13, 0.16], [0, 0, 0]);
  ell(head, light, [0.07, 0.06, 0.07], [0, -0.04, 0.12], [0, 0, 0], true);
  ell(head, pink, [0.018, 0.014, 0.012], [0, 0.0, 0.17], [0, 0, 0], true);
  eyes(b, head, 0.1, 0.04, 0.07, 0.024);
  for (const sx of [-1, 1]) {
    const e = pivot(head, [sx * 0.05, 0.1, -0.03]);
    e.rotation.set(-0.25, 0, sx * -0.18);
    ell(e, dark, [0.045, 0.2, 0.025], [0, 0.18, 0]);
    ell(e, pink, [0.03, 0.15, 0.012], [0, 0.18, 0.016], [0, 0, 0], true);
    rig.ears.push(e);
  }
  rig.head = head;
  // front legs
  for (const sx of [-1, 1]) {
    const p = pivot(B, [sx * 0.08, 0.22, 0.14]);
    ell(p, light, [0.04, 0.12, 0.045], [0, -0.1, 0.01], [0, 0, 0], true);
    rig.legs.push({ pivot: p, phase: 0, front: true });
  }
  // hind feet
  for (const sx of [-1, 1]) {
    const p = pivot(B, [sx * 0.14, 0.14, -0.12]);
    ell(p, fur, [0.05, 0.05, 0.15], [0, -0.1, 0.06], [0, 0, 0], true);
    rig.legs.push({ pivot: p, phase: Math.PI, front: false });
  }
  rig.height = 0.75; rig.radius = 0.35;
  return rig;
}

// ----------------------------------------------------------------------------
// Generic quadruped
// ----------------------------------------------------------------------------
interface QuadParams {
  len: number; bodyH: number; bodyW: number; legLen: number; legR: number;
  headR: number; snout: number; snoutR: number; ears: 'pointy' | 'round' | 'small' | 'none';
  earSize: number; tail: 'bushy' | 'tuft' | 'thin' | 'thick' | 'croc' | 'stub';
  tailLen: number; mane?: number; tusks?: number; frontLegMult?: number; sprawl?: boolean;
  colors: { primary: number; secondary: number; accent: number; extra?: number };
  pattern?: string; style?: FurStyle; socks?: boolean; tailTip?: boolean; faceMask?: boolean;
  ridges?: boolean; snoutDisc?: boolean; teeth?: boolean; bigNose?: boolean;
  eyeSize?: number; iris?: number; slitPupil?: boolean; whiskers?: boolean;
  neckLen?: number; longHead?: boolean; maneStrip?: boolean; longTail?: boolean; hooves?: number; beard?: boolean; horns?: number;
  unicornHorn?: boolean;
  panda?: boolean;      // black ears, eye patches, legs and shoulder band
}

function buildQuad(p: QuadParams): AnimalRig {
  const b = new Builder();
  const rig = newRig('quad', b);
  const style = p.style ?? 'fur';
  const fur = b.mat(p.colors.primary, style, { pattern: p.pattern, patternColor: p.colors.extra });
  const light = b.mat(p.colors.secondary, style);
  const dark = b.mat(p.colors.accent, style === 'scale' ? 'scale' : 'fur');
  const nose = b.plain(0x1c1614, 0.35);
  const B = rig.body;
  const fl = p.frontLegMult ?? 1;
  const hipY = p.legLen;
  const bodyY = hipY + p.bodyH * 0.35;
  // torso: chest + belly + rump
  ell(B, fur, [p.bodyW, p.bodyH * 0.55, p.len * 0.42], [0, bodyY, 0]);
  ell(B, fur, [p.bodyW * 1.02, p.bodyH * 0.6 * fl, p.len * 0.25], [0, bodyY + (fl - 1) * 0.2, p.len * 0.26]);
  ell(B, fur, [p.bodyW * 0.95, p.bodyH * 0.55, p.len * 0.24], [0, bodyY, -p.len * 0.28]);
  ell(B, light, [p.bodyW * 0.8, p.bodyH * 0.3, p.len * 0.38], [0, bodyY - p.bodyH * 0.28, 0.02]);
  if (p.ridges) for (let i = 0; i < 9; i++) cone(B, dark, 0.05, 0.12, [0, bodyY + p.bodyH * 0.5, p.len * 0.4 - i * p.len * 0.1], [0, 0, 0], 4);
  // neck + head
  const neck = p.neckLen ?? 0;
  const headY = bodyY + p.bodyH * 0.35 * fl + (p.sprawl ? 0 : p.headR * 0.6) + neck;
  const headZ = p.len * 0.5 + p.headR * 0.5 + neck * 0.35;
  if (neck) {
    // a long, strong neck rising up from the shoulders (horses, ponies)
    ell(B, fur, [p.bodyW * 0.5, neck * 0.75 + p.bodyH * 0.3, p.headR * 1.05], [0, (bodyY + headY) / 2 + 0.02, p.len * 0.38 + neck * 0.16], [-0.42, 0, 0]);
  } else if (!p.sprawl) ell(B, fur, [p.bodyW * 0.55, p.bodyH * 0.45, p.headR * 1.2], [0, (bodyY + headY) / 2 + 0.03, p.len * 0.42], [-0.6, 0, 0]);
  const head = pivot(B, [0, headY, headZ]);
  if (p.longHead) {
    // a long horse face that slopes down to a soft muzzle
    ell(head, fur, [p.headR * 0.85, p.headR * 0.95, p.headR * 1.0], [0, 0, 0]);
    ell(head, fur, [p.headR * 0.62, p.headR * 0.62, p.headR * 1.25], [0, -p.headR * 0.45, p.headR * 0.95], [0.45, 0, 0]);
    ell(head, light, [p.headR * 0.6, p.headR * 0.5, p.headR * 0.55], [0, -p.headR * 0.95, p.headR * 1.75], [0.45, 0, 0], true);
    for (const sx of [-1, 1]) ell(head, nose, [p.headR * 0.1, p.headR * 0.12, p.headR * 0.06], [sx * p.headR * 0.22, -p.headR * 0.95, p.headR * 2.25], [0, 0, 0], true);
  } else ell(head, fur, [p.headR, p.headR * 0.88, p.headR * 1.05], [0, 0, 0]);
  if (p.faceMask) {
    ell(head, light, [p.headR * 0.4, p.headR * 0.95, p.headR * 0.95], [0, 0.03, 0.05], [0, 0, 0], true);
    ell(head, dark, [p.headR * 0.45, p.headR * 0.8, p.headR * 0.9], [-p.headR * 0.5, 0.02, 0.06], [0, 0, 0], true);
    ell(head, dark, [p.headR * 0.45, p.headR * 0.8, p.headR * 0.9], [p.headR * 0.5, 0.02, 0.06], [0, 0, 0], true);
  }
  const sn = p.longHead ? ell(head, light, [0.001, 0.001, 0.001], [0, 0, 0]) : ell(head, p.snoutDisc ? fur : light, [p.snoutR, p.snoutR * 0.8, p.snout / 2], [0, -p.headR * 0.2, p.headR * 0.6 + p.snout / 2 - 0.02]);
  if (p.snoutDisc) ell(head, b.plain(0xb07a6c, 0.6), [p.snoutR * 0.85, p.snoutR * 0.7, 0.02], [0, -p.headR * 0.2, p.headR * 0.6 + p.snout - 0.02], [0, 0, 0], true);
  else if (!p.longHead) ell(head, nose, [p.snoutR * 0.45, p.snoutR * 0.32, p.snoutR * 0.3], [0, -p.headR * 0.2 + p.snoutR * 0.45, p.headR * 0.6 + p.snout - 0.04], [0, 0, 0], true);
  if (p.whiskers) {
    const wm = b.plain(0xf4f4f0, 0.5);
    for (const sx of [-1, 1]) for (const dy of [-0.012, 0.012]) cyl(head, wm, 0.0035, 0.0035, p.headR * 1.3, [sx * p.headR * 0.55, -p.headR * 0.2 + dy, p.headR * 0.62 + p.snout * 0.5], [0, 0, Math.PI / 2 + sx * dy * 8]);
  }
  if (p.unicornHorn) {
    const hm = b.plain(0xffe9a8, 0.25); hm.emissive.setHex(0x6a5010); hm.emissiveIntensity = 0.4;
    cone(head, hm, p.headR * 0.18, p.headR * 1.5, [0, p.headR * 1.25, p.headR * 0.35], [0.45, 0, 0], 12);
  }
  if (p.beard) cone(head, dark, p.headR * 0.18, p.headR * 0.6, [0, -p.headR * 0.75, p.headR * 0.6 + p.snout * 0.6], [Math.PI, 0, 0], 6);
  if (p.horns) for (const sx of [-1, 1]) cone(head, b.plain(0xb8a888, 0.6), p.horns * 0.25, p.horns, [sx * p.headR * 0.32, p.headR * 0.85, -p.headR * 0.15], [-0.5, 0, sx * -0.2], 6);
  sn.castShadow = true;
  if (p.tusks) {
    const ivory = b.plain(0xf1ead8, 0.4);
    for (const sx of [-1, 1]) cone(head, ivory, p.tusks * 0.25, p.tusks, [sx * p.snoutR * 0.8, -p.headR * 0.2, p.headR * 0.6 + p.snout * 0.6], [-0.5, 0, sx * -0.6], 6);
  }
  if (p.bigNose) ell(head, fur, [p.snoutR * 1.1, p.snoutR * 1.3, p.snout * 0.6], [0, -p.headR * 0.05, p.headR * 0.75 + p.snout * 0.6], [0.5, 0, 0], true);
  if (p.teeth) {
    // crocodile / leopard seal teeth line
    const ivory = b.plain(0xf3eedf, 0.4);
    for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) cone(head, ivory, 0.012, 0.04, [sx * p.snoutR * 0.92, -p.headR * 0.32, p.headR * 0.6 + i * p.snout / 6], [Math.PI, 0, 0], 4);
  }
  if (p.panda) {
    // the famous panda eye patches (slanted black ovals) and a black band over the shoulders
    for (const sx of [-1, 1]) ell(head, dark, [p.headR * 0.27, p.headR * 0.36, p.headR * 0.14], [sx * p.headR * 0.4, p.headR * 0.22, p.headR * 0.84], [0.2, sx * 0.35, sx * -0.55], true);
    ell(B, dark, [p.bodyW * 1.12, p.bodyH * 0.68, p.len * 0.2], [0, bodyY + 0.02, p.len * 0.2]);
  }
  // eyes sit ON the surface of the face so they're always easy to see
  {
    const es = p.headR * 0.13 * (p.eyeSize ?? 1);
    const d = p.sprawl ? [0.45, 0.55, 0.7] : p.longHead ? [0.62, 0.3, 0.72] : [0.47, 0.3, 0.83];
    const n = Math.hypot(d[0], d[1], d[2]);
    const sy = p.longHead ? 0.95 : 0.88, sz = p.longHead ? 1.0 : 1.05, kx = p.longHead ? 0.85 : 1;
    eyes(b, head, p.headR * kx * d[0] / n * 0.95, p.headR * sy * d[1] / n * 0.95, p.headR * sz * d[2] / n * 0.95, es, p.iris, p.slitPupil);
  }
  if (p.ears !== 'none') for (const sx of [-1, 1]) {
    const e = pivot(head, [sx * p.headR * 0.55, p.headR * 0.62, -p.headR * 0.15]);
    const earM = p.panda ? dark : fur;
    if (p.ears === 'pointy') {
      cone(e, earM, p.earSize * 0.45, p.earSize, [0, p.earSize * 0.45, 0], [0, 0, sx * -0.2], 4);
      cone(e, dark, p.earSize * 0.3, p.earSize * 0.6, [0, p.earSize * 0.4, 0.03], [0, 0, sx * -0.2], 4);
    } else ell(e, earM, [p.earSize * 0.5, p.earSize * 0.55, p.earSize * 0.2], [0, p.earSize * 0.25, 0], [0, 0, sx * -0.3], true);
    rig.ears.push(e);
  }
  if (p.maneStrip) {
    // a horse's mane: a ridge of hair along the top of the neck, plus a forelock between the ears
    const maneM = b.mat(p.colors.accent, 'fur');
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      ell(B, maneM, [p.bodyW * 0.16, p.headR * 0.42, p.headR * 0.5], [0, bodyY + p.bodyH * 0.45 + (headY - bodyY - p.bodyH * 0.3) * t, p.len * 0.3 + (headZ - p.len * 0.3 - p.headR * 0.6) * t], [-0.4, 0, 0], true);
    }
    ell(head, maneM, [p.headR * 0.28, p.headR * 0.35, p.headR * 0.4], [0, p.headR * 0.75, p.headR * 0.35], [0.6, 0, 0], true);
  }
  if (p.mane) {
    // one full ruff around the neck and head, with the face poking out the front
    const maneM = b.mat(p.colors.accent, 'fur');
    ell(B, maneM, [p.headR * p.mane, p.headR * p.mane * 1.05, p.headR * 1.35], [0, headY - p.headR * 0.15, headZ - p.headR * 0.75], [-0.25, 0, 0]);
    ell(head, maneM, [p.headR * 1.25, p.headR * 1.2, p.headR * 0.6], [0, p.headR * 0.12, -p.headR * 0.35], [0, 0, 0], true);
  }
  rig.head = head;
  // legs
  const legMat = p.socks ? dark : fur;
  const positions: [number, number, boolean][] = [
    [-1, 1, true], [1, 1, true], [-1, -1, false], [1, -1, false],
  ];
  const phases = [0, Math.PI, Math.PI, 0];
  positions.forEach(([sx, sz, front], i) => {
    const len = p.legLen * (front ? fl : 1);
    const pv = pivot(B, [sx * p.bodyW * (p.sprawl ? 1.05 : 0.6), front ? len + (bodyY - hipY) * 0.2 : hipY, sz * p.len * 0.32]);
    const legRoot = p.sprawl ? pivot(pv, [0, 0, 0]) : pv;
    if (p.sprawl) legRoot.rotation.z = sx * 0.9;
    ell(legRoot, p.panda ? dark : fur, [p.legR * 1.4, len * 0.35, p.legR * 1.6], [0, -len * 0.2, 0], [0, 0, 0], true);
    cyl(legRoot, legMat, p.legR, p.legR * 0.8, len * 0.75, [0, -len * 0.55, 0]);
    if (p.hooves !== undefined) cyl(legRoot, b.plain(p.hooves, 0.5), p.legR * 1.05, p.legR * 1.25, p.legR * 1.6, [0, -len + p.legR * 0.8, 0]);
    else ell(legRoot, p.socks ? dark : fur, [p.legR * 1.2, p.legR * 0.8, p.legR * 1.6], [0, -len + p.legR * 0.6, p.legR * 0.5], [0, 0, 0], true);
    rig.legs.push({ pivot: pv, phase: phases[i], front });
  });
  // tail
  const tail = pivot(B, [0, bodyY + p.bodyH * 0.15, -p.len * 0.5]);
  if (p.longTail) {
    // a long flowing horse tail
    const tm = b.mat(p.colors.accent, 'fur');
    ell(tail, tm, [p.tailLen * 0.14, p.tailLen * 0.16, p.tailLen * 0.3], [0, -p.tailLen * 0.05, -p.tailLen * 0.2], [0.9, 0, 0]);
    ell(tail, tm, [p.tailLen * 0.17, p.tailLen * 0.62, p.tailLen * 0.17], [0, -p.tailLen * 0.62, -p.tailLen * 0.42], [0.18, 0, 0]);
  } else if (p.tail === 'bushy') {
    ell(tail, fur, [p.tailLen * 0.22, p.tailLen * 0.22, p.tailLen * 0.55], [0, -p.tailLen * 0.15, -p.tailLen * 0.45], [0.5, 0, 0]);
    if (p.tailTip) ell(tail, light, [p.tailLen * 0.16, p.tailLen * 0.16, p.tailLen * 0.2], [0, -p.tailLen * 0.42, -p.tailLen * 0.9], [0.5, 0, 0], true);
  } else if (p.tail === 'croc') {
    const segs = 5;
    for (let i = 0; i < segs; i++) ell(tail, fur, [p.bodyW * (0.8 - i * 0.14), p.bodyH * (0.4 - i * 0.06), p.tailLen / segs * 0.75], [0, -p.bodyH * 0.1, -i * p.tailLen / segs - 0.1]);
  } else if (p.tail === 'thick') {
    ell(tail, fur, [p.tailLen * 0.12, p.tailLen * 0.1, p.tailLen * 0.5], [0, -p.tailLen * 0.12, -p.tailLen * 0.42], [0.25, 0, 0]);
  } else if (p.tail === 'stub') {
    ell(tail, fur, [0.05, 0.05, 0.07], [0, 0, -0.03], [0, 0, 0], true);
  } else {
    cyl(tail, fur, 0.012, 0.025, p.tailLen, [0, -p.tailLen * 0.4, -p.tailLen * 0.25], [0.6, 0, 0]);
    if (p.tail === 'tuft') ell(tail, dark, [0.05, 0.08, 0.05], [0, -p.tailLen * 0.85, -p.tailLen * 0.5], [0, 0, 0], true);
  }
  rig.tail = tail;
  rig.height = headY + p.headR + (p.ears === 'pointy' ? p.earSize : 0);
  rig.radius = Math.max(0.35, Math.min(0.9, p.len * 0.42));
  return rig;
}

// ----------------------------------------------------------------------------
const QUADS: Record<string, (c: SkinDef['colors'], pattern?: string) => QuadParams> = {
  fox: (c, pattern) => ({ len: 0.75, bodyH: 0.3, bodyW: 0.17, legLen: 0.32, legR: 0.035, headR: 0.15, snout: 0.17, snoutR: 0.06, ears: 'pointy', earSize: 0.15, tail: 'bushy', tailLen: 0.6, colors: c, pattern, socks: true, tailTip: true }),
  wolf: (c, pattern) => ({ len: 1.0, bodyH: 0.42, bodyW: 0.22, legLen: 0.5, legR: 0.05, headR: 0.19, snout: 0.2, snoutR: 0.08, ears: 'pointy', earSize: 0.14, tail: 'bushy', tailLen: 0.6, colors: c, pattern }),
  monkey: (c, pattern) => ({ len: 0.52, bodyH: 0.36, bodyW: 0.17, legLen: 0.3, legR: 0.04, headR: 0.17, snout: 0.07, snoutR: 0.08, ears: 'round', earSize: 0.09, tail: 'thin', tailLen: 0.75, colors: c, pattern, frontLegMult: 1.35, eyeSize: 1.5, faceMask: false, socks: true }),
  cat: (c, pattern) => ({ len: 0.7, bodyH: 0.32, bodyW: 0.17, legLen: 0.3, legR: 0.035, headR: 0.17, snout: 0.06, snoutR: 0.055, ears: 'pointy', earSize: 0.13, tail: 'thin', tailLen: 0.6, colors: c, pattern, eyeSize: 1.7, iris: 0x7ac040, slitPupil: true, whiskers: true }),
  dog: (c, pattern) => ({ len: 0.85, bodyH: 0.38, bodyW: 0.2, legLen: 0.4, legR: 0.045, headR: 0.18, snout: 0.16, snoutR: 0.07, ears: 'round', earSize: 0.13, tail: 'thin', tailLen: 0.4, colors: c, pattern, eyeSize: 1.4 }),
  horse: (c, pattern) => ({ len: 1.25, bodyH: 0.56, bodyW: 0.27, legLen: 0.8, legR: 0.05, headR: 0.17, snout: 0.2, snoutR: 0.08, ears: 'pointy', earSize: 0.1, tail: 'thin', tailLen: 0.75, colors: c, pattern, style: 'smooth', neckLen: 0.4, longHead: true, maneStrip: true, longTail: true, hooves: 0x2a2420, eyeSize: 1.3 }),
  unicorn: (c, pattern) => ({ len: 1.2, bodyH: 0.54, bodyW: 0.26, legLen: 0.78, legR: 0.048, headR: 0.17, snout: 0.2, snoutR: 0.08, ears: 'pointy', earSize: 0.1, tail: 'thin', tailLen: 0.75, colors: c, pattern, style: 'smooth', neckLen: 0.4, longHead: true, maneStrip: true, longTail: true, hooves: 0xe8c860, eyeSize: 1.5, iris: 0x8a5ad8, unicornHorn: true }),
  panda: (c) => ({ len: 1.05, bodyH: 0.62, bodyW: 0.38, legLen: 0.34, legR: 0.1, headR: 0.27, snout: 0.1, snoutR: 0.1, ears: 'round', earSize: 0.13, tail: 'stub', tailLen: 0.2, colors: c, style: 'fur', socks: true, panda: true, frontLegMult: 1.02, eyeSize: 1.1 }),
  tiger: (c, pattern) => ({ len: 1.25, bodyH: 0.48, bodyW: 0.27, legLen: 0.52, legR: 0.07, headR: 0.23, snout: 0.15, snoutR: 0.1, ears: 'round', earSize: 0.1, tail: 'thin', tailLen: 0.85, colors: c, pattern, whiskers: true, eyeSize: 1.2, iris: 0xd8a830 }),
  lion: (c, pattern) => ({ len: 1.25, bodyH: 0.5, bodyW: 0.28, legLen: 0.55, legR: 0.07, headR: 0.24, snout: 0.16, snoutR: 0.11, ears: 'round', earSize: 0.1, tail: 'tuft', tailLen: 0.8, mane: 1.6, colors: c, pattern }),
  badger: (c) => ({ len: 0.7, bodyH: 0.3, bodyW: 0.22, legLen: 0.17, legR: 0.04, headR: 0.13, snout: 0.12, snoutR: 0.05, ears: 'small', earSize: 0.06, tail: 'stub', tailLen: 0.2, colors: c, faceMask: true }),
  boar: (c) => ({ len: 1.0, bodyH: 0.5, bodyW: 0.26, legLen: 0.3, legR: 0.05, headR: 0.2, snout: 0.2, snoutR: 0.09, ears: 'pointy', earSize: 0.1, tail: 'thin', tailLen: 0.25, tusks: 0.07, colors: c, snoutDisc: true, frontLegMult: 1.1 }),
  warthog: (c) => ({ len: 0.95, bodyH: 0.45, bodyW: 0.24, legLen: 0.34, legR: 0.045, headR: 0.2, snout: 0.22, snoutR: 0.09, ears: 'small', earSize: 0.1, tail: 'tuft', tailLen: 0.3, tusks: 0.14, colors: c, snoutDisc: true }),
  hyena: (c) => ({ len: 0.95, bodyH: 0.42, bodyW: 0.22, legLen: 0.42, legR: 0.045, headR: 0.18, snout: 0.15, snoutR: 0.08, ears: 'round', earSize: 0.12, tail: 'thin', tailLen: 0.35, frontLegMult: 1.25, colors: c, pattern: 'spots' }),
  otter: (c, pattern) => ({ pattern, len: 0.8, bodyH: 0.24, bodyW: 0.15, legLen: 0.12, legR: 0.035, headR: 0.11, snout: 0.08, snoutR: 0.06, ears: 'small', earSize: 0.04, tail: 'thick', tailLen: 0.5, colors: c, style: 'smooth' }),
  crocodile: (c) => ({ len: 1.5, bodyH: 0.26, bodyW: 0.3, legLen: 0.16, legR: 0.05, headR: 0.15, snout: 0.5, snoutR: 0.1, ears: 'none', earSize: 0, tail: 'croc', tailLen: 1.4, colors: c, style: 'scale', sprawl: true, ridges: true, teeth: true }),
  bear: (c, pattern) => ({ pattern, len: 1.25, bodyH: 0.62, bodyW: 0.36, legLen: 0.42, legR: 0.09, headR: 0.24, snout: 0.16, snoutR: 0.1, ears: 'round', earSize: 0.11, tail: 'stub', tailLen: 0.2, colors: c, frontLegMult: 1.1 }),
  seal: (c) => ({ len: 1.2, bodyH: 0.42, bodyW: 0.3, legLen: 0.1, legR: 0.07, headR: 0.17, snout: 0.1, snoutR: 0.08, ears: 'none', earSize: 0, tail: 'thick', tailLen: 0.45, colors: c, style: 'smooth', sprawl: true, pattern: 'speckle' }),
  elephantSeal: (c) => ({ len: 1.8, bodyH: 0.62, bodyW: 0.42, legLen: 0.12, legR: 0.09, headR: 0.24, snout: 0.16, snoutR: 0.12, ears: 'none', earSize: 0, tail: 'thick', tailLen: 0.6, colors: c, style: 'smooth', sprawl: true, bigNose: true }),
  leopardSeal: (c) => ({ len: 1.7, bodyH: 0.46, bodyW: 0.33, legLen: 0.12, legR: 0.08, headR: 0.22, snout: 0.22, snoutR: 0.1, ears: 'none', earSize: 0, tail: 'thick', tailLen: 0.6, colors: c, style: 'smooth', sprawl: true, teeth: true, pattern: 'spots' }),
};

const OPP_COLORS: Record<OppSpecies, SkinDef['colors']> = {
  badger: { primary: 0x8d8a85, secondary: 0x45413e, accent: 0x161412 },
  fox: { primary: 0xc0602d, secondary: 0xefe6da, accent: 0x2a211d },
  boar: { primary: 0x4a3a2c, secondary: 0x5c4a3a, accent: 0x2a211b },
  wolf: { primary: 0x6f6b67, secondary: 0xcfc8bd, accent: 0x34302e },
  warthog: { primary: 0x7a6a5a, secondary: 0x8a7a68, accent: 0x3b2f25 },
  hyena: { primary: 0xb79d72, secondary: 0xd8c7a3, accent: 0x3b3027, extra: 0x4a3a2a },
  lion: { primary: 0xc39252, secondary: 0xe3cb9b, accent: 0x6e4220 },
  otter: { primary: 0x5b4130, secondary: 0x8e735d, accent: 0x2e2018 },
  crocodile: { primary: 0x4f5a34, secondary: 0x9a9a6a, accent: 0x343b22 },
  raptor: { primary: 0x8a6a3e, secondary: 0xd8c49a, accent: 0x5a4022 },
  trex: { primary: 0x5d6b3a, secondary: 0xb6ad84, accent: 0x46522b },
  bear: { primary: 0x5b3f2a, secondary: 0x6e5038, accent: 0x2e2018 },
  seal: { primary: 0x6f747a, secondary: 0xa9aeb2, accent: 0x3a3d40, extra: 0x4a4e52 },
  elephantSeal: { primary: 0x7a6656, secondary: 0x9a8676, accent: 0x4a3d33 },
  leopardSeal: { primary: 0x5a6068, secondary: 0xc9ccd0, accent: 0x2e3236, extra: 0x2a2d31 },
  bunny: { primary: 0x9a7552, secondary: 0xe9dccb, accent: 0xe8a3a8 },
  chicken: { primary: 0xf3eee2, secondary: 0xe6dccb, accent: 0xd8322a },
  penguin: { primary: 0x23262d, secondary: 0xf4f2ec, accent: 0xf2b134 },
  cat: { primary: 0x8a8a90, secondary: 0xf0f0f0, accent: 0xe8a0b0, extra: 0x4a4a52 },
  dog: { primary: 0xa8784a, secondary: 0xf0e0c8, accent: 0x2a2018 },
  horse: { primary: 0x6a4a30, secondary: 0xa88a6a, accent: 0x1e140c },
  panda: { primary: 0xf6f4f0, secondary: 0xffffff, accent: 0x1a1a1c },
  tiger: { primary: 0xe8822a, secondary: 0xfff2e0, accent: 0x2a1a10, extra: 0x1e140c },
  monkey: { primary: 0x7a5232, secondary: 0xe8c8a0, accent: 0x5a3a22 },
  human: { primary: 0x5a8ad8, secondary: 0x4a4a5a, accent: 0x5a3a22 },
};

/** girl = true makes a lion a lioness (no mane, like real ones). */
/** Play as a sea creature! On land it floats along inside a magic bubble. */
function buildSeaPlayer(species: Species, skin: SkinDef): AnimalRig {
  const kind: SeaSpecies = species === 'seaturtle' ? 'turtle' : species === 'whale' && skin.id === 'whale-narwhal' ? 'narwhal' : species as SeaSpecies;
  const sea = buildSeaCreature(kind);
  const size = ({ dolphin: 1.7, seaturtle: 1.15, octopus: 1.1, shark: 1.9, whale: 2.8 } as Record<string, number>)[species] ?? 1.5;
  sea.root.scale.setScalar(size);
  // re-colour it to match the skin (body colours only; eyes and bellies stay)
  sea.root.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (!m || !m.color) return;
    const hsl = { h: 0, s: 0, l: 0 }; m.color.getHSL(hsl);
    if (hsl.l > 0.85 || hsl.l < 0.1) { if (skin.id === 'whale-orca' && hsl.l > 0.85) return; return; }
    o instanceof THREE.Mesh && (o.material = m.clone());
    (((o as THREE.Mesh).material) as THREE.MeshStandardMaterial).color.setHex(skin.colors.primary);
  });
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const lift = species === 'octopus' ? 0.75 : species === 'seaturtle' ? 0.6 : size * 0.32 + 0.25;
  sea.root.position.y = lift; body.add(sea.root);
  // a head point near the front (for hats!)
  const head = new THREE.Group(); head.position.set(0, lift + (species === 'octopus' ? 0.45 : size * 0.12), species === 'octopus' ? 0.05 : size * 0.32); body.add(head);
  const hm = new THREE.Mesh(new THREE.SphereGeometry(size * 0.12, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); head.add(hm);
  // the magic bubble (shown on land)
  const bub = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.8, size * 0.62), 24, 16), new THREE.MeshStandardMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.2, depthWrite: false, emissive: 0x6ac8ff, emissiveIntensity: 0.15 }));
  bub.name = 'bubble'; bub.position.y = lift; bub.renderOrder = 4; body.add(bub);
  const mats: THREE.MeshStandardMaterial[] = [];
  root.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial; if (m && (m as THREE.MeshStandardMaterial).isMeshStandardMaterial && o !== bub) mats.push(m); });
  const rig: AnimalRig = { root, body, head, legs: [], ears: [], wings: [], kind: 'sea', height: lift + size * 0.35, radius: Math.min(0.9, size * 0.35), materials: mats, headBase: new THREE.Vector3(), phase: Math.random() * 10, eyes: [], idleT: 0, blinkAt: 99 };
  rig.root.userData.sea = sea;
  return rig;
}

export function buildPlayerAnimal(species: Species, skin: SkinDef, girl = false): AnimalRig {
  let rig: AnimalRig;
  if (SEA_PLAYERS.includes(species)) rig = buildSeaPlayer(species, skin);
  else if (species === 'chicken') rig = buildChicken(skin.colors, skin.pattern);
  else if (species === 'penguin') rig = buildPenguin(skin.colors);
  else if (species === 'bunny') rig = buildBunny(skin.colors, skin.pattern);
  else if (species === 'human') rig = buildHuman(skin.colors, girl);
  else {
    const q = QUADS[species](skin.colors, skin.pattern);
    if (girl && q.mane) { q.mane = 0; q.headR *= 0.92; }
    rig = buildQuad(q);
  }
  finishRig(rig);
  return rig;
}

/** Two-legged dinosaurs (raptor and T. rex). Built at raptor size, then scaled. */
function buildDino(kind: 'raptor' | 'trex'): AnimalRig {
  const b = new Builder();
  const rig = newRig('quad', b);
  const trex = kind === 'trex';
  const skin = trex ? b.mat(0x5d6b3a, 'scale', { pattern: 'stripes', patternColor: 0x46522b }) : b.mat(0x8a6a3e, 'scale', { pattern: 'stripes', patternColor: 0x5a4022 });
  const belly = b.mat(trex ? 0xb6ad84 : 0xd8c49a, 'scale');
  const mouth = b.plain(0x7a2a2a, 0.6);
  const tooth = b.plain(0xf4efe0, 0.4);
  const B = rig.body;
  const hipY = 0.85;
  // body leans forward, balanced by the tail
  ell(B, skin, [0.26, 0.3, 0.62], [0, hipY + 0.15, 0.05], [-0.12, 0, 0]);
  ell(B, belly, [0.2, 0.2, 0.45], [0, hipY + 0.02, 0.12], [-0.12, 0, 0]);
  ell(B, skin, [0.14, 0.15, 0.32], [0, hipY + 0.42, 0.55], [-0.75, 0, 0]); // neck
  const head = pivot(B, [0, hipY + 0.62, 0.78]);
  ell(head, skin, [0.13, 0.13, 0.3], [0, 0.03, 0.12]);
  ell(head, belly, [0.11, 0.06, 0.26], [0, -0.08, 0.13]); // lower jaw
  ell(head, mouth, [0.1, 0.02, 0.24], [0, -0.03, 0.14], [0, 0, 0], true);
  for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) cone(head, tooth, 0.012, 0.05, [sx * 0.085, -0.03, 0.02 + i * 0.065], [Math.PI, 0, 0], 4);
  eyes(b, head, 0.1, 0.1, 0.04, 0.025);
  rig.head = head;
  // tiny arms
  for (const sx of [-1, 1]) {
    const arm = pivot(B, [sx * 0.2, hipY + 0.2, 0.45]);
    ell(arm, skin, [0.035, 0.12, 0.035], [0, -0.08, 0.04], [0.6, 0, 0], true);
  }
  // strong legs
  for (const sx of [-1, 1]) {
    const p = pivot(B, [sx * 0.2, hipY + 0.05, -0.05]);
    ell(p, skin, [0.12, 0.28, 0.17], [0, -0.15, 0.02]);
    cyl(p, skin, 0.05, 0.04, 0.5, [0, -0.55, -0.06], [0.3, 0, 0]);
    ell(p, belly, [0.08, 0.04, 0.17], [0, -0.82, 0.06], [0, 0, 0], true);
    if (!trex) cone(p, tooth, 0.025, 0.12, [0, -0.78, 0.2], [Math.PI / 2, 0, 0], 5); // raptor claw
    rig.legs.push({ pivot: p, phase: sx > 0 ? 0 : Math.PI, front: false });
  }
  // long tail
  const tail = pivot(B, [0, hipY + 0.2, -0.55]);
  for (let i = 0; i < 5; i++) ell(tail, skin, [0.17 - i * 0.03, 0.17 - i * 0.03, 0.22], [0, -i * 0.03, -i * 0.3], [0.1, 0, 0]);
  rig.tail = tail;
  if (!trex) for (let i = 0; i < 7; i++) cone(B, b.plain(0x3a6a8a, 0.8), 0.04, 0.16, [0, hipY + 0.45 - i * 0.02, 0.3 - i * 0.14], [-0.4, 0, 0], 4); // feathery crest
  rig.height = hipY + 0.8; rig.radius = 0.5;
  return rig;
}

/** female = true: a lioness has no mane. */
export function buildOpponent(species: OppSpecies, scale = 1, female = false): AnimalRig {
  if (species === 'raptor' || species === 'trex') {
    const s = (species === 'trex' ? 2.7 : 1.15) * scale;
    const rig = buildDino(species);
    rig.root.scale.setScalar(s);
    rig.height *= s; rig.radius *= s;
    finishRig(rig);
    // glowing yellow eyes so you can spot them in the dark
    const glow = new THREE.MeshStandardMaterial({ color: 0xffe14a, emissive: 0xffc800, emissiveIntensity: 2 });
    for (const e of rig.eyes) (e as THREE.Mesh).material = glow;
    return rig;
  }
  if (species === 'human') {
    const rig = buildHuman(OPP_COLORS.human, female);
    rig.root.scale.setScalar(scale); rig.height *= scale; rig.radius *= scale;
    finishRig(rig);
    return rig;
  }
  if (species === 'bunny' || species === 'chicken' || species === 'penguin') {
    const c = OPP_COLORS[species];
    const rig = species === 'bunny' ? buildBunny(c) : species === 'chicken' ? buildChicken(c) : buildPenguin(c);
    rig.root.scale.setScalar(scale); rig.height *= scale; rig.radius *= scale;
    finishRig(rig);
    return rig;
  }
  const pat: Partial<Record<OppSpecies, string>> = { cat: 'stripes', tiger: 'stripes' };
  const q = QUADS[species](OPP_COLORS[species], pat[species]);
  if (female && q.mane) { q.mane = 0; q.headR *= 0.9; q.len *= 0.94; }   // lionesses: smaller, sleeker, and no mane
  const rig = buildQuad(q);
  rig.root.scale.setScalar(scale);
  rig.height *= scale; rig.radius *= scale;
  finishRig(rig);
  return rig;
}

function finishRig(rig: AnimalRig) {
  rig.headBase.copy(rig.head.position);
  rig.root.traverse((o) => { if (o.name === 'eye') rig.eyes.push(o); });
  for (const e of rig.eyes) e.userData.sy = e.scale.y;
  rig.root.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = false; } });
}

// ----------------------------------------------------------------------------
// Animation
// ----------------------------------------------------------------------------
export function animateRig(rig: AnimalRig, dt: number, s: AnimState) {
  const moving = Math.min(1, s.speed / 3);
  rig.phase += dt * (4 + s.speed * 1.6);
  const ph = rig.phase;
  const B = rig.body;
  B.position.set(0, 0, 0);
  B.rotation.set(0, 0, 0);
  B.scale.set(1, 1, 1);
  rig.head.position.copy(rig.headBase);
  rig.head.rotation.set(0, 0, 0);

  if (rig.kind === 'sea') {
    const sea = rig.root.userData.sea as SeaRig | undefined;
    if (sea) animateSea(sea, rig.phase * 0.35, 1 + moving);
    B.position.y = Math.sin(rig.phase * 0.25) * 0.08;
    B.rotation.z = Math.sin(rig.phase * 0.5) * 0.05 * moving;
    return;
  }
  if (rig.kind === 'quad') {
    for (const l of rig.legs) l.pivot.rotation.x = s.airborne ? (l.front ? -0.6 : 0.6) : Math.sin(ph + l.phase) * 0.6 * moving;
    B.position.y = Math.abs(Math.sin(ph)) * 0.03 * moving;
    if (rig.tail) { rig.tail.rotation.y = Math.sin(ph * 0.5) * 0.3; rig.tail.rotation.x = -0.1 * moving; }
    for (const e of rig.ears) e.rotation.x = Math.sin(ph * 0.3) * 0.05;
  } else if (rig.kind === 'chicken') {
    for (const l of rig.legs) l.pivot.rotation.x = s.airborne ? 0.5 : Math.sin(ph + l.phase) * 0.7 * moving;
    B.position.y = Math.abs(Math.sin(ph)) * 0.04 * moving;
    rig.head.position.z += Math.sin(ph * 2) * 0.03 * moving;
    const flap = s.airborne ? Math.sin(ph * 6) * 0.9 : 0;
    rig.wings.forEach((w, i) => (w.rotation.z = (i ? -1 : 1) * Math.max(0, flap)));
  } else if (rig.kind === 'penguin') {
    for (const l of rig.legs) l.pivot.rotation.x = Math.sin(ph + l.phase) * 0.4 * moving;
    B.rotation.z = Math.sin(ph) * 0.14 * moving;     // waddle
    B.position.y = Math.abs(Math.sin(ph)) * 0.025 * moving;
    rig.wings.forEach((w, i) => (w.rotation.z = (i ? -1 : 1) * (0.15 + (s.airborne ? 0.8 : 0.12 * moving))));
  } else if (rig.kind === 'human') {
    for (const l of rig.legs) l.pivot.rotation.x = s.airborne ? (l.phase ? 0.5 : -0.3) : Math.sin(ph + l.phase) * 0.7 * moving;
    rig.wings.forEach((a, i) => { a.rotation.x = s.airborne ? -2.4 : -Math.sin(ph + (i ? 0 : Math.PI)) * 0.6 * moving; a.rotation.z = (i ? 1 : -1) * 0.08; });
    B.position.y = Math.abs(Math.sin(ph)) * 0.04 * moving;
  } else if (rig.kind === 'bunny') {
    const hop = Math.max(0, Math.sin(ph * 0.8));
    B.position.y = hop * 0.12 * moving;
    B.rotation.x = -Math.cos(ph * 0.8) * 0.15 * moving;
    for (const l of rig.legs) l.pivot.rotation.x = (l.front ? -1 : 1) * hop * 0.6 * moving + (s.airborne ? (l.front ? -0.4 : 0.6) : 0);
    rig.ears.forEach((e, i) => (e.rotation.x = -0.25 - moving * 0.3 + Math.sin(ph + i) * 0.05));
  }

  // idle life: breathing, looking around, blinking
  rig.idleT += dt;
  const still = 1 - moving;
  B.scale.y = 1 + Math.sin(rig.idleT * 2.2) * 0.015 * still;
  if (still > 0.5 && !s.attack) {
    rig.head.rotation.y = Math.sin(rig.idleT * 0.45) * 0.45 * still * (Math.sin(rig.idleT * 0.13) > 0 ? 1 : 0.3);
    rig.head.rotation.x = Math.sin(rig.idleT * 0.31) * 0.08 * still;
    if (rig.tail) rig.tail.rotation.y = Math.sin(rig.idleT * 1.6) * 0.35;
  }
  const blink = rig.idleT > rig.blinkAt && rig.idleT < rig.blinkAt + 0.13;
  if (rig.idleT > rig.blinkAt + 0.13) rig.blinkAt = rig.idleT + 2.5 + Math.random() * 3.5;
  for (const e of rig.eyes) e.scale.y = blink ? (e.userData.sy as number) * 0.12 : (e.userData.sy as number);

  // telegraph crouch (opponents)
  if (s.windup > 0) {
    B.position.y -= 0.08 * s.windup;
    B.position.z -= 0.15 * s.windup;
    B.rotation.x = 0.12 * s.windup;
    rig.head.rotation.x = 0.2 * s.windup;
  }

  // attacks
  if (s.attack) {
    const t = s.attackT;
    const k = Math.sin(Math.min(1, t) * Math.PI);
    if (s.attack === 'bite') {
      rig.head.position.z += 0.18 * k * (rig.kind === 'quad' ? 1.4 : 1);
      rig.head.position.y -= (rig.kind === 'chicken' ? 0.15 : 0.04) * k;
      rig.head.rotation.x = (rig.kind === 'chicken' || rig.kind === 'penguin' ? 0.8 : 0.3) * k;
      B.position.z += 0.08 * k;
    } else if (s.attack === 'scratch') {
      if (rig.kind === 'penguin') {
        rig.wings[1].rotation.z = -0.15 - 1.5 * k; // flipper slap
        rig.wings[1].rotation.x = -0.6 * k;
      } else {
        const leg = rig.legs[0];
        leg.pivot.rotation.x = -1.4 * k;           // front paw / foot swipe
        leg.pivot.rotation.z = 0.4 * k;
      }
      B.rotation.y = 0.15 * k;
    } else if (s.attack === 'special') {
      B.rotation.x = -0.5 * k;
      for (const l of rig.legs) l.pivot.rotation.x = (l.front ? -1.1 : 0.8) * k;
      rig.wings.forEach((w, i) => (w.rotation.z = (i ? -1 : 1) * 1.2 * k));
      rig.head.position.z += 0.1 * k;
    }
  }
}

/** Set emissive glow on a rig (special-ready aura, hit flash). */
export function setRigGlow(rig: AnimalRig, color: number, intensity: number) {
  for (const m of rig.materials) {
    m.emissive.setHex(color);
    m.emissiveIntensity = intensity;
  }
}

export function disposeRig(rig: AnimalRig) {
  rig.root.removeFromParent();
  rig.root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.geometry !== SPHERE && m.geometry !== SPHERE_LO) m.geometry.dispose();
  });
  for (const m of rig.materials) m.dispose();
}

// ----------------------------------------------------------------------------
// Farm animals to rescue from the barn (baby animals)
// ----------------------------------------------------------------------------
export type FarmKind = 'piglet' | 'lamb' | 'calf' | 'goat' | 'chick' | 'duckling' | 'puppy' | 'kitten' | 'pony' | 'bunny' | 'alpaca';
export function buildFarmAnimal(kind: FarmKind): AnimalRig {
  let rig: AnimalRig;
  if (kind === 'chick') {
    rig = buildChicken({ primary: 0xf6d84a, secondary: 0xf2c93a, accent: 0xf0a030 });
    rig.root.scale.setScalar(0.6); rig.height *= 0.6; rig.radius *= 0.6;
  } else if (kind === 'duckling') {
    rig = buildPenguin({ primary: 0xf5d54a, secondary: 0xfbe68a, accent: 0xf08a24 });
    rig.root.scale.setScalar(0.5); rig.height *= 0.5; rig.radius *= 0.5;
  } else if (kind === 'bunny') {
    rig = buildBunny({ primary: 0xe8ddd0, secondary: 0xfaf6f0, accent: 0xf2a6b6 });
    rig.root.scale.setScalar(0.7); rig.height *= 0.7; rig.radius *= 0.7;
  } else {
    const P: Record<Exclude<FarmKind, 'chick' | 'duckling' | 'bunny'>, QuadParams> = {
      piglet: { eyeSize: 1.3, len: 0.6, bodyH: 0.34, bodyW: 0.2, legLen: 0.16, legR: 0.035, headR: 0.14, snout: 0.08, snoutR: 0.06, ears: 'pointy', earSize: 0.08, tail: 'thin', tailLen: 0.12, colors: { primary: 0xf2b6b0, secondary: 0xf5c4bf, accent: 0xd8908a }, style: 'smooth', snoutDisc: true },
      lamb: { eyeSize: 1.4, hooves: 0x2a2624, len: 0.6, bodyH: 0.36, bodyW: 0.2, legLen: 0.3, legR: 0.03, headR: 0.12, snout: 0.1, snoutR: 0.05, ears: 'small', earSize: 0.08, tail: 'stub', tailLen: 0.1, colors: { primary: 0xf4f1ea, secondary: 0xf8f6f0, accent: 0x2a2624 }, faceMask: false, socks: true },
      calf: { eyeSize: 1.4, hooves: 0x2a2624, len: 0.8, bodyH: 0.42, bodyW: 0.22, legLen: 0.42, legR: 0.04, headR: 0.15, snout: 0.12, snoutR: 0.08, ears: 'small', earSize: 0.1, tail: 'tuft', tailLen: 0.35, colors: { primary: 0xf4f2ee, secondary: 0xf8f6f2, accent: 0x222222, extra: 0x1e1e1e }, pattern: 'patches', style: 'smooth' },
      puppy: { eyeSize: 1.6, len: 0.55, bodyH: 0.3, bodyW: 0.17, legLen: 0.22, legR: 0.04, headR: 0.16, snout: 0.1, snoutR: 0.06, ears: 'round', earSize: 0.11, tail: 'thin', tailLen: 0.2, colors: { primary: 0xc98a4b, secondary: 0xf2e2c8, accent: 0x3a2a20 }, socks: true },
      kitten: { len: 0.5, bodyH: 0.26, bodyW: 0.14, legLen: 0.2, legR: 0.03, headR: 0.15, snout: 0.05, snoutR: 0.05, ears: 'pointy', earSize: 0.11, tail: 'thin', tailLen: 0.38, colors: { primary: 0xa9a9b0, secondary: 0xf4f4f4, accent: 0xe8a0b0, extra: 0x6a6a72 }, pattern: 'stripes', eyeSize: 1.9, iris: 0x7ac040, slitPupil: true, whiskers: true },
      pony: { len: 1.0, bodyH: 0.46, bodyW: 0.22, legLen: 0.62, legR: 0.042, headR: 0.15, snout: 0.2, snoutR: 0.08, ears: 'pointy', earSize: 0.09, tail: 'thin', tailLen: 0.6, colors: { primary: 0x8a5a3a, secondary: 0xc8a080, accent: 0x3a2618 }, style: 'smooth', neckLen: 0.3, longHead: true, maneStrip: true, longTail: true, hooves: 0x2a2420, eyeSize: 1.3 },
      alpaca: { eyeSize: 1.6, neckLen: 0.22, len: 0.7, bodyH: 0.46, bodyW: 0.22, legLen: 0.42, legR: 0.04, headR: 0.14, snout: 0.09, snoutR: 0.06, ears: 'pointy', earSize: 0.11, tail: 'stub', tailLen: 0.12, mane: 0.7, colors: { primary: 0xf3e6cf, secondary: 0xfaf2e2, accent: 0x6a5040 } },
      goat: { len: 0.62, bodyH: 0.34, bodyW: 0.17, legLen: 0.34, legR: 0.03, headR: 0.12, snout: 0.12, snoutR: 0.05, ears: 'pointy', earSize: 0.09, tail: 'stub', tailLen: 0.1, colors: { primary: 0xc9b49a, secondary: 0xe8dcc8, accent: 0x5a4a3a }, beard: true, horns: 0.07, hooves: 0x3a302a, eyeSize: 1.3, iris: 0xd8a830 },
    };
    rig = buildQuad(P[kind]);
  }
  finishRig(rig);
  return rig;
}

/** A pink bow that sits on top of an animal's head (moves with the head). */
export function addBow(rig: AnimalRig, color = 0xe8508a) {
  rig.root.updateMatrixWorld(true);
  // top of the head itself (not the ears)
  const box = new THREE.Box3();
  for (const c of rig.head.children) if ((c as THREE.Mesh).isMesh) box.expandByObject(c);
  if (box.isEmpty()) box.setFromObject(rig.head);
  const headWorld = new THREE.Vector3(); rig.head.getWorldPosition(headWorld);
  const s = rig.root.scale.x || 1;
  const top = (box.max.y - headWorld.y) / s;
  const size = Math.max(0.05, (box.max.x - box.min.x) / s * 0.35);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.45 });
  rig.materials.push(mat);
  const bow = new THREE.Group(); bow.name = 'bow';
  bow.position.set(0, top * 0.92, -size * 0.2);
  for (const sx of [-1, 1]) {
    const loop = new THREE.Mesh(new THREE.ConeGeometry(size * 0.6, size * 1.3, 10), mat);
    loop.rotation.z = sx * Math.PI / 2; loop.position.x = sx * size * 0.62; loop.scale.set(1, 1, 0.55); loop.castShadow = true;
    bow.add(loop);
  }
  const knot = new THREE.Mesh(new THREE.SphereGeometry(size * 0.32, 10, 8), mat); bow.add(knot);
  rig.head.add(bow);
}

/** Lie down to sleep (call every frame after animateRig while asleep): eyes closed, curled up on the bed. */
export function sleepPose(rig: AnimalRig, t: number) {
  const B = rig.body, h = rig.height;
  const breathe = Math.sin(t * 1.6) * 0.015;
  if (rig.kind === 'quad') {
    // roll over onto one side, legs out, like a sleeping dog or lion
    const roll = 1.25, c = h * 0.42;
    B.rotation.z = roll;
    B.position.x = c * Math.sin(roll);
    B.position.y = h * 0.22 - c * Math.cos(roll) + breathe;
    rig.head.rotation.z = -0.35;
    for (const l of rig.legs) l.pivot.rotation.x = l.front ? 0.5 : -0.4;
  } else if (rig.kind === 'penguin') {
    // flat on the tummy
    B.rotation.x = 1.35;
    B.position.z = -h * 0.35;
    B.position.y = h * 0.2 + breathe;
  } else {
    // chickens and bunnies snuggle down into a cosy ball
    B.position.y = -h * 0.2 + breathe;
    B.scale.set(1.08, 0.92, 1.05);
    rig.head.rotation.x = 0.35;
  }
  for (const e of rig.eyes) e.scale.y = (e.userData.sy ?? 1) * 0.12;
}
