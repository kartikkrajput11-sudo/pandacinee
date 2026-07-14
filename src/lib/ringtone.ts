// Web Audio synthesized ringtones — no assets required.

type RingHandle = { stop: () => void };

function startTone(pattern: "dial" | "ring"): RingHandle {
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  if (!AC) return { stop: () => {} };
  const ctx = new AC();
  const master = ctx.createGain();
  master.gain.value = 0.15;
  master.connect(ctx.destination);

  let stopped = false;
  let timers: number[] = [];

  const beep = (freq: number, dur: number, when: number) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    // Soft envelope so it doesn't click
    const t = ctx.currentTime + when;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.9, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.6, t + dur - 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  };

  const cycle = () => {
    if (stopped) return;
    if (pattern === "dial") {
      // Classic dial tone: a beep-beep every ~3s (like an outgoing call)
      // Two overlapping tones to sound "phone-like"
      beep(440, 0.4, 0);
      beep(480, 0.4, 0);
      beep(440, 0.4, 0.6);
      beep(480, 0.4, 0.6);
      timers.push(window.setTimeout(cycle, 3000));
    } else {
      // Incoming ring: classic two-note bell, 1s on, 2s off
      beep(440, 0.5, 0);
      beep(480, 0.5, 0);
      beep(440, 0.5, 0.6);
      beep(480, 0.5, 0.6);
      timers.push(window.setTimeout(cycle, 3000));
    }
  };

  // Some browsers keep the context suspended until user interaction — try resume
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
