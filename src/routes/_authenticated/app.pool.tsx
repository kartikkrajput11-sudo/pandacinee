import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { ArrowLeft, RotateCcw, Trophy, Hand, Wifi, WifiOff } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { useMatchOpponent } from "@/hooks/useMatchOpponent";
import { GameChat } from "@/components/games/GameChat";
import { GroupPlayersBar } from "@/components/games/GroupPlayersBar";
import { supabase } from "@/integrations/supabase/client";
import {
  sfxPoolCue,
  sfxPoolClick,
  sfxPoolRail,
  sfxPoolPocket,
  sfxPoolWin,
} from "@/lib/sfx";

export const Route = createFileRoute("/_authenticated/app/pool")({
  validateSearch: (search: Record<string, unknown>) => ({
    matchId: typeof search.matchId === "string" ? search.matchId : undefined,
  }),
  head: () => ({
    meta: [
      { title: "8-Ball Pool — Pandacine" },
      { name: "description", content: "Velvet 2-player 8-ball pool table." },
    ],
  }),
  component: PoolPage,
});

// -------------------- Table constants --------------------
const W = 900;
const H = 500;
const R = 14;
const POCKET_R = 24;
const FRICTION = 0.988;
const MIN_V = 0.05;
const RESTITUTION = 0.96;
const MAX_POWER = 34;

type Group = "solid" | "stripe" | "eight" | "cue";
type Ball = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  group: Group;
  color: string;
  pocketed: boolean;
  sinkT: number;
  pocketX?: number;
  pocketY?: number;
};

const BALL_COLORS: Record<number, string> = {
  0: "#f8f3e6",
  1: "#f2b807",  // yellow
  2: "#123f8e",  // blue
  3: "#c62828",  // red
  4: "#5b2c8a",  // purple
  5: "#e07a1f",  // orange
  6: "#1f6b3a",  // green
  7: "#6b1414",  // maroon
  8: "#141414",
  9: "#f2b807", 10: "#123f8e", 11: "#c62828", 12: "#5b2c8a",
  13: "#e07a1f", 14: "#1f6b3a", 15: "#6b1414",
};

function groupOf(id: number): Group {
  if (id === 0) return "cue";
  if (id === 8) return "eight";
  return id < 8 ? "solid" : "stripe";
}

const POCKETS: { x: number; y: number }[] = [
  { x: 0, y: 0 },
  { x: W / 2, y: -6 },
  { x: W, y: 0 },
  { x: 0, y: H },
  { x: W / 2, y: H + 6 },
  { x: W, y: H },
];

const HEAD_SPOT_X = W * 0.22;
const FOOT_SPOT_X = W * 0.72;

function makeRack(): Ball[] {
  const balls: Ball[] = [];
  balls.push({
    id: 0, x: HEAD_SPOT_X, y: H / 2, vx: 0, vy: 0,
    group: "cue", color: BALL_COLORS[0], pocketed: false, sinkT: 0,
  });
  const apexX = FOOT_SPOT_X;
  const apexY = H / 2;
  const dx = R * Math.sqrt(3) * 1.02;
  const dy = R * 2 * 1.02;
  const order = [
    [1],
    [9, 2],
    [10, 8, 3],
    [11, 4, 12, 5],
    [6, 13, 7, 14, 15],
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
type FirstHit = { id: number | null };

function step(
  balls: Ball[],
  onRail: () => void,
  onClick: () => void,
  onPocket: (b: Ball) => void,
  firstHit: FirstHit,
) {
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
  for (const b of balls) {
    if (b.pocketed) continue;
    if (b.x < R) { b.x = R; b.vx = -b.vx * RESTITUTION; if (Math.abs(b.vx) > 0.5) onRail(); }
    if (b.x > W - R) { b.x = W - R; b.vx = -b.vx * RESTITUTION; if (Math.abs(b.vx) > 0.5) onRail(); }
    if (b.y < R) { b.y = R; b.vy = -b.vy * RESTITUTION; if (Math.abs(b.vy) > 0.5) onRail(); }
    if (b.y > H - R) { b.y = H - R; b.vy = -b.vy * RESTITUTION; if (Math.abs(b.vy) > 0.5) onRail(); }
  }
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
        const overlap = (min - d) / 2;
        a.x -= nx * overlap; a.y -= ny * overlap;
        c.x += nx * overlap; c.y += ny * overlap;
        const rvx = c.vx - a.vx, rvy = c.vy - a.vy;
        const vn = rvx * nx + rvy * ny;
        if (vn < 0) {
          const impulse = -(1 + RESTITUTION) * vn / 2;
          const ix = impulse * nx, iy = impulse * ny;
          a.vx -= ix; a.vy -= iy;
          c.vx += ix; c.vy += iy;
          if (Math.abs(vn) > 1) onClick();
          // record first-hit against cue ball
          if (firstHit.id === null) {
            if (a.id === 0 && c.id !== 0) firstHit.id = c.id;
            else if (c.id === 0 && a.id !== 0) firstHit.id = a.id;
          }
        }
      }
    }
  }
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

function overlapsAny(balls: Ball[], x: number, y: number, ignoreId = -1) {
  return balls.some((b) => !b.pocketed && b.id !== ignoreId && Math.hypot(b.x - x, b.y - y) < R * 2 + 0.5);
}

// -------------------- Component --------------------
type Assignment = null | "solid" | "stripe";
type Player = 0 | 1;

function PoolPage() {
  const { data } = useProfile();
  const me = useMemo(() => data?.profile ? { id: data.profile.id, display_name: data.profile.display_name } : null, [data]);
  const { matchId } = Route.useSearch();
  const { opponentId: matchOppId } = useMatchOpponent(matchId, me?.id);
  const partner = matchId
    ? (matchOppId ? { id: matchOppId, display_name: "Partner" } : null)
    : data?.partner;
  const roomKey = useMemo(() => {
    if (matchId) return `pool:match:${matchId}`;
    const ids = [me?.id, partner?.id].filter(Boolean).sort();
    return ids.length === 2 ? `pool:${ids.join(":")}` : "";
  }, [matchId, me?.id, partner?.id]);
  // Deterministic seat: lower sorted user id = seat 0
  const mySeat = useMemo<Player | null>(() => {
    if (!me?.id || !partner?.id) return null;
    const ids = [me.id, partner.id].sort();
    return ids[0] === me.id ? 0 : 1;
  }, [me?.id, partner?.id]);


  const [balls, setBalls] = useState<Ball[]>(() => makeRack());
  const [turn, setTurn] = useState<Player>(0);
  const [assign, setAssign] = useState<[Assignment, Assignment]>([null, null]);
  const [pocketedThisTurn, setPocketedThisTurn] = useState<Ball[]>([]);
  const [winner, setWinner] = useState<Player | null>(null);
  const [message, setMessage] = useState<string>("Break!");
  const [ballInHand, setBallInHand] = useState<Player | null>(null);
  const [matchScore, setMatchScore] = useState<[number, number]>(() => {
    try { const s = localStorage.getItem("pool:score"); if (s) return JSON.parse(s); } catch { /* noop */ }
    return [0, 0];
  });
  useEffect(() => {
    try { localStorage.setItem("pool:score", JSON.stringify(matchScore)); } catch { /* noop */ }
  }, [matchScore]);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const [mouse, setMouse] = useState<{ x: number; y: number } | null>(null);
  const [drag, setDrag] = useState<{ startX: number; startY: number } | null>(null);
  const [power, setPower] = useState(0);
  const [placingCue, setPlacingCue] = useState<{ x: number; y: number } | null>(null);

  const ballsRef = useRef(balls);
  ballsRef.current = balls;
  const movingRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const turnEndedRef = useRef(false);
  const firstHitRef = useRef<FirstHit>({ id: null });
  // Refs for state read inside resolveTurn (RAF loop closes over first render)
  const pocketedThisTurnRef = useRef<Ball[]>([]);
  pocketedThisTurnRef.current = pocketedThisTurn;
  const assignRef = useRef<[Assignment, Assignment]>(assign);
  assignRef.current = assign;
  const resolveTurnRef = useRef<() => void>(() => {});


  // -------- Realtime sync --------
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const remoteApplyingRef = useRef(false);
  const lastSendRef = useRef(0);
  const [partnerOnline, setPartnerOnline] = useState(false);
  const turnRef = useRef<Player>(0);
  turnRef.current = turn;
  const mySeatRef = useRef<Player | null>(mySeat);
  mySeatRef.current = mySeat;

  const isMyTurn = mySeat === null || mySeat === turn;
  const isMyTurnRef = useRef(isMyTurn);
  isMyTurnRef.current = isMyTurn;

  const sendState = useCallback((force = false, overrides?: { turn?: Player; ballInHand?: Player | null; assign?: [Assignment, Assignment]; winner?: Player | null; message?: string; matchScore?: [number, number] }) => {
    const ch = channelRef.current;
    if (!ch || remoteApplyingRef.current) return;
    const effTurn = overrides?.turn ?? turnRef.current;
    // Only current-turn seat is authoritative for state
    if (mySeatRef.current !== null && mySeatRef.current !== turnRef.current && overrides?.turn === undefined && !force) return;
    const now = performance.now();
    if (!force && now - lastSendRef.current < 45) return;
    lastSendRef.current = now;
    ch.send({
      type: "broadcast",
      event: "state",
      payload: {
        ts: Date.now(),
        from: mySeatRef.current,
        balls: ballsRef.current.map(b => ({
          id: b.id, x: b.x, y: b.y, vx: b.vx, vy: b.vy,
          pocketed: b.pocketed, sinkT: b.sinkT,
          pocketX: b.pocketX, pocketY: b.pocketY,
        })),
        turn: effTurn,
        assign: overrides?.assign ?? assign,
        ballInHand: overrides?.ballInHand !== undefined ? overrides.ballInHand : ballInHand,
        winner: overrides?.winner !== undefined ? overrides.winner : winner,
        message: overrides?.message ?? message,
        matchScore: overrides?.matchScore ?? matchScore,
      },
    });
  }, [assign, ballInHand, winner, message, matchScore]);

  useEffect(() => {
    if (!roomKey) return;
    const ch = supabase.channel(roomKey, { config: { broadcast: { self: false }, presence: { key: me?.id ?? "anon" } } });
    channelRef.current = ch;
    ch.on("broadcast", { event: "state" }, ({ payload }) => {
      remoteApplyingRef.current = true;
      const incoming: Ball[] = payload.balls.map((rb: Ball) => {
        const existing = ballsRef.current.find(b => b.id === rb.id);
        return {
          id: rb.id,
          x: rb.x, y: rb.y, vx: rb.vx, vy: rb.vy,
          group: existing?.group ?? groupOf(rb.id),
          color: existing?.color ?? BALL_COLORS[rb.id],
          pocketed: rb.pocketed, sinkT: rb.sinkT,
          pocketX: rb.pocketX, pocketY: rb.pocketY,
        };
      });
      ballsRef.current = incoming;
      setBalls(incoming);
      setTurn(payload.turn);
      setAssign(payload.assign);
      setBallInHand(payload.ballInHand);
      setWinner(payload.winner);
      setMessage(payload.message);
      if (payload.matchScore) setMatchScore(payload.matchScore);
      // Reset local sim flags — authoritative sender manages them
      movingRef.current = anyMoving(incoming);
      turnEndedRef.current = false;
      setTimeout(() => { remoteApplyingRef.current = false; }, 0);
    });
    ch.on("broadcast", { event: "reset" }, () => {
      remoteApplyingRef.current = true;
      const fresh = makeRack();
      ballsRef.current = fresh;
      setBalls(fresh);
      setTurn(0); setAssign([null, null]); setPocketedThisTurn([]);
      setWinner(null); setMessage("Break!"); setBallInHand(null);
      setPlacingCue(null);
      movingRef.current = false; turnEndedRef.current = false;
      firstHitRef.current.id = null;
      setTimeout(() => { remoteApplyingRef.current = false; }, 0);
    });
    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState();
      const others = Object.keys(state).filter(k => k !== me?.id);
      setPartnerOnline(others.length > 0);
    });
    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await ch.track({ seat: mySeatRef.current, at: Date.now() });
      }
    });
    return () => { supabase.removeChannel(ch); channelRef.current = null; };
  }, [roomKey, me?.id]);

  useEffect(() => {
    let last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(32, t - last); last = t;
      // Only the authoritative seat simulates. Solo (mySeat null) always simulates.
      if (isMyTurnRef.current) {
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
            firstHitRef.current,
          );
        }
        const stillMoving = anyMoving(ballsRef.current);
        setBalls([...ballsRef.current]);
        if (stillMoving) {
          movingRef.current = true;
          sendState();
        }
        if (!stillMoving && movingRef.current && !turnEndedRef.current) {
          movingRef.current = false;
          turnEndedRef.current = true;
          setTimeout(() => resolveTurnRef.current(), 0);

        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cueBall = balls.find((b) => b.id === 0);
  const canShoot = !winner && cueBall && !anyMoving(balls) && ballInHand === null && isMyTurn;


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

  // -------- Ball-in-hand placement --------
  const onSvgMove = (e: React.PointerEvent) => {
    const p = toSvg(e.clientX, e.clientY);
    if (ballInHand !== null && ballInHand === turn && isMyTurn) {
      const cx = Math.max(R, Math.min(W - R, p.x));
      const cy = Math.max(R, Math.min(H - R, p.y));
      if (!overlapsAny(ballsRef.current, cx, cy, 0)) {
        setPlacingCue({ x: cx, y: cy });
      }
      return;
    }
    if (!canShoot) return;
    setMouse(p);
    if (drag && cueBall) {
      const dx = cueBall.x - p.x;
      const dy = cueBall.y - p.y;
      const dist = Math.hypot(dx, dy);
      setPower(Math.min(MAX_POWER, dist * 0.08));
    }
  };
  const onSvgDown = (e: React.PointerEvent) => {
    const p = toSvg(e.clientX, e.clientY);
    if (ballInHand !== null && ballInHand === turn && isMyTurn) {
      const cx = Math.max(R, Math.min(W - R, p.x));
      const cy = Math.max(R, Math.min(H - R, p.y));
      if (!overlapsAny(ballsRef.current, cx, cy, 0)) {
        const cb = ballsRef.current.find((b) => b.id === 0);
        if (cb) { cb.x = cx; cb.y = cy; cb.vx = 0; cb.vy = 0; cb.pocketed = false; cb.sinkT = 0; }
        setBalls([...ballsRef.current]);
        setBallInHand(null);
        setPlacingCue(null);
        setMessage("Take your shot");
        setTimeout(() => sendState(true), 0);
      }
      return;
    }
    if (!canShoot || !cueBall) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setDrag({ startX: p.x, startY: p.y });
    setMouse(p);
  };
  const onSvgUp = () => {
    if (!drag || !cueBall || !mouse) { setDrag(null); return; }
    if (power < 1) { setDrag(null); setPower(0); return; }
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
    firstHitRef.current.id = null;
    turnEndedRef.current = false;
    movingRef.current = true;
    // Broadcast the initial cue-strike so partner sees motion begin instantly
    setTimeout(() => sendState(true), 0);
  };

  // -------- Turn resolution --------
  // NOTE: called from the RAF loop (which captures the first-render closure),
  // so read all mutable state via refs.
  const resolveTurn = () => {
    const currentTurn = turnRef.current;
    const pocketed = pocketedThisTurnRef.current;
    setPocketedThisTurn([]);

    const cueSunk = pocketed.some((b) => b.id === 0);
    const eightSunk = pocketed.some((b) => b.id === 8);
    const other = (currentTurn === 0 ? 1 : 0) as Player;
    const firstHitId = firstHitRef.current.id;
    const firstHitBall = firstHitId != null ? ballsRef.current.find(b => b.id === firstHitId) : null;

    let a: [Assignment, Assignment] = [...assignRef.current] as [Assignment, Assignment];
    const isBreak = !a[0] && !a[1];
    let foul = false;
    let foulReason = "";

    if (cueSunk) { foul = true; foulReason = "Scratch"; }
    else if (firstHitId === null) { foul = true; foulReason = "No ball struck"; }
    else if (!isBreak && a[currentTurn] && firstHitBall) {
      const myGroup = a[currentTurn];
      const my8OnTable = ballsRef.current.filter(b => !b.pocketed && b.group === myGroup).length > 0;
      const legalFirst = my8OnTable ? firstHitBall.group === myGroup : firstHitBall.group === "eight";
      if (!legalFirst) { foul = true; foulReason = `Hit ${firstHitBall.group} first — foul`; }
    }

    // 8-ball outcomes
    if (eightSunk) {
      const myGroup = a[currentTurn];
      const myLeft = myGroup ? ballsRef.current.filter((b) => !b.pocketed && b.group === myGroup).length : 15;
      const legalWin = myGroup && myLeft === 0 && !cueSunk && !foul;
      if (legalWin) {
        setWinner(currentTurn); sfxPoolWin(); setMessage(`Player ${currentTurn + 1} wins!`);
        setMatchScore((s) => (currentTurn === 0 ? [s[0] + 1, s[1]] : [s[0], s[1] + 1]));
      } else {
        setWinner(other); sfxPoolWin();
        setMessage(cueSunk ? `Player ${other + 1} wins — scratch on 8` : `Player ${other + 1} wins — 8 ball early`);
        setMatchScore((s) => (other === 0 ? [s[0] + 1, s[1]] : [s[0], s[1] + 1]));
      }
      setTimeout(() => sendState(true), 0);
      return;
    }

    // Assign groups on first legit non-foul pocket (post-break)
    if (isBreak && !foul) {
      const first = pocketed.find((b) => b.group === "solid" || b.group === "stripe");
      if (first) {
        a = currentTurn === 0
          ? [first.group as Assignment, first.group === "solid" ? "stripe" : "solid"]
          : [first.group === "solid" ? "stripe" : "solid", first.group as Assignment];
        setAssign(a);
      }
    }

    if (cueSunk) {
      const cb = ballsRef.current.find((b) => b.id === 0);
      if (cb) {
        cb.pocketed = false; cb.sinkT = 0;
        cb.x = HEAD_SPOT_X; cb.y = H / 2;
        cb.vx = 0; cb.vy = 0;
      }
    }

    if (foul) {
      turnRef.current = other;
      setTurn(other);
      setBallInHand(other);
      const msg = `${foulReason} — Player ${other + 1} has ball in hand`;
      setMessage(msg);
      // Broadcast turn switch + ball-in-hand to partner
      setTimeout(() => sendState(true, { turn: other, ballInHand: other, message: msg }), 0);
      return;
    }

    const myGroup = a[currentTurn];
    const pocketedMine = myGroup ? pocketed.some((b) => b.group === myGroup) : pocketed.some(b => b.group === "solid" || b.group === "stripe");
    const shouldContinue = pocketedMine;

    const nextTurn: Player = shouldContinue ? currentTurn : other;
    if (!shouldContinue) {
      turnRef.current = other;
      setTurn(other);
    }
    const numSunk = pocketed.filter(b => b.id !== 0 && b.id !== 8).length;
    const msg = numSunk > 0
      ? `Sunk ${numSunk}${shouldContinue ? " — go again" : ""}`
      : "Miss";
    setMessage(msg);
    setTimeout(() => sendState(true, { turn: nextTurn, assign: a, message: msg }), 0);
  };
  resolveTurnRef.current = resolveTurn;


  const resetGame = () => {
    const fresh = makeRack();
    ballsRef.current = fresh;
    setBalls(fresh);
    setTurn(0);
    setAssign([null, null]);
    setPocketedThisTurn([]);
    setWinner(null);
    setMessage("Break!");
    setBallInHand(null);
    setPlacingCue(null);
    movingRef.current = false;
    turnEndedRef.current = false;
    firstHitRef.current.id = null;
    // Notify partner to reset too
    channelRef.current?.send({ type: "broadcast", event: "reset", payload: { ts: Date.now() } });
  };

  // Broadcast on important state transitions (handles resolveTurn early returns)
  useEffect(() => {
    if (remoteApplyingRef.current) return;
    if (mySeat !== null && mySeat !== turn && ballInHand !== mySeat && winner === null) return;
    const id = setTimeout(() => sendState(true), 20);
    return () => clearTimeout(id);
  }, [turn, assign, ballInHand, winner, message, mySeat, sendState]);


  // -------- Aim geometry --------
  const aimEnd = useMemo(() => {
    if (!cueBall || !mouse || !canShoot) return null;
    const dx = cueBall.x - mouse.x;
    const dy = cueBall.y - mouse.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: cueBall.x + (dx / len) * 340, y: cueBall.y + (dy / len) * 340 };
  }, [cueBall, mouse, canShoot]);

  const cuePreview = useMemo(() => {
    if (!cueBall || !mouse || !canShoot) return null;
    const dx = mouse.x - cueBall.x;
    const dy = mouse.y - cueBall.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const pullback = drag ? Math.min(60, power * 4) : 20;
    const tipX = cueBall.x + ux * (R + 8 + pullback);
    const tipY = cueBall.y + uy * (R + 8 + pullback);
    const angleDeg = Math.atan2(uy, ux) * 180 / Math.PI;
    return { tipX, tipY, angleDeg };
  }, [cueBall, mouse, canShoot, drag, power]);

  const solidsLeft = balls.filter((b) => !b.pocketed && b.group === "solid").length;
  const stripesLeft = balls.filter((b) => !b.pocketed && b.group === "stripe").length;
  const pocketedBalls = balls.filter(b => b.pocketed && b.id !== 0).sort((x, y) => x.id - y.id);

  return (
    <div className="min-h-screen bg-velvet text-candle relative overflow-hidden">
      {matchId && <GroupPlayersBar matchId={matchId} meId={me?.id} gameName="8-Ball Pool" />}
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
        <div className="flex items-center gap-2">
          {partner && (
            <div
              title={partnerOnline ? `${partner.display_name ?? "Partner"} is online` : "Partner is offline"}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-serif italic backdrop-blur ${
                partnerOnline
                  ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
                  : "border-border/40 bg-black/30 text-candle-muted"
              }`}
            >
              {partnerOnline ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
              {mySeat !== null ? `You: P${mySeat + 1}` : "Solo"}
            </div>
          )}
          <button
            onClick={resetGame}
            className="flex items-center gap-2 rounded-full border border-petal/40 bg-petal-soft/30 backdrop-blur px-4 py-1.5 text-sm hover:bg-petal-soft/60 transition"
          >
            <RotateCcw className="size-4" /> New rack
          </button>
        </div>
      </header>


      {/* Match scoreboard */}
      <div className="relative z-10 max-w-6xl mx-auto px-5 mb-3">
        <div className="rounded-2xl border border-petal/30 bg-black/30 backdrop-blur px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex-1 text-center">
            <p className="text-[9px] uppercase tracking-[0.2em] text-petal">Player 1</p>
            <p className="font-serif italic text-3xl mt-0.5">{matchScore[0]}</p>
          </div>
          <div className="text-center px-3">
            <p className="text-[9px] uppercase tracking-[0.2em] text-candle-muted">Match</p>
            <p className="font-serif italic text-xl text-petal">vs</p>
            <button
              onClick={() => setMatchScore([0, 0])}
              className="text-[9px] text-candle-muted underline hover:text-candle transition"
            >reset</button>
          </div>
          <div className="flex-1 text-center">
            <p className="text-[9px] uppercase tracking-[0.2em] text-petal">Player 2</p>
            <p className="font-serif italic text-3xl mt-0.5">{matchScore[1]}</p>
          </div>
        </div>
      </div>

      {/* Turn strip */}
      <div className="relative z-10 max-w-6xl mx-auto px-5 flex items-center justify-between gap-3 mb-3 text-xs">
        <div className={`flex items-center gap-2 rounded-full px-3 py-1 border ${turn === 0 && !winner ? "border-petal bg-petal-soft/30" : "border-border/40"}`}>
          <span className={`size-2.5 rounded-full ${assign[0] === "solid" ? "bg-red-500" : assign[0] === "stripe" ? "bg-yellow-400 ring-2 ring-white/40" : "bg-white/40"}`} />
          <span className="font-serif italic">Player 1</span>
          {assign[0] && <span className="text-candle-muted">— {assign[0] === "solid" ? solidsLeft : stripesLeft} left</span>}
          {ballInHand === 0 && <Hand className="size-3 text-petal animate-pulse" />}
        </div>
        <p className="text-candle-muted font-serif italic text-center">
          {mySeat !== null && !isMyTurn && !winner ? `${partner?.display_name ?? "Partner"}'s turn…` : message}
        </p>
        <div className={`flex items-center gap-2 rounded-full px-3 py-1 border ${turn === 1 && !winner ? "border-petal bg-petal-soft/30" : "border-border/40"}`}>
          <span className={`size-2.5 rounded-full ${assign[1] === "solid" ? "bg-red-500" : assign[1] === "stripe" ? "bg-yellow-400 ring-2 ring-white/40" : "bg-white/40"}`} />
          <span className="font-serif italic">Player 2</span>
          {assign[1] && <span className="text-candle-muted">— {assign[1] === "solid" ? solidsLeft : stripesLeft} left</span>}
          {ballInHand === 1 && <Hand className="size-3 text-petal animate-pulse" />}
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
          <div className="absolute inset-2 rounded-[30px] pointer-events-none" style={{ border: "1px solid rgba(212,162,74,0.25)" }} />
          <svg
            ref={svgRef}
            viewBox={`-140 -100 ${W + 280} ${H + 200}`}
            style={{ overflow: "visible", cursor: ballInHand === turn ? "crosshair" : canShoot ? "grab" : "default" }}
            className="w-full h-auto rounded-2xl select-none touch-none"
            onPointerMove={onSvgMove}
            onPointerDown={onSvgDown}
            onPointerUp={onSvgUp}
            onPointerCancel={() => setDrag(null)}
            onPointerLeave={() => { setMouse(null); if (drag) setDrag(null); }}
            
          >
            <defs>
              <radialGradient id="feltGrad" cx="50%" cy="45%" r="70%">
                <stop offset="0%" stopColor="#1e6d43" />
                <stop offset="60%" stopColor="#134a2d" />
                <stop offset="100%" stopColor="#0a2e1c" />
              </radialGradient>
              <radialGradient id="pocketGrad" cx="35%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#2a2a2a" />
                <stop offset="55%" stopColor="#000" />
                <stop offset="100%" stopColor="#000" />
              </radialGradient>
              <linearGradient id="cueShaftGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#f5e2b6" />
                <stop offset="55%" stopColor="#e2c185" />
                <stop offset="100%" stopColor="#b58a4a" />
              </linearGradient>
              <linearGradient id="cueShaftShine" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(255,255,255,0.7)" />
                <stop offset="50%" stopColor="rgba(255,255,255,0)" />
                <stop offset="100%" stopColor="rgba(0,0,0,0.35)" />
              </linearGradient>
              <linearGradient id="cueGripGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#5a2418" />
                <stop offset="50%" stopColor="#2a0f08" />
                <stop offset="100%" stopColor="#4a1e12" />
              </linearGradient>
              <linearGradient id="cueButtGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3a1f0a" />
                <stop offset="50%" stopColor="#1a0e04" />
                <stop offset="100%" stopColor="#2a1608" />
              </linearGradient>
              {/* High-end ball glow */}
              <radialGradient id="ballShine" cx="32%" cy="28%" r="70%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.95)" />
                <stop offset="18%" stopColor="rgba(255,255,255,0.35)" />
                <stop offset="55%" stopColor="rgba(255,255,255,0.02)" />
                <stop offset="100%" stopColor="rgba(0,0,0,0.55)" />
              </radialGradient>
              <radialGradient id="ballRim" cx="50%" cy="50%" r="50%">
                <stop offset="85%" stopColor="rgba(0,0,0,0)" />
                <stop offset="100%" stopColor="rgba(0,0,0,0.55)" />
              </radialGradient>
              <filter id="ballShadow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceAlpha" stdDeviation="1.2" />
                <feOffset dx="0" dy="2" result="off" />
                <feComponentTransfer><feFuncA type="linear" slope="0.55" /></feComponentTransfer>
                <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              {/* Stripe belt mask — colored band on ivory ball */}
              <clipPath id="stripeBand">
                <rect x={-R} y={-R * 0.5} width={R * 2} height={R} />
              </clipPath>
            </defs>

            <rect x={-4} y={-4} width={W + 8} height={H + 8} rx={14} fill="url(#feltGrad)" />

            {/* Diamond markers */}
            {[0.2, 0.4, 0.6, 0.8].flatMap((f, i) => [
              <circle key={`t${i}`} cx={W * f} cy={-16} r={2.2} fill="#d4a24a" opacity={0.7} />,
              <circle key={`b${i}`} cx={W * f} cy={H + 16} r={2.2} fill="#d4a24a" opacity={0.7} />,
            ])}
            {[0.25, 0.5, 0.75].flatMap((f, i) => [
              <circle key={`l${i}`} cx={-16} cy={H * f} r={2.2} fill="#d4a24a" opacity={0.7} />,
              <circle key={`r${i}`} cx={W + 16} cy={H * f} r={2.2} fill="#d4a24a" opacity={0.7} />,
            ])}

            {/* Kitchen line & foot spot */}
            <line x1={HEAD_SPOT_X} y1={4} x2={HEAD_SPOT_X} y2={H - 4} stroke="rgba(255,255,255,0.08)" strokeDasharray="3 6" />
            <circle cx={FOOT_SPOT_X} cy={H / 2} r={3} fill="rgba(255,255,255,0.12)" />
            <circle cx={HEAD_SPOT_X} cy={H / 2} r={3} fill="rgba(255,255,255,0.12)" />

            {/* Pockets */}
            {POCKETS.map((p, i) => (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r={POCKET_R + 3} fill="#0a0a0a" opacity={0.55} />
                <circle cx={p.x} cy={p.y} r={POCKET_R} fill="url(#pocketGrad)" stroke="#0a0a0a" strokeWidth={2} />
              </g>
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
            {cuePreview && (
              <g transform={`translate(${cuePreview.tipX} ${cuePreview.tipY}) rotate(${cuePreview.angleDeg})`} opacity={0.98}>
                {/* Full cue extends along +x from tip (which sits at x=0). Shaft points at cue ball. */}
                {/* Soft ground shadow */}
                <rect x={0} y={5} width={260} height={2.5} fill="rgba(0,0,0,0.35)" rx={1.25} />
                {/* Leather tip */}
                <rect x={0} y={-2.2} width={4} height={4.4} rx={1.2} fill="#6a4a2a" />
                {/* Ferrule (ivory) */}
                <rect x={4} y={-2.4} width={5} height={4.8} fill="#f4ecd8" />
                <rect x={4} y={-2.4} width={5} height={4.8} fill="url(#cueShaftShine)" opacity={0.5} />
                {/* Shaft (maple, tapered) */}
                <path d="M 9 -2.4 L 150 -3.2 L 150 3.2 L 9 2.4 Z" fill="url(#cueShaftGrad)" />
                <path d="M 9 -2.4 L 150 -3.2 L 150 -1.8 L 9 -1.4 Z" fill="rgba(255,255,255,0.35)" />
                <path d="M 9 1.5 L 150 2.0 L 150 3.2 L 9 2.4 Z" fill="rgba(0,0,0,0.25)" />
                {/* Wrap collar */}
                <rect x={148} y={-3.4} width={2} height={6.8} fill="#c9a24a" />
                {/* Leather grip */}
                <rect x={150} y={-3.4} width={40} height={6.8} fill="url(#cueGripGrad)" />
                {[152,158,164,170,176,182,188].map((x, i) => (
                  <line key={i} x1={x} y1={-3.4} x2={x} y2={3.4} stroke="rgba(0,0,0,0.35)" strokeWidth={0.3} />
                ))}
                {/* Gold ring */}
                <rect x={190} y={-3.6} width={2.5} height={7.2} fill="#d4a24a" />
                <rect x={190} y={-3.6} width={2.5} height={1} fill="#f5d688" />
                {/* Butt (dark wood, slight taper) */}
                <path d="M 192.5 -3.6 L 252 -4.4 L 252 4.4 L 192.5 3.6 Z" fill="url(#cueButtGrad)" />
                <path d="M 192.5 -3.6 L 252 -4.4 L 252 -2.6 L 192.5 -2 Z" fill="rgba(255,255,255,0.18)" />
                {/* Butt cap bumper */}
                <rect x={251} y={-4.4} width={4} height={8.8} rx={1.5} fill="#1a1208" />
                <rect x={251} y={-4.4} width={4} height={2} rx={1.5} fill="#3a2818" />
                {/* Subtle inlay diamonds on butt */}
                {[210, 224, 238].map((x, i) => (
                  <g key={i} transform={`translate(${x} 0)`}>
                    <path d="M 0 -2 L 2.5 0 L 0 2 L -2.5 0 Z" fill="#d4a24a" opacity={0.7} />
                  </g>
                ))}
              </g>
            )}

            {/* Ball-in-hand ghost preview */}
            {ballInHand === turn && placingCue && (
              <g transform={`translate(${placingCue.x} ${placingCue.y})`} opacity={0.55}>
                <circle r={R} fill="#f8f3e6" stroke="#d4a24a" strokeDasharray="3 3" />
              </g>
            )}

            {/* Balls (on table) */}
            {balls.filter(b => !b.pocketed).map((b) => (
              <BallGfx key={b.id} b={b} />
            ))}

            {/* Balls sinking into pocket */}
            {balls.filter(b => b.pocketed && b.sinkT < 1).map((b) => {
              const t = b.sinkT;
              const cx = b.x + ((b.pocketX ?? b.x) - b.x) * t;
              const cy = b.y + ((b.pocketY ?? b.y) - b.y) * t;
              const scale = 1 - t;
              return (
                <g key={`s-${b.id}`} transform={`translate(${cx} ${cy}) scale(${scale})`} opacity={1 - t * 0.4}>
                  <BallGfx b={{ ...b, x: 0, y: 0 }} raw />
                </g>
              );
            })}

            {/* Power meter */}
            {drag && mouse && (
              <g transform={`translate(${mouse.x} ${mouse.y - 30})`}>
                <rect x={-40} y={-6} width={80} height={10} rx={5} fill="rgba(0,0,0,0.55)" />
                <rect x={-38} y={-4} width={(power / MAX_POWER) * 76} height={6} rx={3} fill="#d4a24a" />
              </g>
            )}
          </svg>

          {/* Pocketed tray */}
          <div className="mt-3 flex items-center justify-between gap-3 px-2">
            <TrayRow label="Solids" balls={pocketedBalls.filter(b => b.group === "solid")} />
            <TrayRow label="8" balls={pocketedBalls.filter(b => b.group === "eight")} highlight />
            <TrayRow label="Stripes" balls={pocketedBalls.filter(b => b.group === "stripe")} />
          </div>

          <p className="mt-2 text-[11px] text-candle-muted text-center font-serif italic">
            {ballInHand === turn
              ? "Ball in hand — click anywhere on the table to place the cue ball"
              : "Drag from the cue ball — direction sets aim, distance sets power"}
          </p>
        </div>
      </div>

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

// -------- Ball graphic --------
function BallGfx({ b, raw = false }: { b: Ball; raw?: boolean }) {
  const isStripe = b.group === "stripe";
  const isCue = b.id === 0;
  const base = isStripe ? "#f8f3e6" : b.color;
  const content = (
    <>
      {/* drop shadow disk */}
      {!raw && <ellipse cx={0} cy={R * 0.85} rx={R * 0.85} ry={R * 0.25} fill="rgba(0,0,0,0.45)" />}
      {/* base */}
      <circle r={R} fill={base} />
      {/* stripe band */}
      {isStripe && (
        <g clipPath="url(#stripeBand)">
          <circle r={R} fill={b.color} />
        </g>
      )}
      {/* subtle equator shade for depth */}
      {isStripe && (
        <line x1={-R} y1={0} x2={R} y2={0} stroke="rgba(0,0,0,0.08)" strokeWidth={0.5} />
      )}
      {/* Number badge */}
      {!isCue && (
        <g>
          <circle r={R * 0.44} fill="#f8f3e6" />
          <circle r={R * 0.44} fill="url(#ballRim)" opacity={0.4} />
          <text
            y={R * 0.18}
            textAnchor="middle"
            fontSize={R * 0.7}
            fontFamily="Georgia, serif"
            fontWeight={700}
            fill={b.id === 8 ? "#141414" : "#141414"}
          >{b.id}</text>
        </g>
      )}
      {/* Cue ball red dot */}
      {isCue && (
        <circle cx={R * 0.35} cy={-R * 0.35} r={1.2} fill="#c62828" opacity={0.6} />
      )}
      {/* Glossy highlight */}
      <circle r={R} fill="url(#ballShine)" pointerEvents="none" />
      {/* rim shadow */}
      <circle r={R} fill="url(#ballRim)" pointerEvents="none" />
      {/* specular sparkle */}
      <ellipse cx={-R * 0.35} cy={-R * 0.4} rx={R * 0.22} ry={R * 0.12} fill="rgba(255,255,255,0.9)" opacity={0.85} pointerEvents="none" />
    </>
  );
  if (raw) return <>{content}</>;
  return <g transform={`translate(${b.x} ${b.y})`} filter="url(#ballShadow)">{content}</g>;
}

function TrayRow({ label, balls, highlight = false }: { label: string; balls: Ball[]; highlight?: boolean }) {
  return (
    <div className={`flex items-center gap-2 rounded-full px-3 py-1 border ${highlight ? "border-petal/60 bg-petal-soft/20" : "border-border/40 bg-black/20"}`}>
      <span className="text-[10px] uppercase tracking-widest text-candle-muted">{label}</span>
      <div className="flex items-center gap-1">
        {balls.length === 0 ? <span className="text-[10px] text-candle-muted/60">—</span> : balls.map((b) => (
          <span key={b.id} className="relative inline-block w-4 h-4 rounded-full" style={{
            background: b.group === "stripe"
              ? `radial-gradient(circle at 32% 28%, rgba(255,255,255,0.9), rgba(255,255,255,0.1) 40%), linear-gradient(180deg, #f8f3e6 0 30%, ${b.color} 30% 70%, #f8f3e6 70% 100%)`
              : `radial-gradient(circle at 32% 28%, rgba(255,255,255,0.9), rgba(255,255,255,0.1) 40%), ${b.color}`,
            boxShadow: "inset 0 -1px 2px rgba(0,0,0,0.4)",
          }}>
            <span className="absolute inset-0 flex items-center justify-center text-[7px] font-bold text-black" style={{
              textShadow: "0 0 2px rgba(255,255,255,0.5)",
            }}>{b.id}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
