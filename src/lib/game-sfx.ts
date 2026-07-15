// Lightweight Web Audio SFX shared across all mini-games.
// No external assets — every sound is synthesized on demand.

let ctx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

type Env = { attack?: number; decay?: number; sustain?: number; release?: number; peak?: number };

function env(audio: AudioContext, gain: GainNode, t0: number, duration: number, e: Env = {}) {
  const { attack = 0.005, decay = 0.06, sustain = 0.4, release = 0.1, peak = 0.3 } = e;
  gain.gain.cancelScheduledValues(t0);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(peak, t0 + attack);
  gain.gain.linearRampToValueAtTime(peak * sustain, t0 + attack + decay);
  gain.gain.setValueAtTime(peak * sustain, t0 + Math.max(attack + decay, duration - release));
  gain.gain.linearRampToValueAtTime(0, t0 + duration);
}

function tone(
  freq: number,
  duration: number,
  {
    type = "sine",
    delay = 0,
    envelope,
    slideTo,
    filter,
  }: {
    type?: OscillatorType;
    delay?: number;
    envelope?: Env;
    slideTo?: number;
    filter?: { type: BiquadFilterType; freq: number; q?: number };
  } = {},
) {
  const audio = getCtx();
  if (!audio) return;
  const t0 = audio.currentTime + delay;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo != null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + duration);
  let node: AudioNode = osc;
  if (filter) {
    const f = audio.createBiquadFilter();
    f.type = filter.type;
    f.frequency.value = filter.freq;
    if (filter.q != null) f.Q.value = filter.q;
    node.connect(f);
    node = f;
  }
  node.connect(gain).connect(audio.destination);
  env(audio, gain, t0, duration, envelope);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

function noise(
  duration: number,
  {
    delay = 0,
    envelope,
    filter,
    peak = 0.3,
  }: {
    delay?: number;
    envelope?: Env;
    filter?: { type: BiquadFilterType; freq: number; q?: number; sweepTo?: number };
    peak?: number;
  } = {},
) {
  const audio = getCtx();
  if (!audio) return;
  const t0 = audio.currentTime + delay;
  const buf = audio.createBuffer(1, Math.max(1, Math.floor(audio.sampleRate * duration)), audio.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = audio.createBufferSource();
  src.buffer = buf;
  const gain = audio.createGain();
  let node: AudioNode = src;
  if (filter) {
    const f = audio.createBiquadFilter();
    f.type = filter.type;
    f.frequency.setValueAtTime(filter.freq, t0);
    if (filter.q != null) f.Q.value = filter.q;
    if (filter.sweepTo != null) f.frequency.exponentialRampToValueAtTime(Math.max(20, filter.sweepTo), t0 + duration);
    node.connect(f);
    node = f;
  }
  node.connect(gain).connect(audio.destination);
  env(audio, gain, t0, duration, { peak, ...(envelope ?? {}) });
  src.start(t0);
  src.stop(t0 + duration + 0.02);
}

// ── Global mute (persisted) ──
const MUTE_KEY = "pandacine-sfx-muted";
let muted = false;
if (typeof window !== "undefined") {
  try { muted = window.localStorage.getItem(MUTE_KEY) === "1"; } catch { /* ignore */ }
}
export function setSfxMuted(v: boolean) {
  muted = v;
  if (typeof window !== "undefined") {
    try { window.localStorage.setItem(MUTE_KEY, v ? "1" : "0"); } catch { /* ignore */ }
  }
}
export function isSfxMuted() { return muted; }

function guard(fn: () => void) { if (!muted) fn(); }

export const gameSfx = {
  // Generic UI
  click() { guard(() => tone(660, 0.05, { type: "triangle", envelope: { peak: 0.15, release: 0.04 } })); },
  pick() {
    guard(() => {
      tone(520, 0.08, { type: "triangle", envelope: { peak: 0.18, release: 0.06 } });
      tone(780, 0.1, { type: "sine", delay: 0.04, envelope: { peak: 0.16, release: 0.08 } });
    });
  },
  pop() {
    guard(() => {
      tone(880, 0.09, { type: "sine", slideTo: 440, envelope: { peak: 0.22, release: 0.07 } });
    });
  },
  place() {
    guard(() => {
      noise(0.05, { filter: { type: "bandpass", freq: 1500, q: 3 }, peak: 0.22 });
      tone(220, 0.08, { type: "triangle", envelope: { peak: 0.2, release: 0.05 } });
    });
  },
  tick() { guard(() => tone(1200, 0.03, { type: "square", envelope: { peak: 0.1, release: 0.02 } })); },

  // Feedback
  correct() {
    guard(() => {
      [523, 659, 784].forEach((f, i) =>
        tone(f, 0.14, { type: "sine", delay: i * 0.06, envelope: { peak: 0.2, release: 0.09 } })
      );
    });
  },
  wrong() {
    guard(() => {
      tone(220, 0.22, { type: "sawtooth", slideTo: 110, envelope: { peak: 0.22, release: 0.14 } });
      noise(0.08, { filter: { type: "lowpass", freq: 500 }, peak: 0.18 });
    });
  },
  reveal() {
    guard(() => {
      [392, 523, 659].forEach((f, i) =>
        tone(f, 0.16, { type: "triangle", delay: i * 0.05, envelope: { peak: 0.18, release: 0.1 } })
      );
    });
  },

  // Outcomes
  win() {
    guard(() => {
      [523, 659, 784, 1047].forEach((f, i) =>
        tone(f, 0.22, { type: "sine", delay: i * 0.07, envelope: { peak: 0.22, release: 0.14 } })
      );
      tone(1568, 0.35, { type: "triangle", delay: 0.28, envelope: { peak: 0.18, release: 0.22 } });
    });
  },
  lose() {
    guard(() => {
      tone(392, 0.32, { type: "triangle", slideTo: 196, envelope: { peak: 0.22, release: 0.2 } });
      tone(261, 0.45, { type: "sine", delay: 0.18, slideTo: 130, envelope: { peak: 0.2, release: 0.28 } });
    });
  },
  draw() {
    guard(() => {
      tone(440, 0.24, { type: "sine", slideTo: 330, envelope: { peak: 0.2, release: 0.16 } });
      tone(330, 0.28, { type: "sine", delay: 0.12, envelope: { peak: 0.18, release: 0.18 } });
    });
  },
  start() {
    guard(() => {
      tone(523, 0.14, { type: "sine", envelope: { peak: 0.2, release: 0.08 } });
      tone(784, 0.2, { type: "sine", delay: 0.1, envelope: { peak: 0.22, release: 0.12 } });
    });
  },
  complete() {
    guard(() => {
      [659, 784, 988, 1319].forEach((f, i) =>
        tone(f, 0.18, { type: "sine", delay: i * 0.05, envelope: { peak: 0.2, release: 0.12 } })
      );
    });
  },

  // Painting / drawing
  stroke() {
    guard(() => tone(300 + Math.random() * 200, 0.04, { type: "sine", envelope: { peak: 0.06, release: 0.03 } }));
  },
  erase() {
    guard(() => noise(0.12, { filter: { type: "highpass", freq: 800 }, peak: 0.15 }));
  },

  // Spin (love-quiz wheel)
  spin() {
    guard(() => {
      for (let i = 0; i < 12; i++) {
        tone(600 + i * 40, 0.04, { type: "square", delay: i * 0.08, envelope: { peak: 0.08, release: 0.03 } });
      }
    });
  },
};
