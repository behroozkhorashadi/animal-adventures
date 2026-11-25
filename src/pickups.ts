// Food items and floating coin reward tokens.
import * as THREE from 'three';
import { FoodSpawn, FoodType } from './layout';
import { labelTexture, softDotTexture, shadowTexture } from './textures';

const std = (color: number, rough = 0.5, emissive = 0, ei = 0) =>
  new THREE.MeshStandardMaterial({ color, roughness: rough, emissive, emissiveIntensity: ei });

function sphere(g: THREE.Group, m: THREE.Material, r: number, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) {
  const s = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), m);
  s.position.set(x, y, z); s.scale.set(sx, sy, sz); s.castShadow = true; g.add(s); return s;
}

export function buildFoodMesh(type: FoodType): THREE.Group {
  const g = new THREE.Group();
  const leaf = std(0x3f7a2a, 0.7);
  switch (type) {
    case 'berries':
    case 'cranberries': {
      const c = type === 'berries' ? 0x4b2a6e : 0xb3202f;
      const m = std(c, 0.3);
      for (let i = 0; i < 7; i++) sphere(g, m, 0.1, Math.cos(i * 0.9) * 0.14 * (i % 3 ? 1 : 0.4), 0.12 + (i % 2) * 0.1, Math.sin(i * 0.9) * 0.14 * (i % 3 ? 1 : 0.4));
      sphere(g, leaf, 0.16, 0, 0.04, 0, 1.6, 0.25, 1.1);
      break;
    }
    case 'carrot': {
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.55, 10), std(0xe8742a, 0.6));
      c.rotation.x = Math.PI; c.position.y = 0.32; c.castShadow = true; g.add(c);
      for (let i = 0; i < 4; i++) { const l = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.3, 5), leaf); l.position.set(Math.cos(i) * 0.03, 0.72, Math.sin(i) * 0.03); l.rotation.z = (i - 1.5) * 0.25; g.add(l); }
      g.rotation.z = 0.25;
      break;
    }
    case 'apple':
    case 'goldenApple': {
      const gold = type === 'goldenApple';
      sphere(g, gold ? std(0xf2c230, 0.25, 0xb07a10, 0.5) : std(0xc0272a, 0.35), 0.2, 0, 0.22, 0, 1, 0.9, 1);
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.12), std(0x4a3020)); st.position.y = 0.43; g.add(st);
      sphere(g, leaf, 0.06, 0.06, 0.44, 0, 1.6, 0.3, 0.8);
      break;
    }
    case 'seeds': {
      const m = std(0xc9a670, 0.7);
      for (let i = 0; i < 14; i++) sphere(g, m, 0.05, Math.cos(i * 2.4) * (0.05 + (i % 4) * 0.04), 0.05 + (i % 3) * 0.03, Math.sin(i * 2.4) * (0.05 + (i % 4) * 0.04), 1, 0.6, 1.6);
      break;
    }
    case 'mushroom':
    case 'goldenMushroom':
    case 'truffle': {
      const glow = type === 'goldenMushroom';
      const capC = type === 'truffle' ? 0x5a4332 : glow ? 0x6fe3d0 : 0xb4824e;
      if (type === 'truffle') {
        sphere(g, std(0x4a3628, 0.95), 0.18, 0, 0.16, 0, 1.1, 0.85, 1);
        sphere(g, std(0xf0d070, 0.4, 0xd0a020, 0.6), 0.05, 0.12, 0.3, 0.05);
      } else {
        const st = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.22), std(0xf0e6d2)); st.position.y = 0.11; g.add(st);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), std(capC, 0.5, glow ? 0x2fd0b8 : 0, glow ? 0.9 : 0));
        cap.position.y = 0.2; cap.castShadow = true; g.add(cap);
      }
      break;
    }
    case 'melon': {
      const c = document.createElement('canvas'); c.width = 64; c.height = 32;
      const x = c.getContext('2d')!; x.fillStyle = '#3f7a2a'; x.fillRect(0, 0, 64, 32);
      x.fillStyle = '#9cc65a'; for (let i = 0; i < 8; i++) x.fillRect(i * 8, 0, 3, 32);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 10), new THREE.MeshStandardMaterial({ map: t, roughness: 0.4 }));
      m.position.y = 0.24; m.scale.set(1, 0.9, 1.2); m.castShadow = true; g.add(m);
      break;
    }
    case 'fig': {
      for (let i = 0; i < 3; i++) {
        const f = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), std(0x6a3a5a, 0.5));
        f.scale.set(1, 1.25, 1); f.position.set(Math.cos(i * 2.1) * 0.12, 0.13, Math.sin(i * 2.1) * 0.12); f.castShadow = true; g.add(f);
      }
      break;
    }
    case 'honeycomb': {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.14, 6), std(0xf2b42a, 0.3, 0xb07a10, 0.6));
      m.rotation.x = Math.PI / 2; m.position.y = 0.28; m.castShadow = true; g.add(m);
      for (let i = 0; i < 6; i++) { const d = sphere(g, std(0xffd36a, 0.2, 0xffa000, 0.4), 0.05, Math.cos(i) * 0.12, 0.28 + Math.sin(i) * 0.12, 0.08); d.scale.z = 0.4; }
      break;
    }
    case 'starfruit': {
      const shape = new THREE.Shape();
      for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.1 : 0.24, a = (i / 10) * Math.PI * 2; i ? shape.lineTo(Math.cos(a) * r, Math.sin(a) * r) : shape.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
      const m = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03 }), std(0xf6d23a, 0.3, 0xc09010, 0.6));
      m.position.set(0, 0.3, -0.06); m.castShadow = true; g.add(m);
      break;
    }
    case 'goldenMango': {
      sphere(g, std(0xf5a623, 0.3, 0xc06010, 0.5), 0.2, 0, 0.24, 0, 0.9, 1.25, 0.85).rotation.z = 0.5;
      sphere(g, leaf, 0.07, 0.1, 0.46, 0, 1.6, 0.3, 0.8);
      break;
    }
    case 'fish':
    case 'goldenFish': {
      const gold = type === 'goldenFish';
      const m = gold ? std(0xf6c33a, 0.25, 0xc08a10, 0.6) : std(0x8fa7b8, 0.3);
      m.metalness = 0.4;
      const body = sphere(g, m, 0.13, 0, 0.2, 0, 1, 0.8, 2.2);
      body.rotation.z = 0.15;
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.18, 4), m);
      tail.rotation.x = -Math.PI / 2; tail.scale.set(1, 1, 0.25); tail.position.set(0, 0.2, -0.33); g.add(tail);
      sphere(g, std(0x111111, 0.2), 0.022, 0.07, 0.24, 0.2);
      sphere(g, std(0x111111, 0.2), 0.022, -0.07, 0.24, 0.2);
      break;
    }
    case 'drumstick': {
      const bone = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.22), std(0xf4ecd8, 0.5));
      bone.rotation.z = 1.2; bone.position.set(0.16, 0.12, 0); g.add(bone);
      sphere(g, std(0xf4ecd8, 0.5), 0.045, 0.27, 0.16, 0);
      sphere(g, std(0xa8642a, 0.45), 0.13, -0.05, 0.12, 0, 1.5, 0.9, 0.95);
      break;
    }
    case 'roastChicken': {
      sphere(g, std(0xf2f0ea, 0.3), 0.36, 0, 0.02, 0, 1, 0.08, 1);            // plate
      sphere(g, std(0xb8702e, 0.35, 0x5a2a00, 0.2), 0.24, 0, 0.2, 0, 1.2, 0.8, 1); // body
      for (const sx of [-1, 1]) {
        sphere(g, std(0xa8622a, 0.4), 0.1, sx * 0.17, 0.2, 0.17, 1, 0.9, 1.4);
        sphere(g, std(0xf4ecd8, 0.5), 0.035, sx * 0.2, 0.22, 0.32);
      }
      break;
    }
    case 'sandwich': {
      const bread = std(0xe0b56a, 0.8);
      const lay = (m: THREE.Material, y: number, h: number, w = 0.42) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), m); b.position.y = y; b.castShadow = true; g.add(b); };
      lay(bread, 0.05, 0.07); lay(std(0x4f9a3a, 0.7), 0.1, 0.03, 0.46); lay(std(0xd8473a, 0.5), 0.13, 0.03, 0.4); lay(std(0xf2c94c, 0.6), 0.16, 0.03, 0.44); lay(bread, 0.21, 0.07);
      g.rotation.y = 0.5;
      break;
    }
    case 'banana': {
      for (let k = 0; k < 3; k++) {
        const b = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.045, 8, 14, Math.PI * 0.8), std(0xf6d43a, 0.5));
        b.rotation.set(Math.PI / 2, 0, -0.8 + k * 0.3); b.position.set(0, 0.06 + k * 0.03, 0); b.castShadow = true; g.add(b);
      }
      break;
    }
    case 'coconut': {
      sphere(g, std(0x6a4a2a, 0.9), 0.17, 0, 0.17, 0, 1, 0.95, 1);
      for (let k = 0; k < 3; k++) sphere(g, std(0x2a1a0e, 0.9), 0.025, Math.cos(k * 2.1) * 0.05, 0.32, Math.sin(k * 2.1) * 0.05);
      break;
    }
    case 'pineapple': {
      sphere(g, std(0xe8a830, 0.6), 0.14, 0, 0.18, 0, 1, 1.4, 1);
      for (let k = 0; k < 6; k++) { const l = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.22, 4), std(0x3f8a2a, 0.6)); l.position.set(Math.cos(k) * 0.03, 0.44, Math.sin(k) * 0.03); l.rotation.set(Math.sin(k) * 0.4, 0, Math.cos(k) * 0.4); g.add(l); }
      break;
    }
    case 'egg': {
      sphere(g, std(0xfaf4e6, 0.35), 0.11, 0, 0.13, 0, 0.85, 1.1, 0.85);
      break;
    }
    case 'cheese': {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.2, 16, 1, false, 0, Math.PI * 0.45), std(0xf6c945, 0.5));
      m.position.y = 0.1; m.castShadow = true; g.add(m);
      break;
    }
    case 'hotdog': {
      sphere(g, std(0xd9a560, 0.8), 0.1, 0, 0.09, 0, 1, 0.7, 2.6);
      sphere(g, std(0xb4442e, 0.45), 0.065, 0, 0.15, 0, 1, 1, 4.2);
      const mustard = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 4, 12, Math.PI), std(0xf2c230, 0.5));
      mustard.rotation.set(-Math.PI / 2, 0, Math.PI / 2); mustard.position.y = 0.2; mustard.scale.set(1, 2.4, 1); g.add(mustard);
      break;
    }
    case 'applePie': {
      const tin = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.25, 0.1, 20), std(0xa0a4a8, 0.3)); tin.position.y = 0.05; g.add(tin);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.07, 20), std(0xdba45a, 0.7, 0x704010, 0.15)); top.position.y = 0.12; top.castShadow = true; g.add(top);
      for (let i = -2; i <= 2; i++) for (const r of [0, Math.PI / 2]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.52 - Math.abs(i) * 0.08, 0.02, 0.035), std(0xc28440, 0.7)); b.position.set(r ? 0 : 0, 0.165, 0); b.rotation.y = r; b.translateZ(i * 0.1); g.add(b); }
      break;
    }
    case 'cake': {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.28, 24), std(0xf7d6e0, 0.5, 0xc06080, 0.1)); c.position.y = 0.16; c.castShadow = true; g.add(c);
      const icing = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.05, 24), std(0xffffff, 0.4)); icing.position.y = 0.31; g.add(icing);
      sphere(g, std(0xd0102a, 0.3), 0.05, 0, 0.37, 0);
      for (let i = 0; i < 3; i++) { const cnd = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.12), std([0x3b8fd9, 0xf4b532, 0x4f8a3b][i], 0.5)); cnd.position.set(Math.cos(i * 2.1) * 0.15, 0.39, Math.sin(i * 2.1) * 0.15); g.add(cnd); }
      break;
    }
    case 'fishSoup':
    case 'veggieStew':
    case 'heartyStew':
    case 'goldenFeast': {
      const soup = { fishSoup: 0xe8d6a8, veggieStew: 0xd8742a, heartyStew: 0x8a4a22, goldenFeast: 0xf6c33a }[type];
      const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.26, 18, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), std(type === 'goldenFeast' ? 0xf2c230 : 0xf4f0e6, 0.3, type === 'goldenFeast' ? 0xa07000 : 0, type === 'goldenFeast' ? 0.5 : 0));
      bowl.rotation.x = Math.PI; bowl.position.y = 0.26; bowl.castShadow = true; g.add(bowl);
      const top = new THREE.Mesh(new THREE.CircleGeometry(0.24, 18), std(soup, 0.25, soup, 0.15)); top.rotation.x = -Math.PI / 2; top.position.y = 0.24; g.add(top);
      const bits = type === 'fishSoup' ? 0xf08a7a : type === 'veggieStew' ? 0x4f9a3a : 0xc9a670;
      for (let i = 0; i < 5; i++) sphere(g, std(bits, 0.5), 0.035, Math.cos(i * 1.3) * 0.12, 0.25, Math.sin(i * 1.3) * 0.12);
      break;
    }
    case 'berryJam': {
      const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.3, 16), new THREE.MeshStandardMaterial({ color: 0x8a1a4a, roughness: 0.15, transparent: true, opacity: 0.9 }));
      jar.position.y = 0.15; jar.castShadow = true; g.add(jar);
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.06, 16), std(0xd8452e, 0.6)); lid.position.y = 0.33; g.add(lid);
      break;
    }
    case 'krill': {
      const m = std(0xf08a7a, 0.4);
      for (let i = 0; i < 6; i++) {
        const k = sphere(g, m, 0.05, Math.cos(i * 1.1) * 0.13, 0.07 + (i % 2) * 0.05, Math.sin(i * 1.1) * 0.13, 0.7, 0.7, 2.2);
        k.rotation.y = i * 1.1;
      }
      break;
    }
    case 'lotus': {
      const petal = std(0xf3a7c8, 0.4, 0xd06090, 0.35);
      for (let i = 0; i < 8; i++) { const p = sphere(g, petal, 0.12, Math.cos(i * 0.785) * 0.13, 0.18, Math.sin(i * 0.785) * 0.13, 0.5, 1, 0.9); p.rotation.y = -i * 0.785; p.rotation.z = 0.5; }
      sphere(g, std(0xf2d24b, 0.4, 0xc0a020, 0.5), 0.08, 0, 0.24, 0);
      sphere(g, std(0x4f7d34, 0.7), 0.3, 0, 0.04, 0, 1, 0.08, 1);
      break;
    }
  }
  return g;
}

export interface FoodItem {
  spawn: FoodSpawn;
  group: THREE.Group;
  baseY: number;
  active: boolean;
  respawnAt: number;
  sparkle?: THREE.Sprite;
}

export function makeFoodItem(spawn: FoodSpawn, groundY: number, scene: THREE.Scene): FoodItem {
  const outer = new THREE.Group();
  const mesh = buildFoodMesh(spawn.type);
  mesh.scale.setScalar(spawn.rare ? 1.25 : 1.1);
  outer.add(mesh);
  outer.position.set(spawn.x, groundY, spawn.z);
  let sparkle: THREE.Sprite | undefined;
  // a soft glow so food reads clearly against the scenery
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDotTexture(), color: spawn.rare ? 0xffd34a : 0xfff4c0, transparent: true, opacity: spawn.rare ? 0.75 : 0.35, depthWrite: false }));
  glow.scale.setScalar(spawn.rare ? 1.6 : 1.1); glow.position.y = 0.3;
  outer.add(glow);
  if (spawn.rare) sparkle = glow;
  scene.add(outer);
  return { spawn, group: outer, baseY: groundY, active: true, respawnAt: 0, sparkle };
}

// ---------------------------------------------------------------------------
export interface CoinToken {
  group: THREE.Group;
  coin: THREE.Mesh;
  label: THREE.Sprite;
  shadow: THREE.Mesh;
  value: number;
  pos: THREE.Vector3;
  born: number;
  battle: boolean;
  collected: boolean;
}

const coinGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.09, 28);
coinGeo.rotateX(Math.PI / 2);
const coinMat = new THREE.MeshStandardMaterial({ color: 0xf6c443, metalness: 0.75, roughness: 0.28, emissive: 0x9a6a08, emissiveIntensity: 0.45 });
const coinRimGeo = new THREE.TorusGeometry(0.42, 0.05, 8, 28);

export function makeCoin(scene: THREE.Scene, pos: THREE.Vector3, groundY: number, value: number, now: number, battle: boolean): CoinToken {
  const group = new THREE.Group();
  group.position.copy(pos);
  const coin = new THREE.Mesh(coinGeo, coinMat);
  const rim = new THREE.Mesh(coinRimGeo, coinMat);
  coin.add(rim);
  coin.castShadow = true;
  group.add(coin);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDotTexture(), color: 0xffe08a, transparent: true, opacity: 0.6, depthWrite: false }));
  glow.scale.setScalar(1.8);
  group.add(glow);
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(`+${value}`, { color: '#fff7d6', stroke: '#6b4200' }), transparent: true, depthWrite: false, depthTest: false }));
  label.scale.set(1.1, 0.55, 1);
  label.position.y = 0.85;
  label.renderOrder = 5;
  group.add(label);
  scene.add(group);
  // ground marker under the coin so it's easy to line up a jump
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, color: 0x6b4200 }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(pos.x, groundY + 0.05, pos.z);
  scene.add(shadow);
  return { group, coin, label, shadow, value, pos: pos.clone(), born: now, battle, collected: false };
}

export function removeCoin(c: CoinToken) {
  c.group.removeFromParent();
  c.shadow.removeFromParent();
  (c.label.material as THREE.SpriteMaterial).map?.dispose();
  c.label.material.dispose();
}

/** Rolled-up treasure map (the item you find in each area). */
export function buildMapScroll(): THREE.Group {
  const g = new THREE.Group();
  const c = document.createElement('canvas'); c.width = 128; c.height = 64;
  const x = c.getContext('2d')!;
  x.fillStyle = '#ead9a8'; x.fillRect(0, 0, 128, 64);
  x.strokeStyle = '#8a5a2b'; x.lineWidth = 3; x.setLineDash([6, 5]);
  x.beginPath(); x.moveTo(10, 50); x.bezierCurveTo(40, 10, 80, 60, 110, 18); x.stroke();
  x.setLineDash([]); x.strokeStyle = '#c0392b'; x.lineWidth = 5;
  x.beginPath(); x.moveTo(100, 10); x.lineTo(118, 28); x.moveTo(118, 10); x.lineTo(100, 28); x.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const paper = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.75, 16, 1, true), new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide, roughness: 0.8 }));
  paper.rotation.z = Math.PI / 2; paper.position.y = 0.45; paper.castShadow = true; g.add(paper);
  const rib = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.03, 6, 16), new THREE.MeshStandardMaterial({ color: 0xc0392b }));
  rib.rotation.y = Math.PI / 2; rib.position.y = 0.45; g.add(rib);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDotTexture(), color: 0xffe9a0, transparent: true, opacity: 0.8, depthWrite: false }));
  glow.scale.setScalar(2); glow.position.y = 0.45; g.add(glow);
  return g;
}

/** Tall soft light beam that marks food once you've found that area's map. */
export function buildBeam(rare: boolean): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(0.25, 0.45, 9, 10, 1, true);
  geo.translate(0, 4.5, 0);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: rare ? 0xffd34a : 0x9fe8ff, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  m.renderOrder = 3;
  return m;
}
