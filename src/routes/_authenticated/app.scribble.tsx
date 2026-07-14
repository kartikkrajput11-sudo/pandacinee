import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Eraser, RotateCcw, Send, Sparkles, Trophy } from "lucide-react";
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
  "cherry", "diamond", "elephant", "fireworks", "guitar", "hammock", "island",
  "jellyfish", "kitten", "lighthouse", "mermaid", "notebook", "octopus", "pencil",
  "quilt", "robot", "snowflake", "tulip", "umbrella", "volcano", "waterfall",
  "xylophone", "yacht", "zebra", "airplane", "backpack", "campfire", "donut",
  "envelope", "feather", "gift", "hat", "igloo", "jacket", "key", "lamp",
  "mountain", "necklace", "owl", "popcorn", "quill", "ring", "star", "tent",
  "violin", "wave", "yarn", "sunset", "forest", "candle", "clock", "compass",
];

const ROUND_SECONDS = 90;
const COLORS = ["#1f1f1f", "#8b5cf6", "#ec4899", "#22c55e", "#f59e0b", "#0ea5e9"];

type Stroke = { by: string; color: string; size: number; erase: boolean; pts: { x: number; y: number }[] };
type Msg = { id: string; by: string; name: string; text: string; correct?: boolean };
type Phase = "idle" | "playing" | "over";

function pickWord(exclude: string | null) {
  const pool = exclude ? WORDS.filter((w) => w !== exclude) : WORDS;
  return pool[Math.floor(Math.random() * pool.length)];
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
  const [word, setWord] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [messages, setMessages] = useState<Msg[]>([]);
  const [guess, setGuess] = useState("");
  const [scores, setScores] = useState<Record<string, number>>({});
  const [hint, setHint] = useState<string | null>(null);

  const chRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const iAmDrawer = drawerId === me?.id;
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

  // Realtime channel
  useEffect(() => {
    if (!me) return;
    const key = partner ? [me.id, partner.id].sort().join(":") : me.id;
    const ch = supabase.channel(`scribble:${key}`, { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: "stroke" }, ({ payload }) => {
      strokes.current.push(payload as Stroke);
      redraw();
    });
    ch.on("broadcast", { event: "clear" }, () => {
      strokes.current = [];
      redraw();
    });
    ch.on("broadcast", { event: "round" }, ({ payload }) => {
      const p = payload as { drawerId: string; endsAt: number; wordLen: number };
      setDrawerId(p.drawerId);
      setEndsAt(p.endsAt);
      setPhase("playing");
      setHint(null);
      setMessages([]);
      strokes.current = [];
      redraw();
      // guesser doesn't know the word — only length
      if (p.drawerId !== me.id) setWord(null);
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
      setScores((s) => ({ ...s, [p.by]: (s[p.by] ?? 0) + 1 }));
      setPhase("over");
      setEndsAt(null);
    });
    ch.on("broadcast", { event: "hint" }, ({ payload }) => {
      setHint((payload as { hint: string }).hint);
    });
    ch.subscribe();
    chRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
      chRef.current = null;
    };
  }, [me?.id, partner?.id]);

  // Time out
  useEffect(() => {
    if (phase !== "playing" || !endsAt) return;
    if (now >= endsAt) {
      setPhase("over");
      setMessages((m) => [
        ...m,
        { id: crypto.randomUUID(), by: "sys", name: "System", text: `Time! The word was “${word ?? "?"}”` },
      ]);
    }
  }, [now, endsAt, phase, word]);

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
  }

  function startRound() {
    if (!me) return;
    // I become the drawer of the next round
    const newWord = pickWord(word);
    setWord(newWord);
    strokes.current = [];
    redraw();
    const ends = Date.now() + ROUND_SECONDS * 1000;
    setDrawerId(me.id);
    setEndsAt(ends);
    setPhase("playing");
    setHint(null);
    setMessages([]);
    chRef.current?.send({
      type: "broadcast",
      event: "round",
      payload: { drawerId: me.id, endsAt: ends, wordLen: newWord.length },
    });
    chRef.current?.send({ type: "broadcast", event: "clear", payload: {} });
  }

  function sendGuess() {
    if (!me || !guess.trim() || phase !== "playing" || iAmDrawer) return;
    const text = guess.trim();
    setGuess("");
    const isCorrect = word && text.toLowerCase() === word.toLowerCase();
    // Broadcast the raw guess to the drawer
    const msg: Msg = { id: crypto.randomUUID(), by: me.id, name: me.display_name ?? "You", text };
    setMessages((m) => [...m, msg]);
    chRef.current?.send({ type: "broadcast", event: "guess", payload: msg });
    if (isCorrect) {
      setScores((s) => ({ ...s, [me.id]: (s[me.id] ?? 0) + 1 }));
      setPhase("over");
      setEndsAt(null);
      chRef.current?.send({
        type: "broadcast",
        event: "correct",
        payload: { by: me.id, word, name: me.display_name ?? "Partner" },
      });
      toast.success("Correct! +1");
    }
  }

  function giveHint() {
    if (!word || !iAmDrawer) return;
    const revealed = word
      .split("")
      .map((ch, i) => (ch === " " || i === 0 || i === word.length - 1 ? ch : "•"))
      .join("");
    setHint(revealed);
    chRef.current?.send({ type: "broadcast", event: "hint", payload: { hint: revealed } });
  }

  const myScore = me ? scores[me.id] ?? 0 : 0;
  const theirScore = partner ? scores[partner.id] ?? 0 : 0;
  const wordDisplay = useMemo(() => {
    if (iAmDrawer) return word ?? "—";
    if (hint) return hint;
    if (phase === "playing" && endsAt) return "•".repeat(WORDS[0].length); // hidden
    return "—";
  }, [iAmDrawer, word, hint, phase, endsAt]);

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
              <>Guess: <span className="font-mono tracking-widest text-petal">{hint ?? "•".repeat((word ?? "").length || 5)}</span></>
            )
          ) : (
            <span className="text-candle-muted">Tap "New round" to start</span>
          )}
        </div>
        <div className="text-candle-muted tabular-nums">
          {phase === "playing" ? `${remaining}s` : phase === "over" ? "round over" : ""}
        </div>
      </div>

      <div className="rounded-3xl overflow-hidden border border-border bg-white h-[45vh] touch-none">
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
            onClick={giveHint}
            className="ml-auto rounded-full bg-surface border border-border px-3 py-1.5 text-xs flex items-center gap-1 text-candle"
          >
            <Sparkles className="size-3" /> Hint
          </button>
          <button
            onClick={() => { strokes.current = []; redraw(); chRef.current?.send({ type: "broadcast", event: "clear", payload: {} }); }}
            className="rounded-full bg-surface border border-border px-3 py-1.5 text-xs flex items-center gap-1 text-candle"
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
            onChange={(e) => setGuess(e.target.value)}
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
        <button
          onClick={startRound}
          className="w-full mt-4 rounded-full bg-petal text-white py-3 font-semibold shadow-petal hover:brightness-110 transition"
        >
          {phase === "over" ? "Rematch — I draw" : "Start round — I draw"}
        </button>
      )}
    </div>
  );
}
