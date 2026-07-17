// Web Audio-based chess sound effects. No audio assets shipped.
// All sounds are synthesized on demand; each call is self-contained
// (no shared graph) so overlapping sounds mix cleanly.
import thunderRumble from "@/assets/chess/thunder-rumble.mp3.asset.json";
import thunderCrack from "@/assets/chess/thunder-crack.mp3.asset.json";
import swordSlash from "@/assets/chess/sword-slash.mp3.asset.json";
import rainLoop from "@/assets/chess/rain-loop.mp3.asset.json";

function playSample(url: string, { delay = 0, volume = 1, muted = false }: { delay?: number; volume?: number; muted?: boolean } = {}) {
  if (muted || typeof window === "undefined") return;
  const start = () => {
    try {
      const a = new Audio(url);
      a.volume = Math.min(1, Math.max(0, volume));
      a.preload = "auto";
      void a.play().catch(() => { /* autoplay guard */ });
    } catch { /* ignore */ }
  };
  if (delay > 0) window.setTimeout(start, delay * 1000);
  else start();
}

// All sounds are synthesized on demand; each call is self-contained
// (no shared graph) so overlapping sounds mix cleanly.

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

function envelope(
  audio: AudioContext,
  gain: GainNode,
  t0: number,
  duration: number,
  env: Env = {},
) {
  const { attack = 0.005, decay = 0.06, sustain = 0.4, release = 0.12, peak = 0.35 } = env;
  gain.gain.cancelScheduledValues(t0);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(peak, t0 + attack);
  gain.gain.linearRampToValueAtTime(peak * sustain, t0 + attack + decay);
  gain.gain.setValueAtTime(peak * sustain, t0 + duration - release);
  gain.gain.linearRampToValueAtTime(0, t0 + duration);
}

function tone(
  freq: number,
  duration: number,
  {
    type = "sine",
    delay = 0,
    env,
    slideTo,
    filter,
    muted = false,
  }: {
    type?: OscillatorType;
    delay?: number;
    env?: Env;
    slideTo?: number;
    filter?: { type: BiquadFilterType; freq: number; q?: number };
    muted?: boolean;
  } = {},
) {
  if (muted) return;
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
  envelope(audio, gain, t0, duration, env);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

function noise(
  duration: number,
  {
    delay = 0,
    env,
    filter,
    peak = 0.4,
    muted = false,
  }: {
    delay?: number;
    env?: Env;
    filter?: { type: BiquadFilterType; freq: number; q?: number; sweepTo?: number };
    peak?: number;
    muted?: boolean;
  } = {},
) {
  if (muted) return;
  const audio = getCtx();
  if (!audio) return;
  const t0 = audio.currentTime + delay;
  const bufferSize = Math.max(1, Math.floor(audio.sampleRate * duration));
  const buffer = audio.createBuffer(1, bufferSize, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  const src = audio.createBufferSource();
  src.buffer = buffer;
  const gain = audio.createGain();
  let node: AudioNode = src;
  if (filter) {
    const f = audio.createBiquadFilter();
    f.type = filter.type;
    f.frequency.setValueAtTime(filter.freq, t0);
    if (filter.q != null) f.Q.value = filter.q;
    if (filter.sweepTo != null)
      f.frequency.exponentialRampToValueAtTime(Math.max(20, filter.sweepTo), t0 + duration);
    node.connect(f);
    node = f;
  }
  node.connect(gain).connect(audio.destination);
  envelope(audio, gain, t0, duration, { peak, ...(env ?? {}) });
  src.start(t0);
  src.stop(t0 + duration + 0.02);
}

// ── Public API ──

export type SfxOpts = { muted?: boolean };

export const sfx = {
  move({ muted }: SfxOpts = {}) {
    // Wooden click: short noise pop + low thud.
    noise(0.05, { filter: { type: "bandpass", freq: 1800, q: 4 }, peak: 0.28, muted });
    tone(180, 0.09, { type: "triangle", env: { attack: 0.002, decay: 0.04, sustain: 0.2, release: 0.05, peak: 0.22 }, muted });
  },
  capture({ muted }: SfxOpts = {}) {
    // Crunchier: filtered noise burst + descending thump.
    noise(0.12, { filter: { type: "bandpass", freq: 900, q: 2, sweepTo: 300 }, peak: 0.5, muted });
    tone(220, 0.14, { type: "sawtooth", slideTo: 90, env: { attack: 0.002, decay: 0.06, sustain: 0.3, release: 0.08, peak: 0.28 }, muted });
  },
  check({ muted }: SfxOpts = {}) {
    // Two-note alert.
    tone(880, 0.14, { type: "triangle", env: { peak: 0.22, release: 0.09 }, muted });
    tone(1320, 0.18, { type: "triangle", delay: 0.09, env: { peak: 0.22, release: 0.12 }, muted });
  },
  castle({ muted }: SfxOpts = {}) {
    // Two soft clicks in rapid succession.
    sfx.move({ muted });
    setTimeout(() => sfx.move({ muted }), 90);
  },
  promote({ muted }: SfxOpts = {}) {
    // Shimmer up.
    [523, 659, 784, 1047].forEach((f, i) =>
      tone(f, 0.16, { type: "sine", delay: i * 0.06, env: { peak: 0.2, release: 0.1 }, muted }),
    );
  },
  gameStart({ muted }: SfxOpts = {}) {
    tone(523, 0.14, { type: "sine", env: { peak: 0.2, release: 0.08 }, muted });
    tone(784, 0.2, { type: "sine", delay: 0.1, env: { peak: 0.22, release: 0.12 }, muted });
  },
  draw({ muted }: SfxOpts = {}) {
    tone(440, 0.28, { type: "sine", slideTo: 330, env: { peak: 0.22, release: 0.16 }, muted });
    tone(330, 0.32, { type: "sine", delay: 0.14, env: { peak: 0.2, release: 0.2 }, muted });
  },
  lose({ muted }: SfxOpts = {}) {
    tone(392, 0.35, { type: "triangle", slideTo: 196, env: { peak: 0.25, release: 0.2 }, muted });
    tone(261, 0.5, { type: "sine", delay: 0.2, slideTo: 130, env: { peak: 0.22, release: 0.3 }, muted });
  },

  // ── Win-animation stinger track (~5.4s) ──
  // Fully synthesized natural thunderstorm: rain bed → distant rumble →
  // bright lightning crack → rolling boom → soft victory chord.
  winCinematic({ muted }: SfxOpts = {}) {
    if (muted) return;

    // t=0.0  soft rain bed (highpassed noise, gentle hiss — no dread)
    noise(4.8, {
      filter: { type: "highpass", freq: 1400, q: 0.6 },
      peak: 0.18,
      env: { attack: 0.4, decay: 0.2, sustain: 0.9, release: 0.8, peak: 0.18 },
      muted,
    });
    // subtle mid-band patter to sell rain droplets
    noise(4.8, {
      filter: { type: "bandpass", freq: 2600, q: 0.8 },
      peak: 0.09,
      env: { attack: 0.5, decay: 0.2, sustain: 0.9, release: 1.0, peak: 0.09 },
      muted,
    });

    // t=0.4  distant rumble — low sine slide + lowpass rumble noise
    tone(55, 1.6, { type: "sine", delay: 0.4, slideTo: 30, env: { attack: 0.3, decay: 0.4, sustain: 0.7, release: 0.6, peak: 0.32 }, muted });
    noise(1.6, {
      delay: 0.4,
      filter: { type: "lowpass", freq: 220, q: 0.7, sweepTo: 90 },
      peak: 0.35,
      env: { attack: 0.25, decay: 0.35, sustain: 0.7, release: 0.7, peak: 0.35 },
      muted,
    });

    // t=1.9  LIGHTNING CRACK — bright wide-band burst (the "flash")
    noise(0.18, {
      delay: 1.9,
      filter: { type: "highpass", freq: 2200, q: 0.9 },
      peak: 0.55,
      env: { attack: 0.001, decay: 0.05, sustain: 0.4, release: 0.12, peak: 0.55 },
      muted,
    });
    // sharp mid crackle
    noise(0.22, {
      delay: 1.92,
      filter: { type: "bandpass", freq: 3200, q: 2.5 },
      peak: 0.4,
      env: { attack: 0.001, decay: 0.04, sustain: 0.3, release: 0.16, peak: 0.4 },
      muted,
    });

    // t=2.05  BIG THUNDER BOOM — deep body that rolls out
    tone(70, 1.8, { type: "sine", delay: 2.05, slideTo: 28, env: { attack: 0.005, decay: 0.2, sustain: 0.8, release: 1.4, peak: 0.6 }, muted });
    tone(110, 1.2, { type: "triangle", delay: 2.05, slideTo: 45, env: { attack: 0.005, decay: 0.15, sustain: 0.6, release: 0.9, peak: 0.35 }, muted });
    // rolling low noise tail — the classic sky-shaking rumble
    noise(2.2, {
      delay: 2.08,
      filter: { type: "lowpass", freq: 320, q: 0.8, sweepTo: 80 },
      peak: 0.5,
      env: { attack: 0.01, decay: 0.3, sustain: 0.7, release: 1.6, peak: 0.5 },
      muted,
    });

    // t=3.3  secondary distant crack echo
    noise(0.14, {
      delay: 3.3,
      filter: { type: "highpass", freq: 1800, q: 0.9 },
      peak: 0.28,
      env: { attack: 0.002, decay: 0.05, sustain: 0.3, release: 0.14, peak: 0.28 },
      muted,
    });
    tone(60, 1.0, { type: "sine", delay: 3.35, slideTo: 32, env: { attack: 0.02, decay: 0.15, sustain: 0.6, release: 0.7, peak: 0.28 }, muted });

    // t=4.2  soft major victory chord — warm, not eerie
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      tone(f, 0.9, { type: "sine", delay: 4.2 + i * 0.05, env: { attack: 0.04, decay: 0.15, sustain: 0.7, release: 0.5, peak: 0.16 }, muted }),
    );
  },

};

