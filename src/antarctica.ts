// Antarctica: a snowy island reached with the Travel button.
import * as THREE from 'three';
import { ANTARCTICA, defaultSkin } from './config';
import { terrainHeight, fbm, noise2, rng, smoothstep, inPit, CollisionWorld } from './terrain';
import { FOOD_SPAWNS, OPP_SPAWNS, LANDMARKS, PLATFORMS, MAP_SPOTS } from './layout';
import { AnimalRig, buildPlayerAnimal, animateRig } from './animals';
import { skinById } from './config';
import { softDotTexture, stoneTexture } from './textures';

export const ICE_HOLLOW = { x: 48, z: 362, r: 6, gapAngle: Math.PI };
export const ICE_ARCH = { x: 20, z: 340 };
export const STATION = { x: 35, z: 282 };
export const COLONY = { x: -30, z: 340 };

export class Antarctica {
  private penguins: { rig: AnimalRig; walk: number }[] = [];
  private snow: THREE.Points;
  private snowVel: Float32Array;

  root = new THREE.Group();
  private scene: THREE.Object3D;
  constructor(worldScene: THREE.Scene, private collision: CollisionWorld) {
    this.scene = this.root;
    worldScene.add(this.root);
    this.buildTerrain();
    this.buildOcean();
    this.buildStation();
    this.buildArch();
    this.buildColony();
    this.buildHollow();
    this.buildDecor();
    // falling snow (follows the player while in Antarctica)
    const n = 900;
    const pos = new Float32Array(n * 3);
    this.snowVel = new Float32Array(n);
    const r = rng(9001);
    for (let i = 0; i < n; i++) { pos[i * 3] = (r() - 0.5) * 50; pos[i * 3 + 1] = r() * 22; pos[i * 3 + 2] = (r() - 0.5) * 50; this.snowVel[i] = 1 + r() * 1.5; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.snow = new THREE.Points(g, new THREE.PointsMaterial({ map: softDotTexture(), size: 0.25, color: 0xffffff, transparent: true, depthWrite: false, opacity: 0.9 }));
    this.snow.frustumCulled = false;
    this.snow.visible = false;
    worldScene.add(this.snow);
  }

  private buildTerrain() {
    const x0 = -115, x1 = 115, z0 = 215, z1 = 425;
    const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0, 150, 140);
    geo.rotateX(-Math.PI / 2);
    geo.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const col = new Float32Array(pos.count * 3);
    const snow = new THREE.Color(0xf4f8fb), shade = new THREE.Color(0xc9dbe8), ice = new THREE.Color(0x9fc9e2), deep = new THREE.Color(0x3d6a8c), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = terrainHeight(x, z);
      pos.setY(i, h);
      const n = fbm(x * 0.07, z * 0.07, 3);
      c.copy(snow).lerp(shade, n * 0.6);
      c.lerp(ice, smoothstep(0.62, 0.72, fbm(x * 0.04 + 5, z * 0.04)) * 0.7); // glassy ice patches
      if (h < 0.2) c.lerp(deep, Math.min(1, (0.2 - h) / 6));
      colorOut(col, i, c);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }));
    mesh.receiveShadow = true;
    this.scene.add(mesh);
  }

  private buildOcean() {
    const geo = new THREE.PlaneGeometry(700, 470);
    geo.rotateX(-Math.PI / 2);
    const sea = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x24547a, roughness: 0.18, metalness: 0.2, transparent: true, opacity: 0.92 }));
    sea.position.set(0, 0, 395);
    this.scene.add(sea);
    // floating sea ice
    const chunk = new THREE.CylinderGeometry(1, 1.1, 0.5, 7);
    const mat = new THREE.MeshStandardMaterial({ color: 0xe9f3f8, roughness: 0.5 });
    const r = rng(77);
    const mats: THREE.Matrix4[] = [];
    for (let i = 0; i < 400 && mats.length < 90; i++) {
      const x = -140 + r() * 280, z = 200 + r() * 260;
      if (terrainHeight(x, z) > -2) continue;
      const s = 0.8 + r() * 3;
      mats.push(new THREE.Matrix4().compose(new THREE.Vector3(x, 0.1, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r() * 6, 0)), new THREE.Vector3(s, 1, s * (0.6 + r() * 0.6))));
    }
    const im = new THREE.InstancedMesh(chunk, mat, mats.length);
    mats.forEach((m, i) => im.setMatrixAt(i, m));
    this.scene.add(im);
  }

  private buildStation() {
    const { x, z } = STATION; const y = terrainHeight(x, z);
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = -0.4;
    const red = new THREE.MeshStandardMaterial({ color: 0xc73a2c, roughness: 0.55 });
    const white = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.6 });
    const grey = new THREE.MeshStandardMaterial({ color: 0x6c737a, roughness: 0.5, metalness: 0.4 });
    const box = (m: THREE.Material, w: number, h: number, d: number, px: number, py: number, pz: number) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(px, py, pz); b.castShadow = b.receiveShadow = true; g.add(b); return b;
    };
    for (const [px, pz] of [[-2.2, -1.6], [2.2, -1.6], [-2.2, 1.6], [2.2, 1.6]]) box(grey, 0.25, 1.2, 0.25, px, 0.6, pz);
    box(red, 5.2, 2.8, 3.8, 0, 2.6, 0);
    box(white, 5.4, 0.25, 4.0, 0, 4.1, 0);
    box(white, 1.0, 1.8, 0.1, 0, 2.2, 1.95);
    for (const px of [-1.6, 1.6]) box(new THREE.MeshStandardMaterial({ color: 0xbfe3ff, emissive: 0x6fb6ff, emissiveIntensity: 0.3 }), 0.9, 0.7, 0.1, px, 2.9, 1.95);
    box(grey, 0.9, 0.12, 1.4, 0, 1.25, 2.5); // steps
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 5, 6), grey); mast.position.set(1.8, 6.5, -1); g.add(mast);
    const dish = new THREE.Mesh(new THREE.SphereGeometry(0.7, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), white);
    dish.position.set(-1.6, 4.6, -0.8); dish.rotation.x = -1.0; g.add(dish);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55), new THREE.MeshStandardMaterial({ color: 0x2f6fd6, side: THREE.DoubleSide }));
    flag.position.set(2.25, 8.6, -1); g.add(flag);
    this.scene.add(g);
    this.collision.add({ kind: 'cyl', x, z, r: 3.2, top: 100, tall: true });
  }

  private buildArch() {
    const { x, z } = ICE_ARCH; const y = terrainHeight(x, z);
    const mat = new THREE.MeshStandardMaterial({ color: 0xbfe2f2, roughness: 0.15, metalness: 0.05, emissive: 0x2a6080, emissiveIntensity: 0.12 });
    for (const sx of [-4.2, 4.2]) {
      const g = iceGeo(new THREE.CylinderGeometry(1.1, 1.6, 7, 10, 5), sx);
      const m = new THREE.Mesh(g, mat); m.position.set(x + sx, y + 3.3, z); m.castShadow = true; this.scene.add(m);
      this.collision.add({ kind: 'cyl', x: x + sx, z, r: 1.4, top: 100, tall: true });
    }
    const top = new THREE.Mesh(iceGeo(new THREE.BoxGeometry(11.5, 1.6, 2.6, 8, 2, 2), 3), mat);
    top.position.set(x, y + 7.2, z); top.castShadow = true; this.scene.add(top);
  }

  private buildColony() {
    const { x, z } = COLONY;
    const skin = skinById(defaultSkin('penguin'))!;
    const r = rng(314);
    for (let i = 0; i < 16; i++) {
      const a = r() * Math.PI * 2, d = 1.5 + r() * 7.5;
      const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
      const rig = buildPlayerAnimal('penguin', skin);
      const s = 0.75 + r() * 0.5;
      rig.root.scale.setScalar(s);
      rig.root.position.set(px, terrainHeight(px, pz), pz);
      rig.root.rotation.y = r() * Math.PI * 2;
      this.scene.add(rig.root);
      this.penguins.push({ rig, walk: r() < 0.3 ? 1.5 : 0 });
      this.collision.add({ kind: 'cyl', x: px, z: pz, r: 0.35 * s, top: 100, tall: true });
    }
  }

  private buildHollow() {
    const { x, z, r, gapAngle } = ICE_HOLLOW;
    const mat = new THREE.MeshStandardMaterial({ color: 0xd8ecf6, roughness: 0.3 });
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2;
      const da = Math.abs(((a - gapAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (da < 0.26) continue;
      const bx = x + Math.cos(a) * r, bz = z + Math.sin(a) * r;
      const h = 2.6 + (i % 3) * 0.5;
      const m = new THREE.Mesh(iceGeo(new THREE.BoxGeometry(2.2, h, 1.6, 3, 3, 2), i), mat);
      m.position.set(bx, terrainHeight(bx, bz) + h / 2 - 0.2, bz); m.rotation.y = -a; m.castShadow = true;
      this.scene.add(m);
      this.collision.add({ kind: 'cyl', x: bx, z: bz, r: 1.2, top: 100, tall: true });
    }
  }

  private buildDecor() {
    const A = ANTARCTICA;
    const clear = (x: number, z: number) => {
      if (Math.hypot(x - 0, z - 266) < 12) return true;
      if (inPit(x, z, 4)) return true;
      for (const s of FOOD_SPAWNS) if (Math.hypot(x - s.x, z - s.z) < 3) return true;
      for (const s of OPP_SPAWNS) if (Math.hypot(x - s.x, z - s.z) < 4) return true;
      for (const s of MAP_SPOTS) if (Math.hypot(x - s.x, z - s.z) < 3) return true;
      for (const l of LANDMARKS) if (Math.hypot(x - l.signX, z - l.signZ) < 2.5) return true;
      for (const p of PLATFORMS) if (Math.hypot(x - p.x, z - p.z) < p.r + 2) return true;
      for (const f of [STATION, ICE_ARCH, COLONY]) if (Math.hypot(x - f.x, z - f.z) < 10) return true;
      if (Math.hypot(x - ICE_HOLLOW.x, z - ICE_HOLLOW.z) < ICE_HOLLOW.r + 3) return true;
      return false;
    };
    const r = rng(2026);
    const ice = new THREE.MeshStandardMaterial({ color: 0xcfe6f3, roughness: 0.25, map: stoneTexture(0xd8eaf4) });
    const geo = iceGeo(new THREE.IcosahedronGeometry(1, 1), 4);
    const mats: THREE.Matrix4[] = [];
    for (let i = 0; i < 600 && mats.length < 55; i++) {
      const x = A.minX + 4 + r() * (A.maxX - A.minX - 8), z = A.minZ + 4 + r() * (A.maxZ - A.minZ - 8);
      if (clear(x, z)) continue;
      const s = 0.6 + r() * 1.4;
      mats.push(new THREE.Matrix4().compose(new THREE.Vector3(x, terrainHeight(x, z) + s * 0.3, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(r(), r() * 6, r() * 0.5)), new THREE.Vector3(s, s * (0.8 + r() * 0.8), s)));
      this.collision.add({ kind: 'cyl', x, z, r: s * 0.9, top: 100, tall: true });
    }
    const im = new THREE.InstancedMesh(geo, ice, mats.length);
    mats.forEach((m, i) => im.setMatrixAt(i, m));
    im.castShadow = true;
    this.scene.add(im);
    // soft snow drifts (no collision)
    const drift = new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    const dmats: THREE.Matrix4[] = [];
    for (let i = 0; i < 400 && dmats.length < 120; i++) {
      const x = A.minX + 3 + r() * (A.maxX - A.minX - 6), z = A.minZ + 3 + r() * (A.maxZ - A.minZ - 6);
      if (clear(x, z)) continue;
      const s = 1 + r() * 2.5;
      dmats.push(new THREE.Matrix4().compose(new THREE.Vector3(x, terrainHeight(x, z) - 0.1, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r() * 6, 0)), new THREE.Vector3(s * 1.6, s * 0.25, s)));
    }
    const dm = new THREE.InstancedMesh(drift, new THREE.MeshStandardMaterial({ color: 0xf6f9fc, roughness: 0.9 }), dmats.length);
    dmats.forEach((m, i) => dm.setMatrixAt(i, m));
    dm.receiveShadow = true;
    this.scene.add(dm);
  }

  update(dt: number, focus: THREE.Vector3) {
    const here = focus.z > 200 && focus.z < 500;
    this.root.visible = focus.z > 140 && focus.z < 500; // far away from everything else: skip drawing it
    this.snow.visible = here;
    if (here) {
      this.snow.position.set(focus.x, focus.y - 4, focus.z);
      const p = this.snow.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        let y = p.getY(i) - this.snowVel[i] * dt;
        if (y < 0) y += 22;
        p.setY(i, y);
        p.setX(i, p.getX(i) + Math.sin(y * 0.5 + i) * dt * 0.3);
      }
      p.needsUpdate = true;
      for (const pg of this.penguins) animateRig(pg.rig, dt, { speed: pg.walk, airborne: false, attack: null, attackT: 0, windup: 0 });
    }
  }
}

function iceGeo(g: THREE.BufferGeometry, seed: number) {
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const k = 1 + (noise2(x * 1.3 + seed, z * 1.3 + y) - 0.5) * 0.3;
    pos.setXYZ(i, x * k, y, z * k);
  }
  g.computeVertexNormals();
  return g;
}

function colorOut(arr: Float32Array, i: number, c: THREE.Color) {
  arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b;
}
