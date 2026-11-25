// Secret places: hidden doors (5 in each area). Find the door's secret map, solve 3 math problems,
// and step inside a secret room with glowing crystals and a treasure chest.
import * as THREE from 'three';
import { CollisionWorld, terrainHeight } from './terrain';
import { SECRET_SPOTS, SecretSpot } from './secretspots';
import { buildMapScroll } from './pickups';

export const SECRET_ROOM = { x: 0, z: -900, r: 7 };

const LOOK: Record<string, { rock: number; door: number; glow: number; floor: number; wall: number; crystal: number; label: string }> = {
  forest: { rock: 0x6a7a5a, door: 0x5a3a22, glow: 0x9fe870, floor: 0x4a5a32, wall: 0x3e4a2c, crystal: 0x9fe870, label: '🍄' },
  savanna: { rock: 0xc8a06a, door: 0x8a5a2a, glow: 0xffc83a, floor: 0xd8b880, wall: 0xb8905a, crystal: 0xffc83a, label: '☀️' },
  swamp: { rock: 0x4a5a42, door: 0x3a2a1a, glow: 0x7ae0c8, floor: 0x3a4a30, wall: 0x2e3a26, crystal: 0x7ae0c8, label: '🐸' },
  village: { rock: 0x9a8a7a, door: 0x6a4a2a, glow: 0xff9ad8, floor: 0x8a6a4a, wall: 0x7a5a3a, crystal: 0xff9ad8, label: '🏡' },
  jungle: { rock: 0x5a7a48, door: 0x6a4a28, glow: 0xffd34a, floor: 0x4a6a32, wall: 0x3a5a2a, crystal: 0x7af0a0, label: '🐒' },
  antarctica: { rock: 0xbfe0f4, door: 0x5a8ab0, glow: 0x9fd8ff, floor: 0xdcecf6, wall: 0xa8d0ea, crystal: 0xb8e8ff, label: '❄️' },
};

export class SecretPlaces {
  doors: { spot: SecretSpot; pivot: THREE.Group; rune: THREE.MeshStandardMaterial; front: { x: number; z: number } }[] = [];
  maps: { spot: SecretSpot; group: THREE.Group; baseY: number }[] = [];
  room = new THREE.Group();
  chest: { lid: THREE.Group; x: number; z: number } | null = null;
  roomFor: SecretSpot | null = null;

  constructor(private scene: THREE.Scene, private collision: CollisionWorld) {
    for (const s of SECRET_SPOTS) this.buildDoor(s);
    scene.add(this.room);
    this.room.visible = false;
  }

  private buildDoor(s: SecretSpot) {
    const L = LOOK[s.zone];
    const y = Math.min(terrainHeight(s.x, s.z), terrainHeight(s.x + Math.sin(s.facing) * 1.6, s.z + Math.cos(s.facing) * 1.6));
    const g = new THREE.Group(); g.position.set(s.x, y, s.z); g.rotation.y = s.facing; this.scene.add(g);
    const rockM = new THREE.MeshStandardMaterial({ color: L.rock, roughness: s.zone === 'antarctica' ? 0.25 : 0.95, transparent: s.zone === 'antarctica', opacity: s.zone === 'antarctica' ? 0.92 : 1 });
    // a big mossy / sandy / icy mound with a doorway in the front
    const mound = new THREE.Mesh(new THREE.SphereGeometry(2.3, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), rockM);
    mound.scale.set(1, 1.05, 0.9); mound.position.z = -0.6; mound.castShadow = true; mound.receiveShadow = true; g.add(mound);
    for (let k = 0; k < 5; k++) {
      const b = new THREE.Mesh(new THREE.DodecahedronGeometry(0.4 + (k % 3) * 0.15), rockM);
      b.position.set(Math.cos(k * 1.3) * 2.0, 0.2, -0.6 + Math.sin(k * 1.3) * 1.6); b.castShadow = true; g.add(b);
    }
    if (s.zone === 'forest' || s.zone === 'swamp') for (let k = 0; k < 6; k++) {   // moss and little mushrooms
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshStandardMaterial({ color: 0x4f8a2e, roughness: 1 }));
      m.scale.y = 0.4; m.position.set(Math.cos(k) * 1.4, 1.8 + Math.sin(k * 2) * 0.15, -0.6 + Math.sin(k) * 0.9); g.add(m);
    }
    // stone door frame + a round-topped wooden door with a glowing keyhole rune
    const frameM = new THREE.MeshStandardMaterial({ color: 0x7a7470, roughness: 0.9 });
    for (const sx of [-0.75, 0.75]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.9, 0.3), frameM); p.position.set(sx, 0.95, 1.35); g.add(p); }
    const top = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.13, 6, 16, Math.PI), frameM); top.position.set(0, 1.85, 1.35); g.add(top);
    const pivot = new THREE.Group(); pivot.position.set(-0.62, 0, 1.36); g.add(pivot);
    const doorM = new THREE.MeshStandardMaterial({ color: L.door, roughness: 0.8 });
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.24, 1.85, 0.1), doorM); panel.position.set(0.62, 0.93, 0); pivot.add(panel);
    const arch = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.1, 16, 1, false, 0, Math.PI), doorM); arch.rotation.set(Math.PI / 2, Math.PI / 2, 0); arch.position.set(0.62, 1.85, 0); pivot.add(arch);
    const rune = new THREE.MeshStandardMaterial({ color: L.glow, emissive: L.glow, emissiveIntensity: 0.8 });
    const key = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.04, 6, 16), rune); key.position.set(0.62, 1.2, 0.07); pivot.add(key);
    const key2 = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.25, 0.04), rune); key2.position.set(0.62, 0.95, 0.07); pivot.add(key2);
    // inside the doorway it's dark
    const dark = new THREE.Mesh(new THREE.PlaneGeometry(1.24, 2.4), new THREE.MeshBasicMaterial({ color: 0x0a0806 })); dark.position.set(0, 1.0, 1.2); g.add(dark);
    this.collision.add({ kind: 'cyl', x: s.x - Math.sin(s.facing) * 0.4, z: s.z - Math.cos(s.facing) * 0.4, r: 2.0, top: 100, tall: true });
    const front = { x: s.x + Math.sin(s.facing) * 2.7, z: s.z + Math.cos(s.facing) * 2.7 };
    this.doors.push({ spot: s, pivot, rune, front });
    // its secret map (a glowing scroll with a purple seal)
    const map = buildMapScroll();
    map.scale.setScalar(0.85);
    const my = terrainHeight(s.mapX, s.mapZ);
    map.position.set(s.mapX, my, s.mapZ);
    map.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined; if (m && 'emissive' in m && m.emissive) { m.emissive = new THREE.Color(0xb07aff); m.emissiveIntensity = 0.5; } });
    this.scene.add(map);
    this.maps.push({ spot: s, group: map, baseY: my });
  }

  update(dt: number, t: number, focus: THREE.Vector3, mapsFound: string[], opened: string[]) {
    for (const m of this.maps) {
      const show = !mapsFound.includes(m.spot.id) && Math.hypot(focus.x - m.spot.mapX, focus.z - m.spot.mapZ) < 90;
      m.group.visible = show;
      if (!show) continue;
      m.group.rotation.y += dt * 1.5;
      m.group.position.y = m.baseY + Math.sin(t * 2) * 0.1;
    }
    for (const d of this.doors) {
      const open = opened.includes(d.spot.id);
      const target = open ? -1.6 : 0;
      d.pivot.rotation.y += (target - d.pivot.rotation.y) * Math.min(1, dt * 3);
      d.rune.emissiveIntensity = open ? 0.2 : mapsFound.includes(d.spot.id) ? 0.9 + Math.sin(t * 4) * 0.5 : 0.25;
    }
  }

  /** Build the secret room for this place (each area has its own look). */
  buildRoom(s: SecretSpot, chestOpen: boolean) {
    this.roomFor = s;
    this.room.clear();
    const L = LOOK[s.zone], R = SECRET_ROOM, g = this.room;
    const floor = new THREE.Mesh(new THREE.CircleGeometry(R.r, 40), new THREE.MeshStandardMaterial({ color: L.floor, roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(R.x, 0.01, R.z); floor.receiveShadow = true; g.add(floor);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(R.r + 0.4, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: L.wall, roughness: 0.9, side: THREE.BackSide }));
    dome.scale.y = 0.62; dome.position.set(R.x, 0, R.z); g.add(dome);
    // glowing crystals round the walls
    const cm = new THREE.MeshStandardMaterial({ color: L.crystal, emissive: L.crystal, emissiveIntensity: 0.9, roughness: 0.2, transparent: true, opacity: 0.9 });
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2 + 0.2, rr = R.r - 0.5 - (k % 3) * 0.3;
      if (Math.abs(Math.sin(a)) < 0.25 && Math.cos(a) > 0) continue;        // keep the exit clear
      const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.25 + (k % 4) * 0.12), cm);
      c.scale.y = 2.2; c.position.set(R.x + Math.sin(a) * rr, 0.4 + (k % 4) * 0.1, R.z + Math.cos(a) * rr); c.rotation.z = (k % 5 - 2) * 0.15; g.add(c);
    }
    for (const [lx, lz] of [[-3, -2], [3, -2], [0, 3]] as const) { const l = new THREE.PointLight(L.glow, 6, 11, 1.4); l.position.set(R.x + lx, 2.6, R.z + lz); g.add(l); }
    const amb = new THREE.PointLight(0xffffff, 3, 16, 1.2); amb.position.set(R.x, 3.4, R.z); g.add(amb);
    // the treasure chest in the middle at the back
    const cx = R.x, cz = R.z - 3.2;
    const wood = new THREE.MeshStandardMaterial({ color: 0x8a5a2a, roughness: 0.7 }), gold = new THREE.MeshStandardMaterial({ color: 0xf0c040, metalness: 0.6, roughness: 0.3 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.7, 0.85), wood); base.position.set(cx, 0.35, cz); g.add(base);
    for (const sx of [-0.5, 0.5]) { const band = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.72, 0.88), gold); band.position.set(cx + sx, 0.35, cz); g.add(band); }
    const lid = new THREE.Group(); lid.position.set(cx, 0.7, cz - 0.42); g.add(lid);
    const lidM = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.3, 16, 1, false, 0, Math.PI), wood); lidM.rotation.set(0, 0, Math.PI / 2); lidM.rotation.x = Math.PI / 2; lidM.position.set(0, 0, 0.42); lidM.rotation.set(Math.PI / 2, 0, Math.PI / 2); lid.add(lidM);
    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.06), gold); lock.position.set(0, 0, 0.86); lid.add(lock);
    if (chestOpen) lid.rotation.x = -1.6;
    const coins = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.25, 16), gold); coins.position.set(cx, 0.62, cz); g.add(coins);
    this.chest = { lid, x: cx, z: cz + 1.1 };
    // a name sign and the way out
    const c = document.createElement('canvas'); c.width = 512; c.height = 128;
    const x2 = c.getContext('2d')!; x2.fillStyle = 'rgba(255,250,240,0.95)'; x2.beginPath(); x2.roundRect(4, 4, 504, 120, 28); x2.fill();
    x2.fillStyle = '#4a2a5a'; x2.font = 'bold 46px Nunito, sans-serif'; x2.textAlign = 'center'; x2.textBaseline = 'middle'; x2.fillText(`${L.label} ${s.name}`, 256, 66, 490);
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.85), new THREE.MeshBasicMaterial({ map: tx, transparent: true })); sign.position.set(R.x, 2.9, R.z - 4.6); g.add(sign);
    const exit = new THREE.Mesh(new THREE.CircleGeometry(0.9, 24), new THREE.MeshBasicMaterial({ color: 0xfff6d8 })); exit.position.set(R.x, 1.0, R.z + R.r - 0.15); exit.rotation.y = Math.PI; exit.scale.y = 1.3; g.add(exit);
    this.room.visible = true;
  }
  openChest() { if (this.chest) this.chest.lid.rotation.x = -1.6; }
}
