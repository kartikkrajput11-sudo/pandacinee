// Mascot voice — tiny WebAudio "panda" noises. No assets, respects the global
// sound-effects toggle used everywhere else in the app.
import { isSfxEnabled } from "./sfx";

let ctx: AudioContext | null = null;
function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  try {
    const Ctor: typeof AudioContext =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

type Note = {
  freq: number;
  start: number;
  dur: number;
  gain?: number;
  type?: OscillatorType;
  glideTo?: number;
};

function play(notes: Note[]) {
  if (!isSfxEnabled()) return;
  const c = ac();
  if (!c) return;
  if (c.state === "suspended") {
    try {
      void c.resume();
    } catch {
      /* ignore */
    }
  }
  const master = c.createGain();
  master.gain.value = 0.85;
  master.connect(c.destination);
  const t0 = c.currentTime;
  for (const n of notes) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = n.type ?? "sine";
    osc.frequency.setValueAtTime(n.freq, t0 + n.start);
    if (n.glideTo != null) osc.frequency.exponentialRampToValueAtTime(n.glideTo, t0 + n.start + n.dur);
    const peak = n.gain ?? 0.07;
    g.gain.setValueAtTime(0.0001, t0 + n.start);
    g.gain.exponentialRampToValueAtTime(peak, t0 + n.start + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + n.start + n.dur);
    osc.connect(g).connect(master);
    osc.start(t0 + n.start);
    osc.stop(t0 + n.start + n.dur + 0.02);
  }
}

function noise(dur: number, gain = 0.05, filterHz = 1400) {
  if (!isSfxEnabled()) return;
  const c = ac();
  if (!c) return;
  const frames = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, frames, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = filterHz;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(c.destination);
  src.start();
}

const r = (a: number, b: number) => a + Math.random() * (b - a);

export const pandaSfx = {
  giggle() {
    const base = r(620, 700);
    play([0, 1, 2, 3].map((i) => ({ freq: base + i * 40, start: i * 0.075, dur: 0.07, type: "triangle", gain: 0.05 })));
  },
  laugh() {
    const base = r(520, 600);
    play(
      [0, 1, 2, 3, 4, 5].map((i) => ({
        freq: base + (i % 2 ? 120 : 0),
        start: i * 0.09,
        dur: 0.08,
        type: "triangle",
        gain: 0.06,
      })),
    );
  },
  squeak() {
    play([{ freq: 900, start: 0, dur: 0.16, glideTo: 1500, type: "sine", gain: 0.05 }]);
  },
  happy() {
    play([
      { freq: 660, start: 0, dur: 0.1, type: "sine" },
      { freq: 880, start: 0.08, dur: 0.12, type: "sine" },
      { freq: 1180, start: 0.18, dur: 0.16, type: "sine" },
    ]);
  },
  yawn() {
    play([{ freq: 260, start: 0, dur: 0.7, glideTo: 180, type: "sine", gain: 0.05 }]);
  },
  snore() {
    play([{ freq: 120, start: 0, dur: 0.5, glideTo: 90, type: "sawtooth", gain: 0.025 }]);
  },
  chew() {
    noise(0.08, 0.04, 900);
    setTimeout(() => noise(0.08, 0.035, 800), 160);
  },
  sneeze() {
    play([{ freq: 520, start: 0, dur: 0.06, type: "sine", gain: 0.05 }]);
    setTimeout(() => noise(0.22, 0.06, 2600), 90);
  },
  pop() {
    play([{ freq: 420, start: 0, dur: 0.05, glideTo: 1200, type: "square", gain: 0.04 }]);
  },
  growl() {
    play([{ freq: 150, start: 0, dur: 0.35, glideTo: 110, type: "sawtooth", gain: 0.04 }]);
  },
  celebrate() {
    play([
      { freq: 523, start: 0, dur: 0.11 },
      { freq: 659, start: 0.1, dur: 0.11 },
      { freq: 784, start: 0.2, dur: 0.11 },
      { freq: 1046, start: 0.3, dur: 0.28, gain: 0.09 },
    ]);
  },
  camera() {
    noise(0.06, 0.07, 5200);
    play([{ freq: 2400, start: 0.02, dur: 0.05, type: "square", gain: 0.03 }]);
  },
  step() {
    noise(0.05, 0.03, 500);
  },
};
