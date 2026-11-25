// All sound is synthesised live with the Web Audio API (no audio files).
import { ZoneId } from './config';

export class Audio {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private ambBus!: GainNode;
  private wind?: { gain: GainNode; filter: BiquadFilterNode };
  private noiseBuf!: AudioBuffer;
  private nextNote = 0;
  private step = 0;
  private ambTimer = 0;
  zone: ZoneId = 'forest';
  settings = { muted: false, music: 0.5, sfx: 0.8 };

  /** Must be called from a user gesture. */
  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.sfxBus = ctx.createGain(); this.sfxBus.connect(this.master);
    this.musicBus = ctx.createGain(); this.musicBus.connect(this.master);
    this.ambBus = ctx.createGain(); this.ambBus.connect(this.sfxBus);
    this.ambBus.gain.value = 0.55;
    const len = ctx.sampleRate * 4;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // wind bed
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 500;
    const gain = ctx.createGain(); gain.gain.value = 0.05;
    src.connect(filter).connect(gain).connect(this.ambBus); src.start();
    this.wind = { gain, filter };
    this.nextNote = ctx.currentTime + 0.5;
    this.apply();
  }

  apply() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.settings.muted ? 0 : 1, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.settings.sfx, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.settings.music * 0.5, t, 0.05);
  }

  suspend() { this.ctx?.suspend(); }
  resume() { this.ctx?.resume(); }

  // ---- primitives -----------------------------------------------------------
  private tone(freq: number, dur: number, opts: { type?: OscillatorType; vol?: number; slideTo?: number; delay?: number; bus?: GainNode; attack?: number } = {}) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime + (opts.delay ?? 0);
    const o = ctx.createOscillator(); o.type = opts.type ?? 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (opts.slideTo) o.frequency.exponentialRampToValueAtTime(opts.slideTo, t + dur);
    const g = ctx.createGain();
    const a = opts.attack ?? 0.01;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(opts.vol ?? 0.2, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(opts.bus ?? this.sfxBus);
    o.start(t); o.stop(t + dur + 0.05);
  }
  private noise(dur: number, opts: { freq?: number; q?: number; vol?: number; type?: BiquadFilterType; slideTo?: number; delay?: number; bus?: GainNode } = {}) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime + (opts.delay ?? 0);
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = opts.type ?? 'bandpass'; f.frequency.setValueAtTime(opts.freq ?? 1000, t); f.Q.value = opts.q ?? 1;
    if (opts.slideTo) f.frequency.exponentialRampToValueAtTime(opts.slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(opts.vol ?? 0.3, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(opts.bus ?? this.sfxBus);
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }

  // ---- effects ---------------------------------------------------------------
  jump() { this.tone(280, 0.18, { type: 'triangle', slideTo: 560, vol: 0.18 }); }
  land() { this.noise(0.08, { freq: 300, vol: 0.12, type: 'lowpass' }); }
  scratch() { this.noise(0.14, { freq: 2500, slideTo: 900, q: 2, vol: 0.35 }); }
  bite() { this.noise(0.06, { freq: 600, vol: 0.4, q: 3 }); this.noise(0.06, { freq: 500, vol: 0.35, q: 3, delay: 0.07 }); }
  hit() { this.tone(150, 0.15, { type: 'square', slideTo: 70, vol: 0.12 }); this.noise(0.1, { freq: 800, vol: 0.25 }); }
  miss() { this.noise(0.12, { freq: 1800, slideTo: 1200, q: 1, vol: 0.12 }); }
  hurt() { this.tone(330, 0.25, { type: 'sawtooth', slideTo: 160, vol: 0.1 }); this.noise(0.12, { freq: 400, vol: 0.25 }); }
  coin() { this.tone(988, 0.12, { type: 'square', vol: 0.08 }); this.tone(1319, 0.35, { type: 'square', vol: 0.08, delay: 0.08 }); this.tone(1976, 0.3, { vol: 0.06, delay: 0.08 }); }
  food() { this.tone(600, 0.1, { type: 'triangle', slideTo: 900, vol: 0.2 }); this.tone(1200, 0.15, { type: 'sine', vol: 0.1, delay: 0.06 }); }
  purchase() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.3, { type: 'triangle', vol: 0.16, delay: i * 0.08 })); }
  denied() { this.tone(220, 0.2, { type: 'square', vol: 0.06 }); this.tone(180, 0.25, { type: 'square', vol: 0.06, delay: 0.12 }); }
  click() { this.tone(700, 0.05, { type: 'triangle', vol: 0.1 }); }
  specialReady() { [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.4, { type: 'sine', vol: 0.12, delay: i * 0.06 })); this.noise(0.6, { freq: 6000, vol: 0.06, type: 'highpass' }); }
  special() { this.tone(120, 0.5, { type: 'sawtooth', slideTo: 40, vol: 0.2 }); this.noise(0.5, { freq: 400, slideTo: 100, vol: 0.45, type: 'lowpass' }); this.tone(660, 0.3, { vol: 0.1, slideTo: 1320 }); }
  victory() { [523, 659, 784, 659, 1047].forEach((f, i) => this.tone(f, 0.25, { type: 'triangle', vol: 0.14, delay: i * 0.1 })); }
  defeat() { [440, 392, 349, 262].forEach((f, i) => this.tone(f, 0.35, { type: 'triangle', vol: 0.14, delay: i * 0.16 })); }
  roar() { this.noise(1.4, { freq: 120, q: 2, vol: 0.7, slideTo: 60 }); this.tone(70, 1.3, { type: 'sawtooth', vol: 0.09, slideTo: 45 }); this.tone(140, 1.0, { type: 'square', vol: 0.03, slideTo: 90, delay: 0.1 }); }
  growl() { this.noise(0.7, { freq: 160, q: 4, vol: 0.5 }); this.tone(80, 0.7, { type: 'sawtooth', vol: 0.05, slideTo: 70 }); }
  telegraph() { this.tone(520, 0.12, { type: 'square', vol: 0.05 }); }
  /** Monkeys chattering: ooh ooh aah aah! */
  monkey() {
    [[520, 820], [560, 880], [700, 420], [760, 440]].forEach(([a, b], i) => this.tone(a, 0.16, { type: 'triangle', slideTo: b, vol: 0.09, delay: i * 0.17 }));
  }
  /** A real-sounding toilet flush: a rushing whoosh that swirls down, then a gurgle and the tank refilling. */
  flush() {
    this.noise(1.9, { freq: 900, slideTo: 260, q: 0.8, vol: 0.5, type: 'bandpass' });
    this.noise(1.6, { freq: 3200, slideTo: 900, q: 0.6, vol: 0.18, type: 'highpass', delay: 0.05 });
    for (let i = 0; i < 9; i++) this.tone(140 + Math.random() * 160, 0.09, { type: 'sine', slideTo: 70 + Math.random() * 50, vol: 0.12, delay: 1.1 + i * 0.11 });
    this.noise(1.4, { freq: 1800, slideTo: 2600, q: 3, vol: 0.08, delay: 2.0 });
  }
  /** Splashy bath water. */
  splash() {
    for (let i = 0; i < 4; i++) this.noise(0.35, { freq: 1600 + Math.random() * 800, slideTo: 500, q: 0.7, vol: 0.32, delay: i * 0.28 });
    for (let i = 0; i < 6; i++) this.tone(500 + Math.random() * 700, 0.07, { type: 'sine', slideTo: 1400, vol: 0.06, delay: 0.1 + i * 0.17 });
  }
  /** Brush brush brush! */
  brush() { for (let i = 0; i < 8; i++) this.noise(0.12, { freq: i % 2 ? 4200 : 3400, q: 1.5, vol: 0.22, delay: i * 0.16 }); }
  /** A squeaky toy and a happy little tune. */
  squeak() {
    this.tone(1100, 0.14, { type: 'square', slideTo: 1600, vol: 0.07 }); this.tone(1500, 0.14, { type: 'square', slideTo: 1000, vol: 0.07, delay: 0.18 });
    [659, 784, 988].forEach((f, i) => this.tone(f, 0.18, { type: 'triangle', vol: 0.1, delay: 0.45 + i * 0.12 }));
  }
  gate() { [392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.5, { type: 'triangle', vol: 0.14, delay: i * 0.12 })); }
  /** Ding-dong! The bell at the top of the climbing wall. */
  bell() { for (let k = 0; k < 4; k++) { this.tone(1568, 1.2, { type: 'sine', vol: 0.18, delay: k * 0.35 }); this.tone(2350, 0.8, { type: 'sine', vol: 0.06, delay: k * 0.35 }); } }
  /** Boing! */
  boing() { this.tone(180, 0.35, { type: 'sine', vol: 0.2, slideTo: 520 }); }
  celebrate() { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.35, { type: 'triangle', vol: 0.15, delay: i * 0.12 })); }

  // ---- ambience & music -----------------------------------------------------
  update(dt: number, paused: boolean) {
    const ctx = this.ctx; if (!ctx || ctx.state !== 'running') return;
    // wind colour per zone
    if (this.wind) {
      const target = this.zone === 'antarctica' ? { f: 1000, g: 0.11 } : this.zone === 'savanna' ? { f: 700, g: 0.07 } : this.zone === 'swamp' ? { f: 350, g: 0.04 } : { f: 500, g: 0.05 };
      this.wind.filter.frequency.setTargetAtTime(target.f, ctx.currentTime, 1);
      this.wind.gain.gain.setTargetAtTime(target.g, ctx.currentTime, 1);
    }
    if (!paused) {
      this.ambTimer -= dt;
      if (this.ambTimer <= 0) {
        this.ambTimer = 0.8 + Math.random() * 2.5;
        if (this.zone === 'forest' || this.zone === 'village' || this.zone === 'jungle') this.bird();
        else if (this.zone === 'savanna') this.insects();
        else if (this.zone === 'antarctica') this.gust();
        else this.frog();
      }
    }
    // gentle generative music: pentatonic melody over slow chords
    const scale = [0, 2, 4, 7, 9, 12, 14, 16];
    if (this.nextNote < ctx.currentTime - 0.5) this.nextNote = ctx.currentTime + 0.05;
    const roots = this.zone === 'antarctica' ? [52, 48, 50, 45] : this.zone === 'swamp' ? [45, 41, 43, 40] : this.zone === 'savanna' ? [50, 47, 43, 45] : [48, 45, 41, 43];
    while (this.nextNote < ctx.currentTime + 0.25) {
      const beat = 0.42;
      const bar = Math.floor(this.step / 8) % 4;
      const root = roots[bar];
      if (this.step % 8 === 0) {
        for (const iv of [0, 7, 16]) this.musicTone(midi(root + iv - 12), beat * 7.5, 0.035, 'sine', this.nextNote, 0.4);
      }
      if (Math.random() < 0.55 && this.step % 2 === 0 || this.step % 8 === 0) {
        const n = root + 12 + scale[Math.floor(Math.random() * scale.length)];
        this.musicTone(midi(n), beat * (1 + Math.random() * 1.5), 0.05, 'triangle', this.nextNote, 0.02);
      }
      this.nextNote += beat;
      this.step++;
    }
  }
  private musicTone(freq: number, dur: number, vol: number, type: OscillatorType, t: number, attack: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.musicBus);
    o.start(t); o.stop(t + dur + 0.05);
  }
  private bird() {
    const base = 2200 + Math.random() * 1600;
    const n = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) this.tone(base, 0.09, { slideTo: base * (Math.random() < 0.5 ? 1.35 : 0.75), vol: 0.035, delay: i * 0.12, bus: this.ambBus });
  }
  private insects() {
    for (let i = 0; i < 6; i++) this.tone(4200 + Math.random() * 400, 0.04, { type: 'square', vol: 0.008, delay: i * 0.05, bus: this.ambBus });
  }
  private gust() {
    this.noise(1.6, { freq: 500, slideTo: 1400, q: 0.8, vol: 0.05, bus: this.ambBus });
  }
  private frog() {
    const f = 110 + Math.random() * 60;
    for (let i = 0; i < 2; i++) { this.tone(f, 0.12, { type: 'sawtooth', slideTo: f * 0.8, vol: 0.035, delay: i * 0.18, bus: this.ambBus }); }
  }
}
function midi(n: number) { return 440 * Math.pow(2, (n - 69) / 12); }
