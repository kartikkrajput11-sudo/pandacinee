import { useEffect, useRef, useState } from "react";

/** Returns 0..1 speaking level from a MediaStream. */
export function useSpeakingLevel(stream: MediaStream | null) {
  const [level, setLevel] = useState(0);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    if (!stream || stream.getAudioTracks().length === 0) return;
    const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
    const ac = new AudioCtx();
    const source = ac.createMediaStreamSource(stream);
    const analyser = ac.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.8;
    source.connect(analyser);
    const buf = new Uint8Array(analyser.frequencyBinCount);

    function tick() {
      analyser.getByteFrequencyData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i];
      const avg = sum / buf.length / 255;
      setLevel(avg);
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      try { source.disconnect(); } catch { /* ignore */ }
      try { analyser.disconnect(); } catch { /* ignore */ }
      ac.close().catch(() => { /* ignore */ });
    };
  }, [stream]);
  return level;
}
