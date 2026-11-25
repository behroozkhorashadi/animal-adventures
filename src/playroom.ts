import * as THREE from 'three';
import { CollisionWorld } from './terrain';
import { AnimalRig, animateRig, disposeRig } from './animals';

/** The giant Play Room: a huge colourful room where ALL your pets play together with you. */
export const PLAYROOM = { x: 0, z: -1600, halfW: 30, halfD: 30 };

interface PlayPet { rig: AnimalRig; idx: number; x: number; z: number; tx: number; tz: number; wait: number; hop: number; carrying: boolean; tagged?: boolean; hidden?: boolean; y?: number; run?: number }
export interface Hold { mesh: THREE.Mesh; x: number; y: number; z: number }
/** Where the toys are. */
export const TOYS = {
  slide: { x: PLAYROOM.x + 16, z: PLAYROOM.z - 14 },
  pit: { x: PLAYROOM.x - 16, z: PLAYROOM.z - 14, r: 4.7 },
  tramp: { x: PLAYROOM.x + 16, z: PLAYROOM.z + 12, r: 2.9, top: 0.45 },
  wall: { x: PLAYROOM.x - PLAYROOM.halfW + 0.55, z: PLAYROOM.z, top: 7.3 },
};
export type PlayGame = { kind: 'tag' | 'hide' | 'dance'; until: number } | null;

export class PlayRoom {
  group = new THREE.Group();
  pets: PlayPet[] = [];
  ball: THREE.Mesh;
  ballVel = new THREE.Vector3();
  ballState: 'none' | 'flying' | 'ground' | 'carried' = 'none';
  carrier: PlayPet | null = null;
  /** Called when a pet brings the ball back to you. */
  onFetch?: (idx: number) => void;
  /** Group games with everyone. */
  game: PlayGame = null;
  onGame?: (ev: 'tagged' | 'found' | 'win' | 'timeout' | 'itPet' | 'itYou' | 'tagEnd', idx: number) => void;
  /** In tag: who's IT (null = you are!). Everyone runs away from whoever is IT. */
  itPet: PlayPet | null = null;
  private noTagBack: { who: PlayPet | 'player' | null; until: number } = { who: null, until: 0 };
  private itSign: THREE.Sprite | null = null;
  pitBalls: { m: THREE.Mesh; hx: number; hy: number; hz: number }[] = [];
  holds: Hold[] = [];
  bell!: THREE.Group;
  bellSwing = 0;
  /** While you climb, your first two pets climb beside you up to this height. */
  climbY: number | null = null;

  constructor(private scene: THREE.Scene, collision: CollisionWorld) {
    const P = PLAYROOM, g = this.group;
    g.visible = false; scene.add(g);
    // a squishy rainbow floor
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const x = c.getContext('2d')!;
    const cols = ['#ff8a9a', '#ffc86a', '#fff08a', '#9ae88a', '#8ad0ff', '#c8a0ff'];
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { x.fillStyle = cols[(i + j * 2) % cols.length]; x.fillRect(i * 64, j * 64, 64, 64); }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(4, 4);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(P.halfW * 2, P.halfD * 2), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(P.x, 0.01, P.z); floor.receiveShadow = true; g.add(floor);
    // walls with big painted stripes
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xfff4e0, roughness: 0.9 });
    const H = 8;
    const wall = (w: number, d: number, px: number, pz: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, H, d), wallMat); m.position.set(px, H / 2, pz); g.add(m);
      collision.add({ kind: 'box', minX: px - w / 2, maxX: px + w / 2, minZ: pz - d / 2, maxZ: pz + d / 2, top: 100, tall: true });
    };
    wall(P.halfW * 2 + 1, 0.5, P.x, P.z - P.halfD); wall(P.halfW * 2 + 1, 0.5, P.x, P.z + P.halfD);
    wall(0.5, P.halfD * 2, P.x - P.halfW, P.z); wall(0.5, P.halfD * 2, P.x + P.halfW, P.z);
    for (let k = 0; k < 6; k++) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(P.halfW * 2 - 1, 0.5, 0.1), new THREE.MeshStandardMaterial({ color: new THREE.Color(cols[k]) }));
      s.position.set(P.x, 1.5 + k * 0.6, P.z - P.halfD + 0.3); g.add(s);
    }
    // lights
    const sun = new THREE.PointLight(0xfff4e0, 9, 140, 1.0); sun.position.set(P.x, 16, P.z); g.add(sun);
    g.add(new THREE.HemisphereLight(0xffffff, 0xffe0c0, 0.8));
    // the way out
    const door = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.4), new THREE.MeshStandardMaterial({ color: 0xffe9ff, emissive: 0xd08aff, emissiveIntensity: 1.2, side: THREE.DoubleSide }));
    door.position.set(P.x, 1.7, P.z + P.halfD - 0.3); door.rotation.y = Math.PI; g.add(door);
    const lbl = (text: string, w: number, color: string) => {
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128;
      const gx = cv.getContext('2d')!; gx.fillStyle = '#fffaf0'; gx.beginPath(); gx.roundRect(4, 4, 504, 120, 26); gx.fill();
      gx.fillStyle = color; gx.font = 'bold 50px Nunito, sans-serif'; gx.textAlign = 'center'; gx.textBaseline = 'middle'; gx.fillText(text, 256, 66, 490);
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
      return new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide }));
    };
    const out = lbl('🚪 Way out', 2.6, '#6a3ab8'); out.position.set(P.x, 3.8, P.z + P.halfD - 0.35); out.rotation.y = Math.PI; g.add(out);
    const title = lbl('🎉 The Big Play Room 🎉', 12, '#d0306a'); title.position.set(P.x, 6, P.z - P.halfD + 0.4); g.add(title);
    // toys!
    const mat = (c2: number) => new THREE.MeshStandardMaterial({ color: c2, roughness: 0.5 });
    // ball pit
    const pit = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 0.9, 32, 1, true), mat(0x4a8aff)); (pit.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    pit.position.set(P.x - 16, 0.45, P.z - 14); g.add(pit);
    const bc = [0xff4a5a, 0xffd23a, 0x4ad86a, 0x4aa8ff, 0xff8ad8];
    const bgeo = new THREE.SphereGeometry(0.28, 10, 8);
    const bmats = bc.map((c2) => mat(c2));
    for (let i = 0; i < 260; i++) { const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * 4.7; const b = new THREE.Mesh(bgeo, bmats[i % 5]); b.position.set(P.x - 16 + Math.cos(a) * r, 0.2 + Math.random() * 0.6, P.z - 14 + Math.sin(a) * r); g.add(b); this.pitBalls.push({ m: b, hx: b.position.x, hy: b.position.y, hz: b.position.z }); }
    // slide
    const slideX = P.x + 16, slideZ = P.z - 14;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 3.5, 8), mat(0xffd23a)); leg.position.set(slideX + sx * 1.2, 1.75, slideZ - 3 + sz * 1.2); g.add(leg); }
    const deck = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.3, 2.6), mat(0xff4a5a)); deck.position.set(slideX, 3.5, slideZ - 3); g.add(deck);
    const chute = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.2, 7), mat(0x4aa8ff)); chute.position.set(slideX, 1.8, slideZ + 1.5); chute.rotation.x = 0.5; g.add(chute);
    collision.add({ kind: 'box', minX: slideX - 1.4, maxX: slideX + 1.4, minZ: slideZ - 4.4, maxZ: slideZ - 1.6, top: 100, tall: true });
    // trampoline
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 0.12, 28), mat(0x2a2a3a)); tr.position.set(P.x + 16, 0.39, P.z + 12); tr.name = 'trampMat'; g.add(tr); this.trampMat = tr;
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.45, 6), mat(0x888899)); leg.position.set(P.x + 16 + Math.cos(a) * 2.9, 0.22, P.z + 12 + Math.sin(a) * 2.9); g.add(leg); }
    collision.add({ kind: 'cyl', x: P.x + 16, z: P.z + 12, r: 3, top: 0.45 });
    const rim = new THREE.Mesh(new THREE.TorusGeometry(3, 0.18, 8, 28), mat(0x4ad86a)); rim.rotation.x = Math.PI / 2; rim.position.set(P.x + 16, 0.45, P.z + 12); g.add(rim);
    const ladder = (lx: number, lz: number) => { for (const sx of [-0.45, 0.45]) { const r2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 3.6, 0.1), mat(0xffffff)); r2.position.set(lx + sx, 1.8, lz); g.add(r2); } for (let k = 0; k < 7; k++) { const rung = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.08), mat(0xffffff)); rung.position.set(lx, 0.4 + k * 0.5, lz); g.add(rung); } };
    ladder(P.x + 16, P.z - 14 - 4.45);
    // tunnel
    const tun = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 7, 20, 1, true), mat(0xff8ad8)); (tun.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    tun.rotation.z = Math.PI / 2; tun.position.set(P.x - 16, 1.3, P.z + 12); g.add(tun);
    // giant toy blocks and a rainbow
    for (let i = 0; i < 9; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), mat(bc[i % 5])); b.position.set(P.x - 4 + (i % 3) * 1.5, 0.7 + Math.floor(i / 3) * 1.4, P.z - 24); b.rotation.y = (i % 2) * 0.3; g.add(b); }
    collision.add({ kind: 'box', minX: P.x - 5, maxX: P.x + 0.2, minZ: P.z - 25, maxZ: P.z - 23, top: 100, tall: true });
    for (let k = 0; k < 6; k++) { const arc = new THREE.Mesh(new THREE.TorusGeometry(9 - k * 0.5, 0.25, 8, 40, Math.PI), mat(new THREE.Color(cols[k]).getHex())); arc.position.set(P.x + 10, 0, P.z - P.halfD + 1); g.add(arc); }
    // the rock climbing wall (with a bell at the very top!)
    {
      const W = TOYS.wall, wx = P.x - P.halfW + 0.25;
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.3, 7.9, 13), mat(0x8a7a6a)); panel.position.set(wx + 0.15, 3.95, W.z); g.add(panel);
      const hc = [0xff4a5a, 0xffd23a, 0x4ad86a, 0x4aa8ff, 0xff8ad8, 0xff9a3a];
      const hgeo = new THREE.DodecahedronGeometry(0.2, 0);
      let n = 0;
      for (let row = 0; row < 10; row++) {
        const y = 0.45 + row * 0.76;
        for (const zz of [-2.1, -0.7, 0.7, 2.1]) {
          const z = W.z + zz + (((row * 7 + n * 3) % 5) - 2) * 0.18;
          const m = new THREE.Mesh(hgeo, mat(hc[n % hc.length])); m.scale.set(0.7, 1, 1.2); m.position.set(wx + 0.35, y, z); g.add(m);
          this.holds.push({ mesh: m, x: wx + 0.35, y, z }); n++;
        }
        // decorative holds for your pets' lanes
        for (const zz of [-4.6, 4.6]) { const m = new THREE.Mesh(hgeo, mat(hc[(n + row) % hc.length])); m.scale.set(0.7, 1, 1.2); m.position.set(wx + 0.35, y + 0.3, W.z + zz); g.add(m); }
      }
      // the bell
      const bell = new THREE.Group(); bell.position.set(wx + 0.6, 7.75, W.z);
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.4, 0.55, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0xffc83a, metalness: 0.7, roughness: 0.25, emissive: 0x553300, side: THREE.DoubleSide })); cup.position.y = -0.3; bell.add(cup);
      const clap = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), mat(0x996600)); clap.position.y = -0.55; bell.add(clap);
      g.add(bell); this.bell = bell;
      const sign = lbl('🧗 Climb to the top and ring the bell! 🔔', 6, '#6a3a10'); sign.position.set(wx + 0.5, 8.6 > 8 ? 7.4 : 8.6, W.z + 4.2); sign.rotation.y = Math.PI / 2; sign.scale.setScalar(0.6); g.add(sign);
    }
    // the ball
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), new THREE.MeshStandardMaterial({ color: 0xd8f040, roughness: 0.6 }));
    this.ball.visible = false; this.ball.castShadow = true; g.add(this.ball);
  }

  trampMat!: THREE.Mesh;
  trampSquish = 0;
  /** Pets that climb, slide or hop along with you follow a little path. */
  private paths = new Map<PlayPet, { pts: THREE.Vector3[]; t: number; dur: number }>();
  /** A couple of pets follow you down the slide! */
  petsFollowPath(pts: THREE.Vector3[], dur: number, count = 2) {
    const free = this.pets.filter((p) => !this.paths.has(p)).slice(0, count);
    free.forEach((p, k) => this.paths.set(p, { pts, t: -1.2 * (k + 1), dur }));
  }
  /** Start a game with everyone. */
  startGame(kind: 'tag' | 'hide' | 'dance', now: number, player: THREE.Vector3) {
    const P = PLAYROOM, T = TOYS;
    this.endGame();
    this.ballState = 'none'; this.ball.visible = false; this.carrier = null;
    this.game = { kind, until: now + (kind === 'tag' ? 60 : kind === 'hide' ? 75 : 12) };
    this.itPet = null; this.noTagBack = { who: null, until: 0 };
    if (kind === 'hide') {
      const spots = [[T.slide.x + 2.6, T.slide.z - 3], [T.pit.x, T.pit.z], [T.tramp.x + 3.8, T.tramp.z], [P.x - 16, P.z + 12], [P.x - 2, P.z - 26.5], [P.x + 27, P.z + 27], [P.x - 27, P.z + 26], [P.x + 27, P.z - 27], [P.x - 26, P.z - 10], [P.x + 8, P.z - 27], [P.x + 27, P.z], [P.x - 8, P.z + 27]];
      const order = spots.map((sp) => ({ sp, d: Math.hypot(sp[0] - player.x, sp[1] - player.z) })).filter((o) => o.d > 6).map((o) => o.sp).sort(() => Math.random() - 0.5);
      this.pets.forEach((p, k) => { const sp = order[k % order.length]; p.x = p.tx = sp[0] + (Math.random() - 0.5) * 1.2; p.z = p.tz = sp[1] + (Math.random() - 0.5) * 1.2; p.hidden = true; p.rig.root.visible = false; });
    }
  }
  endGame() {
    this.game = null; this.itPet = null;
    for (const p of this.pets) { p.tagged = false; p.hidden = false; p.rig.root.visible = true; }
  }
  /** Bring in all your pets. */
  fill(rigs: { rig: AnimalRig; idx: number }[]) {
    this.clear();
    const P = PLAYROOM;
    rigs.forEach(({ rig, idx }, k) => {
      const a = (k / Math.max(1, rigs.length)) * Math.PI * 2, r = 5 + (k % 3) * 2;
      const x = P.x + Math.cos(a) * r, z = P.z + 8 + Math.sin(a) * r * 0.6;
      this.group.add(rig.root);
      this.pets.push({ rig, idx, x, z, tx: x, tz: z, wait: Math.random() * 2, hop: 0, carrying: false });
    });
  }
  clear() {
    this.endGame(); this.paths.clear(); this.climbY = null;
    for (const p of this.pets) { p.rig.root.removeFromParent(); disposeRig(p.rig); }
    this.pets = []; this.ballState = 'none'; this.ball.visible = false; this.carrier = null;
  }
  nearestPet(x: number, z: number, r = 2.4) {
    let best: PlayPet | null = null, bd = r;
    for (const p of this.pets) { const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = p; } }
    return best;
  }
  /** Throw the ball! Everyone races for it. */
  throwBall(from: THREE.Vector3, yaw: number) {
    if (this.ballState === 'flying' || this.ballState === 'carried') return false;
    this.ball.visible = true;
    this.ball.position.set(from.x + Math.sin(yaw) * 0.6, from.y + 1.2, from.z + Math.cos(yaw) * 0.6);
    this.ballVel.set(Math.sin(yaw) * 11, 6, Math.cos(yaw) * 11);
    this.ballState = 'flying'; this.carrier = null;
    for (const p of this.pets) p.wait = 0.2 + Math.random() * 0.4;
    return true;
  }
  update(dt: number, t: number, inside: boolean, player: THREE.Vector3) {
    this.group.visible = inside;
    if (!inside) return;
    const P = PLAYROOM, lim = (v: number, c: number, h: number) => Math.max(c - h + 1.2, Math.min(c + h - 1.2, v));
    // the big red IT! sign
    if (!this.itSign) {
      const c = document.createElement('canvas'); c.width = 128; c.height = 64; const x = c.getContext('2d')!;
      x.fillStyle = '#e8303a'; x.beginPath(); x.roundRect(4, 4, 120, 56, 18); x.fill(); x.fillStyle = '#fff'; x.font = 'bold 40px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('IT!', 64, 34);
      const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
      this.itSign = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true, depthTest: false })); this.itSign.scale.set(1.2, 0.6, 1); this.itSign.renderOrder = 6; this.group.add(this.itSign);
    }
    const itP = this.game?.kind === 'tag' ? this.itPet : null;
    this.itSign.visible = !!itP;
    if (itP) this.itSign.position.set(itP.x, (itP.y ?? 0) + itP.rig.height + 0.8 + Math.sin(t * 6) * 0.1, itP.z);
    // ball pit: balls get pushed around when someone wades through
    const T = TOYS, inPit = Math.hypot(player.x - T.pit.x, player.z - T.pit.z) < T.pit.r + 0.6;
    for (const pb of this.pitBalls) {
      const b2 = pb.m.position;
      let tx = pb.hx, ty = pb.hy, tz = pb.hz;
      if (inPit) { const dx = pb.hx - player.x, dz = pb.hz - player.z, d = Math.hypot(dx, dz); if (d < 1.3) { const k = (1.3 - d) / 1.3; tx += (dx / (d || 1)) * k * 0.9; tz += (dz / (d || 1)) * k * 0.9; ty += k * 0.5; } }
      b2.x += (tx - b2.x) * Math.min(1, dt * 6); b2.y += (ty - b2.y) * Math.min(1, dt * 6); b2.z += (tz - b2.z) * Math.min(1, dt * 6);
    }
    // trampoline wobble, bell swing
    this.trampSquish = Math.max(0, this.trampSquish - dt * 3);
    this.trampMat.position.y = 0.39 - Math.sin(this.trampSquish * Math.PI) * 0.2;
    this.bellSwing = Math.max(0, this.bellSwing - dt * 0.6);
    this.bell.rotation.x = Math.sin(t * 14) * 0.5 * this.bellSwing;
    // group games
    const G = this.game;
    if (G) {
      if (t > G.until && G.kind === 'tag') {
        const it = this.itPet; this.endGame(); this.onGame?.('tagEnd', it ? it.idx : -1);
      } else if (t > G.until) {
        const left = this.pets.filter((p) => (G.kind === 'tag' ? !p.tagged : G.kind === 'hide' ? p.hidden : false)).length;
        this.endGame(); this.onGame?.(G.kind === 'dance' || !left ? 'win' : 'timeout', left); 
      } else if (G.kind === 'tag' || G.kind === 'hide') {
        for (const p of this.pets) {
          const d = Math.hypot(player.x - p.x, player.z - p.z);
          if (G.kind === 'tag') {
            const it = this.itPet;
            const ix = it ? it.x : player.x, iz = it ? it.z : player.z;
            if (p === it) {
              // IT chases whoever is closest (but can't tag right back the one who just tagged it)
              let best: PlayPet | 'player' = 'player', bd = Math.hypot(player.x - p.x, player.z - p.z);
              if (this.noTagBack.who === 'player' && t < this.noTagBack.until) bd = 1e9;
              for (const q of this.pets) { if (q === p || (this.noTagBack.who === q && t < this.noTagBack.until)) continue; const dq = Math.hypot(q.x - p.x, q.z - p.z); if (dq < bd) { bd = dq; best = q; } }
              const bx = best === 'player' ? player.x : best.x, bz = best === 'player' ? player.z : best.z;
              p.tx = bx; p.tz = bz; p.wait = 0; p.run = 5.4;
              if (bd < 1.15) {
                this.noTagBack = { who: p, until: t + 2.5 };
                if (best === 'player') { this.itPet = null; this.onGame?.('itYou', p.idx); }
                else { this.itPet = best; best.hop = 1.2; this.onGame?.('itPet', best.idx); }
                p.hop = 1;
              }
            } else {
              const di = Math.hypot(ix - p.x, iz - p.z);
              p.run = 4.3;
              if (!it && d < 1.3 && !(this.noTagBack.who === p && t < this.noTagBack.until)) {
                // you tagged it: now IT is IT! Everybody run!
                this.itPet = p; p.hop = 1.2; this.noTagBack = { who: 'player', until: t + 2.5 };
                this.onGame?.('itPet', p.idx);
              } else if (di < 7) {
                let ax = p.x - ix, az = p.z - iz; const n = Math.hypot(ax, az) || 1;
                p.tx = p.x + (ax / n) * 4; p.tz = p.z + (az / n) * 4;
                if (Math.abs(p.tx - P.x) > P.halfW - 2) p.tz += (p.z > iz ? 4 : -4);
                if (Math.abs(p.tz - P.z) > P.halfD - 2) p.tx += (p.x > ix ? 4 : -4);
                p.wait = 0;
              } else if (Math.hypot(p.tx - p.x, p.tz - p.z) < 0.3) { p.tx = p.x + (Math.random() - 0.5) * 6; p.tz = p.z + (Math.random() - 0.5) * 6; }
            }
          }
          if (G.kind === 'hide' && p.hidden && d < 2.2) { p.hidden = false; p.rig.root.visible = true; p.hop = 1.4; this.onGame?.('found', p.idx); }
        }
        if (G.kind === 'hide' && this.pets.every((p) => !p.hidden)) { this.endGame(); this.onGame?.('win', 0); }
      }
    }
    // the ball
    const b = this.ball;
    if (this.ballState === 'flying') {
      this.ballVel.y -= 18 * dt;
      b.position.addScaledVector(this.ballVel, dt);
      if (Math.abs(b.position.x - P.x) > P.halfW - 1) { this.ballVel.x *= -0.6; b.position.x = lim(b.position.x, P.x, P.halfW); }
      if (Math.abs(b.position.z - P.z) > P.halfD - 1) { this.ballVel.z *= -0.6; b.position.z = lim(b.position.z, P.z, P.halfD); }
      if (b.position.y < 0.22) { b.position.y = 0.22; this.ballVel.y *= -0.45; this.ballVel.x *= 0.7; this.ballVel.z *= 0.7; if (Math.abs(this.ballVel.y) < 1) this.ballState = 'ground'; }
    }
    let climber = 0;
    for (const p of this.pets) {
      p.wait -= dt;
      let speed = 0;
      // following a path (down the slide!)
      const path = this.paths.get(p);
      if (path) {
        path.t += dt;
        if (path.t >= 0) {
          const f = Math.min(1, path.t / path.dur), seg = f * (path.pts.length - 1), i0 = Math.min(path.pts.length - 2, Math.floor(seg)), k = seg - i0;
          const a = path.pts[i0], b2 = path.pts[i0 + 1];
          p.x = a.x + (b2.x - a.x) * k; p.z = a.z + (b2.z - a.z) * k; const y = a.y + (b2.y - a.y) * k;
          p.rig.root.position.set(p.x, y, p.z); p.rig.root.rotation.y = Math.atan2(b2.x - a.x, b2.z - a.z);
          animateRig(p.rig, dt, { speed: 2, airborne: false, attack: null, attackT: 0, windup: 0 });
          if (f >= 1) { this.paths.delete(p); p.tx = p.x; p.tz = p.z; p.hop = 1; }
          continue;
        }
      }
      // climbing the wall beside you
      if (this.climbY !== null && climber < 2 && !this.game) {
        const zz = TOYS.wall.z + (climber === 0 ? -4.6 : 4.6); climber++;
        const wx = TOYS.wall.x + 0.45;
        if (Math.hypot(p.x - wx, p.z - zz) > 0.3 && (p.y ?? 0) < 0.05) { const dx = wx - p.x, dz = zz - p.z, d = Math.hypot(dx, dz), st = Math.min(d, 4 * dt); p.x += dx / d * st; p.z += dz / d * st; p.rig.root.rotation.y = Math.atan2(dx, dz); speed = 4; p.y = 0; }
        else { p.x = wx; p.z = zz; const ty = Math.max(0, this.climbY - 0.2); const dy = ty - (p.y ?? 0); p.y = (p.y ?? 0) + Math.sign(dy) * Math.min(Math.abs(dy), 1.2 * dt); speed = Math.abs(dy) > 0.05 ? 2 : 0; p.rig.root.rotation.y = -Math.PI / 2; }
        p.rig.root.position.set(p.x, p.y ?? 0, p.z);
        p.rig.root.rotation.x = (p.y ?? 0) > 0.2 ? -0.9 : 0;
        animateRig(p.rig, dt, { speed, airborne: false, attack: null, attackT: 0, windup: 0 });
        continue;
      }
      if ((p.y ?? 0) > 0) { p.y = Math.max(0, (p.y ?? 0) - 3 * dt); p.rig.root.rotation.x = 0; }
      if (this.game?.kind === 'hide' && p.hidden) continue;
      if (this.game?.kind === 'dance') {
        const k = this.pets.indexOf(p), a = (k / this.pets.length) * Math.PI * 2 + t * 0.6, r = 3 + (k % 2) * 1.2;
        p.tx = player.x + Math.cos(a) * r; p.tz = player.z + Math.sin(a) * r; p.wait = 0;
        if (Math.random() < dt * 0.8) p.hop = 0.8;
      }
      if (this.ballState === 'flying' || this.ballState === 'ground') { p.tx = b.position.x; p.tz = b.position.z; }
      else if (this.ballState === 'carried' && this.carrier === p) { p.tx = player.x; p.tz = player.z; }
      else if (this.ballState === 'carried') { p.tx = this.carrier!.x + Math.sin(t + p.idx) * 1.5; p.tz = this.carrier!.z + Math.cos(t + p.idx) * 1.5; }
      else if (!this.game && p.wait <= 0 && Math.hypot(p.tx - p.x, p.tz - p.z) < 0.3) {
        // play time: zoom around, or run over to you for a cuddle
        if (Math.random() < 0.35) { p.tx = player.x + (Math.random() - 0.5) * 4; p.tz = player.z + (Math.random() - 0.5) * 4; }
        else { p.tx = P.x + (Math.random() - 0.5) * (P.halfW * 2 - 6); p.tz = P.z + (Math.random() - 0.5) * (P.halfD * 2 - 6); }
        p.wait = 0.5 + Math.random() * 2.5;
        if (Math.random() < 0.3) p.hop = 1;
      }
      p.tx = lim(p.tx, P.x, P.halfW); p.tz = lim(p.tz, P.z, P.halfD);
      const dx = p.tx - p.x, dz = p.tz - p.z, d = Math.hypot(dx, dz);
      const chasing = this.ballState !== 'none' || this.game?.kind === 'tag' || this.game?.kind === 'dance';
      if (d > 0.25 && (p.wait <= 0 || chasing)) {
        const v = this.game?.kind === 'tag' ? (p.run ?? 4.4) : chasing ? 5.5 : 2.6, st = Math.min(d, v * dt);
        p.x += (dx / d) * st; p.z += (dz / d) * st; speed = v; p.rig.root.rotation.y = Math.atan2(dx, dz);
      }
      // grab the ball!
      if (this.ballState === 'ground' && Math.hypot(b.position.x - p.x, b.position.z - p.z) < 0.9) { this.ballState = 'carried'; this.carrier = p; }
      if (this.ballState === 'carried' && this.carrier === p) {
        b.position.set(p.x + Math.sin(p.rig.root.rotation.y) * 0.5, p.rig.height * 0.55, p.z + Math.cos(p.rig.root.rotation.y) * 0.5);
        if (Math.hypot(player.x - p.x, player.z - p.z) < 1.8) { this.ballState = 'none'; b.position.set(player.x, 0.22, player.z); b.visible = false; this.carrier = null; p.hop = 1; this.onFetch?.(p.idx); }
      }
      if (p.hop > 0) p.hop -= dt;
      p.rig.root.position.set(p.x, (p.y ?? 0) + (p.hop > 0 ? Math.abs(Math.sin(p.hop * 9)) * 0.35 : 0), p.z);
      animateRig(p.rig, dt, { speed: Math.min(speed, 4.5), airborne: p.hop > 0, attack: null, attackT: 0, windup: 0 });
      if (this.game?.kind === 'dance') { p.rig.body.rotation.z = Math.sin(t * 9 + p.idx) * 0.35; p.rig.root.rotation.y += Math.sin(t * 3 + p.idx) * 0.8; }
    }
  }
}
