import { dressRig, dressBody } from './outfits';
// The Magic Zoo: from outside it's a tiny sparkly hut next to your house… but step inside and it's
// a HUGE zoo, with big glass habitats where all your pets live (bigger on the inside!).
import * as THREE from 'three';
import { CollisionWorld, terrainHeight } from './terrain';
import { AnimalRig, buildOpponent, animateRig, disposeRig } from './animals';
import { OppSpecies } from './config';

export const ZOO_HUT = { x: -12, z: -7, facing: 0 };        // the tiny hut in your home clearing (door faces +z)
export const ZOO = { x: 0, z: -1200, halfW: 34, halfD: 78 };   // the huge zoo inside
export const ZOO_SLOTS = 20;                                    // 20 glass habitats: room for 20 pets

type Habitat = 'forest' | 'savanna' | 'swamp' | 'snow' | 'jungle';
const HABITAT_OF: Record<string, Habitat> = {
  human: 'forest', badger: 'forest', fox: 'forest', wolf: 'forest', bear: 'forest', boar: 'forest', bunny: 'forest', cat: 'forest', dog: 'forest', chicken: 'forest',
  lion: 'savanna', hyena: 'savanna', warthog: 'savanna', horse: 'savanna',
  otter: 'swamp', crocodile: 'swamp',
  seal: 'snow', elephantSeal: 'snow', leopardSeal: 'snow', penguin: 'snow',
  monkey: 'jungle', tiger: 'jungle', panda: 'jungle', raptor: 'jungle', trex: 'jungle',
};
const HAB_LOOK: Record<Habitat, { ground: number; label: string }> = {
  forest: { ground: 0x4f8a3b, label: '🌲 Forest' }, savanna: { ground: 0xd8b870, label: '🌾 Savanna' }, swamp: { ground: 0x4a6a3a, label: '🐸 Swamp' },
  snow: { ground: 0xeef6fb, label: '❄️ Snowy' }, jungle: { ground: 0x2f7a2a, label: '🌴 Jungle' },
};

export interface ZooPen { x: number; z: number; w: number; d: number; side: number; front: { x: number; z: number }; door: { x: number; z: number; panel: THREE.Mesh; open: boolean; locked: boolean; col: unknown | null } }
export interface ZooAnimal { rig: AnimalRig; x: number; z: number; tx: number; tz: number; wait: number; yaw: number; pen: ZooPen; busy: boolean; idx: number; escapeT: number; sneaking: boolean; escaped: boolean; freeT: number }

export class MagicZoo {
  hut = new THREE.Group();
  inside = new THREE.Group();
  pens: ZooPen[] = [];
  private habitatGroups: THREE.Group[] = [];
  animals: (ZooAnimal | null)[] = [];
  private collision: CollisionWorld;
  private signs: THREE.Mesh[] = [];
  /** Each pet's mood (shown as a big emoji above its habitat). */
  moods: ('happy' | 'sad' | 'angry' | null)[] = [];
  private moodSprites: THREE.Sprite[] = [];
  private moodTex = new Map<string, THREE.SpriteMaterial>();
  private sparkles!: THREE.Points;

  constructor(scene: THREE.Scene, collision: CollisionWorld, playerName: string) {
    this.collision = collision;
    scene.add(this.hut); scene.add(this.inside);
    this.buildHut(collision);
    this.buildZoo(collision, playerName);
    this.inside.visible = false;
  }

  get hutFront() { return { x: ZOO_HUT.x + Math.sin(ZOO_HUT.facing) * 2.1, z: ZOO_HUT.z + Math.cos(ZOO_HUT.facing) * 2.1 }; }
  get zooExit() { return { x: ZOO.x, z: ZOO.z + ZOO.halfD - 5 }; }

  private buildHut(collision: CollisionWorld) {
    const { x, z, facing } = ZOO_HUT;
    const y = terrainHeight(x, z);
    const g = this.hut; g.position.set(x, y, z); g.rotation.y = facing;
    const wall = new THREE.MeshStandardMaterial({ color: 0x8a5ad8, roughness: 0.6 });
    const star = new THREE.MeshStandardMaterial({ color: 0xffe066, emissive: 0xffd34a, emissiveIntensity: 0.9 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, 1.7, 10), wall); body.position.y = 0.85; body.castShadow = true; g.add(body);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.25, 1.6, 10), new THREE.MeshStandardMaterial({ color: 0x3a7ae0, roughness: 0.5 })); roof.position.y = 2.45; roof.castShadow = true; g.add(roof);
    const tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), star); tip.position.y = 3.4; g.add(tip);
    for (let k = 0; k < 9; k++) { const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.07), star); const a = k * 0.7; s.position.set(Math.cos(a) * 0.97, 0.4 + (k % 3) * 0.45, Math.sin(a) * 0.97); g.add(s); }
    // a tiny glowing door
    const door = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.15), new THREE.MeshStandardMaterial({ color: 0xffe9ff, emissive: 0xd08aff, emissiveIntensity: 1.2 })); door.position.set(0, 0.62, 1.0); g.add(door);
    const arch = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.06, 6, 16, Math.PI), star); arch.position.set(0, 1.2, 1.01); g.add(arch);
    // sign
    const c = document.createElement('canvas'); c.width = 512; c.height = 128;
    const x2 = c.getContext('2d')!; x2.fillStyle = '#2a1a5a'; x2.beginPath(); x2.roundRect(4, 4, 504, 120, 30); x2.fill();
    x2.fillStyle = '#ffe066'; x2.font = 'bold 56px Nunito, sans-serif'; x2.textAlign = 'center'; x2.textBaseline = 'middle'; x2.fillText('✨ Magic Zoo ✨', 256, 68);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.48), new THREE.MeshBasicMaterial({ map: t, transparent: true })); sign.position.set(0, 1.95, 1.05); g.add(sign);
    collision.add({ kind: 'cyl', x, z, r: 1.15, top: 100, tall: true });
    // floating sparkles all around it
    const n = 40, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, r = 1.2 + Math.random() * 1.2; pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = Math.random() * 3.4; pos[i * 3 + 2] = Math.sin(a) * r; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.sparkles = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffe9a0, size: 0.12, transparent: true, opacity: 0.9 }));
    g.add(this.sparkles);
  }

  private label(text: string, w = 2.6, color = '#2a5a2a', sub = '') {
    const H = sub ? 200 : 128;
    const c = document.createElement('canvas'); c.width = 512; c.height = H;
    const g = c.getContext('2d')!; g.fillStyle = '#fffaf0'; g.beginPath(); g.roundRect(4, 4, 504, H - 8, 26); g.fill();
    g.fillStyle = color; g.font = 'bold 48px Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 66, 490);
    if (sub) { g.fillStyle = '#7a5a2a'; g.font = 'bold 40px Nunito, sans-serif'; g.fillText(sub, 256, 142, 490); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.Mesh(new THREE.PlaneGeometry(w, w * H / 512), new THREE.MeshBasicMaterial({ map: t, transparent: true }));
  }

  private buildZoo(collision: CollisionWorld, playerName: string) {
    const Z = ZOO, g = this.inside;
    // a huge lawn with a paved path down the middle
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(Z.halfW * 2 + 20, Z.halfD * 2 + 20), new THREE.MeshStandardMaterial({ color: 0x6aa84a, roughness: 1 }));
    lawn.rotation.x = -Math.PI / 2; lawn.position.set(Z.x, 0, Z.z); lawn.receiveShadow = true; g.add(lawn);
    const path = new THREE.Mesh(new THREE.PlaneGeometry(7, Z.halfD * 2), new THREE.MeshStandardMaterial({ color: 0xe8d8b8, roughness: 0.9 }));
    path.rotation.x = -Math.PI / 2; path.position.set(Z.x, 0.01, Z.z); g.add(path);
    // a magical hedge around the edge (with sparkly purple flowers)
    const hedge = new THREE.MeshStandardMaterial({ color: 0x2f6a2a, roughness: 1 });
    for (const [w, d, px, pz] of [[Z.halfW * 2 + 6, 1.2, 0, -Z.halfD - 2], [Z.halfW * 2 + 6, 1.2, 0, Z.halfD + 2], [1.2, Z.halfD * 2 + 4, -Z.halfW - 3, 0], [1.2, Z.halfD * 2 + 4, Z.halfW + 3, 0]] as const) {
      const h = new THREE.Mesh(new THREE.BoxGeometry(w, 1.8, d), hedge); h.position.set(Z.x + px, 0.9, Z.z + pz); g.add(h);
    }
    // the welcome arch and the fountain
    const archM = new THREE.MeshStandardMaterial({ color: 0x8a5ad8, roughness: 0.5 });
    for (const sx of [-3.8, 3.8]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 4.5, 10), archM); p.position.set(Z.x + sx, 2.25, Z.z + Z.halfD - 8); g.add(p); }
    const top = this.label(`✨ ${playerName}'s Magic Zoo ✨`, 8, '#6a3ab8'); top.position.set(Z.x, 4.6, Z.z + Z.halfD - 8); g.add(top);
    const fountain = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.9, 0.7, 24), new THREE.MeshStandardMaterial({ color: 0xd8d0c8 })); fountain.position.set(Z.x, 0.35, Z.z); g.add(fountain);
    const water = new THREE.Mesh(new THREE.CircleGeometry(2.4, 24), new THREE.MeshStandardMaterial({ color: 0x6ad0f0, emissive: 0x2a6a8a, emissiveIntensity: 0.4 })); water.rotation.x = -Math.PI / 2; water.position.set(Z.x, 0.71, Z.z); g.add(water);
    const spout = new THREE.Mesh(new THREE.OctahedronGeometry(0.5), new THREE.MeshStandardMaterial({ color: 0xffe066, emissive: 0xffc83a, emissiveIntensity: 0.8 })); spout.position.set(Z.x, 1.6, Z.z); g.add(spout);
    collision.add({ kind: 'cyl', x: Z.x, z: Z.z, r: 2.9, top: 0.7, tall: false });
    // lampposts
    for (let i = 0; i < 12; i++) for (const sx of [-4.2, 4.2]) {
      const lz = Z.z - Z.halfD + 8 + i * 13;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3, 6), new THREE.MeshStandardMaterial({ color: 0x3a3a4a })); pole.position.set(Z.x + sx, 1.5, lz); g.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshStandardMaterial({ color: 0xfff0c8, emissive: 0xffd88a, emissiveIntensity: 1.2 })); bulb.position.set(Z.x + sx, 3.1, lz); g.add(bulb);
    }
    const sunny = new THREE.PointLight(0xfff0d8, 8, 120, 1.0); sunny.position.set(Z.x, 14, Z.z); g.add(sunny);
    // the magic way out
    const exitDoor = new THREE.Mesh(new THREE.PlaneGeometry(2, 3), new THREE.MeshStandardMaterial({ color: 0xffe9ff, emissive: 0xd08aff, emissiveIntensity: 1.2, side: THREE.DoubleSide }));
    exitDoor.position.set(Z.x, 1.5, Z.z + Z.halfD - 1.5); exitDoor.rotation.y = Math.PI; g.add(exitDoor);
    const exitSign = this.label('🚪 Way out', 2.4, '#6a3ab8'); exitSign.position.set(Z.x, 3.4, Z.z + Z.halfD - 1.55); exitSign.rotation.y = Math.PI; g.add(exitSign);
    // 10 big glass habitats, 5 on each side of the path
    const W = 11, D = 12;
    for (let i = 0; i < ZOO_SLOTS; i++) {
      // your pets fill the RIGHT side first (as you walk in), starting by the entrance; empty habitats end up on the left
      const half = ZOO_SLOTS / 2, side = i < half ? 1 : -1, row = i % half;
      const cx = Z.x + side * (3.5 + 2 + W / 2), cz = Z.z - Z.halfD + 10 + (half - 1 - row) * (D + 2.5);
      const fx = cx - side * W / 2;   // the wall facing the path (it has a glass door in the middle)
      const pen: ZooPen = { x: cx, z: cz, w: W, d: D, side, front: { x: Z.x + side * 3.0, z: cz + 3.2 }, door: { x: fx, z: cz, panel: null as unknown as THREE.Mesh, open: false, locked: true, col: null } };
      this.pens.push(pen);
      // glass walls (with white frames); the glass faces the path
      const glass = new THREE.MeshStandardMaterial({ color: 0xcfeeff, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide });
      const frame = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
      const H = 3.2;
      const seg = (D - 1.8) / 2;
      const walls: [number, number, number, number][] = [[W, 0.08, 0, -D / 2], [W, 0.08, 0, D / 2], [0.08, D, side * W / 2, 0], [0.08, seg, -side * W / 2, -D / 2 + seg / 2], [0.08, seg, -side * W / 2, D / 2 - seg / 2]];
      for (const [ww, dd, ox, oz] of walls) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(ww, H, dd), glass); m.position.set(cx + ox, H / 2, cz + oz); m.renderOrder = 3; g.add(m);
        const topBar = new THREE.Mesh(new THREE.BoxGeometry(Math.max(ww, 0.12), 0.12, Math.max(dd, 0.12)), frame); topBar.position.set(cx + ox, H, cz + oz); g.add(topBar);
        collision.add({ kind: 'box', minX: cx + ox - Math.max(ww, 0.3) / 2, maxX: cx + ox + Math.max(ww, 0.3) / 2, minZ: cz + oz - Math.max(dd, 0.3) / 2, maxZ: cz + oz + Math.max(dd, 0.3) / 2, top: 100, tall: true });
      }
      for (const [ox, oz] of [[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2], [W / 2, D / 2], [-side * W / 2, -0.9], [-side * W / 2, 0.9]]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.15, H, 0.15), frame); post.position.set(cx + ox, H / 2, cz + oz); g.add(post); }
      // the sliding glass door (with a little paw-print handle)
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.3, 1.8), new THREE.MeshStandardMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.35, roughness: 0.05, depthWrite: false }));
      panel.position.set(fx, 1.15, cz); panel.renderOrder = 3; g.add(panel);
      const handle = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshStandardMaterial({ color: 0xf4c430, metalness: 0.5 })); handle.position.set(side * -0.05, 0, 0.6); panel.add(handle);
      pen.door.panel = panel;
      // the lock buttons: RED on one side locks the door, GREEN on the other side unlocks it
      for (const [kind, bz, col] of [['lock', cz - 1.5, 0xe8303a], ['unlock', cz + 3.3, 0x34c84a]] as const) {
        const plate = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.6, 0.5), new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.4 }));
        plate.position.set(fx - side * 0.1, 1.25, bz); g.add(plate);
        const m = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.2, roughness: 0.3 });
        const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.1, 18), m);
        btn.rotation.z = Math.PI / 2; btn.position.set(fx - side * 0.17, 1.27, bz); g.add(btn);
        const icon = this.label(kind === 'lock' ? '🔒 Lock' : '🔓 Unlock', 0.9, kind === 'lock' ? '#b02028' : '#1f7a30');
        icon.position.set(fx - side * 0.15, 1.75, bz); icon.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2; g.add(icon);
        this.buttons.push({ i, kind, x: fx - side * 0.6, z: bz, mesh: btn, mat: m });
      }
      pen.door.col = collision.add({ kind: 'box', minX: fx - 0.15, maxX: fx + 0.15, minZ: cz - 0.9, maxZ: cz + 0.9, top: 100, tall: true });
      const hg = new THREE.Group(); g.add(hg); this.habitatGroups.push(hg);
      const ms = new THREE.Sprite(); ms.position.set(cx, 4.2, cz); ms.scale.setScalar(1.3); ms.visible = false; g.add(ms); this.moodSprites.push(ms);
      const sign = this.label('Empty 🐾', 2.6); sign.position.set(cx - side * (W / 2 + 0.06), 2.6, cz); sign.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2; g.add(sign); this.signs.push(sign);
    }
  }

  /** Open or close a habitat's glass door (it slides along the wall). */
  setDoor(i: number, open: boolean) {
    const d = this.pens[i].door; if (d.open === open) return;
    d.open = open;
    if (open) d.locked = false;
    if (open && d.col) { this.collision.remove(d.col as never); d.col = null; }
    if (!open && !d.col) d.col = this.collision.add({ kind: 'box', minX: d.x - 0.15, maxX: d.x + 0.15, minZ: d.z - 0.9, maxZ: d.z + 0.9, top: 100, tall: true });
  }
  buttons: { i: number; kind: 'lock' | 'unlock'; x: number; z: number; mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial }[] = [];
  /** The red/green lock button you're standing next to, if any. */
  buttonAt(x: number, z: number) { return this.buttons.find((b) => Math.abs(x - b.x) < 1.2 && Math.abs(z - b.z) < 0.75) ?? null; }
  /** Squish a button in when it's pressed. */
  pressButton(b: { mesh: THREE.Mesh }) { b.mesh.scale.y = 0.4; }
  /** Lock or unlock a closed habitat door. An unlocked door can be pushed open by a clever pet! */
  lockDoor(i: number, locked: boolean) { const d = this.pens[i].door; if (d.open) return; d.locked = locked; }
  /** Called when a pet slips out of its habitat. */
  onEscape?: (i: number, pushed: boolean) => void;
  /** Called when an escaped pet runs out of the magic door into the forest. */
  onRunAway?: (i: number) => void;
  /** An escaped pet right next to you (or -1). */
  escapedNear(x: number, z: number, r = 2.4) { return this.animals.findIndex((a) => !!a && a.escaped && Math.hypot(a.x - x, a.z - z) < r); }
  /** Put an escaped pet back in its habitat (the door gets closed behind it). */
  catchBack(i: number) {
    const a = this.animals[i]; if (!a) return;
    a.escaped = false; a.sneaking = false; a.escapeT = 0; a.freeT = 0; a.busy = false;
    a.x = a.tx = a.pen.x; a.z = a.tz = a.pen.z; a.wait = 1;
    this.setDoor(i, false);
  }
  /** Show a pet's mood above its habitat: 😊 happy, 😢 sad, 😠 angry. */
  setMood(i: number, mood: 'happy' | 'sad' | 'angry' | null) {
    this.moods[i] = mood;
    const sp = this.moodSprites[i]; if (!sp) return;
    if (!mood) { sp.visible = false; return; }
    const emo = { happy: '😊', sad: '😢', angry: '😠' }[mood];
    let mat = this.moodTex.get(emo);
    if (!mat) {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const x = c.getContext('2d')!; x.fillStyle = 'rgba(255,255,255,0.9)'; x.beginPath(); x.arc(64, 64, 58, 0, 7); x.fill();
      x.font = '84px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(emo, 64, 70);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      mat = new THREE.SpriteMaterial({ map: t, transparent: true }); this.moodTex.set(emo, mat);
    }
    sp.material = mat; sp.visible = true;
  }
  /** Which habitat a point is inside (or -1). */
  habitatAt(x: number, z: number) { return this.pens.findIndex((p) => Math.abs(x - p.x) < p.w / 2 - 0.1 && Math.abs(z - p.z) < p.d / 2 - 0.1); }
  /** Which habitat door you're standing at (inside or outside), or -1. */
  doorAt(x: number, z: number) { return this.pens.findIndex((p) => Math.abs(x - p.door.x) < 1.6 && Math.abs(z - p.door.z) < 1.1); }

  /** Decorate one habitat for the animal that lives in it. */
  private dressHabitat(i: number, hab: Habitat | null) {
    const hg = this.habitatGroups[i]; hg.clear();
    const p = this.pens[i];
    const look = hab ? HAB_LOOK[hab] : { ground: 0x9ac87a, label: '' };
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(p.w - 0.2, p.d - 0.2), new THREE.MeshStandardMaterial({ color: look.ground, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(p.x, 0.02, p.z); hg.add(floor);
    if (!hab) return;
    const at = (fx: number, fz: number): [number, number] => [p.x + fx * (p.w / 2 - 1), p.z + fz * (p.d / 2 - 1)];
    const M = (c: number, r = 0.9) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
    const add = (m: THREE.Mesh, x: number, y: number, z: number) => { m.position.set(x, y, z); m.castShadow = true; hg.add(m); return m; };
    const rnd = ((seed) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; })(1234 + i * 77);
    const scatter = (n: number, fn: (x: number, z: number, k: number) => void) => { for (let k = 0; k < n; k++) { const [x, z] = at(-0.95 + rnd() * 1.9, -0.95 + rnd() * 1.9); if (Math.abs(x - p.door.x) < 1.6 && Math.abs(z - p.door.z) < 1.6) continue; fn(x, z, k); } };
    const trunkM = M(0x6a4a30), rockM = M(0x8a8a80);
    // a painted scene on the back wall makes the habitat look like it goes on forever
    const mural = document.createElement('canvas'); mural.width = 512; mural.height = 160;
    { const g = mural.getContext('2d')!;
      const skyC = { forest: ['#9fd0f0', '#dff0f8'], savanna: ['#f0c070', '#fbe8c0'], swamp: ['#9ab0a8', '#d0dcd0'], snow: ['#a8d0f0', '#f0f8ff'], jungle: ['#7ad0e8', '#d8f4e8'] }[hab];
      const gr = g.createLinearGradient(0, 0, 0, 160); gr.addColorStop(0, skyC[0]); gr.addColorStop(1, skyC[1]); g.fillStyle = gr; g.fillRect(0, 0, 512, 160);
      const hill = { forest: '#3f7a2a', savanna: '#c8a050', swamp: '#4a6a3a', snow: '#ffffff', jungle: '#2f7a2a' }[hab];
      g.fillStyle = hill; g.beginPath(); g.moveTo(0, 160); for (let x = 0; x <= 512; x += 32) g.lineTo(x, 100 + Math.sin(x * 0.02 + i) * 22); g.lineTo(512, 160); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.15)';
      for (let k = 0; k < 10; k++) { const x = k * 54 + 10; if (hab === 'savanna') { g.fillRect(x + 12, 88, 4, 22); g.beginPath(); g.ellipse(x + 14, 86, 22, 6, 0, 0, 7); g.fill(); } else if (hab !== 'snow') { g.beginPath(); g.moveTo(x, 120); g.lineTo(x + 14, 64 + (k % 3) * 8); g.lineTo(x + 28, 120); g.fill(); } else { g.beginPath(); g.moveTo(x, 110); g.lineTo(x + 26, 50 + (k % 3) * 10); g.lineTo(x + 52, 110); g.fill(); } }
    }
    const mt = new THREE.CanvasTexture(mural); mt.colorSpace = THREE.SRGBColorSpace;
    const back = new THREE.Mesh(new THREE.PlaneGeometry(p.d - 0.3, 3.0), new THREE.MeshBasicMaterial({ map: mt }));
    back.position.set(p.x + p.side * (p.w / 2 - 0.08), 1.55, p.z); back.rotation.y = p.side > 0 ? -Math.PI / 2 : Math.PI / 2; hg.add(back);
    // grass tufts everywhere (not on snow)
    if (hab !== 'snow') scatter(24, (x, z) => { const t = add(new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35 + rnd() * 0.3, 4), M(hab === 'savanna' ? 0xc8a85a : 0x4f9a3a)), x, 0.18, z); t.castShadow = false; });
    if (hab === 'forest') {
      for (const [fx, fz] of [[0.7, -0.6], [0.75, 0.55], [0.3, 0.8]] as const) { const [x, z] = at(fx, fz); add(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 2.0, 8), trunkM), x, 1.0, z); add(new THREE.Mesh(new THREE.ConeGeometry(1.0, 2.4, 9), M(0x2f6a2a)), x, 2.6, z); }
      { const [x, z] = at(-0.4, -0.75); add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 2.0, 8), trunkM), x, 1.0, z); add(new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 1), M(0x3f8a32)), x, 2.5, z).scale.y = 0.8; }
      { const [x, z] = at(0.1, 0.1); const log = add(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 2.2, 10), trunkM), x, 0.28, z); log.rotation.z = Math.PI / 2; log.rotation.y = 0.6; }
      scatter(6, (x, z) => { add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.18, 6), M(0xf4ecd8)), x, 0.09, z); add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6, 0, 7, 0, 1.6), M(0xd8402a)), x, 0.18, z); });
      scatter(5, (x, z) => add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 1), M(0x3a7a2a)), x, 0.3, z));
      { const [x, z] = at(-0.6, 0.4); const pond = add(new THREE.Mesh(new THREE.CircleGeometry(1.1, 20), M(0x4a90b8, 0.1)), x, 0.04, z); pond.rotation.x = -Math.PI / 2; }
      scatter(4, (x, z) => add(new THREE.Mesh(new THREE.DodecahedronGeometry(0.3 + rnd() * 0.3), rockM), x, 0.2, z));
    } else if (hab === 'jungle') {
      for (const [fx, fz] of [[0.7, -0.6], [0.6, 0.6], [-0.6, -0.7]] as const) {
        const [x, z] = at(fx, fz); add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 2.8, 8), trunkM), x, 1.4, z);
        for (const [ox, oy, oz] of [[0, 3.0, 0], [0.6, 2.7, 0.3], [-0.5, 2.8, -0.4]]) add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.85, 1), M(0x2f8a32)), x + ox, oy, z + oz).scale.y = 0.7;
        for (let k = 0; k < 4; k++) add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.5 + k * 0.2, 4), M(0x3a7a28)), x + Math.cos(k * 1.7) * 0.7, 2.0 - k * 0.1, z + Math.sin(k * 1.7) * 0.7);
      }
      scatter(10, (x, z) => { const leaf = add(new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), M(rnd() < 0.5 ? 0x3a9a3a : 0x4fae3c)), x, 0.25, z); leaf.scale.set(1, 0.25, 0.6); leaf.rotation.y = rnd() * 6; });
      scatter(6, (x, z) => add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), M(0xff4a8a)), x, 0.35, z));
      { const [x, z] = at(-0.5, 0.5); const bamboo = M(0x8ab84a); for (let k = 0; k < 7; k++) add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6), bamboo), x + (k % 3) * 0.2, 1.3, z + Math.floor(k / 3) * 0.2); }
      { const [x, z] = at(0, 0.1); const pool = add(new THREE.Mesh(new THREE.CircleGeometry(1.0, 20), M(0x3ab4c8, 0.1)), x, 0.04, z); pool.rotation.x = -Math.PI / 2; }
    } else if (hab === 'savanna') {
      for (const [fx, fz] of [[0.6, -0.6], [-0.2, 0.7]] as const) { const [x, z] = at(fx, fz); add(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.24, 2.4, 8), trunkM), x, 1.2, z); add(new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.1, 0.35, 14), M(0x5a8a32)), x, 2.5, z); }
      { const [x, z] = at(-0.6, -0.5); add(new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.8, 8), M(0xb8784a)), x, 0.9, z); }   // a termite mound
      scatter(5, (x, z) => { const r = add(new THREE.Mesh(new THREE.DodecahedronGeometry(0.45 + rnd() * 0.4), M(0xc89a6a)), x, 0.25, z); r.scale.y = 0.6; });
      scatter(14, (x, z) => { const g = add(new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.9, 5), M(0xd8b860)), x, 0.45, z); g.castShadow = false; });
      { const [x, z] = at(0.2, 0.0); const hole = add(new THREE.Mesh(new THREE.CircleGeometry(0.9, 18), M(0x6a9ab8, 0.15)), x, 0.04, z); hole.rotation.x = -Math.PI / 2; }   // a watering hole
    } else if (hab === 'swamp') {
      { const [x, z] = at(-0.2, 0.2); const pond = add(new THREE.Mesh(new THREE.CircleGeometry(2.6, 28), M(0x3a6a5a, 0.08)), x, 0.04, z); pond.rotation.x = -Math.PI / 2;
        for (let k = 0; k < 7; k++) { const pad = add(new THREE.Mesh(new THREE.CircleGeometry(0.28, 12), M(0x4f8a34)), x + Math.cos(k * 0.9) * 1.6, 0.06, z + Math.sin(k * 0.9) * 1.3); pad.rotation.x = -Math.PI / 2; }
        for (let k = 0; k < 18; k++) { const a = k * 0.35; add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.0 + (k % 3) * 0.3, 4), M(0x6a8a3a)), x + Math.cos(a) * 2.8, 0.6, z + Math.sin(a) * 2.8); } }
      { const [x, z] = at(0.7, -0.7); add(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 2.6, 8), M(0x5a4a3a)), x, 1.3, z); add(new THREE.Mesh(new THREE.IcosahedronGeometry(1.0, 1), M(0x4a6a3a)), x, 2.7, z).scale.y = 0.6; }
      { const [x, z] = at(0.5, 0.75); const log = add(new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 2.0, 10), M(0x4a3a2a)), x, 0.25, z); log.rotation.z = Math.PI / 2; }
      scatter(6, (x, z) => add(new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), M(0x5a7a3a)), x, 0.12, z).scale.y = 0.4);
    } else {
      { const [x, z] = at(0.3, -0.2); const pool = add(new THREE.Mesh(new THREE.CircleGeometry(2.2, 24), M(0x5aa8d8, 0.05)), x, 0.04, z); pool.rotation.x = -Math.PI / 2; }
      scatter(6, (x, z) => { const m = add(new THREE.Mesh(new THREE.SphereGeometry(0.8 + rnd() * 0.4, 12, 8, 0, 7, 0, 1.5), M(0xffffff, 0.6)), x, 0, z); m.scale.y = 0.5; });
      for (const [fx, fz] of [[-0.6, 0.5], [-0.5, -0.6], [0.7, 0.7]] as const) { const [bx, bz] = at(fx, fz); add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 0), M(0xc8e6f6, 0.2)), bx, 0.45, bz); }
      { const [x, z] = at(-0.7, -0.1); for (let k = 0; k < 3; k++) add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.7), M(0xa8d8f0, 0.15)), x, 0.25 + k * 0.5, z + (k % 2) * 0.1); }   // an ice-block tower
      scatter(8, (x, z) => add(new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.4, 5), M(0xe8f6ff, 0.2)), x, 0.2, z));
    }
    const lbl = this.label(look.label, 1.8, '#3a5a2a'); lbl.position.set(p.x - p.side * (p.w / 2 + 0.06), 2.05, p.z); lbl.rotation.y = p.side < 0 ? Math.PI / 2 : -Math.PI / 2; hg.add(lbl);
  }

  /** Put your pets into their habitats (call whenever your pets change). */
  placePets(pets: { species: string; name: string; female?: boolean; outfit?: string; clothes?: string }[], walking: number | Set<number>) {
    for (const a of this.animals) if (a) { a.rig.root.removeFromParent(); disposeRig(a.rig); }
    this.animals = [];
    for (let i = 0; i < ZOO_SLOTS; i++) {
      const q = pets[i];
      const pen = this.pens[i];
      this.dressHabitat(i, q ? (HABITAT_OF[q.species] ?? 'forest') : null);
      // the sign on the glass
      const old = this.signs[i]; const sign = this.label(q ? q.name : 'Empty 🐾', 2.6, '#2a5a2a', q ? speciesName(q.species) : ''); sign.position.copy(old.position); sign.rotation.copy(old.rotation);
      old.removeFromParent(); (old.material as THREE.MeshBasicMaterial).map?.dispose(); this.inside.add(sign); this.signs[i] = sign;
      if (!q || (typeof walking === 'number' ? i === walking : walking.has(i))) { this.animals.push(null); continue; }
      const rig = buildOpponent(q.species as OppSpecies, q.species === 'trex' ? 0.55 : 1, !!q.female);
      dressRig(rig, q.outfit);
      dressBody(rig, q.clothes);
      rig.root.position.set(pen.x, 0, pen.z);
      this.inside.add(rig.root);
      this.animals.push({ rig, x: pen.x, z: pen.z, tx: pen.x, tz: pen.z, wait: Math.random() * 2, yaw: 0, pen, busy: false, idx: i, escapeT: 0, sneaking: false, escaped: false, freeT: 0 });
    }
  }

  update(dt: number, t: number, inside: boolean, player?: THREE.Vector3) {
    this.inside.visible = inside;
    for (const p of this.pens) { const tz = p.door.z + (p.door.open ? 1.7 : 0); p.door.panel.position.z += (tz - p.door.panel.position.z) * Math.min(1, dt * 6); }
    for (const b of this.buttons) {
      const d = this.pens[b.i].door, lit = b.kind === 'lock' ? d.locked : !d.locked && !d.open;
      b.mat.emissiveIntensity = lit ? 0.9 + Math.sin(t * 4) * 0.2 : 0.15;
      b.mesh.scale.y += (1 - b.mesh.scale.y) * Math.min(1, dt * 5);
    }
    this.sparkles.rotation.y += dt * 0.4;
    if (!inside) return;
    for (const a of this.animals) {
      if (!a || a.busy) continue;
      let speed = 0;
      a.wait -= dt;
      const door = a.pen.door, side = a.pen.side;
      const youreIn = !!player && this.habitatAt(player.x, player.z) === a.idx;
      // ---- sneaky escapes: an open door (or one you forgot to lock) and nobody watching…
      if (!a.escaped && !a.sneaking) {
        if (!youreIn && (door.open || !door.locked)) {
          a.escapeT += dt;
          if (a.escapeT > (door.open ? 4 : 14)) {
            if (!door.open) { this.setDoor(a.idx, true); this.onEscape?.(a.idx, true); }
            a.sneaking = true; a.tx = door.x + side * 1.2; a.tz = door.z; a.wait = 0;
          }
        } else a.escapeT = 0;
      }
      if (a.sneaking && Math.hypot(a.tx - a.x, a.tz - a.z) < 0.2) {
        if (Math.abs(a.x - door.x) < 1.4) { a.sneaking = false; a.escaped = true; a.tx = door.x - side * 2.5; a.tz = door.z; this.onEscape?.(a.idx, false); }
      }
      if (a.escaped) {
        a.freeT += dt;
        // after a while on the loose, it dashes out of the magic door and off into the forest!
        if (a.freeT > 12) {
          const ex = ZOO.x, ez = ZOO.z + ZOO.halfD - 2;
          a.tx = ex; a.tz = ez; a.wait = 0;
          if (Math.hypot(ex - a.x, ez - a.z) < 1.2) {
            a.rig.root.removeFromParent(); disposeRig(a.rig);
            this.animals[a.idx] = null;
            this.onRunAway?.(a.idx);
            continue;
          }
        }
      }
      if (a.escaped && a.freeT <= 12 && Math.hypot(a.tx - a.x, a.tz - a.z) < 0.2 && a.wait <= 0) {
        // zoom around the big path!
        a.tx = ZOO.x + (Math.random() - 0.5) * 7; a.tz = Math.max(ZOO.z - ZOO.halfD + 5, Math.min(ZOO.z + ZOO.halfD - 7, a.z + (Math.random() - 0.5) * 30)); a.wait = 0.3 + Math.random() * 1.2;
      }
      // when you come into its habitat, your pet trots over to say hi
      if (!a.escaped && !a.sneaking && player && youreIn && Math.hypot(player.x - a.x, player.z - a.z) > 1.8 && a.wait <= 0) { a.tx = player.x; a.tz = player.z; }
      const dx = a.tx - a.x, dz = a.tz - a.z, d = Math.hypot(dx, dz);
      const slow = this.moods[a.idx] === 'sad' ? 0.45 : 1;
      const run = a.escaped || a.sneaking ? 2.8 : 1.6;
      if (d > 0.15 && a.wait <= 0) { const st = Math.min(d, run * slow * dt); a.x += (dx / d) * st; a.z += (dz / d) * st; speed = run; a.yaw = Math.atan2(dx, dz); }
      else if (a.wait <= 0 && !a.escaped && !a.sneaking) { a.tx = a.pen.x + (Math.random() - 0.5) * (a.pen.w - 2.4); a.tz = a.pen.z + (Math.random() - 0.5) * (a.pen.d - 2.4); a.wait = 1.5 + Math.random() * 3; }
      a.rig.root.position.set(a.x, 0, a.z); a.rig.root.rotation.y = a.yaw;
      animateRig(a.rig, dt, { speed, airborne: false, attack: null, attackT: 0, windup: 0 });
      const mood = this.moods[a.idx];
      if (mood === 'sad') { a.rig.head.rotation.x = 0.55; a.rig.body.position.y -= 0.04; }                       // head hanging down
      else if (mood === 'angry') { a.rig.body.position.y += Math.abs(Math.sin(t * 12)) * 0.06; a.rig.body.rotation.z = Math.sin(t * 12) * 0.08; } // stomp stomp!
    }
  }
}

const SPECIES_NAMES: Record<string, string> = { trex: '🦖 T. rex', raptor: '🦖 Raptor', human: '🧑 Human', elephantSeal: '🦭 Elephant Seal', leopardSeal: '🦭 Leopard Seal', bunny: '🐰 Bunny', chicken: '🐔 Chicken', penguin: '🐧 Penguin', cat: '🐱 Cat', dog: '🐶 Dog', horse: '🐴 Horse', panda: '🐼 Panda', tiger: '🐯 Tiger', badger: '🦡 Badger', fox: '🦊 Fox', boar: '🐗 Boar', wolf: '🐺 Wolf', warthog: '🐗 Warthog', hyena: '🐕 Hyena', lion: '🦁 Lion', otter: '🦦 Otter', crocodile: '🐊 Crocodile', seal: '🦭 Seal', bear: '🐻 Bear', monkey: '🐒 Monkey' };
/** A friendly name for an animal type, e.g. 'trex' → '🦖 T. rex'. */
export function speciesName(s: string) { return SPECIES_NAMES[s] ?? '🐾 ' + s.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()); }
