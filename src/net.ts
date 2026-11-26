// 👥 Play together! Everyone who has the game open at the same time (on claude.ai, with the
// game shared with them) sees each other walking around as their animals, with name tags.
// To keep it kid-safe there is no free typing: only friendly emotes from a fixed list.
import * as THREE from 'three';
import { AnimalRig, buildPlayerAnimal, animateRig, disposeRig } from './animals';
import { PLAYER_ANIMALS, Species, skinById, defaultSkin } from './config';

/** The only things players can "say" to each other. */
export const EMOTES = ['👋 Hi!', '😄 Hehe!', '❤️ Love it!', '🎉 Yay!', '🏃 Follow me!', '🎮 Let\'s play!', '😮 Wow!', '👀 Over here!'];

export interface LocalState { name: string; girl: boolean; species: Species; skin: string; x: number; y: number; z: number; yaw: number; speed: number; swim: boolean; region: string }
interface Room {
  presence(patch: Record<string, unknown>): Promise<void>;
  peers(): readonly { peer: string; isMe: boolean; presence: Readonly<Record<string, unknown>>; updatedAt: number }[];
  onPeers(h: (c: { peers: readonly { peer: string; isMe: boolean; presence: Readonly<Record<string, unknown>> }[] }) => void, e?: (err: { code: string }) => void): () => void;
  connected(): boolean;
}
interface Other {
  rig: AnimalRig; key: string; tag: THREE.Sprite; bubble: THREE.Sprite | null; bubbleUntil: number; lastEmoteAt: number;
  x: number; y: number; z: number; yaw: number; tx: number; ty: number; tz: number; tyaw: number; speed: number; swim: boolean; seenAt: number;
}

const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const str = (v: unknown, max: number) => (typeof v === 'string' ? [...v].filter((ch) => { const c = ch.codePointAt(0) ?? 0; return c >= 32 && !(c >= 0x7f && c <= 0x9f) && !(c >= 0x200b && c <= 0x200f) && !(c >= 0x2028 && c <= 0x202e) && !(c >= 0x2060 && c <= 0x206f); }).join('').slice(0, max) : '');

function textSprite(text: string, bg: string, fg: string, w = 2.2) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 112;
  const g = c.getContext('2d')!;
  g.font = 'bold 54px Nunito, sans-serif';
  const tw = Math.min(496, g.measureText(text).width + 48);
  g.fillStyle = bg; g.beginPath(); g.roundRect(256 - tw / 2, 8, tw, 96, 40); g.fill();
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 60, 480);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false }));
  s.scale.set(w, (w * 112) / 512, 1); s.renderOrder = 7;
  return s;
}

export class Multiplayer {
  room: Room | null = null;
  others = new Map<string, Other>();
  private sentAt = 0;
  private lastSent = '';
  private myEmote = { text: '', at: 0 };
  private myBubble: THREE.Sprite | null = null;
  private myBubbleUntil = 0;
  /** Called when the number of other players changes. */
  onCount?: (n: number) => void;
  onJoin?: (name: string) => void;

  constructor(private scene: THREE.Scene) {
    const w = window as unknown as { claude?: { use?: (n: string) => Promise<unknown> } };
    if (!w.claude?.use) return;
    void w.claude.use('room').then((r) => {
      if (!r) return;
      this.room = r as Room;
      this.room.onPeers(() => this.sync(), () => { this.room = null; this.clearAll(); this.onCount?.(0); });
    }).catch(() => { /* playing alone is fine */ });
  }
  get online() { return !!this.room; }
  /** Say something (from the fixed list) above your head, for everyone to see. */
  emote(i: number, me: AnimalRig, now: number) {
    const text = EMOTES[i]; if (!text) return;
    this.myEmote = { text, at: Date.now() };
    this.lastSent = '';   // send right away
    this.showBubble(me, text, now, true);
  }
  private showBubble(rig: AnimalRig, text: string, now: number, mine: boolean, o?: Other) {
    const b = textSprite(text, 'rgba(255,255,255,0.95)', '#3a2a5a', 2.4);
    rig.root.add(b); b.position.set(0, rig.height + 1.05, 0);
    if (mine) { this.myBubble?.removeFromParent(); this.myBubble = b; this.myBubbleUntil = now + 4; }
    else if (o) { o.bubble?.removeFromParent(); o.bubble = b; o.bubbleUntil = now + 4; }
  }
  private clearAll() { for (const o of this.others.values()) this.removeOther(o); this.others.clear(); }
  private removeOther(o: Other) { o.rig.root.removeFromParent(); disposeRig(o.rig); }
  /** Someone joined, left, or moved. */
  private sync() {
    if (!this.room) return;
    const seen = new Set<string>();
    let joinedName = '';
    for (const p of this.room.peers()) {
      if (p.isMe) continue;
      const pr = p.presence || {};
      if (pr.v !== 1) continue;   // not in the game yet
      seen.add(p.peer);
      let sp = str(pr.sp, 20) as Species;
      if (!PLAYER_ANIMALS[sp]) sp = 'bunny';
      let skin = str(pr.sk, 40);
      if (skinById(skin)?.species !== sp) skin = defaultSkin(sp);
      const girl = pr.g === true;
      const name = str(pr.n, 16) || 'Friend';
      const key = `${sp}|${skin}|${girl}|${name}`;
      let o = this.others.get(p.peer);
      if (o && o.key !== key) { this.removeOther(o); this.others.delete(p.peer); o = undefined; }
      if (!o) {
        const rig = buildPlayerAnimal(sp, skinById(skin)!, girl);
        const tag = textSprite(`${PLAYER_ANIMALS[sp].icon} ${name}`, 'rgba(60,40,120,0.85)', '#ffffff', 2.4);
        tag.position.set(0, rig.height + 0.45, 0); rig.root.add(tag);
        this.scene.add(rig.root);
        o = { rig, key, tag, bubble: null, bubbleUntil: 0, lastEmoteAt: 0, x: num(pr.x), y: num(pr.y), z: num(pr.z), yaw: num(pr.r), tx: 0, ty: 0, tz: 0, tyaw: 0, speed: 0, swim: false, seenAt: 0 };
        this.others.set(p.peer, o);
        joinedName = name;
      }
      o.tx = num(pr.x, o.tx); o.ty = num(pr.y, o.ty); o.tz = num(pr.z, o.tz); o.tyaw = num(pr.r, o.tyaw);
      o.speed = Math.max(0, Math.min(20, num(pr.m))); o.swim = pr.w === true;
      o.rig.root.userData.region = str(pr.rg, 24);
      const et = num(pr.et);
      const etext = str(pr.e, 24);
      if (et && et !== o.lastEmoteAt && EMOTES.includes(etext)) { o.lastEmoteAt = et; o.rig.root.userData.pendingEmote = etext; }
    }
    for (const [k, o] of this.others) if (!seen.has(k)) { this.removeOther(o); this.others.delete(k); }
    this.onCount?.(this.others.size);
    if (joinedName) this.onJoin?.(joinedName);
  }
  /** Every frame: tell everyone where you are (a few times a second), and move the others smoothly. */
  update(dt: number, now: number, me: LocalState, myRig: AnimalRig) {
    if (this.myBubble && now > this.myBubbleUntil) { this.myBubble.removeFromParent(); this.myBubble = null; }
    if (this.room) {
      const t = performance.now();
      if (t - this.sentAt > 110) {
        const r2 = (v: number) => Math.round(v * 100) / 100;
        const pres = { v: 1, n: me.name.slice(0, 16), g: me.girl, sp: me.species, sk: me.skin, x: r2(me.x), y: r2(me.y), z: r2(me.z), r: r2(me.yaw), m: r2(me.speed), w: me.swim, rg: me.region, e: this.myEmote.text, et: this.myEmote.at };
        const s = JSON.stringify(pres);
        if (s !== this.lastSent) { this.lastSent = s; this.sentAt = t; void this.room.presence(pres).catch(() => { /* try again next time */ }); }
      }
    }
    for (const o of this.others.values()) {
      // only show players who are in the same place as you (the world, the zoo, the play room…)
      const same = o.rig.root.userData.region === me.region && Math.hypot(o.tx - me.x, o.tz - me.z) < 160;
      o.rig.root.visible = same;
      if (!same) { o.x = o.tx; o.y = o.ty; o.z = o.tz; continue; }
      const k = Math.min(1, dt * 10);
      if (Math.hypot(o.tx - o.x, o.tz - o.z) > 12) { o.x = o.tx; o.y = o.ty; o.z = o.tz; }
      o.x += (o.tx - o.x) * k; o.y += (o.ty - o.y) * k; o.z += (o.tz - o.z) * k;
      let dy = o.tyaw - o.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2; o.yaw += dy * k;
      o.rig.root.position.set(o.x, o.y, o.z); o.rig.root.rotation.y = o.yaw;
      animateRig(o.rig, dt, { speed: o.speed, airborne: false, attack: null, attackT: 0, windup: 0 });
      if (o.swim && o.rig.kind !== 'sea') { o.rig.body.rotation.x = 1.25; o.rig.body.position.y = 0.15; }
      const bub = o.rig.body.getObjectByName('bubble'); if (bub) bub.visible = !o.swim;
      const pe = o.rig.root.userData.pendingEmote as string | undefined;
      if (pe) { o.rig.root.userData.pendingEmote = undefined; this.showBubble(o.rig, pe, now, false, o); }
      if (o.bubble && now > o.bubbleUntil) { o.bubble.removeFromParent(); o.bubble = null; }
    }
    void myRig;
  }
}
