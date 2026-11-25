// Procedurally generated textures (no external image assets needed).
import * as THREE from 'three';
import { rng } from './terrain';

const cache = new Map<string, THREE.Texture>();

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')!] as const;
}

function hex(c: number) { return '#' + c.toString(16).padStart(6, '0'); }
function shade(c: number, f: number) {
  const r = Math.min(255, Math.max(0, ((c >> 16) & 255) * f));
  const g = Math.min(255, Math.max(0, ((c >> 8) & 255) * f));
  const b = Math.min(255, Math.max(0, (c & 255) * f));
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

function finish(c: HTMLCanvasElement, repeat = 1) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  return t;
}

export type FurStyle = 'fur' | 'feather' | 'scale' | 'smooth';

/** Coloured fur/feather/scale texture with an optional overlay pattern. */
export function furTexture(base: number, style: FurStyle = 'fur', pattern?: string, patternColor?: number): THREE.Texture {
  const key = `${base}-${style}-${pattern}-${patternColor}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const S = 256;
  const [c, g] = canvas(S, S);
  g.fillStyle = hex(base);
  g.fillRect(0, 0, S, S);
  const r = rng(base ^ 0x9e3779b9);

  if (pattern && patternColor !== undefined) {
    g.fillStyle = hex(patternColor);
    if (pattern === 'spots') {
      for (let i = 0; i < 28; i++) { g.beginPath(); g.arc(r() * S, r() * S, 5 + r() * 9, 0, 7); g.fill(); }
    } else if (pattern === 'speckle') {
      for (let i = 0; i < 420; i++) { g.beginPath(); g.arc(r() * S, r() * S, 1 + r() * 2.2, 0, 7); g.fill(); }
    } else if (pattern === 'patches') {
      for (let i = 0; i < 5; i++) {
        g.beginPath();
        const cx = r() * S, cy = r() * S;
        for (let k = 0; k < 9; k++) {
          const a = (k / 9) * Math.PI * 2, rr = 28 + r() * 30;
          k ? g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : g.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
        }
        g.fill();
      }
    } else if (pattern === 'stripes') {
      for (let i = 0; i < 9; i++) { g.fillRect(i * (S / 9), 0, 6 + r() * 6, S); }
    }
  }

  if (style === 'fur') {
    for (let i = 0; i < 2600; i++) {
      const x = r() * S, y = r() * S, len = 4 + r() * 9, a = Math.PI / 2 + (r() - 0.5) * 0.6;
      g.strokeStyle = r() < 0.5 ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.10)';
      g.lineWidth = 0.8 + r();
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); g.stroke();
    }
  } else if (style === 'feather') {
    for (let y = 0; y < S + 12; y += 10) for (let x = (y / 10) % 2 ? 0 : 7; x < S + 14; x += 14) {
      g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 1.2;
      g.beginPath(); g.arc(x, y, 8, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.10)';
      g.beginPath(); g.arc(x, y - 2, 6, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
    }
    for (let i = 0; i < 600; i++) {
      g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)';
      g.fillRect(r() * S, r() * S, 2, 4);
    }
  } else if (style === 'scale') {
    for (let y = 0; y < S; y += 12) for (let x = (y / 12) % 2 ? 0 : 8; x < S; x += 16) {
      g.fillStyle = shade(base, 0.82 + r() * 0.3);
      g.beginPath(); g.ellipse(x, y, 7, 5, 0, 0, 7); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1; g.stroke();
    }
  } else {
    for (let i = 0; i < 900; i++) {
      g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)';
      g.fillRect(r() * S, r() * S, 3, 3);
    }
  }
  const t = finish(c, style === 'scale' ? 2 : 1);
  cache.set(key, t);
  return t;
}

/** Grayscale detail texture for the ground (multiplied by vertex colours). */
export function groundDetailTexture(): THREE.Texture {
  const hit = cache.get('ground'); if (hit) return hit;
  const S = 256;
  const [c, g] = canvas(S, S);
  g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, S, S);
  const r = rng(77);
  for (let i = 0; i < 5000; i++) {
    const v = 150 + r() * 105;
    g.fillStyle = `rgba(${v},${v},${v},0.55)`;
    const x = r() * S, y = r() * S;
    if (r() < 0.6) { g.fillRect(x, y, 1.5, 3 + r() * 5); } else { g.beginPath(); g.arc(x, y, 1 + r() * 2.5, 0, 7); g.fill(); }
  }
  const t = finish(c);
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set('ground', t);
  return t;
}

export function barkTexture(base = 0x5a4330): THREE.Texture {
  const key = 'bark' + base; const hit = cache.get(key); if (hit) return hit;
  const S = 128;
  const [c, g] = canvas(S, S);
  g.fillStyle = hex(base); g.fillRect(0, 0, S, S);
  const r = rng(base);
  for (let i = 0; i < 70; i++) {
    g.strokeStyle = r() < 0.6 ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.12)';
    g.lineWidth = 1 + r() * 2.5;
    const x = r() * S;
    g.beginPath(); g.moveTo(x, 0);
    for (let y = 0; y <= S; y += 16) g.lineTo(x + (r() - 0.5) * 6, y);
    g.stroke();
  }
  const t = finish(c); cache.set(key, t); return t;
}

export function plankTexture(base = 0x8a6440, horizontal = true): THREE.Texture {
  const key = 'plank' + base + horizontal; const hit = cache.get(key); if (hit) return hit;
  const S = 256;
  const [c, g] = canvas(S, S);
  const r = rng(base + 3);
  const n = 8;
  for (let i = 0; i < n; i++) {
    g.fillStyle = shade(base, 0.85 + r() * 0.3);
    if (horizontal) g.fillRect(0, (i * S) / n, S, S / n); else g.fillRect((i * S) / n, 0, S / n, S);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    if (horizontal) g.fillRect(0, (i * S) / n, S, 3); else g.fillRect((i * S) / n, 0, 3, S);
  }
  for (let i = 0; i < 300; i++) { g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(r() * S, r() * S, horizontal ? 18 : 1.5, horizontal ? 1.5 : 18); }
  const t = finish(c); cache.set(key, t); return t;
}

export function roofTexture(base = 0x6b3b2a): THREE.Texture {
  const key = 'roof' + base; const hit = cache.get(key); if (hit) return hit;
  const S = 256; const [c, g] = canvas(S, S); const r = rng(base);
  g.fillStyle = hex(base); g.fillRect(0, 0, S, S);
  for (let y = 0; y < S; y += 20) for (let x = (y / 20) % 2 ? 0 : 16; x < S + 32; x += 32) {
    g.fillStyle = shade(base, 0.8 + r() * 0.4);
    g.fillRect(x - 15, y, 30, 18);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x - 15, y + 16, 30, 3);
  }
  const t = finish(c); cache.set(key, t); return t;
}

export function stoneTexture(base = 0x8a877f): THREE.Texture {
  const key = 'stone' + base; const hit = cache.get(key); if (hit) return hit;
  const S = 256; const [c, g] = canvas(S, S); const r = rng(base + 11);
  g.fillStyle = shade(base, 0.6); g.fillRect(0, 0, S, S);
  for (let y = 0; y < S; y += 32) for (let x = (y / 32) % 2 ? -20 : 0; x < S; x += 44) {
    g.fillStyle = shade(base, 0.8 + r() * 0.4);
    g.beginPath(); g.roundRect(x + 2, y + 2, 40, 28, 8); g.fill();
  }
  const t = finish(c); cache.set(key, t); return t;
}

export function rockTexture(): THREE.Texture {
  const hit = cache.get('rock'); if (hit) return hit;
  const S = 256; const [c, g] = canvas(S, S); const r = rng(5);
  g.fillStyle = '#c9c6bf'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 3000; i++) {
    const v = 120 + r() * 135; g.fillStyle = `rgba(${v},${v},${v - 5},0.35)`;
    g.beginPath(); g.arc(r() * S, r() * S, 0.5 + r() * 3, 0, 7); g.fill();
  }
  for (let i = 0; i < 25; i++) {
    g.strokeStyle = 'rgba(40,40,40,0.25)'; g.lineWidth = 1;
    g.beginPath(); let x = r() * S, y = r() * S; g.moveTo(x, y);
    for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 40; y += (r() - 0.5) * 40; g.lineTo(x, y); }
    g.stroke();
  }
  const t = finish(c); cache.set('rock', t); return t;
}

/** Text label texture (used for coin values, signs). */
export function labelTexture(text: string, opts: { w?: number; h?: number; font?: string; color?: string; bg?: string; stroke?: string } = {}): THREE.CanvasTexture {
  const w = opts.w ?? 256, h = opts.h ?? 128;
  const [c, g] = canvas(w, h);
  if (opts.bg) { g.fillStyle = opts.bg; g.beginPath(); g.roundRect(4, 4, w - 8, h - 8, 18); g.fill(); }
  g.font = opts.font ?? `bold ${Math.floor(h * 0.62)}px Nunito, "Trebuchet MS", sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if (opts.stroke) { g.lineWidth = h * 0.1; g.strokeStyle = opts.stroke; g.strokeText(text, w / 2, h / 2 + 2); }
  g.fillStyle = opts.color ?? '#fff';
  g.fillText(text, w / 2, h / 2 + 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Wooden sign with multi-line text. */
export function signTexture(lines: string[], w = 512, h = 256): THREE.CanvasTexture {
  const [c, g] = canvas(w, h);
  drawSign(g, lines, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export function drawSign(g: CanvasRenderingContext2D, lines: string[], w: number, h: number) {
  g.clearRect(0, 0, w, h);
  g.fillStyle = '#8a5f37'; g.beginPath(); g.roundRect(0, 0, w, h, 26); g.fill();
  g.fillStyle = '#a3754a'; g.beginPath(); g.roundRect(10, 10, w - 20, h - 20, 20); g.fill();
  g.strokeStyle = 'rgba(60,35,15,0.35)'; g.lineWidth = 2;
  for (let y = 30; y < h; y += 34) { g.beginPath(); g.moveTo(16, y); g.lineTo(w - 16, y + 4); g.stroke(); }
  g.fillStyle = '#fffaf0'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const lh = (h - 30) / lines.length;
  lines.forEach((l, i) => {
    const size = i === 0 ? Math.min(64, lh * 0.75) : Math.min(46, lh * 0.66);
    g.font = `bold ${size}px Nunito, "Trebuchet MS", sans-serif`;
    g.lineWidth = 6; g.strokeStyle = 'rgba(50,28,10,0.8)';
    g.strokeText(l, w / 2, 15 + lh * (i + 0.5), w - 30);
    g.fillText(l, w / 2, 15 + lh * (i + 0.5), w - 30);
  });
}

export function softDotTexture(): THREE.Texture {
  const hit = cache.get('dot'); if (hit) return hit;
  const [c, g] = canvas(64, 64);
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.4, 'rgba(255,255,255,0.5)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); cache.set('dot', t); return t;
}

export function shadowTexture(): THREE.Texture {
  const hit = cache.get('shadow'); if (hit) return hit;
  const [c, g] = canvas(64, 64);
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(0,0,0,0.55)'); grd.addColorStop(0.7, 'rgba(0,0,0,0.25)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); cache.set('shadow', t); return t;
}

export function ringTexture(): THREE.Texture {
  const hit = cache.get('ring'); if (hit) return hit;
  const [c, g] = canvas(128, 128);
  g.strokeStyle = 'rgba(255,255,255,1)'; g.lineWidth = 10;
  g.beginPath(); g.arc(64, 64, 52, 0, 7); g.stroke();
  g.lineWidth = 4; g.strokeStyle = 'rgba(255,255,255,0.5)';
  g.beginPath(); g.arc(64, 64, 40, 0, 7); g.stroke();
  const t = new THREE.CanvasTexture(c); cache.set('ring', t); return t;
}

export function grassBladeTexture(): THREE.Texture {
  const hit = cache.get('blade'); if (hit) return hit;
  const [c, g] = canvas(64, 128);
  const r = rng(9);
  for (let i = 0; i < 9; i++) {
    const x = 8 + r() * 48, lean = (r() - 0.5) * 30;
    g.fillStyle = `rgba(255,255,255,${0.8 + r() * 0.2})`;
    g.beginPath(); g.moveTo(x - 3, 128); g.quadraticCurveTo(x, 60, x + lean, 4 + r() * 30); g.lineTo(x + 3, 128); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; cache.set('blade', t); return t;
}
