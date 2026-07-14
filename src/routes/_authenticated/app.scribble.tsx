import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Eraser, RotateCcw, Send, Sparkles, Trophy, Crown, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";

export const Route = createFileRoute("/_authenticated/app/scribble")({
  component: Scribble,
});

const WORDS = [
  "panda", "moon", "pizza", "guitar", "rocket", "sunflower", "castle", "ocean",
  "ice cream", "rainbow", "camera", "coffee", "book", "kite", "cactus", "cloud",
  "beach", "cupcake", "dragon", "unicorn", "bicycle", "balloon", "butterfly",
  "cherry", "diamond", "elephant", "fireworks", "hammock", "island",
  "jellyfish", "kitten", "lighthouse", "mermaid", "notebook", "octopus", "pencil",
  "quilt", "robot", "snowflake", "tulip", "umbrella", "volcano", "waterfall",
  "xylophone", "yacht", "zebra", "airplane", "backpack", "campfire", "donut",
  "envelope", "feather", "gift", "hat", "igloo", "jacket", "key", "lamp",
  "mountain", "necklace", "owl", "popcorn", "quill", "ring", "star", "tent",
  "violin", "wave", "yarn", "sunset", "forest", "candle", "clock", "compass",
];

const TIMER_CHOICES = [60, 90, 120] as const;
const TARGET_CHOICES = [3, 5, 7] as const;
const COLORS = ["#1f1f1f", "#8b5cf6", "#ec4899", "#22c55e", "#f59e0b", "#0ea5e9"];

type Stroke = { by: string; color: string; size: number; erase: boolean; pts: { x: number; y: number }[] };
type Msg = { id: string; by: string; name: string; text: string; correct?: boolean };
type Phase = "idle" | "choosing" | "playing" | "over";

function pick4(exclude: Set<string>) {
  const pool = WORDS.filter((w) => !exclude.has(w));
  const out: string[] = [];
  while (out.length < 4 && pool.length) {
    const i = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}

function maskWord(word: string, revealed: Set<number>) {
  return word
    .split("")
    .map((ch, i) => (ch === " " ? " " : revealed.has(i) ? ch : "•"))
    .join(" ");
}

function Scribble() {
  const { data } = useProfile();
  const me = data?.profile;
  const partner = data?.partner;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [color, setColor] = useState("#8b5cf6");
  const [size, setSize] = useState(6);
  const [erase, setErase] = useState(false);
  const strokes = useRef<Stroke[]>([]);
  const drawing = useRef<Stroke | null>(null);

  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [lastDrawerId, setLastDrawerId] = useState<string | null>(null);
  const [word, setWord] = useState<string | null>(null);
  const [wordLen, setWordLen] = useState<number>(0);
  const [choices, setChoices] = useState<string[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [roundSeconds, setRoundSeconds] = useState<number>(90);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [messages, setMessages] = useState<Msg[]>([]);
  const [guess, setGuess] = useState("");
  const [scores, setScores] = useState<Record<string, number>>({});
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [targetScore, setTargetScore] = useState<number>(5);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [hintMask, setHintMask] = useState<string>("");

  const chRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const wordRef = useRef<string | null>(null);
  const liveGuessThrottle = useRef<number>(0);
  const iAmDrawer = drawerId === me?.id;
  useEffect(() => { wordRef.current = word; }, [word]);

  const pairKey = me ? (partner ? [me.id, partner.id].sort().join(":") : me.id) : "";
  const storageKey = pairKey ? `scribble:${pairKey}` : "";

  // Persist round state + strokes so a refresh doesn't wipe an in-progress game.
  function persist() {
    if (!storageKey || typeof window === "undefined") return;
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          strokes: strokes.current,
          drawerId,
          lastDrawerId,
          word,
          wordLen,
          phase,
          roundSeconds,
          endsAt,
          hintMask,
          messages,
          scores,
          targetScore,
          winnerId,
          savedAt: Date.now(),
        }),
      );
    } catch { /* ignore quota */ }
  }
  // Save whenever meaningful state changes.
  useEffect(() => {
    persist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerId, lastDrawerId, word, wordLen, phase, roundSeconds, endsAt, hintMask, messages, scores, targetScore, winnerId, storageKey]);

  function onGuessChange(next: string) {
    setGuess(next);
    if (!me || iAmDrawer || phase !== "playing") return;
    const now = performance.now();
    if (now - liveGuessThrottle.current < 120) return;
    liveGuessThrottle.current = now;
    chRef.current?.send({
      type: "broadcast",
      event: "guess-live",
      payload: { by: me.id, name: me.display_name ?? "Partner", text: next },
    });
  }
  const remaining = endsAt ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : 0;

  function redraw() {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const s of strokes.current) draw(ctx, s);
    if (drawing.current) draw(ctx, drawing.current);
  }
  function draw(ctx: CanvasRenderingContext2D, s: Stroke) {
    ctx.beginPath();
    ctx.strokeStyle = s.erase ? "#ffffff" : s.color;
    ctx.lineWidth = s.size;
    ctx.globalCompositeOperation = s.erase ? "destination-out" : "source-over";
    const p = s.pts;
    if (p.length === 0) return;
    ctx.moveTo(p[0].x, p[0].y);
    for (let i = 1; i < p.length; i++) ctx.lineTo(p[i].x, p[i].y);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
  }

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const parent = c.parentElement!;
    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      const r = parent.getBoundingClientRect();
      c.width = Math.floor(r.width * dpr);
      c.height = Math.floor(r.height * dpr);
      c.style.width = r.width + "px";
      c.style.height = r.height + "px";
      c.getContext("2d")?.scale(dpr, dpr);
      redraw();
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  // Restore state from localStorage on mount / partner change.
  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (Array.isArray(s.strokes)) strokes.current = s.strokes;
      if (typeof s.drawerId === "string" || s.drawerId === null) setDrawerId(s.drawerId ?? null);
      if (typeof s.lastDrawerId === "string" || s.lastDrawerId === null) setLastDrawerId(s.lastDrawerId ?? null);
      // Only the drawer stored the word; partner side won't have it.
      if (typeof s.word === "string" && s.drawerId === me?.id) setWord(s.word);
      if (typeof s.wordLen === "number") setWordLen(s.wordLen);
      if (typeof s.phase === "string") {
        // If the timer already expired, downgrade to "over".
        if (s.phase === "playing" && typeof s.endsAt === "number" && s.endsAt < Date.now()) {
          setPhase("over");
        } else {
          setPhase(s.phase);
        }
      }
      if (typeof s.roundSeconds === "number") setRoundSeconds(s.roundSeconds);
      if (typeof s.endsAt === "number" || s.endsAt === null) setEndsAt(s.endsAt);
      if (typeof s.hintMask === "string") setHintMask(s.hintMask);
      if (Array.isArray(s.messages)) setMessages(s.messages);
      if (s.scores && typeof s.scores === "object") setScores(s.scores);
      if (typeof s.targetScore === "number") setTargetScore(s.targetScore);
      if (typeof s.winnerId === "string" || s.winnerId === null) setWinnerId(s.winnerId ?? null);
      redraw();
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Realtime channel
  useEffect(() => {
    if (!me) return;
    const key = partner ? [me.id, partner.id].sort().join(":") : me.id;
    const ch = supabase.channel(`scribble:${key}`, { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: "stroke" }, ({ payload }) => {
      strokes.current.push(payload as Stroke);
      redraw();
      persist();
    });
    ch.on("broadcast", { event: "clear" }, () => {
      strokes.current = [];
      redraw();
      persist();
    });
    ch.on("broadcast", { event: "round" }, ({ payload }) => {
      const p = payload as { drawerId: string; endsAt: number; wordLen: number; seconds: number; mask: string };
      setDrawerId(p.drawerId);
      setEndsAt(p.endsAt);
      setRoundSeconds(p.seconds);
      setWordLen(p.wordLen);
      setHintMask(p.mask);
      setPhase("playing");
      setRevealed(new Set());
      setMessages([]);
      strokes.current = [];
      redraw();
      if (p.drawerId !== me.id) setWord(null);
    });
    ch.on("broadcast", { event: "guess-live" }, ({ payload }) => {
      const p = payload as { by: string; name: string; text: string };
      const w = wordRef.current;
      // Only the drawer holds the word; drawer checks the match.
      if (!w) return;
      if (p.text.trim().toLowerCase() !== w.toLowerCase()) return;
      // Match — broadcast correct and update local state.
      chRef.current?.send({
        type: "broadcast",
        event: "correct",
        payload: { by: p.by, word: w, name: p.name },
      });
      setMessages((m) => [
        ...m,
        { id: crypto.randomUUID(), by: p.by, name: p.name, text: `guessed “${w}”`, correct: true },
      ]);
      setScores((s) => {
        const next = { ...s, [p.by]: (s[p.by] ?? 0) + 1 };
        if (next[p.by] >= targetScore) setWinnerId(p.by);
        return next;
      });
      setPhase("over");
      setLastDrawerId(drawerId);
      setEndsAt(null);
      toast.success(`${p.name} guessed “${w}”! Their turn to draw.`);
    });
    ch.on("broadcast", { event: "guess" }, ({ payload }) => {
      setMessages((m) => [...m, payload as Msg]);
    });
    ch.on("broadcast", { event: "correct" }, ({ payload }) => {
      const p = payload as { by: string; word: string; name: string };
      setMessages((m) => [
        ...m,
        { id: crypto.randomUUID(), by: p.by, name: p.name, text: `guessed “${p.word}”`, correct: true },
      ]);
      setScores((s) => {
        const next = { ...s, [p.by]: (s[p.by] ?? 0) + 1 };
        if (next[p.by] >= targetScore) setWinnerId(p.by);
        return next;
      });
      setPhase("over");
      setLastDrawerId((prev) => drawerId ?? prev);
      setEndsAt(null);
      // Reveal the word to the drawer's UI too
      setWord(p.word);
      setHintMask(p.word);
      if (p.by !== me.id) toast.success(`${p.name} guessed “${p.word}”! Their turn to draw.`);
      else {
        // I'm the winner (auto-detected by drawer) — auto-start next round.
        toast.success(`Correct! The word was “${p.word}” — your turn to draw!`);
        const targetNow = (scores[me.id] ?? 0) + 1;
        if (targetNow >= targetScore) return; // winner overlay handles it
        setTimeout(() => {
          const [next] = pick4(new Set([p.word]));
          if (next) confirmWord(next);
        }, 400);
      }
    });
    ch.on("broadcast", { event: "reveal" }, ({ payload }) => {
      const p = payload as { indices: number[]; mask: string };
      setRevealed(new Set(p.indices));
      if (p.mask) setHintMask(p.mask);
    });
    ch.subscribe();
    chRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
      chRef.current = null;
    };
  }, [me?.id, partner?.id, drawerId]);

  // Time out
  useEffect(() => {
    if (phase !== "playing" || !endsAt) return;
    if (now >= endsAt) {
      setPhase("over");
      setLastDrawerId(drawerId);
      setMessages((m) => [
        ...m,
        { id: crypto.randomUUID(), by: "sys", name: "System", text: `Time! The word was “${word ?? "?"}”` },
      ]);
    }
  }, [now, endsAt, phase, word, drawerId]);

  // Auto letter reveals — drawer broadcasts every ~ (roundSeconds/4) seconds
  useEffect(() => {
    if (phase !== "playing" || !iAmDrawer || !word || !endsAt) return;
    const step = Math.max(15, Math.floor(roundSeconds / 4));
    const tick = setInterval(() => {
      const timeLeft = Math.ceil((endsAt - Date.now()) / 1000);
      const elapsed = roundSeconds - timeLeft;
      const target = Math.min(Math.floor(word.replace(/ /g, "").length / 2), Math.floor(elapsed / step));
      setRevealed((cur) => {
        if (cur.size >= target) return cur;
        // pick a random hidden index (skip spaces)
        const hidden: number[] = [];
        for (let i = 0; i < word.length; i++) if (word[i] !== " " && !cur.has(i)) hidden.push(i);
        if (!hidden.length) return cur;
        const pickIdx = hidden[Math.floor(Math.random() * hidden.length)];
        const next = new Set(cur);
        next.add(pickIdx);
        const mask = word
          .split("")
          .map((ch, i) => (ch === " " ? " " : next.has(i) ? ch : "•"))
          .join("");
        chRef.current?.send({ type: "broadcast", event: "reveal", payload: { indices: [...next], mask } });
        return next;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [phase, iAmDrawer, word, endsAt, roundSeconds]);

  function pt(e: React.PointerEvent) {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function onDown(e: React.PointerEvent) {
    if (!iAmDrawer || phase !== "playing") return;
    (e.target as Element).setPointerCapture(e.pointerId);
    drawing.current = { by: me!.id, color, size, erase, pts: [pt(e)] };
    redraw();
  }
  function onMove(e: React.PointerEvent) {
    if (!drawing.current) return;
    drawing.current.pts.push(pt(e));
    redraw();
  }
  function onUp() {
    if (!drawing.current) return;
    const s = drawing.current;
    drawing.current = null;
    strokes.current.push(s);
    chRef.current?.send({ type: "broadcast", event: "stroke", payload: s });
    redraw();
    persist();
  }

  function openChoices() {
    if (!me) return;
    const [next] = pick4(new Set(word ? [word] : []));
    if (next) confirmWord(next);
  }

  function confirmWord(w: string) {
    if (!me) return;
    setWord(w);
    setWordLen(w.length);
    strokes.current = [];
    redraw();
    const ends = Date.now() + roundSeconds * 1000;
    setDrawerId(me.id);
    setEndsAt(ends);
    setPhase("playing");
    setRevealed(new Set());
    setMessages([]);
    const initialMask = w.split("").map((ch) => (ch === " " ? " " : "•")).join("");
    setHintMask(initialMask);
    chRef.current?.send({
      type: "broadcast",
      event: "round",
      payload: { drawerId: me.id, endsAt: ends, wordLen: w.length, seconds: roundSeconds, mask: initialMask },
    });
    chRef.current?.send({ type: "broadcast", event: "clear", payload: {} });
  }

  function sendGuess() {
    if (!me || !guess.trim() || phase !== "playing" || iAmDrawer) return;
    const text = guess.trim();
    setGuess("");
    const isCorrect = word && text.toLowerCase() === word.toLowerCase();
    const msg: Msg = { id: crypto.randomUUID(), by: me.id, name: me.display_name ?? "You", text };
    setMessages((m) => [...m, msg]);
    chRef.current?.send({ type: "broadcast", event: "guess", payload: msg });
    if (isCorrect) {
      const myNewScore = (scores[me.id] ?? 0) + 1;
      setScores((s) => ({ ...s, [me.id]: (s[me.id] ?? 0) + 1 }));
      setPhase("over");
      setLastDrawerId(drawerId);
      setEndsAt(null);
      chRef.current?.send({
        type: "broadcast",
        event: "correct",
        payload: { by: me.id, word, name: me.display_name ?? "Partner" },
      });
      toast.success(`Correct! The word was “${word}” — your turn to draw!`);
      if (myNewScore >= targetScore) {
        setWinnerId(me.id);
        return;
      }
      // Auto-start next round for the new drawer (me, the correct guesser)
      setTimeout(() => {
        const [next] = pick4(new Set(word ? [word] : []));
        if (next) confirmWord(next);
      }, 1400);
    } else {
      toast.error("Not quite — keep guessing!");
    }
  }

  const myScore = me ? scores[me.id] ?? 0 : 0;
  const theirScore = partner ? scores[partner.id] ?? 0 : 0;

  const hintDisplay = useMemo(() => {
    if (!wordLen) return "";
    // Drawer sees the full word; guesser sees the shared mask (letters revealed as the drawer ticks).
    const source = (iAmDrawer && word ? word : hintMask) || "•".repeat(wordLen);
    return source
      .split("")
      .map((ch) => (ch === " " ? "  " : ch))
      .join(" ");
  }, [iAmDrawer, word, wordLen, hintMask]);

  // My turn to start (swap roles): if there is a lastDrawer and it's me, wait for partner.
  const myTurnToStart = !partner || lastDrawerId !== me?.id;

  return (
    <div className="pt-10 px-4 pb-4">
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Link to="/app/play" className="text-candle-muted">
            <ArrowLeft className="size-5" />
          </Link>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-petal">Multiplayer</p>
            <h1 className="font-serif text-2xl italic">Scribble & Guess</h1>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Trophy className="size-4 text-petal" />
          <span className="text-candle">{myScore}</span>
          <span className="text-candle-muted">·</span>
          <span className="text-candle-muted">{theirScore}</span>
        </div>
      </header>

      {!partner && (
        <div className="p-4 mb-3 rounded-2xl border border-petal/30 bg-petal-soft text-sm text-candle">
          Solo mode — invite your partner for the real thing.
        </div>
      )}

      <div className="flex items-center justify-between mb-2 text-sm">
        <div className="text-candle">
          {phase === "playing" ? (
            iAmDrawer ? (
              <>Draw: <span className="font-semibold text-petal">{word}</span></>
            ) : (
              <>Guess: <span className="font-mono tracking-widest text-petal text-xs">{hintDisplay}</span></>
            )
          ) : phase === "choosing" ? (
            <span className="text-candle-muted">Pick a word to draw…</span>
          ) : (
            <span className="text-candle-muted">
              {myTurnToStart ? "Your turn to draw" : "Partner's turn to draw"}
            </span>
          )}
        </div>
        <div className="text-candle-muted tabular-nums">
          {phase === "playing" ? `${remaining}s` : phase === "over" ? "round over" : ""}
        </div>
      </div>

      <div className="rounded-3xl overflow-hidden border border-border bg-white h-[42vh] touch-none">
        <canvas
          ref={canvasRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          className="w-full h-full cursor-crosshair"
        />
      </div>

      {iAmDrawer && phase === "playing" && (
        <div className="mt-3 flex gap-2 flex-wrap items-center">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => { setColor(c); setErase(false); }}
              className={`size-7 rounded-full border-2 ${color === c && !erase ? "border-petal scale-110" : "border-border"}`}
              style={{ background: c }}
            />
          ))}
          <button
            onClick={() => setErase((e) => !e)}
            className={`size-7 rounded-full border-2 flex items-center justify-center ${erase ? "border-petal bg-petal-soft" : "border-border bg-surface"}`}
          >
            <Eraser className="size-3.5" />
          </button>
          {[3, 6, 12].map((n) => (
            <button
              key={n}
              onClick={() => setSize(n)}
              className={`size-7 rounded-full flex items-center justify-center border ${size === n ? "border-petal" : "border-border"}`}
            >
              <span className="rounded-full bg-candle" style={{ width: n, height: n }} />
            </button>
          ))}
          <button
            onClick={() => { strokes.current = []; redraw(); chRef.current?.send({ type: "broadcast", event: "clear", payload: {} }); persist(); }}
            className="ml-auto rounded-full bg-surface border border-border px-3 py-1.5 text-xs flex items-center gap-1 text-candle"
          >
            <RotateCcw className="size-3" /> Clear
          </button>
        </div>
      )}

      <div className="mt-4 rounded-2xl border border-border bg-surface p-3 max-h-40 overflow-y-auto space-y-1.5">
        {messages.length === 0 ? (
          <p className="text-xs text-candle-muted text-center py-2">Guesses appear here</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`text-sm ${m.correct ? "text-petal font-semibold" : "text-candle"}`}>
              <span className="text-candle-muted mr-2">{m.name}:</span>{m.text}
              {m.correct && " ✨"}
            </div>
          ))
        )}
      </div>

      {phase === "playing" && !iAmDrawer && (
        <div className="mt-3 flex gap-2">
          <input
            value={guess}
            onChange={(e) => onGuessChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendGuess()}
            placeholder="Type your guess…"
            className="flex-1 rounded-full bg-surface border border-border px-4 py-2.5 text-sm text-candle focus:outline-none focus:border-petal/50"
          />
          <button
            onClick={sendGuess}
            className="rounded-full bg-petal text-white px-4 py-2.5 text-sm flex items-center gap-2"
          >
            <Send className="size-4" />
          </button>
        </div>
      )}


      {(phase === "idle" || phase === "over") && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] uppercase tracking-widest text-petal">Round timer</span>
            <div className="flex gap-1 p-1 rounded-full bg-surface border border-border">
              {TIMER_CHOICES.map((t) => (
                <button
                  key={t}
                  onClick={() => setRoundSeconds(t)}
                  className={`px-3 py-1 rounded-full text-xs transition ${roundSeconds === t ? "bg-petal text-white" : "text-candle-muted"}`}
                >
                  {t}s
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] uppercase tracking-widest text-petal">Win at</span>
            <div className="flex gap-1 p-1 rounded-full bg-surface border border-border">
              {TARGET_CHOICES.map((t) => (
                <button
                  key={t}
                  onClick={() => setTargetScore(t)}
                  className={`px-3 py-1 rounded-full text-xs transition ${targetScore === t ? "bg-petal text-white" : "text-candle-muted"}`}
                >
                  {t} pts
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={openChoices}
            disabled={!myTurnToStart}
            className="w-full rounded-full bg-petal text-white py-3 font-semibold shadow-petal hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Sparkles className="size-4" />
            {phase === "over"
              ? myTurnToStart
                ? "Your turn — start drawing"
                : "Waiting for partner…"
              : "Start round"}
          </button>
        </div>
      )}

      {winnerId && (
        <WinnerOverlay
          isMe={winnerId === me?.id}
          winnerName={
            winnerId === me?.id
              ? me?.display_name ?? "You"
              : partner?.display_name ?? "Partner"
          }
          myScore={myScore}
          theirScore={theirScore}
          onClose={() => {
            setWinnerId(null);
            setScores({});
            setPhase("idle");
            setLastDrawerId(null);
            setWord(null);
            setWordLen(0);
            setEndsAt(null);
            setMessages([]);
            strokes.current = [];
            redraw();
          }}
        />
      )}
    </div>
  );
}

function WinnerOverlay({
  isMe,
  winnerName,
  myScore,
  theirScore,
  onClose,
}: {
  isMe: boolean;
  winnerName: string;
  myScore: number;
  theirScore: number;
  onClose: () => void;
}) {
  const confetti = Array.from({ length: 60 }, (_, i) => i);
  const palette = ["#ec4899", "#8b5cf6", "#f59e0b", "#22c55e", "#0ea5e9", "#ffffff"];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-hidden animate-fade-in">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 20% 20%, rgba(236,72,153,0.55), transparent 55%), radial-gradient(circle at 80% 30%, rgba(139,92,246,0.55), transparent 55%), radial-gradient(circle at 50% 90%, rgba(245,158,11,0.5), transparent 55%), #0b0616",
        }}
      />
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {confetti.map((i) => {
          const left = (i * 37) % 100;
          const delay = (i % 12) * 0.15;
          const dur = 2.4 + ((i * 13) % 20) / 10;
          const color = palette[i % palette.length];
          const size = 6 + (i % 5) * 2;
          return (
            <span
              key={i}
              className="absolute top-[-10%] rounded-sm"
              style={{
                left: `${left}%`,
                width: size,
                height: size * 0.4,
                background: color,
                transform: `rotate(${(i * 47) % 360}deg)`,
                animation: `scribble-confetti ${dur}s linear ${delay}s infinite`,
                opacity: 0.9,
              }}
            />
          );
        })}
      </div>
      <style>{`
        @keyframes scribble-confetti {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 0; }
          10% { opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0.8; }
        }
        @keyframes scribble-winner-pop {
          0% { transform: scale(0.6) rotate(-4deg); opacity: 0; }
          60% { transform: scale(1.04) rotate(1deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
      `}</style>

      <div
        className="relative w-full max-w-md rounded-3xl p-6 bg-gradient-to-b from-white/95 to-white/85 backdrop-blur-xl border-4 shadow-2xl text-center"
        style={{
          animation: "scribble-winner-pop 0.7s cubic-bezier(.2,1.2,.3,1) both",
          borderColor: "#8b5cf6",
          boxShadow: "0 20px 60px rgba(139,92,246,0.5), 0 0 0 6px rgba(139,92,246,0.2)",
        }}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 size-8 rounded-full bg-black/10 hover:bg-black/20 flex items-center justify-center text-candle"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>
        <Crown className="mx-auto size-10 text-amber-500 mb-1" />
        <p className="text-[10px] uppercase tracking-[0.3em] text-petal">Winner</p>
        <h2 className="font-serif text-3xl italic mt-1" style={{ color: "#8b5cf6" }}>
          {isMe ? "You win! 🎉" : `${winnerName} wins`}
        </h2>
        <p className="text-xs text-candle-muted mt-2">
          {isMe ? "The crown is yours, artist ✨" : "Great guessing — rematch?"}
        </p>
        <div className="mt-4 flex items-center justify-center gap-6 text-candle">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-candle-muted">You</p>
            <p className="font-serif text-2xl">{myScore}</p>
          </div>
          <span className="text-candle-muted">·</span>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-candle-muted">Partner</p>
            <p className="font-serif text-2xl">{theirScore}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="mt-5 w-full rounded-full py-3 text-sm font-medium text-white flex items-center justify-center gap-2 shadow-lg"
          style={{ background: "linear-gradient(135deg,#ec4899,#8b5cf6)" }}
        >
          <Sparkles className="size-4" /> Play again
        </button>
      </div>
    </div>
  );
}
