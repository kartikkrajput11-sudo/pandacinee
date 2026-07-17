import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, RotateCcw, Eye, EyeOff, Sparkles, Users, Wifi } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { sfxKiss, sfxPollVote, sfxReaction } from "@/lib/sfx";
import { GameChat } from "@/components/games/GameChat";

export const Route = createFileRoute("/_authenticated/app/hideseek")({
  component: HideSeekPage,
  head: () => ({
    meta: [
      { title: "Hide & Seek — PandaCine" },
      { name: "description", content: "A luxury panda hide-and-seek for two. Hide, hint, and hunt across velvet rooms." },
    ],
  }),
});

/* ────────────────────────  Data  ──────────────────────── */

type Spot = { emoji: string; name: string; x: number; y: number };
type Scene = {
  id: string;
  name: string;
  emoji: string;
  sky: string;        // top of the scene
  floor: string;      // bottom of the scene
  props: { emoji: string; x: number; y: number; size: number; rotate?: number; opacity?: number }[]; // decorative, non-clickable
  spots: Spot[];      // exactly 6 clickable hiding hotspots
};

/**
 * Each scene renders as a 2D room. Positions are percentages of the room
 * frame (0-100). Spots are the ONLY clickable hotspots; props are decor.
 */
const SCENES: Scene[] = [
  {
    id: "ballroom", name: "Velvet Ballroom", emoji: "🕯️",
    sky: "oklch(0.32 0.08 340)", floor: "oklch(0.22 0.05 340)",
    props: [
      { emoji: "✨", x: 15, y: 18, size: 18, opacity: 0.7 },
      { emoji: "✨", x: 78, y: 22, size: 14, opacity: 0.6 },
      { emoji: "💫", x: 50, y: 10, size: 22, opacity: 0.7 },
      { emoji: "🕯️", x: 8, y: 55, size: 26 },
      { emoji: "🕯️", x: 92, y: 55, size: 26 },
    ],
    spots: [
      { emoji: "🎭", name: "Velvet Curtain", x: 12, y: 32 },
      { emoji: "🎹", name: "Grand Piano",    x: 32, y: 72 },
      { emoji: "🪞", name: "Gilded Mirror",   x: 50, y: 30 },
      { emoji: "🕰️", name: "Longcase Clock",  x: 88, y: 38 },
      { emoji: "🥂", name: "Champagne Tower", x: 68, y: 72 },
      { emoji: "💐", name: "Rose Urn",        x: 88, y: 78 },
    ],
  },
  {
    id: "library", name: "Moonlit Library", emoji: "📚",
    sky: "oklch(0.28 0.09 260)", floor: "oklch(0.18 0.05 260)",
    props: [
      { emoji: "🌙", x: 82, y: 14, size: 28 },
      { emoji: "✨", x: 24, y: 12, size: 14, opacity: 0.7 },
      { emoji: "✨", x: 60, y: 22, size: 12, opacity: 0.6 },
      { emoji: "📕", x: 18, y: 82, size: 18, rotate: -8, opacity: 0.6 },
      { emoji: "📗", x: 26, y: 84, size: 18, rotate: 4, opacity: 0.6 },
    ],
    spots: [
      { emoji: "🪜", name: "Sliding Ladder", x: 14, y: 45 },
      { emoji: "📖", name: "Open Tome",       x: 36, y: 74 },
      { emoji: "🦉", name: "Owl Perch",       x: 52, y: 24 },
      { emoji: "🕯️", name: "Reading Nook",    x: 72, y: 60 },
      { emoji: "🗝️", name: "Locked Drawer",   x: 88, y: 78 },
      { emoji: "🪟", name: "Skylight Sill",   x: 30, y: 20 },
    ],
  },
  {
    id: "conservatory", name: "Glass Conservatory", emoji: "🌿",
    sky: "oklch(0.42 0.10 170)", floor: "oklch(0.25 0.07 150)",
    props: [
      { emoji: "☀️", x: 82, y: 12, size: 26, opacity: 0.85 },
      { emoji: "🌤️", x: 20, y: 14, size: 22, opacity: 0.6 },
      { emoji: "🍃", x: 46, y: 18, size: 16, rotate: 12, opacity: 0.7 },
    ],
    spots: [
      { emoji: "🌴", name: "Fan Palm",         x: 12, y: 50 },
      { emoji: "🪴", name: "Fig Pot",          x: 30, y: 78 },
      { emoji: "🦋", name: "Butterfly Cage",   x: 50, y: 34 },
      { emoji: "⛲", name: "Marble Fountain",  x: 70, y: 72 },
      { emoji: "🌸", name: "Orchid Bench",     x: 88, y: 60 },
      { emoji: "🪟", name: "Foggy Pane",       x: 60, y: 22 },
    ],
  },
  {
    id: "cellar", name: "Wine Cellar", emoji: "🍷",
    sky: "oklch(0.22 0.08 30)", floor: "oklch(0.14 0.05 25)",
    props: [
      { emoji: "🔦", x: 50, y: 10, size: 22, opacity: 0.75 },
      { emoji: "🕸️", x: 8, y: 12, size: 20, opacity: 0.6 },
      { emoji: "🕸️", x: 90, y: 14, size: 20, opacity: 0.6 },
    ],
    spots: [
      { emoji: "🛢️", name: "Oak Barrel",       x: 16, y: 68 },
      { emoji: "🍾", name: "Bottle Rack",      x: 36, y: 40 },
      { emoji: "🪵", name: "Stacked Crates",   x: 56, y: 74 },
      { emoji: "🕯️", name: "Lantern Hook",     x: 74, y: 34 },
      { emoji: "🗝️", name: "Iron Gate",        x: 88, y: 62 },
      { emoji: "🕸️", name: "Cobweb Corner",    x: 20, y: 24 },
    ],
  },
  {
    id: "garden", name: "Rose Garden", emoji: "🌹",
    sky: "oklch(0.55 0.12 340)", floor: "oklch(0.30 0.10 150)",
    props: [
      { emoji: "🌙", x: 82, y: 14, size: 22, opacity: 0.7 },
      { emoji: "✨", x: 20, y: 20, size: 12, opacity: 0.7 },
      { emoji: "🌿", x: 8, y: 80, size: 22, opacity: 0.7 },
      { emoji: "🌿", x: 92, y: 82, size: 22, opacity: 0.7 },
    ],
    spots: [
      { emoji: "🌹", name: "Rose Trellis",    x: 14, y: 46 },
      { emoji: "🦢", name: "Swan Pond",       x: 34, y: 76 },
      { emoji: "🗿", name: "Cupid Statue",    x: 52, y: 40 },
      { emoji: "🌳", name: "Willow Curtain",  x: 74, y: 50 },
      { emoji: "🪑", name: "Wrought Bench",   x: 68, y: 78 },
      { emoji: "🕊️", name: "Dovecote",        x: 88, y: 28 },
    ],
  },
];

const TOTAL_ROUNDS = 4; // two per player
const MAX_ATTEMPTS = 4;

/** Euclidean distance in scene space (0-100 units). */
function distance(a: Spot, b: Spot): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function heatFor(a: Spot, b: Spot): { label: string; emoji: string; cls: string } {
  const d = distance(a, b);
  if (d === 0) return { label: "Burning!", emoji: "🔥", cls: "text-rose-300" };
  if (d < 30)  return { label: "Warm",     emoji: "🌡️", cls: "text-amber-300" };
  return { label: "Cold", emoji: "❄️", cls: "text-sky-300" };
}


/* ────────────────────────  Types  ──────────────────────── */

type Mode = "local" | "online";
type Phase =
  | "intro"
  | "lobby"
  | "waiting"          // guesser side: hider is choosing
  | "hider_pick_scene" // hider chooses scene
  | "hider_pick_spot"  // hider chooses spot in that scene
  | "hider_watch"      // hider watching seeker search
  | "handoff"          // local: pass phone
  | "seeker"           // seeker searching
  | "round_result"     // between-round summary
  | "final";

type PeerMsg =
  | { t: "hello"; from: string }
  | { t: "start"; from: string; hiderId: string; round: number }
  | { t: "hide"; from: string; sceneId: string; spot: number } // sent to seeker on start
  | { t: "guess"; from: string; attempt: number; spot: number }
  | { t: "round_end"; from: string; scores: [number, number]; foundAt: number | null }
  | { t: "next_round"; from: string; hiderId: string; round: number }
  | { t: "finish"; from: string; scores: [number, number] };

/* ────────────────────────  Component  ──────────────────────── */

function HideSeekPage() {
  const { data } = useProfile();
  const me = data?.profile;
  const partner = data?.partner;
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>("local");
  const [phase, setPhase] = useState<Phase>("intro");
  const [round, setRound] = useState(1);
  const [hiderId, setHiderId] = useState<string | null>(null); // for local: "me"/"partner"; for online: user id
  const [sceneId, setSceneId] = useState<string | null>(null);
  const [spot, setSpot] = useState<number | null>(null);
  const [attempts, setAttempts] = useState<number[]>([]); // spot indexes tried
  const [scores, setScores] = useState<[number, number]>([0, 0]); // [me, partner]
  const [foundAt, setFoundAt] = useState<number | null>(null); // attempts index (0-based) or null

  const scene = useMemo(() => SCENES.find((s) => s.id === sceneId) ?? null, [sceneId]);

  const iAmHider = mode === "local"
    ? hiderId === "me"
    : !!(me && hiderId && me.id === hiderId);
  const iAmSeeker = mode === "local"
    ? hiderId === "partner"
    : !!(me && hiderId && me.id !== hiderId);

  const hiderName = iAmHider
    ? (me?.display_name ?? "You")
    : (mode === "local" ? "Partner" : (partner?.display_name ?? "your panda"));
  const seekerName = iAmSeeker
    ? (me?.display_name ?? "You")
    : (mode === "local" ? "Partner" : (partner?.display_name ?? "your panda"));

  /* ── realtime ── */
  const chanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [peerOnline, setPeerOnline] = useState(false);

  useEffect(() => {
    if (mode !== "online" || !me || !partner) return;
    const key = [me.id, partner.id].sort().join(":");
    const channel = supabase.channel(`hideseek:${key}`, {
      config: { broadcast: { self: false }, presence: { key: me.id } },
    });
    chanRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setPeerOnline(Object.keys(state).some((k) => k === partner.id));
      })
      .on("broadcast", { event: "msg" }, ({ payload }) => handlePeer(payload as PeerMsg))
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ at: Date.now() });
          send({ t: "hello", from: me.id });
        }
      });

    return () => {
      supabase.removeChannel(channel);
      chanRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, me?.id, partner?.id]);

  function send(msg: PeerMsg) {
    chanRef.current?.send({ type: "broadcast", event: "msg", payload: msg });
  }

  // refs for latest state inside broadcast handlers
  const stateRef = useRef({ sceneId, spot, attempts, scores, round, hiderId });
  useEffect(() => {
    stateRef.current = { sceneId, spot, attempts, scores, round, hiderId };
  }, [sceneId, spot, attempts, scores, round, hiderId]);

  function handlePeer(msg: PeerMsg) {
    if (!me) return;
    if (msg.from === me.id) return;
    if (msg.t === "hello") return;

    if (msg.t === "start" || msg.t === "next_round") {
      setHiderId(msg.hiderId);
      setRound(msg.round);
      setSceneId(null);
      setSpot(null);
      setAttempts([]);
      setFoundAt(null);
      const iHide = msg.hiderId === me.id;
      setPhase(iHide ? "hider_pick_scene" : "waiting");
      return;
    }

    if (msg.t === "hide") {
      // I'm the seeker — receive scene, start seeking
      setSceneId(msg.sceneId);
      setSpot(msg.spot);
      setAttempts([]);
      setFoundAt(null);
      setPhase("seeker");
      return;
    }

    if (msg.t === "guess") {
      // I'm the hider — record the seeker's attempt so I can watch
      setAttempts((prev) => {
        const next = [...prev];
        next[msg.attempt] = msg.spot;
        return next;
      });
      const truth = stateRef.current.spot;
      if (truth != null && msg.spot === truth) sfxKiss();
      else sfxReaction();
      return;
    }

    if (msg.t === "round_end") {
      setScores(msg.scores);
      setFoundAt(msg.foundAt);
      setPhase("round_result");
      return;
    }

    if (msg.t === "finish") {
      setScores(msg.scores);
      setPhase("final");
      return;
    }
  }

  /* ── flow control ── */

  function resetAll() {
    setPhase("intro");
    setRound(1);
    setHiderId(null);
    setSceneId(null);
    setSpot(null);
    setAttempts([]);
    setFoundAt(null);
    setScores([0, 0]);
  }

  function startLocal() {
    setRound(1);
    setScores([0, 0]);
    setHiderId("me");
    setSceneId(null);
    setSpot(null);
    setAttempts([]);
    setFoundAt(null);
    setPhase("hider_pick_scene");
  }

  function startOnline(iHideFirst: boolean) {
    if (!me || !partner) return;
    const hider = iHideFirst ? me.id : partner.id;
    setRound(1);
    setScores([0, 0]);
    setHiderId(hider);
    setSceneId(null);
    setSpot(null);
    setAttempts([]);
    setFoundAt(null);
    send({ t: "start", from: me.id, hiderId: hider, round: 1 });
    setPhase(iHideFirst ? "hider_pick_scene" : "waiting");
  }

  function pickScene(id: string) {
    sfxReaction();
    setSceneId(id);
    setPhase("hider_pick_spot");
  }

  function pickSpot(i: number) {
    sfxPollVote();
    setSpot(i);
    if (mode === "online" && me && sceneId != null) {
      send({ t: "hide", from: me.id, sceneId, spot: i });
      setPhase("hider_watch");
    } else {
      // local hand-off
      setPhase("handoff");
    }
  }

  function seekerGuess(i: number) {
    if (attempts.includes(i)) return;
    const attemptIdx = attempts.length;
    const next = [...attempts, i];
    setAttempts(next);
    const correct = i === spot;

    if (mode === "online" && me) {
      send({ t: "guess", from: me.id, attempt: attemptIdx, spot: i });
    }

    if (correct) {
      sfxKiss();
      // Score: MAX_ATTEMPTS - attempts_used_so_far. Higher is better.
      const gained = MAX_ATTEMPTS - attemptIdx;
      finishRound(attemptIdx, gained);
    } else {
      sfxPollVote();
      if (next.length >= MAX_ATTEMPTS) {
        finishRound(null, 0);
      }
    }
  }

  function finishRound(foundAtIdx: number | null, seekerGained: number) {
    // Scoring: [me, partner]
    const meIsSeeker = iAmSeeker;
    const nextScores: [number, number] = [scores[0], scores[1]];
    // Hider gains points equal to (MAX_ATTEMPTS - seekerGained) capped — reward for hiding well
    const hiderGained = MAX_ATTEMPTS - seekerGained;
    if (meIsSeeker) {
      nextScores[0] += seekerGained;
      nextScores[1] += hiderGained;
    } else {
      nextScores[0] += hiderGained;
      nextScores[1] += seekerGained;
    }
    setScores(nextScores);
    setFoundAt(foundAtIdx);
    if (mode === "online" && me) {
      send({ t: "round_end", from: me.id, scores: nextScores, foundAt: foundAtIdx });
    }
    setPhase("round_result");
  }

  function nextRound() {
    if (round >= TOTAL_ROUNDS) {
      if (mode === "online" && me) send({ t: "finish", from: me.id, scores });
      setPhase("final");
      return;
    }
    const r = round + 1;
    setRound(r);
    // Swap hider
    let nextHider: string;
    if (mode === "local") {
      nextHider = hiderId === "me" ? "partner" : "me";
    } else {
      nextHider = hiderId === me?.id ? (partner?.id ?? me.id) : (me?.id ?? "");
    }
    setHiderId(nextHider);
    setSceneId(null);
    setSpot(null);
    setAttempts([]);
    setFoundAt(null);
    if (mode === "online" && me) {
      send({ t: "next_round", from: me.id, hiderId: nextHider, round: r });
      setPhase(nextHider === me.id ? "hider_pick_scene" : "waiting");
    } else {
      setPhase("hider_pick_scene");
    }
  }

  /* ── UI ── */

  return (
    <div className="min-h-dvh bg-gradient-to-b from-velvet via-surface to-velvet">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-16 size-72 rounded-full blur-3xl opacity-40"
          style={{ background: "radial-gradient(circle, oklch(0.72 0.18 15 / 0.55), transparent 70%)" }} />
        <div className="absolute -bottom-24 -right-10 size-80 rounded-full blur-3xl opacity-35"
          style={{ background: "radial-gradient(circle, oklch(0.82 0.14 68 / 0.5), transparent 70%)" }} />
      </div>

      <div className="relative pt-10 px-5 pb-24 max-w-xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <Link to="/app/play" className="text-candle-muted hover:text-candle transition-colors">
            <ArrowLeft className="size-5" />
          </Link>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-[0.28em] text-petal">Panda parlour game</p>
            <h1 className="font-serif text-2xl italic mt-0.5">Hide &amp; Seek</h1>
          </div>
          <button
            onClick={resetAll}
            className="p-2 rounded-full bg-surface border border-border text-candle-muted hover:text-candle"
            aria-label="Reset"
          >
            <RotateCcw className="size-4" />
          </button>
        </header>

        {mode === "online" && phase !== "intro" && (
          <div className="mb-4 flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest">
            <span className={`size-1.5 rounded-full ${peerOnline ? "bg-emerald-400" : "bg-rose-400"} animate-pulse`} />
            <span className="text-candle-muted">
              {peerOnline ? `${partner?.display_name ?? "Partner"} is here` : `Waiting for ${partner?.display_name ?? "partner"}…`}
            </span>
          </div>
        )}

        {phase !== "intro" && phase !== "lobby" && phase !== "final" && (
          <div className="mb-5 flex items-center justify-between text-[11px] uppercase tracking-widest text-candle-muted">
            <span>Round {round} / {TOTAL_ROUNDS}</span>
            <span className="flex items-center gap-2">
              <ScorePill label={me?.display_name ?? "You"} value={scores[0]} highlight />
              <ScorePill label={(mode === "local" ? "Partner" : partner?.display_name) ?? "Partner"} value={scores[1]} />
            </span>
          </div>
        )}

        {phase === "intro" && (
          <Intro
            mode={mode}
            setMode={setMode}
            hasPartner={!!partner}
            onStartLocal={startLocal}
            onEnterOnline={() => setPhase("lobby")}
          />
        )}

        {phase === "lobby" && (
          <Lobby
            partnerName={partner?.display_name ?? "your panda"}
            peerOnline={peerOnline}
            onIHide={() => startOnline(true)}
            onTheyHide={() => startOnline(false)}
          />
        )}

        {phase === "waiting" && (
          <WaitingCard
            title={`${hiderName} is choosing a room…`}
            body="They're picking a hiding spot in secret. Keep your eyes closed."
          />
        )}

        {phase === "hider_pick_scene" && (
          <PickScene onPick={pickScene} />
        )}

        {phase === "hider_pick_spot" && scene && (
          <PickSpot scene={scene} onPick={pickSpot} onBack={() => setPhase("hider_pick_scene")} />
        )}

        {phase === "handoff" && (
          <Handoff
            hiderName={hiderName}
            seekerName={seekerName}
            onReady={() => {
              setHiderId((h) => (h === "me" ? "partner" : "me"));
              setPhase("seeker");
            }}
          />
        )}

        {phase === "hider_watch" && scene && spot != null && (
          <HiderWatch scene={scene} spot={spot} attempts={attempts} seekerName={seekerName} />
        )}

        {phase === "seeker" && scene && spot != null && (
          <SeekerBoard
            scene={scene}
            spot={spot}
            attempts={attempts}
            onGuess={seekerGuess}
            hiderName={hiderName}
          />
        )}

        {phase === "round_result" && scene && spot != null && (
          <RoundResult
            scene={scene}
            spot={spot}
            attempts={attempts}
            foundAt={foundAt}
            hiderName={hiderName}
            seekerName={seekerName}
            onNext={nextRound}
            isFinal={round >= TOTAL_ROUNDS}
          />
        )}

        {phase === "final" && (
          <Final
            scores={scores}
            meName={me?.display_name ?? "You"}
            partnerName={(mode === "local" ? "Partner" : partner?.display_name) ?? "Partner"}
            onRematch={() => { mode === "online" ? setPhase("lobby") : startLocal(); }}
            onExit={() => navigate({ to: "/app/play" })}
          />
        )}
      </div>

      {mode === "online" && me && partner && (
        <GameChat
          roomKey={`hideseek:${[me.id, partner.id].sort().join(":")}`}
          me={me}
          partnerName={partner.display_name}
          title="Whisper"
        />
      )}
    </div>
  );
}

/* ────────────────────────  Sub-components  ──────────────────────── */

function ScorePill({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border ${highlight ? "border-petal/50 bg-petal-soft text-petal" : "border-border bg-surface text-candle"}`}>
      <span className="normal-case tracking-normal text-[10px] opacity-80">{label}</span>
      <span className="font-serif text-sm">{value}</span>
    </span>
  );
}

function Intro({
  mode, setMode, hasPartner, onStartLocal, onEnterOnline,
}: { mode: Mode; setMode: (m: Mode) => void; hasPartner: boolean; onStartLocal: () => void; onEnterOnline: () => void }) {
  return (
    <div className="rounded-3xl border border-border bg-surface/80 backdrop-blur p-6 space-y-5">
      <p className="text-candle-muted text-sm leading-relaxed">
        One panda hides in one of six velvet spots. The other has <span className="text-candle font-medium">{MAX_ATTEMPTS} guesses</span> to find them — with warm/cold hints after every miss.
      </p>

      <div className="grid grid-cols-2 gap-2 text-[11px] uppercase tracking-widest">
        <button
          onClick={() => setMode("local")}
          className={`p-3 rounded-2xl border ${mode === "local" ? "border-petal bg-petal-soft text-petal" : "border-border text-candle-muted"}`}
        >
          <Users className="size-4 inline mr-1.5 -mt-0.5" /> Pass phone
        </button>
        <button
          onClick={() => setMode("online")}
          disabled={!hasPartner}
          className={`p-3 rounded-2xl border ${mode === "online" ? "border-petal bg-petal-soft text-petal" : "border-border text-candle-muted"} disabled:opacity-40`}
        >
          <Wifi className="size-4 inline mr-1.5 -mt-0.5" /> Long distance
        </button>
      </div>

      {!hasPartner && (
        <p className="text-[11px] text-candle-muted">Pair with a partner to play across any distance.</p>
      )}

      <button
        onClick={mode === "local" ? onStartLocal : onEnterOnline}
        className="w-full py-3 rounded-2xl bg-gradient-to-br from-petal to-rose-500 text-velvet font-medium tracking-wide shadow-lg shadow-petal/20"
      >
        Begin the hunt
      </button>
    </div>
  );
}

function Lobby({ partnerName, peerOnline, onIHide, onTheyHide }: {
  partnerName: string; peerOnline: boolean; onIHide: () => void; onTheyHide: () => void;
}) {
  return (
    <div className="rounded-3xl border border-border bg-surface/80 backdrop-blur p-6 space-y-4">
      <p className="text-candle-muted text-sm">Who hides first?</p>
      <div className="grid grid-cols-1 gap-2">
        <button onClick={onIHide} className="p-4 rounded-2xl border border-petal/40 bg-petal-soft/50 text-left hover:border-petal transition">
          <p className="font-serif italic text-lg">I'll hide</p>
          <p className="text-xs text-candle-muted">{partnerName} will search for me.</p>
        </button>
        <button onClick={onTheyHide} disabled={!peerOnline} className="p-4 rounded-2xl border border-border bg-surface text-left hover:border-petal/40 transition disabled:opacity-40">
          <p className="font-serif italic text-lg">{partnerName} hides</p>
          <p className="text-xs text-candle-muted">I'll be the seeker.</p>
        </button>
      </div>
    </div>
  );
}

function WaitingCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-3xl border border-border bg-surface/80 backdrop-blur p-8 text-center space-y-3">
      <div className="mx-auto size-14 rounded-full bg-petal-soft flex items-center justify-center">
        <EyeOff className="size-6 text-petal" />
      </div>
      <p className="font-serif italic text-xl">{title}</p>
      <p className="text-sm text-candle-muted">{body}</p>
      <div className="flex justify-center gap-1 pt-2">
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-1.5 rounded-full bg-petal/60 animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
        ))}
      </div>
    </div>
  );
}

/* ── Shared 2D room frame ── */
function RoomFrame({
  scene,
  children,
  compact,
}: { scene: Scene; children: ReactNode; compact?: boolean }) {
  return (
    <div
      className={`relative w-full ${compact ? "aspect-[4/3]" : "aspect-[3/4] sm:aspect-[4/3]"} rounded-3xl border border-border overflow-hidden select-none shadow-inner`}
      style={{
        background: `linear-gradient(to bottom, ${scene.sky} 0%, ${scene.sky} 55%, ${scene.floor} 55%, ${scene.floor} 100%)`,
      }}
    >
      {/* soft vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at 50% 30%, transparent 40%, rgba(0,0,0,0.55) 100%)" }}
      />
      {/* floor shine */}
      <div
        className="pointer-events-none absolute left-0 right-0"
        style={{ top: "55%", height: "6%", background: "linear-gradient(to bottom, rgba(255,255,255,0.10), transparent)" }}
      />
      {/* decorative, non-clickable props */}
      {scene.props.map((p, i) => (
        <span
          key={`p-${i}`}
          className="pointer-events-none absolute select-none"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            fontSize: `${p.size}px`,
            transform: `translate(-50%, -50%) rotate(${p.rotate ?? 0}deg)`,
            opacity: p.opacity ?? 1,
            filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.4))",
          }}
        >
          {p.emoji}
        </span>
      ))}
      {children}
    </div>
  );
}

function PickScene({ onPick }: { onPick: (id: string) => void }) {
  return (
    <div className="space-y-4">
      <p className="text-center text-sm text-candle-muted">Choose a room to hide in.</p>
      <div className="grid grid-cols-2 gap-3">
        {SCENES.map((s) => (
          <button
            key={s.id}
            onClick={() => onPick(s.id)}
            className="rounded-3xl border border-border bg-surface text-left hover:border-petal/60 transition-colors overflow-hidden"
          >
            <div
              className="relative w-full aspect-[5/3]"
              style={{ background: `linear-gradient(to bottom, ${s.sky} 0%, ${s.sky} 55%, ${s.floor} 55%, ${s.floor} 100%)` }}
            >
              <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 30%, transparent 40%, rgba(0,0,0,0.5) 100%)" }} />
              {s.props.slice(0, 3).map((p, i) => (
                <span key={i} className="absolute" style={{ left: `${p.x}%`, top: `${p.y}%`, fontSize: `${Math.max(10, p.size * 0.7)}px`, transform: "translate(-50%,-50%)", opacity: p.opacity ?? 1 }}>{p.emoji}</span>
              ))}
              <span className="absolute inset-x-0 bottom-1 text-center text-[10px] uppercase tracking-widest text-candle/80">{s.emoji} {s.name}</span>
            </div>
            <div className="px-3 py-2">
              <p className="text-[10px] uppercase tracking-widest text-candle-muted">6 hiding spots</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function PickSpot({ scene, onPick, onBack }: { scene: Scene; onPick: (i: number) => void; onBack: () => void }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-[11px] uppercase tracking-widest text-candle-muted hover:text-candle">← Different room</button>
        <p className="font-serif italic text-lg">{scene.name}</p>
        <span />
      </div>
      <p className="text-center text-xs text-candle-muted">Tap the spot you'll hide in. Only you will see it.</p>
      <RoomFrame scene={scene}>
        {scene.spots.map((sp, i) => (
          <button
            key={i}
            onClick={() => onPick(i)}
            className="absolute -translate-x-1/2 -translate-y-1/2 group focus:outline-none"
            style={{ left: `${sp.x}%`, top: `${sp.y}%` }}
            aria-label={sp.name}
          >
            <span className="relative flex items-center justify-center size-14 sm:size-16 rounded-full bg-velvet/40 backdrop-blur border border-candle/20 group-hover:border-petal group-hover:bg-velvet/70 transition shadow-lg">
              <span className="text-3xl drop-shadow" style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.5))" }}>{sp.emoji}</span>
              <span className="absolute -bottom-5 whitespace-nowrap text-[10px] uppercase tracking-widest text-candle-muted opacity-0 group-hover:opacity-100 transition">{sp.name}</span>
            </span>
          </button>
        ))}
      </RoomFrame>
    </div>
  );
}

function Handoff({ hiderName, seekerName, onReady }: { hiderName: string; seekerName: string; onReady: () => void }) {
  return (
    <div className="rounded-3xl border border-petal/40 bg-petal-soft/40 p-8 text-center space-y-4">
      <p className="text-[10px] uppercase tracking-[0.3em] text-petal">Hush</p>
      <p className="font-serif italic text-2xl">Pass to {seekerName}</p>
      <p className="text-sm text-candle-muted">{hiderName} has hidden. No peeking at the spot.</p>
      <button onClick={onReady} className="px-6 py-3 rounded-2xl bg-petal text-velvet font-medium tracking-wide shadow-lg shadow-petal/30">
        I'm ready to seek
      </button>
    </div>
  );
}

function HiderWatch({ scene, spot, attempts, seekerName }: { scene: Scene; spot: number; attempts: number[]; seekerName: string }) {
  const mySpot = scene.spots[spot];
  return (
    <div className="space-y-3">
      <div className="text-center">
        <p className="text-[10px] uppercase tracking-[0.28em] text-petal">You are hiding at</p>
        <p className="font-serif italic text-xl">{mySpot.emoji} {mySpot.name}</p>
        <p className="text-xs text-candle-muted mt-1">{seekerName} has {MAX_ATTEMPTS - attempts.length} of {MAX_ATTEMPTS} guesses left.</p>
      </div>

      <RoomFrame scene={scene}>
        {scene.spots.map((sp, i) => {
          const guessed = attempts.includes(i);
          const isMe = i === spot;
          return (
            <div
              key={i}
              className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
              style={{ left: `${sp.x}%`, top: `${sp.y}%` }}
            >
              <span
                className={`relative flex items-center justify-center size-14 sm:size-16 rounded-full border transition ${
                  isMe ? "border-petal bg-petal-soft/50 ring-2 ring-petal/60 animate-pulse" : "border-candle/20 bg-velvet/40 backdrop-blur"
                } ${guessed && !isMe ? "opacity-40" : ""}`}
              >
                <span className="text-3xl">{sp.emoji}</span>
                {isMe && <span className="absolute -top-2 -right-2 text-lg">🫣</span>}
                {guessed && !isMe && <span className="absolute -top-2 -right-2 text-base">❌</span>}
              </span>
            </div>
          );
        })}
      </RoomFrame>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <p className="text-[10px] uppercase tracking-widest text-candle-muted mb-2">Search log</p>
        {attempts.length === 0 ? (
          <p className="text-sm text-candle-muted italic">Not a peep yet…</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {attempts.map((a, i) => {
              const heat = heatFor(scene.spots[a], mySpot);
              return (
                <li key={i} className="flex items-center justify-between">
                  <span className="text-candle">Guess {i + 1}: {scene.spots[a].emoji} {scene.spots[a].name}</span>
                  <span className={`text-[11px] uppercase tracking-widest ${heat.cls}`}>{heat.emoji} {heat.label}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function SeekerBoard({ scene, spot, attempts, onGuess, hiderName }: {
  scene: Scene; spot: number; attempts: number[]; onGuess: (i: number) => void; hiderName: string;
}) {
  const mySpot = scene.spots[spot];
  const lastAttempt = attempts.length > 0 ? attempts[attempts.length - 1] : null;
  const lastHeat = lastAttempt != null ? heatFor(scene.spots[lastAttempt], mySpot) : null;
  const remaining = MAX_ATTEMPTS - attempts.length;

  return (
    <div className="space-y-3">
      <div className="text-center">
        <p className="text-[10px] uppercase tracking-[0.28em] text-petal">Seeking {hiderName} in</p>
        <p className="font-serif italic text-xl">{scene.name}</p>
        <p className="text-xs text-candle-muted mt-1">{remaining} {remaining === 1 ? "guess" : "guesses"} left</p>
      </div>

      {lastHeat && (
        <div className={`text-center rounded-2xl border border-border bg-surface/60 backdrop-blur p-3 ${lastHeat.cls}`}>
          <p className="text-[10px] uppercase tracking-widest opacity-80">Last guess</p>
          <p className="font-serif italic text-lg">{lastHeat.emoji} {lastHeat.label}</p>
        </div>
      )}

      <RoomFrame scene={scene}>
        {scene.spots.map((sp, i) => {
          const tried = attempts.includes(i);
          return (
            <button
              key={i}
              onClick={() => onGuess(i)}
              disabled={tried}
              className="absolute -translate-x-1/2 -translate-y-1/2 group focus:outline-none disabled:cursor-not-allowed"
              style={{ left: `${sp.x}%`, top: `${sp.y}%` }}
              aria-label={tried ? "Already searched" : sp.name}
            >
              <span
                className={`relative flex items-center justify-center size-14 sm:size-16 rounded-full border transition shadow-lg ${
                  tried
                    ? "border-candle/10 bg-velvet/20 opacity-40"
                    : "border-candle/25 bg-velvet/40 backdrop-blur group-hover:border-petal group-hover:bg-velvet/70 group-active:scale-90"
                }`}
              >
                <span className="text-3xl" style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.5))" }}>{tried ? "❌" : "❓"}</span>
                {!tried && (
                  <span className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-petal/0 group-hover:ring-petal/60 transition" />
                )}
              </span>
            </button>
          );
        })}
      </RoomFrame>

      <p className="text-center text-[11px] text-candle-muted italic">Tap any hotspot to search it. Warmer means close, burning means dead-on.</p>
    </div>
  );
}



function RoundResult({ scene, spot, attempts, foundAt, hiderName, seekerName, onNext, isFinal }: {
  scene: Scene; spot: number; attempts: number[]; foundAt: number | null;
  hiderName: string; seekerName: string; onNext: () => void; isFinal: boolean;
}) {
  const found = foundAt != null;
  return (
    <div className="rounded-3xl border border-border bg-surface/80 backdrop-blur p-6 text-center space-y-4">
      <div className={`mx-auto size-14 rounded-full flex items-center justify-center ${found ? "bg-petal-soft" : "bg-velvet/60"}`}>
        {found ? <Eye className="size-6 text-petal" /> : <Sparkles className="size-6 text-candle-muted" />}
      </div>
      <div>
        <p className="font-serif italic text-2xl">
          {found ? `Found in ${(foundAt ?? 0) + 1} ${(foundAt ?? 0) + 1 === 1 ? "guess" : "guesses"}!` : `${hiderName} slipped away.`}
        </p>
        <p className="text-sm text-candle-muted mt-1">
          Hidden at <span className="text-candle">{scene.spots[spot].emoji} {scene.spots[spot].name}</span> in {scene.name}.
        </p>
      </div>
      {attempts.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1.5">
          {attempts.map((a, i) => (
            <span key={i} className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-full border ${a === spot ? "border-petal text-petal bg-petal-soft" : "border-border text-candle-muted"}`}>
              {i + 1}. {scene.spots[a].emoji}
            </span>
          ))}
        </div>
      )}
      <button onClick={onNext} className="w-full py-3 rounded-2xl bg-gradient-to-br from-petal to-rose-500 text-velvet font-medium tracking-wide shadow-lg shadow-petal/20">
        {isFinal ? "See final score" : "Swap and continue"}
      </button>
    </div>
  );
}

function Final({ scores, meName, partnerName, onRematch, onExit }: {
  scores: [number, number]; meName: string; partnerName: string; onRematch: () => void; onExit: () => void;
}) {
  const [mine, theirs] = scores;
  const verdict = mine === theirs ? "A perfect tie" : mine > theirs ? `${meName} wins` : `${partnerName} wins`;
  return (
    <div className="rounded-3xl border border-petal/40 bg-gradient-to-br from-petal-soft to-surface backdrop-blur p-6 text-center space-y-4">
      <p className="text-[10px] uppercase tracking-[0.3em] text-petal">Final curtain</p>
      <p className="font-serif italic text-3xl">{verdict}</p>
      <div className="flex justify-center gap-6 py-2">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-candle-muted">{meName}</p>
          <p className="font-serif text-4xl text-candle">{mine}</p>
        </div>
        <div className="w-px bg-border" />
        <div>
          <p className="text-[10px] uppercase tracking-widest text-candle-muted">{partnerName}</p>
          <p className="font-serif text-4xl text-candle">{theirs}</p>
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <button onClick={onRematch} className="flex-1 py-3 rounded-2xl bg-petal text-velvet font-medium">Rematch</button>
        <button onClick={onExit} className="flex-1 py-3 rounded-2xl border border-border text-candle">Back to games</button>
      </div>
    </div>
  );
}
