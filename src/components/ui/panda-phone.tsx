import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

/**
 * A stylized panda mascot holding a phone. The phone screen shows a
 * different feature scene per active section, with real Pandacine gestures
 * (kiss, hug, nudge, chat, movie, games, groups, milestones).
 */
export function PandaPhone({ scene }: { scene: number }) {
  return (
    <div className="relative w-[300px] h-[440px] sm:w-[340px] sm:h-[500px]">
      {/* soft velvet halo */}
      <div className="absolute inset-0 rounded-full blur-3xl bg-[radial-gradient(circle_at_50%_45%,rgba(240,166,186,0.28),transparent_70%)]" />

      {/* panda body */}
      <motion.svg
        viewBox="0 0 340 500"
        className="absolute inset-0 w-full h-full drop-shadow-[0_30px_50px_rgba(0,0,0,0.35)]"
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        <defs>
          <radialGradient id="fur" cx="50%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#fff8f5" />
            <stop offset="100%" stopColor="#e8dcd6" />
          </radialGradient>
          <radialGradient id="ear" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#3a2933" />
            <stop offset="100%" stopColor="#1b1220" />
          </radialGradient>
        </defs>

        {/* body */}
        <ellipse cx="170" cy="360" rx="115" ry="120" fill="url(#fur)" />
        {/* legs */}
        <ellipse cx="115" cy="455" rx="35" ry="22" fill="#1b1220" />
        <ellipse cx="225" cy="455" rx="35" ry="22" fill="#1b1220" />
        {/* head */}
        <ellipse cx="170" cy="170" rx="120" ry="110" fill="url(#fur)" />
        {/* ears */}
        <circle cx="80" cy="80" r="34" fill="url(#ear)" />
        <circle cx="260" cy="80" r="34" fill="url(#ear)" />
        <circle cx="80" cy="80" r="18" fill="#4a2c3a" opacity="0.6" />
        <circle cx="260" cy="80" r="18" fill="#4a2c3a" opacity="0.6" />
        {/* eye patches */}
        <ellipse cx="128" cy="170" rx="26" ry="34" fill="#1b1220" transform="rotate(-18 128 170)" />
        <ellipse cx="212" cy="170" rx="26" ry="34" fill="#1b1220" transform="rotate(18 212 170)" />
        {/* eyes */}
        <circle cx="132" cy="178" r="7" fill="#fff" />
        <circle cx="208" cy="178" r="7" fill="#fff" />
        <circle cx="133" cy="180" r="3" fill="#1b1220" />
        <circle cx="209" cy="180" r="3" fill="#1b1220" />
        {/* nose + mouth */}
        <ellipse cx="170" cy="215" rx="9" ry="7" fill="#1b1220" />
        <path d="M170 222 Q160 235 152 232 M170 222 Q180 235 188 232" stroke="#1b1220" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        {/* blush */}
        <circle cx="105" cy="210" r="12" fill="#f0a6ba" opacity="0.55" />
        <circle cx="235" cy="210" r="12" fill="#f0a6ba" opacity="0.55" />

        {/* left arm holding phone bottom */}
        <motion.g
          animate={{ rotate: [0, 2, 0, -2, 0] }}
          transition={{ duration: 5, repeat: Infinity }}
          style={{ transformOrigin: "80px 320px" }}
        >
          <ellipse cx="70" cy="360" rx="30" ry="55" fill="#1b1220" transform="rotate(-18 70 360)" />
          <ellipse cx="62" cy="405" rx="22" ry="18" fill="#1b1220" />
        </motion.g>
        {/* right arm holding phone top */}
        <motion.g
          animate={{ rotate: [0, -2, 0, 2, 0] }}
          transition={{ duration: 5, repeat: Infinity }}
          style={{ transformOrigin: "260px 320px" }}
        >
          <ellipse cx="270" cy="360" rx="30" ry="55" fill="#1b1220" transform="rotate(18 270 360)" />
          <ellipse cx="278" cy="405" rx="22" ry="18" fill="#1b1220" />
        </motion.g>
      </motion.svg>

      {/* phone in front of panda */}
      <motion.div
        className="absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2 w-[170px] h-[300px] rounded-[28px] bg-gradient-to-b from-[#2a1a2f] to-[#160b1c] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.6)] p-2"
        animate={{ y: [0, -3, 0], rotate: [-2, 1, -2] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* notch */}
        <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-14 h-3 rounded-full bg-black/80 z-20" />
        {/* screen */}
        <div className="relative w-full h-full rounded-[22px] overflow-hidden bg-gradient-to-br from-[#1a0d1f] via-[#2a1530] to-[#1a0d1f]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(240,166,186,0.18),transparent_65%)]" />
          <div className="absolute top-2 left-0 right-0 text-center text-[7px] tracking-[0.3em] text-petal font-serif italic z-10">
            PANDACINE
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={scene}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0 pt-6"
            >
              <SceneRenderer scene={scene} />
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

function SceneRenderer({ scene }: { scene: number }) {
  switch (scene) {
    case 0:
      return <HeroScene />;
    case 1:
      return <ChatScene />;
    case 2:
      return <CinemaScene />;
    case 3:
      return <GamesScene />;
    case 4:
      return <GroupsScene />;
    case 5:
      return <MilestonesScene />;
    default:
      return <HeroScene />;
  }
}

function HeroScene() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2 px-3">
      <motion.div
        className="text-4xl"
        animate={{ scale: [1, 1.15, 1], rotate: [0, 8, -8, 0] }}
        transition={{ duration: 3, repeat: Infinity }}
      >
        🐼
      </motion.div>
      <div className="text-[9px] font-serif italic text-candle text-center leading-tight">
        A cinema built for two
      </div>
      <motion.div
        className="mt-2 px-2.5 py-1 rounded-full bg-petal text-velvet text-[7px] font-semibold tracking-wider"
        animate={{ scale: [1, 1.06, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        ENTER THE ROOM
      </motion.div>
    </div>
  );
}

function ChatScene() {
  return (
    <div className="relative h-full px-2 py-1">
      {/* chat bubbles */}
      <ChatBubble delay={0} side="peer" text="miss you 🐼" />
      <ChatBubble delay={0.6} side="me" text="sending a hug" y={44} />
      <ChatBubble delay={1.2} side="peer" text="↩ replied" y={82} tiny />

      {/* HUG animation — arms wrap */}
      <motion.div
        className="absolute inset-x-0 top-[42%] flex justify-center gap-1 text-2xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 1, 0] }}
        transition={{ duration: 3, repeat: Infinity, delay: 1.4, times: [0, 0.2, 0.7, 1] }}
      >
        <motion.span animate={{ x: [-30, 0, 0, -30] }} transition={{ duration: 3, repeat: Infinity, delay: 1.4 }}>🫂</motion.span>
      </motion.div>

      {/* KISS lipstick */}
      <motion.div
        className="absolute right-6 top-[58%] text-xl"
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: [0, 1.2, 1, 0], rotate: [-20, 0, 0, 10] }}
        transition={{ duration: 3.4, repeat: Infinity, delay: 2 }}
      >
        💋
      </motion.div>

      {/* NUDGE ring */}
      <motion.div
        className="absolute left-1/2 top-[70%] -translate-x-1/2 w-16 h-16 rounded-full border-2 border-petal"
        initial={{ scale: 0, opacity: 0.8 }}
        animate={{ scale: [0, 2.4], opacity: [0.8, 0] }}
        transition={{ duration: 1.6, repeat: Infinity, delay: 0.8 }}
      />

      {/* composer */}
      <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1">
        <div className="flex-1 h-4 rounded-full bg-white/10 border border-white/10" />
        <div className="w-4 h-4 rounded-full bg-petal shadow-[0_0_8px_rgba(240,166,186,0.7)]" />
      </div>
    </div>
  );
}

function ChatBubble({
  side,
  text,
  y = 6,
  delay = 0,
  tiny = false,
}: {
  side: "me" | "peer";
  text: string;
  y?: number;
  delay?: number;
  tiny?: boolean;
}) {
  const me = side === "me";
  return (
    <motion.div
      className={`absolute ${me ? "right-2" : "left-2"} max-w-[70%]`}
      style={{ top: y }}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
    >
      <div
        className={`px-2 py-1 rounded-2xl ${tiny ? "text-[6px]" : "text-[7px]"} leading-tight ${
          me ? "bg-petal text-velvet rounded-br-md" : "bg-white/10 text-candle border border-white/10 rounded-bl-md"
        }`}
      >
        {text}
      </div>
    </motion.div>
  );
}

function CinemaScene() {
  return (
    <div className="relative h-full px-2 py-2 flex flex-col gap-1">
      <div className="text-[6px] uppercase tracking-widest text-petal text-center">Watch Party</div>
      <div className="relative flex-1 rounded-lg overflow-hidden bg-gradient-to-br from-[#2a0f1e] to-[#0b0511] border border-white/10">
        {/* scan sweep */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-b from-transparent via-petal/25 to-transparent"
          animate={{ y: ["-100%", "100%"] }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        />
        <div className="absolute inset-0 flex items-center justify-center text-2xl">🎬</div>
        {/* two viewers */}
        <div className="absolute bottom-1 left-1 right-1 flex justify-between text-[6px] text-candle-muted">
          <span className="flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-petal animate-pulse" /> you
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" /> them
          </span>
        </div>
      </div>
      {/* progress bar sync */}
      <div className="relative h-1 rounded-full bg-white/10 overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 bg-petal"
          animate={{ width: ["10%", "85%", "10%"] }}
          transition={{ duration: 6, repeat: Infinity }}
        />
      </div>
      <div className="flex justify-center gap-2 text-candle text-[10px]">
        <span>⏮</span>
        <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1.4, repeat: Infinity }}>▶</motion.span>
        <span>⏭</span>
      </div>
    </div>
  );
}

function GamesScene() {
  const cells = Array.from({ length: 16 });
  return (
    <div className="relative h-full px-2 py-2 flex flex-col gap-1">
      <div className="text-[6px] uppercase tracking-widest text-petal text-center">Chess · Uno · Ludo</div>
      <div className="relative mx-auto grid grid-cols-4 rounded overflow-hidden border border-white/15">
        {cells.map((_, i) => {
          const dark = (Math.floor(i / 4) + i) % 2 === 0;
          return <div key={i} className={`w-6 h-6 ${dark ? "bg-[#3a1f2c]" : "bg-[#f5e2d0]"}`} />;
        })}
        {/* moving piece */}
        <motion.div
          className="absolute w-5 h-5 rounded-full bg-gradient-to-br from-petal to-[#c46b83] shadow-lg flex items-center justify-center text-[8px]"
          animate={{
            x: [2, 26, 50, 74, 50, 26, 2],
            y: [2, 26, 2, 50, 74, 50, 2],
          }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        >
          ♛
        </motion.div>
        {/* blood spot */}
        <motion.div
          className="absolute w-2 h-2 rounded-full bg-red-500/70"
          style={{ left: 30, top: 30 }}
          animate={{ opacity: [0, 1, 0], scale: [0.5, 1.4, 1] }}
          transition={{ duration: 3, repeat: Infinity, delay: 1.5 }}
        />
      </div>
      {/* uno card fan */}
      <div className="relative h-10 mt-1">
        {["🂡", "🂱", "🃁", "🃑"].map((c, i) => (
          <motion.div
            key={i}
            className="absolute left-1/2 top-1 w-5 h-8 rounded bg-gradient-to-br from-petal to-[#c46b83] text-velvet text-[7px] flex items-center justify-center border border-white/30 shadow"
            style={{ marginLeft: -10 }}
            initial={{ y: 20, opacity: 0, rotate: 0 }}
            animate={{ y: 0, opacity: 1, rotate: (i - 1.5) * 12, x: (i - 1.5) * 10 }}
            transition={{ delay: 0.3 + i * 0.15, duration: 0.6 }}
          >
            {i + 3}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function GroupsScene() {
  const members = ["🐼", "🌸", "🎭", "✨", "🌙"];
  return (
    <div className="relative h-full px-2 py-2 flex flex-col gap-1">
      <div className="text-[6px] uppercase tracking-widest text-petal text-center">Group Room · Poll</div>
      <div className="relative h-20 flex items-center justify-center">
        {members.map((m, i) => {
          const angle = (i / members.length) * Math.PI * 2;
          return (
            <motion.div
              key={i}
              className="absolute w-6 h-6 rounded-full bg-white/10 border border-petal/40 flex items-center justify-center text-[10px]"
              animate={{
                x: Math.cos(angle) * 35,
                y: Math.sin(angle) * 28,
              }}
              initial={{ scale: 0 }}
              transition={{ delay: i * 0.15, type: "spring" }}
              style={{ scale: 1 }}
            >
              {m}
            </motion.div>
          );
        })}
      </div>
      {/* poll */}
      <div className="space-y-1 mt-1">
        {[{ l: "Pizza", w: 70 }, { l: "Sushi", w: 30 }].map((o) => (
          <div key={o.l} className="relative h-4 rounded bg-white/5 border border-white/10 overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0 bg-petal/50"
              initial={{ width: 0 }}
              animate={{ width: `${o.w}%` }}
              transition={{ duration: 1.2, delay: 0.5 }}
            />
            <div className="absolute inset-0 flex items-center justify-between px-1.5 text-[7px] text-candle">
              <span>{o.l}</span>
              <span>{o.w}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MilestonesScene() {
  return (
    <div className="relative h-full px-2 py-2 flex flex-col items-center justify-center gap-2">
      <div className="text-[6px] uppercase tracking-widest text-petal">365 days</div>
      <motion.div
        className="text-3xl"
        animate={{ scale: [1, 1.25, 1], rotate: [0, 10, -10, 0] }}
        transition={{ duration: 2.5, repeat: Infinity }}
      >
        💝
      </motion.div>
      <div className="font-serif italic text-candle text-[10px] text-center leading-tight px-2">
        Our story, one year in
      </div>
      {/* confetti */}
      {Array.from({ length: 12 }).map((_, i) => (
        <motion.span
          key={i}
          className="absolute text-[10px]"
          initial={{ y: -20, x: (i - 6) * 12, opacity: 0 }}
          animate={{ y: 140, opacity: [0, 1, 0], rotate: 360 }}
          transition={{ duration: 3, delay: i * 0.15, repeat: Infinity }}
        >
          {i % 3 === 0 ? "🌸" : i % 3 === 1 ? "✨" : "🎉"}
        </motion.span>
      ))}
    </div>
  );
}

/** Optional demo hook for parents that just want to cycle scenes. */
export function usePandaSceneAutoCycle(count: number, ms = 4000) {
  const [scene, setScene] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setScene((s) => (s + 1) % count), ms);
    return () => clearInterval(t);
  }, [count, ms]);
  return scene;
}
