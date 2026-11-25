// Human Village: farmland over the hill north of the forest.
import * as THREE from 'three';
import { VILLAGE } from './config';
import { terrainHeight, fbm, noise2, rng, smoothstep, CollisionWorld } from './terrain';
import {
  CORN_FIELDS, inCorn, PICNIC_TABLES, FARMHOUSE, BARN, BAKERY, GRILL, WELL, FOOD_SPAWNS, HUMAN_SPAWNS, MAP_SPOTS, LANDMARKS, HUMAN_HOMES,
} from './layout';
import { plankTexture, roofTexture, stoneTexture, barkTexture, groundDetailTexture } from './textures';

/** The Red Barn's front door (the game swings it open and shut). */
export let barnDoor: THREE.Object3D | null = null;
/** Front doors of the human houses, in the same order as HUMAN_HOMES. */
export const humanHomeDoors: THREE.Object3D[] = [];
/** Windmill sails (the world spins them). */
export const windmillSails: THREE.Object3D[] = [];

const std = (color: number, map: THREE.Texture | null = null, rough = 0.8) => new THREE.MeshStandardMaterial({ color, map, roughness: rough });

/** Places where trees and grass must not be planted. */
export function villageKeepClear(x: number, z: number, extra = 0): boolean {
  if (Math.abs(x) < 3.5 + extra && z < 150) return true; // main road
  for (const f of CORN_FIELDS) if (x > f.minX - 1 && x < f.maxX + 1 && z > f.minZ - 1 && z < f.maxZ + 1) return true;
  for (const p of [FARMHOUSE, BARN, BAKERY, GRILL, WELL]) if (Math.hypot(x - p.x, z - p.z) < 10 + extra) return true;
  for (const h of HUMAN_HOMES) if (Math.hypot(x - h.x, z - (h.z - 2)) < 8 + extra) return true;
  for (const t of PICNIC_TABLES) if (Math.hypot(x - t.x, z - t.z) < 5 + extra) return true;
  for (const s of FOOD_SPAWNS) if (Math.hypot(x - s.x, z - s.z) < 2.5 + extra) return true;
  for (const m of MAP_SPOTS) if (Math.hypot(x - m.x, z - m.z) < 2.5 + extra) return true;
  for (const l of LANDMARKS) if (Math.hypot(x - l.signX, z - l.signZ) < 2 + extra) return true;
  for (const h of HUMAN_SPAWNS) for (const [rx, rz] of h.route) if (Math.hypot(x - rx, z - rz) < 3 + extra) return true;
  return false;
}

export function buildVillage(scene: THREE.Scene, collision: CollisionWorld): THREE.MeshStandardMaterial[] {
  const nightLights: THREE.MeshStandardMaterial[] = [];
  buildTerrain(scene);
  const g = (x: number, z: number) => terrainHeight(x, z);
  const box = (parent: THREE.Object3D, m: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, ry = 0) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.rotation.y = ry; b.castShadow = b.receiveShadow = true; parent.add(b); return b;
  };
  const cyl = (parent: THREE.Object3D, m: THREE.Material, rt: number, rb: number, h: number, x: number, y: number, z: number) => {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 14), m); c.position.set(x, y, z); c.castShadow = c.receiveShadow = true; parent.add(c); return c;
  };
  const roof = (parent: THREE.Object3D, m: THREE.Material, w: number, d: number, h: number, y: number) => {
    const s = new THREE.Shape(); const W = w / 2 + 0.5;
    s.moveTo(-W, 0); s.lineTo(0, h); s.lineTo(W, 0); s.lineTo(-W, 0);
    const geo = new THREE.ExtrudeGeometry(s, { depth: d + 1, bevelEnabled: false }); geo.translate(0, 0, -(d + 1) / 2);
    const r = new THREE.Mesh(geo, m); r.position.y = y; r.castShadow = true; parent.add(r); return r;
  };
  const windowMat = () => { const m = new THREE.MeshStandardMaterial({ color: 0xffe6a8, emissive: 0xffb84d, emissiveIntensity: 0.25, roughness: 0.3 }); nightLights.push(m); return m; };

  // ---- Farmhouse
  {
    const { x, z } = FARMHOUSE; const y = g(x, z);
    const h = new THREE.Group(); h.position.set(x, y, z); scene.add(h);
    box(h, std(0xffffff, plankTexture(0xe8e0cc, true)), 10, 5, 8, 0, 2.5, 0);
    roof(h, std(0xffffff, roofTexture(0x8a3a2a)), 10, 8, 3, 5);
    box(h, std(0xffffff, stoneTexture(0x8a857c)), 1.1, 3, 1.1, 3, 7, 1.5);
    const fd = new THREE.Group(); fd.position.set(-0.65, 0, -4.05); h.add(fd);
    box(fd, std(0x6a3f22, plankTexture(0x6a3f22, false)), 1.3, 2.3, 0.1, 0.65, 1.15, 0);
    humanHomeDoors[0] = fd;
    for (const wx of [-3, 3]) box(h, windowMat(), 1.2, 1.1, 0.1, wx, 2.8, -4.05);
    box(h, std(0xffffff, plankTexture(0x9b7048, false)), 6, 0.25, 2.2, 0, 0.12, -5.1); // porch
    collision.add({ kind: 'box', minX: x - 5.2, maxX: x + 5.2, minZ: z - 4.2, maxZ: z + 4.2, top: 100, tall: true });
    // crate where the pie cools
    box(scene, std(0xffffff, plankTexture(0xa27a4a, true)), 0.95, 0.8, 0.95, -22, g(-22, 121) + 0.4, 121);
    collision.add({ kind: 'box', minX: -22.5, maxX: -21.5, minZ: 120.5, maxZ: 121.5, top: g(-22, 121) + 0.8 });
  }
  // ---- Human houses: each one has its own style (the farmhouse is built above)
  HUMAN_HOMES.forEach((home, i) => {
    if (home.farmhouse) return;
    const y = g(home.x, home.z);
    const c = new THREE.Group(); c.position.set(home.x, y, home.z); scene.add(c);
    const W = home.w, D = home.d, front = -D / 2 - 0.05;
    const doorColors = [0x6a3f22, 0x3d5a8a, 0x8a2a3a, 0x3d6a3d, 0xd8452e, 0x3b8fd9];
    const makeDoor = (z = front, color = doorColors[i % doorColors.length]) => {
      const door = new THREE.Group(); door.position.set(-0.6, 0, z); c.add(door);
      box(door, std(0xffffff, plankTexture(color, false)), 1.2, 2.1, 0.1, 0.6, 1.05, 0);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), std(0xd8b44a, null, 0.3)); knob.position.set(1.05, 1.05, -0.07); door.add(knob);
      humanHomeDoors[i] = door;
    };
    const glass = (w: number, h: number, x: number, yy: number, z: number, ry = 0) => box(c, windowMat(), w, h, 0.08, x, yy, z, ry);
    const sign = (text: string, x: number, yy: number, z: number, w = 2.6, bg = '#fff4e0', fg = '#8a3a2a') => {
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128;
      const cx = cv.getContext('2d')!; cx.fillStyle = bg; cx.beginPath(); cx.roundRect(4, 4, 504, 120, 26); cx.fill();
      cx.fillStyle = fg; cx.font = 'bold 58px Nunito, sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(text, 256, 68);
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), new THREE.MeshBasicMaterial({ map: t, transparent: true }));
      m.position.set(x, yy, z); m.rotation.y = Math.PI; c.add(m);
    };

    if (home.style === 'thatch') {
      // round-ish stone cottage with a big fluffy straw roof
      box(c, std(0xffffff, stoneTexture(home.color)), W, 2.5, D, 0, 1.25, 0);
      const thatch = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), std(home.roof, null, 1));
      thatch.scale.set(W / 2 + 0.7, 2.4, D / 2 + 0.7); thatch.position.y = 2.4; thatch.castShadow = true; c.add(thatch);
      const ridge = new THREE.Mesh(new THREE.TorusGeometry(W / 2 + 0.55, 0.18, 8, 28), std(0xb8963a, null, 1)); ridge.rotation.x = Math.PI / 2; ridge.scale.z = 1; ridge.scale.y = (D / 2 + 0.55) / (W / 2 + 0.55); ridge.position.y = 2.45; c.add(ridge);
      box(c, std(0xffffff, stoneTexture(0x7a756c)), 0.7, 2.4, 0.7, W / 2 - 1.2, 4.2, 0.6);
      const round = new THREE.Mesh(new THREE.CircleGeometry(0.45, 20), windowMat()); round.position.set(1.9, 1.6, front - 0.02); round.rotation.y = Math.PI; c.add(round);
      const round2 = round.clone(); round2.position.x = -1.9; c.add(round2);
      makeDoor();
      sign("Rosa's Kitchen 🍲", 0, 2.35, front - 0.08, 2.4);
    } else if (home.style === 'tower') {
      // tall, skinny two-storey house with a pointy roof and a bakery sign
      box(c, std(0xffffff, plankTexture(home.color, true)), W, 6.2, D, 0, 3.1, 0);
      const spire = new THREE.Mesh(new THREE.ConeGeometry(Math.hypot(W, D) / 2 + 0.3, 3, 4), std(0xffffff, roofTexture(home.roof)));
      spire.rotation.y = Math.PI / 4; spire.position.y = 6.2 + 1.5; spire.castShadow = true; c.add(spire);
      for (const wx of [-1.6, 1.6]) { glass(1.0, 1.1, wx, 1.9, front); glass(1.0, 1.1, wx, 4.6, front); }
      glass(1.0, 1.1, 0, 4.6, front);
      // striped awning over the door
      const cv = document.createElement('canvas'); cv.width = 128; cv.height = 16; const cx = cv.getContext('2d')!;
      for (let k = 0; k < 8; k++) { cx.fillStyle = k % 2 ? '#ffffff' : '#e45a8a'; cx.fillRect(k * 16, 0, 16, 16); }
      const at = new THREE.CanvasTexture(cv); at.colorSpace = THREE.SRGBColorSpace;
      const awn = box(c, std(0xffffff, at, 0.7), 2.2, 0.1, 1.0, 0, 2.55, front - 0.45); awn.rotation.x = 0.3;
      makeDoor();
      sign("Sam's Bakes 🍞", 0, 3.4, front - 0.06, 2.6, '#fdf0f4', '#b0306a');
    } else if (home.style === 'aframe') {
      // A-frame cabin: the roof comes all the way down to the ground
      const tri = new THREE.Shape(); tri.moveTo(-W / 2 - 0.4, 0); tri.lineTo(0, 6); tri.lineTo(W / 2 + 0.4, 0); tri.lineTo(-W / 2 - 0.4, 0);
      const geo = new THREE.ExtrudeGeometry(tri, { depth: D, bevelEnabled: false }); geo.translate(0, 0, -D / 2);
      const prism = new THREE.Mesh(geo, std(0xffffff, roofTexture(home.roof))); prism.castShadow = true; c.add(prism);
      const face = new THREE.Shape(); face.moveTo(-W / 2 + 0.2, 0); face.lineTo(0, 5.6); face.lineTo(W / 2 - 0.2, 0); face.lineTo(-W / 2 + 0.2, 0);
      const fm = new THREE.Mesh(new THREE.ShapeGeometry(face), std(0xffffff, plankTexture(home.color, false))); fm.position.z = front + 0.02; fm.rotation.y = Math.PI; c.add(fm);
      const tg = new THREE.Shape(); tg.moveTo(-1.3, 2.6); tg.lineTo(0, 4.6); tg.lineTo(1.3, 2.6); tg.lineTo(-1.3, 2.6);
      const tw = new THREE.Mesh(new THREE.ShapeGeometry(tg), windowMat()); tw.position.z = front - 0.01; tw.rotation.y = Math.PI; c.add(tw);
      makeDoor();
      // a little porch with a log pile
      for (let k = 0; k < 3; k++) cyl(c, std(0xffffff, barkTexture(0x6b4a2e)), 0.15, 0.15, 1.2, W / 2 - 0.6 - k * 0.32, 0.15, front - 0.8).rotation.z = Math.PI / 2;
    } else if (home.style === 'windmill') {
      // a round windmill house with spinning sails
      const r = W / 2;
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.85, r, 6.2, 24), std(0xffffff, plankTexture(home.color, true)));
      tower.position.y = 3.1; tower.castShadow = true; tower.receiveShadow = true; c.add(tower);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 1.05, 2.4, 24), std(0xffffff, roofTexture(home.roof))); cap.position.y = 7.4; cap.castShadow = true; c.add(cap);
      const hub = new THREE.Group(); hub.position.set(0, 6.3, -r * 0.95 - 0.35); c.add(hub);
      const sail = std(0xf8f4ea, null, 0.9), frame = std(0x6a4a30);
      for (let k = 0; k < 4; k++) {
        const arm = new THREE.Group(); arm.rotation.z = (k * Math.PI) / 2; hub.add(arm);
        box(arm, frame, 0.14, 4.0, 0.1, 0, 2.0, 0);
        box(arm, sail, 0.9, 3.2, 0.05, 0.5, 2.3, 0.05);
      }
      const nut = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), frame); hub.add(nut);
      windmillSails.push(hub);
      for (const yy of [2.0, 4.3]) { const win = new THREE.Mesh(new THREE.CircleGeometry(0.4, 16), windowMat()); win.position.set(1.4, yy, -r * 0.93); win.rotation.y = Math.PI + 0.45; c.add(win); }
      makeDoor(-r - 0.02);
      // flower pots by the door
      for (const sx of [-1.3, 1.3]) {
        cyl(c, std(0xb0563a), 0.25, 0.2, 0.4, sx, 0.2, -r - 0.5);
        const bush = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), std(0x4f8a3b)); bush.position.set(sx, 0.6, -r - 0.5); c.add(bush);
        for (let k = 0; k < 3; k++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), std([0xe4475b, 0xf2c14e, 0xb56be0][k])); f.position.set(sx + (k - 1) * 0.15, 0.85, -r - 0.6); c.add(f); }
      }
    } else {
      // modern house: flat roofs, big glass windows, a bright yellow panel
      box(c, std(0xf8f8f6, null, 0.6), W, 3.2, D, 0, 1.6, 0);
      box(c, std(home.roof, null, 0.5), W + 0.6, 0.2, D + 0.6, 0, 3.3, 0);
      box(c, std(0xe8ecef, null, 0.6), W * 0.6, 2.6, D * 0.8, -W * 0.15, 4.7, D * 0.05);
      box(c, std(home.roof, null, 0.5), W * 0.6 + 0.5, 0.2, D * 0.8 + 0.5, -W * 0.15, 6.1, D * 0.05);
      glass(2.6, 1.8, -2.2, 1.6, front);
      glass(2.0, 1.4, -W * 0.15, 4.7, -D * 0.35 - 0.05);
      box(c, std(0xf4c430, null, 0.5), 1.2, 3.2, 0.12, W / 2 - 0.7, 1.6, front - 0.02);
      makeDoor();
      sign("Max's 🎮", -W * 0.15, 5.9, -D * 0.35 - 0.12, 1.8, '#1d2a3a', '#7fd8ff');
    }
    box(c, std(0xffffff, stoneTexture(0x8a857c)), 1.6, 0.15, 0.8, 0, 0.07, -D / 2 - 0.5); // doorstep
    collision.add({ kind: 'box', minX: home.x - W / 2 - 0.1, maxX: home.x + W / 2 + 0.1, minZ: home.z - D / 2 - 0.1, maxZ: home.z + D / 2 + 0.1, top: 100, tall: true });
  });

  // ---- Red barn
  {
    const { x, z } = BARN; const y = g(x, z);
    const b = new THREE.Group(); b.position.set(x, y, z); scene.add(b);
    box(b, std(0xffffff, plankTexture(0xa8322a, false)), 12, 6, 10, 0, 3, 0);
    roof(b, std(0xffffff, roofTexture(0x3c3c3c)), 12, 10, 3.5, 6);
    const white = std(0xf4f0e6);
    // big barn door, hinged on its left edge so it can swing open
    const door = new THREE.Group(); door.position.set(-2, 0, -5.05); b.add(door);
    box(door, std(0xffffff, plankTexture(0x8a2620, false)), 4, 4.5, 0.12, 2, 2.25, 0);
    for (const r of [0.85, -0.85]) { const t = box(door, white, 5.2, 0.25, 0.14, 2, 2.25, -0.07); t.rotation.z = r; t.scale.x = 0.95; }
    box(door, white, 4.3, 0.25, 0.14, 2, 4.5, -0.07);
    barnDoor = door;
    collision.add({ kind: 'box', minX: x - 6.2, maxX: x + 6.2, minZ: z - 5.2, maxZ: z + 5.2, top: 100, tall: true });
    // hay bales (one holds the cheese)
    const hay = std(0xd9b45a, null, 1);
    for (const [hx, hz, top] of [[22, 126, true], [36, 128, false], [37.5, 126.5, false]] as [number, number, boolean][]) {
      const hy = g(hx, hz);
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.4, 16), hay); c.rotation.z = Math.PI / 2; c.position.set(hx, hy + 0.6, hz); c.castShadow = true; scene.add(c);
      if (top) collision.add({ kind: 'cyl', x: hx, z: hz, r: 0.75, top: hy + 1.0 });
      else collision.add({ kind: 'cyl', x: hx, z: hz, r: 0.75, top: 100, tall: true });
    }
  }
  // ---- Picnic tables (food sits on top; benches are steps)
  const wood = std(0xffffff, plankTexture(0x9b7048, true));
  const cloth = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d')!;
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { x.fillStyle = (i + j) % 2 ? '#d33a3a' : '#f7f2ea'; x.fillRect(i * 8, j * 8, 8, 8); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return std(0xffffff, t, 0.9);
  })();
  for (const t of PICNIC_TABLES) {
    const y = g(t.x, t.z);
    box(scene, wood, 2.4, 0.12, 1.1, t.x, y + 0.84, t.z);
    box(scene, cloth, 2.2, 0.02, 1.0, t.x, y + 0.91, t.z);
    for (const sx of [-0.9, 0.9]) box(scene, wood, 0.12, 0.84, 0.9, t.x + sx, y + 0.42, t.z);
    for (const sz of [-0.95, 0.95]) box(scene, wood, 2.4, 0.1, 0.35, t.x, y + 0.45, t.z + sz);
    collision.add({ kind: 'box', minX: t.x - 1.2, maxX: t.x + 1.2, minZ: t.z - 0.55, maxZ: t.z + 0.55, top: y + 0.92 });
    for (const sz of [-0.95, 0.95]) collision.add({ kind: 'box', minX: t.x - 1.2, maxX: t.x + 1.2, minZ: t.z + sz - 0.18, maxZ: t.z + sz + 0.18, top: y + 0.5 });
  }
  // ---- Cook's grill
  {
    const { x, z } = GRILL; const y = g(x, z);
    const black = std(0x222222, null, 0.4);
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), black);
    bowl.position.set(x, y + 1.0, z); bowl.castShadow = true; scene.add(bowl);
    const coals = new THREE.MeshStandardMaterial({ color: 0x552200, emissive: 0xff5a10, emissiveIntensity: 0.9 });
    const top = new THREE.Mesh(new THREE.CircleGeometry(0.58, 16), coals); top.rotation.x = -Math.PI / 2; top.position.set(x, y + 0.98, z); scene.add(top);
    for (let i = 0; i < 3; i++) cyl(scene, black, 0.03, 0.03, 1, x + Math.cos(i * 2.1) * 0.4, y + 0.5, z + Math.sin(i * 2.1) * 0.4);
    collision.add({ kind: 'cyl', x, z, r: 0.65, top: 100, tall: true });
  }
  // ---- Bakery stall
  {
    const { x, z } = BAKERY; const y = g(x, z);
    box(scene, std(0xffffff, plankTexture(0xc89a62, false)), 3.6, 1.0, 1.2, x, y + 0.5, z - 1.6);
    collision.add({ kind: 'box', minX: x - 1.8, maxX: x + 1.8, minZ: z - 2.2, maxZ: z - 1.0, top: y + 1.0 });
    const post = std(0x8a6440);
    for (const [px, pz] of [[-1.8, -2.2], [1.8, -2.2], [-1.8, 0.6], [1.8, 0.6]]) cyl(scene, post, 0.07, 0.07, 3, x + px, y + 1.5, z + pz);
    const c = document.createElement('canvas'); c.width = 128; c.height = 16; const cx = c.getContext('2d')!;
    for (let i = 0; i < 8; i++) { cx.fillStyle = i % 2 ? '#ffffff' : '#e45a8a'; cx.fillRect(i * 16, 0, 16, 16); }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const awning = box(scene, std(0xffffff, tex, 0.7), 4.2, 0.12, 3.4, x, y + 3.0, z - 0.8); awning.rotation.x = -0.15;
    box(scene, std(0xffffff, plankTexture(0x8a6440, true)), 3.6, 2.2, 0.15, x, y + 1.1, z + 0.7);
    collision.add({ kind: 'box', minX: x - 1.9, maxX: x + 1.9, minZ: z + 0.5, maxZ: z + 0.9, top: 100, tall: true });
    for (const px of [-1.85, 1.85]) collision.add({ kind: 'cyl', x: x + px, z: z - 2.2, r: 0.15, top: 100, tall: true });
  }
  // ---- Well
  {
    const { x, z } = WELL; const y = g(x, z);
    const stone = std(0xffffff, stoneTexture(0x8a877f));
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.05, 0.9, 18, 1, true), stone); ring.material.side = THREE.DoubleSide;
    ring.position.set(x, y + 0.45, z); ring.castShadow = true; scene.add(ring);
    const water = new THREE.Mesh(new THREE.CircleGeometry(0.95, 18), std(0x2a4a6a, null, 0.1)); water.rotation.x = -Math.PI / 2; water.position.set(x, y + 0.3, z); scene.add(water);
    const post = std(0xffffff, barkTexture(0x6b4a2e));
    for (const sx of [-0.95, 0.95]) cyl(scene, post, 0.08, 0.08, 2.4, x + sx, y + 1.2, z);
    const rf = new THREE.Mesh(new THREE.ConeGeometry(1.6, 0.9, 4), std(0xffffff, roofTexture(0x7a4a2c))); rf.position.set(x, y + 2.7, z); rf.rotation.y = Math.PI / 4; rf.castShadow = true; scene.add(rf);
    collision.add({ kind: 'cyl', x, z, r: 1.1, top: 100, tall: true });
  }
  // ---- Corn fields (walk in to hide!) and a scarecrow
  {
    const stalk = cornGeometry();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide });
    const mats: THREE.Matrix4[] = [];
    const r = rng(808);
    for (const f of CORN_FIELDS) for (let x = f.minX + 0.6; x < f.maxX; x += 1.15) for (let z = f.minZ + 0.6; z < f.maxZ; z += 1.15) {
      if (FOOD_SPAWNS.some((s) => Math.hypot(s.x - x, s.z - z) < 1.2)) continue;
      const jx = x + (r() - 0.5) * 0.4, jz = z + (r() - 0.5) * 0.4, s = 0.85 + r() * 0.3;
      mats.push(new THREE.Matrix4().compose(new THREE.Vector3(jx, g(jx, jz), jz), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r() * 6.28, 0)), new THREE.Vector3(s, s, s)));
    }
    const im = new THREE.InstancedMesh(stalk, mat, mats.length);
    mats.forEach((m, i) => im.setMatrixAt(i, m));
    im.castShadow = true; im.computeBoundingSphere();
    scene.add(im);
    // scarecrow
    const sx = -41, sz = 95.5, sy = g(sx, sz);
    const pole = std(0xffffff, barkTexture(0x6b4a2e));
    cyl(scene, pole, 0.06, 0.06, 2.6, sx, sy + 1.3, sz);
    const arm = cyl(scene, pole, 0.05, 0.05, 1.8, sx, sy + 2.0, sz); arm.rotation.z = Math.PI / 2;
    box(scene, std(0x3a6a9a), 0.7, 0.8, 0.35, sx, sy + 1.9, sz);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), std(0xe8c88a)); head.position.set(sx, sy + 2.55, sz); scene.add(head);
    const hat = cyl(scene, std(0xc9a24a), 0.15, 0.42, 0.22, sx, sy + 2.82, sz); void hat;
  }
  return nightLights;
}

function buildTerrain(scene: THREE.Scene) {
  // grid lines up exactly with the forest terrain (1.3 m spacing) so the edges meet with no gap
  const x0 = -71.5, x1 = 71.5, z0 = 65, z1 = 169;
  const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0, 110, 80);
  geo.rotateX(-Math.PI / 2);
  geo.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  const grassA = new THREE.Color(0x6a9a3c), grassB = new THREE.Color(0x4f7d2e), forest = new THREE.Color(0x4f7a2e);
  const soil = new THREE.Color(0x6b4a2e), road = new THREE.Color(0x9a7e58), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, terrainHeight(x, z));
    const n = fbm(x * 0.08, z * 0.08, 3);
    c.copy(grassA).lerp(grassB, n);
    c.lerp(forest, 1 - smoothstep(66, 80, z)); // match the forest colour where they meet
    if (inCorn(x, z)) c.lerp(soil, 0.85);
    const rd = Math.abs(x) - (1.5 + noise2(x * 0.3, z * 0.3) * 0.8);
    if (z > 72 && z < 150) c.lerp(road, (1 - smoothstep(0, 1.2, rd)) * 0.9);
    c.multiplyScalar(0.92 + noise2(x * 0.3, z * 0.3) * 0.16);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / 4, pos.getZ(i) / 4);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, map: groundDetailTexture(), roughness: 0.96 }));
  mesh.receiveShadow = true;
  scene.add(mesh);
  void VILLAGE;
}

function cornGeometry() {
  const parts: { g: THREE.BufferGeometry; c: number }[] = [];
  const stalk = new THREE.CylinderGeometry(0.03, 0.045, 2.4, 5); stalk.translate(0, 1.2, 0);
  parts.push({ g: stalk, c: 0x7f9a3a });
  for (let i = 0; i < 5; i++) {
    const leaf = new THREE.PlaneGeometry(0.12, 0.9); leaf.translate(0, 0.45, 0); leaf.rotateZ(0.9); leaf.rotateY(i * 1.3); leaf.translate(0, 0.5 + i * 0.35, 0);
    parts.push({ g: leaf, c: 0x6f9a34 });
  }
  const cob = new THREE.CylinderGeometry(0.05, 0.04, 0.3, 6); cob.rotateZ(0.3); cob.translate(0.07, 1.5, 0);
  parts.push({ g: cob, c: 0xe8c84a });
  const tassel = new THREE.ConeGeometry(0.08, 0.35, 5); tassel.translate(0, 2.55, 0);
  parts.push({ g: tassel, c: 0xc9a84a });
  const geos = parts.map(({ g, c }) => {
    const ng = g.index ? g.toNonIndexed() : g;
    const col = new THREE.Color(c); const n = ng.attributes.position.count;
    const arr = new Float32Array(n * 3); for (let i = 0; i < n; i++) { arr[i * 3] = col.r; arr[i * 3 + 1] = col.g; arr[i * 3 + 2] = col.b; }
    ng.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    ng.deleteAttribute('uv');
    return ng;
  });
  // merge manually (all non-indexed, same attributes)
  const total = geos.reduce((a, g) => a + g.attributes.position.count, 0);
  const P = new Float32Array(total * 3), N = new Float32Array(total * 3), C = new Float32Array(total * 3);
  let o = 0;
  for (const gg of geos) {
    P.set(gg.attributes.position.array as Float32Array, o * 3);
    N.set(gg.attributes.normal.array as Float32Array, o * 3);
    C.set(gg.attributes.color.array as Float32Array, o * 3);
    o += gg.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(P, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  out.setAttribute('color', new THREE.BufferAttribute(C, 3));
  return out;
}
