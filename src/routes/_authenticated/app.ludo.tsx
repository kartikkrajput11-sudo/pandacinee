import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Dice5, RotateCcw, Users, User } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { LudoWinAnimation } from "@/components/ludo/LudoWinAnimation";
import { GameChat } from "@/components/games/GameChat";
import { sfxLudoDiceRoll, sfxLudoHop, sfxLudoCapture, sfxLudoHome, sfxLudoWin } from "@/lib/sfx";
import { GroupPlayersBar } from "@/components/games/GroupPlayersBar";

import { useProfile } from "@/hooks/useProfile";
import { useMatchOpponent } from "@/hooks/useMatchOpponent";
import {
  initialState,
  applyRoll,
  applyMove,
  legalMoves,
  cellOf,
  rollDie,
  pathOf,
  destinationOf,
  PLAYER_META,
  PLAYERS,
  TRACK,
  HOME_COL,
  YARD,
  SAFE,
  type Player,
  type State,
  type Token,
} from "@/lib/ludo";

export const Route = createFileRoute("/_authenticated/app/ludo")({
  component: LudoPage,
  validateSearch: (search: Record<string, unknown>) => ({
    matchId: typeof search.matchId === "string" ? search.matchId : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Ludo — PandaCine" },
      { name: "description", content: "Play Ludo live with your panda." },
    ],
  }),
});

type Mode = "partner" | "local";

function LudoPage() {
  const { data } = useProfile();
  const me = data?.profile;
  const { matchId } = Route.useSearch();
  const { opponentId: matchOppId } = useMatchOpponent(matchId, me?.id);
  const partner = matchId
    ? (matchOppId ? ({ id: matchOppId } as { id: string; display_name?: string }) : null)
    : data?.partner;
  const [mode, setMode] = useState<Mode | null>(null);
  useEffect(() => { if (matchId && partner && !mode) setMode("partner"); }, [matchId, partner, mode]);
  const [state, setState] = useState<State>(() => initialState());

  // Determine local seat for partner mode. Lower UUID plays Red.
  const mySeat: Player = useMemo(() => {
    if (mode !== "partner" || !me || !partner) return "red";
    return me.id < partner.id ? "red" : "yellow";
  }, [mode, me, partner]);

  // Realtime broadcast channel for partner mode.
  const chRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  useEffect(() => {
    if (mode !== "partner" || !me || !partner) return;
    const key = matchId ?? [me.id, partner.id].sort().join(":");
    const ch = supabase.channel(`ludo:${key}`, { config: { broadcast: { self: false } } });

    ch.on("broadcast", { event: "state" }, ({ payload }) => {
      setState(payload as State);
    });
    ch.on("broadcast", { event: "sync-request" }, () => {
      // Whoever is Red re-broadcasts current state.
      setState((s) => {
        void ch.send({ type: "broadcast", event: "state", payload: s });
        return s;
      });
    });
    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        void ch.send({ type: "broadcast", event: "sync-request", payload: {} });
      }
    });
    chRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
      chRef.current = null;
    };
  }, [mode, me?.id, partner?.id]);

  const broadcast = (next: State) => {
    if (mode === "partner" && chRef.current) {
      void chRef.current.send({ type: "broadcast", event: "state", payload: next });
    }
  };

  const canAct = mode === "local" || state.turn === mySeat;

  const [rolling, setRolling] = useState(false);
  const [lastRoll, setLastRoll] = useState<number | null>(null);
  const [demoWin, setDemoWin] = useState<{ n: number; who: Player } | null>(null);
  const winTrigger = demoWin ? demoWin.n : state.winner ? `real-${state.winner}` : null;
  const winWho = demoWin ? demoWin.who : state.winner;
  const handleRoll = () => {

    if (!canAct || state.winner || state.dice != null || rolling) return;
    setRolling(true);
    sfxLudoDiceRoll();
    const v = rollDie();
    window.setTimeout(() => {
      setLastRoll(v);
      const next = applyRoll(state, v);
      setState(next);
      broadcast(next);
      setRolling(false);
      // If applyRoll immediately passed the turn (no legal move), toast the outcome.
      if (next.dice == null && !next.winner) {
        const stuckInYard = v !== 6 && state.tokens.filter((t) => t.player === state.turn).every((t) => t.pos === -1);
        toast(`Rolled ${v}${stuckInYard ? " — need a 6 to leave home" : " — no legal move"}`);
      }
    }, 900);
  };

  // Walk override: while animating, this token renders at `pos` instead of state.
  const [walking, setWalking] = useState<{ player: Player; idx: number; pos: number } | null>(null);

  const handleMove = async (t: Token) => {
    if (!canAct || state.dice == null || walking) return;
    const legal = legalMoves(state).some((m) => m.player === t.player && m.idx === t.idx);
    if (!legal) return;
    const path = pathOf(t, state.dice);
    // Freeze state during walk so board doesn't jump; animate through each square.
    for (const p of path) {
      setWalking({ player: t.player, idx: t.idx, pos: p });
      sfxLudoHop();
      await new Promise((r) => window.setTimeout(r, 220));
    }
    setWalking(null);
    const next = applyMove(state, t.player, t.idx);
    // Detect capture: opponent token that was on-track pre-move is now in yard.
    const captured = state.tokens.some((prev) => {
      if (prev.player === t.player) return false;
      const now = next.tokens.find((x) => x.player === prev.player && x.idx === prev.idx);
      return prev.pos !== -1 && now?.pos === -1;
    });
    if (captured) sfxLudoCapture();
    // Detect a token reaching home (finished).
    const finished = next.tokens.find((x) => x.player === t.player && x.idx === t.idx)?.pos === 200;
    if (finished && !next.winner) sfxLudoHome();
    setState(next);
    broadcast(next);
    if (next.winner) {
      sfxLudoWin();
      toast.success(`${PLAYER_META[next.winner].emoji} ${PLAYER_META[next.winner].name} wins!`);
    }
  };

  const handleReset = () => {
    const next = initialState();
    setState(next);
    broadcast(next);
  };

  if (mode === null) {
    return (
      <div className="pt-10 px-5 max-w-md mx-auto">
        <header className="flex items-center gap-3 mb-8">
          <Link to="/app/play" className="text-candle-muted"><ArrowLeft className="size-5" /></Link>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-petal">Board game</p>
            <h1 className="font-serif text-2xl italic">Ludo 🎲</h1>
          </div>
        </header>

        <div className="space-y-3">
          <button
            onClick={() => {
              if (!partner) { toast.error("Pair with your panda first"); return; }
              setMode("partner");
            }}
            className="w-full p-5 rounded-3xl bg-surface border border-border hover:border-petal/60 text-left flex items-center gap-3"
          >
            <Users className="size-5 text-petal" />
            <div>
              <p className="font-serif italic text-lg">Play with {partner?.display_name ?? "your panda"}</p>
              <p className="text-xs text-candle-muted">Live, synced across your devices.</p>
            </div>
          </button>
          <button
            onClick={() => setMode("local")}
            className="w-full p-5 rounded-3xl bg-surface border border-border hover:border-petal/60 text-left flex items-center gap-3"
          >
            <User className="size-5 text-petal" />
            <div>
              <p className="font-serif italic text-lg">Pass & play</p>
              <p className="text-xs text-candle-muted">One device, two players.</p>
            </div>
          </button>
        </div>

        <div className="mt-8 p-4 rounded-2xl bg-surface border border-border text-xs text-candle-muted space-y-1">
          <p className="text-candle font-medium mb-1">Rules</p>
          <p>• Roll a 6 to release a token from your yard.</p>
          <p>• Land on an opponent to send them back (except ★ safe squares).</p>
          <p>• Roll 6 = extra turn. Three 6s in a row = turn forfeited.</p>
          <p>• Exact roll needed to finish. First to all 4 home wins.</p>
        </div>
      </div>
    );
  }

  const legalIds = new Set(
    legalMoves(state).map((m) => `${m.player}:${m.idx}`),
  );

  // Destination previews (only when it's my turn and no walk in progress).
  const destinations = state.dice != null && !walking && canAct
    ? legalMoves(state)
        .map((t) => {
          const d = destinationOf(t, state.dice!);
          if (d == null || d === 200) return null;
          const [c, r] = cellOf(d, t.player);
          return { key: `${t.player}:${t.idx}`, c, r, color: PLAYER_META[t.player].color };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
    : [];

  return (
    <div className="min-h-screen relative overflow-hidden">
      <LudoAmbient />
      <div className="relative z-10 pt-8 px-4 pb-24 max-w-xl mx-auto">
        <header className="flex items-center justify-between mb-5">
          <button onClick={() => setMode(null)} className="text-candle-muted hover:text-candle transition-colors">
            <ArrowLeft className="size-5" />
          </button>
          <div className="text-center">
            <p className="text-[9px] uppercase tracking-[0.35em] text-petal">Ludo · velveteen</p>
            <p className="text-sm font-serif italic text-candle mt-0.5">
              {state.winner
                ? `${PLAYER_META[state.winner].name} wins ✨`
                : `${PLAYER_META[state.turn].emoji} ${PLAYER_META[state.turn].name}'s turn`}
            </p>
          </div>
          <button
            onClick={handleReset}
            className="p-2 rounded-full bg-surface/70 border border-border text-candle-muted hover:text-candle backdrop-blur"
            title="Reset"
          >
            <RotateCcw className="size-4" />
          </button>
        </header>

        {mode === "partner" && (
          <p className="text-[11px] text-candle-muted mb-3 text-center tracking-wide">
            You are <span className="text-candle">{PLAYER_META[mySeat].emoji} {PLAYER_META[mySeat].name}</span>
            {!canAct && !state.winner && " · waiting for opponent"}
          </p>
        )}

        {/* Board — velvet card */}
        <div
          className="relative rounded-[28px] p-3 sm:p-5 border border-petal/30 bg-surface/70 backdrop-blur-xl shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)] overflow-hidden"
        >
          <div
            className="absolute inset-0 pointer-events-none opacity-40"
            style={{
              background:
                "radial-gradient(120% 80% at 50% 0%, color-mix(in oklab, var(--petal) 22%, transparent), transparent 60%)",
            }}
          />
          <div className="absolute inset-0 pointer-events-none opacity-30 mix-blend-overlay"
            style={{
              background:
                "radial-gradient(60% 40% at 50% 100%, oklch(0.85 0.16 68 / 0.35), transparent 70%)",
            }}
          />
          <div className="relative">
            <LudoBoard
              state={state}
              legalIds={legalIds}
              onMoveToken={handleMove}
              canAct={canAct}
              walking={walking}
              destinations={destinations}
            />
          </div>
        </div>

        {/* Dice + roll — velvet console */}
        <div className="mt-5 relative rounded-3xl p-4 border border-petal/25 bg-surface/60 backdrop-blur-xl shadow-[0_20px_50px_-20px_rgba(0,0,0,0.6)]">
          <div className="flex items-center justify-center gap-5">
            <Die value={state.dice ?? lastRoll} rolling={rolling} active={state.dice != null} />
            <button
              onClick={handleRoll}
              disabled={!canAct || state.dice != null || !!state.winner || rolling}
              className="relative px-7 py-3.5 rounded-2xl font-serif italic text-lg text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 transition-all overflow-hidden group"
              style={{
                background:
                  "linear-gradient(135deg, oklch(0.62 0.22 15) 0%, oklch(0.55 0.24 350) 60%, oklch(0.48 0.22 320) 100%)",
                boxShadow:
                  "0 14px 36px -10px rgba(225,29,116,0.55), inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -6px 12px rgba(0,0,0,0.25)",
              }}
            >
              <span
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                style={{
                  background:
                    "radial-gradient(80% 120% at 50% 0%, rgba(255,255,255,0.28), transparent 60%)",
                }}
              />
              <Dice5 className="size-4 relative" />
              <span className="relative">{rolling ? "Rolling…" : "Roll dice"}</span>
            </button>
          </div>

          <div className="text-center mt-3 min-h-[1.25rem]">
            {state.winner ? null : state.dice != null && legalIds.size > 0 ? (
              <p className="text-xs text-petal tracking-wide">
                Tap a glowing token to move it {state.dice} step{state.dice === 1 ? "" : "s"}.
              </p>
            ) : state.dice != null ? (
              <p className="text-xs text-candle-muted">No legal move — passing turn…</p>
            ) : !canAct && mode === "partner" ? (
              <p className="text-xs text-candle-muted">Waiting for opponent to roll…</p>
            ) : (
              <p className="text-xs text-candle-muted italic">Your turn — roll the dice.</p>
            )}
          </div>
        </div>

        <LudoWinAnimation
          trigger={winTrigger}
          winner={winWho ?? null}
          onDone={() => setDemoWin(null)}
        />

        {mode === "partner" && me && partner && (
          <GameChat
            roomKey={`ludo:${[me.id, partner.id].sort().join(":")}`}
            me={me}
            partnerName={partner.display_name}
            title="Ludo table"
          />
        )}
      </div>
    </div>
  );
}

function LudoAmbient() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <div
        className="absolute -top-24 -left-16 w-80 h-80 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, oklch(0.55 0.22 340 / 0.55), transparent 70%)" }}
      />
      <div
        className="absolute -top-16 -right-16 w-72 h-72 rounded-full opacity-35 blur-3xl"
        style={{ background: "radial-gradient(circle, oklch(0.72 0.16 68 / 0.5), transparent 70%)" }}
      />
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[130%] h-72 opacity-30 blur-3xl"
        style={{ background: "radial-gradient(ellipse, oklch(0.45 0.14 300 / 0.4), transparent 70%)" }}
      />
    </div>
  );
}

function DiePips({ n }: { n: number | null }) {
  const map: Record<number, [number, number][]> = {
    1: [[1,1]],
    2: [[0,0],[2,2]],
    3: [[0,0],[1,1],[2,2]],
    4: [[0,0],[0,2],[2,0],[2,2]],
    5: [[0,0],[0,2],[1,1],[2,0],[2,2]],
    6: [[0,0],[0,2],[1,0],[1,2],[2,0],[2,2]],
  };
  if (n == null) return <span className="font-serif text-3xl italic opacity-50 text-[oklch(0.9_0.1_78)]">·</span>;
  const dots = map[n] ?? [];
  return (
    <div className="grid grid-cols-3 grid-rows-3 gap-[4px] w-[40px] h-[40px]">
      {Array.from({ length: 9 }).map((_, i) => {
        const r = Math.floor(i / 3), c = i % 3;
        const on = dots.some(([dr, dc]) => dr === r && dc === c);
        return (
          <span
            key={i}
            className="rounded-full"
            style={{
              background: on
                ? "radial-gradient(circle at 32% 30%, oklch(0.98 0.08 82) 0%, oklch(0.86 0.16 72) 40%, oklch(0.58 0.15 55) 100%)"
                : "transparent",
              boxShadow: on
                ? "inset 0 -1.5px 1.5px rgba(0,0,0,0.55), inset 0 1px 1px rgba(255,255,255,0.6), 0 0 8px oklch(0.85 0.16 68 / 0.7)"
                : "none",
            }}
          />
        );
      })}
    </div>
  );
}

function Die({ value, rolling, active }: { value: number | null; rolling: boolean; active: boolean }) {
  const [face, setFace] = useState<number | null>(value);
  useEffect(() => {
    if (!rolling) {
      setFace(value);
      return;
    }
    let n = 0;
    const id = window.setInterval(() => {
      n++;
      setFace(1 + Math.floor(Math.random() * 6));
    }, 80);
    return () => window.clearInterval(id);
  }, [rolling, value]);

  return (
    <div
      className="relative flex items-center justify-center rounded-2xl"
      style={{
        width: 72,
        height: 72,
        background:
          "radial-gradient(120% 90% at 30% 20%, oklch(0.44 0.08 320) 0%, oklch(0.28 0.06 320) 45%, oklch(0.15 0.04 320) 100%)",
        border: "1px solid color-mix(in oklab, oklch(0.82 0.14 68) 55%, transparent)",
        boxShadow:
          "inset 0 2px 0 rgba(255,255,255,0.22), inset 0 -8px 16px rgba(0,0,0,0.5), 0 10px 20px rgba(0,0,0,0.45)" +
          (active && !rolling ? ", 0 0 22px oklch(0.85 0.16 68 / 0.35)" : ""),
        animation: rolling ? "ludo-dice-tumble 0.85s cubic-bezier(0.22,1.4,0.36,1)" : undefined,
      }}
    >
      <DiePips n={face} />
    </div>
  );
}



function LudoBoard({
  state,
  legalIds,
  onMoveToken,
  canAct,
  walking,
  destinations,
}: {
  state: State;
  legalIds: Set<string>;
  onMoveToken: (t: Token) => void;
  canAct: boolean;
  walking: { player: Player; idx: number; pos: number } | null;
  destinations: { key: string; c: number; r: number; color: string }[];
}) {
  const CELL = 26;
  const SIZE = 15 * CELL;

  // Group tokens by their rendered cell (using walk-override) so we can offset overlaps.
  const positions = state.tokens.map((t) => {
    const effectivePos =
      walking && walking.player === t.player && walking.idx === t.idx ? walking.pos : t.pos;
    let cx: number, cy: number;
    if (effectivePos === -1) {
      const [c, r] = YARD[t.player][t.idx];
      cx = c * CELL;
      cy = r * CELL;
    } else {
      const [c, r] = cellOf(effectivePos, t.player);
      cx = c * CELL + CELL / 2;
      cy = r * CELL + CELL / 2;
    }
    const isWalking = !!(walking && walking.player === t.player && walking.idx === t.idx);
    return { t, cx, cy, isWalking, effectivePos };
  });
  // Detect overlaps and offset.
  const cellCounts = new Map<string, number>();
  const cellIndex = new Map<string, number>();
  for (const p of positions) {
    if (p.effectivePos === -1) continue;
    const k = `${Math.round(p.cx)},${Math.round(p.cy)}`;
    cellCounts.set(k, (cellCounts.get(k) ?? 0) + 1);
  }

  return (
    <div className="w-full flex justify-center">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="w-full max-w-[440px] rounded-3xl shadow-2xl border border-petal/25"
        style={{
          aspectRatio: "1 / 1",
          background:
            "radial-gradient(120% 90% at 50% 0%, oklch(0.24 0.05 320) 0%, oklch(0.16 0.03 320) 60%, oklch(0.12 0.02 320) 100%)",
        }}
      >
        {/* Yards */}
        <rect x={0} y={9 * CELL} width={6 * CELL} height={6 * CELL} fill={PLAYER_META.red.light} stroke={PLAYER_META.red.color} strokeWidth={2} rx={8} />
        <rect x={9 * CELL} y={0} width={6 * CELL} height={6 * CELL} fill={PLAYER_META.yellow.light} stroke={PLAYER_META.yellow.color} strokeWidth={2} rx={8} />
        {/* Decorative (unused) corners */}
        <rect x={0} y={0} width={6 * CELL} height={6 * CELL} fill="oklch(0.20 0.03 320)" stroke="oklch(0.30 0.04 320)" strokeWidth={2} rx={8} />
        <rect x={9 * CELL} y={9 * CELL} width={6 * CELL} height={6 * CELL} fill="oklch(0.20 0.03 320)" stroke="oklch(0.30 0.04 320)" strokeWidth={2} rx={8} />
        {/* Yard inner circles */}
        {(["red", "yellow"] as Player[]).map((p) =>
          YARD[p].map(([c, r], i) => (
            <circle key={`${p}-yard-${i}`} cx={c * CELL} cy={r * CELL} r={CELL * 0.55} fill="oklch(0.14 0.02 320)" stroke={PLAYER_META[p].color} strokeWidth={2} />
          )),
        )}
        {/* Main track cells */}
        {TRACK.map(([c, r], i) => {
          let fill = "oklch(0.22 0.02 320)";
          if (i === PLAYER_META.red.start) fill = PLAYER_META.red.light;
          if (i === PLAYER_META.yellow.start) fill = PLAYER_META.yellow.light;
          const isStart = i === PLAYER_META.red.start || i === PLAYER_META.yellow.start;
          const startColor = i === PLAYER_META.red.start ? PLAYER_META.red.color : PLAYER_META.yellow.color;
          return (
            <g key={`t-${i}`}>
              <rect
                x={c * CELL + 1}
                y={r * CELL + 1}
                width={CELL - 2}
                height={CELL - 2}
                fill={fill}
                stroke={isStart ? startColor : "oklch(0.35 0.04 320)"}
                strokeWidth={isStart ? 1.6 : 0.8}
                rx={3}
              />
              {SAFE.has(i) && !isStart && (
                <text x={c * CELL + CELL / 2} y={r * CELL + CELL / 2 + 4} textAnchor="middle" fontSize={12} fill="oklch(0.75 0.08 75)">★</text>
              )}
            </g>
          );
        })}

        {/* Entry arrows — sit on the outer edge of each player's colored lane,
            pointing INTO their start cell (classic Ludo layout). */}
        {/* Red: left edge → right into start [1,6] */}
        <g>
          <path
            d={`M ${0.15 * CELL} ${6.5 * CELL} L ${0.9 * CELL} ${6.5 * CELL}`}
            stroke={PLAYER_META.red.color}
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray="3 3"
            opacity={0.9}
          />
          <polygon
            points={`${0.95 * CELL},${6.5 * CELL - 4.5} ${0.95 * CELL},${6.5 * CELL + 4.5} ${1.45 * CELL},${6.5 * CELL}`}
            fill={PLAYER_META.red.color}
            opacity={1}
          />
        </g>
        {/* Yellow: right edge → left into start [13,8] */}
        <g>
          <path
            d={`M ${14.85 * CELL} ${8.5 * CELL} L ${14.1 * CELL} ${8.5 * CELL}`}
            stroke={PLAYER_META.yellow.color}
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray="3 3"
            opacity={0.9}
          />
          <polygon
            points={`${14.05 * CELL},${8.5 * CELL - 4.5} ${14.05 * CELL},${8.5 * CELL + 4.5} ${13.55 * CELL},${8.5 * CELL}`}
            fill={PLAYER_META.yellow.color}
            opacity={1}
          />
        </g>
        {/* Home columns */}
        {HOME_COL.red.map(([c, r], i) => (
          <rect key={`hr-${i}`} x={c * CELL + 1} y={r * CELL + 1} width={CELL - 2} height={CELL - 2} fill={PLAYER_META.red.light} stroke={PLAYER_META.red.color} strokeWidth={1} rx={3} />
        ))}
        {HOME_COL.yellow.map(([c, r], i) => (
          <rect key={`hy-${i}`} x={c * CELL + 1} y={r * CELL + 1} width={CELL - 2} height={CELL - 2} fill={PLAYER_META.yellow.light} stroke={PLAYER_META.yellow.color} strokeWidth={1} rx={3} />
        ))}
        {/* Center diamond */}
        <polygon
          points={`${7 * CELL},${7 * CELL} ${8 * CELL},${7 * CELL} ${7.5 * CELL},${7.5 * CELL}`}
          fill={PLAYER_META.red.color}
        />
        <polygon
          points={`${7 * CELL},${8 * CELL} ${8 * CELL},${8 * CELL} ${7.5 * CELL},${7.5 * CELL}`}
          fill={PLAYER_META.yellow.color}
        />
        <polygon
          points={`${7 * CELL},${7 * CELL} ${7 * CELL},${8 * CELL} ${7.5 * CELL},${7.5 * CELL}`}
          fill="oklch(0.35 0.04 320)"
        />
        <polygon
          points={`${8 * CELL},${7 * CELL} ${8 * CELL},${8 * CELL} ${7.5 * CELL},${7.5 * CELL}`}
          fill="oklch(0.35 0.04 320)"
        />

        {/* Destination previews for the current dice roll */}
        {destinations.map((d) => (
          <g key={`dest-${d.key}`}>
            <circle
              cx={d.c * CELL + CELL / 2}
              cy={d.r * CELL + CELL / 2}
              r={CELL * 0.44}
              fill="none"
              stroke={d.color}
              strokeWidth={1.6}
              strokeDasharray="3 3"
              opacity={0.9}
            >
              <animate attributeName="opacity" values="0.4;1;0.4" dur="1.1s" repeatCount="indefinite" />
              <animateTransform
                attributeName="transform"
                type="rotate"
                from={`0 ${d.c * CELL + CELL / 2} ${d.r * CELL + CELL / 2}`}
                to={`360 ${d.c * CELL + CELL / 2} ${d.r * CELL + CELL / 2}`}
                dur="6s"
                repeatCount="indefinite"
              />
            </circle>
            <circle
              cx={d.c * CELL + CELL / 2}
              cy={d.r * CELL + CELL / 2}
              r={2.5}
              fill={d.color}
              opacity={0.9}
            />
          </g>
        ))}

        {/* Tokens */}
        {positions.map(({ t, cx, cy, isWalking, effectivePos }) => {
          const k = `${Math.round(cx)},${Math.round(cy)}`;
          const count = cellCounts.get(k) ?? 1;
          const idx = (cellIndex.get(k) ?? 0);
          cellIndex.set(k, idx + 1);
          const offset = count > 1 && !isWalking ? 6 : 0;
          const angle = count > 1 && !isWalking ? (idx / count) * Math.PI * 2 : 0;
          const ox = Math.cos(angle) * offset;
          const oy = Math.sin(angle) * offset;
          const isLegal = legalIds.has(`${t.player}:${t.idx}`) && !walking;
          const tokenId = `${t.player}-${t.idx}`;
          if (effectivePos === 200) return null; // hidden at finish
          const tx = cx + ox;
          const ty = cy + oy;
          const walkTransition = "cx 220ms cubic-bezier(0.34,1.56,0.64,1), cy 220ms cubic-bezier(0.34,1.56,0.64,1)";
          const idleTransition = "cx 500ms cubic-bezier(0.4,0,0.2,1), cy 500ms cubic-bezier(0.4,0,0.2,1)";
          const trans = isWalking ? walkTransition : idleTransition;
          return (
            <g
              key={tokenId}
              onClick={() => onMoveToken(t)}
              style={{ cursor: canAct && isLegal ? "pointer" : "default" }}
            >
              {isLegal && canAct && (
                <circle cx={tx} cy={ty} r={CELL * 0.5} fill="none" stroke={PLAYER_META[t.player].color} strokeWidth={2} opacity={0.7} style={{ transition: trans }}>
                  <animate attributeName="r" values={`${CELL * 0.45};${CELL * 0.6};${CELL * 0.45}`} dur="1.2s" repeatCount="indefinite" />
                </circle>
              )}
              {isWalking && (
                <>
                  {/* footprint shadow that squishes with the hop */}
                  <ellipse
                    cx={tx}
                    cy={ty + CELL * 0.32}
                    rx={CELL * 0.32}
                    ry={CELL * 0.09}
                    fill="rgba(0,0,0,0.55)"
                    style={{
                      transition: trans,
                      filter: "blur(2.5px)",
                      transformBox: "fill-box",
                      transformOrigin: "center",
                      animation: "ludo-token-shadow 220ms cubic-bezier(0.34,1.56,0.64,1)",
                    }}
                  />
                  {/* soft glow halo */}
                  <circle
                    cx={tx}
                    cy={ty}
                    r={CELL * 0.6}
                    fill={PLAYER_META[t.player].color}
                    opacity={0.28}
                    style={{ transition: trans, filter: "blur(5px)" }}
                  />
                  {/* stamped ripple at the step */}
                  <circle
                    key={`ripple-${effectivePos}`}
                    cx={tx}
                    cy={ty}
                    r={4}
                    fill="none"
                    stroke={PLAYER_META[t.player].color}
                    strokeWidth={1.5}
                    style={{ animation: "ludo-trail-ripple 420ms ease-out forwards" }}
                  />
                </>
              )}
              <circle
                cx={tx}
                cy={ty}
                r={CELL * 0.38}
                fill={PLAYER_META[t.player].color}
                stroke="white"
                strokeWidth={2}
                style={{
                  transition: trans,
                  transformBox: "fill-box",
                  transformOrigin: "center",
                  animation: isWalking ? "ludo-token-hop 320ms cubic-bezier(0.34,1.7,0.64,1)" : undefined,
                  filter: isWalking ? `drop-shadow(0 4px 6px color-mix(in oklab, ${PLAYER_META[t.player].color} 65%, transparent))` : undefined,
                }}
              />
              <circle
                cx={tx - 3}
                cy={ty - 3}
                r={CELL * 0.12}
                fill="white"
                opacity={0.75}
                style={{ transition: trans }}
              />
            </g>
          );
        })}

        {/* Finished tokens badge */}
        {PLAYERS.map((p) => {
          const done = state.tokens.filter((t) => t.player === p && t.pos === 200).length;
          if (done === 0) return null;
          const x = p === "red" ? 2 * CELL : 12 * CELL;
          const y = p === "red" ? 2 * CELL : 12 * CELL;
          return (
            <g key={`done-${p}`}>
              <circle cx={x} cy={y} r={CELL * 0.7} fill={PLAYER_META[p].color} />
              <text x={x} y={y + 5} textAnchor="middle" fontSize={16} fill="white" fontWeight="bold">{done}/4</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
