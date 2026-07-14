import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, RotateCw, Shuffle, Trophy } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";

export const Route = createFileRoute("/_authenticated/app/puzzle")({
  component: PuzzleTogether,
});

const DIFFICULTIES = [
  { pieces: 4, label: "Easy", grid: 2 },
  { pieces: 9, label: "Medium", grid: 3 },
  { pieces: 16, label: "Hard", grid: 4 },
  { pieces: 25, label: "Expert", grid: 5 },
] as const;

// A soft lavender / coral gradient with hearts — inline SVG so no network dep.
const PUZZLE_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400'>
  <defs>
    <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0' stop-color='%238b5cf6'/>
      <stop offset='0.5' stop-color='%23c4b5fd'/>
      <stop offset='1' stop-color='%23f9a8a8'/>
    </linearGradient>
    <radialGradient id='r' cx='50%' cy='40%' r='60%'>
      <stop offset='0' stop-color='%23ffffff' stop-opacity='0.6'/>
      <stop offset='1' stop-color='%23ffffff' stop-opacity='0'/>
    </radialGradient>
  </defs>
  <rect width='400' height='400' fill='url(%23g)'/>
  <rect width='400' height='400' fill='url(%23r)'/>
  <g fill='%23ffffff' fill-opacity='0.85'>
    <text x='200' y='170' text-anchor='middle' font-size='96' font-family='serif' font-style='italic'>panda</text>
    <text x='200' y='260' text-anchor='middle' font-size='72'>🐼 ❤️ 🎬</text>
    <text x='200' y='330' text-anchor='middle' font-size='28' font-family='serif' font-style='italic'>cine</text>
  </g>
</svg>`;
const PUZZLE_URL = `data:image/svg+xml;utf8,${PUZZLE_SVG.replace(/\n/g, "").replace(/#/g, "%23").replace(/"/g, "'")}`;

function shuffled(n: number) {
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  // Guarantee it's not already solved
  if (arr.every((v, i) => v === i)) [arr[0], arr[1]] = [arr[1], arr[0]];
  return arr;
}

function PuzzleTogether() {
  const { data } = useProfile();
  const me = data?.profile;
  const partner = data?.partner;

  const [diffIdx, setDiffIdx] = useState(1);
  const diff = DIFFICULTIES[diffIdx];
  const total = diff.pieces;
  const grid = diff.grid;

  // slots[i] = piece id currently in slot i
  const [slots, setSlots] = useState<number[]>(() => shuffled(total));
  const [selected, setSelected] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const [solved, setSolved] = useState(false);
  const [startedAt, setStartedAt] = useState<number>(() => Date.now());
  const [now, setNow] = useState(Date.now());

  const chRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const applyingRemote = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  // Reset when difficulty changes
  useEffect(() => {
    setSlots(shuffled(total));
    setSelected(null);
    setMoves(0);
    setSolved(false);
    setStartedAt(Date.now());
  }, [total]);

  useEffect(() => {
    if (slots.length && slots.every((v, i) => v === i) && !solved) {
      setSolved(true);
      toast.success("Solved! 🧩");
    }
  }, [slots, solved]);

  // Realtime pair channel
  useEffect(() => {
    if (!me) return;
    const key = partner ? [me.id, partner.id].sort().join(":") : me.id;
    const ch = supabase.channel(`puzzle:${key}`, { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: "state" }, ({ payload }) => {
      const p = payload as { slots: number[]; grid: number };
      if (p.slots.length !== slots.length) {
        // difficulty mismatch — snap to partner's difficulty
        const match = DIFFICULTIES.findIndex((d) => d.pieces === p.slots.length);
        if (match >= 0) setDiffIdx(match);
      }
      applyingRemote.current = true;
      setSlots(p.slots);
      setSelected(null);
      applyingRemote.current = false;
    });
    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        // announce our state on join so late joiner can adopt
        ch.send({ type: "broadcast", event: "state", payload: { slots, grid } });
      }
    });
    chRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
      chRef.current = null;
    };
    // Intentionally only bind to peer identity — we broadcast changes elsewhere.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id, partner?.id]);

  function broadcast(next: number[]) {
    chRef.current?.send({ type: "broadcast", event: "state", payload: { slots: next, grid } });
  }

  function tapSlot(i: number) {
    if (solved) return;
    if (selected === null) {
      setSelected(i);
      return;
    }
    if (selected === i) {
      setSelected(null);
      return;
    }
    const next = [...slots];
    [next[selected], next[i]] = [next[i], next[selected]];
    setSlots(next);
    setSelected(null);
    setMoves((m) => m + 1);
    broadcast(next);
  }

  function reshuffle() {
    const next = shuffled(total);
    setSlots(next);
    setSelected(null);
    setMoves(0);
    setSolved(false);
    setStartedAt(Date.now());
    broadcast(next);
  }

  const elapsed = Math.floor((solved ? 0 : now - startedAt) / 1000);
  const solvedTime = solved ? Math.floor((now - startedAt) / 1000) : 0;

  // Piece size in px — the board is a responsive square.
  const boardSize = "min(90vw, 480px)";
  const pieceSize = `calc(${boardSize} / ${grid})`;
  const backgroundSize = `calc(${pieceSize} * ${grid}) calc(${pieceSize} * ${grid})`;

  const pieces = useMemo(() => {
    const denom = Math.max(1, grid - 1);
    return slots.map((pieceId, slotIdx) => {
      const px = pieceId % grid;
      const py = Math.floor(pieceId / grid);
      const bx = `${(px / denom) * 100}%`;
      const by = `${(py / denom) * 100}%`;
      return { slotIdx, pieceId, bx, by, correct: pieceId === slotIdx };
    });
  }, [slots, grid]);
  }, [slots, grid]);

  return (
    <div className="pt-10 px-5 pb-10">
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Link to="/app/play" className="text-candle-muted">
            <ArrowLeft className="size-5" />
          </Link>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-petal">Multiplayer</p>
            <h1 className="font-serif text-2xl italic">Puzzle Together</h1>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-candle-muted">
          <span className="tabular-nums">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</span>
          <span>·</span>
          <span>{moves} moves</span>
        </div>
      </header>

      <div className="flex flex-wrap gap-2 mb-4">
        {DIFFICULTIES.map((d, i) => (
          <button
            key={d.pieces}
            onClick={() => setDiffIdx(i)}
            className={`rounded-full px-3 py-1.5 text-xs border transition ${
              diffIdx === i
                ? "border-petal bg-petal text-white"
                : "border-border bg-surface text-candle hover:border-petal/40"
            }`}
          >
            {d.label} · {d.pieces}
          </button>
        ))}
      </div>

      <div className="mx-auto" style={{ width: boardSize }}>
        <div
          className="grid rounded-2xl overflow-hidden border-2 border-border bg-surface shadow-petal"
          style={{
            gridTemplateColumns: `repeat(${grid}, 1fr)`,
            gridTemplateRows: `repeat(${grid}, 1fr)`,
          }}
        >
          {pieces.map((p) => (
            <button
              key={p.slotIdx}
              onClick={() => tapSlot(p.slotIdx)}
              className={`relative aspect-square transition-transform ${
                selected === p.slotIdx ? "ring-2 ring-petal z-10 scale-95" : ""
              } ${solved ? "ring-0" : ""}`}
              style={{
                backgroundImage: `url("${PUZZLE_URL}")`,
                backgroundSize,
                backgroundPosition: `${p.bx} ${p.by}`,
                outline: solved ? "none" : "1px solid rgba(255,255,255,0.05)",
              }}
              aria-label={`Slot ${p.slotIdx + 1}`}
            />
          ))}
        </div>
      </div>

      <div className="flex gap-2 mt-5">
        <button
          onClick={reshuffle}
          className="flex-1 rounded-full bg-surface border border-border py-2.5 text-sm text-candle flex items-center justify-center gap-2"
        >
          <Shuffle className="size-4" /> New puzzle
        </button>
        <button
          onClick={reshuffle}
          className="rounded-full bg-petal text-white px-4 py-2.5 text-sm flex items-center gap-2"
        >
          <RotateCw className="size-4" /> Rematch
        </button>
      </div>

      {solved && (
        <div className="mt-6 rounded-3xl border border-petal/30 bg-gradient-to-br from-petal-soft to-transparent p-6 text-center">
          <Trophy className="size-8 text-petal mx-auto mb-2" />
          <p className="font-serif italic text-2xl text-candle">Solved!</p>
          <p className="text-sm text-candle-muted mt-1">
            {Math.floor(solvedTime / 60)}:{String(solvedTime % 60).padStart(2, "0")} · {moves} moves
          </p>
        </div>
      )}

      {!partner && (
        <p className="mt-5 text-[11px] text-candle-muted text-center">
          Solo mode — pair with your partner to solve live together.
        </p>
      )}
    </div>
  );
}
