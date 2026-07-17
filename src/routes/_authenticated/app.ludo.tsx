import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Dice5, RotateCcw, Users, User } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import {
  initialState,
  applyRoll,
  applyMove,
  legalMoves,
  cellOf,
  rollDie,
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
  const partner = data?.partner;
  const [mode, setMode] = useState<Mode | null>(null);
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
    const key = [me.id, partner.id].sort().join(":");
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
  const handleRoll = () => {
    if (!canAct || state.winner || state.dice != null || rolling) return;
    setRolling(true);
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
    }, 550);
  };

  const handleMove = (t: Token) => {
    if (!canAct || state.dice == null) return;
    const legal = legalMoves(state).some((m) => m.player === t.player && m.idx === t.idx);
    if (!legal) return;
    const next = applyMove(state, t.player, t.idx);
    setState(next);
    broadcast(next);
    if (next.winner) {
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

  return (
    <div className="pt-10 px-4 max-w-xl mx-auto pb-10">
      <header className="flex items-center gap-3 mb-4">
        <button onClick={() => setMode(null)} className="text-candle-muted"><ArrowLeft className="size-5" /></button>
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-widest text-petal">Ludo</p>
          <h1 className="font-serif text-xl italic">
            {state.winner
              ? `${PLAYER_META[state.winner].name} wins ✨`
              : `${PLAYER_META[state.turn].emoji} ${PLAYER_META[state.turn].name}'s turn`}
          </h1>
        </div>
        <button onClick={handleReset} className="p-2 rounded-full bg-surface border border-border text-candle-muted hover:text-candle" title="Reset">
          <RotateCcw className="size-4" />
        </button>
      </header>

      {mode === "partner" && (
        <p className="text-[11px] text-candle-muted mb-2 text-center">
          You are {PLAYER_META[mySeat].emoji} {PLAYER_META[mySeat].name}
          {!canAct && !state.winner && " · waiting for opponent"}
        </p>
      )}

      <LudoBoard state={state} legalIds={legalIds} onMoveToken={handleMove} canAct={canAct} />

      <div className="mt-5 flex items-center justify-center gap-4">
        <Die value={state.dice ?? lastRoll} rolling={rolling} active={state.dice != null} />
        <button
          onClick={handleRoll}
          disabled={!canAct || state.dice != null || !!state.winner || rolling}
          className="px-6 py-3 rounded-2xl bg-petal text-white font-serif italic text-lg disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shadow-[0_10px_30px_-8px_rgba(225,29,116,0.6)] hover:shadow-[0_14px_36px_-8px_rgba(225,29,116,0.75)] transition-shadow"
        >
          <Dice5 className="size-4" />
          {rolling ? "Rolling…" : "Roll dice"}
        </button>
      </div>

      <div className="text-center mt-3 min-h-[1.25rem]">
        {state.winner ? null : state.dice != null && legalIds.size > 0 ? (
          <p className="text-xs text-petal">Tap a glowing token to move it {state.dice} step{state.dice === 1 ? "" : "s"}.</p>
        ) : state.dice != null ? (
          <p className="text-xs text-candle-muted">No legal move — passing turn…</p>
        ) : !canAct && mode === "partner" ? (
          <p className="text-xs text-candle-muted">Waiting for opponent to roll…</p>
        ) : (
          <p className="text-xs text-candle-muted">Your turn — roll the dice.</p>
        )}
      </div>
    </div>
  );
}

function Die({ value, rolling, active }: { value: number | null; rolling: boolean; active: boolean }) {
  return (
    <div
      className={`w-16 h-16 rounded-2xl border flex items-center justify-center text-3xl font-serif shadow-inner transition-all ${rolling ? "animate-pulse" : ""} ${active ? "border-petal shadow-[0_0_20px_-4px_var(--petal)]" : "border-petal/30 opacity-80"}`}
      style={{
        background:
          "linear-gradient(145deg, oklch(0.28 0.05 320), oklch(0.18 0.03 320))",
        color: "oklch(0.92 0.08 75)",
      }}
    >
      {rolling ? "🎲" : value ?? "·"}
    </div>
  );
}

function LudoBoard({
  state,
  legalIds,
  onMoveToken,
  canAct,
}: {
  state: State;
  legalIds: Set<string>;
  onMoveToken: (t: Token) => void;
  canAct: boolean;
}) {
  const CELL = 26;
  const SIZE = 15 * CELL;

  // Group tokens by their rendered cell so we can offset when overlapping.
  const positions = state.tokens.map((t) => {
    let cx: number, cy: number;
    if (t.pos === -1) {
      const [c, r] = YARD[t.player][t.idx];
      cx = c * CELL;
      cy = r * CELL;
    } else {
      const [c, r] = cellOf(t.pos, t.player);
      cx = c * CELL + CELL / 2;
      cy = r * CELL + CELL / 2;
    }
    return { t, cx, cy };
  });
  // Detect overlaps and offset.
  const cellCounts = new Map<string, number>();
  const cellIndex = new Map<string, number>();
  for (const p of positions) {
    if (p.t.pos === -1) continue;
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
          return (
            <g key={`t-${i}`}>
              <rect x={c * CELL + 1} y={r * CELL + 1} width={CELL - 2} height={CELL - 2} fill={fill} stroke="oklch(0.35 0.04 320)" strokeWidth={0.8} rx={3} />
              {SAFE.has(i) && (
                <text x={c * CELL + CELL / 2} y={r * CELL + CELL / 2 + 4} textAnchor="middle" fontSize={12} fill="oklch(0.75 0.08 75)">★</text>
              )}
            </g>
          );
        })}
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

        {/* Tokens */}
        {positions.map(({ t, cx, cy }) => {
          const k = `${Math.round(cx)},${Math.round(cy)}`;
          const count = cellCounts.get(k) ?? 1;
          const idx = (cellIndex.get(k) ?? 0);
          cellIndex.set(k, idx + 1);
          const offset = count > 1 ? 6 : 0;
          const angle = count > 1 ? (idx / count) * Math.PI * 2 : 0;
          const ox = Math.cos(angle) * offset;
          const oy = Math.sin(angle) * offset;
          const isLegal = legalIds.has(`${t.player}:${t.idx}`);
          const tokenId = `${t.player}-${t.idx}`;
          if (t.pos === 200) return null; // hidden at finish
          return (
            <g
              key={tokenId}
              onClick={() => onMoveToken(t)}
              style={{ cursor: canAct && isLegal ? "pointer" : "default" }}
            >
              {isLegal && canAct && (
                <circle cx={cx + ox} cy={cy + oy} r={CELL * 0.5} fill="none" stroke={PLAYER_META[t.player].color} strokeWidth={2} opacity={0.7}>
                  <animate attributeName="r" values={`${CELL * 0.45};${CELL * 0.6};${CELL * 0.45}`} dur="1.2s" repeatCount="indefinite" />
                </circle>
              )}
              <circle
                cx={cx + ox}
                cy={cy + oy}
                r={CELL * 0.38}
                fill={PLAYER_META[t.player].color}
                stroke="white"
                strokeWidth={2}
              />
              <circle cx={cx + ox - 3} cy={cy + oy - 3} r={CELL * 0.12} fill="white" opacity={0.6} />
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
