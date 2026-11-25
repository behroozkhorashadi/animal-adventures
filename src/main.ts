import './style.css';
import { Game } from './game';
import { $ } from './ui';

function fail(msg: string) {
  $('screen-loading').hidden = true;
  $('screen-error').hidden = false;
  $('error-text').textContent = msg;
}

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

async function boot() {
  $('btn-retry').addEventListener('click', () => location.reload());
  if (!webglAvailable()) {
    fail('Your browser could not start 3D graphics (WebGL). Try a newer version of Chrome, Edge, Firefox or Safari, or turn on hardware acceleration in your browser settings.');
    return;
  }
  const fill = $('loading-fill');
  const text = $('loading-text');
  const progress = async (f: number, t: string) => {
    fill.style.width = `${Math.round(f * 100)}%`;
    text.textContent = t;
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
  };
  try {
    const game = new Game($('game') as HTMLCanvasElement);
    await game.load(progress);
    (window as unknown as { game: Game }).game = game; // handy for debugging
    game.showStart();
  } catch (err) {
    console.error(err);
    fail('Something went wrong while loading the game world. Please try reloading the page. (' + (err instanceof Error ? err.message : String(err)) + ')');
  }
}

boot();
