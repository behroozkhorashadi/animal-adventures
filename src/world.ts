// Builds the 3D world: terrain, sky, lighting, vegetation, landmarks, gates.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { WORLD, ZoneId, VILLAGE } from './config';
import { buildVillage, villageKeepClear, windmillSails } from './village';
import { nearSecret } from './secretspots';
import { Antarctica } from './antarctica';
import { Jungle } from './jungle';
import { terrainHeight, fbm, noise2, rng, smoothstep, CollisionWorld, PITS, WATER_LEVEL, inPit, Collider } from './terrain';
import {
  PLATFORMS, BOARDWALK, LANDMARKS, SPECIAL_TREES, HIDDEN_CLEARING, MUSHROOM_RING, FALLEN_LOG, TERMITES,
  FOOD_SPAWNS, OPP_SPAWNS, pathZ, TUTORIAL_RING, Platform, MAP_SPOTS, FRIEND_SPOTS,
} from './layout';
import { groundDetailTexture, barkTexture, rockTexture, signTexture, softDotTexture, plankTexture, drawSign } from './textures';

const WORLD_W = WORLD.maxX - WORLD.minX;
const WORLD_D = WORLD.maxZ - WORLD.minZ;

interface ZoneLook { fog: THREE.Color; near: number; far: number; skyTop: THREE.Color; skyHorizon: THREE.Color; sun: THREE.Color; sunI: number; hemiI: number }
const LOOKS: Record<ZoneId, ZoneLook> = {
  forest: { fog: new THREE.Color(0xb3c9ae), near: 35, far: 150, skyTop: new THREE.Color(0x5f9ddc), skyHorizon: new THREE.Color(0xcfe2e4), sun: new THREE.Color(0xfff0d4), sunI: 2.6, hemiI: 1.0 },
  savanna: { fog: new THREE.Color(0xdcd6c0), near: 60, far: 230, skyTop: new THREE.Color(0x4f93de), skyHorizon: new THREE.Color(0xe8e2cc), sun: new THREE.Color(0xffe0aa), sunI: 3.1, hemiI: 1.05 },
  village: { fog: new THREE.Color(0xc4dcc6), near: 40, far: 160, skyTop: new THREE.Color(0x5f9ddc), skyHorizon: new THREE.Color(0xd8e8e0), sun: new THREE.Color(0xfff0d4), sunI: 2.7, hemiI: 1.0 },
  antarctica: { fog: new THREE.Color(0xdbe7f0), near: 30, far: 170, skyTop: new THREE.Color(0x6fa6dc), skyHorizon: new THREE.Color(0xe4eef5), sun: new THREE.Color(0xffffff), sunI: 2.8, hemiI: 1.15 },
  jungle: { fog: new THREE.Color(0xa8cca8), near: 28, far: 125, skyTop: new THREE.Color(0x4aa6e0), skyHorizon: new THREE.Color(0xd4f0e0), sun: new THREE.Color(0xfff2c8), sunI: 3.0, hemiI: 1.1 },
  swamp: { fog: new THREE.Color(0x93a08c), near: 14, far: 95, skyTop: new THREE.Color(0x7b93a0), skyHorizon: new THREE.Color(0xa9b3a2), sun: new THREE.Color(0xdde6d2), sunI: 1.7, hemiI: 0.9 },
};

export interface Gate {
  zone: ZoneId; x: number; barrier: THREE.Group; sign: { canvas: HTMLCanvasElement; tex: THREE.CanvasTexture }; open: boolean;
  barrierCollider: Collider | null;
}

export class World {
  scene: THREE.Scene;
  collision = new CollisionWorld();
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  sky: THREE.Mesh;
  gates: Gate[] = [];
  homeAnchor = new THREE.Group();
  homeColliders: ReturnType<CollisionWorld['add']>[] = [];
  tutorialRing: THREE.Mesh;
  private windMats: THREE.Material[] = [];
  private windUniform = { value: 0 };
  private mist: THREE.Sprite[] = [];
  antarctica!: Antarctica;
  jungle!: Jungle;
  /** Set when a monkey in the jungle chatters (the game plays the sound). */
  monkeyChatter = false;
  nightLights: THREE.MeshStandardMaterial[] = [];
  private fogColor = new THREE.Color();
  private skyUniforms: { top: { value: THREE.Color }; bottom: { value: THREE.Color } };
  private water?: THREE.Mesh;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    scene.fog = new THREE.Fog(0xb3c9ae, 35, 150);

    // lights
    this.hemi = new THREE.HemisphereLight(0xcfe6ff, 0x5a5236, 1.0);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff0d4, 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -38; sc.right = 38; sc.top = 38; sc.bottom = -38; sc.near = 1; sc.far = 160;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.04;
    scene.add(this.sun, this.sun.target);

    // sky dome
    this.skyUniforms = { top: { value: new THREE.Color(0x5f9ddc) }, bottom: { value: new THREE.Color(0xcfe2e4) } };
    const skyMat = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 top; uniform vec3 bottom; varying vec3 vP;
        void main(){ float h = clamp(vP.y*1.6+0.05,0.0,1.0); gl_FragColor = vec4(mix(bottom, top, pow(h,0.7)),1.0); }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(500, 24, 12), skyMat);
    this.sky.renderOrder = -1;
    scene.add(this.sky);

    this.buildTerrain();
    this.buildWater();
    this.buildPlatforms();
    this.buildLandmarks();
    this.buildVegetation();
    this.buildBorders();
    this.buildGates();
    this.buildSigns();
    this.antarctica = new Antarctica(scene, this.collision);
    this.jungle = new Jungle(scene, this.collision);
    this.nightLights.push(...buildVillage(scene, this.collision));
    this.buildVillagePlants();
    scene.add(this.homeAnchor);
    this.homeAnchor.position.set(WORLD.home.x, terrainHeight(WORLD.home.x, WORLD.home.z), WORLD.home.z);

    // tutorial ring
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffe36b, transparent: true, opacity: 0.85, depthWrite: false });
    this.tutorialRing = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.12, 8, 40), ringMat);
    this.tutorialRing.rotation.x = Math.PI / 2;
    this.tutorialRing.position.set(TUTORIAL_RING.x, terrainHeight(TUTORIAL_RING.x, TUTORIAL_RING.z) + 0.2, TUTORIAL_RING.z);
    scene.add(this.tutorialRing);
  }

  // -------------------------------------------------------------------------
  private buildTerrain() {
    const segX = 360, segZ = 160;
    const geo = new THREE.PlaneGeometry(WORLD_W, WORLD_D, segX, segZ);
    geo.rotateX(-Math.PI / 2);
    geo.translate((WORLD.minX + WORLD.maxX) / 2, 0, (WORLD.minZ + WORLD.maxZ) / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    const forestA = new THREE.Color(0x587f30), forestB = new THREE.Color(0x3f6422), forestDirt = new THREE.Color(0x6e5838);
    const savA = new THREE.Color(0xc9a85a), savB = new THREE.Color(0xa88a44), savDirt = new THREE.Color(0xa3714a);
    const swA = new THREE.Color(0x56603a), swB = new THREE.Color(0x414a2c), swMud = new THREE.Color(0x3b3324);
    const rock = new THREE.Color(0x7a6e5e), path = new THREE.Color(0x8a7150);
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = terrainHeight(x, z);
      pos.setY(i, h);
      const n = fbm(x * 0.08, z * 0.08, 3);
      const n2 = noise2(x * 0.3, z * 0.3);
      // zone colours
      const fc = c.copy(forestA).lerp(forestB, n).lerp(forestDirt, smoothstep(0.62, 0.75, fbm(x * 0.05 + 3, z * 0.05)) * 0.7);
      const fcol = fc.clone();
      const sc = tmp.copy(savA).lerp(savB, n).lerp(savDirt, smoothstep(0.6, 0.72, fbm(x * 0.04 + 9, z * 0.04)) * 0.8);
      const scol = sc.clone();
      const wcol = new THREE.Color().copy(swA).lerp(swB, n).lerp(swMud, smoothstep(0.1, -0.3, h));
      const E = WORLD.zoneEdge;
      let col: THREE.Color;
      if (x > 0) col = fcol.lerp(scol, smoothstep(E - 6, E + 6, x));
      else col = fcol.lerp(wcol, smoothstep(-E + 6, -E - 6, x));
      // paths
      const pd = Math.abs(z - pathZ(x));
      const pw = (1 - smoothstep(1.2, 2.6 + n2 * 0.8, pd)) * (x < -E - 4 ? 0.55 : 0.9);
      col.lerp(path, pw * 0.85);
      // clearing ground
      const dc = Math.hypot(x, z);
      col.lerp(new THREE.Color(0x6f8a3a), (1 - smoothstep(8, 14, dc)) * 0.35);
      // pits: rocky, darkening walls
      if (h < -0.8) col.lerp(rock, 0.9).multiplyScalar(Math.max(0.15, 1 + h / 24));
      col.multiplyScalar(0.92 + n2 * 0.16);
      colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    // UVs scaled so detail texture tiles every ~4m
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) - WORLD.minX) / 4, (pos.getZ(i) - WORLD.minZ) / 4);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, map: groundDetailTexture(), roughness: 0.96 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    // dark floors deep inside the pits
    for (const p of PITS) {
      const d = new THREE.Mesh(new THREE.CircleGeometry(p.r, 32), new THREE.MeshBasicMaterial({ color: 0x120e0a }));
      d.rotation.x = -Math.PI / 2; d.position.set(p.x, -14, p.z);
      this.scene.add(d);
    }
  }

  private buildWater() {
    const E = WORLD.zoneEdge;
    const w = WORLD.minX * -1 - E + 10;
    const geo = new THREE.PlaneGeometry(w, WORLD_D, 1, 1);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ color: 0x3c5a48, transparent: true, opacity: 0.72, roughness: 0.12, metalness: 0.15, depthWrite: false });
    const water = new THREE.Mesh(geo, mat);
    water.position.set(-E - w / 2 + 6, WATER_LEVEL, 0);
    water.renderOrder = 1;
    this.scene.add(water);
    this.water = water;
    // murky bog surface over the swamp pit
    const p = PITS[1];
    const bog = new THREE.Mesh(new THREE.CircleGeometry(p.r - 0.6, 40), new THREE.MeshStandardMaterial({ color: 0x1d2414, roughness: 0.3, transparent: true, opacity: 0.88 }));
    bog.rotation.x = -Math.PI / 2; bog.position.set(p.x, WATER_LEVEL + 0.03, p.z); bog.renderOrder = 2;
    this.scene.add(bog);
    // lily pads
    const pad = new THREE.CircleGeometry(0.45, 12, 0.3, Math.PI * 1.8);
    pad.rotateX(-Math.PI / 2);
    const padMat = new THREE.MeshStandardMaterial({ color: 0x4f7d34, roughness: 0.7, side: THREE.DoubleSide });
    const r = rng(404);
    const pads: THREE.Matrix4[] = [];
    for (let i = 0; i < 3000 && pads.length < 420; i++) {
      const x = -E - 4 - r() * (-WORLD.minX - E - 8), z = WORLD.minZ + 6 + r() * (WORLD_D - 12);
      if (terrainHeight(x, z) > WATER_LEVEL - 0.15 || inPit(x, z, 0)) continue;
      const m = new THREE.Matrix4().compose(new THREE.Vector3(x, WATER_LEVEL + 0.02, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r() * 6.28, 0)), new THREE.Vector3().setScalar(0.6 + r() * 0.9));
      pads.push(m);
    }
    const im = new THREE.InstancedMesh(pad, padMat, pads.length);
    pads.forEach((m, i) => im.setMatrixAt(i, m));
    this.scene.add(im);

    // mist
    const mistMat = new THREE.SpriteMaterial({ map: softDotTexture(), color: 0xdfe8dc, transparent: true, opacity: 0.16, depthWrite: false });
    for (let i = 0; i < 80; i++) {
      const s = new THREE.Sprite(mistMat);
      const x = -E - 8 - r() * (-WORLD.minX - E - 14), z = WORLD.minZ + 5 + r() * (WORLD_D - 10);
      s.position.set(x, 1.2 + r() * 1.5, z);
      s.scale.set(14 + r() * 10, 4 + r() * 3, 1);
      s.userData.base = s.position.clone();
      s.userData.phase = r() * 6.28;
      this.scene.add(s);
      this.mist.push(s);
    }
  }

  // -------------------------------------------------------------------------
  private rockColumn(p: Platform) {
    const h = p.top - p.bottom;
    const geo = new THREE.CylinderGeometry(p.r * 1.02, p.r * 1.18, h, 18, Math.max(2, Math.round(h / 1.2)), false);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const a = Math.atan2(z, x);
      const isTop = y > h / 2 - 0.01;
      const rr = Math.hypot(x, z);
      if (rr < 0.01) continue;
      const k = isTop ? 0.97 : 1 + (noise2(a * 3 + p.x, y * 0.8 + p.z) - 0.5) * 0.28;
      pos.setX(i, (x / rr) * rr * k); pos.setZ(i, (z / rr) * rr * k);
    }
    geo.computeVertexNormals();
    const colors: Record<Platform['look'], number> = { mossy: 0x8d8d80, red: 0xb08060, swamp: 0x5f6250, grey: 0x8a8780, ice: 0xcfe6f2 };
    const mat = new THREE.MeshStandardMaterial({ color: colors[p.look], map: rockTexture(), roughness: 0.95 });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(p.x, p.bottom + h / 2, p.z);
    m.castShadow = true; m.receiveShadow = true;
    this.scene.add(m);
    if (p.look === 'mossy' || p.look === 'swamp' || p.look === 'ice') {
      const moss = new THREE.Mesh(new THREE.CylinderGeometry(p.r * 0.95, p.r * 0.98, 0.12, 18), new THREE.MeshStandardMaterial({ color: p.look === 'mossy' ? 0x5e7f35 : p.look === 'ice' ? 0xf6fafc : 0x4b5f30, roughness: 1 }));
      moss.position.set(p.x, p.top + 0.02, p.z); moss.receiveShadow = true;
      this.scene.add(moss);
    }
  }

  private buildPlatforms() {
    for (const p of PLATFORMS) {
      this.rockColumn(p);
      this.collision.add({ kind: 'cyl', x: p.x, z: p.z, r: p.r, top: p.top });
    }
    // boardwalk
    const b = BOARDWALK;
    const wood = new THREE.MeshStandardMaterial({ map: plankTexture(0x7a5a3c, false), roughness: 0.9 });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(b.maxX - b.minX, 0.18, b.maxZ - b.minZ), wood);
    deck.position.set((b.minX + b.maxX) / 2, b.top - 0.09, (b.minZ + b.maxZ) / 2);
    deck.castShadow = deck.receiveShadow = true;
    this.scene.add(deck);
    const postMat = new THREE.MeshStandardMaterial({ map: barkTexture(0x4a3626), roughness: 1 });
    for (let x = b.minX + 0.5; x < b.maxX; x += 3) for (const z of [b.minZ, b.maxZ]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.2, 6), postMat);
      p.position.set(x, b.top - 0.7, z); p.castShadow = true;
      this.scene.add(p);
    }
    this.collision.add({ kind: 'box', minX: b.minX, maxX: b.maxX, minZ: b.minZ, maxZ: b.maxZ, top: b.top });
  }

  // -------------------------------------------------------------------------
  private buildLandmarks() {
    const S = this.scene;
    const bark = new THREE.MeshStandardMaterial({ map: barkTexture(0x5a4330), roughness: 1 });
    const leafMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });

    // Giant Old Oak
    {
      const { x, z } = SPECIAL_TREES.oak; const y = terrainHeight(x, z);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.7, 8, 14), bark);
      trunk.position.set(x, y + 4, z); trunk.castShadow = true; S.add(trunk);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const root = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.6, 6), bark);
        root.position.set(x + Math.cos(a) * 1.7, y + 0.4, z + Math.sin(a) * 1.7);
        root.rotation.set(Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2); S.add(root);
        const br = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.5, 5, 8), bark);
        br.position.set(x + Math.cos(a) * 2.2, y + 9, z + Math.sin(a) * 2.2);
        br.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9); br.castShadow = true; S.add(br);
      }
      const canopy = foliageBlob(9, 5.5, 0x3f6b28, 0x5c8a35, 7);
      const cm = new THREE.Mesh(canopy, leafMat); cm.position.set(x, y + 11, z); cm.castShadow = true; S.add(cm);
      this.collision.add({ kind: 'cyl', x, z, r: 1.8, top: 100, tall: true });
    }
    // Fallen log
    {
      const { x0, x1, z } = FALLEN_LOG; const len = x1 - x0; const cx = (x0 + x1) / 2;
      const y = Math.max(terrainHeight(x0, z), terrainHeight(x1, z), terrainHeight(cx, z));
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.85, len, 14), new THREE.MeshStandardMaterial({ map: barkTexture(0x6a5038), roughness: 1 }));
      log.rotation.z = Math.PI / 2; log.position.set(cx, y + 0.6, z); log.castShadow = log.receiveShadow = true; S.add(log);
      const ringMat = new THREE.MeshStandardMaterial({ color: 0xb08a5a, roughness: 0.9 });
      for (const ex of [x0, x1]) { const r = new THREE.Mesh(new THREE.CircleGeometry(0.78, 14), ringMat); r.position.set(ex + (ex === x0 ? -0.01 : 0.01), y + 0.6, z); r.rotation.y = ex === x0 ? -Math.PI / 2 : Math.PI / 2; S.add(r); }
      for (let px = x0 + 0.5; px < x1; px += 1.0) this.collision.add({ kind: 'cyl', x: px, z, r: 0.75, top: y + 1.35 });
      addMushrooms(S, cx - 3, z + 0.9, y, 5, 0.25);
    }
    // Mushroom ring
    {
      const { x, z, r } = MUSHROOM_RING;
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        addMushrooms(S, x + Math.cos(a) * r, z + Math.sin(a) * r, terrainHeight(x + Math.cos(a) * r, z + Math.sin(a) * r), 1, 0.9 + (i % 3) * 0.25, true);
      }
    }
    // Hidden clearing: ring of dense bushes with a narrow gap
    {
      const { x, z, r, gapAngle } = HIDDEN_CLEARING;
      const bushGeo = foliageBlob(3, 1.6, 0x2f5a22, 0x4b7a2c, 3);
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * Math.PI * 2;
        let da = Math.abs(((a - gapAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        if (da < 0.22) continue;
        const bx = x + Math.cos(a) * r, bz = z + Math.sin(a) * r;
        const m = new THREE.Mesh(bushGeo, leafMat);
        m.position.set(bx, terrainHeight(bx, bz) + 0.9, bz); m.rotation.y = a * 3; m.scale.setScalar(1 + (i % 3) * 0.12);
        m.castShadow = true; S.add(m);
        this.collision.add({ kind: 'cyl', x: bx, z: bz, r: 1.25, top: 2.2 + terrainHeight(bx, bz) });
      }
      // flowers inside
      const flowerCols = [0xf2d24b, 0xe85a8a, 0xffffff, 0x9c6ee8];
      const rr = rng(12);
      for (let i = 0; i < 40; i++) {
        const a = rr() * 6.28, d = rr() * (r - 1.5);
        const fx = x + Math.cos(a) * d, fz = z + Math.sin(a) * d;
        const fl = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 4), new THREE.MeshStandardMaterial({ color: flowerCols[i % 4], emissive: flowerCols[i % 4], emissiveIntensity: 0.1 }));
        fl.position.set(fx, terrainHeight(fx, fz) + 0.18, fz); S.add(fl);
      }
    }
    // Great Baobab
    {
      const { x, z } = SPECIAL_TREES.baobab; const y = terrainHeight(x, z);
      const bm = new THREE.MeshStandardMaterial({ map: barkTexture(0x8a7462), roughness: 1 });
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.3, 9, 16), bm);
      trunk.position.set(x, y + 4.5, z); trunk.castShadow = true; S.add(trunk);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const br = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.4, 3.5, 6), bm);
        br.position.set(x + Math.cos(a) * 1.4, y + 10, z + Math.sin(a) * 1.4);
        br.rotation.set(Math.sin(a) * 0.8, 0, -Math.cos(a) * 0.8); br.castShadow = true; S.add(br);
        const c = new THREE.Mesh(foliageBlob(2, 1.4, 0x5f7a2c, 0x7b9238, 20 + i), leafMat);
        c.position.set(x + Math.cos(a) * 2.8, y + 11.6, z + Math.sin(a) * 2.8); c.scale.y = 0.6; c.castShadow = true; S.add(c);
      }
      this.collision.add({ kind: 'cyl', x, z, r: 2.2, top: 100, tall: true });
    }
    // Termite mounds
    for (const t of TERMITES) {
      const y = terrainHeight(t.x, t.z);
      const g = new THREE.ConeGeometry(1.3, 3.2, 10, 4);
      const pos = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) { const k = 1 + (noise2(pos.getX(i) * 3 + t.x, pos.getY(i) * 2) - 0.5) * 0.4; pos.setX(i, pos.getX(i) * k); pos.setZ(i, pos.getZ(i) * k); }
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xa36b45, map: rockTexture(), roughness: 1 }));
      m.position.set(t.x, y + 1.4, t.z); m.castShadow = true; S.add(m);
      this.collision.add({ kind: 'cyl', x: t.x, z: t.z, r: 1.15, top: 100, tall: true });
    }
    // Sunken dead tree
    {
      const { x, z } = SPECIAL_TREES.deadTree; const y = Math.min(terrainHeight(x, z), 0);
      const dm = new THREE.MeshStandardMaterial({ map: barkTexture(0x6b665a), roughness: 1 });
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.3, 10, 12), dm);
      trunk.position.set(x, y + 4.5, z); trunk.rotation.z = 0.18; trunk.castShadow = true; S.add(trunk);
      const r = rng(31);
      for (let i = 0; i < 8; i++) {
        const a = r() * 6.28, hgt = 4 + r() * 5;
        const br = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.28, 3 + r() * 2, 6), dm);
        br.position.set(x + Math.cos(a) * 1.3 - (hgt - 4) * 0.18, y + hgt, z + Math.sin(a) * 1.3);
        br.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1); br.castShadow = true; S.add(br);
        const moss = new THREE.Mesh(new THREE.ConeGeometry(0.25, 1.6, 5), new THREE.MeshStandardMaterial({ color: 0x8a9670, roughness: 1 }));
        moss.position.set(br.position.x + Math.cos(a) * 1.2, br.position.y - 0.4, br.position.z + Math.sin(a) * 1.2);
        moss.rotation.x = Math.PI; S.add(moss);
      }
      this.collision.add({ kind: 'cyl', x, z, r: 1.3, top: 100, tall: true });
    }
    // Hollow stump
    {
      const { x, z } = SPECIAL_TREES.stump; const y = terrainHeight(x, z);
      const sm = new THREE.MeshStandardMaterial({ map: barkTexture(0x5b4a36), roughness: 1, side: THREE.DoubleSide });
      const stump = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.7, 3.4, 18, 1, true), sm);
      stump.position.set(x, y + 1.4, z); stump.castShadow = true; S.add(stump);
      const inner = new THREE.Mesh(new THREE.CircleGeometry(2.2, 18), new THREE.MeshStandardMaterial({ color: 0x2c2216 }));
      inner.rotation.x = -Math.PI / 2; inner.position.set(x, y + 2.3, z); S.add(inner);
      this.collision.add({ kind: 'cyl', x, z, r: 2.6, top: 100, tall: true });
    }
  }

  // -------------------------------------------------------------------------
  private keepClear(x: number, z: number, extra = 0): boolean {
    if (nearSecret(x, z, extra)) return true;   // secret doors and their maps
    if (Math.hypot(x + 12, z + 7) < 4 + extra) return true;   // the Magic Zoo hut
    if (Math.hypot(x, z) < 16 + extra) return true; // clearing
    for (const p of FRIEND_SPOTS) if (Math.hypot(x - p.x, z - (p.z + 1)) < 6.5 + extra) return true; // friends' houses in the forest
    if (Math.abs(z - pathZ(x)) < 3.2 + extra) return true;
    if (Math.abs(Math.abs(x) - WORLD.zoneEdge) < 3 + extra) return true;
    if (inPit(x, z, 3)) return true;
    for (const s of FOOD_SPAWNS) if (Math.hypot(x - s.x, z - s.z) < 2.6 + extra) return true;
    for (const s of MAP_SPOTS) if (Math.hypot(x - s.x, z - s.z) < 2.6 + extra) return true;
    for (const s of OPP_SPAWNS) if (Math.hypot(x - s.x, z - s.z) < 4 + extra) return true;
    for (const p of PLATFORMS) if (Math.hypot(x - p.x, z - p.z) < p.r + 2.5 + extra) return true;
    for (const l of LANDMARKS) if (Math.hypot(x - l.signX, z - l.signZ) < 2 + extra) return true;
    for (const t of Object.values(SPECIAL_TREES)) if (Math.hypot(x - t.x, z - t.z) < 4.5 + extra) return true;
    if (Math.hypot(x - HIDDEN_CLEARING.x, z - HIDDEN_CLEARING.z) < HIDDEN_CLEARING.r + 1.8 + extra) return true;
    if (Math.hypot(x - MUSHROOM_RING.x, z - MUSHROOM_RING.z) < MUSHROOM_RING.r + 2 + extra) return true;
    if (x > FALLEN_LOG.x0 - 2 && x < FALLEN_LOG.x1 + 2 && Math.abs(z - FALLEN_LOG.z) < 2.5 + extra) return true;
    if (x > BOARDWALK.minX - 1.5 && x < BOARDWALK.maxX + 1.5 && z > BOARDWALK.minZ - 1.5 - extra && z < BOARDWALK.maxZ + 1.5 + extra) return true;
    for (const t of TERMITES) if (Math.hypot(x - t.x, z - t.z) < 2.5 + extra) return true;
    if (Math.hypot(x - TUTORIAL_RING.x, z - TUTORIAL_RING.z) < 3 + extra) return true;
    return false;
  }

  private scatter(seed: number, count: number, x0: number, x1: number, accept: (x: number, z: number) => boolean, attempts = 6) {
    const r = rng(seed); const out: [number, number, number, number][] = [];
    for (let i = 0; i < count * attempts && out.length < count; i++) {
      const x = x0 + r() * (x1 - x0), z = WORLD.minZ + 2 + r() * (WORLD_D - 4);
      if (accept(x, z)) out.push([x, z, r(), r()]);
    }
    return out;
  }

  private instanced(geo: THREE.BufferGeometry, mat: THREE.Material, pts: [number, number, number, number][], opts: {
    scale: (a: number, b: number) => number; yOff?: number; collide?: number; tint?: (a: number, b: number, c: THREE.Color) => void; shadow?: boolean; yFn?: (x: number, z: number) => number; tilt?: number;
  }) {
    const im = new THREE.InstancedMesh(geo, mat, pts.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const col = new THREE.Color();
    pts.forEach(([x, z, a, b], i) => {
      const sc = opts.scale(a, b);
      const y = (opts.yFn ? opts.yFn(x, z) : terrainHeight(x, z)) + (opts.yOff ?? 0);
      e.set((b - 0.5) * (opts.tilt ?? 0), a * Math.PI * 2, (a - 0.5) * (opts.tilt ?? 0));
      q.setFromEuler(e); s.setScalar(sc); p.set(x, y, z);
      m.compose(p, q, s); im.setMatrixAt(i, m);
      if (opts.tint) { opts.tint(a, b, col); im.setColorAt(i, col); }
      if (opts.collide) this.collision.add({ kind: 'cyl', x, z, r: opts.collide * sc, top: 100, tall: true });
    });
    im.castShadow = opts.shadow ?? true;
    im.receiveShadow = false;
    im.computeBoundingSphere();
    this.scene.add(im);
    return im;
  }

  private windMaterial(color: number, map: THREE.Texture | null, alpha: boolean): THREE.MeshStandardMaterial {
    const mat = new THREE.MeshStandardMaterial({ color, map, alphaTest: alpha ? 0.45 : 0, side: THREE.DoubleSide, roughness: 0.95 });
    const wu = this.windUniform;
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uWind = wu;
      sh.vertexShader = 'uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float wph = instanceMatrix[3].x * 0.35 + instanceMatrix[3].z * 0.27;
        #else
          float wph = 0.0;
        #endif
        transformed.x += sin(uWind * 1.7 + wph) * 0.09 * position.y;
        transformed.z += cos(uWind * 1.3 + wph) * 0.06 * position.y;`);
      // foliage is lit from "above" on both faces (no dark back faces)
      sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n normal = normalize(vNormal);');
    };
    this.windMats.push(mat);
    return mat;
  }

  private buildVegetation() {
    const E = WORLD.zoneEdge;
    const vcMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
    const barkVc = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
    const inForest = (x: number) => x > -E + 3 && x < E - 3;
    const inSav = (x: number) => x > E + 3;
    const inSwamp = (x: number) => x < -E - 3;

    // ---- Forest trees
    const pine = pineGeometry();
    const broad = broadleafGeometry();
    const pinePts = this.scatter(1, 280, -E, E, (x, z) => !this.keepClear(x, z, 1.5) && fbm(x * 0.04, z * 0.04) > 0.42);
    const broadPts = this.scatter(2, 230, -E, E, (x, z) => !this.keepClear(x, z, 1.5) && fbm(x * 0.04, z * 0.04) <= 0.52);
    const treeTint = (a: number, b: number, c: THREE.Color) => c.setHSL(0, 0, 0.82 + a * 0.3);
    this.instanced(pine, vcMat, pinePts.filter(([x]) => inForest(x)), { scale: (a) => 0.8 + a * 0.6, collide: 0.35, tint: treeTint });
    this.instanced(broad, vcMat, broadPts.filter(([x]) => inForest(x)), { scale: (a) => 0.8 + a * 0.5, collide: 0.4, tint: treeTint });

    // ---- Bushes and ferns (no collision)
    const bush = foliageBlob(3, 1.0, 0x2f5a22, 0x52803a, 99);
    this.instanced(bush, vcMat, this.scatter(3, 350, -E, E, (x, z) => !this.keepClear(x, z, 0.5)), { scale: (a) => 0.6 + a * 0.7, yOff: 0.4, tint: treeTint });
    const fern = fernGeometry();
    const fernMat = this.windMaterial(0x4f8a2e, null, false);
    this.instanced(fern, fernMat, this.scatter(4, 950, -E, E, (x, z) => !this.keepClear(x, z, -0.8) && inForest(x)), { scale: (a) => 0.7 + a * 0.7, tint: (a, _b, c) => c.setHSL(0.27 + a * 0.05, 0.5, 0.35 + a * 0.15), shadow: false });

    // ---- Grass
    const blade = grassClumpGeometry(0.5, 0.55);
    const grassMat = this.windMaterial(0xffffff, null, false);
    grassMat.vertexColors = true;
    this.instanced(blade, grassMat, this.scatter(5, 6400, -E + 2, E - 2, (x, z) => !this.keepClear(x, z, -2.8) && Math.hypot(x - WORLD.home.x, z - WORLD.home.z) > 6),
      { scale: (a) => 0.7 + a * 0.6, tint: (a, b, c) => c.setRGB(0.36 + a * 0.12, 0.55 + b * 0.15, 0.2), shadow: false });
    const tallBlade = grassClumpGeometry(0.6, 1.1);
    this.instanced(tallBlade, grassMat, this.scatter(6, 11000, E + 1, WORLD.maxX, (x, z) => !inPit(x, z, 2.5) && !(Math.abs(z - pathZ(x)) < 1.6) && !this.nearSpawn(x, z, 1.6)),
      { scale: (a) => 0.7 + a * 0.7, tint: (a, b, c) => c.setRGB(0.82 + a * 0.12, 0.66 + b * 0.12, 0.33), shadow: false });

    // ---- Savanna acacias & rocks
    const acacia = acaciaGeometry();
    this.instanced(acacia, vcMat, this.scatter(7, 80, E + 6, WORLD.maxX - 4, (x, z) => !this.keepClear(x, z, 3)), { scale: (a) => 0.85 + a * 0.5, collide: 0.3, tint: treeTint });
    const rockGeo = rockGeometry(11);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0xa48468, map: rockTexture(), roughness: 1 });
    const rocks = this.scatter(8, 100, E + 4, WORLD.maxX - 4, (x, z) => !this.keepClear(x, z, 1));
    this.instanced(rockGeo, rockMat, rocks, { scale: (a) => 0.6 + a * 1.3, yOff: -0.2, collide: 0.8 });
    const forestRocks = this.scatter(9, 65, -E + 4, E - 4, (x, z) => !this.keepClear(x, z, 1));
    this.instanced(rockGeo, new THREE.MeshStandardMaterial({ color: 0x8c8c80, map: rockTexture(), roughness: 1 }), forestRocks, { scale: (a) => 0.4 + a * 0.9, yOff: -0.15, collide: 0.8 });

    // ---- Swamp trees, reeds
    const cypress = cypressGeometry();
    this.instanced(cypress, vcMat, this.scatter(10, 140, WORLD.minX + 3, -E - 6, (x, z) => !this.keepClear(x, z, 2)), { scale: (a) => 0.8 + a * 0.5, collide: 0.55, tint: treeTint, yFn: (x, z) => Math.min(terrainHeight(x, z), 0.2) });
    const dead = deadTreeGeometry();
    this.instanced(dead, barkVc, this.scatter(11, 45, WORLD.minX + 3, -E - 6, (x, z) => !this.keepClear(x, z, 2)), { scale: (a) => 0.7 + a * 0.6, collide: 0.3, tint: treeTint, yFn: (x, z) => Math.min(terrainHeight(x, z), 0.1) });
    const reed = reedGeometry();
    const reedMat = this.windMaterial(0xffffff, null, false);
    reedMat.vertexColors = true;
    const reedPts = this.scatter(12, 3000, WORLD.minX + 2, -E - 2, (x, z) => !this.keepClear(x, z, -1.6) && fbm(x * 0.06, z * 0.06) > 0.4);
    // extra dense reeds around the hidden swamp food
    const r = rng(77);
    for (let i = 0; i < 60; i++) { const a = r() * 6.28, d = 1.4 + r() * 2.5; reedPts.push([-183.5 + Math.cos(a) * d, -34 + Math.sin(a) * d, r(), r()]); }
    this.instanced(reed, reedMat, reedPts, { scale: (a) => 0.8 + a * 0.6, shadow: false, tilt: 0.2, yFn: (x, z) => terrainHeight(x, z) });
    const swampGrass = grassClumpGeometry(0.5, 0.7);
    this.instanced(swampGrass, grassMat, this.scatter(13, 3800, WORLD.minX + 2, -E - 2, (x, z) => terrainHeight(x, z) > 0.05 && !this.keepClear(x, z, -2.6)),
      { scale: (a) => 0.7 + a * 0.6, tint: (a, b, c) => c.setRGB(0.35 + a * 0.1, 0.45 + b * 0.1, 0.22), shadow: false });

    void inSav; void inSwamp;
  }

  private nearSpawn(x: number, z: number, d: number) {
    for (const s of FOOD_SPAWNS) if (Math.hypot(x - s.x, z - s.z) < d) return true;
    return false;
  }

  // -------------------------------------------------------------------------
  private buildBorders() {
    // boulder walls & hedges along the zone edges, except at the gates
    const E = WORLD.zoneEdge;
    const geo = rockGeometry(21);
    const mat = new THREE.MeshStandardMaterial({ color: 0x8a8578, map: rockTexture(), roughness: 1 });
    const hedge = foliageBlob(3, 1.3, 0x2f5a22, 0x48743a, 5);
    const hedgeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
    const pts: [number, number, number, number][] = [];
    const hedges: [number, number, number, number][] = [];
    const r = rng(55);
    for (const sx of [-1, 1]) for (let z = WORLD.minZ; z <= WORLD.maxZ; z += 2.2) {
      if (Math.abs(z) < WORLD.gateHalfWidth + 1.6) continue;
      pts.push([sx * E + (r() - 0.5) * 0.8, z, r(), r()]);
      if (r() < 0.6) hedges.push([sx * E + (r() - 0.5) * 3, z + 1, r(), r()]);
    }
    this.instanced(geo, mat, pts, { scale: (a) => 1.3 + a * 0.7, yOff: 0.2 });
    this.instanced(hedge, hedgeMat, hedges, { scale: (a) => 0.9 + a * 0.5, yOff: 0.8, shadow: true });
  }

  private buildGates() {
    const E = WORLD.zoneEdge;
    const postMat = new THREE.MeshStandardMaterial({ map: barkTexture(0x6b4a2e), roughness: 1 });
    for (const zone of ['savanna', 'swamp'] as ZoneId[]) {
      const x = zone === 'savanna' ? E : -E;
      const y = terrainHeight(x, 0);
      const g = new THREE.Group(); g.position.set(x, y, 0); this.scene.add(g);
      for (const z of [-WORLD.gateHalfWidth - 0.4, WORLD.gateHalfWidth + 0.4]) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 5.4, 10), postMat);
        p.position.set(0, 2.7, z); p.castShadow = true; g.add(p);
        this.collision.add({ kind: 'cyl', x, z, r: 0.45, top: 100, tall: true });
      }
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, WORLD.gateHalfWidth * 2 + 2.2, 10), postMat);
      beam.rotation.x = Math.PI / 2; beam.position.set(0, 5.2, 0); beam.castShadow = true; g.add(beam);
      // signs on both faces
      const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 256;
      const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
      const signMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 });
      const face = zone === 'savanna' ? -1 : 1; // the sign faces the forest
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.1), signMat);
      sign.position.set(face * 0.3, 3.7, 0); sign.rotation.y = face * Math.PI / 2; g.add(sign);
      const back = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.1), new THREE.MeshStandardMaterial({ map: signTexture(['← Forest (Home)'], 512, 160), roughness: 0.8 }));
      if (zone === 'swamp') (back.material as THREE.MeshStandardMaterial).map = signTexture(['Forest (Home) →'], 512, 160);
      back.position.set(-face * 0.3, 4.3, 0); back.rotation.y = -face * Math.PI / 2; g.add(back);
      // barrier logs (removed when open)
      const barrier = new THREE.Group();
      for (const h of [0.6, 1.4, 2.2]) {
        const log = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, WORLD.gateHalfWidth * 2 + 0.8, 8), postMat);
        log.rotation.x = Math.PI / 2; log.position.set(0, h, 0); log.castShadow = true; barrier.add(log);
      }
      g.add(barrier);
      // solid walls along the zone edge (the gap is the gate)
      const H = WORLD.gateHalfWidth;
      this.collision.add({ kind: 'box', minX: x - 0.6, maxX: x + 0.6, minZ: WORLD.minZ - 5, maxZ: -H, top: 100, tall: true });
      this.collision.add({ kind: 'box', minX: x - 0.6, maxX: x + 0.6, minZ: H, maxZ: VILLAGE.maxZ + 8, top: 100, tall: true });
      const barrierCollider = this.collision.add({ kind: 'box', minX: x - 0.6, maxX: x + 0.6, minZ: -H, maxZ: H, top: 100, tall: true });
      this.gates.push({ zone, x, barrier, sign: { canvas, tex }, open: false, barrierCollider });
    }
  }

  /** Day/night tinting (set by the game; 0..1 where 0.25 = noon, 0.75 = midnight). */
  timeOfDay = 0.1;
  homeLights: THREE.MeshStandardMaterial[] = [];
  indoorsDark = false;
  daylight = 1;
  private stars?: THREE.Points;
  private clouds: { s: THREE.Sprite; off: THREE.Vector3 }[] = [];
  private cloudMat?: THREE.SpriteMaterial;
  private moon?: THREE.Sprite;
  private nightTop = new THREE.Color(0x0b1430);
  private nightHorizon = new THREE.Color(0x24304d);
  private duskColor = new THREE.Color(0xff9a5c);
  private moonColor = new THREE.Color(0xa9bcff);

  /** Sun angle: the day half lasts 60% of the cycle, the night 40%. */
  private sunAngle() {
    const t = ((this.timeOfDay % 1) + 1) % 1;
    return t < 0.6 ? (t / 0.6) * Math.PI : Math.PI + ((t - 0.6) / 0.4) * Math.PI;
  }

  private applyDayNight(fog: THREE.Fog) {
    if (!this.stars) {
      const n = 900, pos = new Float32Array(n * 3), r = rng(1234);
      for (let i = 0; i < n; i++) {
        const a = r() * Math.PI * 2, e = Math.asin(0.08 + r() * 0.92);
        pos[i * 3] = Math.cos(a) * Math.cos(e) * 420; pos[i * 3 + 1] = Math.sin(e) * 420; pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * 420;
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      this.stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, depthWrite: false, fog: false }));
      this.stars.frustumCulled = false; this.stars.renderOrder = -1;
      this.scene.add(this.stars);
      this.moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDotTexture(), color: 0xf4f6ff, transparent: true, depthWrite: false, fog: false }));
      this.moon.scale.setScalar(40);
      this.scene.add(this.moon);
    }
    const ang = this.sunAngle();
    const sunH = Math.sin(ang);
    const day = smoothstep(-0.18, 0.28, sunH);
    const dusk = day * (1 - smoothstep(0.05, 0.4, sunH));
    this.daylight = day;
    const focus = this.sun.target.position;
    // sun by day, moon by night
    const dir = sunH >= -0.05 ? new THREE.Vector3(Math.cos(ang) * 50, Math.max(sunH, 0.12) * 55, 18) : new THREE.Vector3(-Math.cos(ang) * 50, Math.max(-sunH, 0.3) * 55, 18);
    this.sun.position.copy(focus).add(dir);
    this.sun.color.lerp(this.duskColor, dusk * 0.7).lerp(this.moonColor, 1 - day);
    this.sun.intensity = this.sun.intensity * day + 0.55 * (1 - day);
    this.hemi.intensity *= 0.52 + 0.48 * day;
    const top = this.skyUniforms.top.value, hor = this.skyUniforms.bottom.value;
    hor.lerp(this.duskColor, dusk * 0.55);
    top.lerp(this.nightTop, 1 - day);
    hor.lerp(this.nightHorizon, 1 - day);
    this.fogColor.lerp(this.duskColor, dusk * 0.3).lerp(this.nightHorizon, 1 - day);
    fog.color.copy(this.fogColor);
    (this.stars!.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - day * 1.6);
    this.stars!.position.set(focus.x, 0, focus.z);
    this.moon!.visible = sunH < 0.1;
    this.moon!.position.copy(focus).add(dir.clone().normalize().multiplyScalar(380));
    // inside your house at night it's dark unless the lamps are on
    if (this.indoorsDark) { this.hemi.intensity *= 0.3 + 0.7 * day; this.sun.intensity *= 0.25 + 0.75 * day; }
    this.scene.environmentIntensity = 0.08 + 0.3 * day;
    // drifting clouds (wrap around the player)
    if (!this.cloudMat) {
      this.cloudMat = new THREE.SpriteMaterial({ map: softDotTexture(), color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false, fog: false });
      const r = rng(77777);
      for (let i = 0; i < 26; i++) {
        const cx = (r() - 0.5) * 520, cz = (r() - 0.5) * 520, cy = 75 + r() * 25;
        for (let k = 0; k < 4; k++) {
          const sp = new THREE.Sprite(this.cloudMat);
          const sc = 30 + r() * 30;
          sp.scale.set(sc * 1.6, sc * 0.55, 1);
          this.scene.add(sp);
          this.clouds.push({ s: sp, off: new THREE.Vector3(cx + (r() - 0.5) * 40, cy + r() * 6, cz + (r() - 0.5) * 20) });
        }
      }
    }
    const drift = performance.now() / 1000 * 2.2;
    for (const c of this.clouds) {
      const x = ((c.off.x + drift + 260) % 520 + 520) % 520 - 260;
      c.s.position.set(focus.x + x, c.off.y, focus.z + c.off.z);
    }
    this.cloudMat.color.setRGB(0.22 + 0.78 * day, 0.25 + 0.75 * day, 0.32 + 0.68 * day).lerp(this.duskColor, dusk * 0.35);
    this.cloudMat.opacity = 0.45 + 0.4 * day;
    // windows and lanterns glow brighter at night
    const glow = 0.25 + (1 - day) * 1.4;
    for (const m of this.nightLights) m.emissiveIntensity = glow;
    for (const m of this.homeLights) m.emissiveIntensity = glow;
  }

  private buildVillagePlants() {
    const vcMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
    const r = rng(4242);
    const trees: [number, number, number, number][] = [];
    for (let i = 0; i < 2000 && trees.length < 90; i++) {
      const x = -62 + r() * 124, z = 64 + r() * 94;
      const side = Math.abs(x) > 52 || z > 150 || (z < 80 && Math.abs(x) > 8); // edges and hillside, not the farmland
      if (!side || villageKeepClear(x, z, 1.5) || nearSecret(x, z, 1) || Math.abs(x) < 5) continue;
      trees.push([x, z, r(), r()]);
    }
    const tint = (a: number, _b: number, c: THREE.Color) => c.setHSL(0, 0, 0.82 + a * 0.3);
    this.instanced(broadleafGeometry(), vcMat, trees.filter((_, i) => i % 2 === 0), { scale: (a) => 0.8 + a * 0.5, collide: 0.4, tint });
    this.instanced(pineGeometry(), vcMat, trees.filter((_, i) => i % 2 === 1), { scale: (a) => 0.8 + a * 0.5, collide: 0.35, tint });
    const grassMat = this.windMaterial(0xffffff, null, false);
    grassMat.vertexColors = true;
    const grass: [number, number, number, number][] = [];
    for (let i = 0; i < 9000 && grass.length < 2600; i++) {
      const x = -62 + r() * 124, z = 64 + r() * 94;
      if (villageKeepClear(x, z, -1.5) || nearSecret(x, z, -1)) continue;
      grass.push([x, z, r(), r()]);
    }
    this.instanced(grassClumpGeometry(0.5, 0.55), grassMat, grass, { scale: (a) => 0.7 + a * 0.6, tint: (a, b, c) => c.setRGB(0.4 + a * 0.12, 0.6 + b * 0.15, 0.22), shadow: false });
  }

  setGate(zone: ZoneId, open: boolean, lines: string[]) {
    const g = this.gates.find((q) => q.zone === zone);
    if (!g) return;
    g.open = open;
    g.barrier.visible = !open;
    if (open && g.barrierCollider) { this.collision.remove(g.barrierCollider); g.barrierCollider = null; }
    if (!open && !g.barrierCollider) g.barrierCollider = this.collision.add({ kind: 'box', minX: g.x - 0.6, maxX: g.x + 0.6, minZ: -WORLD.gateHalfWidth, maxZ: WORLD.gateHalfWidth, top: 100, tall: true });
    const ctx = g.sign.canvas.getContext('2d')!;
    drawSign(ctx, lines, 512, 256);
    g.sign.tex.needsUpdate = true;
  }

  private buildSigns() {
    const postMat = new THREE.MeshStandardMaterial({ map: barkTexture(0x6b4a2e), roughness: 1 });
    for (const l of LANDMARKS) {
      const y = Math.max(terrainHeight(l.signX, l.signZ), l.zone === 'swamp' ? 0 : -99);
      const g = new THREE.Group(); g.position.set(l.signX, y, l.signZ);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2, 6), postMat); post.position.y = 1; post.castShadow = true; g.add(post);
      const lines = [l.name];
      if (l.name === 'Canyon Pit' || l.name === 'Sinking Bog') lines.push('Careful! Don\'t fall in');
      if (l.name === 'Pride Rock') lines.push('Lion territory');
      if (l.name === 'Iceberg Hop') lines.push('Careful! Icy water');
      if (l.name === 'Penguin Colony') lines.push('Shh, chicks sleeping');
      const board = new THREE.Mesh(new THREE.BoxGeometry(2.4, lines.length > 1 ? 1.1 : 0.7, 0.08), [postMat, postMat, postMat, postMat,
        new THREE.MeshStandardMaterial({ map: signTexture(lines, 512, lines.length > 1 ? 240 : 150) }), new THREE.MeshStandardMaterial({ map: signTexture(lines, 512, lines.length > 1 ? 240 : 150) })]);
      board.position.y = 2.1; board.castShadow = true; g.add(board);
      // face the sign toward the landmark's approach (toward world centre line)
      g.rotation.y = Math.atan2(l.signX - l.x, l.signZ - l.z); // face away from the landmark, toward visitors
      this.scene.add(g);
      this.collision.add({ kind: 'cyl', x: l.signX, z: l.signZ, r: 0.25, top: 100, tall: true });
    }
  }

  // -------------------------------------------------------------------------
  update(dt: number, t: number, focus: THREE.Vector3) {
    this.windUniform.value = t;
    // shadow camera follows the player
    this.sun.target.position.copy(focus);
    this.sky.position.set(focus.x, 0, focus.z);
    // blend zone looks
    const E = WORLD.zoneEdge;
    const wj = smoothstep(450, 520, focus.z);
    const wa = smoothstep(150, 200, focus.z) * (1 - wj);
    const wv = Math.abs(focus.x) < E + 10 ? smoothstep(60, 82, focus.z) * (1 - wa) : 0;
    const ws = smoothstep(E - 12, E + 12, focus.x) * (1 - wa) * (1 - wv);
    const ww = smoothstep(-E + 12, -E - 12, focus.x) * (1 - wa) * (1 - wv);
    const weights: [ZoneLook, number][] = [
      [LOOKS.forest, Math.max(0, 1 - wa - wj - wv - ws - ww)], [LOOKS.savanna, ws], [LOOKS.swamp, ww], [LOOKS.village, wv], [LOOKS.antarctica, wa], [LOOKS.jungle, wj],
    ];
    const blendC = (key: 'fog' | 'skyTop' | 'skyHorizon' | 'sun', out: THREE.Color) => {
      out.setRGB(0, 0, 0);
      for (const [l, w] of weights) { out.r += l[key].r * w; out.g += l[key].g * w; out.b += l[key].b * w; }
      return out;
    };
    const blendN = (key: 'near' | 'far' | 'sunI' | 'hemiI') => weights.reduce((a, [l, w]) => a + l[key] * w, 0);
    const fog = this.scene.fog as THREE.Fog;
    blendC('fog', this.fogColor);
    blendC('skyTop', this.skyUniforms.top.value);
    blendC('skyHorizon', this.skyUniforms.bottom.value);
    blendC('sun', this.sun.color);
    fog.near = blendN('near'); fog.far = blendN('far');
    this.sun.intensity = blendN('sunI');
    this.hemi.intensity = blendN('hemiI');
    this.applyDayNight(fog);
    this.antarctica.update(dt, focus);
    if (this.jungle.update(dt, t, focus)) this.monkeyChatter = true;
    for (const sail of windmillSails) sail.rotation.z += dt * 0.6;
    for (const m of this.mist) {
      const b = m.userData.base as THREE.Vector3; const ph = m.userData.phase as number;
      m.position.set(b.x + Math.sin(t * 0.05 + ph) * 4, b.y + Math.sin(t * 0.3 + ph) * 0.2, b.z + Math.cos(t * 0.04 + ph) * 3);
    }
    this.tutorialRing.rotation.z = t;
    const sc = 1 + Math.sin(t * 3) * 0.06; this.tutorialRing.scale.set(sc, sc, sc);
    void dt; void this.water;
  }
}

// ---------------------------------------------------------------------------
// Geometry helpers (vertex coloured, merged)
// ---------------------------------------------------------------------------
function colorize(g: THREE.BufferGeometry, color: number | ((x: number, y: number, z: number) => THREE.Color)) {
  const ng = g.index ? g.toNonIndexed() : g;
  const pos = ng.attributes.position as THREE.BufferAttribute;
  const arr = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    if (typeof color === 'number') c.setHex(color); else c.copy(color(pos.getX(i), pos.getY(i), pos.getZ(i)));
    arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b;
  }
  ng.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  if (!ng.attributes.uv) ng.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2));
  return ng;
}

function blobGeo(radius: number, seed: number, detailW = 9, detailH = 7) {
  const g = new THREE.SphereGeometry(radius, detailW, detailH);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const k = 1 + (noise2(x * 1.7 + seed, z * 1.7 + y * 1.3) - 0.5) * 0.45;
    pos.setXYZ(i, x * k, y * k * 0.85, z * k);
  }
  g.computeVertexNormals();
  return g;
}

/** Cluster of leafy blobs (vertex-coloured, with light tops). */
export function foliageBlob(n: number, size: number, dark: number, light: number, seed: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const r = rng(seed);
  const cd = new THREE.Color(dark), cl = new THREE.Color(light), tmp = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const g = blobGeo(size * (0.6 + r() * 0.5), seed + i * 7);
    const a = r() * Math.PI * 2, d = n > 1 ? size * (0.4 + r() * 0.5) : 0;
    g.translate(Math.cos(a) * d, (r() - 0.3) * size * 0.6, Math.sin(a) * d);
    parts.push(colorize(g, (_x, y) => tmp.copy(cd).lerp(cl, Math.min(1, Math.max(0, (y / size) * 0.6 + 0.45)))));
  }
  return mergeGeometries(parts)!;
}

function trunkGeo(rt: number, rb: number, h: number, color: number, y0 = 0) {
  const g = new THREE.CylinderGeometry(rt, rb, h, 7);
  g.translate(0, y0 + h / 2, 0);
  const c = new THREE.Color(color), tmp = new THREE.Color();
  return colorize(g, (x, y, z) => tmp.copy(c).multiplyScalar(0.8 + noise2(Math.atan2(z, x) * 3, y * 2) * 0.4));
}

function pineGeometry() {
  const parts = [trunkGeo(0.18, 0.32, 3, 0x5b4230)];
  const dark = new THREE.Color(0x203f1f), light = new THREE.Color(0x3e6a30), tmp = new THREE.Color();
  for (let i = 0; i < 4; i++) {
    const r = 2.2 - i * 0.45, h = 2.6 - i * 0.3;
    const g = new THREE.ConeGeometry(r, h, 9, 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let k = 0; k < pos.count; k++) { const j = 1 + (noise2(pos.getX(k) * 3 + i, pos.getZ(k) * 3) - 0.5) * 0.25; pos.setX(k, pos.getX(k) * j); pos.setZ(k, pos.getZ(k) * j); }
    g.computeVertexNormals();
    g.translate(0, 2.3 + i * 1.35, 0);
    parts.push(colorize(g, (_x, y) => tmp.copy(dark).lerp(light, Math.min(1, Math.max(0, (y - 2) / 6)))));
  }
  return mergeGeometries(parts)!;
}

function broadleafGeometry() {
  const parts = [trunkGeo(0.22, 0.38, 3.6, 0x5e4632)];
  for (let i = 0; i < 3; i++) {
    const b = new THREE.CylinderGeometry(0.06, 0.14, 1.8, 5);
    b.rotateZ(0.8 * (i % 2 ? 1 : -1)); b.rotateY(i * 2.1); b.translate(Math.cos(i * 2.1) * 0.5, 3.2, Math.sin(i * 2.1) * 0.5);
    parts.push(colorize(b, 0x5e4632));
  }
  const crown = foliageBlob(5, 1.7, 0x2f5a22, 0x6a9a3e, 17);
  crown.translate(0, 4.8, 0);
  parts.push(crown);
  return mergeGeometries(parts)!;
}

function acaciaGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  const t = new THREE.CylinderGeometry(0.15, 0.3, 4, 7); t.rotateZ(0.12); t.translate(-0.25, 2, 0);
  parts.push(colorize(t, 0x6b5a48));
  for (const a of [0, 2.1, 4.2]) {
    const b = new THREE.CylinderGeometry(0.06, 0.13, 2.4, 5); b.rotateZ(0.9); b.rotateY(a); b.translate(Math.cos(a) * 0.8 - 0.4, 4.4, -Math.sin(a) * 0.8);
    parts.push(colorize(b, 0x6b5a48));
  }
  const canopy = foliageBlob(6, 1.4, 0x4f6a26, 0x7c9440, 41);
  canopy.scale(1.9, 0.35, 1.9); canopy.translate(-0.4, 5.2, 0);
  parts.push(canopy);
  return mergeGeometries(parts)!;
}

function cypressGeometry() {
  const parts = [trunkGeo(0.25, 0.7, 2, 0x4e4234, -0.6), trunkGeo(0.15, 0.25, 5, 0x5a4a3a, 1.4)];
  for (let i = 0; i < 3; i++) {
    const c = foliageBlob(2, 1.1, 0x2a4224, 0x4a6436, 60 + i);
    c.scale(1.2, 0.6, 1.2);
    c.translate((i - 1) * 0.6, 4.6 + i * 1.3, (i % 2) * 0.5);
    parts.push(c);
  }
  for (let i = 0; i < 6; i++) {
    const m = new THREE.ConeGeometry(0.12, 1.5, 4); m.rotateX(Math.PI);
    const a = i * 1.05; m.translate(Math.cos(a) * 1.1, 4.0 + (i % 3) * 1.2, Math.sin(a) * 1.1);
    parts.push(colorize(m, 0x7f8c66));
  }
  return mergeGeometries(parts)!;
}

function deadTreeGeometry() {
  const parts = [trunkGeo(0.12, 0.3, 4.5, 0x6e6658)];
  for (let i = 0; i < 4; i++) {
    const b = new THREE.CylinderGeometry(0.04, 0.1, 1.8, 5);
    b.rotateZ(0.9 * (i % 2 ? 1 : -1)); b.rotateY(i * 1.6); b.translate(Math.cos(i * 1.6) * 0.5, 2.6 + i * 0.5, -Math.sin(i * 1.6) * 0.5);
    parts.push(colorize(b, 0x6e6658));
  }
  return mergeGeometries(parts)!;
}

function rockGeometry(seed: number) {
  const g = new THREE.IcosahedronGeometry(1, 1);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const k = 0.75 + noise2(x * 2 + seed, z * 2 + y) * 0.5;
    pos.setXYZ(i, x * k * 1.2, y * k * 0.75, z * k);
  }
  g.computeVertexNormals();
  return g;
}

function grassClumpGeometry(w: number, h: number) {
  // a tuft of thin tapered blades, darker at the root and lighter at the tip
  const r = rng(Math.floor(w * 100 + h * 1000));
  const pos: number[] = [], col: number[] = [], nor: number[] = [];
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, d = r() * w * 0.4;
    const bx = Math.cos(a) * d, bz = Math.sin(a) * d;
    const hh = h * (0.55 + r() * 0.45), bw = 0.025 + r() * 0.02;
    const la = r() * Math.PI * 2, lean = h * (0.15 + r() * 0.3);
    const px = Math.cos(la + Math.PI / 2) * bw, pz = Math.sin(la + Math.PI / 2) * bw;
    const tx = bx + Math.cos(la) * lean, tz = bz + Math.sin(la) * lean;
    pos.push(bx - px, 0, bz - pz, bx + px, 0, bz + pz, tx, hh, tz);
    col.push(0.45, 0.45, 0.45, 0.45, 0.45, 0.45, 1, 1, 1);
    nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

function fernGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 7; i++) {
    const leaf = new THREE.PlaneGeometry(0.22, 0.9, 1, 3);
    const pos = leaf.attributes.position as THREE.BufferAttribute;
    for (let k = 0; k < pos.count; k++) {
      const y = pos.getY(k) + 0.45; // 0..0.9
      pos.setXYZ(k, pos.getX(k) * (1 - y * 0.9), y * 0.5 - y * y * 0.35, y * 0.9);
    }
    leaf.rotateY((i / 7) * Math.PI * 2);
    parts.push(leaf);
  }
  const g = mergeGeometries(parts)!;
  g.computeVertexNormals();
  const n = g.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, n.getX(i) * 0.3, 1, n.getZ(i) * 0.3);
  return g;
}

function reedGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const a = i * 1.3, d = 0.12 + (i % 2) * 0.1, h = 1.4 + (i % 3) * 0.35;
    const s = new THREE.CylinderGeometry(0.015, 0.025, h, 4); s.translate(Math.cos(a) * d, h / 2, Math.sin(a) * d);
    parts.push(colorize(s, 0x6f8a3c));
    if (i % 2 === 0) {
      const top = new THREE.CylinderGeometry(0.045, 0.045, 0.28, 6); top.translate(Math.cos(a) * d, h - 0.1, Math.sin(a) * d);
      parts.push(colorize(top, 0x5a3a22));
    }
    const leaf = new THREE.PlaneGeometry(0.06, h * 0.8); leaf.translate(0, h * 0.4, 0); leaf.rotateZ(0.25); leaf.rotateY(a + 1);
    parts.push(colorize(leaf, 0x7f9a45));
  }
  return mergeGeometries(parts)!;
}

function addMushrooms(scene: THREE.Scene, x: number, z: number, y: number, n: number, size: number, spotted = false) {
  const capCanvas = document.createElement('canvas'); capCanvas.width = capCanvas.height = 64;
  const g = capCanvas.getContext('2d')!;
  g.fillStyle = spotted ? '#c2362b' : '#a8744a'; g.fillRect(0, 0, 64, 64);
  if (spotted) { g.fillStyle = '#fff6e8'; for (let i = 0; i < 10; i++) { g.beginPath(); g.arc((i * 23) % 64, (i * 37) % 32 + 4, 3 + (i % 3), 0, 7); g.fill(); } }
  const capTex = new THREE.CanvasTexture(capCanvas); capTex.colorSpace = THREE.SRGBColorSpace;
  const cap = new THREE.MeshStandardMaterial({ map: capTex, roughness: 0.6 });
  const stem = new THREE.MeshStandardMaterial({ color: 0xf0e6d2, roughness: 0.8 });
  const r = rng(Math.floor(x * 13 + z * 7));
  for (let i = 0; i < n; i++) {
    const s = size * (0.7 + r() * 0.5);
    const ox = x + (r() - 0.5) * (n > 1 ? 2 : 0), oz = z + (r() - 0.5) * (n > 1 ? 0.6 : 0);
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.16 * s, 0.6 * s, 8), stem);
    st.position.set(ox, y + 0.3 * s + (n > 1 ? 1.3 : 0), oz); st.castShadow = true; scene.add(st);
    const cp = new THREE.Mesh(new THREE.SphereGeometry(0.42 * s, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), cap);
    cp.position.set(ox, y + 0.55 * s + (n > 1 ? 1.3 : 0), oz); cp.scale.y = 0.7; cp.castShadow = true; scene.add(cp);
  }
}
