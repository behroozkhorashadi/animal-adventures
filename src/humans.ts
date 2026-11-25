// Village humans: they walk their rounds, notice animals stealing food, and
// try to catch them with a net or broom. Getting caught sends you home.
// (Animals never fight humans; you sneak, run, hide in the corn, or jump.)
import * as THREE from 'three';
import { HUMAN_AI } from './config';
import { HumanSpawn, inCorn } from './layout';
import { CollisionWorld, zoneAt } from './terrain';
import { ringTexture } from './textures';

export type HumanState = 'patrol' | 'notice' | 'chase' | 'windup' | 'recover' | 'return';

export interface HumanContext {
  playerPos: THREE.Vector3;
  playerGroundY: number;
  playerActive: boolean; // false while respawning / travelling / indoors
  collision: CollisionWorld;
  now: number;
  onCatch: (h: Human) => void;
  onShout: (h: Human, text: string) => void;
  cameraPos?: THREE.Vector3;
}

const SKIN = [0xf1c8a5, 0xd9a47a, 0xa86f48, 0x7a4b2e];

export class Human {
  spawn: HumanSpawn;
  root = new THREE.Group();
  private body = new THREE.Group();
  private legs: THREE.Object3D[] = [];
  private arms: THREE.Object3D[] = [];
  private toolArm!: THREE.Object3D;
  pos = new THREE.Vector3();
  yaw = 0;
  state: HumanState = 'patrol';
  private wp = 1;
  private timer = 0;
  private lostSight = 0;
  private phase = Math.random() * 6;
  private speedNow = 0;
  private alertRing: THREE.Mesh;
  private mark: THREE.Sprite;
  private markTex: { canvas: HTMLCanvasElement; tex: THREE.CanvasTexture; text: string };
  label: HTMLDivElement;
  readonly radius = 0.4;
  speedMult = 1;           // indoors the pet owner is a bit slower
  labelOverride = '';      // e.g. "Taking you for a walk"
  active = true;

  setName(name: string) { (this.label.querySelector('.np-name') as HTMLElement).textContent = '🧑 ' + name; }
  /** Move this human to a new place with a new walking route. */
  place(route: [number, number][]) {
    this.spawn.route = route;
    this.wp = 1 % route.length;
    this.pos.set(route[0][0], 0, route[0][1]);
    this.state = 'patrol';
  }

  constructor(spawn: HumanSpawn, scene: THREE.Scene, labelLayer: HTMLElement, idx: number) {
    this.spawn = spawn;
    this.buildModel(idx);
    scene.add(this.root);
    const [x, z] = spawn.route[0];
    this.pos.set(x, 0, z);
    // "!" / "?" marker over the head
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const tex = new THREE.CanvasTexture(c);
    this.markTex = { canvas: c, tex, text: '' };
    this.mark = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    this.mark.scale.setScalar(0.75); this.mark.renderOrder = 6; this.mark.visible = false;
    scene.add(this.mark);
    this.alertRing = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: ringTexture(), color: 0xff7a3d, transparent: true, depthWrite: false }));
    this.alertRing.rotation.x = -Math.PI / 2; this.alertRing.visible = false;
    scene.add(this.alertRing);
    this.label = document.createElement('div');
    this.label.className = 'nameplate';
    this.label.style.display = 'none';
    this.label.innerHTML = `<div class="np-name"></div><div class="np-strength"></div>`;
    (this.label.querySelector('.np-name') as HTMLElement).textContent = '🧑 ' + spawn.name;
    labelLayer.appendChild(this.label);
  }

  private buildModel(idx: number) {
    const k = this.spawn.kind;
    const m = (c: number, r = 0.8) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
    const skin = m(SKIN[idx % SKIN.length], 0.6);
    const shirt = m(k === 'farmer' ? (idx % 2 ? 0x3d7a4a : 0xb83a32) : 0xf4f2ec);
    const pants = m(k === 'farmer' ? 0x2f4f7a : 0x3a3a40);
    const shoes = m(0x3a2a1e);
    const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
      const mesh = new THREE.Mesh(geo, mat); mesh.position.set(x, y, z); mesh.castShadow = true; parent.add(mesh); return mesh;
    };
    this.root.add(this.body);
    // legs (pivot at hip)
    for (const sx of [-0.12, 0.12]) {
      const p = new THREE.Group(); p.position.set(sx, 0.9, 0); this.body.add(p);
      add(p, new THREE.CylinderGeometry(0.085, 0.075, 0.85, 8), pants, 0, -0.43, 0);
      add(p, new THREE.BoxGeometry(0.16, 0.1, 0.28), shoes, 0, -0.86, 0.05);
      this.legs.push(p);
    }
    // torso
    add(this.body, new THREE.CylinderGeometry(0.22, 0.2, 0.62, 10), shirt, 0, 1.22, 0).scale.z = 0.7;
    if (k === 'farmer') add(this.body, new THREE.BoxGeometry(0.34, 0.5, 0.05), pants, 0, 1.18, 0.15); // overall bib
    else add(this.body, new THREE.BoxGeometry(0.36, 0.7, 0.04), m(0xffffff, 0.9), 0, 1.05, 0.16); // apron
    // head
    const head = add(this.body, new THREE.SphereGeometry(0.17, 14, 12), skin, 0, 1.72, 0);
    head.scale.set(1, 1.1, 1);
    const eye = m(0x1a1a1a, 0.3);
    for (const sx of [-0.06, 0.06]) add(this.body, new THREE.SphereGeometry(0.022, 8, 6), eye, sx, 1.75, 0.15);
    add(this.body, new THREE.SphereGeometry(0.17, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), m(idx % 2 ? 0x3a2a1a : 0x8a5a2a), 0, 1.76, -0.02); // hair
    if (k === 'farmer') {
      add(this.body, new THREE.CylinderGeometry(0.34, 0.34, 0.03, 18), m(0xd8b45a), 0, 1.86, 0);
      add(this.body, new THREE.CylinderGeometry(0.17, 0.19, 0.16, 14), m(0xd8b45a), 0, 1.94, 0);
    } else {
      add(this.body, new THREE.CylinderGeometry(0.2, 0.16, 0.3, 14), m(0xffffff, 0.9), 0, 2.0, 0); // chef hat
    }
    // arms (pivot at shoulder)
    for (const sx of [-0.28, 0.28]) {
      const p = new THREE.Group(); p.position.set(sx, 1.48, 0); this.body.add(p);
      add(p, new THREE.CylinderGeometry(0.06, 0.055, 0.6, 8), shirt, 0, -0.3, 0);
      add(p, new THREE.SphereGeometry(0.06, 8, 6), skin, 0, -0.62, 0);
      this.arms.push(p);
    }
    // tool in the right hand: net for farmers, broom for cooks/bakers
    this.toolArm = this.arms[1];
    const tool = new THREE.Group(); tool.position.set(0, -0.62, 0); this.toolArm.add(tool);
    add(tool, new THREE.CylinderGeometry(0.02, 0.02, 1.5, 6), m(0x8a6440), 0, 0, 0.55).rotation.x = Math.PI / 2;
    if (k === 'farmer') {
      const ring = add(tool, new THREE.TorusGeometry(0.28, 0.02, 6, 20), m(0x777777, 0.4), 0, 0, 1.55);
      ring.rotation.y = Math.PI / 2;
      const net = add(tool, new THREE.ConeGeometry(0.27, 0.45, 12, 1, true), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, side: THREE.DoubleSide, wireframe: true }), 0.22, 0, 1.55);
      net.rotation.z = Math.PI / 2;
    } else {
      add(tool, new THREE.ConeGeometry(0.16, 0.4, 10), m(0xc9a24a, 1), 0, 0, 1.4).rotation.x = -Math.PI / 2;
    }
    this.root.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
  }

  /** Stolen food nearby: come running. */
  alert() {
    if (this.state === 'patrol' || this.state === 'return' || this.state === 'notice') { this.state = 'chase'; this.lostSight = 0; }
  }

  calmDown() {
    if (this.state !== 'patrol') this.state = 'return';
    this.alertRing.visible = false;
  }

  private canSee(p: THREE.Vector3): boolean {
    const dx = p.x - this.pos.x, dz = p.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > HUMAN_AI.sightRange) return false;
    if (inCorn(p.x, p.z) && d > 2.2) return false; // hidden in the tall corn
    if (d < 1.8) return true;
    const ang = Math.acos(Math.max(-1, Math.min(1, (dx * Math.sin(this.yaw) + dz * Math.cos(this.yaw)) / d)));
    return ang < THREE.MathUtils.degToRad(HUMAN_AI.sightHalfAngleDeg);
  }

  private moveToward(tx: number, tz: number, speed: number, dt: number, ctx: HumanContext) {
    const dx = tx - this.pos.x, dz = tz - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.05) return 0;
    const step = Math.min(d, speed * dt);
    const p = { x: this.pos.x + (dx / d) * step, z: this.pos.z + (dz / d) * step };
    if (zoneAt(p.x, p.z) !== 'village') return 0; // humans stay in their village
    ctx.collision.resolve(p, this.pos.y, this.radius, 0.4);
    this.pos.x = p.x; this.pos.z = p.z;
    this.turnTo(Math.atan2(dx, dz), dt);
    return step / dt;
  }
  private turnTo(target: number, dt: number, rate = 7) {
    let d = target - this.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.yaw += d * Math.min(1, rate * dt);
  }

  private setMark(text: string) {
    this.mark.visible = !!text;
    if (text === this.markTex.text) return;
    this.markTex.text = text;
    const g = this.markTex.canvas.getContext('2d')!;
    g.clearRect(0, 0, 64, 64);
    if (!text) return;
    g.fillStyle = text === '!' ? '#ff6a3d' : '#ffcf33'; g.beginPath(); g.arc(32, 32, 28, 0, 7); g.fill();
    g.lineWidth = 5; g.strokeStyle = '#5a3000'; g.stroke();
    g.fillStyle = '#ffffff'; g.font = 'bold 42px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 32, 35);
    this.markTex.tex.needsUpdate = true;
  }

  get chasing() { return this.state === 'chase' || this.state === 'windup' || this.state === 'notice'; }

  update(dt: number, ctx: HumanContext) {
    const A = HUMAN_AI;
    const P = ctx.playerPos;
    const dist = Math.hypot(P.x - this.pos.x, P.z - this.pos.z);
    const sees = ctx.playerActive && zoneAt(P.x, P.z) === 'village' && this.canSee(P);
    let speed = 0;
    switch (this.state) {
      case 'patrol': {
        const [tx, tz] = this.spawn.route[this.wp];
        speed = this.moveToward(tx, tz, A.walkSpeed, dt, ctx);
        if (Math.hypot(tx - this.pos.x, tz - this.pos.z) < 0.4 || speed === 0) this.wp = (this.wp + 1) % this.spawn.route.length;
        if (sees) { this.state = 'notice'; this.timer = A.noticeTime; ctx.onShout(this, 'Huh? An animal!'); }
        break;
      }
      case 'notice':
        this.timer -= dt;
        this.turnTo(Math.atan2(P.x - this.pos.x, P.z - this.pos.z), dt);
        if (this.timer <= 0) {
          if (sees) { this.state = 'chase'; this.lostSight = 0; ctx.onShout(this, 'Hey! Come back here!'); }
          else this.state = 'patrol';
        }
        break;
      case 'chase': {
        if (!ctx.playerActive) { this.calmDown(); break; }
        this.lostSight = sees ? 0 : this.lostSight + dt;
        if (this.lostSight > A.loseSightTime || dist > A.giveUpDistance || zoneAt(P.x, P.z) !== 'village') {
          ctx.onShout(this, 'Where did it go?');
          this.calmDown(); break;
        }
        speed = this.moveToward(P.x, P.z, A.chaseSpeed * this.speedMult, dt, ctx);
        if (dist < A.catchRange) { this.state = 'windup'; this.timer = A.windupTime; }
        break;
      }
      case 'windup':
        this.timer -= dt;
        this.turnTo(Math.atan2(P.x - this.pos.x, P.z - this.pos.z), dt, 4);
        if (this.timer <= 0) {
          const airborne = P.y - ctx.playerGroundY > 0.6;
          if (ctx.playerActive && dist < A.catchRange + 0.5 && !airborne) ctx.onCatch(this);
          this.state = 'recover'; this.timer = A.recoverTime;
        }
        break;
      case 'recover':
        this.timer -= dt;
        if (this.timer <= 0) this.state = ctx.playerActive ? 'chase' : 'return';
        break;
      case 'return': {
        const [tx, tz] = this.spawn.route[this.wp];
        speed = this.moveToward(tx, tz, A.walkSpeed * 1.5, dt, ctx);
        if (Math.hypot(tx - this.pos.x, tz - this.pos.z) < 0.5 || speed === 0) this.state = 'patrol';
        if (sees && dist < A.sightRange * 0.6) { this.state = 'notice'; this.timer = A.noticeTime; }
        break;
      }
    }
    this.pos.y = ctx.collision.groundAt(this.pos.x, this.pos.z, this.pos.y + 0.3, 0.4);

    // animate
    this.speedNow = THREE.MathUtils.lerp(this.speedNow, speed, Math.min(1, dt * 8));
    this.phase += dt * (3 + this.speedNow * 2.2);
    const swing = Math.min(1, this.speedNow / 2) * 0.7;
    this.legs[0].rotation.x = Math.sin(this.phase) * swing;
    this.legs[1].rotation.x = -Math.sin(this.phase) * swing;
    this.arms[0].rotation.x = -Math.sin(this.phase) * swing * 0.8;
    const w = this.state === 'windup' ? 1 - this.timer / A.windupTime : 0;
    // tool arm: held forward, raised high during the wind-up, swung down after
    this.toolArm.rotation.x = this.state === 'windup' ? -0.6 - 2.0 * w : this.state === 'recover' ? -0.2 : -0.6 + Math.sin(this.phase) * swing * 0.3;
    this.body.position.y = Math.abs(Math.sin(this.phase)) * 0.04 * Math.min(1, this.speedNow / 2);
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.yaw;
    this.mark.position.set(this.pos.x, this.pos.y + 2.45 + Math.sin(ctx.now * 10) * 0.05, this.pos.z);
    this.setMark(this.state === 'notice' ? '?' : this.state === 'chase' || this.state === 'windup' ? '!' : '');
    if (ctx.cameraPos && this.mark.position.distanceTo(ctx.cameraPos) < 4) this.mark.visible = false;
    this.alertRing.visible = this.state === 'windup';
    if (this.alertRing.visible) {
      const s = (A.catchRange + 0.6) * 2 * (0.6 + 0.4 * w);
      this.alertRing.position.set(this.pos.x, this.pos.y + 0.08, this.pos.z);
      this.alertRing.scale.set(s, s, 1);
    }
  }

  updateLabel(camera: THREE.Camera, w: number, h: number, playerPos: THREE.Vector3) {
    const d = this.pos.distanceTo(playerPos);
    const p = new THREE.Vector3(this.pos.x, this.pos.y + 2.25, this.pos.z).project(camera);
    if (p.z > 1 || d > 28 || Math.abs(p.x) > 1.1 || Math.abs(p.y) > 1.1) { this.label.style.display = 'none'; return; }
    this.label.style.display = 'block';
    const x = (p.x * 0.5 + 0.5) * w, y = (-p.y * 0.5 + 0.5) * h;
    const sc = THREE.MathUtils.clamp(1.25 - d / 30, 0.65, 1.1);
    this.label.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%) scale(${sc})`;
    const st = this.label.querySelector('.np-strength') as HTMLElement;
    const [txt, cls] = this.labelOverride ? [this.labelOverride, 'similar'] : this.state === 'chase' || this.state === 'windup' ? ['😠 Chasing you! Run!', 'stronger']
      : this.state === 'notice' ? ['❓ Spotted you…', 'similar'] : ['👀 Watching for animals', 'weaker'];
    if (st.textContent !== txt) { st.textContent = txt; st.className = 'np-strength ' + cls; }
  }
}
