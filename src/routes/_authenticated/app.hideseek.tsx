import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { GameBackLink } from "@/components/games/GameBackLink";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, RotateCcw, Eye, EyeOff, Sparkles, Users, Wifi, MessageCircle, Lock } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { useMatchOpponent } from "@/hooks/useMatchOpponent";
import { supabase } from "@/integrations/supabase/client";
import { sfxKiss, sfxPollVote, sfxReaction } from "@/lib/sfx";
import { toast } from "sonner";
import { GameChat } from "@/components/games/GameChat";
import { GroupPlayersBar } from "@/components/games/GroupPlayersBar";
import { InviteFriendCard } from "@/components/games/InviteFriendCard";

export const Route = createFileRoute("/_authenticated/app/hideseek")({
  component: HideSeekPage,
  validateSearch: (search: Record<string, unknown>) => ({
    matchId: typeof search.matchId === "string" ? search.matchId : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Hide & Seek — PandaCine" },
      { name: "description", content: "A luxury panda hide-and-seek for two. Hide, hint, and hunt across velvet rooms." },
    ],
  }),
});

/* ────────────────────────  Data  ──────────────────────── */

type Spot = { emoji: string; name: string; x: number; y: number };
/** Top-down furniture footprint (rectangle) */
type Furn = { x: number; y: number; w: number; h: number; label?: string; tone?: "wood" | "stone" | "cloth" | "glass" | "gold" };
/** Wall segment as a line on the map (percent coords) */
type Wall = { x1: number; y1: number; x2: number; y2: number };
/** Optional labelled sub-room */
type Zone = { x: number; y: number; w: number; h: number; label: string };

type Scene = {
  id: string;
  name: string;
  emoji: string;
  floor: string;
  accent: string;
  walls: Wall[];
  zones: Zone[];
  furniture: Furn[];
  spots: Spot[];
};

/**
 * Top-down floor plans. All coords are % (0-100). Walls render as SVG
 * lines; furniture as rounded rectangles from above; spots are the only
 * clickable hiding hotspots, placed on/near their furniture footprint.
 */
const SCENES: Scene[] = [
  {
    id: "ballroom", name: "Velvet Ballroom", emoji: "🕯️",
    floor: "oklch(0.24 0.05 340)", accent: "oklch(0.82 0.14 68)",
    walls: [
      { x1: 4, y1: 6, x2: 96, y2: 6 }, { x1: 96, y1: 6, x2: 96, y2: 94 },
      { x1: 96, y1: 94, x2: 4, y2: 94 }, { x1: 4, y1: 94, x2: 4, y2: 6 },
      { x1: 4, y1: 26, x2: 40, y2: 26 }, { x1: 60, y1: 26, x2: 96, y2: 26 },
    ],
    zones: [
      { x: 4, y: 6, w: 92, h: 20, label: "Stage" },
      { x: 4, y: 26, w: 92, h: 68, label: "Dance floor" },
    ],
    furniture: [
      // hiding-spot furniture
      { x: 10, y: 34, w: 14, h: 22, tone: "cloth", label: "Curtain" },
      { x: 26, y: 66, w: 20, h: 12, tone: "wood",  label: "Piano" },
      { x: 44, y: 26, w: 12, h: 4,  tone: "glass", label: "Mirror" },
      { x: 82, y: 32, w: 8,  h: 14, tone: "wood",  label: "Clock" },
      { x: 60, y: 66, w: 18, h: 12, tone: "glass", label: "Champagne" },
      { x: 82, y: 72, w: 10, h: 10, tone: "cloth", label: "Rose urn" },
      // decoy furniture (not clickable)
      { x: 76, y: 34, w: 14, h: 22, tone: "cloth", label: "Drape" },
      { x: 48, y: 44, w: 12, h: 12, tone: "gold",  label: "Chandelier" },
      { x: 30, y: 44, w: 6,  h: 6,  tone: "wood",  label: "Stool" },
      { x: 64, y: 44, w: 6,  h: 6,  tone: "wood",  label: "Stool" },
      { x: 14, y: 82, w: 10, h: 8,  tone: "cloth", label: "Divan" },
      { x: 50, y: 84, w: 14, h: 8,  tone: "cloth", label: "Chaise" },
      { x: 68, y: 84, w: 6,  h: 6,  tone: "gold",  label: "Candelabra" },
      { x: 42, y: 12, w: 16, h: 8,  tone: "wood",  label: "Podium" },
    ],
    spots: [
      { emoji: "🎭", name: "Velvet Curtain",  x: 17, y: 45 },
      { emoji: "🎹", name: "Grand Piano",     x: 36, y: 72 },
      { emoji: "🪞", name: "Gilded Mirror",   x: 50, y: 30 },
      { emoji: "🕰️", name: "Longcase Clock",  x: 86, y: 39 },
      { emoji: "🥂", name: "Champagne Tower", x: 69, y: 72 },
      { emoji: "💐", name: "Rose Urn",        x: 87, y: 77 },
    ],
  },
  {
    id: "library", name: "Moonlit Library", emoji: "📚",
    floor: "oklch(0.20 0.05 260)", accent: "oklch(0.78 0.12 260)",
    walls: [
      { x1: 4, y1: 6, x2: 96, y2: 6 }, { x1: 96, y1: 6, x2: 96, y2: 94 },
      { x1: 96, y1: 94, x2: 4, y2: 94 }, { x1: 4, y1: 94, x2: 4, y2: 6 },
      { x1: 44, y1: 6, x2: 44, y2: 40 },
    ],
    zones: [
      { x: 4, y: 6, w: 40, h: 34, label: "Study" },
      { x: 44, y: 6, w: 52, h: 34, label: "Reading nook" },
      { x: 4, y: 40, w: 92, h: 54, label: "Stacks" },
    ],
    furniture: [
      { x: 8,  y: 40, w: 6,  h: 40, tone: "wood",  label: "Ladder rail" },
      { x: 26, y: 66, w: 22, h: 14, tone: "wood",  label: "Desk" },
      { x: 46, y: 18, w: 12, h: 12, tone: "wood",  label: "Owl perch" },
      { x: 66, y: 52, w: 18, h: 14, tone: "cloth", label: "Nook sofa" },
      { x: 82, y: 72, w: 12, h: 10, tone: "wood",  label: "Drawer" },
      { x: 22, y: 12, w: 18, h: 12, tone: "glass", label: "Skylight" },
      // decoys
      { x: 16, y: 42, w: 10, h: 10, tone: "wood",  label: "Armchair" },
      { x: 32, y: 44, w: 8,  h: 8,  tone: "cloth", label: "Ottoman" },
      { x: 58, y: 12, w: 8,  h: 8,  tone: "wood",  label: "Bust" },
      { x: 74, y: 20, w: 12, h: 8,  tone: "wood",  label: "Cabinet" },
      { x: 52, y: 68, w: 10, h: 8,  tone: "wood",  label: "Trolley" },
      { x: 82, y: 44, w: 12, h: 6,  tone: "wood",  label: "Shelf" },
      { x: 6,  y: 84, w: 14, h: 8,  tone: "cloth", label: "Rug" },
      { x: 40, y: 82, w: 10, h: 8,  tone: "wood",  label: "Chess table" },
      { x: 64, y: 84, w: 14, h: 8,  tone: "wood",  label: "Globe" },
      { x: 88, y: 12, w: 6,  h: 20, tone: "cloth", label: "Curtain" },
    ],
    spots: [
      { emoji: "🪜", name: "Sliding Ladder", x: 11, y: 55 },
      { emoji: "📖", name: "Study Desk",     x: 37, y: 72 },
      { emoji: "🦉", name: "Owl Perch",      x: 52, y: 24 },
      { emoji: "🛋️", name: "Reading Nook",   x: 75, y: 58 },
      { emoji: "🗝️", name: "Locked Drawer",  x: 88, y: 77 },
      { emoji: "🪟", name: "Skylight Sill",  x: 31, y: 18 },
    ],
  },
  {
    id: "conservatory", name: "Glass Conservatory", emoji: "🌿",
    floor: "oklch(0.30 0.06 150)", accent: "oklch(0.85 0.10 150)",
    walls: [
      { x1: 4, y1: 6, x2: 96, y2: 6 }, { x1: 96, y1: 6, x2: 96, y2: 94 },
      { x1: 96, y1: 94, x2: 4, y2: 94 }, { x1: 4, y1: 94, x2: 4, y2: 6 },
    ],
    zones: [{ x: 4, y: 6, w: 92, h: 88, label: "Glass house" }],
    furniture: [
      { x: 8,  y: 42, w: 12, h: 18, tone: "cloth", label: "Palm" },
      { x: 24, y: 70, w: 14, h: 14, tone: "wood",  label: "Fig pot" },
      { x: 44, y: 28, w: 14, h: 12, tone: "glass", label: "Butterfly" },
      { x: 62, y: 64, w: 18, h: 18, tone: "stone", label: "Fountain" },
      { x: 82, y: 52, w: 12, h: 18, tone: "cloth", label: "Orchid" },
      { x: 52, y: 14, w: 18, h: 12, tone: "glass", label: "Pane" },
      // decoys
      { x: 26, y: 24, w: 10, h: 10, tone: "cloth", label: "Fern" },
      { x: 10, y: 22, w: 10, h: 10, tone: "wood",  label: "Planter" },
      { x: 38, y: 54, w: 10, h: 8,  tone: "wood",  label: "Bench" },
      { x: 8,  y: 76, w: 10, h: 12, tone: "cloth", label: "Ivy" },
      { x: 82, y: 78, w: 10, h: 10, tone: "wood",  label: "Trough" },
      { x: 70, y: 24, w: 10, h: 8,  tone: "glass", label: "Terrarium" },
      { x: 40, y: 78, w: 12, h: 10, tone: "stone", label: "Sundial" },
      { x: 88, y: 30, w: 6,  h: 12, tone: "cloth", label: "Vine" },
      { x: 20, y: 54, w: 6,  h: 6,  tone: "wood",  label: "Bulb" },
    ],
    spots: [
      { emoji: "🌴", name: "Fan Palm",        x: 14, y: 51 },
      { emoji: "🪴", name: "Fig Pot",         x: 31, y: 77 },
      { emoji: "🦋", name: "Butterfly Cage",  x: 51, y: 34 },
      { emoji: "⛲", name: "Marble Fountain", x: 71, y: 73 },
      { emoji: "🌸", name: "Orchid Bench",    x: 88, y: 61 },
      { emoji: "🪟", name: "Foggy Pane",      x: 61, y: 20 },
    ],
  },
  {
    id: "cellar", name: "Wine Cellar", emoji: "🍷",
    floor: "oklch(0.14 0.04 30)", accent: "oklch(0.55 0.14 30)",
    walls: [
      { x1: 4, y1: 6, x2: 96, y2: 6 }, { x1: 96, y1: 6, x2: 96, y2: 94 },
      { x1: 96, y1: 94, x2: 4, y2: 94 }, { x1: 4, y1: 94, x2: 4, y2: 6 },
      { x1: 50, y1: 6, x2: 50, y2: 46 },
    ],
    zones: [
      { x: 4, y: 6, w: 46, h: 40, label: "Barrels" },
      { x: 50, y: 6, w: 46, h: 40, label: "Racks" },
      { x: 4, y: 46, w: 92, h: 48, label: "Vault floor" },
    ],
    furniture: [
      { x: 10, y: 62, w: 14, h: 14, tone: "wood",  label: "Barrel" },
      { x: 30, y: 34, w: 16, h: 12, tone: "wood",  label: "Rack" },
      { x: 50, y: 68, w: 16, h: 12, tone: "wood",  label: "Crates" },
      { x: 68, y: 28, w: 14, h: 12, tone: "gold",  label: "Lantern" },
      { x: 82, y: 56, w: 10, h: 14, tone: "stone", label: "Gate" },
      { x: 14, y: 18, w: 14, h: 12, tone: "cloth", label: "Cobwebs" },
      // decoys
      { x: 30, y: 62, w: 12, h: 12, tone: "wood",  label: "Cask" },
      { x: 68, y: 62, w: 12, h: 12, tone: "wood",  label: "Cask" },
      { x: 60, y: 34, w: 6,  h: 12, tone: "wood",  label: "Rack" },
      { x: 82, y: 34, w: 8,  h: 12, tone: "wood",  label: "Rack" },
      { x: 30, y: 18, w: 12, h: 10, tone: "cloth", label: "Sack" },
      { x: 52, y: 18, w: 12, h: 10, tone: "stone", label: "Altar" },
      { x: 8,  y: 84, w: 14, h: 8,  tone: "wood",  label: "Pallet" },
      { x: 36, y: 84, w: 12, h: 8,  tone: "wood",  label: "Pallet" },
      { x: 68, y: 84, w: 14, h: 8,  tone: "cloth", label: "Rug" },
      { x: 88, y: 84, w: 6,  h: 8,  tone: "gold",  label: "Torch" },
    ],
    spots: [
      { emoji: "🛢️", name: "Oak Barrel",     x: 17, y: 69 },
      { emoji: "🍾", name: "Bottle Rack",    x: 38, y: 40 },
      { emoji: "🪵", name: "Stacked Crates", x: 58, y: 74 },
      { emoji: "🕯️", name: "Lantern Hook",   x: 75, y: 34 },
      { emoji: "🗝️", name: "Iron Gate",      x: 87, y: 63 },
      { emoji: "🕸️", name: "Cobweb Corner",  x: 21, y: 24 },
    ],
  },
  {
    id: "garden", name: "Rose Garden", emoji: "🌹",
    floor: "oklch(0.28 0.08 150)", accent: "oklch(0.75 0.14 340)",
    walls: [
      { x1: 4, y1: 6, x2: 96, y2: 6 }, { x1: 96, y1: 6, x2: 96, y2: 94 },
      { x1: 96, y1: 94, x2: 4, y2: 94 }, { x1: 4, y1: 94, x2: 4, y2: 6 },
    ],
    zones: [{ x: 4, y: 6, w: 92, h: 88, label: "Rose garden" }],
    furniture: [
      { x: 8,  y: 38, w: 12, h: 18, tone: "cloth", label: "Trellis" },
      { x: 26, y: 68, w: 18, h: 16, tone: "glass", label: "Pond" },
      { x: 46, y: 32, w: 12, h: 16, tone: "stone", label: "Cupid" },
      { x: 66, y: 42, w: 16, h: 18, tone: "cloth", label: "Willow" },
      { x: 60, y: 72, w: 16, h: 10, tone: "wood",  label: "Bench" },
      { x: 82, y: 22, w: 12, h: 12, tone: "wood",  label: "Dovecote" },
      // decoys
      { x: 30, y: 16, w: 10, h: 10, tone: "cloth", label: "Hedge" },
      { x: 46, y: 14, w: 10, h: 10, tone: "cloth", label: "Hedge" },
      { x: 62, y: 16, w: 10, h: 10, tone: "cloth", label: "Hedge" },
      { x: 22, y: 40, w: 8,  h: 8,  tone: "stone", label: "Sundial" },
      { x: 40, y: 56, w: 10, h: 6,  tone: "wood",  label: "Path" },
      { x: 8,  y: 66, w: 8,  h: 8,  tone: "cloth", label: "Bush" },
      { x: 8,  y: 82, w: 12, h: 10, tone: "cloth", label: "Bed" },
      { x: 46, y: 82, w: 10, h: 8,  tone: "cloth", label: "Bed" },
      { x: 82, y: 42, w: 10, h: 8,  tone: "stone", label: "Urn" },
      { x: 82, y: 78, w: 10, h: 12, tone: "cloth", label: "Bed" },
    ],
    spots: [
      { emoji: "🌹", name: "Rose Trellis",   x: 14, y: 47 },
      { emoji: "🦢", name: "Swan Pond",      x: 35, y: 76 },
      { emoji: "🗿", name: "Cupid Statue",   x: 52, y: 40 },
      { emoji: "🌳", name: "Willow Curtain", x: 74, y: 51 },
      { emoji: "🪑", name: "Wrought Bench",  x: 68, y: 77 },
      { emoji: "🕊️", name: "Dovecote",       x: 88, y: 28 },
    ],
  },
];

const TOTAL_ROUNDS = 4;
const MAX_ATTEMPTS = 4;
/** Seeker click within this radius (percent units) counts as a find. */
const HIT_RADIUS = 7;

type Pt = { x: number; y: number };

function distance(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function heatFor(a: Pt, b: Pt): { label: string; emoji: string; cls: string } {
  const d = distance(a, b);
  if (d <= HIT_RADIUS) return { label: "Burning!", emoji: "🔥", cls: "text-rose-300" };
  if (d < 18) return { label: "Boiling",   emoji: "🌋", cls: "text-orange-300" };
  if (d < 32) return { label: "Warm",      emoji: "🌡️", cls: "text-amber-300" };
  if (d < 48) return { label: "Cool",      emoji: "💧", cls: "text-sky-300" };
  return { label: "Ice cold", emoji: "❄️", cls: "text-sky-200" };
}

/** Nearest furniture label to a point, for prose descriptions. */
function nearestLabel(scene: Scene, pt: Pt): string {
  let best = { d: Infinity, label: "in the open" };
  for (const f of scene.furniture) {
    const cx = f.x + f.w / 2;
    const cy = f.y + f.h / 2;
    const d = Math.hypot(cx - pt.x, cy - pt.y);
    if (d < best.d) best = { d, label: f.label ?? "shadow" };
  }
  return best.d < 12 ? `by the ${best.label}` : "in the open";
}

/* ────────────────────────  Types  ──────────────────────── */

type Mode = "local" | "online";
type Phase =
  | "intro" | "lobby" | "waiting"
  | "hider_pick_scene" | "hider_pick_spot" | "hider_pick_whispers" | "hider_watch"
  | "handoff" | "seeker" | "round_result" | "final";

type PeerMsg =
  | { t: "hello"; from: string }
  | { t: "start"; from: string; hiderId: string; round: number }
  | { t: "hide"; from: string; sceneId: string; x: number; y: number; whispers: string[] }
  | { t: "guess"; from: string; attempt: number; x: number; y: number }
  | { t: "round_end"; from: string; scores: [number, number]; foundAt: number | null }
  | { t: "next_round"; from: string; hiderId: string; round: number }
  | { t: "finish"; from: string; scores: [number, number] }
  | { t: "reset"; from: string };

/* Whisper suggestion prompts — hider taps to auto-fill, or writes their own. */
const WHISPER_PROMPTS = [
  "I can almost touch the wall from here.",
  "Something wooden is right beside me.",
  "I'm not near the middle of the room.",
  "Light barely reaches this corner.",
  "I hear echoes when I breathe.",
  "There's something soft under my paws.",
  "I'm closer to the top of the map.",
  "Cold stone is nearby.",
  "I can see the whole room from here.",
  "The nearest furniture is small.",
];

/* ────────────────────────  Component  ──────────────────────── */

function HideSeekPage() {
  const { data } = useProfile();
  const me = data?.profile;
  const { matchId } = Route.useSearch();
  const { opponentId: matchOppId } = useMatchOpponent(matchId, me?.id);
  const partner = matchId
    ? (matchOppId ? { id: matchOppId, display_name: "Partner" } as { id: string; display_name?: string } : null)
    : data?.partner;
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>("local");
  useEffect(() => { if (matchId && partner) setMode("online"); }, [matchId, partner]);
  const [phase, setPhase] = useState<Phase>("intro");
  const [round, setRound] = useState(1);
  const [hiderId, setHiderId] = useState<string | null>(null);
  const [sceneId, setSceneId] = useState<string | null>(null);
  const [spot, setSpot] = useState<Pt | null>(null);           // hider's chosen point
  const [attempts, setAttempts] = useState<Pt[]>([]);          // seeker's clicks
  const [scores, setScores] = useState<[number, number]>([0, 0]);
  const [foundAt, setFoundAt] = useState<number | null>(null); // 0-based attempt idx
  const [whispers, setWhispers] = useState<string[]>([]); // hider's 3 hints for the round

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
    const key = matchId ?? [me.id, partner.id].sort().join(":");
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
      setWhispers([]);
      setFoundAt(null);
      const iHide = msg.hiderId === me.id;
      setPhase(iHide ? "hider_pick_scene" : "waiting");
      return;
    }

    if (msg.t === "hide") {
      // I'm the seeker — receive scene + hider's point + whispers
      setSceneId(msg.sceneId);
      setSpot({ x: msg.x, y: msg.y });
      setWhispers(msg.whispers ?? []);
      setAttempts([]);
      setFoundAt(null);
      setPhase("seeker");
      return;
    }

    if (msg.t === "guess") {
      // I'm the hider — record the seeker's attempt
      setAttempts((prev) => {
        const next = [...prev];
        next[msg.attempt] = { x: msg.x, y: msg.y };
        return next;
      });
      const truth = stateRef.current.spot;
      if (truth && distance({ x: msg.x, y: msg.y }, truth) <= HIT_RADIUS) sfxKiss();
      else sfxReaction();
      return;
    }

    if (msg.t === "round_end") {
      // Sender's array is in their own [me, partner] perspective — flip for us.
      setScores([msg.scores[1], msg.scores[0]]);
      setFoundAt(msg.foundAt);
      setPhase("round_result");
      return;
    }

    if (msg.t === "reset") {
      doResetLocal();
      toast("Your partner reset the match.");
      return;
    }

    if (msg.t === "finish") {
      setScores([msg.scores[1], msg.scores[0]]);
      setPhase("final");
      return;
    }
  }

  /* ── flow control ── */

  function doResetLocal() {
    setPhase("intro");
    setRound(1);
    setHiderId(null);
    setSceneId(null);
    setSpot(null);
    setAttempts([]);
    setWhispers([]);
    setFoundAt(null);
    setScores([0, 0]);
  }

  function resetAll() {
    if (mode === "online" && phase !== "intro" && phase !== "final") {
      if (!window.confirm("Reset the match? This clears the game for both of you.")) return;
      if (me) send({ t: "reset", from: me.id });
    }
    doResetLocal();
  }

  function startLocal() {
    setRound(1);
    setScores([0, 0]);
    setHiderId("me");
    setSceneId(null);
    setSpot(null);
    setAttempts([]);
    setWhispers([]);
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
    setWhispers([]);
    setFoundAt(null);
    send({ t: "start", from: me.id, hiderId: hider, round: 1 });
    setPhase(iHideFirst ? "hider_pick_scene" : "waiting");
  }

  function pickScene(id: string) {
    sfxReaction();
    setSceneId(id);
    setPhase("hider_pick_spot");
  }

  function pickSpot(pt: Pt) {
    sfxPollVote();
    setSpot(pt);
    setWhispers([]);
    setPhase("hider_pick_whispers");
  }

  function submitWhispers(ws: string[]) {
    sfxReaction();
    setWhispers(ws);
    if (mode === "online" && me && sceneId != null && spot) {
      send({ t: "hide", from: me.id, sceneId, x: spot.x, y: spot.y, whispers: ws });
      setPhase("hider_watch");
    } else {
      setPhase("handoff");
    }
  }

  function seekerGuess(pt: Pt) {
    const attemptIdx = attempts.length;
    const next = [...attempts, pt];
    setAttempts(next);
    const correct = !!spot && distance(pt, spot) <= HIT_RADIUS;

    if (mode === "online" && me) {
      send({ t: "guess", from: me.id, attempt: attemptIdx, x: pt.x, y: pt.y });
    }

    if (correct) {
      sfxKiss();
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
    setWhispers([]);
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
      {matchId && <GroupPlayersBar matchId={matchId} meId={me?.id} gameName="Hide & Seek" />}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-16 size-72 rounded-full blur-3xl opacity-40"
          style={{ background: "radial-gradient(circle, oklch(0.72 0.18 15 / 0.55), transparent 70%)" }} />
        <div className="absolute -bottom-24 -right-10 size-80 rounded-full blur-3xl opacity-35"
          style={{ background: "radial-gradient(circle, oklch(0.82 0.14 68 / 0.5), transparent 70%)" }} />
      </div>

      <div className="relative pt-10 px-5 pb-24 max-w-xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <GameBackLink className="text-candle-muted hover:text-candle transition-colors">
            <ArrowLeft className="size-5" />
          </GameBackLink>
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

        {phase === "hider_pick_whispers" && scene && spot != null && (
          <PickWhispers
            scene={scene}
            spot={spot}
            onBack={() => setPhase("hider_pick_spot")}
            onSubmit={submitWhispers}
          />
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
          <HiderWatch scene={scene} spot={spot} attempts={attempts} whispers={whispers} seekerName={seekerName} />
        )}

        {phase === "seeker" && scene && spot != null && (
          <SeekerBoard
            scene={scene}
            spot={spot}
            attempts={attempts}
            whispers={whispers}
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
        One panda hides <em>anywhere</em> on the room's map. The other has <span className="text-candle font-medium">{MAX_ATTEMPTS} taps</span> to find them — with warm/cold hints after every miss.
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

      <InviteFriendCard game="hide-seek" />

      {!hasPartner && (
        <p className="text-[11px] text-candle-muted">Pair with a partner to play across any distance — or invite a friend above.</p>
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

/* ── Shared top-down 2D floor plan ── */

function toneColor(tone?: Furn["tone"]): { fill: string; stroke: string } {
  switch (tone) {
    case "wood":  return { fill: "oklch(0.42 0.06 55)",  stroke: "oklch(0.72 0.10 68)" };
    case "stone": return { fill: "oklch(0.55 0.02 260)", stroke: "oklch(0.80 0.03 260)" };
    case "cloth": return { fill: "oklch(0.42 0.10 340)", stroke: "oklch(0.82 0.14 15)" };
    case "glass": return { fill: "oklch(0.55 0.06 220)", stroke: "oklch(0.90 0.08 220)" };
    case "gold":  return { fill: "oklch(0.62 0.14 80)",  stroke: "oklch(0.92 0.14 90)" };
    default:      return { fill: "oklch(0.42 0.04 300)", stroke: "oklch(0.80 0.04 300)" };
  }
}

function FloorPlan({ scene, mini = false }: { scene: Scene; mini?: boolean }) {
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
      <defs>
        <pattern id={`grid-${scene.id}${mini ? "-m" : ""}`} width="6" height="6" patternUnits="userSpaceOnUse">
          <path d="M 6 0 L 0 0 0 6" fill="none" stroke={scene.accent} strokeOpacity={mini ? 0.06 : 0.10} strokeWidth="0.15" />
        </pattern>
        <radialGradient id={`vig-${scene.id}${mini ? "-m" : ""}`} cx="50%" cy="50%" r="70%">
          <stop offset="55%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.65)" />
        </radialGradient>
      </defs>

      {/* floor base */}
      <rect x="0" y="0" width="100" height="100" fill={scene.floor} />
      <rect x="0" y="0" width="100" height="100" fill={`url(#grid-${scene.id}${mini ? "-m" : ""})`} />

      {/* zones — subtle labelled parquet blocks */}
      {scene.zones.map((z, i) => (
        <g key={i}>
          <rect x={z.x} y={z.y} width={z.w} height={z.h} fill={scene.accent} fillOpacity={0.04} />
          {!mini && (
            <text
              x={z.x + z.w / 2} y={z.y + 4.5}
              textAnchor="middle"
              fontSize="2.2"
              fill={scene.accent}
              fillOpacity={0.55}
              style={{ letterSpacing: "0.25em", textTransform: "uppercase" as const }}
            >
              {z.label}
            </text>
          )}
        </g>
      ))}

      {/* furniture — top-down rounded rects */}
      {scene.furniture.map((f, i) => {
        const c = toneColor(f.tone);
        return (
          <g key={i}>
            <rect
              x={f.x} y={f.y} width={f.w} height={f.h}
              rx={1.4} ry={1.4}
              fill={c.fill}
              stroke={c.stroke} strokeOpacity={0.55} strokeWidth={0.3}
            />
            {/* highlight */}
            <rect
              x={f.x + 0.4} y={f.y + 0.4}
              width={Math.max(0, f.w - 0.8)} height={Math.max(0, Math.min(1.4, f.h * 0.25))}
              rx={0.8} fill="white" fillOpacity={0.08}
            />
          </g>
        );
      })}

      {/* walls — gilded top-down */}
      {scene.walls.map((w, i) => (
        <line
          key={i}
          x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2}
          stroke={scene.accent}
          strokeOpacity={mini ? 0.6 : 0.85}
          strokeWidth={mini ? 0.8 : 1.2}
          strokeLinecap="round"
        />
      ))}

      {/* vignette */}
      <rect x="0" y="0" width="100" height="100" fill={`url(#vig-${scene.id}${mini ? "-m" : ""})`} />
    </svg>
  );
}

function RoomFrame({
  scene,
  children,
  compact,
}: { scene: Scene; children: ReactNode; compact?: boolean }) {
  return (
    <div
      className={`relative w-full ${compact ? "aspect-[4/3]" : "aspect-[3/4] sm:aspect-[4/3]"} rounded-3xl border border-border overflow-hidden select-none shadow-[inset_0_0_60px_rgba(0,0,0,0.55)]`}
      style={{ background: scene.floor }}
    >
      <FloorPlan scene={scene} />
      {/* corner compass label */}
      <div className="absolute top-2 left-2 text-[9px] uppercase tracking-[0.28em] text-candle/60 flex items-center gap-1">
        <span className="opacity-70">↑ N</span>
        <span className="mx-1 opacity-40">·</span>
        <span>{scene.emoji} {scene.name}</span>
      </div>
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
            <div className="relative w-full aspect-[5/3]" style={{ background: s.floor }}>
              <FloorPlan scene={s} mini />
            </div>
            <div className="px-3 py-2 flex items-center justify-between">
              <p className="text-[11px] tracking-wide text-candle">{s.emoji} {s.name}</p>
              <p className="text-[9px] uppercase tracking-widest text-candle-muted">Hide anywhere</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Turn a click on the map into percent coords, clamped to a safe inset. */
function mapPointFromEvent(e: React.MouseEvent<HTMLElement> | React.PointerEvent<HTMLElement>): Pt {
  const el = e.currentTarget as HTMLElement;
  const r = el.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * 100;
  const y = ((e.clientY - r.top) / r.height) * 100;
  return { x: Math.max(2, Math.min(98, x)), y: Math.max(2, Math.min(98, y)) };
}

function HidingMarker({ pt, label, pulse }: { pt: Pt; label?: string; pulse?: boolean }) {
  return (
    <div
      className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${pt.x}%`, top: `${pt.y}%` }}
    >
      <span className={`relative flex items-center justify-center size-9 rounded-full border-2 border-petal bg-petal-soft/70 shadow-[0_0_20px_rgba(255,120,160,0.55)] ${pulse ? "animate-pulse" : ""}`}>
        <span className="text-lg">🐼</span>
        {pulse && (
          <span className="absolute inset-0 rounded-full border-2 border-petal/70 animate-ping" />
        )}
      </span>
      {label && (
        <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1 whitespace-nowrap text-[9px] uppercase tracking-widest text-petal">{label}</span>
      )}
    </div>
  );
}

function AttemptMark({ pt, hit, index }: { pt: Pt; hit: boolean; index: number }) {
  return (
    <div
      className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${pt.x}%`, top: `${pt.y}%` }}
    >
      <span className={`relative flex items-center justify-center size-7 rounded-full border ${hit ? "border-emerald-300 bg-emerald-400/25" : "border-rose-300/70 bg-rose-500/20"} backdrop-blur-sm shadow-md`}>
        <span className="text-[10px] font-serif italic text-candle">{hit ? "✓" : index + 1}</span>
      </span>
    </div>
  );
}

function PickSpot({ scene, onPick, onBack }: { scene: Scene; onPick: (pt: Pt) => void; onBack: () => void }) {
  const [preview, setPreview] = useState<Pt | null>(null);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-[11px] uppercase tracking-widest text-candle-muted hover:text-candle">← Different room</button>
        <p className="font-serif italic text-lg">{scene.name}</p>
        <span />
      </div>
      <p className="text-center text-xs text-candle-muted">Tap anywhere on the map to hide. Behind furniture, in a corner — anywhere.</p>
      <div onClick={(e) => setPreview(mapPointFromEvent(e))} className="cursor-crosshair">
        <RoomFrame scene={scene}>
          {preview && <HidingMarker pt={preview} label={nearestLabel(scene, preview)} pulse />}
        </RoomFrame>
      </div>
      <button
        onClick={() => preview && onPick(preview)}
        disabled={!preview}
        className="w-full py-3 rounded-2xl bg-gradient-to-br from-petal to-rose-500 text-velvet font-medium tracking-wide shadow-lg shadow-petal/20 disabled:opacity-40"
      >
        {preview ? `Hide here (${nearestLabel(scene, preview)})` : "Tap the map to place yourself"}
      </button>
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

function HiderWatch({ scene, spot, attempts, whispers, seekerName }: { scene: Scene; spot: Pt; attempts: Pt[]; whispers: string[]; seekerName: string }) {
  const revealed = Math.min(whispers.length, attempts.length + 1);
  return (
    <div className="space-y-3">
      <div className="text-center">
        <p className="text-[10px] uppercase tracking-[0.28em] text-petal">You are hiding {nearestLabel(scene, spot)}</p>
        <p className="text-xs text-candle-muted mt-1">{seekerName} has {MAX_ATTEMPTS - attempts.length} of {MAX_ATTEMPTS} guesses left.</p>
      </div>

      <RoomFrame scene={scene}>
        <HidingMarker pt={spot} pulse />
        {attempts.map((a, i) => (
          <AttemptMark key={i} pt={a} index={i} hit={distance(a, spot) <= HIT_RADIUS} />
        ))}
      </RoomFrame>

      {whispers.length > 0 && (
        <div className="rounded-2xl border border-petal/30 bg-petal-soft/20 p-4">
          <p className="text-[10px] uppercase tracking-widest text-petal mb-2">Your whispers</p>
          <ul className="space-y-1.5 text-sm">
            {whispers.map((w, i) => (
              <li key={i} className={`flex items-start gap-2 ${i < revealed ? "text-candle" : "text-candle-muted/60"}`}>
                <span className="mt-0.5">{i < revealed ? <MessageCircle className="size-3.5 text-petal" /> : <Lock className="size-3.5" />}</span>
                <span className="italic">"{w}"</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-surface p-4">
        <p className="text-[10px] uppercase tracking-widest text-candle-muted mb-2">Search log</p>
        {attempts.length === 0 ? (
          <p className="text-sm text-candle-muted italic">Not a peep yet…</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {attempts.map((a, i) => {
              const heat = heatFor(a, spot);
              return (
                <li key={i} className="flex items-center justify-between">
                  <span className="text-candle">Guess {i + 1}: {nearestLabel(scene, a)}</span>
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

function PickWhispers({ scene, spot, onBack, onSubmit }: {
  scene: Scene; spot: Pt; onBack: () => void; onSubmit: (ws: string[]) => void;
}) {
  const [ws, setWs] = useState<string[]>(["", "", ""]);
  const filled = ws.filter((w) => w.trim().length > 0).length;
  const canSubmit = filled === 3;

  function setAt(i: number, v: string) {
    setWs((prev) => prev.map((w, idx) => (idx === i ? v.slice(0, 90) : w)));
  }
  function fillPrompt(i: number, text: string) {
    setAt(i, text);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-[11px] uppercase tracking-widest text-candle-muted hover:text-candle">← Move spot</button>
        <p className="font-serif italic text-lg">Leave 3 whispers</p>
        <span className="text-[11px] text-candle-muted">{filled}/3</span>
      </div>

      <p className="text-center text-xs text-candle-muted">
        Drop three secret hints. The seeker unlocks one before each guess — the truer the whisper, the fairer the hunt.
      </p>

      <div className="rounded-2xl overflow-hidden border border-border">
        <RoomFrame scene={scene} compact>
          <HidingMarker pt={spot} pulse />
        </RoomFrame>
      </div>

      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-2xl border border-border bg-surface p-3 space-y-2">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-petal">
            <MessageCircle className="size-3.5" /> Whisper {i + 1}
          </div>
          <textarea
            value={ws[i]}
            onChange={(e) => setAt(i, e.target.value)}
            placeholder="Give a hint about your hiding place…"
            rows={2}
            maxLength={90}
            className="w-full bg-transparent text-sm text-candle placeholder:text-candle-muted/50 outline-none resize-none"
          />
          <div className="flex flex-wrap gap-1.5">
            {WHISPER_PROMPTS.slice(i * 3, i * 3 + 3).map((p) => (
              <button
                key={p}
                onClick={() => fillPrompt(i, p)}
                className="text-[10px] px-2 py-1 rounded-full border border-border text-candle-muted hover:border-petal/60 hover:text-candle transition-colors"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      ))}

      <button
        onClick={() => canSubmit && onSubmit(ws.map((w) => w.trim()))}
        disabled={!canSubmit}
        className="w-full py-3 rounded-2xl bg-gradient-to-br from-petal to-rose-500 text-velvet font-medium tracking-wide shadow-lg shadow-petal/20 disabled:opacity-40"
      >
        {canSubmit ? "Seal whispers & hide" : `Write ${3 - filled} more whisper${3 - filled === 1 ? "" : "s"}`}
      </button>
    </div>
  );
}

function SeekerBoard({ scene, spot, attempts, whispers, onGuess, hiderName }: {
  scene: Scene; spot: Pt; attempts: Pt[]; whispers: string[]; onGuess: (pt: Pt) => void; hiderName: string;
}) {
  const lastAttempt = attempts.length > 0 ? attempts[attempts.length - 1] : null;
  const lastHeat = lastAttempt ? heatFor(lastAttempt, spot) : null;
  const remaining = MAX_ATTEMPTS - attempts.length;
  const done = remaining <= 0 || (lastAttempt && distance(lastAttempt, spot) <= HIT_RADIUS);
  // Reveal one whisper before each guess: attempts.length + 1, capped at whispers.length.
  const revealed = Math.min(whispers.length, attempts.length + 1);

  return (
    <div className="space-y-3">
      <div className="text-center">
        <p className="text-[10px] uppercase tracking-[0.28em] text-petal">Seeking {hiderName} in</p>
        <p className="font-serif italic text-xl">{scene.name}</p>
        <p className="text-xs text-candle-muted mt-1">{remaining} {remaining === 1 ? "guess" : "guesses"} left</p>
      </div>

      {whispers.length > 0 && (
        <div className="rounded-2xl border border-petal/30 bg-gradient-to-br from-petal-soft/30 to-surface/60 backdrop-blur p-4 space-y-2">
          <p className="text-[10px] uppercase tracking-[0.28em] text-petal flex items-center gap-1.5">
            <MessageCircle className="size-3.5" /> Whispers from {hiderName}
          </p>
          <ul className="space-y-1.5">
            {whispers.map((w, i) => {
              const locked = i >= revealed;
              return (
                <li key={i} className={`flex items-start gap-2 text-sm ${locked ? "text-candle-muted/50" : "text-candle"}`}>
                  <span className="mt-1">{locked ? <Lock className="size-3.5" /> : <span className="text-petal">✦</span>}</span>
                  <span className={locked ? "italic" : "italic"}>
                    {locked ? `Unlocks after guess ${i}` : `"${w}"`}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {lastHeat && (
        <div className={`text-center rounded-2xl border border-border bg-surface/60 backdrop-blur p-3 ${lastHeat.cls}`}>
          <p className="text-[10px] uppercase tracking-widest opacity-80">Last guess</p>
          <p className="font-serif italic text-lg">{lastHeat.emoji} {lastHeat.label}</p>
        </div>
      )}

      <div
        onClick={(e) => { if (!done) onGuess(mapPointFromEvent(e)); }}
        className={done ? "cursor-not-allowed" : "cursor-crosshair"}
      >
        <RoomFrame scene={scene}>
          {attempts.map((a, i) => {
            const hit = distance(a, spot) <= HIT_RADIUS;
            return <AttemptMark key={i} pt={a} index={i} hit={hit} />;
          })}
        </RoomFrame>
      </div>

      <p className="text-center text-[11px] text-candle-muted italic">Tap the map to guess. Each miss unlocks a new whisper.</p>
    </div>
  );
}



function RoundResult({ scene, spot, attempts, foundAt, hiderName, seekerName, onNext, isFinal }: {
  scene: Scene; spot: Pt; attempts: Pt[]; foundAt: number | null;
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
          Hidden <span className="text-candle">{nearestLabel(scene, spot)}</span> in {scene.name}.
        </p>
        {!found && <p className="text-[11px] text-candle-muted mt-1 italic">{seekerName}, better luck next round.</p>}
      </div>

      <div className="rounded-2xl overflow-hidden border border-border">
        <RoomFrame scene={scene} compact>
          <HidingMarker pt={spot} pulse />
          {attempts.map((a, i) => (
            <AttemptMark key={i} pt={a} index={i} hit={distance(a, spot) <= HIT_RADIUS} />
          ))}
        </RoomFrame>
      </div>

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
