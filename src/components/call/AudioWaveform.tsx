import { useEffect, useRef } from "react";

type Props = {
  stream: MediaStream | null;
  color?: string;
  bars?: number;
  height?: number;
  className?: string;
  mirror?: boolean;
};

/**
 * Real-time audio waveform: reads an AudioContext AnalyserNode from a
 * MediaStream and renders animated bars responding to volume/frequency.
 */
export function AudioWaveform({
  stream,
  color = "var(--petal)",
  bars = 32,
  height = 64,
  className = "",
  mirror = true,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!stream || stream.getAudioTracks().length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
    const ac = new AudioCtx();
    const source = ac.createMediaStreamSource(stream);
    const analyser = ac.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.75;
    source.connect(analyser);

    const buffer = new Uint8Array(analyser.frequencyBinCount);
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      canvas!.width = rect.width * dpr;
      canvas!.height = rect.height * dpr;
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Resolve CSS var -> actual color
    const probe = document.createElement("div");
    probe.style.color = color;
    document.body.appendChild(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();

    function draw() {
      analyser.getByteFrequencyData(buffer);
      const w = canvas!.width;
      const h = canvas!.height;
      ctx.clearRect(0, 0, w, h);

      const step = Math.floor(buffer.length / bars);
      const barW = w / bars;
      const gap = barW * 0.35;

      for (let i = 0; i < bars; i++) {
        // Pick strongest val in this bucket, smoothed with envelope
        let v = 0;
        for (let j = 0; j < step; j++) v = Math.max(v, buffer[i * step + j]);
        // Envelope curve — quieter edges, louder center
        const envelope = mirror ? 0.55 + 0.45 * Math.sin((i / (bars - 1)) * Math.PI) : 1;
        const norm = (v / 255) * envelope;
        const barH = Math.max(2 * dpr, norm * h * 0.95);
        const x = i * barW + gap / 2;
        const y = (h - barH) / 2;
        ctx.fillStyle = resolved;
        const radius = barW * 0.35;
        roundedRect(ctx, x, y, barW - gap, barH, radius);
        ctx.fill();
      }
      rafRef.current = requestAnimationFrame(draw);
    }
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      try { source.disconnect(); } catch { /* ignore */ }
      try { analyser.disconnect(); } catch { /* ignore */ }
      ac.close().catch(() => { /* ignore */ });
    };
  }, [stream, bars, color, mirror]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: "100%", height, display: "block" }}
      aria-hidden
    />
  );
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
  ctx.fill();
}
