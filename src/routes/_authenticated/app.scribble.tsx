import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Eraser, RotateCcw, Send, Sparkles, Trophy, Crown, X } from "lucide-react";
import { toast } from "sonner";
import { gameSfx } from "@/lib/game-sfx";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useMatchOpponent } from "@/hooks/useMatchOpponent";
import { AvatarImg } from "@/components/AvatarImg";

export const Route = createFileRoute("/_authenticated/app/scribble")({
  component: Scribble,
  validateSearch: (search: Record<string, unknown>) => ({
    matchId: typeof search.matchId === "string" ? search.matchId : undefined,
  }),
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
const COLORS = [
  "#1f1f1f", // ink
  "#ffffff", // white
  "#6b7280", // gray
  "#ef4444", // red
  "#f97316", // orange
  "#f59e0b", // amber
  "#eab308", // yellow
  "#84cc16", // lime
  "#22c55e", // green
  "#14b8a6", // teal
  "#06b6d4", // cyan
  "#0ea5e9", // sky
  "#3b82f6", // blue
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#a855f7", // purple
  "#ec4899", // pink
  "#f43f5e", // rose
  "#92400e", // brown
  "#f5deb3", // wheat / skin
];

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

function normalizeGuessText(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "") // strip punctuation
    .trim()
    .replace(/\s+/g, " ");
}

// Case-insensitive, punctuation-insensitive, allow common singular/plural swap.
function guessesMatch(guess: string, secret: string) {
  const g = normalizeGuessText(guess);
  const s = normalizeGuessText(secret);
  if (!g || !s) return false;
  if (g === s) return true;
  // singular/plural: apple <-> apples, berry <-> berries
  const variants = (w: string) => {
    const out = new Set<string>([w]);
    if (w.endsWith("s")) out.add(w.slice(0, -1));
    else out.add(w + "s");
    if (w.endsWith("ies")) out.add(w.slice(0, -3) + "y");
    if (w.endsWith("y")) out.add(w.slice(0, -1) + "ies");
    if (w.endsWith("es")) out.add(w.slice(0, -2));
    return out;
  };
  return variants(g).has(s) || variants(s).has(g);
}

function Scribble() {
  const { data } = useProfile();
  const me = data?.profile;
  const { matchId } = Route.useSearch();
  const { opponentId: matchOppId } = useMatchOpponent(matchId, me?.id);
  const partner = matchId
    ? (matchOppId ? { id: matchOppId, display_name: "Partner" } as { id: string; display_name?: string } : null)
    : data?.partner;


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

  // Persistent leaderboard stats (all-time)
  type Stats = { user_id: string; wins: number; correct_guesses: number; games_played: number; rounds_drawn: number };
  const [leaderboard, setLeaderboard] = useState<Record<string, Stats>>({});
  const winnerCountedRef = useRef<string | null>(null);
  async function bumpMyStats(delta: Partial<Omit<Stats, "user_id">>) {
    if (!me) return;
    // Read current, then upsert incremented values. Small races don't matter for a personal leaderboard.
    const { data: cur } = await supabase
      .from("scribble_stats")
      .select("wins, correct_guesses, games_played, rounds_drawn")
      .eq("user_id", me.id)
      .maybeSingle();
    const next = {
      user_id: me.id,
      wins: (cur?.wins ?? 0) + (delta.wins ?? 0),
      correct_guesses: (cur?.correct_guesses ?? 0) + (delta.correct_guesses ?? 0),
      games_played: (cur?.games_played ?? 0) + (delta.games_played ?? 0),
      rounds_drawn: (cur?.rounds_drawn ?? 0) + (delta.rounds_drawn ?? 0),
    };
    const { error } = await supabase.from("scribble_stats").upsert(next, { onConflict: "user_id" });
    if (!error) setLeaderboard((s) => ({ ...s, [me.id]: next }));
  }

  // Load leaderboard for me + partner
  useEffect(() => {
    if (!me) return;
    const ids = partner ? [me.id, partner.id] : [me.id];
    supabase
      .from("scribble_stats")
      .select("user_id, wins, correct_guesses, games_played, rounds_drawn")
      .in("user_id", ids)
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, Stats> = {};
        for (const r of data as Stats[]) map[r.user_id] = r;
        setLeaderboard(map);
      });
  }, [me?.id, partner?.id]);

  const chRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const wordRef = useRef<string | null>(null);
  const drawerIdRef = useRef<string | null>(null);
  const targetScoreRef = useRef(targetScore);
  const scoresRef = useRef<Record<string, number>>({});
  const roundResolvedRef = useRef(false);
  const endsAtRef = useRef<number | null>(null);
  const roundSecondsRef = useRef<number>(90);
  const revealedRef = useRef<Set<number>>(new Set());
  const iAmDrawer = drawerId === me?.id;
  useEffect(() => { wordRef.current = word; }, [word]);
  useEffect(() => { drawerIdRef.current = drawerId; }, [drawerId]);
  useEffect(() => { targetScoreRef.current = targetScore; }, [targetScore]);
  useEffect(() => { scoresRef.current = scores; }, [scores]);
  useEffect(() => { endsAtRef.current = endsAt; }, [endsAt]);
  useEffect(() => { roundSecondsRef.current = roundSeconds; }, [roundSeconds]);
  useEffect(() => { revealedRef.current = revealed; }, [revealed]);

  // Persistent leaderboard: when a winner is decided, record games_played (+1)
  // and wins (+1 if that winner is me). Guard so we count once per game.
  useEffect(() => {
    if (!me || !winnerId) return;
    if (winnerCountedRef.current === winnerId) return;
    winnerCountedRef.current = winnerId;
    void bumpMyStats({ games_played: 1, wins: winnerId === me.id ? 1 : 0 });
    if (winnerId === me.id) gameSfx.win(); else gameSfx.lose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winnerId, me?.id]);

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
    if (tryMatch(me.id, me.display_name ?? "You", next, true)) return;
    // Send every keystroke so the drawer can detect a correct guess instantly.
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
      if (typeof s.word === "string") {
        wordRef.current = s.word;
        setWord(s.word);
      }
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

  function markCorrect(by: string, name: string, matchedWord: string, broadcast: boolean) {
    if (roundResolvedRef.current) return false;
    roundResolvedRef.current = true;
    wordRef.current = matchedWord;
    if (broadcast) {
      chRef.current?.send({
        type: "broadcast",
        event: "correct",
        payload: { by, word: matchedWord, name },
      });
    }
    const isMe = by === me?.id;
    if (isMe) gameSfx.correct(); else gameSfx.reveal();
    setMessages((m) => [
      ...m,
      {
        id: crypto.randomUUID(),
        by,
        name,
        text: isMe ? "✅ You guessed the word!" : `🎉 ${name} guessed the word!`,
        correct: true,
      },
    ]);
    setScores((s) => {
      const next = { ...s, [by]: (s[by] ?? 0) + 1 };
      if (next[by] >= targetScoreRef.current) setWinnerId(by);
      return next;
    });
    // Persistent leaderboard: bump my correct_guesses when I'm the one who guessed.
    if (isMe) void bumpMyStats({ correct_guesses: 1 });
    setPhase("over");
    setLastDrawerId(drawerIdRef.current);
    setEndsAt(null);
    setWord(matchedWord);
    setHintMask(matchedWord);
    setRevealed(new Set(matchedWord.split("").map((_, i) => i)));
    setGuess("");
    if (isMe) {
      toast.success(`Correct! The word was "${matchedWord}" — your turn to draw!`);
      autoStartMyDrawTurn(matchedWord);
    } else {
      toast.success(`${name} guessed "${matchedWord}"! Their turn to draw.`);
    }
    return true;
  }

  function tryMatch(by: string, name: string, text: string, broadcast = true) {
    const w = wordRef.current;
    if (!w || roundResolvedRef.current) return false;
    if (!guessesMatch(text, w)) return false;
    return markCorrect(by, name, w, broadcast);
  }

  function autoStartMyDrawTurn(previousWord: string) {
    if (!me) return;
    const targetNow = (scoresRef.current[me.id] ?? 0) + 1;
    if (targetNow >= targetScoreRef.current) return;
    window.setTimeout(() => {
      const [next] = pick4(new Set([previousWord]));
      if (next) confirmWord(next);
    }, 400);
  }

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
      const p = payload as { drawerId: string; endsAt: number; wordLen: number; seconds: number; mask: string; word?: string };
      roundResolvedRef.current = false;
      drawerIdRef.current = p.drawerId;
      wordRef.current = p.word ?? null;
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
      setWord(p.word ?? null);
    });
    ch.on("broadcast", { event: "guess-live" }, ({ payload }) => {
      const p = payload as { by: string; name: string; text: string };
      // Debug: only the drawer holds the secret word here.
      // eslint-disable-next-line no-console
      console.log("[scribble] drawer received guess-live", {
        rawGuess: p.text,
        normalizedGuess: normalizeGuessText(p.text),
        secretWord: wordRef.current,
        normalizedSecret: wordRef.current ? normalizeGuessText(wordRef.current) : null,
        playerId: p.by,
      });
      tryMatch(p.by, p.name, p.text);
    });
    ch.on("broadcast", { event: "guess" }, ({ payload }) => {
      const p = payload as Msg;
      setMessages((m) => [...m, p]);
      tryMatch(p.by, p.name, p.text);
    });

    ch.on("broadcast", { event: "correct" }, ({ payload }) => {
      const p = payload as { by: string; word: string; name: string };
      markCorrect(p.by, p.name, p.word, false);
    });
    ch.on("broadcast", { event: "reveal" }, ({ payload }) => {
      const p = payload as { indices: number[]; mask: string };
      setRevealed(new Set(p.indices));
      if (p.mask) setHintMask(p.mask);
    });
    ch.on("broadcast", { event: "timeout" }, ({ payload }) => {
      if (roundResolvedRef.current) return;
      const p = payload as { word: string };
      resolveTimeout(p.word);
    });
    // Handshake: newly-joined guesser asks for the current round state.
    ch.on("broadcast", { event: "sync-request" }, () => {
      // Only the active drawer answers, and only during a live round.
      if (drawerIdRef.current !== me.id) return;
      const w = wordRef.current;
      const ends = endsAtRef.current;
      if (!w || !ends) return;
      const rev = revealedRef.current;
      const mask = w.split("").map((ch2, i) => (ch2 === " " ? " " : rev.has(i) ? ch2 : "•")).join("");
      chRef.current?.send({
        type: "broadcast",
        event: "round",
        payload: { drawerId: me.id, endsAt: ends, wordLen: w.length, seconds: roundSecondsRef.current, mask, word: w },
      });
    });

    ch.subscribe((status) => {
      if (status !== "SUBSCRIBED") return;
      // Request current state in case a round is already in progress.
      ch.send({ type: "broadcast", event: "sync-request", payload: {} });
      // If I'm the drawer of an active round, proactively push round state
      // to any peer that just came online.
      if (drawerIdRef.current === me.id && wordRef.current && endsAtRef.current) {
        const w = wordRef.current;
        const rev = revealedRef.current;
        const mask = w.split("").map((ch2, i) => (ch2 === " " ? " " : rev.has(i) ? ch2 : "•")).join("");
        ch.send({
          type: "broadcast",
          event: "round",
          payload: { drawerId: me.id, endsAt: endsAtRef.current, wordLen: w.length, seconds: roundSecondsRef.current, mask, word: w },
        });
      }
    });
    chRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
      chRef.current = null;
    };
  }, [me?.id, partner?.id]);

  // Guesser retry: if we think a round is playing but have no secret word,
  // keep asking the drawer to resend the round state.
  useEffect(() => {
    if (iAmDrawer || phase !== "playing" || word) return;
    const send = () => {
      // eslint-disable-next-line no-console
      console.log("[scribble] guesser requesting round sync (no secret word yet)");
      chRef.current?.send({ type: "broadcast", event: "sync-request", payload: {} });
    };
    send();
    const t = window.setInterval(send, 1500);
    return () => window.clearInterval(t);
  }, [iAmDrawer, phase, word]);

  function resolveTimeout(w: string) {
    if (roundResolvedRef.current) return;
    roundResolvedRef.current = true;
    wordRef.current = w;
    setWord(w);
    setHintMask(w);
    setRevealed(new Set(w.split("").map((_, i) => i)));
    setPhase("over");
    setLastDrawerId(drawerIdRef.current);
    setEndsAt(null);
    setMessages((m) => [
      ...m,
      { id: crypto.randomUUID(), by: "sys", name: "System", text: `⏰ Time's up! The word was: ${w.toUpperCase()}` },
    ]);
    toast(`⏰ Time's up! The word was: ${w.toUpperCase()}`);
  }

  // Time out
  useEffect(() => {
    if (phase !== "playing" || !endsAt) return;
    if (now >= endsAt) {
      if (roundResolvedRef.current) return;
      // Only the drawer knows the word — broadcast it so the guesser sees it too.
      if (iAmDrawer && word) {
        chRef.current?.send({
          type: "broadcast",
          event: "timeout",
          payload: { word },
        });
        resolveTimeout(word);
      }
      // Guesser side: wait for the "timeout" broadcast which carries the word.
    }
  }, [now, endsAt, phase, word, iAmDrawer]);


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
    void bumpMyStats({ rounds_drawn: 1 });
    roundResolvedRef.current = false;
    wordRef.current = w;
    drawerIdRef.current = me.id;
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
      payload: { drawerId: me.id, endsAt: ends, wordLen: w.length, seconds: roundSeconds, mask: initialMask, word: w },
    });
    chRef.current?.send({ type: "broadcast", event: "clear", payload: {} });
  }

  function sendGuess() {
    if (!me || !guess.trim() || phase !== "playing" || iAmDrawer) return;
    const text = guess.trim();
    setGuess("");
    const name = me.display_name ?? "You";
    const secret = wordRef.current;
    // Debug — helps diagnose validation issues in the console.
    // eslint-disable-next-line no-console
    console.log("[scribble] guess submitted", {
      received: text,
      currentSecretWord: secret,
      playerId: me.id,
      drawerId: drawerIdRef.current,
      match: secret ? guessesMatch(text, secret) : "no-word-yet",
    });
    if (tryMatch(me.id, name, text, true)) return;
    // The guesser may not hold the secret word yet (joined mid-round, or the
    // "round" broadcast lost the race with this submit). The drawer is
    // authoritative, so publish the guess and wait briefly for its verdict
    // before declaring it wrong — otherwise a correct guess flashes "wrong"
    // for a split second before flipping to "correct".
    const msg: Msg = { id: crypto.randomUUID(), by: me.id, name, text };
    setMessages((m) => [...m, msg]);
    chRef.current?.send({ type: "broadcast", event: "guess", payload: msg });
    chRef.current?.send({
      type: "broadcast",
      event: "guess-live",
      payload: { by: me.id, name, text },
    });
    window.setTimeout(() => {
      // If the drawer validated it in the meantime, markCorrect already ran
      // and set roundResolvedRef — skip the wrong-toast.
      if (roundResolvedRef.current) return;
      toast.error("❌ Wrong guess. Try again.");
    }, 1500);
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

      <div className="grid gap-3 lg:grid-cols-[1fr_340px] lg:items-start">
        <div>
          <div className="rounded-3xl overflow-hidden border border-border bg-white h-[60vh] min-h-[360px] touch-none">
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
            <div className="mt-3 rounded-2xl border border-border bg-surface/70 backdrop-blur p-2.5 space-y-2">
              {/* Color palette */}
              <div className="flex gap-1.5 flex-wrap">
                {COLORS.map((c) => {
                  const active = color === c && !erase;
                  return (
                    <button
                      key={c}
                      onClick={() => { setColor(c); setErase(false); }}
                      className={`size-6 rounded-full border-2 transition-transform ${active ? "border-petal scale-125 ring-2 ring-petal/40" : "border-border/60 hover:scale-110"}`}
                      style={{ background: c, boxShadow: c === "#ffffff" ? "inset 0 0 0 1px rgba(0,0,0,0.15)" : undefined }}
                      aria-label={`Color ${c}`}
                    />
                  );
                })}
              </div>

              {/* Tools row */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setErase((e) => !e)}
                  className={`h-8 px-2.5 rounded-full border flex items-center gap-1.5 text-xs ${erase ? "border-petal bg-petal-soft text-petal" : "border-border bg-velvet text-candle"}`}
                  aria-label="Eraser"
                  title="Eraser"
                >
                  <Eraser className="size-3.5" />
                  <span>Eraser</span>
                </button>

                <div className="h-6 w-px bg-border" />

                <span className="text-[10px] uppercase tracking-widest text-candle-muted">Brush</span>
                {[3, 6, 12, 20].map((n) => (
                  <button
                    key={n}
                    onClick={() => setSize(n)}
                    className={`size-8 rounded-full flex items-center justify-center border transition ${size === n ? "border-petal bg-petal-soft/40 scale-105" : "border-border bg-velvet hover:border-petal/50"}`}
                    aria-label={`Brush size ${n}`}
                  >
                    <span
                      className="rounded-full"
                      style={{
                        width: Math.min(n, 18),
                        height: Math.min(n, 18),
                        background: erase ? "#ffffff" : color,
                        border: erase ? "1px solid var(--border, #d4d4d8)" : undefined,
                      }}
                    />
                  </button>
                ))}

                <button
                  onClick={() => { strokes.current = []; redraw(); chRef.current?.send({ type: "broadcast", event: "clear", payload: {} }); persist(); }}
                  className="ml-auto h-8 rounded-full bg-velvet border border-border px-3 text-xs flex items-center gap-1 text-candle hover:border-petal/50"
                >
                  <RotateCcw className="size-3" /> Clear
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="lg:sticky lg:top-4 space-y-3">
          {phase === "playing" && !iAmDrawer && (
            <div className="flex gap-2">
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

          <div className="rounded-2xl border border-border bg-surface p-3 max-h-[50vh] lg:max-h-[60vh] overflow-y-auto space-y-1.5">
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
        </div>
      </div>




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

          {/* All-time leaderboard */}
          <Leaderboard
            me={me}
            partner={partner}
            leaderboard={leaderboard}
          />
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

type LbProfile = { id: string; display_name?: string | null; username?: string | null; avatar_url?: string | null } | null | undefined;
type LbStats = { user_id: string; wins: number; correct_guesses: number; games_played: number; rounds_drawn: number };

function Leaderboard({
  me,
  partner,
  leaderboard,
}: {
  me: any;
  partner: any;
  leaderboard: Record<string, LbStats>;
}) {
  const rows = [me, partner].filter(Boolean) as NonNullable<LbProfile>[];
  const enriched = rows
    .map((p) => {
      const s = leaderboard[p.id] ?? { user_id: p.id, wins: 0, correct_guesses: 0, games_played: 0, rounds_drawn: 0 };
      const winRate = s.games_played > 0 ? Math.round((s.wins / s.games_played) * 100) : 0;
      return { profile: p, stats: s, winRate };
    })
    .sort((a, b) =>
      b.stats.wins - a.stats.wins ||
      b.stats.correct_guesses - a.stats.correct_guesses ||
      b.stats.rounds_drawn - a.stats.rounds_drawn,
    );

  return (
    <div className="mt-4 rounded-2xl border border-border bg-surface/70 backdrop-blur p-3">
      <div className="flex items-center gap-2 mb-2">
        <Crown className="size-4 text-petal" />
        <h3 className="font-serif italic text-base">All-time Leaderboard</h3>
      </div>
      <div className="space-y-2">
        {enriched.map((row, idx) => {
          const isMe = row.profile.id === me.id;
          const name = row.profile.display_name || row.profile.username || (isMe ? "You" : "Partner");
          return (
            <div
              key={row.profile.id}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2 border ${
                idx === 0
                  ? "border-petal/60 bg-petal-soft/30"
                  : "border-border bg-velvet"
              }`}
            >
              <div className={`size-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                idx === 0 ? "bg-petal text-white" : "bg-surface text-candle-muted border border-border"
              }`}>
                {idx + 1}
              </div>
              <div className="size-8 rounded-full bg-petal-soft overflow-hidden flex items-center justify-center shrink-0">
                {row.profile.avatar_url ? (
                  <AvatarImg src={row.profile.avatar_url} alt={name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm">🐼</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-candle truncate">
                  {name}{isMe && <span className="text-petal text-[10px] ml-1">(you)</span>}
                </p>
                <p className="text-[10px] text-candle-muted">
                  {row.stats.games_played} game{row.stats.games_played === 1 ? "" : "s"} · {row.winRate}% win
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <div className="text-center">
                  <div className="text-petal font-bold tabular-nums">{row.stats.wins}</div>
                  <div className="text-[9px] uppercase tracking-widest text-candle-muted">Wins</div>
                </div>
                <div className="text-center">
                  <div className="text-candle font-semibold tabular-nums">{row.stats.correct_guesses}</div>
                  <div className="text-[9px] uppercase tracking-widest text-candle-muted">Guessed</div>
                </div>
                <div className="text-center">
                  <div className="text-candle font-semibold tabular-nums">{row.stats.rounds_drawn}</div>
                  <div className="text-[9px] uppercase tracking-widest text-candle-muted">Drawn</div>
                </div>
              </div>
            </div>
          );
        })}
        {!partner && (
          <p className="text-[11px] text-candle-muted text-center pt-1">
            Pair with your partner to see them here.
          </p>
        )}
      </div>
    </div>
  );
}

