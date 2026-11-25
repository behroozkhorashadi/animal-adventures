import * as THREE from 'three';
import type { AnimalRig } from './animals';

/** Clothes your pets can wear. */
export const OUTFITS: { id: string; name: string }[] = [
  { id: 'none', name: '🚫 Nothing' },
  { id: 'bow', name: '🎀 Pink bow' },
  { id: 'tophat', name: '🎩 Top hat' },
  { id: 'crown', name: '👑 Crown' },
  { id: 'party', name: '🥳 Party hat' },
  { id: 'glasses', name: '🕶️ Sunglasses' },
  { id: 'scarf', name: '🧣 Cosy scarf' },
  { id: 'flower', name: '🌸 Flower' },
  { id: 'cowboy', name: '🤠 Cowboy hat' },
  { id: 'beanie', name: '🧢 Cosy beanie' },
  { id: 'witch', name: '🧙 Wizard hat' },
  { id: 'pirate', name: '🏴‍☠️ Pirate hat' },
  { id: 'tiara', name: '💎 Sparkly tiara' },
];

const mat = (c: number, e = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, emissive: e ? c : 0x000000, emissiveIntensity: e });

/** Put an outfit on a pet (removes any old one first). */
export function dressRig(rig: AnimalRig, outfit: string | undefined) {
  const head = rig.head;
  const old = head.getObjectByName('outfit'); if (old) { old.removeFromParent(); }
  if (!outfit || outfit === 'none') return;
  // measure the head in its own space so the clothes fit any animal
  rig.root.updateMatrixWorld(true);
  const wb = new THREE.Box3().setFromObject(head);
  if (wb.isEmpty()) return;
  const inv = new THREE.Matrix4().copy(head.matrixWorld).invert();
  const lb = new THREE.Box3();
  for (const x of [wb.min.x, wb.max.x]) for (const y of [wb.min.y, wb.max.y]) for (const z of [wb.min.z, wb.max.z]) lb.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(inv));
  const size = lb.getSize(new THREE.Vector3()), c = lb.getCenter(new THREE.Vector3());
  const s = Math.max(0.12, Math.min(size.x, size.z) * 0.9);   // how big the clothes are
  const g = new THREE.Group(); g.name = 'outfit';
  const top = new THREE.Vector3(c.x, lb.max.y - s * 0.08, c.z - size.z * 0.12);
  const add = (m: THREE.Mesh, x: number, y: number, z: number) => { m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  switch (outfit) {
    case 'bow': {
      const pink = mat(0xff5aa8);
      for (const sx of [-1, 1]) { const l = add(new THREE.Mesh(new THREE.ConeGeometry(s * 0.22, s * 0.38, 4), pink), top.x + sx * s * 0.2, top.y + s * 0.08, top.z); l.rotation.z = sx * Math.PI / 2; }
      add(new THREE.Mesh(new THREE.SphereGeometry(s * 0.1, 8, 6), pink), top.x, top.y + s * 0.08, top.z);
      break;
    }
    case 'tophat': {
      const blk = mat(0x1a1a22);
      add(new THREE.Mesh(new THREE.CylinderGeometry(s * 0.55, s * 0.55, s * 0.05, 16), blk), top.x, top.y, top.z);
      add(new THREE.Mesh(new THREE.CylinderGeometry(s * 0.34, s * 0.36, s * 0.6, 16), blk), top.x, top.y + s * 0.3, top.z);
      add(new THREE.Mesh(new THREE.CylinderGeometry(s * 0.365, s * 0.37, s * 0.1, 16), mat(0xd23a3a)), top.x, top.y + s * 0.08, top.z);
      break;
    }
    case 'crown': {
      const gold = mat(0xffc83a, 0.25);
      add(new THREE.Mesh(new THREE.CylinderGeometry(s * 0.36, s * 0.34, s * 0.18, 12, 1, true), gold), top.x, top.y + s * 0.09, top.z).material = Object.assign(gold.clone(), { side: THREE.DoubleSide });
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; add(new THREE.Mesh(new THREE.ConeGeometry(s * 0.07, s * 0.2, 4), gold), top.x + Math.cos(a) * s * 0.34, top.y + s * 0.26, top.z + Math.sin(a) * s * 0.34); }
      add(new THREE.Mesh(new THREE.SphereGeometry(s * 0.06, 8, 6), mat(0xe0304a, 0.4)), top.x, top.y + s * 0.1, top.z + s * 0.35);
      break;
    }
    case 'party': {
      const cone = add(new THREE.Mesh(new THREE.ConeGeometry(s * 0.3, s * 0.75, 14), mat(0x4ab0ff)), top.x, top.y + s * 0.36, top.z);
      void cone;
      add(new THREE.Mesh(new THREE.SphereGeometry(s * 0.09, 8, 6), mat(0xffe04a, 0.3)), top.x, top.y + s * 0.76, top.z);
      for (let k = 0; k < 5; k++) add(new THREE.Mesh(new THREE.SphereGeometry(s * 0.04, 6, 5), mat([0xff5aa8, 0xffe04a, 0x5ad86a][k % 3])), top.x + Math.cos(k * 1.3) * s * 0.2, top.y + s * (0.15 + k * 0.08), top.z + Math.sin(k * 1.3) * s * 0.2);
      break;
    }
    case 'cowboy': {
      const br = mat(0x9a6a3a);
      const brim = add(new THREE.Mesh(new THREE.CylinderGeometry(s * 0.7, s * 0.7, s * 0.05, 18), br), top.x, top.y, top.z); brim.scale.z = 0.8;
      add(new THREE.Mesh(new THREE.CylinderGeometry(s * 0.3, s * 0.38, s * 0.4, 14), br), top.x, top.y + s * 0.2, top.z);
      break;
    }
    case 'beanie': {
      const bn = add(new THREE.Mesh(new THREE.SphereGeometry(s * 0.42, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x3ab8a8)), top.x, top.y - s * 0.12, top.z); void bn;
      add(new THREE.Mesh(new THREE.CylinderGeometry(s * 0.43, s * 0.43, s * 0.1, 16), mat(0xffffff)), top.x, top.y - s * 0.1, top.z);
      add(new THREE.Mesh(new THREE.SphereGeometry(s * 0.12, 10, 8), mat(0xffffff)), top.x, top.y + s * 0.33, top.z);
      break;
    }
    case 'witch': {
      const pu = mat(0x6a3ab8);
      add(new THREE.Mesh(new THREE.CylinderGeometry(s * 0.62, s * 0.62, s * 0.04, 18), pu), top.x, top.y, top.z);
      const cn = add(new THREE.Mesh(new THREE.ConeGeometry(s * 0.34, s * 0.95, 16), pu), top.x, top.y + s * 0.46, top.z); cn.rotation.z = 0.15;
      for (let k = 0; k < 3; k++) add(new THREE.Mesh(new THREE.OctahedronGeometry(s * 0.06), mat(0xffe04a, 0.5)), top.x + (k - 1) * s * 0.12, top.y + s * (0.25 + k * 0.15), top.z + s * 0.25);
      break;
    }
    case 'pirate': {
      const blk = mat(0x1a1a22);
      const br = add(new THREE.Mesh(new THREE.CylinderGeometry(s * 0.6, s * 0.6, s * 0.05, 3), blk), top.x, top.y, top.z); br.rotation.y = Math.PI / 2;
      add(new THREE.Mesh(new THREE.CylinderGeometry(s * 0.3, s * 0.38, s * 0.35, 14), blk), top.x, top.y + s * 0.17, top.z);
      add(new THREE.Mesh(new THREE.SphereGeometry(s * 0.08, 8, 6), mat(0xffffff)), top.x, top.y + s * 0.2, top.z + s * 0.35);
      break;
    }
    case 'tiara': {
      const sil = new THREE.MeshStandardMaterial({ color: 0xe8e8ff, metalness: 0.8, roughness: 0.2, emissive: 0x5a5a8a, emissiveIntensity: 0.3 });
      const band = add(new THREE.Mesh(new THREE.TorusGeometry(s * 0.34, s * 0.03, 6, 20, Math.PI), sil), top.x, top.y + s * 0.02, top.z); band.rotation.x = -0.3;
      for (let k = -2; k <= 2; k++) add(new THREE.Mesh(new THREE.OctahedronGeometry(s * (k === 0 ? 0.1 : 0.06)), mat([0xff5aa8, 0x4ab0ff, 0xffffff][Math.abs(k) % 3], 0.4)), top.x + k * s * 0.14, top.y + s * (0.14 - Math.abs(k) * 0.03), top.z + s * 0.12);
      break;
    }
    case 'flower': {
      const fx = c.x + size.x * 0.3, fy = lb.max.y - s * 0.12, fz = c.z;
      for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; add(new THREE.Mesh(new THREE.SphereGeometry(s * 0.09, 8, 6), mat(0xff8ac8)), fx, fy + Math.sin(a) * s * 0.1, fz + Math.cos(a) * s * 0.1); }
      add(new THREE.Mesh(new THREE.SphereGeometry(s * 0.07, 8, 6), mat(0xffe04a, 0.3)), fx + s * 0.04, fy, fz);
      break;
    }
    case 'glasses': {
      const blk = mat(0x111118);
      const gz = lb.max.z + s * 0.02, gy = c.y + size.y * 0.15;
      for (const sx of [-1, 1]) { const lens = add(new THREE.Mesh(new THREE.CylinderGeometry(s * 0.15, s * 0.15, s * 0.04, 14), blk), c.x + sx * Math.min(size.x * 0.25, s * 0.2), gy, gz - s * 0.05); lens.rotation.x = Math.PI / 2; }
      add(new THREE.Mesh(new THREE.BoxGeometry(s * 0.16, s * 0.04, s * 0.04), blk), c.x, gy, gz - s * 0.05);
      break;
    }
    case 'scarf': {
      const red = mat(0xd83a3a);
      const ring = add(new THREE.Mesh(new THREE.TorusGeometry(Math.max(size.x, size.z) * 0.42, s * 0.12, 8, 18), red), c.x, lb.min.y + s * 0.05, c.z);
      ring.rotation.x = Math.PI / 2;
      add(new THREE.Mesh(new THREE.BoxGeometry(s * 0.18, s * 0.45, s * 0.06), red), c.x + size.x * 0.2, lb.min.y - s * 0.18, lb.max.z - s * 0.1);
      break;
    }
  }
  head.add(g);
}

/** Clothes for your pet's body. */
export const CLOTHES: { id: string; name: string }[] = [
  { id: 'none', name: '🚫 No clothes' },
  { id: 'tshirt', name: '👕 Blue T-shirt' },
  { id: 'sweater', name: '🧶 Stripy sweater' },
  { id: 'raincoat', name: '🧥 Yellow raincoat' },
  { id: 'dress', name: '👗 Pink dress' },
  { id: 'tutu', name: '🩰 Ballet tutu' },
  { id: 'cape', name: '🦸 Hero cape' },
  { id: 'princess', name: '👸 Princess cape' },
  { id: 'backpack', name: '🎒 Backpack' },
  { id: 'collar', name: '📿 Collar with a tag' },
  { id: 'bowtie', name: '🎀 Fancy bow tie' },
  { id: 'pajamas', name: '🌙 Star pajamas' },
];

function stripes(a: string, b: string, n = 8, stars = false) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d')!;
  for (let i = 0; i < n; i++) { x.fillStyle = i % 2 ? b : a; x.fillRect(0, (i * 128) / n, 128, 128 / n + 1); }
  if (stars) { x.fillStyle = '#ffe27a'; x.font = '22px sans-serif'; for (let i = 0; i < 9; i++) x.fillText('★', (i * 47) % 120, 20 + ((i * 31) % 110)); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Put clothes on a pet's body (removes the old clothes first). */
export function dressBody(rig: AnimalRig, clothes: string | undefined) {
  const B = rig.body;
  const old = B.getObjectByName('clothes'); if (old) old.removeFromParent();
  if (!clothes || clothes === 'none') return;
  // find the torso: the biggest shape on the body
  let torso: THREE.Mesh | null = null, best = 0;
  for (const ch of B.children) {
    if (!(ch instanceof THREE.Mesh) || ch === rig.head) continue;
    const gb = (ch.geometry.boundingBox ?? (ch.geometry.computeBoundingBox(), ch.geometry.boundingBox))!;
    ch.updateMatrix();
    if (gb.clone().applyMatrix4(ch.matrix).containsPoint(rig.head.position)) continue;   // that's a mane, not a tummy!
    const sz = gb.getSize(new THREE.Vector3()).multiply(ch.scale);
    const v = sz.x * sz.y * sz.z; if (v > best) { best = v; torso = ch; }
  }
  if (!torso) return;
  torso.updateMatrix();
  const box = torso.geometry.boundingBox!.clone().applyMatrix4(torso.matrix);
  const s = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const upright = s.y > s.z * 1.15;      // people, penguins, monkeys…
  const g = new THREE.Group(); g.name = 'clothes';
  const M = (color: number, map?: THREE.Texture, side: THREE.Side = THREE.FrontSide) => new THREE.MeshStandardMaterial({ color, map, roughness: 0.7, side });
  const shell = (m: THREE.Material, k = 1.1) => { const sh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 14), m); sh.scale.set(s.x * k, s.y * k, s.z * (upright ? k : k * 0.92)); sh.position.copy(c); g.add(sh); return sh; };
  const skirt = (color: number, len: number, flare: number) => {
    const r = Math.max(s.x, upright ? s.z : s.y) * 0.55;
    const sk = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.02, r * flare, len, 20, 1, true), M(color, undefined, THREE.DoubleSide));
    if (upright) sk.position.set(c.x, box.min.y + len * 0.3, c.z);
    else { sk.rotation.x = Math.PI / 2; sk.position.set(c.x, c.y, box.min.z + s.z * 0.25); }
    g.add(sk); return sk;
  };
  const cape = (color: number, trim: number) => {
    if (upright) {
      const cp = new THREE.Mesh(new THREE.PlaneGeometry(s.x * 1.2, s.y * 1.25), M(color, undefined, THREE.DoubleSide)); cp.position.set(c.x, c.y - s.y * 0.05, box.min.z - 0.04); cp.rotation.x = 0.12; g.add(cp);
      const t2 = new THREE.Mesh(new THREE.BoxGeometry(s.x * 1.2, 0.05, 0.06), M(trim)); t2.position.set(c.x, box.max.y - 0.02, box.min.z - 0.02); g.add(t2);
    } else {
      const r = s.x * 0.62;
      const cp = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.15, s.z * 1.05, 20, 1, true, -Math.PI * 0.55, Math.PI * 1.1), M(color, undefined, THREE.DoubleSide));
      cp.rotation.x = Math.PI / 2; cp.rotation.y = 0; cp.position.set(c.x, c.y + s.y * 0.12, c.z - s.z * 0.05); g.add(cp);
      const t2 = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.01, r * 1.01, s.z * 0.08, 20, 1, true, -Math.PI * 0.55, Math.PI * 1.1), M(trim, undefined, THREE.DoubleSide)); t2.rotation.x = Math.PI / 2; t2.position.set(c.x, c.y + s.y * 0.12, box.max.z - s.z * 0.1); g.add(t2);
    }
  };
  // the neck: between the torso and the head
  const hp = rig.head.position.clone();
  const neck = upright ? new THREE.Vector3(c.x, box.max.y, c.z + s.z * 0.15) : new THREE.Vector3(c.x, (c.y + hp.y) / 2 + s.y * 0.05, box.max.z * 0.85 + hp.z * 0.15);
  switch (clothes) {
    case 'tshirt': shell(M(0x4a8aff)); break;
    case 'sweater': shell(M(0xffffff, stripes('#e84a5a', '#ffffff')), 1.13); break;
    case 'raincoat': { shell(M(0xffd23a), 1.12); const b2 = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 5), M(0x333333)); for (let k = 0; k < 3; k++) { const bt = b2.clone(); bt.position.set(c.x, c.y - s.y * 0.1 + (upright ? k * s.y * 0.2 : 0), upright ? box.max.z + 0.02 : c.z + (k - 1) * s.z * 0.2); if (!upright) bt.position.y = box.min.y + 0.02; g.add(bt); } break; }
    case 'pajamas': shell(M(0xffffff, stripes('#3a4ab8', '#5a6ad8', 4, true)), 1.12); break;
    case 'dress': shell(M(0xff8ac8), 1.1); skirt(0xff8ac8, upright ? s.y * 0.6 : s.z * 0.6, 1.7); break;
    case 'tutu': { const sk = skirt(0xffb8e0, 0.12, 1.6); sk.material = new THREE.MeshStandardMaterial({ color: 0xffb8e0, transparent: true, opacity: 0.85, side: THREE.DoubleSide }); const sk2 = skirt(0xffffff, 0.1, 1.4); sk2.position.add(new THREE.Vector3(0, upright ? 0.05 : 0, upright ? 0 : 0.05)); break; }
    case 'cape': cape(0xd8303a, 0xffd23a); break;
    case 'princess': cape(0xb06aff, 0xffd23a); break;
    case 'backpack': {
      const bp = new THREE.Mesh(new THREE.BoxGeometry(s.x * 0.7, upright ? s.y * 0.5 : s.y * 0.35, upright ? s.z * 0.45 : s.z * 0.35), M(0x3ab86a));
      if (upright) bp.position.set(c.x, c.y + s.y * 0.05, box.min.z - s.z * 0.18); else bp.position.set(c.x, box.max.y + s.y * 0.12, c.z);
      g.add(bp);
      const pocket = new THREE.Mesh(new THREE.BoxGeometry(s.x * 0.5, s.y * 0.15, 0.04), M(0xffd23a)); pocket.position.copy(bp.position); if (upright) pocket.position.z -= s.z * 0.24; else { pocket.position.y += s.y * 0.05; pocket.position.z -= s.z * 0.18; } g.add(pocket);
      break;
    }
    case 'collar': {
      const r = Math.max(s.x * 0.36, 0.12);
      const col = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.16, 8, 20), M(0xe8303a)); col.position.copy(neck); col.lookAt(hp); g.add(col);
      const tag = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.3, r * 0.3, 0.02, 12), new THREE.MeshStandardMaterial({ color: 0xffc83a, metalness: 0.7, roughness: 0.3 }));
      tag.rotation.x = Math.PI / 2; tag.position.set(neck.x, neck.y - r * 1.1, neck.z + r * 0.3); g.add(tag);
      break;
    }
    case 'bowtie': {
      const r = Math.max(s.x * 0.18, 0.06), m = M(0x2a2a8a);
      for (const sx of [-1, 1]) { const w = new THREE.Mesh(new THREE.ConeGeometry(r, r * 1.6, 4), m); w.rotation.z = sx * Math.PI / 2; w.position.set(neck.x + sx * r * 0.75, neck.y - r * 0.4, neck.z + r * 0.8); g.add(w); }
      const k2 = new THREE.Mesh(new THREE.SphereGeometry(r * 0.4, 8, 6), m); k2.position.set(neck.x, neck.y - r * 0.4, neck.z + r * 0.85); g.add(k2);
      break;
    }
  }
  g.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = true; });
  B.add(g);
}
