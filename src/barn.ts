// Inside the Red Barn: baby farm animals locked in pens, waiting to be rescued.
import * as THREE from 'three';
import { CollisionWorld, Collider } from './terrain';
import { plankTexture } from './textures';
import { AnimalRig, FarmKind, buildFarmAnimal, animateRig } from './animals';

export const BARN_ROOM = { x: 200, z: -400, w: 15, d: 12 };
const WALL_H = 5;

export const FARM_ANIMALS: { kind: FarmKind; name: string; emoji: string }[] = [
  { kind: 'piglet', name: 'Piglet', emoji: '🐷' },
  { kind: 'lamb', name: 'Lamb', emoji: '🐑' },
  { kind: 'calf', name: 'Calf', emoji: '🐮' },
  { kind: 'goat', name: 'Baby Goat', emoji: '🐐' },
  { kind: 'chick', name: 'Chick', emoji: '🐤' },
  { kind: 'duckling', name: 'Duckling', emoji: '🦆' },
  { kind: 'puppy', name: 'Puppy', emoji: '🐶' },
  { kind: 'kitten', name: 'Kitten', emoji: '🐱' },
  { kind: 'pony', name: 'Pony', emoji: '🐴' },
  { kind: 'bunny', name: 'Baby Bunny', emoji: '🐰' },
  { kind: 'alpaca', name: 'Baby Alpaca', emoji: '🦙' },
];
/** Pick a baby animal that isn't already in another pen (and wasn't just rescued). */
export function pickNewAnimal(avoid: FarmKind[]) {
  const fresh = FARM_ANIMALS.filter((a) => !avoid.includes(a.kind));
  const list = fresh.length ? fresh : FARM_ANIMALS;
  return list[Math.floor(Math.random() * list.length)];
}
const PENS = 5;

export interface Pen {
  kind: FarmKind; name: string; emoji: string;
  x: number; z: number;            // where you stand to open the gate
  gate: THREE.Object3D; gateDir: number;
  rig: AnimalRig | null;
  open: boolean;
  leaving: number;                 // >0 while the rescued animal hops away
  lock: number;                    // 0..100 lock-breaking progress
  lockStart: number | null;        // when you started making noise
  refillAt: number;                // a new animal arrives at this time
}

export class Barn {
  group = new THREE.Group();
  door!: THREE.Object3D;
  pens: Pen[] = [];
  southZ = BARN_ROOM.z + BARN_ROOM.d / 2;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number; maxY: number };
  private doorCollider: Collider | null = null;

  constructor(scene: THREE.Scene, private collision: CollisionWorld, rescued: string[]) {
    scene.add(this.group);
    const { x: cx, z: cz, w, d } = BARN_ROOM;
    const N = cz - d / 2, S = cz + d / 2, W = cx - w / 2, E = cx + w / 2;
    this.bounds = { minX: W + 0.35, maxX: E - 0.35, minZ: N + 0.35, maxZ: S - 0.35, maxY: WALL_H - 0.4 };
    const m = (c: number, map: THREE.Texture | null = null, rough = 0.9) => new THREE.MeshStandardMaterial({ color: c, map, roughness: rough });
    const box = (parent: THREE.Object3D, mat: THREE.Material, bw: number, bh: number, bd: number, x: number, y: number, z: number, shadow = true) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), mat); b.position.set(x, y, z);
      b.castShadow = shadow; b.receiveShadow = true; parent.add(b); return b;
    };
    const solid = (minX: number, maxX: number, minZ: number, maxZ: number, top = 100) =>
      this.collision.add({ kind: 'box', minX, maxX, minZ, maxZ, top, tall: top >= 100 });
    // straw floor, red plank walls, rafters
    const floorTex = plankTexture(0xc9a85a, true); floorTex.repeat.set(w / 3, d / 3);
    box(this.group, m(0xffffff, floorTex), w, 0.1, d, cx, -0.05, cz, false);
    const wall = m(0xffffff, plankTexture(0x8a2a22, false));
    box(this.group, wall, w + 0.4, WALL_H, 0.2, cx, WALL_H / 2, N - 0.1, false);
    box(this.group, wall, 0.2, WALL_H, d + 0.4, W - 0.1, WALL_H / 2, cz, false);
    box(this.group, wall, 0.2, WALL_H, d + 0.4, E + 0.1, WALL_H / 2, cz, false);
    const side = (w - 2.4) / 2;
    box(this.group, wall, side, WALL_H, 0.2, W + side / 2, WALL_H / 2, S + 0.1, false);
    box(this.group, wall, side, WALL_H, 0.2, E - side / 2, WALL_H / 2, S + 0.1, false);
    box(this.group, wall, 2.4, WALL_H - 3, 0.2, cx, 3 + (WALL_H - 3) / 2, S + 0.1, false);
    const beam = m(0x5a3a22);
    for (let i = -2; i <= 2; i++) box(this.group, beam, 0.25, 0.3, d, cx + i * 3, WALL_H - 0.3, cz, false);
    solid(W - 1, E + 1, N - 1, N); solid(W - 1, W, N - 1, S + 1); solid(E, E + 1, N - 1, S + 1);
    solid(W - 1, cx - 1.2, S, S + 1); solid(cx + 1.2, E + 1, S, S + 1);
    // the barn door (inside view)
    const doorPivot = new THREE.Group(); doorPivot.position.set(cx - 1.2, 0, S + 0.05); this.group.add(doorPivot);
    box(doorPivot, m(0xffffff, plankTexture(0x8a2620, false)), 2.4, 3, 0.1, 1.2, 1.5, 0);
    this.door = doorPivot;
    // hay bales and a pitchfork-free corner
    const hay = m(0xd9b45a, null, 1);
    for (const [hx, hz] of [[E - 1.2, S - 1.5], [E - 1.2, S - 3.0], [E - 2.7, S - 1.5]] as [number, number][]) {
      const h = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 1.3, 16), hay); h.rotation.z = Math.PI / 2; h.position.set(hx, 0.65, hz); h.castShadow = true; this.group.add(h);
      solid(hx - 0.65, hx + 0.65, hz - 0.65, hz + 0.65, 1.3);
    }
    // warm lantern light + daylight through a window
    const lamp = new THREE.PointLight(0xffd28a, 22, 26, 1.3); lamp.position.set(cx, WALL_H - 1, cz); this.group.add(lamp);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8), new THREE.MeshStandardMaterial({ color: 0xffe6a8, emissive: 0xffb84d, emissiveIntensity: 1.5 }));
    bulb.position.copy(lamp.position); this.group.add(bulb);
    const glass = new THREE.MeshStandardMaterial({ color: 0xbfe3ff, emissive: 0x9fd0ff, emissiveIntensity: 0.5 });
    box(this.group, glass, 0.05, 1.2, 1.6, E - 0.01, 2.8, cz - 2, false);

    // pens: three along the north wall, two along the west wall
    const fence = m(0xffffff, plankTexture(0x9b7048, true));
    const spots: { px: number; pz: number; face: 'south' | 'east' }[] = [
      { px: cx - 4.5, pz: N + 1.4, face: 'south' }, { px: cx, pz: N + 1.4, face: 'south' }, { px: cx + 4.5, pz: N + 1.4, face: 'south' },
      { px: W + 1.4, pz: cz + 0.2, face: 'east' }, { px: W + 1.4, pz: cz + 3.4, face: 'east' },
    ];
    // a random mix of 5 different babies each time
    const start = [...FARM_ANIMALS].sort(() => Math.random() - 0.5).slice(0, PENS);
    start.forEach((a, i) => {
      const sp = spots[i];
      const pen = new THREE.Group(); pen.position.set(sp.px, 0, sp.pz);
      if (sp.face === 'east') pen.rotation.y = Math.PI / 2;
      this.group.add(pen);
      // side fences + gate (local: pen opens toward +z)
      for (const sx of [-1.4, 1.4]) { box(pen, fence, 0.1, 1.1, 2.6, sx, 0.55, 0); }
      const gate = new THREE.Group(); gate.position.set(-1.4, 0, 1.3); pen.add(gate);
      for (const y of [0.3, 0.65, 1.0]) box(gate, fence, 2.8, 0.14, 0.08, 1.4, y, 0);
      for (const gx of [0.2, 1.4, 2.6]) box(gate, fence, 0.1, 1.1, 0.1, gx, 0.55, 0);
      const lock = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.12), m(0xc8a03a, null, 0.3)); lock.position.set(2.6, 0.7, 0.1); lock.name = 'lock'; gate.add(lock);
      // straw bed + the animal
      const straw = new THREE.Mesh(new THREE.CircleGeometry(1.0, 16), m(0xe0c070, null, 1)); straw.rotation.x = -Math.PI / 2; straw.position.y = 0.01; pen.add(straw);
      const done = false; void rescued;
      let rig: AnimalRig | null = null;
      if (!done) {
        rig = buildFarmAnimal(a.kind);
        rig.root.position.set(0, 0, -0.1); rig.root.rotation.y = 0;
        pen.add(rig.root);
      }
      if (done) gate.rotation.y = -1.6;
      // collider over the whole pen (you open it from the front)
      if (sp.face === 'south') solid(sp.px - 1.5, sp.px + 1.5, sp.pz - 1.4, sp.pz + 1.35);
      else solid(sp.px - 1.4, sp.px + 1.35, sp.pz - 1.5, sp.pz + 1.5);
      const front = sp.face === 'south' ? { x: sp.px, z: sp.pz + 2.2 } : { x: sp.px + 2.2, z: sp.pz };
      this.pens.push({ kind: a.kind, name: a.name, emoji: a.emoji, x: front.x, z: front.z, gate, gateDir: -1.6, rig, open: done, leaving: 0, lock: 0, lockStart: null, refillAt: 0 });
    });
    this.setDoor(false);
    this.group.visible = false;
  }

  get spawnInside() { return { x: BARN_ROOM.x, z: this.southZ - 2.6 }; }
  get doorInside() { return { x: BARN_ROOM.x, z: this.southZ - 0.9 }; }

  setDoor(open: boolean) {
    this.door.rotation.y = open ? 1.45 : 0;
    if (!open && !this.doorCollider) this.doorCollider = this.collision.add({ kind: 'box', minX: BARN_ROOM.x - 1.2, maxX: BARN_ROOM.x + 1.2, minZ: this.southZ, maxZ: this.southZ + 0.6, top: 100, tall: true });
    if (open && this.doorCollider) { this.collision.remove(this.doorCollider); this.doorCollider = null; }
  }

  /** Put every animal back in its pen (used by Reset Save). */
  reset() {
    for (const p of this.pens) {
      p.open = false; p.leaving = 0; p.gate.rotation.y = 0; p.lock = 0; p.lockStart = null;
      if (!p.rig) { p.rig = buildFarmAnimal(p.kind); p.rig.root.position.set(0, 0, -0.1); p.gate.parent!.add(p.rig.root); }
    }
  }

  /** Open a pen: the gate swings and the animal hops away to your home. */
  openPen(p: Pen) {
    if (p.open) return false;
    p.open = true;
    p.leaving = 1.6;
    return true;
  }

  update(dt: number, t: number) {
    for (const p of this.pens) {
      const target = p.open ? p.gateDir : 0;
      p.gate.rotation.y += (target - p.gate.rotation.y) * Math.min(1, dt * 5);
      if (!p.rig) {
        // a new baby animal is brought to the empty pen
        if (p.open && p.refillAt > 0 && t >= p.refillAt) {
          const a = pickNewAnimal([p.kind, ...this.pens.filter((q) => q !== p && q.rig).map((q) => q.kind)]);
          p.kind = a.kind; p.name = a.name; p.emoji = a.emoji;
          p.rig = buildFarmAnimal(a.kind); p.rig.root.position.set(0, 0, -0.1);
          p.gate.parent!.add(p.rig.root);
          p.open = false; p.lock = 0; p.lockStart = null;
        }
        continue;
      }
      if (p.leaving > 0) {
        // happy hops out of the pen, then gone
        p.leaving -= dt;
        p.rig.root.position.z += dt * 2.2;
        p.rig.root.position.y = Math.abs(Math.sin(t * 9)) * 0.35;
        animateRig(p.rig, dt, { speed: 3, airborne: false, attack: null, attackT: 0, windup: 0 });
        if (p.leaving <= 0) { p.rig.root.removeFromParent(); p.rig = null; p.refillAt = t + 40; }
      } else {
        // sad little shuffle while locked in
        animateRig(p.rig, dt, { speed: Math.sin(t * 0.7 + p.x) > 0.6 ? 0.8 : 0, airborne: false, attack: null, attackT: 0, windup: 0 });
      }
    }
  }
}
