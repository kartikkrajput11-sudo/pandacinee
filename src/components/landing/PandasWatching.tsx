import { motion } from "framer-motion";

/**
 * Animated hero scene — two pandas curled up on a couch watching a film.
 * Pure SVG + framer-motion: screen flicker, breathing, blinking, popcorn,
 * a slow shared head-lean and drifting dust motes in the projector beam.
 */
export function PandasWatching({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 500"
      className={className}
      role="img"
      aria-label="Two pandas curled up on a couch watching a movie together"
    >
      <defs>
        <linearGradient id="pwRoom" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a1220" />
          <stop offset="55%" stopColor="#140e19" />
          <stop offset="100%" stopColor="#0c0811" />
        </linearGradient>
        <linearGradient id="pwScreen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f6dfe6" />
          <stop offset="50%" stopColor="#e7b7c6" />
          <stop offset="100%" stopColor="#c98fa4" />
        </linearGradient>
        <linearGradient id="pwBeam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(247,214,224,.42)" />
          <stop offset="100%" stopColor="rgba(247,214,224,0)" />
        </linearGradient>
        <linearGradient id="pwCouch" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4a2331" />
          <stop offset="100%" stopColor="#2c141d" />
        </linearGradient>
        <radialGradient id="pwFurW" cx="36%" cy="26%" r="80%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="60%" stopColor="#f2e9e1" />
          <stop offset="100%" stopColor="#cdbfb5" />
        </radialGradient>
        <radialGradient id="pwFurB" cx="34%" cy="26%" r="82%">
          <stop offset="0%" stopColor="#4c4458" />
          <stop offset="55%" stopColor="#241f2e" />
          <stop offset="100%" stopColor="#0d0b12" />
        </radialGradient>
        <radialGradient id="pwGlow" cx="50%" cy="50%">
          <stop offset="0%" stopColor="rgba(240,190,205,.5)" />
          <stop offset="100%" stopColor="rgba(240,190,205,0)" />
        </radialGradient>
        <filter id="pwSoft" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <filter id="pwFur" x="-15%" y="-15%" width="130%" height="130%">
          <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="3" seed="4" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2.4" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>

      <rect width="400" height="500" fill="url(#pwRoom)" />

      {/* ---- screen ---- */}
      <motion.g
        animate={{ opacity: [0.92, 1, 0.88, 0.98, 0.93] }}
        transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
      >
        <rect x="52" y="46" width="296" height="168" rx="10" fill="url(#pwScreen)" />
        {/* shifting film frames */}
        <motion.g
          animate={{ x: [0, -14, 8, -6, 0], opacity: [0.35, 0.5, 0.3, 0.45, 0.35] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        >
          <rect x="80" y="80" width="110" height="70" rx="6" fill="#8d5568" opacity=".5" />
          <rect x="212" y="96" width="96" height="52" rx="6" fill="#6f3d52" opacity=".45" />
          <circle cx="150" cy="180" r="16" fill="#a86b80" opacity=".4" />
        </motion.g>
        <rect x="52" y="46" width="296" height="168" rx="10" fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="2" />
      </motion.g>

      {/* projector beam + dust motes */}
      <motion.path
        d="M 62 214 L 338 214 L 372 430 L 28 430 Z"
        fill="url(#pwBeam)"
        animate={{ opacity: [0.55, 0.8, 0.5, 0.7, 0.55] }}
        transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
      />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <motion.circle
          key={i}
          cx={80 + i * 32}
          cy={260 + (i % 3) * 40}
          r={1.4 + (i % 3) * 0.6}
          fill="#ffe9f0"
          opacity=".35"
          animate={{ y: [0, -22, 0], opacity: [0.1, 0.4, 0.1] }}
          transition={{ duration: 6 + i, repeat: Infinity, ease: "easeInOut", delay: i * 0.6 }}
        />
      ))}

      {/* ---- couch back ---- */}
      <rect x="30" y="330" width="340" height="120" rx="30" fill="url(#pwCouch)" />
      <rect x="46" y="346" width="308" height="60" rx="22" fill="rgba(255,255,255,.05)" />

      {/* ---- pandas ---- */}
      {[
        { x: 132, dir: 1, delay: 0 },
        { x: 262, dir: -1, delay: 0.9 },
      ].map((p) => (
        <motion.g
          key={p.x}
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut", delay: p.delay }}
        >
          {/* body */}
          <ellipse cx={p.x} cy={392} rx="52" ry="46" fill="url(#pwFurW)" filter="url(#pwFur)" />
          {/* arms */}
          <ellipse cx={p.x - 44} cy={392} rx="15" ry="26" fill="url(#pwFurB)" filter="url(#pwFur)" />
          <ellipse cx={p.x + 44} cy={392} rx="15" ry="26" fill="url(#pwFurB)" filter="url(#pwFur)" />
          {/* shoulder band */}
          <path
            d={`M ${p.x - 46} 372 q 20 -22 46 -22 q 26 0 46 22 q 4 16 -4 27 q -16 -19 -42 -19 q -26 0 -42 19 q -8 -11 -4 -27 z`}
            fill="url(#pwFurB)"
            opacity=".95"
            filter="url(#pwFur)"
          />

          {/* head — slow lean toward the partner */}
          <motion.g
            style={{ transformOrigin: `${p.x}px 360px` }}
            animate={{ rotate: [0, p.dir * 7, 0, 0] }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: p.delay + 2 }}
          >
            {/* ears */}
            <circle cx={p.x - 34} cy={306} r="15" fill="url(#pwFurB)" filter="url(#pwFur)" />
            <circle cx={p.x + 34} cy={306} r="15" fill="url(#pwFurB)" filter="url(#pwFur)" />
            {/* skull */}
            <ellipse cx={p.x} cy={330} rx="46" ry="40" fill="url(#pwFurW)" filter="url(#pwFur)" />
            {/* eye patches */}
            <ellipse cx={p.x - 17} cy={328} rx="14" ry="17" fill="url(#pwFurB)" transform={`rotate(-16 ${p.x - 17} 328)`} filter="url(#pwFur)" />
            <ellipse cx={p.x + 17} cy={328} rx="14" ry="17" fill="url(#pwFurB)" transform={`rotate(16 ${p.x + 17} 328)`} filter="url(#pwFur)" />
            {/* eyes fixed on the screen, with blinks */}
            {[-1, 1].map((s) => (
              <motion.ellipse
                key={s}
                cx={p.x + s * 16}
                cy={328}
                rx="6"
                ry="6.5"
                fill="#fffaf6"
                animate={{ ry: [6.5, 6.5, 0.6, 6.5] }}
                transition={{ duration: 5.4, repeat: Infinity, times: [0, 0.9, 0.94, 1], delay: p.delay }}
              />
            ))}
            <circle cx={p.x - 15} cy={327} r="3.2" fill="#151019" />
            <circle cx={p.x + 19} cy={327} r="3.2" fill="#151019" />
            {/* screen reflection in the eyes */}
            <motion.g
              animate={{ opacity: [0.5, 0.9, 0.4, 0.8, 0.5] }}
              transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
            >
              <circle cx={p.x - 16.4} cy={325.6} r="1.3" fill="#ffe6ee" />
              <circle cx={p.x + 17.6} cy={325.6} r="1.3" fill="#ffe6ee" />
            </motion.g>
            {/* muzzle */}
            <ellipse cx={p.x} cy={348} rx="18" ry="13" fill="#fffdfa" opacity=".7" />
            <path d={`M ${p.x - 6} 344 q 6 -5 12 0 q -3 6 -6 6 q -3 0 -6 -6`} fill="#1b1721" />
            <motion.path
              d={`M ${p.x - 8} 356 q 8 6 16 0`}
              stroke="#1b1721"
              strokeWidth="2.2"
              fill="none"
              strokeLinecap="round"
              animate={{ d: [`M ${p.x - 8} 356 q 8 6 16 0`, `M ${p.x - 9} 355 q 9 10 18 0`, `M ${p.x - 8} 356 q 8 6 16 0`] }}
              transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: p.delay + 1.4 }}
            />
            {/* blush from the screen light */}
            <ellipse cx={p.x - 30} cy={344} rx="9" ry="5.5" fill="var(--petal)" opacity=".35" filter="url(#pwSoft)" />
            <ellipse cx={p.x + 30} cy={344} rx="9" ry="5.5" fill="var(--petal)" opacity=".35" filter="url(#pwSoft)" />
          </motion.g>
        </motion.g>
      ))}

      {/* shared blanket over both laps */}
      <path
        d="M 66 424 q 134 -26 268 0 q 8 34 -6 46 q -128 -20 -256 0 q -14 -12 -6 -46 z"
        fill="#7d3247"
        opacity=".92"
      />
      <path d="M 78 436 q 122 -20 244 0" stroke="rgba(255,255,255,.14)" strokeWidth="4" fill="none" strokeLinecap="round" />

      {/* popcorn bucket between them */}
      <g>
        <path d="M 186 404 l 6 44 h 24 l 6 -44 z" fill="#f3e5ea" />
        <path d="M 186 404 l 6 44 h 8 l -4 -44 z" fill="#d8919f" opacity=".5" />
        {[
          { x: 190, y: 400, d: 0 },
          { x: 200, y: 396, d: 0.4 },
          { x: 210, y: 400, d: 0.8 },
          { x: 218, y: 398, d: 1.2 },
        ].map((k) => (
          <motion.circle
            key={k.x}
            cx={k.x}
            cy={k.y}
            r="4"
            fill="#fff3d8"
            animate={{ y: [0, -7, 0] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut", delay: k.d }}
          />
        ))}
      </g>

      {/* floating hearts between the two */}
      {[0, 1, 2].map((i) => (
        <motion.path
          key={i}
          d="M 200 300 c -4 -6 -13 -3 -13 5 c 0 7 9 12 13 16 c 4 -4 13 -9 13 -16 c 0 -8 -9 -11 -13 -5 z"
          fill="var(--petal)"
          opacity="0"
          transform={`translate(${i * 26 - 26} 0) scale(1)`}
          animate={{ y: [0, -60], opacity: [0, 0.75, 0], scale: [0.6, 1, 0.8] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeOut", delay: i * 1.8 + 1 }}
        />
      ))}

      {/* warm room bloom */}
      <ellipse cx="200" cy="250" rx="210" ry="170" fill="url(#pwGlow)" opacity=".5" pointerEvents="none" />
    </svg>
  );
}
