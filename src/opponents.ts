// Computer-controlled animals: wander peacefully, retaliate when attacked,
// telegraph every strike, and retreat gently when defeated.
import * as THREE from 'three';
import { OPPONENT_AI, TIERS, OPP_OVERRIDES, TierDef, WORLD, regionBounds, GAME_MODE, MODE2 } from './config';
const m2 = () => GAME_MODE.level === 2;
import { OppSpawn } from './layout';
import { AnimalRig, buildOpponent, animateRig, setRigGlow } from './animals';
import { CollisionWorld, terrainHeight, inPit, zoneAt } from './terrain';
import { softDotTexture, ringTexture } from './textures';

export type OppState = 'wander' | 'idle' | 'warn' | 'chase' | 'windup' | 'recover' | 'return' | 'defeated' | 'gone';

export interface OppContext {
  playerPos: THREE.Vector3;
  playerGroundY: number;
  playerAlive: boolean;
  playerSafe?: boolean; // inside the house / home clearing: hunters leave you alone
  collision: CollisionWorld;
  now: number;
  camera: THREE.Camera;
  onStrike: (o: Opponent) => void;
  onWarn: (o: Opponent) => void;
  onTelegraph: (o: Opponent) => void;
  onBrawlHit?: (a: Opponent, b: Opponent) => void;
}

const frustum = new THREE.Frustum();
const projM = new THREE.Matrix4();

export class Opponent {
  spawn: OppSpawn;
  stats: TierDef;
  rig: AnimalRig;
  pos = new THREE.Vector3();
  yaw = Math.random() * Math.PI * 2;
  hp: number;
  state: OppState = 'idle';
  aggro = false;
  timer = 0;
  target = new THREE.Vector3();
  attackAnim = 0;
  flash = 0;
  respawnAt = 0;
  /** When you last hit it (a dinosaur you're fighting doesn't give up). */
  hitAt = -99;
  private clock = 0;
  fade = 0;
  knock = new THREE.Vector3();
  warnCooldown = 0;
  warnSprite: THREE.Sprite;
  warnRing: THREE.Mesh;
  label: HTMLDivElement;
  private hpFill: HTMLDivElement;
  private lastSpeed = 0;
  baseScale = 1;

  constructor(spawn: OppSpawn, scene: THREE.Scene, labelLayer: HTMLElement) {
    this.spawn = spawn;
    this.stats = { ...TIERS[spawn.tier], ...(OPP_OVERRIDES[spawn.species] ?? {}) };
    if (spawn.training) this.stats = { ...this.stats, health: 45, damage: 4, speed: 3.4 };
    this.hp = this.maxHp;
    this.rig = buildOpponent(spawn.species, spawn.scale ?? 1, /lioness/i.test(spawn.name));
    this.baseScale = this.rig.root.scale.x;
    scene.add(this.rig.root);
    this.pos.set(spawn.x, terrainHeight(spawn.x, spawn.z), spawn.z);
    this.target.copy(this.pos);

    // "!" telegraph marker
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d')!;
    g.fillStyle = '#ffcf33'; g.beginPath(); g.arc(32, 32, 28, 0, 7); g.fill();
    g.lineWidth = 5; g.strokeStyle = '#5a3000'; g.stroke();
    g.fillStyle = '#5a3000'; g.font = 'bold 44px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('!', 32, 35);
    const tex = new THREE.CanvasTexture(c);
    this.warnSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    this.warnSprite.scale.setScalar(0.7);
    this.warnSprite.renderOrder = 6;
    this.warnSprite.visible = false;
    scene.add(this.warnSprite);
    // ground ring showing the strike area during wind-up
    this.warnRing = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: ringTexture(), color: 0xff7a3d, transparent: true, depthWrite: false, opacity: 0.8 }));
    this.warnRing.rotation.x = -Math.PI / 2;
    this.warnRing.visible = false;
    scene.add(this.warnRing);

    // DOM nameplate
    this.label = document.createElement('div');
    this.label.className = 'nameplate';
    this.label.style.display = 'none';
    this.label.innerHTML = `<div class="np-name"></div><div class="np-bar"><div class="np-fill"></div></div><div class="np-strength"></div>`;
    (this.label.querySelector('.np-name') as HTMLElement).textContent = spawn.name + (spawn.training ? ' (practice)' : '');
    this.hpFill = this.label.querySelector('.np-fill') as HTMLDivElement;
    labelLayer.appendChild(this.label);
    this.pickWander();
  }

  get radius() { return this.rig.radius; }
  get alive() { return this.state !== 'defeated' && this.state !== 'gone'; }
  /** This animal decides to start a fight with you! */
  pickFight() { if (!this.alive || this.spawn.hunter || this.aggro) return; this.brawl = null; this.aggro = true; this.state = 'chase'; }
  /** Full health (more in Mode 2). */
  get maxHp() { return Math.round(this.stats.health * (m2() ? MODE2.oppHealth : 1)); }
  /** A fight with another animal (just for show: you can watch!). */
  brawl: { foe: Opponent; t: number; hit: number; winner: boolean } | null = null;
  get engaged() { return this.aggro && this.alive; }

  private pickWander() {
    const r = (this.spawn.wander ?? OPPONENT_AI.wanderRadius);
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2, d = Math.random() * r;
      const x = this.spawn.x + Math.cos(a) * d, z = this.spawn.z + Math.sin(a) * d;
      if (!inPit(x, z, 3)) { this.target.set(x, 0, z); break; }
    }
    this.state = 'wander';
  }

  /** Called when the player lands a hit. Returns true if this defeated it. */
  takeHit(dmg: number, from: THREE.Vector3): boolean {
    if (!this.alive) return false;
    this.hp = Math.max(0, this.hp - dmg);
    this.flash = 0.18;
    this.hitAt = this.clock;
    const away = this.pos.clone().sub(from).setY(0);
    if (away.lengthSq() > 0.0001) this.knock.copy(away.normalize().multiplyScalar(3.5));
    this.aggro = true;
    if (this.hp <= 0) {
      this.state = 'defeated';
      this.fade = 0;
      this.warnSprite.visible = false;
      this.warnRing.visible = false;
      return true;
    }
    if (this.state === 'wander' || this.state === 'idle' || this.state === 'warn' || this.state === 'return') {
      this.state = 'chase';
    }
    return false;
  }

  /** Stop fighting and go home at full health (player defeat, leash). */
  calmDown() {
    if (!this.alive) return;
    this.aggro = false;
    if (!this.spawn.hunter) this.hp = this.maxHp;   // dinosaurs keep their bruises: hit them again later!
    this.state = 'return';
    this.target.set(this.spawn.x, 0, this.spawn.z);
    this.warnSprite.visible = false;
    this.warnRing.visible = false;
    this.warnCooldown = 6;
  }

  private moveToward(tx: number, tz: number, speed: number, dt: number, ctx: OppContext): number {
    const dx = tx - this.pos.x, dz = tz - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.05) return 0;
    const step = Math.min(d, speed * dt);
    const nx = this.pos.x + (dx / d) * step, nz = this.pos.z + (dz / d) * step;
    // stay in own zone, out of pits and inside the world
    if (inPit(nx, nz, 2.5) || zoneAt(nx, nz) !== this.spawn.zone || (nz < 200 && Math.abs(Math.abs(nx) - WORLD.zoneEdge) < 2.5)) return 0;
    const p = { x: nx, z: nz };
    ctx.collision.resolve(p, this.pos.y, this.radius * 0.8, 0.4);
    const B = regionBounds(this.pos.x, this.pos.z);
    this.pos.x = THREE.MathUtils.clamp(p.x, B.minX + 4, B.maxX - 4);
    this.pos.z = THREE.MathUtils.clamp(p.z, B.minZ + 4, B.maxZ - 4);
    this.turnTo(Math.atan2(dx, dz), dt);
    return step / dt;
  }

  private turnTo(yaw: number, dt: number, rate = 6) {
    let d = yaw - this.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.yaw += d * Math.min(1, rate * dt);
  }

  private inView(ctx: OppContext) {
    projM.multiplyMatrices(ctx.camera.projectionMatrix, ctx.camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projM);
    const p = new THREE.Vector3(this.spawn.x, terrainHeight(this.spawn.x, this.spawn.z) + 0.5, this.spawn.z);
    return frustum.containsPoint(p) && p.distanceTo(ctx.playerPos) < 40;
  }

  respawn() {
    this.hp = this.maxHp;
    this.aggro = false;
    this.pos.set(this.spawn.x, terrainHeight(this.spawn.x, this.spawn.z), this.spawn.z);
    this.rig.root.visible = true;
    this.rig.root.scale.setScalar(this.baseScale);
    this.fade = 0;
    this.pickWander();
  }

  update(dt: number, ctx: OppContext) {
    this.clock = ctx.now;
    const AI = OPPONENT_AI;
    let speed = 0;
    this.warnCooldown = Math.max(0, this.warnCooldown - dt);
    const toPlayer = new THREE.Vector3(ctx.playerPos.x - this.pos.x, 0, ctx.playerPos.z - this.pos.z);
    const dist = toPlayer.length();
    const fromHome = Math.hypot(this.pos.x - this.spawn.x, this.pos.z - this.spawn.z);
    const reach = AI.attackRange + this.radius + 0.4;

    if (this.brawl && this.alive && (this.brawl.foe.alive && !this.aggro)) {
      const b = this.brawl, foe = b.foe;
      b.t -= dt;
      const dx = foe.pos.x - this.pos.x, dz = foe.pos.z - this.pos.z, d = Math.hypot(dx, dz);
      if (b.t <= 0) {
        this.brawl = null;
        if (b.winner) { this.state = 'idle'; this.timer = 2; } else { this.state = 'return'; }
      } else if (d > this.radius + foe.radius + 0.5) speed = this.moveToward(foe.pos.x, foe.pos.z, this.stats.speed * 0.8, dt, ctx);
      else {
        this.turnTo(Math.atan2(dx, dz), dt, 8);
        b.hit -= dt;
        if (b.hit <= 0) { b.hit = 0.55 + Math.random() * 0.5; this.attackAnim = 0.001; foe.flash = 0.15; ctx.onBrawlHit?.(this, foe); }
      }
    } else {
    if (this.brawl) this.brawl = null;
    switch (this.state) {
      case 'gone':
        if (this.spawn.hunter) { this.label.style.display = 'none'; return; } // the game brings dinosaurs back at night
        if (ctx.now >= this.respawnAt) {
          if (this.inView(ctx) && ctx.now < this.respawnAt + 20) this.respawnAt = ctx.now + 3; // wait until out of view
          else this.respawn();
        }
        this.label.style.display = 'none';
        return;
      case 'defeated': {
        this.fade += dt;
        const k = Math.max(0, 1 - this.fade / 1.2);
        this.rig.root.scale.setScalar(this.baseScale * (0.3 + 0.7 * k));
        this.pos.y += dt * 1.2;
        setRigGlow(this.rig, 0xffffff, (1 - k) * 0.8);
        if (this.fade > 1.2) {
          this.state = 'gone';
          this.rig.root.visible = false;
          this.respawnAt = ctx.now + (this.spawn.hunter ? 15 : 60);   // new dinosaurs come quickly: there are always lots of them!
          setRigGlow(this.rig, 0x000000, 0);
        }
        break;
      }
      case 'idle':
        this.timer -= dt;
        if (this.timer <= 0) this.pickWander();
        break;
      case 'wander':
        speed = this.moveToward(this.target.x, this.target.z, AI.wanderSpeed, dt, ctx);
        if (Math.hypot(this.target.x - this.pos.x, this.target.z - this.pos.z) < 0.3 || speed === 0) {
          this.state = 'idle'; this.timer = 1.5 + Math.random() * 3;
        }
        break;
      case 'return':
        speed = this.moveToward(this.spawn.x, this.spawn.z, this.stats.speed * 0.7, dt, ctx);
        if (fromHome < 1 || speed === 0) this.pickWander();
        break;
      case 'warn':
        this.timer -= dt;
        this.turnTo(Math.atan2(toPlayer.x, toPlayer.z), dt);
        if (dist > AI.territorialWarnRadius + 1.5 || !ctx.playerAlive) { this.state = 'idle'; this.timer = 1; this.warnCooldown = 3; }
        else if (this.timer <= 0) {
          if (dist < AI.territorialAttackRadius) { this.aggro = true; this.state = 'chase'; }
          else { this.state = 'idle'; this.timer = 1; this.warnCooldown = 4; }
        }
        break;
      case 'chase': {
        // a dinosaur you're fighting keeps fighting back (even near your home)
        const fighting = this.spawn.hunter && ctx.now - this.hitAt < 10;
        if (!ctx.playerAlive || (!fighting && (fromHome > (this.spawn.hunter ? 60 : AI.leashDistance) || (this.spawn.hunter && ctx.playerSafe)))) { this.calmDown(); break; }
        if (dist > reach - 0.3) speed = this.moveToward(ctx.playerPos.x, ctx.playerPos.z, this.stats.speed * (m2() ? MODE2.oppSpeed : 1), dt, ctx);
        else this.turnTo(Math.atan2(toPlayer.x, toPlayer.z), dt, 10);
        if (dist < reach) {
          this.state = 'windup'; this.timer = (this.stats.windup ?? AI.windupTime) * (m2() ? MODE2.windup : 1);
          ctx.onTelegraph(this);
        }
        break;
      }
      case 'windup':
        this.timer -= dt;
        this.turnTo(Math.atan2(toPlayer.x, toPlayer.z), dt, 4);
        if (this.timer <= 0) {
          this.attackAnim = 0.001;
          const airborne = ctx.playerPos.y - ctx.playerGroundY > AI.dodgeHeight;
          if (ctx.playerAlive && dist < reach + 0.5 && !airborne) ctx.onStrike(this);
          this.state = 'recover'; this.timer = AI.recoverTime;
        }
        break;
      case 'recover':
        this.timer -= dt;
        if (this.timer <= 0) this.state = this.aggro ? 'chase' : 'wander';
        break;
    }

    }
    // night hunters (dinosaurs) roar and come after you
    if (this.spawn.hunter && !this.aggro && (this.state === 'wander' || this.state === 'idle') && ctx.playerAlive && !ctx.playerSafe && dist < 18) {
      this.aggro = true; this.state = 'chase';
      ctx.onWarn(this);
    }
    // territorial warning (strong animals only; never a surprise attack)
    if (!this.spawn.hunter && !this.aggro && this.spawn.tier === 'strong' && (this.state === 'wander' || this.state === 'idle') && this.warnCooldown <= 0 && ctx.playerAlive && dist < AI.territorialWarnRadius) {
      this.state = 'warn'; this.timer = AI.territorialWarnTime;
      ctx.onWarn(this);
    }

    // knockback
    if (this.knock.lengthSq() > 0.01 && this.alive) {
      const p = { x: this.pos.x + this.knock.x * dt, z: this.pos.z + this.knock.z * dt };
      if (!inPit(p.x, p.z, 2.5) && zoneAt(p.x, p.z) === this.spawn.zone) {
        ctx.collision.resolve(p, this.pos.y, this.radius * 0.8, 0.4);
        this.pos.x = p.x; this.pos.z = p.z;
      }
      this.knock.multiplyScalar(Math.max(0, 1 - dt * 8));
    }
    if (this.state !== 'defeated') this.pos.y = ctx.collision.groundAt(this.pos.x, this.pos.z, this.pos.y + 0.5, 0.4) ;
    if (this.spawn.zone === 'swamp' && this.spawn.species === 'crocodile') this.pos.y = Math.max(this.pos.y, -0.12);

    // visuals (skip drawing animals far from the player)
    const farAway = dist > 85 && !this.aggro;
    this.rig.root.visible = !farAway && this.state !== 'gone';
    if (farAway) { this.warnSprite.visible = false; this.warnRing.visible = false; return; }
    this.lastSpeed = THREE.MathUtils.lerp(this.lastSpeed, speed, Math.min(1, dt * 8));
    if (this.attackAnim > 0) { this.attackAnim += dt / 0.35; if (this.attackAnim >= 1) this.attackAnim = 0; }
    this.rig.root.position.copy(this.pos);
    this.rig.root.rotation.y = this.yaw;
    animateRig(this.rig, dt, {
      speed: this.lastSpeed, airborne: false,
      attack: this.attackAnim > 0 ? 'bite' : null, attackT: this.attackAnim,
      windup: this.state === 'windup' ? 1 - this.timer / ((this.stats.windup ?? AI.windupTime) * (m2() ? MODE2.windup : 1)) : 0,
    });
    if (this.state !== 'defeated') {
      if (this.flash > 0) { this.flash -= dt; setRigGlow(this.rig, 0xffffff, Math.max(0, this.flash) * 3); }
      else if (this.state === 'windup') setRigGlow(this.rig, 0xff6a00, 0.25 + 0.2 * Math.sin(ctx.now * 30));
      else setRigGlow(this.rig, 0x000000, 0);
    }
    const showWarn = this.state === 'windup' || this.state === 'warn';
    this.warnSprite.visible = showWarn;
    this.warnSprite.position.set(this.pos.x, this.pos.y + this.rig.height + 0.9 + Math.sin(ctx.now * 10) * 0.05, this.pos.z);
    this.warnRing.visible = this.state === 'windup';
    if (this.warnRing.visible) {
      const f = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      const R = reach + 0.5;
      this.warnRing.position.set(this.pos.x + f.x * R * 0.55, this.pos.y + 0.08, this.pos.z + f.z * R * 0.55);
      const s = R * 1.2 * (0.6 + 0.4 * (1 - this.timer / (this.stats.windup ?? AI.windupTime)));
      this.warnRing.scale.set(s, s, 1);
    }
  }

  /** Update the DOM nameplate. strength: label text for the current player animal. */
  updateLabel(camera: THREE.Camera, w: number, h: number, strength: { text: string; icon: string; cls: string }, playerPos: THREE.Vector3) {
    if (!this.alive || this.state === 'defeated') { this.label.style.display = 'none'; return; }
    const d = this.pos.distanceTo(playerPos);
    const p = new THREE.Vector3(this.pos.x, this.pos.y + this.rig.height + 0.45, this.pos.z).project(camera);
    if (p.z > 1 || d > 28 || Math.abs(p.x) > 1.1 || Math.abs(p.y) > 1.1) { this.label.style.display = 'none'; return; }
    this.label.style.display = 'block';
    const x = (p.x * 0.5 + 0.5) * w, y = (-p.y * 0.5 + 0.5) * h;
    const sc = THREE.MathUtils.clamp(1.25 - d / 30, 0.65, 1.1);
    this.label.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%) scale(${sc})`;
    this.hpFill.style.width = `${(this.hp / this.stats.health) * 100}%`;
    const s = this.label.querySelector('.np-strength') as HTMLElement;
    const html = `<span class="icon">${strength.icon}</span> ${strength.text}`;
    if (s.innerHTML !== html) { s.innerHTML = html; s.className = 'np-strength ' + strength.cls; }
    this.label.classList.toggle('angry', this.aggro || this.state === 'warn');
  }

  dispose() { this.label.remove(); }
}

export function sparkleBurst(scene: THREE.Scene, pos: THREE.Vector3, color = 0xffe08a, n = 14) {
  const parts: { s: THREE.Sprite; v: THREE.Vector3; life: number }[] = [];
  const mat = new THREE.SpriteMaterial({ map: softDotTexture(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  for (let i = 0; i < n; i++) {
    const s = new THREE.Sprite(mat);
    s.position.copy(pos); s.scale.setScalar(0.35);
    scene.add(s);
    parts.push({ s, v: new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 4 + 1, (Math.random() - 0.5) * 4), life: 0.9 });
  }
  return (dt: number) => {
    let alive = false;
    for (const p of parts) {
      if (p.life <= 0) continue;
      p.life -= dt; p.v.y -= 6 * dt;
      p.s.position.addScaledVector(p.v, dt);
      p.s.scale.setScalar(0.35 * Math.max(0, p.life));
      if (p.life <= 0) p.s.removeFromParent(); else alive = true;
    }
    return alive;
  };
}
