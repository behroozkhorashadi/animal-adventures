// 🎤 Talk instead of typing. In the published claude.ai page this uses the
// `dictation` capability; when running locally it falls back to the browser's
// own speech recognition (Chrome/Edge). If neither exists the button is hidden.

type Dict = {
  start: (o?: { language?: string }) => Promise<void>;
  stop: () => Promise<void>;
  active: () => boolean;
  onPartial: (h: (e: { text: string }) => void) => () => void;
  onFinal: (h: (e: { text: string }) => void) => () => void;
  onState: (h: (e: { state: string; reason?: string }) => void) => () => void;
};
let dict: Dict | null = null;
let refused = false;

export async function initVoice() {
  try {
    const w = window as unknown as { claude?: { use?: (n: string) => Promise<unknown> } };
    if (w.claude?.use) dict = (await w.claude.use('dictation')) as Dict | null;
  } catch { dict = null; }
}

type Rec = { lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void; onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null; onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null };
function browserRec(): (new () => Rec) | null {
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}
export function voiceAvailable() { return !refused && (!!dict || !!browserRec()); }

export interface Listening { stop(): void }
/** Must be called straight from a click. Calls onText with everything heard so far, and onEnd when it stops. */
export function startListening(onText: (text: string, settled: boolean) => void, onEnd: (text: string, problem?: string) => void): Listening | null {
  let settled = '', partial = '';
  const full = () => (settled + (partial ? ' ' + partial : '')).trim();
  if (dict) {
    const d = dict;
    const offs = [
      d.onPartial(({ text }) => { partial = text; onText(full(), false); }),
      d.onFinal(({ text }) => { settled += text; partial = ''; onText(full(), true); }),
      d.onState(({ state, reason }) => {
        if (state !== 'idle') return;
        for (const o of offs) o();
        if (reason === 'not_granted' || reason === 'unavailable') refused = true;
        onEnd(full(), reason && reason !== 'stopped' && reason !== 'viewer_stopped' ? reason : undefined);
      }),
    ];
    d.start().catch((e: { code?: string }) => {
      if (e?.code === 'not_granted' || e?.code === 'unavailable') refused = true;
    });
    return { stop: () => { void d.stop(); } };
  }
  const R = browserRec();
  if (!R) return null;
  const r = new R();
  r.lang = navigator.language || 'en-US'; r.interimResults = true; r.continuous = true;
  let problem: string | undefined;
  r.onresult = (e) => {
    partial = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const res = e.results[i];
      if (res.isFinal) settled += (settled ? ' ' : '') + res[0].transcript.trim(); else partial += res[0].transcript;
    }
    onText(full(), !partial);
  };
  r.onerror = (e) => { problem = e.error; if (e.error === 'not-allowed' || e.error === 'service-not-allowed') refused = true; };
  r.onend = () => onEnd(full(), problem);
  try { r.start(); } catch { return null; }
  return { stop: () => r.stop() };
}
