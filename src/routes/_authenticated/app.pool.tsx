import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { ArrowLeft, RotateCcw, Trophy } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { GameChat } from "@/components/games/GameChat";
import {
  sfxPoolCue,
  sfxPoolClick,
  sfxPoolRail,
  sfxPoolPocket,
  sfxPoolWin,
} from "@/lib/sfx";

export const Route = createFileRoute("/_authenticated/app/pool")({
  head: () => ({
    meta: [
      { title: "8-Ball Pool — Pandacine" },
      { name: "description", content: "Velvet 2-player 8-ball pool table." },
    ],
  }),
  component: PoolPage,
});

// -------------------- Table constants --------------------
// Playing surface (inner felt) in "table units". Rendered by CSS scaling.
const W = 900; // table interior width
const H = 500; // table interior height
const R = 14;  // ball radius
const POCKET_R = 26; // pocket capture radius
const FRICTION = 0.988; // per-frame velocity decay
const MIN_V = 0.05; // below this a ball is at rest
const RESTITUTION = 0.98; // wall/ball bounciness
const MAX_POWER = 34;

type Group = "solid" | "stripe" | "eight" | "cue";
type Ball = {
  id: number;   // 0 = cue, 1..7 solids, 8 = eight, 9..15 stripes
  x: number;
  y: number;
  vx: number;
  vy: number;
  group: Group;
  color: string;
  pocketed: boolean;
  // animation state after pocketing
  sinkT: number; // 0 -> 1 while shrinking into pocket
  pocketX?: number;
  pocketY?: number;
};

// Classic 8-ball colors (approx.)
const BALL_COLORS: Record<number, string> = {
  0: "#f8f3e6", // cue — ivory
  1: "#f2b807", // yellow
  2: "#123f8e", // blue
  3: "#c62828", // red
  4: "#5b2c8a", // purple
  5: "#e07a1f", // orange
  6: "#1f6b3a", // green
  7: "#6b1414", // maroon
  8: "#141414", // 8 ball
  9: "#f2b807", 10: "#123f8e", 11: "#c62828", 12: "#5b2c8a",
  13: "#e07a1f", 14: "#1f6b3a", 15: "#6b1414",
};

function groupOf(id: number): Group {
  if (id === 0) return "cue";
  if (id === 8) return "eight";
  return id < 8 ? "solid" : "stripe";
}

// Six pocket positions (top-left, top-mid, top-right, and bottom row).
const POCKETS: { x: number; y: number }[] = [
  { x: 0, y: 0 },
  { x: W / 2, y: -6 },
  { x: W, y: 0 },
  { x: 0, y: H },
  { x: W / 2, y: H + 6 },
  { x: W, y: H },
];

function makeRack(): Ball[] {
  // Cue ball on the "head spot"
  const balls: Ball[] = [];
  balls.push({
    id: 0, x: W * 0.22, y: H / 2, vx: 0, vy: 0,
    group: "cue", color: BALL_COLORS[0], pocketed: false, sinkT: 0,
  });

  // Rack the 15 balls in a triangle on the "foot spot"
  const apexX = W * 0.72;
  const apexY = H / 2;
  const dx = R * Math.sqrt(3) * 1.02;
  const dy = R * 2 * 1.02;
  // Standard-ish rack: 8-ball in center of 3rd row, corners one solid one stripe.
  const order = [
    [1],           // row 0 apex — solid
    [9, 2],        // row 1
    [10, 8, 3],    // row 2 — 8 in the middle
    [11, 4, 12, 5],// row 3
    [6, 13, 7, 14, 15], // row 4
  ];
  order.forEach((row, ri) => {
    row.forEach((id, ci) => {
      const x = apexX + ri * dx;
      const y = apexY + (ci - ri / 2) * dy;
      balls.push({
        id, x, y, vx: 0, vy: 0,
        group: groupOf(id), color: BALL_COLORS[id], pocketed: false, sinkT: 0,
      });
    });
  });
  return balls;
}

// -------------------- Physics --------------------
function step(balls: Ball[], onRail: () => void, onClick: () => void, onPocket: (b: Ball) => void) {
  // Integrate
  for (const b of balls) {
    if (b.pocketed) {
      if (b.sinkT < 1) b.sinkT = Math.min(1, b.sinkT + 0.08);
      continue;
    }
    b.x += b.vx;
    b.y += b.vy;
    b.vx *= FRICTION;
    b.vy *= FRICTION;
    if (Math.hypot(b.vx, b.vy) < MIN_V) { b.vx = 0; b.vy = 0; }
  }
  // Walls
  for (const b of balls) {
    if (b.pocketed) continue;
    if (b.x < R) { b.x = R; b.vx = -b.vx * RESTITUTION; if (Math.abs(b.vx) > 0.5) onRail(); }
    if (b.x > W - R) { b.x = W - R; b.vx = -b.vx * RESTITUTION; if (Math.abs(b.vx) > 0.5) onRail(); }
    if (b.y < R) { b.y = R; b.vy = -b.vy * RESTITUTION; if (Math.abs(b.vy) > 0.5) onRail(); }
    if (b.y > H - R) { b.y = H - R; b.vy = -b.vy * RESTITUTION; if (Math.abs(b.vy) > 0.5) onRail(); }
  }
  // Ball-ball
  for (let i = 0; i < balls.length; i++) {
    for (let j = i + 1; j < balls.length; j++) {
      const a = balls[i], c = balls[j];
      if (a.pocketed || c.pocketed) continue;
      const dx = c.x - a.x, dy = c.y - a.y;
      const d2 = dx * dx + dy * dy;
      const min = R * 2;
      if (d2 > 0 && d2 < min * min) {
        const d = Math.sqrt(d2);
        const nx = dx / d, ny = dy / d;
        // resolve overlap
        const overlap = (min - d) / 2;
        a.x -= nx * overlap; a.y -= ny * overlap;
        c.x += nx * overlap; c.y += ny * overlap;
        // relative velocity along normal
        const rvx = c.vx - a.vx, rvy = c.vy - a.vy;
        const vn = rvx * nx + rvy * ny;
        if (vn < 0) {
          const impulse = -(1 + RESTITUTION) * vn / 2;
          const ix = impulse * nx, iy = impulse * ny;
          a.vx -= ix; a.vy -= iy;
          c.vx += ix; c.vy += iy;
          if (Math.abs(vn) > 1) onClick();
        }
      }
    }
  }
  // Pockets
  for (const b of balls) {
    if (b.pocketed) continue;
    for (const p of POCKETS) {
      if (Math.hypot(b.x - p.x, b.y - p.y) < POCKET_R) {
        b.pocketed = true;
        b.vx = 0; b.vy = 0; b.sinkT = 0;
        b.pocketX = p.x; b.pocketY = p.y;
        onPocket(b);
        break;
      }
    }
  }
}

function anyMoving(balls: Ball[]) {
  return balls.some((b) => !b.pocketed && (b.vx !== 0 || b.vy !== 0));
}

// -------------------- Component --------------------
type Assignment = null | "solid" | "stripe";
type Player = 0 | 1;

function PoolPage() {
  const { data } = useProfile();
  const me = useMemo(() => data?.profile ? { id: data.profile.id, display_name: data.profile.display_name } : null, [data]);
  const partner = data?.partner;
  const roomKey = useMemo(() => {
    const ids = [me?.id, partner?.id].filter(Boolean).sort();
    return ids.length === 2 ? `pool:${ids.join(":")}` : "";
  }, [me?.id, partner?.id]);

  const [balls, setBalls] = useState<Ball[]>(() => makeRack());
  const [turn, setTurn] = useState<Player>(0);
  const [assign, setAssign] = useState<[Assignment, Assignment]>([null, null]);
  const [pocketedThisTurn, setPocketedThisTurn] = useState<Ball[]>([]);
  const [winner, setWinner] = useState<Player | null>(null);
  const [message, setMessage] = useState<string>("Break!");

  // aim state
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [mouse, setMouse] = useState<{ x: number; y: number } | null>(null);
  const [drag, setDrag] = useState<{ startX: number; startY: number } | null>(null);
  const [power, setPower] = useState(0);

  const ballsRef = useRef(balls);
  ballsRef.current = balls;
  const movingRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const turnEndedRef = useRef(false);

  // Animate physics
  useEffect(() => {
    let last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(32, t - last); last = t;
      // fixed-ish 60fps steps
      const steps = Math.max(1, Math.round(dt / 16));
      for (let i = 0; i < steps; i++) {
        step(
          ballsRef.current,
          () => sfxPoolRail(),
          () => sfxPoolClick(),
          (b) => {
            sfxPoolPocket();
            setPocketedThisTurn((s) => [...s, b]);
          },
        );
      }
      const stillMoving = anyMoving(ballsRef.current);
      setBalls([...ballsRef.current]);
      if (!stillMoving && movingRef.current && !turnEndedRef.current) {
        movingRef.current = false;
        turnEndedRef.current = true;
        // Resolve turn on next tick so pocketedThisTurn state is committed
        setTimeout(resolveTurn, 0);
      } else if (stillMoving) {
        movingRef.current = true;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cueBall = balls.find((b) => b.id === 0);
  const canShoot = !winner && cueBall && !anyMoving(balls);

  // -------- Shooting --------
  const toSvg = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    const m = svg.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const p = pt.matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  }, []);

  const onMove = (e: React.PointerEvent) => {
    if (!canShoot) return;
    const p = toSvg(e.clientX, e.clientY);
    setMouse(p);
    if (drag && cueBall) {
      const dx = cueBall.x - p.x;
      const dy = cueBall.y - p.y;
      const dist = Math.hypot(dx, dy);
      setPower(Math.min(MAX_POWER, dist * 0.08));
    }
  };
  const onDown = (e: React.PointerEvent) => {
    if (!canShoot || !cueBall) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = toSvg(e.clientX, e.clientY);
    setDrag({ startX: p.x, startY: p.y });
    setMouse(p);
  };
  const onUp = () => {
    if (!drag || !cueBall || !mouse) { setDrag(null); return; }
    if (power < 1) { setDrag(null); setPower(0); return; }
    // Direction is from cursor toward cue (pulling back releases forward).
    const dx = cueBall.x - mouse.x;
    const dy = cueBall.y - mouse.y;
    const len = Math.hypot(dx, dy) || 1;
    cueBall.vx = (dx / len) * power;
    cueBall.vy = (dy / len) * power;
    sfxPoolCue();
    setBalls([...ballsRef.current]);
    setDrag(null);
    setPower(0);
    setPocketedThisTurn([]);
    turnEndedRef.current = false;
    movingRef.current = true;
  };

  // -------- Turn resolution --------
  const resolveTurn = () => {
    const pocketed = pocketedThisTurn;
    setPocketedThisTurn([]);

    const cueSunk = pocketed.some((b) => b.id === 0);
    const eightSunk = pocketed.some((b) => b.id === 8);
    const other = (turn === 0 ? 1 : 0) as Player;

    // Re-spot cue ball if scratched
    if (cueSunk) {
      const cb = ballsRef.current.find((b) => b.id === 0);
      if (cb) { cb.pocketed = false; cb.sinkT = 0; cb.x = W * 0.22; cb.y = H / 2; cb.vx = 0; cb.vy = 0; }
    }

    // Assign groups on first legit pocket
    let a: [Assignment, Assignment] = [...assign] as [Assignment, Assignment];
    if (!a[0] && !a[1]) {
      const first = pocketed.find((b) => b.group === "solid" || b.group === "stripe");
      if (first) {
        a = turn === 0
          ? [first.group as Assignment, first.group === "solid" ? "stripe" : "solid"]
          : [first.group === "solid" ? "stripe" : "solid", first.group as Assignment];
        setAssign(a);
      }
    }

    // Win / loss on 8-ball
    if (eightSunk) {
      const myGroup = a[turn];
      const myLeft = ballsRef.current.filter((b) => !b.pocketed && b.group === myGroup).length;
      if (myGroup && myLeft === 0 && !cueSunk) {
        setWinner(turn); sfxPoolWin(); setMessage(`Player ${turn + 1} wins!`);
        return;
      } else {
        setWinner(other); sfxPoolWin(); setMessage(`Player ${other + 1} wins — 8-ball early.`);
        return;
      }
    }

    // Continue turn if player pocketed one of their own and didn't scratch
    const myGroup = a[turn];
    const pocketedMine = myGroup ? pocketed.some((b) => b.group === myGroup) : false;
    const shouldContinue = pocketedMine && !cueSunk;

    if (!shouldContinue) setTurn(other);
    setMessage(
      cueSunk
        ? "Scratch — cue ball re-spotted"
        : pocketed.length
          ? `Sunk ${pocketed.filter(b => b.id !== 0).length}${shouldContinue ? " — go again" : ""}`
          : "Miss",
    );
  };

  const resetGame = () => {
    setBalls(makeRack());
    setTurn(0);
    setAssign([null, null]);
    setPocketedThisTurn([]);
    setWinner(null);
    setMessage("Break!");
    movingRef.current = false;
    turnEndedRef.current = false;
  };

  // -------- Aim geometry --------
  const aimEnd = useMemo(() => {
    if (!cueBall || !mouse || !canShoot) return null;
    // Line from cue in the shot direction (opposite of cursor from cue).
    const dx = cueBall.x - mouse.x;
    const dy = cueBall.y - mouse.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: cueBall.x + (dx / len) * 340, y: cueBall.y + (dy / len) * 340 };
  }, [cueBall, mouse, canShoot]);

  const cuePreview = useMemo(() => {
    if (!cueBall || !mouse || !canShoot) return null;
    // The visible cue stick sits behind the cue (on cursor side), pulled back by drag amount.
    const dx = mouse.x - cueBall.x;
    const dy = mouse.y - cueBall.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const pullback = drag ? Math.min(60, power * 4) : 20;
    const near = { x: cueBall.x + ux * (R + 8 + pullback), y: cueBall.y + uy * (R + 8 + pullback) };
    const far = { x: near.x + ux * 220, y: near.y + uy * 220 };
    return { near, far };
  }, [cueBall, mouse, canShoot, drag, power]);

  const solidsLeft = balls.filter((b) => !b.pocketed && b.group === "solid").length;
  const stripesLeft = balls.filter((b) => !b.pocketed && b.group === "stripe").length;

  return (
    <div className="min-h-screen bg-velvet text-candle relative overflow-hidden">
      {/* Ambient aurora */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-32 size-[420px] rounded-full blur-3xl opacity-30" style={{ background: "radial-gradient(circle, #b8323f 0%, transparent 70%)" }} />
        <div className="absolute -bottom-32 -right-32 size-[520px] rounded-full blur-3xl opacity-25" style={{ background: "radial-gradient(circle, #d4a24a 0%, transparent 70%)" }} />
      </div>

      <header className="relative z-10 flex items-center justify-between gap-3 px-5 pt-8 pb-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <Link to="/app/play" className="text-candle-muted"><ArrowLeft className="size-5" /></Link>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-petal">Salon table</p>
            <h1 className="font-serif italic text-2xl">8-Ball Pool</h1>
          </div>
        </div>
        <button
          onClick={resetGame}
          className="flex items-center gap-2 rounded-full border border-petal/40 bg-petal-soft/30 backdrop-blur px-4 py-1.5 text-sm hover:bg-petal-soft/60 transition"
        >
          <RotateCcw className="size-4" /> New rack
        </button>
      </header>

      {/* Score & turn */}
      <div className="relative z-10 max-w-6xl mx-auto px-5 flex items-center justify-between gap-3 mb-3 text-xs">
        <div className={`flex items-center gap-2 rounded-full px-3 py-1 border ${turn === 0 && !winner ? "border-petal bg-petal-soft/30" : "border-border/40"}`}>
          <span className={`size-2.5 rounded-full ${assign[0] === "solid" ? "bg-red-500" : assign[0] === "stripe" ? "bg-yellow-400 ring-2 ring-white/40" : "bg-white/40"}`} />
          <span className="font-serif italic">Player 1</span>
          {assign[0] && <span className="text-candle-muted">— {assign[0] === "solid" ? solidsLeft : stripesLeft} left</span>}
        </div>
        <p className="text-candle-muted font-serif italic">{message}</p>
        <div className={`flex items-center gap-2 rounded-full px-3 py-1 border ${turn === 1 && !winner ? "border-petal bg-petal-soft/30" : "border-border/40"}`}>
          <span className={`size-2.5 rounded-full ${assign[1] === "solid" ? "bg-red-500" : assign[1] === "stripe" ? "bg-yellow-400 ring-2 ring-white/40" : "bg-white/40"}`} />
          <span className="font-serif italic">Player 2</span>
          {assign[1] && <span className="text-candle-muted">— {assign[1] === "solid" ? solidsLeft : stripesLeft} left</span>}
        </div>
      </div>

      {/* Table */}
      <div className="relative z-10 max-w-6xl mx-auto px-3 pb-24">
        <div
          className="relative rounded-[36px] p-4 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)]"
          style={{
            background: "linear-gradient(145deg, #5a2418 0%, #3a170e 50%, #2a0f08 100%)",
            border: "1px solid rgba(212,162,74,0.35)",
          }}
        >
          {/* Gold trim */}
          <div className="absolute inset-2 rounded-[30px] pointer-events-none" style={{ border: "1px solid rgba(212,162,74,0.25)" }} />
          <svg
            ref={svgRef}
            viewBox={`-30 -30 ${W + 60} ${H + 60}`}
            className="w-full h-auto rounded-2xl select-none touch-none"
            onPointerMove={onMove}
            onPointerDown={onDown}
            onPointerUp={onUp}
            onPointerCancel={() => setDrag(null)}
            onPointerLeave={() => { setMouse(null); if (drag) setDrag(null); }}
          >
            <defs>
              <radialGradient id="feltGrad" cx="50%" cy="45%" r="70%">
                <stop offset="0%" stopColor="#1e6d43" />
                <stop offset="60%" stopColor="#134a2d" />
                <stop offset="100%" stopColor="#0a2e1c" />
              </radialGradient>
              <radialGradient id="pocketGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#000" />
                <stop offset="70%" stopColor="#000" />
                <stop offset="100%" stopColor="#1a1a1a" />
              </radialGradient>
              <linearGradient id="cueStick" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#f4e4c8" />
                <stop offset="60%" stopColor="#8b5a2b" />
                <stop offset="100%" stopColor="#3a1f0a" />
              </linearGradient>
              {/* Ball highlights */}
              <radialGradient id="ballShine" cx="35%" cy="30%" r="60%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.85)" />
                <stop offset="30%" stopColor="rgba(255,255,255,0.15)" />
                <stop offset="100%" stopColor="rgba(0,0,0,0.35)" />
              </radialGradient>
            </defs>

            {/* Felt */}
            <rect x={-4} y={-4} width={W + 8} height={H + 8} rx={14} fill="url(#feltGrad)" />
            {/* Diamond markers on rails */}
            {[0.2, 0.4, 0.6, 0.8].flatMap((f, i) => [
              <circle key={`t${i}`} cx={W * f} cy={-16} r={2.2} fill="#d4a24a" opacity={0.7} />,
              <circle key={`b${i}`} cx={W * f} cy={H + 16} r={2.2} fill="#d4a24a" opacity={0.7} />,
            ])}
            {[0.25, 0.5, 0.75].flatMap((f, i) => [
              <circle key={`l${i}`} cx={-16} cy={H * f} r={2.2} fill="#d4a24a" opacity={0.7} />,
              <circle key={`r${i}`} cx={W + 16} cy={H * f} r={2.2} fill="#d4a24a" opacity={0.7} />,
            ])}

            {/* Head-string line */}
            <line x1={W * 0.25} y1={4} x2={W * 0.25} y2={H - 4} stroke="rgba(255,255,255,0.08)" strokeDasharray="3 6" />
            <circle cx={W * 0.72} cy={H / 2} r={3} fill="rgba(255,255,255,0.12)" />

            {/* Pockets */}
            {POCKETS.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={POCKET_R} fill="url(#pocketGrad)" stroke="#0a0a0a" strokeWidth={2} />
            ))}

            {/* Aim guide */}
            {aimEnd && cueBall && (
              <line
                x1={cueBall.x} y1={cueBall.y}
                x2={aimEnd.x} y2={aimEnd.y}
                stroke="rgba(255,255,255,0.35)"
                strokeWidth={1.2}
                strokeDasharray="4 6"
              />
            )}

            {/* Cue stick preview */}
            {cuePreview && (
              <line
                x1={cuePreview.near.x} y1={cuePreview.near.y}
                x2={cuePreview.far.x} y2={cuePreview.far.y}
                stroke="url(#cueStick)"
                strokeWidth={6}
                strokeLinecap="round"
                opacity={0.95}
              />
            )}

            {/* Balls */}
            {balls.map((b) => {
              if (b.pocketed && b.sinkT >= 1) return null;
              const scale = b.pocketed ? 1 - b.sinkT : 1;
              const cx = b.pocketed && b.pocketX != null ? b.x + (b.pocketX - b.x) * b.sinkT : b.x;
              const cy = b.pocketed && b.pocketY != null ? b.y + (b.pocketY - b.y) * b.sinkT : b.y;
              const r = R * scale;
              return (
                <g key={b.id} transform={`translate(${cx} ${cy})`} opacity={scale}>
                  {/* Base */}
                  <circle r={r} fill={b.color} />
                  {/* Stripe belt */}
                  {b.group === "stripe" && (
                    <g>
                      <rect x={-r} y={-r * 0.42} width={r * 2} height={r * 0.84} fill="#f8f3e6" />
                      <rect x={-r} y={-r * 0.42} width={r * 2} height={r * 0.84} fill={b.color} opacity={0.0} />
                      <circle r={r} fill={b.color} style={{ mixBlendMode: "multiply" }} opacity={0} />
                    </g>
                  )}
                  {/* Number badge */}
                  {b.id !== 0 && (
                    <g>
                      <circle r={r * 0.42} fill="#f8f3e6" />
                      <text
                        y={r * 0.16}
                        textAnchor="middle"
                        fontSize={r * 0.7}
                        fontFamily="serif"
                        fontWeight={700}
                        fill="#141414"
                      >{b.id}</text>
                    </g>
                  )}
                  {/* Shine */}
                  <circle r={r} fill="url(#ballShine)" pointerEvents="none" />
                </g>
              );
            })}

            {/* Power meter overlay near cursor while dragging */}
            {drag && mouse && (
              <g transform={`translate(${mouse.x} ${mouse.y - 30})`}>
                <rect x={-40} y={-6} width={80} height={10} rx={5} fill="rgba(0,0,0,0.55)" />
                <rect x={-38} y={-4} width={(power / MAX_POWER) * 76} height={6} rx={3} fill="#d4a24a" />
              </g>
            )}
          </svg>

          <p className="mt-3 text-[11px] text-candle-muted text-center font-serif italic">
            Drag from the cue ball — direction sets aim, distance sets power.
          </p>
        </div>
      </div>

      {/* Winner overlay */}
      {winner !== null && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="rounded-3xl bg-velvet border border-petal/40 px-8 py-7 text-center shadow-2xl max-w-sm">
            <Trophy className="size-8 text-petal mx-auto mb-2" />
            <p className="text-[10px] uppercase tracking-widest text-petal">Match</p>
            <h2 className="font-serif italic text-3xl mt-1">Player {winner + 1} wins</h2>
            <p className="text-sm text-candle-muted mt-2">{message}</p>
            <button onClick={resetGame} className="mt-5 w-full rounded-full bg-gradient-to-r from-petal to-rose-500 text-white font-serif italic px-6 py-2.5">
              Rack again
            </button>
          </div>
        </div>
      )}

      {roomKey && (
        <GameChat roomKey={roomKey} me={me} partnerName={partner?.display_name} title="Table talk" />
      )}
    </div>
  );
}
