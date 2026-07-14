// Web Audio synthesized ringtones — no assets required.

type RingHandle = { stop: () => void };

function startTone(pattern: "dial" | "ring"): RingHandle {
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  if (!AC) return { stop: () => {} };
  const ctx = new AC();
  const master = ctx.createGain();
  master.gain.value = pattern === "dial" ? 0.09 : 0.16;
  master.connect(ctx.destination);

  let stopped = false;
  let timers: number[] = [];

  const beep = (freq: number, dur: number, when: number, type: OscillatorType = "sine", peak = 0.9) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const t = ctx.currentTime + when;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.02);
    g.gain.exponentialRampToValueAtTime(peak * 0.7, t + Math.max(dur - 0.05, 0.05));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  };

  const cycle = () => {
    if (stopped) return;
    if (pattern === "dial") {
      // Outgoing: soft low European-style single pulse — one gentle "boop" every 2s
      beep(350, 0.9, 0, "sine", 0.6);
      beep(400, 0.9, 0, "sine", 0.5);
      timers.push(window.setTimeout(cycle, 2000));
    } else {
      // Incoming: bright classic double-bell ring — brrring-brrring, silence
      // First trill
      for (let i = 0; i < 6; i++) {
        beep(1400, 0.05, i * 0.08, "triangle", 0.9);
        beep(1100, 0.05, i * 0.08 + 0.04, "triangle", 0.8);
      }
      // Second trill after short gap
      for (let i = 0; i < 6; i++) {
        beep(1400, 0.05, 0.7 + i * 0.08, "triangle", 0.9);
        beep(1100, 0.05, 0.7 + i * 0.08 + 0.04, "triangle", 0.8);
      }
      timers.push(window.setTimeout(cycle, 2500));
    }
  };

  ctx.resume?.().catch(() => {});
  cycle();

  return {
    stop: () => {
      stopped = true;
      timers.forEach((id) => window.clearTimeout(id));
      timers = [];
      try {
        master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.05);
      } catch {
        /* noop */
      }
      window.setTimeout(() => {
        ctx.close().catch(() => {});
      }, 120);
    },
  };
}

export function playDialTone(): RingHandle {
  return startTone("dial");
}

export function playRingTone(): RingHandle {
  return startTone("ring");
}
