import { memo, useEffect, useMemo, useState } from "react";
import { motion, useSpring } from "framer-motion";
import type { Costume, Emotion, PandaState, Zone } from "./usePandaBrain";

type Face = {
  eye: number; // 0 closed -> 1 wide
  mouth: "smile" | "bigSmile" | "open" | "flat" | "wobble" | "o" | "grin" | "tongue";
  blush: boolean;
  tilt: number;
  pupilScale: number;
  /** Squeeze of the black eye patch — pandas emote with the patch, not brows. */
  patch: number;
  patchRot: number;
};

const F = (
  eye: number,
  mouth: Face["mouth"],
  blush: boolean,
  tilt: number,
  pupilScale: number,
  patch = 1,
  patchRot = 0,
): Face => ({ eye, mouth, blush, tilt, pupilScale, patch, patchRot });

const FACES: Record<Emotion, Face> = {
  idle: F(1, "smile", false, 0, 1),
  happy: F(0.85, "bigSmile", true, -3, 1.05, 0.94, -3),
  curious: F(1.1, "o", false, 8, 1.1, 1.06, -6),
  sleepy: F(0.4, "wobble", false, 6, 0.9, 0.9, 4),
  asleep: F(0.02, "wobble", false, 10, 0.8, 0.86, 6),
  excited: F(1.25, "grin", true, -5, 1.2, 1.12, -6),
  shy: F(0.55, "wobble", true, 12, 1.15, 0.92, 6),
  embarrassed: F(0.35, "wobble", true, -10, 1.1, 0.9, 8),
  confused: F(0.9, "wobble", false, 12, 1, 1.02, -9),
  playful: F(1, "tongue", true, -8, 1.1, 1.02, -5),
  hungry: F(1, "open", false, 4, 1.05, 1, -2),
  proud: F(0.8, "grin", false, -4, 1, 0.95, -6),
  chaotic: F(1.3, "grin", true, -12, 1.25, 1.16, -10),
  angry: F(0.9, "flat", true, 0, 0.95, 0.82, 14),
  sulking: F(0.45, "flat", true, -14, 0.9, 0.8, 12),
  surprised: F(1.35, "o", false, 0, 1.3, 1.18, -2),
  scared: F(1.3, "wobble", false, -6, 1.25, 1.14, 8),
  relaxed: F(0.5, "smile", true, 5, 0.95, 0.92, 3),
  dreaming: F(0.03, "smile", true, 12, 0.8, 0.86, 5),
  celebrating: F(0.25, "bigSmile", true, -6, 1.1, 0.96, -6),
  focused: F(0.85, "flat", false, 0, 0.9, 0.9, 6),
  dizzy: F(0.9, "wobble", true, -14, 1.1, 1.04, -5),
  crossEyed: F(1.1, "o", true, 0, 1, 1.04, -4),
  laughing: F(0.15, "bigSmile", true, -8, 1, 0.9, -5),
  disappointed: F(0.6, "wobble", false, 8, 0.95, 0.88, 9),
};

const MOUTHS: Record<Face["mouth"], string> = {
  smile: "M -16 44 Q 0 56 16 44",
  bigSmile: "M -24 40 Q 0 68 24 40 Q 0 50 -24 40",
  open: "M -16 42 Q 0 72 16 42 Q 0 52 -16 42",
  flat: "M -14 48 L 14 48",
  wobble: "M -16 47 Q -8 40 0 47 Q 8 54 16 47",
  o: "M 0 50 m -10 0 a 10 11 0 1 0 20 0 a 10 11 0 1 0 -20 0",
  grin: "M -24 40 Q 0 66 24 40 L -24 40",
  tongue: "M -18 42 Q 0 62 18 42 Q 0 50 -18 42",
};

const COSTUME_LABEL: Partial<Record<Costume, string>> = {
  director: "🎬",
  astronaut: "🚀",
  wizard: "🪄",
  cyber: "🕶️",
  pirate: "🏴‍☠️",
  chef: "👨‍🍳",
  detective: "🕵️",
  ninja: "🥷",
  king: "👑",
  golden: "✨",
  santa: "🎅",
  ghost: "👻",
  valentine: "💗",
};

/* ---------------------------------------------------------------- *
 * Procedural fur — deterministic strands hugging each silhouette.  *
 * ---------------------------------------------------------------- */
function rand(seed: number) {
  const x = Math.sin(seed * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

function furRing(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  count: number,
  len: number,
  seed: number,
  from = 0,
  to = Math.PI * 2,
) {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const t = from + ((to - from) * i) / count + (rand(seed + i) - 0.5) * 0.05;
    const nx = Math.cos(t);
    const ny = Math.sin(t);
    const x = cx + nx * rx;
    const y = cy + ny * ry;
    const l = len * (0.3 + rand(seed + i * 3.7) * 0.5);
    const drift = (rand(seed + i * 9.3) - 0.5) * l * 0.9;
    out.push(`M ${x.toFixed(1)} ${y.toFixed(1)} q ${(nx * l * 0.6 + drift).toFixed(1)} ${(ny * l * 0.6).toFixed(1)} ${(nx * l + drift).toFixed(1)} ${(ny * l).toFixed(1)}`);
  }
  return out;
}

/**
 * Outward guard hairs that break a silhouette so the edge never reads as a
 * clean vector ellipse — this is what sells "fluffy" at a glance.
 */
function furFringe(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  count: number,
  len: number,
  seed: number,
  from = 0,
  to = Math.PI * 2,
) {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const t = from + ((to - from) * i) / count + (rand(seed + i * 5.1) - 0.5) * 0.08;
    const nx = Math.cos(t);
    const ny = Math.sin(t);
    const x = cx + nx * rx;
    const y = cy + ny * ry;
    const l = len * (0.45 + rand(seed + i * 2.3) * 0.85);
    // curl each strand sideways so tufts clump like real fur
    const tx = -ny * l * (rand(seed + i * 7.7) - 0.5) * 1.4;
    const ty = nx * l * (rand(seed + i * 3.1) - 0.5) * 1.4;
    out.push(
      `M ${x.toFixed(1)} ${y.toFixed(1)} q ${(nx * l * 0.55 + tx * 0.4).toFixed(1)} ${(ny * l * 0.55 + ty * 0.4).toFixed(1)} ${(nx * l + tx).toFixed(1)} ${(ny * l + ty).toFixed(1)}`,
    );
  }
  return out;
}


export type PandaCharacterProps = {
  state: PandaState;
  onZone?: (zone: Zone) => void;
  className?: string;
  /** Reduce secondary motion on low-power devices. */
  lite?: boolean;
};

/**
 * The mascot — a volumetric, fur-shaded panda rig. Real giant-panda markings:
 * black ears, black eye patches, a black shoulder band joining both forelegs,
 * black limbs, and no eyebrows (pandas emote with the patches and muzzle).
 */
export const PandaCharacter = memo(function PandaCharacter({
  state,
  onZone,
  className,
  lite = false,
}: PandaCharacterProps) {
  const face = FACES[state.emotion] ?? FACES.idle;
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    let id: number;
    const loop = () => {
      id = window.setTimeout(() => {
        setBlink(true);
        window.setTimeout(() => setBlink(false), 110);
        loop();
      }, 1600 + Math.random() * 4200);
    };
    loop();
    return () => window.clearTimeout(id);
  }, []);

  const spring = { stiffness: 140, damping: 14, mass: 0.6 };
  const lookX = useSpring(0, spring);
  const lookY = useSpring(0, spring);
  const headRot = useSpring(0, { stiffness: 80, damping: 12 });

  const ignoring = state.ignoring;

  useEffect(() => {
    // A sulking panda deliberately looks away from the cursor.
    const lx = ignoring ? -0.85 : state.look.x;
    const ly = ignoring ? 0.35 : state.look.y;
    lookX.set(lx);
    lookY.set(ly);
    headRot.set(lx * 7 + face.tilt + (ignoring ? -16 : 0));
  }, [state.look.x, state.look.y, face.tilt, ignoring, lookX, lookY, headRot]);

  const a = state.action;
  const crossed = state.emotion === "crossEyed";
  const sleeping = state.emotion === "asleep" || state.emotion === "dreaming";
  const eyeOpen = blink || sleeping ? 0.03 : face.eye;

  const baseLook = ignoring ? -0.85 : state.look.x;
  const px = crossed ? 4 : baseLook * 6;
  const pxR = crossed ? -4 : baseLook * 6;
  const py = (ignoring ? 0.35 : state.look.y) * 5;

  // Deep-sleep pose: the whole body sinks, curls and settles.
  const sleepPose = sleeping
    ? { y: 22, scaleY: 0.9, scaleX: 1.06, rotate: 4 }
    : state.emotion === "sleepy"
      ? { y: 8, scaleY: 0.97, scaleX: 1.02, rotate: 1.5 }
      : { y: 0, scaleY: 1, scaleX: 1, rotate: 0 };

  const bodyAnim = useMemo(() => {
    switch (a) {
      case "headpat":
        return { scaleY: [1, 0.92, 1], y: [0, 6, 0], transition: { duration: 0.6, repeat: 2 } };
      case "tickle":
      case "rubBelly":
        return { rotate: [0, -6, 6, -4, 0], transition: { duration: 0.8, repeat: 2 } };
      case "roll":
        return { rotate: [0, 12, -12, 8, 0], transition: { duration: 1.2, repeat: 1 } };
      case "sugarRush":
        return { x: [0, -30, 30, -20, 18, 0], rotate: [0, -8, 8, -5, 0], transition: { duration: 1.4, repeat: 2 } };
      case "celebrate":
      case "dance":
        return { y: [0, -22, 0], rotate: [0, -6, 6, 0], transition: { duration: 0.7, repeat: 3 } };
      case "stretch":
        return { scaleY: [1, 1.14, 0.98, 1], scaleX: [1, 0.92, 1.03, 1], transition: { duration: 1.8 } };
      case "sneeze":
        return { y: [0, -6, 10, 0], scaleX: [1, 1.08, 0.96, 1], transition: { duration: 0.5 } };
      case "stir":
        return { rotate: [4, 2, 5, 3], y: [22, 18, 22, 20], transition: { duration: 2.4 } };
      case "wake":
        return { y: [22, 6, 0], rotate: [4, -2, 0], scaleY: [0.9, 1.04, 1], transition: { duration: 2.2, ease: "easeOut" as const } };
      case "sulk":
        return { x: [0, -14, -12], rotate: [0, -3, -2], transition: { duration: 1.4 } };
      case "snore":
        return { scaleY: [0.9, 0.95, 0.9], y: [22, 18, 22], transition: { duration: 4.2, repeat: Infinity, ease: "easeInOut" as const } };
      default:
        return sleeping
          ? { y: [22, 18, 22], scaleY: [0.9, 0.94, 0.9], transition: { duration: 4.6, repeat: Infinity, ease: "easeInOut" as const } }
          : { y: [0, -5, 0], transition: { duration: 3.4, repeat: Infinity, ease: "easeInOut" as const } };
    }
  }, [a, sleeping]);

  // Static fur geometry (memoised once).
  const fur = useMemo(
    () => ({
      head: furRing(150, 140, 92, 80, lite ? 34 : 78, 9, 11),
      body: furRing(150, 250, 86, 80, lite ? 26 : 60, 10, 31, Math.PI * 0.05, Math.PI * 0.95),
      earL: furRing(86, 78, 28, 28, lite ? 10 : 22, 7, 51),
      earR: furRing(214, 78, 28, 28, lite ? 10 : 22, 7, 71),
      cheekL: furRing(104, 172, 26, 20, lite ? 8 : 16, 6, 91, Math.PI * 0.4, Math.PI * 1.1),
      cheekR: furRing(196, 172, 26, 20, lite ? 8 : 16, 6, 111, Math.PI * -0.1, Math.PI * 0.6),
    }),
    [lite],
  );

  return (
    <svg
      viewBox="0 0 300 380"
      className={className}
      role="img"
      aria-label="PandaCine mascot"
      style={{ overflow: "visible", touchAction: "manipulation", shapeRendering: "geometricPrecision" }}
    >
      <defs>
        {/* white fur — light from upper-left, occlusion lower-right */}
        <radialGradient id="furW" cx="36%" cy="26%" r="82%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="45%" stopColor="#f7f1ea" />
          <stop offset="80%" stopColor="#e2d6cc" />
          <stop offset="100%" stopColor="#c4b5aa" />
        </radialGradient>
        {/* black fur — never flat: charcoal core, warm rim */}
        <radialGradient id="furB" cx="34%" cy="24%" r="86%">
          <stop offset="0%" stopColor="#585062" />
          <stop offset="42%" stopColor="#2c2733" />
          <stop offset="82%" stopColor="#161320" />
          <stop offset="100%" stopColor="#0a0810" />
        </radialGradient>
        <linearGradient id="bandG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3a3444" />
          <stop offset="60%" stopColor="#1d1926" />
          <stop offset="100%" stopColor="#0d0b13" />
        </linearGradient>
        <radialGradient id="rim" cx="50%" cy="46%" r="60%">
          <stop offset="62%" stopColor="transparent" />
          <stop offset="100%" stopColor="color-mix(in oklab, var(--petal) 60%, transparent)" />
        </radialGradient>
        <radialGradient id="spec" cx="50%" cy="50%">
          <stop offset="0%" stopColor="rgba(255,255,255,.75)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        <radialGradient id="occ" cx="50%" cy="50%">
          <stop offset="0%" stopColor="rgba(20,16,24,.55)" />
          <stop offset="100%" stopColor="rgba(20,16,24,0)" />
        </radialGradient>
        <radialGradient id="shadow" cx="50%" cy="50%">
          <stop offset="0%" stopColor="rgba(0,0,0,.6)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>

        {/* fur displacement — breaks every silhouette so nothing reads as vector-flat */}
        <filter id="furEdge" x="-15%" y="-15%" width="130%" height="130%">
          <feTurbulence type="fractalNoise" baseFrequency="0.62" numOctaves="3" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={lite ? 1.6 : 3.4} xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="soft" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2.4" />
        </filter>
      </defs>

      {/* contact shadow */}
      <motion.ellipse
        cx="150"
        cy="352"
        rx="98"
        ry="15"
        fill="url(#shadow)"
        animate={lite ? undefined : { rx: [98, 90, 98], opacity: [0.9, 0.72, 0.9] }}
        transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.g
        animate={sleepPose}
        transition={{ type: "spring", stiffness: 40, damping: 18 }}
        style={{ transformOrigin: "150px 330px" }}
      >
        <motion.g animate={bodyAnim} style={{ transformOrigin: "150px 310px" }}>
          {/* tail */}
          <motion.g
            onPointerDown={() => onZone?.("tail")}
            style={{ cursor: "pointer", transformOrigin: "216px 272px" }}
            animate={{ rotate: a === "tailPull" ? [0, -28, 10, 0] : sleeping ? [-2, 2, -2] : [-6, 6, -6] }}
            transition={{ duration: a === "tailPull" ? 0.6 : sleeping ? 5 : 2.6, repeat: a === "tailPull" ? 0 : Infinity, ease: "easeInOut" }}
          >
            <ellipse cx="234" cy="272" rx="21" ry="18" fill="url(#furW)" filter="url(#furEdge)" />
            <g stroke="#efe7de" strokeWidth=".7" fill="none" opacity=".38">
              {furRing(234, 272, 21, 18, lite ? 8 : 16, 5, 131).map((d, i) => (
                <path key={i} d={d} strokeLinecap="round" />
              ))}
            </g>
          </motion.g>

          {/* hind legs (black) */}
          {([-1, 1] as const).map((s) => (
            <motion.g
              key={s}
              animate={{ rotate: a === "sugarRush" || a === "tickle" ? [0, s * -12, s * 12, 0] : [0, s * 2, 0] }}
              transition={{ duration: a ? 0.5 : 3.2, repeat: Infinity }}
              style={{ transformOrigin: `${150 + s * 30}px 300px` }}
            >
              <ellipse cx={150 + s * 46} cy="322" rx="35" ry="24" fill="url(#furB)" filter="url(#furEdge)" />
              <ellipse cx={150 + s * 46} cy="316" rx="26" ry="12" fill="url(#spec)" opacity=".14" />
              <g fill="#8d5f68" opacity=".75">
                <circle cx={150 + s * 46 - 12} cy="318" r="4" />
                <circle cx={150 + s * 46} cy="314" r="4" />
                <circle cx={150 + s * 46 + 12} cy="318" r="4" />
              </g>
            </motion.g>
          ))}

          {/* torso — white barrel */}
          <motion.g
            onPointerDown={() => onZone?.("body")}
            style={{ cursor: "pointer", transformOrigin: "150px 250px" }}
            animate={lite ? undefined : { scaleX: [1, 1.02, 1], scaleY: [1, 0.985, 1] }}
            transition={{ duration: sleeping ? 5.2 : 3.1, repeat: Infinity, ease: "easeInOut" }}
          >
            <ellipse cx="150" cy="252" rx="86" ry="80" fill="url(#furW)" filter="url(#furEdge)" />
            <g stroke="#f3ebe3" strokeWidth=".8" fill="none" opacity=".42">
              {fur.body.map((d, i) => (
                <path key={i} d={d} strokeLinecap="round" />
              ))}
            </g>
            {/* volume: chest highlight + lower occlusion */}
            <ellipse cx="126" cy="222" rx="44" ry="34" fill="url(#spec)" opacity=".35" />
            <ellipse cx="160" cy="304" rx="70" ry="30" fill="url(#occ)" opacity=".5" />
            <ellipse
              cx="150"
              cy="262"
              rx="52"
              ry="50"
              fill="#fffaf6"
              opacity=".35"
              onPointerDown={(e) => {
                e.stopPropagation();
                onZone?.("belly");
              }}
              style={{ cursor: "pointer" }}
            />
            <ellipse cx="150" cy="252" rx="86" ry="80" fill="url(#rim)" opacity=".4" />
          </motion.g>

          {/* black shoulder band — the real panda's collar joining both forelegs */}
          <path
            d="M 78 214 q 26 -34 72 -34 q 46 0 72 34 q 6 26 -6 44 q -22 -30 -66 -30 q -44 0 -66 30 q -12 -18 -6 -44 z"
            fill="url(#bandG)"
            filter="url(#furEdge)"
            opacity=".97"
          />
          <path
            d="M 92 200 q 24 -22 58 -22 q 34 0 58 22"
            stroke="rgba(255,255,255,.16)"
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
          />

          {/* forelegs (black, continuous with the band) */}
          <motion.g
            style={{ transformOrigin: "88px 214px", cursor: "pointer" }}
            onPointerDown={() => onZone?.("paw-l")}
            animate={{
              rotate:
                a === "wave"
                  ? [0, -55, -30, -55, 0]
                  : a === "pawShake"
                    ? [0, -20, 8, -14, 0]
                    : a === "celebrate" || a === "dance"
                      ? [-40, -70, -40]
                      : a === "rubBelly"
                        ? [0, 18, -6, 18, 0]
                        : a === "sulk" || ignoring
                          ? [14, 16, 14]
                          : sleeping
                            ? [16, 18, 16]
                            : [2, -4, 2],
            }}
            transition={{ duration: a ? 0.9 : 3.6, repeat: a ? 1 : Infinity, ease: "easeInOut" }}
          >
            <ellipse cx="76" cy="244" rx="24" ry="40" fill="url(#furB)" transform="rotate(12 76 244)" filter="url(#furEdge)" />
            <ellipse cx="70" cy="226" rx="10" ry="18" fill="url(#spec)" opacity=".16" transform="rotate(12 70 226)" />
            <g fill="#8d5f68" opacity=".7">
              <circle cx="68" cy="274" r="3.6" />
              <circle cx="78" cy="278" r="3.6" />
              <circle cx="88" cy="274" r="3.6" />
            </g>
          </motion.g>
          <motion.g
            style={{ transformOrigin: "212px 214px", cursor: "pointer" }}
            onPointerDown={() => onZone?.("paw-r")}
            animate={{
              rotate:
                a === "wave"
                  ? [0, 6, 0]
                  : a === "pawShake"
                    ? [0, 20, -8, 14, 0]
                    : a === "celebrate" || a === "dance"
                      ? [40, 70, 40]
                      : a === "eat" || a === "chew" || a === "pullBamboo"
                        ? [-46, -38, -46]
                        : a === "rubBelly"
                          ? [0, -18, 6, -18, 0]
                          : a === "sulk" || ignoring
                            ? [-14, -16, -14]
                            : sleeping
                              ? [-16, -18, -16]
                              : [-2, 4, -2],
            }}
            transition={{ duration: a ? 0.9 : 3.6, repeat: a ? 1 : Infinity, ease: "easeInOut" }}
          >
            <ellipse cx="224" cy="244" rx="24" ry="40" fill="url(#furB)" transform="rotate(-12 224 244)" filter="url(#furEdge)" />
            <ellipse cx="230" cy="226" rx="10" ry="18" fill="url(#spec)" opacity=".16" transform="rotate(-12 230 226)" />
            <g fill="#8d5f68" opacity=".7">
              <circle cx="212" cy="274" r="3.6" />
              <circle cx="222" cy="278" r="3.6" />
              <circle cx="232" cy="274" r="3.6" />
            </g>
            {(a === "eat" || a === "chew" || a === "pullBamboo") && (
              <g>
                <rect x="216" y="180" width="8" height="60" rx="4" fill="#6f9d52" />
                <rect x="218" y="180" width="2" height="60" fill="#8ec06b" opacity=".7" />
                <ellipse cx="208" cy="192" rx="13" ry="5" fill="#9ccf76" transform="rotate(-25 208 192)" />
              </g>
            )}
          </motion.g>

          {/* head */}
          <motion.g style={{ originX: 0.5, originY: 1, rotate: headRot, transformBox: "fill-box" }}>
            <motion.g
              animate={
                lite
                  ? undefined
                  : {
                      y: sleeping ? [0, 6, 0] : [0, -3, 0],
                      rotate: sleeping ? [12, 15, 12] : [0, 1.2, 0],
                    }
              }
              transition={{ duration: sleeping ? 4.6 : 2.8, repeat: Infinity, ease: "easeInOut" }}
              style={{ transformOrigin: "150px 190px" }}
            >
              {/* ears */}
              {([-1, 1] as const).map((s) => (
                <motion.g
                  key={s}
                  style={{ transformOrigin: `${150 + s * 64}px 78px`, cursor: "pointer" }}
                  onPointerDown={() => onZone?.(s < 0 ? "ear-l" : "ear-r")}
                  animate={{
                    rotate: a === "earScratch" ? [0, s * 18, -s * 8, s * 14, 0] : [0, s * 4, 0],
                    scale: a === "earScratch" ? [1, 1.1, 1] : 1,
                  }}
                  transition={{ duration: a === "earScratch" ? 0.8 : 2.4, repeat: a === "earScratch" ? 1 : Infinity }}
                >
                  <circle cx={150 + s * 64} cy="78" r="28" fill="url(#furB)" filter="url(#furEdge)" />
                  <g stroke="#3b3446" strokeWidth=".8" fill="none" opacity=".45">
                    {(s < 0 ? fur.earL : fur.earR).map((d, i) => (
                      <path key={i} d={d} strokeLinecap="round" />
                    ))}
                  </g>
                  <circle cx={150 + s * 64 - s * 6} cy="70" r="11" fill="url(#spec)" opacity=".14" />
                </motion.g>
              ))}

              {/* skull */}
              <ellipse
                cx="150"
                cy="140"
                rx="92"
                ry="80"
                fill="url(#furW)"
                filter="url(#furEdge)"
                onPointerDown={() => onZone?.("head")}
                style={{ cursor: "pointer" }}
              />
              <g stroke="#f4ece4" strokeWidth=".8" fill="none" opacity=".45" pointerEvents="none">
                {fur.head.map((d, i) => (
                  <path key={i} d={d} strokeLinecap="round" />
                ))}
              </g>
              {/* cranial volume */}
              <ellipse cx="118" cy="102" rx="46" ry="34" fill="url(#spec)" opacity=".38" pointerEvents="none" />
              <ellipse cx="150" cy="196" rx="72" ry="26" fill="url(#occ)" opacity=".35" pointerEvents="none" />
              {/* muzzle mass */}
              <ellipse cx="150" cy="176" rx="46" ry="34" fill="#fffdfa" opacity=".55" pointerEvents="none" />
              <g stroke="#f2eae2" strokeWidth=".7" fill="none" opacity=".35" pointerEvents="none">
                {[...fur.cheekL, ...fur.cheekR].map((d, i) => (
                  <path key={i} d={d} strokeLinecap="round" />
                ))}
              </g>

              {/* eye patches — the panda's expression organ, no eyebrows */}
              {([-1, 1] as const).map((s) => (
                <motion.g
                  key={s}
                  style={{ transformOrigin: `${150 + s * 36}px 134px` }}
                  animate={{ scale: face.patch, rotate: s * (16 + face.patchRot) }}
                  transition={{ type: "spring", stiffness: 170, damping: 18 }}
                  pointerEvents="none"
                >
                  <ellipse cx={150 + s * 36} cy="134" rx="28" ry="34" fill="url(#furB)" filter="url(#furEdge)" />
                  <g stroke="#2a2433" strokeWidth=".8" fill="none" opacity=".5">
                    {furRing(150 + s * 36, 134, 28, 34, lite ? 10 : 22, 6, s < 0 ? 151 : 171).map((d, i) => (
                      <path key={i} d={d} strokeLinecap="round" />
                    ))}
                  </g>
                </motion.g>
              ))}

              {/* eyes */}
              {([-1, 1] as const).map((s) => (
                <g key={s} pointerEvents="none">
                  <motion.ellipse
                    cx={150 + s * 34}
                    cy="134"
                    rx="13"
                    ry="14"
                    fill="#fffdf9"
                    animate={{ ry: 14 * eyeOpen }}
                    transition={{ duration: 0.09 }}
                  />
                  <motion.g animate={{ opacity: eyeOpen > 0.2 ? 1 : 0 }} transition={{ duration: 0.1 }}>
                    <motion.circle
                      cx={150 + s * 34}
                      cy="134"
                      r={7 * face.pupilScale}
                      fill="#120f18"
                      style={{ x: s < 0 ? px : pxR, y: py }}
                    />
                    <motion.circle cx={150 + s * 34 - 3} cy="130" r="2.6" fill="#fff" style={{ x: s < 0 ? px : pxR, y: py }} />
                    <motion.circle cx={150 + s * 34 + 3} cy="138" r="1.3" fill="#fff" opacity=".6" style={{ x: s < 0 ? px : pxR, y: py }} />
                  </motion.g>
                  {eyeOpen <= 0.2 && (
                    <path
                      d={`M ${150 + s * 34 - 11} 136 q 11 ${sleeping ? 8 : -11} 22 0`}
                      stroke="#0f0c14"
                      strokeWidth="3.2"
                      fill="none"
                      strokeLinecap="round"
                    />
                  )}
                </g>
              ))}

              {/* blush */}
              <motion.g animate={{ opacity: face.blush ? 0.7 : 0 }} filter="url(#soft)" pointerEvents="none">
                <ellipse cx="96" cy="172" rx="16" ry="10" fill="var(--petal)" />
                <ellipse cx="204" cy="172" rx="16" ry="10" fill="var(--petal)" />
              </motion.g>

              {/* nose + philtrum */}
              <g>
                <path
                  d="M 150 170 m -13 0 q 13 -10 26 0 q -6 13 -13 13 q -7 0 -13 -13"
                  fill="#1b1721"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    onZone?.("nose");
                  }}
                  style={{ cursor: "pointer" }}
                />
                <ellipse cx="145" cy="167" rx="4" ry="2.4" fill="#5b5266" opacity=".7" pointerEvents="none" />
                <path d="M 150 183 L 150 192" stroke="#2a2433" strokeWidth="2.4" strokeLinecap="round" pointerEvents="none" />
              </g>

              {/* whiskers */}
              {!lite &&
                ([-1, 1] as const).map((s) => (
                  <g key={s} stroke="#efe6dc" strokeWidth="1" opacity=".5" pointerEvents="none">
                    <path d={`M ${150 + s * 30} 178 q ${s * 26} -4 ${s * 44} -10`} fill="none" strokeLinecap="round" />
                    <path d={`M ${150 + s * 30} 184 q ${s * 26} 0 ${s * 46} 0`} fill="none" strokeLinecap="round" />
                  </g>
                ))}

              {/* mouth */}
              <motion.g
                style={{ transformOrigin: "150px 192px" }}
                animate={{ scaleY: a === "chew" || a === "eat" ? [1, 0.6, 1] : a === "yawn" ? [1, 1.9, 1] : 1 }}
                transition={{ duration: a === "yawn" ? 1.8 : 0.35, repeat: a === "chew" || a === "eat" ? 6 : 0 }}
                pointerEvents="none"
              >
                <path
                  transform="translate(150 148)"
                  d={MOUTHS[face.mouth]}
                  stroke="#1b1721"
                  strokeWidth="3.6"
                  strokeLinecap="round"
                  fill={
                    face.mouth === "bigSmile" || face.mouth === "open" || face.mouth === "grin" || face.mouth === "o"
                      ? "#4d222c"
                      : "none"
                  }
                />
                {(face.mouth === "tongue" || face.mouth === "bigSmile" || face.mouth === "open") && (
                  <ellipse cx="150" cy={face.mouth === "tongue" ? 200 : 202} rx="10" ry="7" fill="#e08c9c" />
                )}
              </motion.g>

              {/* costume flair */}
              {state.costume !== "classic" && (
                <text x="150" y="50" textAnchor="middle" fontSize="40" pointerEvents="none">
                  {COSTUME_LABEL[state.costume]}
                </text>
              )}
              {state.costume === "golden" && (
                <ellipse cx="150" cy="140" rx="94" ry="82" fill="none" stroke="#f0d78c" strokeWidth="3" opacity=".8" pointerEvents="none" />
              )}
            </motion.g>
          </motion.g>
        </motion.g>
      </motion.g>
    </svg>
  );
});
