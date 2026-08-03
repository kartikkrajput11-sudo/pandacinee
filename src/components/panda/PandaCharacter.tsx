import { memo, useEffect, useMemo, useState } from "react";
import { motion, useSpring } from "framer-motion";
import type { Costume, Emotion, PandaState, Zone } from "./usePandaBrain";

type Face = {
  eye: number; // 0 closed -> 1 wide
  brow: number; // -6 angry .. 8 worried
  browRot: number;
  mouth: "smile" | "bigSmile" | "open" | "flat" | "wobble" | "o" | "grin" | "tongue";
  blush: boolean;
  tilt: number;
  pupilScale: number;
};

const FACES: Record<Emotion, Face> = {
  idle: { eye: 1, brow: 0, browRot: 0, mouth: "smile", blush: false, tilt: 0, pupilScale: 1 },
  happy: { eye: 0.85, brow: 2, browRot: -4, mouth: "bigSmile", blush: true, tilt: -3, pupilScale: 1.05 },
  curious: { eye: 1.1, brow: 4, browRot: -10, mouth: "o", blush: false, tilt: 8, pupilScale: 1.1 },
  sleepy: { eye: 0.4, brow: -2, browRot: 6, mouth: "wobble", blush: false, tilt: 6, pupilScale: 0.9 },
  asleep: { eye: 0.02, brow: -2, browRot: 6, mouth: "wobble", blush: false, tilt: 10, pupilScale: 0.8 },
  excited: { eye: 1.25, brow: 6, browRot: -8, mouth: "grin", blush: true, tilt: -5, pupilScale: 1.2 },
  shy: { eye: 0.55, brow: 3, browRot: 8, mouth: "wobble", blush: true, tilt: 12, pupilScale: 1.15 },
  embarrassed: { eye: 0.35, brow: 5, browRot: 10, mouth: "wobble", blush: true, tilt: -10, pupilScale: 1.1 },
  confused: { eye: 0.9, brow: 4, browRot: -14, mouth: "wobble", blush: false, tilt: 12, pupilScale: 1 },
  playful: { eye: 1, brow: 2, browRot: -6, mouth: "tongue", blush: true, tilt: -8, pupilScale: 1.1 },
  hungry: { eye: 1, brow: 1, browRot: -3, mouth: "open", blush: false, tilt: 4, pupilScale: 1.05 },
  proud: { eye: 0.8, brow: -1, browRot: -8, mouth: "grin", blush: false, tilt: -4, pupilScale: 1 },
  chaotic: { eye: 1.3, brow: 6, browRot: -12, mouth: "grin", blush: true, tilt: -12, pupilScale: 1.25 },
  angry: { eye: 0.9, brow: -6, browRot: 16, mouth: "flat", blush: true, tilt: 0, pupilScale: 0.95 },
  surprised: { eye: 1.35, brow: 8, browRot: -2, mouth: "o", blush: false, tilt: 0, pupilScale: 1.3 },
  scared: { eye: 1.3, brow: 7, browRot: 10, mouth: "wobble", blush: false, tilt: -6, pupilScale: 1.25 },
  relaxed: { eye: 0.5, brow: 1, browRot: 4, mouth: "smile", blush: true, tilt: 5, pupilScale: 0.95 },
  dreaming: { eye: 0.03, brow: 0, browRot: 6, mouth: "smile", blush: true, tilt: 12, pupilScale: 0.8 },
  celebrating: { eye: 0.25, brow: 5, browRot: -8, mouth: "bigSmile", blush: true, tilt: -6, pupilScale: 1.1 },
  focused: { eye: 0.85, brow: -3, browRot: 8, mouth: "flat", blush: false, tilt: 0, pupilScale: 0.9 },
  dizzy: { eye: 0.9, brow: 3, browRot: -6, mouth: "wobble", blush: true, tilt: -14, pupilScale: 1.1 },
  crossEyed: { eye: 1.1, brow: 4, browRot: -6, mouth: "o", blush: true, tilt: 0, pupilScale: 1 },
  laughing: { eye: 0.15, brow: 4, browRot: -6, mouth: "bigSmile", blush: true, tilt: -8, pupilScale: 1 },
  disappointed: { eye: 0.6, brow: 4, browRot: 12, mouth: "wobble", blush: false, tilt: 8, pupilScale: 0.95 },
};

const MOUTHS: Record<Face["mouth"], string> = {
  smile: "M -18 42 Q 0 56 18 42",
  bigSmile: "M -26 38 Q 0 68 26 38 Q 0 50 -26 38",
  open: "M -18 40 Q 0 74 18 40 Q 0 52 -18 40",
  flat: "M -16 46 L 16 46",
  wobble: "M -18 46 Q -9 38 0 46 Q 9 54 18 46",
  o: "M 0 48 m -11 0 a 11 12 0 1 0 22 0 a 11 12 0 1 0 -22 0",
  grin: "M -26 38 Q 0 66 26 38 L -26 38",
  tongue: "M -20 40 Q 0 62 20 40 Q 0 50 -20 40",
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

export type PandaCharacterProps = {
  state: PandaState;
  onZone?: (zone: Zone) => void;
  className?: string;
  /** Reduce secondary motion on low-power devices. */
  lite?: boolean;
};

/**
 * The mascot itself — a fully rigged SVG panda. Every emotion drives eyes,
 * brows, mouth, ears, tail and posture; secondary motion never stops.
 */
export const PandaCharacter = memo(function PandaCharacter({
  state,
  onZone,
  className,
  lite = false,
}: PandaCharacterProps) {
  const face = FACES[state.emotion] ?? FACES.idle;
  const [blink, setBlink] = useState(false);

  // Natural, irregular blinking.
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

  useEffect(() => {
    lookX.set(state.look.x);
    lookY.set(state.look.y);
    headRot.set(state.look.x * 7 + face.tilt);
  }, [state.look.x, state.look.y, face.tilt, lookX, lookY, headRot]);

  const a = state.action;
  const crossed = state.emotion === "crossEyed";
  const eyeOpen = blink || state.emotion === "asleep" ? 0.03 : face.eye;

  const px = crossed ? 4 : state.look.x * 6;
  const pxR = crossed ? -4 : state.look.x * 6;
  const py = state.look.y * 5;

  // Body-level performance per action.
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
        return { scaleY: [1, 1.12, 1], scaleX: [1, 0.94, 1], transition: { duration: 1.1 } };
      case "sneeze":
        return { y: [0, -6, 10, 0], scaleX: [1, 1.08, 0.96, 1], transition: { duration: 0.5 } };
      case "wake":
        return { rotate: [8, -4, 0], transition: { duration: 0.7 } };
      default:
        return {
          y: [0, -5, 0],
          transition: { duration: 3.4, repeat: Infinity, ease: "easeInOut" as const },
        };
    }
  }, [a]);

  const sleeping = state.emotion === "asleep" || state.emotion === "dreaming";

  return (
    <svg
      viewBox="0 0 300 360"
      className={className}
      role="img"
      aria-label="PandaCine mascot"
      style={{ overflow: "visible", touchAction: "manipulation" }}
    >
      <defs>
        <radialGradient id="furW" cx="42%" cy="32%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="70%" stopColor="#f6efe9" />
          <stop offset="100%" stopColor="#ddd0c8" />
        </radialGradient>
        <radialGradient id="furB" cx="38%" cy="28%">
          <stop offset="0%" stopColor="#4a4550" />
          <stop offset="60%" stopColor="#221f28" />
          <stop offset="100%" stopColor="#100e14" />
        </radialGradient>
        <radialGradient id="rim" cx="50%" cy="50%">
          <stop offset="60%" stopColor="transparent" />
          <stop offset="100%" stopColor="color-mix(in oklab, var(--petal) 55%, transparent)" />
        </radialGradient>
        <radialGradient id="shadow" cx="50%" cy="50%">
          <stop offset="0%" stopColor="rgba(0,0,0,.55)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>
        <filter id="soft" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
      </defs>

      {/* contact shadow */}
      <motion.ellipse
        cx="150"
        cy="336"
        rx="96"
        ry="16"
        fill="url(#shadow)"
        animate={lite ? undefined : { rx: [96, 88, 96], opacity: [0.9, 0.7, 0.9] }}
        transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.g animate={bodyAnim} style={{ transformOrigin: "150px 300px" }}>
        {/* tail — physics-ish sway */}
        <motion.ellipse
          cx="232"
          cy="268"
          rx="20"
          ry="17"
          fill="url(#furB)"
          onPointerDown={() => onZone?.("tail")}
          style={{ cursor: "pointer", transformOrigin: "215px 268px" }}
          animate={{ rotate: a === "tailPull" ? [0, -28, 10, 0] : [-6, 6, -6] }}
          transition={{ duration: a === "tailPull" ? 0.6 : 2.6, repeat: a === "tailPull" ? 0 : Infinity, ease: "easeInOut" }}
        />

        {/* legs */}
        <motion.ellipse
          cx="104"
          cy="312"
          rx="34"
          ry="23"
          fill="url(#furB)"
          animate={{ rotate: a === "sugarRush" || a === "tickle" ? [0, -12, 12, 0] : [0, 2, 0] }}
          transition={{ duration: a ? 0.5 : 3.2, repeat: Infinity }}
          style={{ transformOrigin: "120px 300px" }}
        />
        <motion.ellipse
          cx="196"
          cy="312"
          rx="34"
          ry="23"
          fill="url(#furB)"
          animate={{ rotate: a === "sugarRush" || a === "tickle" ? [0, 12, -12, 0] : [0, -2, 0] }}
          transition={{ duration: a ? 0.5 : 3.2, repeat: Infinity }}
          style={{ transformOrigin: "180px 300px" }}
        />
        {/* toe beans */}
        <g fill="#c98a94" opacity=".8">
          <circle cx="92" cy="308" r="4" />
          <circle cx="104" cy="304" r="4" />
          <circle cx="116" cy="308" r="4" />
          <circle cx="184" cy="308" r="4" />
          <circle cx="196" cy="304" r="4" />
          <circle cx="208" cy="308" r="4" />
        </g>

        {/* body */}
        <motion.g
          onPointerDown={() => onZone?.("body")}
          style={{ cursor: "pointer", transformOrigin: "150px 250px" }}
          animate={
            lite
              ? undefined
              : { scaleX: [1, 1.02, 1], scaleY: [1, 0.985, 1] } // breathing
          }
          transition={{ duration: 3.1, repeat: Infinity, ease: "easeInOut" }}
        >
          <ellipse cx="150" cy="248" rx="86" ry="80" fill="url(#furW)" />
          <ellipse
            cx="150"
            cy="256"
            rx="58"
            ry="58"
            fill="#fffaf6"
            opacity=".85"
            onPointerDown={(e) => {
              e.stopPropagation();
              onZone?.("belly");
            }}
            style={{ cursor: "pointer" }}
          />
          <ellipse cx="150" cy="248" rx="86" ry="80" fill="url(#rim)" opacity=".5" />
        </motion.g>

        {/* arms */}
        <motion.g
          style={{ transformOrigin: "84px 216px", cursor: "pointer" }}
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
                      : [2, -4, 2],
          }}
          transition={{ duration: a ? 0.9 : 3.6, repeat: a ? 1 : Infinity, ease: "easeInOut" }}
        >
          <ellipse cx="78" cy="238" rx="23" ry="38" fill="url(#furB)" transform="rotate(12 78 238)" />
          <g fill="#c98a94" opacity=".55">
            <circle cx="70" cy="266" r="3.4" />
            <circle cx="80" cy="270" r="3.4" />
            <circle cx="89" cy="266" r="3.4" />
          </g>
        </motion.g>
        <motion.g
          style={{ transformOrigin: "216px 216px", cursor: "pointer" }}
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
                        : [-2, 4, -2],
          }}
          transition={{ duration: a ? 0.9 : 3.6, repeat: a ? 1 : Infinity, ease: "easeInOut" }}
        >
          <ellipse cx="222" cy="238" rx="23" ry="38" fill="url(#furB)" transform="rotate(-12 222 238)" />
          <g fill="#c98a94" opacity=".55">
            <circle cx="211" cy="266" r="3.4" />
            <circle cx="221" cy="270" r="3.4" />
            <circle cx="230" cy="266" r="3.4" />
          </g>
          {(a === "eat" || a === "chew" || a === "pullBamboo") && (
            <g>
              <rect x="214" y="176" width="8" height="60" rx="4" fill="#7fae5e" />
              <ellipse cx="206" cy="188" rx="12" ry="5" fill="#9ccf76" transform="rotate(-25 206 188)" />
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
                    y: sleeping ? [0, 5, 0] : [0, -3, 0],
                    rotate: sleeping ? [10, 13, 10] : [0, 1.2, 0],
                  }
            }
            transition={{ duration: sleeping ? 4 : 2.8, repeat: Infinity, ease: "easeInOut" }}
            style={{ transformOrigin: "150px 180px" }}
          >
            {/* ears */}
            {([-1, 1] as const).map((s) => (
              <motion.g
                key={s}
                style={{ transformOrigin: `${150 + s * 64}px 78px`, cursor: "pointer" }}
                onPointerDown={() => onZone?.(s < 0 ? "ear-l" : "ear-r")}
                animate={{
                  rotate:
                    a === "earScratch"
                      ? [0, s * 18, -s * 8, s * 14, 0]
                      : [0, s * 4, 0],
                  scale: a === "earScratch" ? [1, 1.1, 1] : 1,
                }}
                transition={{ duration: a === "earScratch" ? 0.8 : 2.4, repeat: a === "earScratch" ? 1 : Infinity }}
              >
                <circle cx={150 + s * 64} cy="78" r="28" fill="url(#furB)" />
                <circle cx={150 + s * 64} cy="80" r="14" fill="#3b2f36" opacity=".9" />
              </motion.g>
            ))}

            {/* head shape */}
            <ellipse cx="150" cy="140" rx="92" ry="80" fill="url(#furW)" onPointerDown={() => onZone?.("head")} style={{ cursor: "pointer" }} />
            <ellipse cx="150" cy="140" rx="92" ry="80" fill="url(#rim)" opacity=".45" />
            {/* fur wisps */}
            <path d="M 96 78 q 10 -14 22 -6" stroke="#efe6df" strokeWidth="4" fill="none" strokeLinecap="round" opacity=".7" />
            <path d="M 182 72 q 12 -12 22 -2" stroke="#efe6df" strokeWidth="4" fill="none" strokeLinecap="round" opacity=".7" />

            {/* eye patches */}
            {([-1, 1] as const).map((s) => (
              <ellipse
                key={s}
                cx={150 + s * 36}
                cy="134"
                rx="27"
                ry="33"
                fill="url(#furB)"
                transform={`rotate(${s * 16} ${150 + s * 36} 134)`}
              />
            ))}

            {/* eyes */}
            {([-1, 1] as const).map((s) => (
              <g key={s}>
                <motion.ellipse
                  cx={150 + s * 34}
                  cy="134"
                  rx="14"
                  fill="#fffdf9"
                  animate={{ ry: 15 * eyeOpen }}
                  transition={{ duration: 0.09 }}
                />
                <motion.g animate={{ opacity: eyeOpen > 0.2 ? 1 : 0 }} transition={{ duration: 0.1 }}>
                  <motion.circle
                    cx={150 + s * 34}
                    cy="134"
                    r={7 * face.pupilScale}
                    fill="#15121a"
                    style={{ x: s < 0 ? px : pxR, y: py }}
                  />
                  <motion.circle
                    cx={150 + s * 34 - 3}
                    cy="130"
                    r="2.8"
                    fill="#fff"
                    style={{ x: s < 0 ? px : pxR, y: py }}
                  />
                </motion.g>
                {/* closed-eye happy arc */}
                {eyeOpen <= 0.2 && (
                  <path
                    d={`M ${150 + s * 34 - 12} 136 q 12 ${sleeping ? 8 : -12} 24 0`}
                    stroke="#15121a"
                    strokeWidth="3.4"
                    fill="none"
                    strokeLinecap="round"
                  />
                )}
              </g>
            ))}

            {/* eyebrows */}
            {([-1, 1] as const).map((s) => (
              <motion.path
                key={s}
                d={`M ${150 + s * 46} ${96} q ${s * 14} -8 ${s * 26} 2`}
                stroke="#2a232c"
                strokeWidth="5"
                strokeLinecap="round"
                fill="none"
                animate={{ y: -face.brow, rotate: s * face.browRot }}
                style={{ transformOrigin: `${150 + s * 46}px 96px` }}
                transition={{ type: "spring", stiffness: 200, damping: 16 }}
              />
            ))}

            {/* blush */}
            <motion.g animate={{ opacity: face.blush ? 0.75 : 0 }} filter="url(#soft)">
              <ellipse cx="92" cy="164" rx="16" ry="10" fill="var(--petal)" />
              <ellipse cx="208" cy="164" rx="16" ry="10" fill="var(--petal)" />
            </motion.g>

            {/* nose */}
            <path
              d="M 150 168 m -13 0 q 13 -9 26 0 q -6 12 -13 12 q -7 0 -13 -12"
              fill="#241f27"
              onPointerDown={(e) => {
                e.stopPropagation();
                onZone?.("nose");
              }}
              style={{ cursor: "pointer" }}
            />

            {/* mouth */}
            <motion.g style={{ transformOrigin: "150px 190px" }} animate={{ scaleY: a === "chew" || a === "eat" ? [1, 0.6, 1] : 1 }} transition={{ duration: 0.35, repeat: a === "chew" || a === "eat" ? 6 : 0 }}>
              <path
                transform="translate(150 148)"
                d={MOUTHS[face.mouth]}
                stroke="#241f27"
                strokeWidth="4"
                strokeLinecap="round"
                fill={face.mouth === "bigSmile" || face.mouth === "open" || face.mouth === "grin" || face.mouth === "o" ? "#5a2733" : "none"}
              />
              {(face.mouth === "tongue" || face.mouth === "bigSmile" || face.mouth === "open") && (
                <ellipse cx="150" cy={face.mouth === "tongue" ? 198 : 200} rx="11" ry="8" fill="#e98d9e" />
              )}
            </motion.g>

            {/* costume flair */}
            {state.costume !== "classic" && (
              <text x="150" y="52" textAnchor="middle" fontSize="40">
                {COSTUME_LABEL[state.costume]}
              </text>
            )}
            {state.costume === "golden" && (
              <ellipse cx="150" cy="140" rx="94" ry="82" fill="none" stroke="#f0d78c" strokeWidth="3" opacity=".8" />
            )}
          </motion.g>
        </motion.g>
      </motion.g>
    </svg>
  );
});
