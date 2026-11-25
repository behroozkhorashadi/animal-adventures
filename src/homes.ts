// Home buildings for each tier (procedural).
import * as THREE from 'three';
import { plankTexture, roofTexture, stoneTexture, barkTexture } from './textures';

function std(color: number, map?: THREE.Texture | null, rough = 0.85) {
  return new THREE.MeshStandardMaterial({ color, map: map ?? null, roughness: rough });
}
function box(g: THREE.Object3D, m: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, ry = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z); mesh.rotation.y = ry;
  mesh.castShadow = true; mesh.receiveShadow = true;
  g.add(mesh); return mesh;
}
function cylinder(g: THREE.Object3D, m: THREE.Material, r: number, h: number, x: number, y: number, z: number, rx = 0, rz = 0) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 10), m);
  mesh.position.set(x, y, z); mesh.rotation.set(rx, 0, rz);
  mesh.castShadow = true; mesh.receiveShadow = true;
  g.add(mesh); return mesh;
}

/** Gable roof as a triangular prism. */
function roof(g: THREE.Object3D, m: THREE.Material, w: number, d: number, h: number, y: number, overhang = 0.4) {
  const W = w / 2 + overhang, D = d / 2 + overhang;
  const shape = new THREE.Shape();
  shape.moveTo(-W, 0); shape.lineTo(0, h); shape.lineTo(W, 0); shape.lineTo(-W, 0);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: D * 2, bevelEnabled: false });
  geo.translate(0, 0, -D);
  // re-UV roughly so the tile texture lines up
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getZ(i) + D) / 3, (pos.getY(i) + Math.abs(pos.getX(i))) / 2);
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.y = y; mesh.castShadow = true; mesh.receiveShadow = true;
  g.add(mesh); return mesh;
}

function windowPane(g: THREE.Object3D, w: number, h: number, x: number, y: number, z: number, ry = 0) {
  const frame = std(0xf2e6cf);
  const glass = new THREE.MeshStandardMaterial({ color: 0xffd98a, emissive: 0xffb84d, emissiveIntensity: 0.35, roughness: 0.3 });
  const f = box(g, frame, w + 0.12, h + 0.12, 0.08, x, y, z, ry);
  const p = box(g, glass, w, h, 0.1, x, y, z, ry);
  const bar = box(g, frame, 0.05, h, 0.12, x, y, z, ry);
  return [f, p, bar];
}

export interface HomeBuild { group: THREE.Group; halfW: number; halfD: number; }

export function buildHome(tier: number): HomeBuild {
  const g = new THREE.Group();
  const logs = std(0xffffff, plankTexture(0x8a6440, true));
  const wood = std(0xffffff, plankTexture(0x9b7048, false));
  const door = std(0x5e3b22, plankTexture(0x5e3b22, false));
  let halfW = 1.6, halfD = 1.4;

  if (tier === 0) {
    // Tiny lean-to shelter of sticks and leaves
    const bark = std(0xffffff, barkTexture(0x6b4f35));
    const leaves = std(0x7aa84a, null, 0.95);
    for (const x of [-1.3, 1.3]) cylinder(g, bark, 0.09, 2.0, x, 1.0, 1.0);
    cylinder(g, bark, 0.08, 2.8, 0, 2.0, 1.0, 0, Math.PI / 2);
    const r = box(g, leaves, 3.0, 0.15, 2.6, 0, 1.05, -0.05);
    r.rotation.x = -0.72;
    for (let i = -3; i <= 3; i++) {
      const s = cylinder(g, bark, 0.05, 2.6, i * 0.42, 1.05, -0.05, Math.PI / 2 - 0.72);
      s.position.y += 0.08;
    }
    const hay = std(0xd8b25a, null, 1);
    const bed = new THREE.Mesh(new THREE.SphereGeometry(0.75, 14, 8), hay);
    bed.scale.set(1.2, 0.25, 0.8); bed.position.set(0, 0.1, -0.1); bed.receiveShadow = true;
    g.add(bed);
    halfW = 1.5; halfD = 1.3;
  } else if (tier === 1) {
    // Small log cabin
    box(g, logs, 4, 2.6, 3.6, 0, 1.3, 0);
    for (const [x, z] of [[-2, -1.8], [2, -1.8], [-2, 1.8], [2, 1.8]]) cylinder(g, wood, 0.16, 2.8, x, 1.4, z);
    roof(g, std(0xffffff, roofTexture(0x7a4a2c)), 4, 3.6, 1.6, 2.6);
    box(g, door, 0.9, 1.7, 0.1, 0, 0.85, 1.82).name = 'door';
    windowPane(g, 0.7, 0.6, 1.25, 1.55, 1.82);
    box(g, std(0x6e665c, stoneTexture(0x8a857c)), 1.4, 0.15, 0.7, 0, 0.07, 2.2);
    halfW = 2.1; halfD = 1.9;
  } else if (tier === 2) {
    // Woodland house: stone base, chimney, porch, two windows
    const stone = std(0xffffff, stoneTexture(0x8a857c));
    box(g, stone, 6, 0.9, 5, 0, 0.45, 0);
    box(g, std(0xffffff, plankTexture(0xb5895a, false)), 6, 2.8, 5, 0, 2.3, 0);
    roof(g, std(0xffffff, roofTexture(0x5c6b3a)), 6, 5, 2.2, 3.7, 0.5);
    box(g, stone, 0.9, 3.2, 0.9, 1.8, 5.2, -1.2);
    box(g, door, 1.0, 2.0, 0.1, 0, 1.4, 2.53).name = 'door';
    windowPane(g, 0.9, 0.8, -1.8, 2.4, 2.53);
    windowPane(g, 0.9, 0.8, 1.8, 2.4, 2.53);
    windowPane(g, 0.9, 0.8, 3.03, 2.4, 0, Math.PI / 2);
    windowPane(g, 0.9, 0.8, -3.03, 2.4, 0, Math.PI / 2);
    // porch
    box(g, wood, 3.4, 0.2, 1.6, 0, 0.6, 3.3);
    for (const x of [-1.5, 1.5]) cylinder(g, wood, 0.1, 2.2, x, 1.7, 4.0);
    box(g, std(0xffffff, roofTexture(0x5c6b3a)), 3.8, 0.12, 2.0, 0, 2.85, 3.3);
    halfW = 3.1; halfD = 2.6;
  } else if (tier >= 5) {
    // Crystal Castle (5) / Rainbow Palace (6)
    const palace = tier >= 6;
    const wallM = palace ? std(0xfdf8f0, null, 0.6) : std(0xffffff, stoneTexture(0x9a96a8));
    const roofM = palace ? new THREE.MeshStandardMaterial({ color: 0xffc83a, metalness: 0.7, roughness: 0.25 }) : std(0x4a5ac8, null, 0.5);
    box(g, wallM, 10, 5, 6.4, 0, 2.5, -0.3);
    // battlements / trim
    for (let i = 0; i < 11; i++) box(g, wallM, 0.6, 0.6, 0.6, -5 + i, 5.3, 2.9);
    for (const [x, z] of [[-5.2, 2.6], [5.2, 2.6], [-5.2, -3.2], [5.2, -3.2]]) {
      const tw = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 7.5, 16), wallM); tw.position.set(x, 3.75, z); tw.castShadow = true; g.add(tw);
      const top = palace ? new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), roofM) : new THREE.Mesh(new THREE.ConeGeometry(1.4, 2.6, 16), roofM);
      top.position.set(x, palace ? 7.5 : 8.8, z); top.castShadow = true; g.add(top);
      if (palace) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.15, 1.2, 8), roofM); sp.position.set(x, 9.2, z); g.add(sp); }
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 6), std(0x555555, null, 0.5)); pole.position.set(x, palace ? 10.4 : 10.8, z); g.add(pole);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55), new THREE.MeshStandardMaterial({ color: palace ? 0xff5aa8 : 0xd8303a, side: THREE.DoubleSide })); flag.position.set(x + 0.45, palace ? 10.9 : 11.3, z); g.add(flag);
      for (let k = 0; k < 3; k++) windowPane(g, 0.5, 0.8, x, 2 + k * 1.8, z + 1.15);
    }
    // the big gate
    box(g, door, 2.2, 3.2, 0.15, 0, 1.6, 2.98).name = 'door';
    const arch = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.18, 8, 16, Math.PI), roofM); arch.position.set(0, 3.2, 3.0); g.add(arch);
    for (const x of [-3, 3]) windowPane(g, 1.0, 1.2, x, 3.2, 2.93);
    // crystals (castle) or a rainbow and fountain (palace)
    if (!palace) {
      const crys = new THREE.MeshStandardMaterial({ color: 0x9ae0ff, emissive: 0x4aa8ff, emissiveIntensity: 0.7, transparent: true, opacity: 0.85, roughness: 0.1 });
      for (const [x, z, s] of [[-3.5, 4.2, 0.8], [3.5, 4.2, 0.9], [-1.8, 4.6, 0.5], [1.8, 4.6, 0.6], [0, 6.2, 0.4]]) { const c = new THREE.Mesh(new THREE.OctahedronGeometry(s), crys); c.scale.y = 2; c.position.set(x, s * 1.6, z); g.add(c); }
      for (let i = 0; i < 4; i++) { const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.5), crys); c.scale.y = 2.2; c.position.set(-3 + i * 2, 7, -0.3); g.add(c); }
    } else {
      const cols = [0xff4a5a, 0xff9a3a, 0xffe04a, 0x4ad86a, 0x4aa8ff, 0xb06aff];
      cols.forEach((c, k) => { const a = new THREE.Mesh(new THREE.TorusGeometry(7 - k * 0.35, 0.18, 8, 40, Math.PI), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.25 })); a.position.set(0, 0, -3.6); g.add(a); });
      const dome = new THREE.Mesh(new THREE.SphereGeometry(2.2, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), roofM); dome.position.set(0, 5, -0.3); g.add(dome);
      const basin = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.5, 0.5, 20), wallM); basin.position.set(0, 0.25, 5.6); g.add(basin);
      const water = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.05, 20), new THREE.MeshStandardMaterial({ color: 0x4ac8ff, emissive: 0x2a8ad8, emissiveIntensity: 0.4 })); water.position.set(0, 0.5, 5.6); g.add(water);
      const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 1.4, 10), wallM); spout.position.set(0, 1.1, 5.6); g.add(spout);
      const top = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 8), new THREE.MeshStandardMaterial({ color: 0x9ae0ff, transparent: true, opacity: 0.7 })); top.position.set(0, 1.9, 5.6); g.add(top);
    }
    halfW = 6.4; halfD = 3.6;
  } else {
    // Large animal lodge: two storeys, wings, big roof, lanterns, flower boxes
    const stone = std(0xffffff, stoneTexture(0x7d7a72));
    box(g, stone, 9, 1.2, 7, 0, 0.6, 0);
    box(g, logs, 9, 2.8, 7, 0, 2.6, 0);
    box(g, std(0xffffff, plankTexture(0xc19a6b, false)), 8.4, 2.4, 6.4, 0, 5.2, 0);
    roof(g, std(0xffffff, roofTexture(0x8a3a2a)), 8.4, 6.4, 3.2, 6.4, 0.7);
    // side wings
    for (const sx of [-1, 1]) {
      box(g, logs, 3, 3.4, 5, sx * 6, 1.7, 0.2);
      const r = roof(g, std(0xffffff, roofTexture(0x8a3a2a)), 5, 3, 1.4, 3.4, 0.3);
      r.rotation.y = Math.PI / 2; r.position.x = sx * 6; r.position.z = 0.2;
      windowPane(g, 0.9, 0.8, sx * 6, 1.9, 2.73);
    }
    box(g, stone, 1.2, 4, 1.2, -2.6, 8.6, -1.6);
    box(g, door, 1.6, 2.4, 0.1, 0, 2.4, 3.53).name = 'door';
    for (const x of [-3, -1.6, 1.6, 3]) windowPane(g, 0.8, 0.9, x, 2.7, 3.53);
    for (const x of [-2.8, -0.9, 0.9, 2.8]) windowPane(g, 0.8, 0.9, x, 5.3, 3.23);
    // porch + steps
    box(g, wood, 5.2, 0.25, 2.2, 0, 1.1, 4.6);
    box(g, wood, 2.2, 0.25, 0.8, 0, 0.6, 6.0);
    for (const x of [-2.4, 2.4]) cylinder(g, wood, 0.14, 3.2, x, 2.6, 5.5);
    box(g, std(0xffffff, roofTexture(0x8a3a2a)), 5.8, 0.15, 2.6, 0, 4.2, 4.7);
    // flower boxes
    const flowers = [0xe4475b, 0xf2c14e, 0xb56be0, 0xf08a3c];
    for (const x of [-3, -1.6, 1.6, 3]) {
      box(g, wood, 1.0, 0.25, 0.3, x, 2.1, 3.7);
      for (let i = 0; i < 4; i++) {
        const f = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 4), std(flowers[(i + Math.round(x)) & 3], null, 0.7));
        f.position.set(x - 0.35 + i * 0.23, 2.3, 3.7); g.add(f);
      }
    }
    // lanterns
    const lampM = new THREE.MeshStandardMaterial({ color: 0xffe0a0, emissive: 0xffb040, emissiveIntensity: 1.2 });
    for (const x of [-2.4, 2.4]) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), lampM); l.position.set(x, 3.4, 5.25); g.add(l); }
    halfW = 7.5; halfD = 3.6;
    if (tier === 4) {
      // a giant tree behind the lodge, with a treehouse up top and a rope ladder
      const bark = std(0xffffff, barkTexture(0x6b4f35));
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.6, 13, 14), bark); trunk.position.set(6.5, 6.5, -5); trunk.castShadow = true; g.add(trunk);
      const leafM = std(0x4a9a3a, null, 0.9);
      for (const [x, y, z, r] of [[6.5, 15, -5, 4], [4, 13.5, -4, 2.8], [9, 13.8, -6, 3], [6.5, 13, -2.5, 2.6]]) { const l = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), leafM); l.position.set(x, y, z); l.castShadow = true; g.add(l); }
      box(g, wood, 6, 0.3, 5, 6.5, 10, -5);
      box(g, std(0xffffff, plankTexture(0xc8a070, false)), 4, 2.6, 3.4, 6.5, 11.45, -5);
      { const tr = roof(g, std(0xffffff, roofTexture(0x3a7a4a)), 4, 3.4, 1.4, 12.75, 0.3); tr.position.x = 6.5; tr.position.z = -5; }
      windowPane(g, 0.7, 0.6, 6.5, 11.6, -3.27);
      for (let i = 0; i < 9; i++) cylinder(g, std(0xc8a060, null, 0.9), 0.04, 1.0, 6.5, 1 + i * 1.0, -2.3, 0, Math.PI / 2);
      for (const x of [6.0, 7.0]) cylinder(g, std(0xc8a060, null, 0.9), 0.03, 9.5, x, 5, -2.3);
    }
  }
  return { group: g, halfW, halfD };
}
