import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ImagePlus, RotateCw, Shuffle, Trophy, X } from "lucide-react";
import { toast } from "sonner";
import { gameSfx } from "@/lib/game-sfx";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useMatchOpponent } from "@/hooks/useMatchOpponent";
import { GroupPlayersBar } from "@/components/games/GroupPlayersBar";

export const Route = createFileRoute("/_authenticated/app/puzzle")({
  component: PuzzleTogether,
  validateSearch: (search: Record<string, unknown>) => ({
    matchId: typeof search.matchId === "string" ? search.matchId : undefined,
  }),
});

const DIFFICULTIES = [
  { pieces: 4, label: "Easy", grid: 2 },
  { pieces: 9, label: "Medium", grid: 3 },
  { pieces: 16, label: "Hard", grid: 4 },
  { pieces: 25, label: "Expert", grid: 5 },
] as const;

const DARE_SUGGESTIONS: string[] = [
  "Send a cute selfie 🤳",
  "Voice note singing our song 🎤",
  "Write me a mini love poem 💌",
  "Send our favorite memory in one sentence ✨",
  "Pick our next date night 🎬",
  "Cook (or order) my favorite meal 🍜",
  "Make me a playlist of 5 songs 🎧",
  "Do 10 push-ups 💪 & send proof",
  "Do the dishes tonight 🧼",
  "Give me a 5-min massage tomorrow 💆",
];

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
  const { matchId } = Route.useSearch();
  const { opponentId: matchOppId } = useMatchOpponent(matchId, me?.id);
  const partner = matchId
    ? (matchOppId ? { id: matchOppId, display_name: "Partner" } as { id: string; display_name?: string } : null)
    : data?.partner;


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
  const [bestTimes, setBestTimes] = useState<Record<number, number>>(() => {
    if (typeof window === "undefined") return {};
    try { return JSON.parse(window.localStorage.getItem("pandacine-puzzle-best") ?? "{}"); } catch { return {}; }
  });
  const [customImage, setCustomImage] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try { return window.localStorage.getItem("pandacine-puzzle-image"); } catch { return null; }
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeImageUrl = customImage ?? PUZZLE_URL;

  // Race state — puzzles are NOT synced; first to solve wins and can send a dare.
  type Outcome = null | "winner" | "loser";
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [partnerTime, setPartnerTime] = useState<number | null>(null);
  const [dareText, setDareText] = useState("");
  const [dareSent, setDareSent] = useState<string | null>(null);
  const [dareReceived, setDareReceived] = useState<string | null>(null);
  const [dareDone, setDareDone] = useState(false);

  const chRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const outcomeRef = useRef<Outcome>(null);
  useEffect(() => { outcomeRef.current = outcome; }, [outcome]);

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
      gameSfx.complete();
      const t = Math.floor((Date.now() - startedAt) / 1000);
      setBestTimes((prev) => {
        const cur = prev[total];
        if (!cur || t < cur) {
          const next = { ...prev, [total]: t };
          try { window.localStorage.setItem("pandacine-puzzle-best", JSON.stringify(next)); } catch {}
          toast.success("New best time! 🏆");
          return next;
        }
        toast.success("Solved! 🧩");
        return prev;
      });
      // Race: announce our finish time. If partner hasn't finished yet, we win.
      chRef.current?.send({
        type: "broadcast",
        event: "solved",
        payload: { by: me?.id, time: t, difficulty: total },
      });
      if (partner) {
        if (outcomeRef.current === null) {
          setOutcome("winner");
          toast.success("🏆 You finished first! Send them a dare 💌");
        }
      }
    }
  }, [slots, solved, startedAt, total, me?.id, partner]);

  // Realtime pair channel — race + dare only, no piece sync.
  useEffect(() => {
    if (!me) return;
    const key = matchId ?? (partner ? [me.id, partner.id].sort().join(":") : me.id);
    const ch = supabase.channel(`puzzle:${key}`, { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: "solved" }, ({ payload }) => {
      const p = payload as { by: string; time: number; difficulty: number };
      setPartnerTime(p.time);
      // If I haven't solved yet, partner won this round.
      if (outcomeRef.current === null) {
        setOutcome("loser");
        toast(`💐 Your partner finished in ${Math.floor(p.time / 60)}:${String(p.time % 60).padStart(2, "0")} — waiting for their dare…`);
      }
    });
    ch.on("broadcast", { event: "dare" }, ({ payload }) => {
      const p = payload as { text: string };
      setDareReceived(p.text);
      toast("💌 New dare from your partner!");
    });
    ch.on("broadcast", { event: "dare-done" }, () => {
      toast.success("✅ Your partner completed the dare!");
      setDareSent((prev) => prev); // keep displayed
      setDareDone(true);
    });
    ch.on("broadcast", { event: "rematch" }, () => {
      toast("🔄 Partner started a rematch");
      resetLocal();
    });
    ch.subscribe();
    chRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
      chRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id, partner?.id]);

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
    gameSfx.place();
  }

  function resetLocal() {
    const next = shuffled(total);
    setSlots(next);
    setSelected(null);
    setMoves(0);
    setSolved(false);
    setStartedAt(Date.now());
    setOutcome(null);
    setPartnerTime(null);
    setDareText("");
    setDareSent(null);
    setDareReceived(null);
    setDareDone(false);
  }

  function reshuffle() {
    resetLocal();
    chRef.current?.send({ type: "broadcast", event: "rematch", payload: {} });
  }

  function sendDare() {
    const text = dareText.trim();
    if (!text) return;
    chRef.current?.send({ type: "broadcast", event: "dare", payload: { text } });
    setDareSent(text);
    setDareText("");
    toast.success("Dare sent! 💌");
  }

  function markDareDone() {
    chRef.current?.send({ type: "broadcast", event: "dare-done", payload: {} });
    setDareDone(true);
    toast.success("Marked as done ✨");
  }


  async function onPickImage(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      toast.error("Image is too large (max 6 MB)");
      return;
    }
    // Downscale + crop to square via canvas so puzzle pieces stay uniform.
    const dataUrl: string = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const size = 720;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("no ctx"));
        const s = Math.min(img.width, img.height);
        const sx = (img.width - s) / 2;
        const sy = (img.height - s) / 2;
        ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
    setCustomImage(dataUrl);
    try { window.localStorage.setItem("pandacine-puzzle-image", dataUrl); } catch { /* quota */ }
    const next = shuffled(total);
    setSlots(next);
    setSelected(null);
    setMoves(0);
    setSolved(false);
    setStartedAt(Date.now());
    setOutcome(null);
    setPartnerTime(null);
    toast.success("Photo loaded — puzzle ready");
  }

  function clearCustomImage() {
    setCustomImage(null);
    try { window.localStorage.removeItem("pandacine-puzzle-image"); } catch { /* ignore */ }
    const next = shuffled(total);
    setSlots(next);
    setSelected(null);
    setMoves(0);
    setSolved(false);
    setStartedAt(Date.now());
    setOutcome(null);
    setPartnerTime(null);
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

      <div className="flex items-center gap-2 mb-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onPickImage(f);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="rounded-full border border-petal/40 bg-petal-soft text-candle px-3 py-1.5 text-xs flex items-center gap-1.5 hover:border-petal transition"
        >
          <ImagePlus className="size-3.5" />
          {customImage ? "Change photo" : "Use your photo"}
        </button>
        {customImage && (
          <button
            onClick={clearCustomImage}
            className="rounded-full border border-border bg-surface text-candle-muted px-2.5 py-1.5 text-xs flex items-center gap-1 hover:text-candle"
            aria-label="Remove photo"
          >
            <X className="size-3.5" />
          </button>
        )}
        {customImage && (
          <img
            src={customImage}
            alt="Puzzle preview"
            className="ml-auto size-10 rounded-lg object-cover border border-border"
          />
        )}
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
                backgroundImage: `url("${activeImageUrl}")`,
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
          {bestTimes[total] !== undefined && (
            <p className="text-xs text-petal mt-2">
              Best on {diff.label}: {Math.floor(bestTimes[total] / 60)}:{String(bestTimes[total] % 60).padStart(2, "0")}
            </p>
          )}
          <button
            onClick={async () => {
              const text = `I solved the Pandacine ${diff.label} puzzle in ${Math.floor(solvedTime / 60)}:${String(solvedTime % 60).padStart(2, "0")} · ${moves} moves 🧩`;
              try {
                if (navigator.share) await navigator.share({ text });
                else { await navigator.clipboard.writeText(text); toast.success("Copied to clipboard"); }
              } catch {}
            }}
            className="mt-4 rounded-full bg-petal text-white px-5 py-2 text-sm font-semibold"
          >
            Share result
          </button>
        </div>
      )}

      {/* Race outcome + dare flow (only with a partner) */}
      {partner && outcome === "winner" && (
        <div className="mt-4 rounded-3xl border border-petal/40 bg-petal-soft/60 p-5">
          <p className="text-[10px] uppercase tracking-widest text-petal">You won 🏆</p>
          <h3 className="font-serif italic text-xl text-candle mt-1">Send them a sweet dare</h3>
          <p className="text-xs text-candle-muted mt-1">
            Loser has to complete it. Keep it cute & couple-y 💕
          </p>
          {dareSent ? (
            <div className="mt-3">
              <p className="text-sm text-candle bg-white/60 rounded-2xl p-3 border border-petal/30">
                💌 "{dareSent}"
              </p>
              <p className="text-[11px] text-candle-muted mt-2">
                {dareDone ? "✅ They completed it!" : "Waiting for them to complete it…"}
              </p>
            </div>
          ) : (
            <>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {DARE_SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setDareText(s)}
                    className="rounded-full bg-white/60 border border-petal/30 px-2.5 py-1 text-[11px] text-candle hover:border-petal"
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  value={dareText}
                  onChange={(e) => setDareText(e.target.value)}
                  maxLength={140}
                  placeholder="Type a dare or pick one above…"
                  className="flex-1 rounded-full bg-white/70 border border-petal/30 px-4 py-2 text-sm text-candle focus:outline-none focus:border-petal"
                />
                <button
                  onClick={sendDare}
                  disabled={!dareText.trim()}
                  className="rounded-full bg-petal text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  Send
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {partner && outcome === "loser" && (
        <div className="mt-4 rounded-3xl border border-border bg-surface p-5 text-center">
          <p className="text-[10px] uppercase tracking-widest text-candle-muted">You lost this round 💫</p>
          {partnerTime !== null && (
            <p className="text-xs text-candle-muted mt-1">
              Partner finished in {Math.floor(partnerTime / 60)}:{String(partnerTime % 60).padStart(2, "0")}
            </p>
          )}
          {dareReceived ? (
            <div className="mt-3">
              <p className="font-serif italic text-lg text-candle">Your dare 💌</p>
              <p className="text-sm text-candle bg-petal-soft rounded-2xl p-3 border border-petal/30 mt-2">
                "{dareReceived}"
              </p>
              <button
                onClick={markDareDone}
                disabled={dareDone}
                className="mt-3 rounded-full bg-petal text-white px-5 py-2 text-sm font-semibold disabled:opacity-50"
              >
                {dareDone ? "✅ Marked done" : "I did it ✨"}
              </button>
            </div>
          ) : (
            <p className="text-xs text-candle-muted mt-2">Waiting for their dare…</p>
          )}
        </div>
      )}

      {bestTimes[total] !== undefined && !solved && (
        <p className="mt-4 text-[11px] text-candle-muted text-center">
          Best on {diff.label}: {Math.floor(bestTimes[total] / 60)}:{String(bestTimes[total] % 60).padStart(2, "0")}
        </p>
      )}


      {!partner && (
        <p className="mt-5 text-[11px] text-candle-muted text-center">
          Solo mode — pair with your partner to solve live together.
        </p>
      )}
    </div>
  );
}
