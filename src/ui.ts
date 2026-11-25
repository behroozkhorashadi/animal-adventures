// Small DOM helpers shared by the game.
export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...children: (Node | string | null | undefined | false)[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'html') e.innerHTML = v;
    else e.setAttribute(k, v);
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) e.append(c);
  return e;
}

export function button(label: string, cls: string, onClick: () => void, disabled = false): HTMLButtonElement {
  const b = el('button', { class: 'btn ' + cls, type: 'button' });
  b.innerHTML = label;
  b.disabled = disabled;
  b.addEventListener('click', (e) => { e.stopPropagation(); if (!b.disabled) onClick(); });
  return b;
}

export function toast(text: string, kind: '' | 'gold' | 'bad' | 'good' = '', ms = 2200) {
  const box = $('toasts');
  while (box.children.length > 3) box.firstElementChild?.remove();
  const t = el('div', { class: 'toast ' + kind, text });
  box.append(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 450); }, ms);
}

let bannerTimer = 0;
export function banner(title: string, sub = '') {
  const b = $('zone-banner');
  b.innerHTML = '';
  b.append(document.createTextNode(title));
  if (sub) b.append(el('small', { text: sub }));
  b.classList.add('show');
  clearTimeout(bannerTimer);
  bannerTimer = window.setTimeout(() => b.classList.remove('show'), 2600);
}

export function coinPrice(n: number) {
  return `<span class="coin-icon"></span>${n}`;
}

/** Confetti for the celebration screen. Returns a stop function. */
export function confetti(parent: HTMLElement): () => void {
  const c = el('canvas', { id: 'confetti' });
  parent.append(c);
  const ctx = c.getContext('2d')!;
  const resize = () => { c.width = parent.clientWidth; c.height = parent.clientHeight; };
  resize();
  const cols = ['#f4b532', '#c8344a', '#4f8a3b', '#3b8fd9', '#ffffff', '#b56be0'];
  const parts = Array.from({ length: 160 }, () => ({
    x: Math.random() * c.width, y: -Math.random() * c.height, vy: 80 + Math.random() * 140, vx: (Math.random() - 0.5) * 60,
    r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 8, w: 6 + Math.random() * 8, col: cols[Math.floor(Math.random() * cols.length)],
  }));
  let last = performance.now();
  let raf = 0;
  const tick = (t: number) => {
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    ctx.clearRect(0, 0, c.width, c.height);
    for (const p of parts) {
      p.y += p.vy * dt; p.x += p.vx * dt; p.r += p.vr * dt;
      if (p.y > c.height + 20) { p.y = -10; p.x = Math.random() * c.width; }
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.col; ctx.fillRect(-p.w / 2, -p.w / 4, p.w, p.w / 2); ctx.restore();
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => { cancelAnimationFrame(raf); c.remove(); };
}
