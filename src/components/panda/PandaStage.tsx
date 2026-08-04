import { useCallback, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Cookie, Popcorn, Camera, Hand, Sparkles, Leaf } from "lucide-react";
import { PandaCharacter } from "./PandaCharacter";
import { usePandaBrain, type Zone } from "./usePandaBrain";
import { Spotlight } from "@/components/ui/spotlight";
import { pandaSfx } from "@/lib/panda-sfx";
import { cn } from "@/lib/utils";

type Props = {
  name?: string;
  className?: string;
  /** Show treats / tickle meter / hint chips. */
  playful?: boolean;
  onInteract?: (kind: string) => void;
  /** Simplified motion for small or low-power surfaces. */
  lite?: boolean;
};

const TICKLE_LABEL = ["", "giggle", "laughing", "rolling", "can't breathe", "cute aggression"];

/**
 * The stage the mascot lives on: cinematic lights, ambient particles,
 * drag physics, treats and every direct interaction.
 */
export function PandaStage({ name = "Pan", className, playful = true, onInteract, lite = false }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const { state, interact, feel, doAction, say, burstConfetti } = usePandaBrain({
    containerRef: ref,
    onInteract,
  });
  const [dragging, setDragging] = useState(false);

  const onZone = useCallback((zone: Zone) => interact(zone), [interact]);

  const treat = useCallback(
    (kind: "bamboo" | "popcorn" | "cookie") => {
      interact(kind);
      say(kind === "cookie" ? "sugar!!" : kind === "popcorn" ? "catch!" : "yum 🎋", 1800);
    },
    [interact, say],
  );

  const particles = useMemo(
    () => Array.from({ length: lite ? 6 : 14 }, (_, i) => ({ id: i, x: Math.random() * 100, d: 6 + Math.random() * 10, delay: Math.random() * 8 })),
    [lite],
  );

  const sleeping = state.emotion === "asleep" || state.emotion === "dreaming";

  return (
    <div
      ref={ref}
      className={cn("relative select-none", className)}
      onDoubleClick={() => interact("camera")}
      onContextMenu={(e) => {
        e.preventDefault();
        interact("peekaboo");
      }}
    >
      <Spotlight size={280} className="z-0" />

      {/* volumetric cinema lights */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(45% 40% at 50% 8%, color-mix(in oklab, var(--petal) 22%, transparent), transparent 70%), radial-gradient(40% 40% at 15% 90%, color-mix(in oklab, var(--lavender) 18%, transparent), transparent 70%)",
        }}
      />

      {/* ambient particles */}
      {!lite && (
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden z-0">
          {particles.map((p) => (
            <motion.span
              key={p.id}
              className="absolute size-1 rounded-full bg-petal/50"
              style={{ left: `${p.x}%`, bottom: -8 }}
              animate={{ y: [-0, -320], opacity: [0, 0.9, 0] }}
              transition={{ duration: p.d, repeat: Infinity, delay: p.delay, ease: "easeOut" }}
            />
          ))}
        </div>
      )}

      {/* the panda */}
      <motion.div
        drag
        dragElastic={0.28}
        dragMomentum={false}
        dragSnapToOrigin
        onDragStart={() => {
          setDragging(true);
          interact("drag");
        }}
        onDragEnd={() => {
          setDragging(false);
          feel("playful", 1400);
          pandaSfx.pop();
        }}
        animate={state.chaos ? { x: [0, -60, 60, -30, 0] } : undefined}
        transition={{ duration: 1.6, repeat: state.chaos ? Infinity : 0 }}
        className={cn("relative z-10 mx-auto w-full max-w-[420px] cursor-grab active:cursor-grabbing", dragging && "z-20")}
      >
        <PandaCharacter state={state} onZone={onZone} lite={lite} className="w-full h-auto" />



        {/* speech / thought bubbles */}
        <AnimatePresence>
          {(state.says || state.thought) && (
            <motion.div
              key={state.says ?? state.thought ?? ""}
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-2 rounded-2xl glass-strong px-4 py-2 text-sm font-serif italic whitespace-nowrap"
            >
              {state.thought ? `💭 ${state.thought}` : state.says}
            </motion.div>
          )}
        </AnimatePresence>

        {/* sleeping z's */}
        {sleeping && (
          <div aria-hidden className="pointer-events-none absolute right-6 top-6">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="absolute font-serif italic text-petal"
                style={{ fontSize: 16 + i * 6 }}
                animate={{ y: [-0, -40], x: [0, 14], opacity: [0, 1, 0] }}
                transition={{ duration: 3, repeat: Infinity, delay: i * 0.9 }}
              >
                z
              </motion.span>
            ))}
          </div>
        )}

        {/* hearts */}
        <AnimatePresence>
          {state.hearts > 0 &&
            Array.from({ length: state.hearts }).map((_, i) => (
              <motion.span
                key={i}
                className="pointer-events-none absolute left-1/2 top-1/3 text-petal"
                initial={{ opacity: 0, y: 0, x: 0, scale: 0.6 }}
                animate={{ opacity: [0, 1, 0], y: -120 - i * 12, x: (i - 2) * 26, scale: 1.1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 2, delay: i * 0.08 }}
              >
                ❤︎
              </motion.span>
            ))}
        </AnimatePresence>
      </motion.div>

      {/* confetti */}
      <AnimatePresence>
        {state.confetti > 0 && (
          <div aria-hidden className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
            {Array.from({ length: state.confetti }).map((_, i) => (
              <motion.span
                key={i}
                className="absolute size-1.5 rounded-[2px]"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: "-5%",
                  background: ["var(--petal)", "#f0d78c", "#5cbdb9", "#c96b7a"][i % 4],
                }}
                initial={{ y: -20, rotate: 0, opacity: 1 }}
                animate={{ y: 420, rotate: 720, opacity: [1, 1, 0] }}
                transition={{ duration: 2 + Math.random() * 1.5, ease: "easeIn" }}
              />
            ))}
          </div>
        )}
      </AnimatePresence>

      {playful && (
        <div className="relative z-30 mt-2 space-y-3">
          {/* tickle meter */}
          <div className="mx-auto max-w-[320px]">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.22em] text-candle-muted">
              <span>Tickle meter</span>
              <span className="text-petal">{TICKLE_LABEL[state.tickle] || "calm"}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-surface overflow-hidden border border-border">
              <motion.div
                className="h-full bg-petal petal-glow"
                animate={{ width: `${(state.tickle / 5) * 100}%` }}
                transition={{ type: "spring", stiffness: 120, damping: 18 }}
              />
            </div>
          </div>

          {/* treats & gestures */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Chip onClick={() => treat("bamboo")} Icon={Leaf} label="Bamboo" />
            <Chip onClick={() => treat("popcorn")} Icon={Popcorn} label="Popcorn" />
            <Chip onClick={() => treat("cookie")} Icon={Cookie} label="Cookie" />
            <Chip onClick={() => interact("paw-r")} Icon={Hand} label="Paw shake" />
            <Chip onClick={() => interact("camera")} Icon={Camera} label="Photo" />
            <Chip
              onClick={() => {
                doAction("dance", 2400);
                feel("celebrating", 2600);
                burstConfetti(50);
                pandaSfx.celebrate();
              }}
              Icon={Sparkles}
              label="Dance"
            />
          </div>

          <p className="text-center text-[11px] text-candle-muted">
            Pat the head · boop the nose · rub the belly · pull the tail · drag {name} around · double-click for a photo ·
            type <span className="text-petal">PANDA</span>
          </p>
        </div>
      )}
    </div>
  );
}

function Chip({ onClick, Icon, label }: { onClick: () => void; Icon: typeof Leaf; label: string }) {
  return (
    <button
      onClick={onClick}
      className="group relative flex items-center gap-1.5 rounded-full border border-border bg-surface/70 px-3 py-1.5 text-[11px] uppercase tracking-widest text-candle-muted transition-all hover:border-petal/50 hover:text-petal active:scale-95"
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  );
}
