import React from "react";

// Animated SVG scenes — one per chapter — that literally depict the story.

const GOLD = "#e6c98a";
const GOLD_DEEP = "#b98a3d";
const ROSE = "#e79aad";
const SKIN = "#f0d4b0";
const SKIN2 = "#e8c199";
const HAIR_F = "#4a2c3a";
const HAIR_M = "#2a1c1a";
const NIGHT = "#0d0714";
const DEEP = "#1a1020";

const CSS = `
@keyframes ss-float   { 0%,100%{ transform: translateY(0);} 50%{ transform: translateY(-5px);} }
@keyframes ss-pulse   { 0%,100%{ transform: scale(1); opacity:.9;} 50%{ transform: scale(1.1); opacity:1;} }
@keyframes ss-shake   { 0%,100%{ transform: translateX(0);} 25%{ transform: translateX(-1.5px);} 75%{ transform: translateX(1.5px);} }
@keyframes ss-fall    { 0%{ transform: translateY(-40px); opacity:0;} 15%{ opacity:1;} 100%{ transform: translateY(80px); opacity:0;} }
@keyframes ss-peek    { 0%,100%{ transform: translateX(-2px);} 50%{ transform: translateX(2px);} }
@keyframes ss-flicker { 0%,100%{ opacity:.95; transform: scaleY(1);} 45%{ opacity:.7; transform: scaleY(0.9);} 70%{ opacity:1; transform: scaleY(1.08);} }
@keyframes ss-tear    { 0%{ transform: translateY(0); opacity:0;} 15%{ opacity:1;} 100%{ transform: translateY(18px); opacity:0;} }
@keyframes ss-typing  { 0%,100%{ opacity:.3;} 50%{ opacity:1;} }
@keyframes ss-swirl   { from{ transform: rotate(0);} to{ transform: rotate(360deg);} }
@keyframes ss-hb      { 0%,100%{ transform: scale(1);} 20%{ transform: scale(1.18);} 40%{ transform: scale(1);} 60%{ transform: scale(1.1);} }
@keyframes ss-thread  { 0%{ stroke-dashoffset: 300;} 100%{ stroke-dashoffset: 0;} }
@keyframes ss-sparkle { 0%,100%{ opacity:0; transform: scale(0.6);} 50%{ opacity:1; transform: scale(1);} }
@keyframes ss-fadeIn  { from{ opacity:0;} to{ opacity:1;} }
@keyframes ss-glow    { 0%,100%{ filter: drop-shadow(0 0 6px ${GOLD}88);} 50%{ filter: drop-shadow(0 0 18px ${GOLD}); } }
@keyframes ss-tap     { 0%,100%{ transform: translate(0,0);} 40%{ transform: translate(-2px,2px);} }
@keyframes ss-rise    { 0%{ transform: translateY(10px); opacity:0;} 40%{ opacity:1;} 100%{ transform: translateY(-18px); opacity:0;} }
@keyframes ss-drop-away { 0%{ opacity:1; transform: translateY(0) scale(1);} 100%{ opacity:0; transform: translateY(30px) scale(0.6);} }
.ss-float{animation:ss-float 3.4s ease-in-out infinite;}
.ss-pulse{animation:ss-pulse 2.4s ease-in-out infinite;transform-origin:center;transform-box:fill-box;}
.ss-shake{animation:ss-shake 1.2s ease-in-out infinite;}
.ss-flicker{animation:ss-flicker 1.6s ease-in-out infinite;transform-origin:bottom center;transform-box:fill-box;}
.ss-typing{animation:ss-typing 1.1s ease-in-out infinite;}
.ss-hb{animation:ss-hb 1.6s ease-in-out infinite;transform-origin:center;transform-box:fill-box;}
.ss-glow{animation:ss-glow 3s ease-in-out infinite;}
.ss-peek{animation:ss-peek 2.6s ease-in-out infinite;}
`;

function SceneFrame({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 240 240" className="block w-[220px] h-[220px] sm:w-[260px] sm:h-[260px]">
      <defs>
        <radialGradient id="ss-bg" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="#2a1a2f" />
          <stop offset="100%" stopColor="#0d0714" />
        </radialGradient>
        <linearGradient id="ss-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f7e2ad" />
          <stop offset="50%" stopColor={GOLD} />
          <stop offset="100%" stopColor={GOLD_DEEP} />
        </linearGradient>
        <linearGradient id="ss-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3a2b52" />
          <stop offset="100%" stopColor="#0d0714" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="240" height="240" rx="24" fill="url(#ss-bg)" />
      <rect x="1" y="1" width="238" height="238" rx="23" fill="none" stroke={GOLD} strokeOpacity="0.35" />
      {children}
    </svg>
  );
}

/** Detailed character: head w/ hair, body, arms. `look` = "f" (female, long hair) or "m" (male, short) */
function Char({
  x, y, s = 1, look = "f", skin = SKIN, shirt = "#c76a83",
  hairColor, className = "", flip = false, sad = false,
}: {
  x: number; y: number; s?: number; look?: "f" | "m"; skin?: string; shirt?: string;
  hairColor?: string; className?: string; flip?: boolean; sad?: boolean;
}) {
  const hair = hairColor ?? (look === "f" ? HAIR_F : HAIR_M);
  const sx = flip ? -1 : 1;
  return (
    <g transform={`translate(${x} ${y}) scale(${s * sx} ${s})`} className={className}>
      {/* body/shirt */}
      <path d="M -12 6 Q 0 2 12 6 L 14 26 Q 0 30 -14 26 Z" fill={shirt} />
      {/* neck */}
      <rect x="-3" y="-2" width="6" height="6" fill={skin} />
      {/* head */}
      <ellipse cx="0" cy="-10" rx="8.5" ry="9.5" fill={skin} />
      {/* hair */}
      {look === "f" ? (
        <>
          <path d="M -9 -14 Q -10 -22 0 -22 Q 10 -22 9 -14 Q 10 -6 6 -10 Q 0 -14 -6 -10 Q -10 -6 -9 -14 Z" fill={hair} />
          <path d="M -9 -12 Q -14 -4 -10 12 L -6 12 Q -8 0 -7 -10 Z" fill={hair} />
          <path d="M 9 -12 Q 14 -4 10 12 L 6 12 Q 8 0 7 -10 Z" fill={hair} />
        </>
      ) : (
        <path d="M -8 -14 Q -8 -20 0 -20 Q 8 -20 8 -14 Q 8 -10 6 -10 Q 0 -14 -6 -10 Q -8 -10 -8 -14 Z" fill={hair} />
      )}
      {/* eyes */}
      <circle cx="-3" cy="-10" r="1.1" fill="#1a0f14" />
      <circle cx="3" cy="-10" r="1.1" fill="#1a0f14" />
      {/* mouth */}
      {sad ? (
        <path d="M -2.5 -5 Q 0 -6.5 2.5 -5" stroke="#7a2a3a" strokeWidth="0.9" fill="none" strokeLinecap="round" />
      ) : (
        <path d="M -2.5 -6 Q 0 -4.5 2.5 -6" stroke="#7a2a3a" strokeWidth="0.9" fill="none" strokeLinecap="round" />
      )}
    </g>
  );
}

const Heart = ({ x, y, s = 1, color = ROSE, className = "", broken = false }: any) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} className={className}>
    <path
      d="M0 8 C -6 0 -12 -4 -12 -10 A 6 6 0 0 1 0 -12 A 6 6 0 0 1 12 -10 C 12 -4 6 0 0 8 Z"
      fill={color}
    />
    {broken && (
      <path d="M 0 -12 L -2 -6 L 2 -2 L -1 4 L 0 8" stroke="#1a0714" strokeWidth="1.4" fill="none" strokeLinejoin="miter" />
    )}
  </g>
);

/* ─────── 13 scenes ─────── */

// I — she keeps giving; he lets her hearts drop away
function Scene1() {
  return (
    <SceneFrame>
      <Char x={80} y={155} s={1.5} look="f" shirt={ROSE} />
      <Char x={165} y={158} s={1.5} look="m" shirt="#3a2b4a" sad={false} />
      {/* her hand offering heart */}
      <Heart x={110} y={125} s={0.9} className="ss-hb" />
      {/* falling hearts he lets go */}
      {[0,1,2].map(i => (
        <g key={i} style={{ animation:`ss-fall 3.4s ${i*1.1}s ease-in infinite`, transformOrigin:"center", transformBox:"fill-box" }}>
          <Heart x={148} y={130} s={0.55} color="#8a3a4d" />
        </g>
      ))}
      <text x="120" y="222" textAnchor="middle" fontSize="9" fill={GOLD} opacity="0.6" fontFamily="Georgia" fontStyle="italic">she kept giving, he kept dropping</text>
    </SceneFrame>
  );
}

// II — classroom door, she peeks and sees them
function Scene2() {
  return (
    <SceneFrame>
      {/* classroom back wall */}
      <rect x="30" y="45" width="180" height="150" fill="#1a1225" />
      {/* chalkboard */}
      <rect x="105" y="60" width="90" height="42" fill="#0f2418" stroke={GOLD_DEEP} strokeOpacity="0.5" />
      <text x="150" y="86" textAnchor="middle" fontSize="10" fill="#e8dcb0" fontFamily="Georgia" opacity="0.6">MATH · IV</text>
      {/* window */}
      <rect x="42" y="60" width="52" height="42" fill="#2a2140" stroke={GOLD_DEEP} strokeOpacity="0.4" />
      <line x1="68" y1="60" x2="68" y2="102" stroke={GOLD_DEEP} strokeOpacity="0.35" />
      <line x1="42" y1="81" x2="94" y2="81" stroke={GOLD_DEEP} strokeOpacity="0.35" />
      {/* desk with two figures sitting side by side */}
      <rect x="118" y="150" width="70" height="6" fill={GOLD_DEEP} />
      <rect x="120" y="156" width="4" height="26" fill={GOLD_DEEP} />
      <rect x="182" y="156" width="4" height="26" fill={GOLD_DEEP} />
      <g transform="translate(140 138)">
        <Char x={0} y={0} s={0.85} look="m" shirt="#3a2b4a" />
      </g>
      <g transform="translate(168 138)">
        <Char x={0} y={0} s={0.85} look="f" shirt="#c76a83" hairColor="#3a2530" />
      </g>
      {/* small heart between them */}
      <Heart x={154} y={130} s={0.5} color="#c76a83" className="ss-pulse" />
      {/* door frame on the left cutting into scene */}
      <rect x="0" y="30" width="52" height="200" fill={NIGHT} />
      <rect x="46" y="30" width="6" height="200" fill={GOLD_DEEP} opacity="0.7" />
      {/* peeking girl at door edge — just half face, hair */}
      <g className="ss-peek" transform="translate(46 130)">
        {/* hair strand */}
        <path d="M 0 -22 Q -6 -10 -2 20 L 6 20 Q 4 4 4 -14 Z" fill={HAIR_F} />
        {/* half face */}
        <path d="M 0 -14 Q 8 -12 8 -2 Q 8 4 0 6 Z" fill={SKIN} />
        {/* eye */}
        <circle cx="4" cy="-4" r="1.3" fill="#1a0714" />
        <circle cx="4" cy="-4" r="0.5" fill="#fff" />
        {/* tear rolling */}
        <g style={{ animation:"ss-tear 2.4s ease-in infinite", transformOrigin:"center", transformBox:"fill-box" }}>
          <ellipse cx="4" cy="0" rx="1" ry="1.5" fill="#9ac9ff" />
        </g>
      </g>
      <text x="120" y="222" textAnchor="middle" fontSize="9" fill={GOLD} opacity="0.6" fontFamily="Georgia" fontStyle="italic">she saw it with her own eyes</text>
    </SceneFrame>
  );
}

// III — she cries at the window, rain outside
function Scene3() {
  return (
    <SceneFrame>
      {/* night sky through window */}
      <rect x="0" y="0" width="240" height="240" fill="url(#ss-sky)" />
      {/* rain streaks */}
      {[...Array(18)].map((_,i)=>(
        <line key={i}
          x1={10 + i*13} y1="0"
          x2={0 + i*13} y2="40"
          stroke="#8fb6ff" strokeOpacity="0.4" strokeWidth="0.9"
          style={{ animation:`ss-fall 1.3s ${(i%6)*0.2}s linear infinite` }}
        />
      ))}
      {/* window frame */}
      <rect x="42" y="40" width="156" height="110" fill="none" stroke={GOLD_DEEP} strokeOpacity="0.55" strokeWidth="2" />
      <line x1="120" y1="40" x2="120" y2="150" stroke={GOLD_DEEP} strokeOpacity="0.4" />
      <line x1="42" y1="95" x2="198" y2="95" stroke={GOLD_DEEP} strokeOpacity="0.4" />
      {/* water drops on inside glass */}
      {[[70,110],[100,130],[150,120],[175,140]].map(([x,y],i)=>(
        <circle key={i} cx={x} cy={y} r="1.5" fill="#9ac9ff" opacity="0.6" />
      ))}
      {/* girl sitting on floor by window, knees up */}
      <g transform="translate(120 195)">
        {/* body / knees */}
        <path d="M -22 0 Q -14 -30 -6 -32 L 6 -32 Q 14 -30 22 0 Z" fill="#4a2b3a" />
        {/* head resting on knees */}
        <ellipse cx="0" cy="-34" rx="9" ry="10" fill={SKIN} />
        <path d="M -9 -36 Q -12 -46 0 -46 Q 12 -46 9 -36 Q 12 -18 -12 -18 Z" fill={HAIR_F} />
        <circle cx="-3" cy="-33" r="0.9" fill="#1a0714" />
        <circle cx="3" cy="-33" r="0.9" fill="#1a0714" />
        <path d="M -2 -28 Q 0 -29 2 -28" stroke="#7a2a3a" strokeWidth="0.8" fill="none" />
        {/* tear */}
        <g style={{ animation:"ss-tear 1.8s ease-in infinite", transformOrigin:"center", transformBox:"fill-box" }}>
          <ellipse cx="-3" cy="-30" rx="1" ry="1.5" fill="#9ac9ff" />
        </g>
      </g>
    </SceneFrame>
  );
}

// IV — phone chat, incoming from other boy, delete swipe
function Scene4() {
  return (
    <SceneFrame>
      {/* phone shell */}
      <rect x="72" y="24" width="96" height="180" rx="14" fill="#160c1e" stroke={GOLD} strokeOpacity="0.55" />
      <rect x="80" y="38" width="80" height="146" rx="4" fill="#0a0612" />
      {/* status header */}
      <rect x="80" y="38" width="80" height="14" fill="#20142a" />
      <text x="120" y="48" textAnchor="middle" fontSize="7" fill="#e8dcb0" fontFamily="Georgia">Alex ♥</text>
      {/* chat bubbles */}
      <g>
        <rect x="86" y="58" width="46" height="14" rx="7" fill="#4a2b3a" style={{ animation:"ss-fadeIn 0.7s 0s both" }} />
        <text x="109" y="68" textAnchor="middle" fontSize="6" fill="#ffe0ea" fontFamily="Georgia">you up? 😉</text>

        <rect x="108" y="76" width="46" height="14" rx="7" fill="#3a2b52" style={{ animation:"ss-fadeIn 0.7s 0.3s both" }} />
        <text x="131" y="86" textAnchor="middle" fontSize="6" fill="#e2d8ff" fontFamily="Georgia">miss u ✨</text>

        <rect x="86" y="94" width="52" height="14" rx="7" fill="#4a2b3a" style={{ animation:"ss-fadeIn 0.7s 0.7s both" }} />
        <text x="112" y="104" textAnchor="middle" fontSize="6" fill="#ffe0ea" fontFamily="Georgia">delete this ok</text>
      </g>
      {/* finger tapping delete */}
      <g style={{ animation:"ss-tap 1.4s ease-in-out infinite" }}>
        <ellipse cx="152" cy="108" rx="10" ry="12" fill={SKIN} stroke={GOLD_DEEP} strokeOpacity="0.3" />
        <path d="M 148 110 L 156 110 L 156 96 L 152 92 L 148 96 Z" fill={SKIN2} />
      </g>
      {/* sweep erasing bottom */}
      <rect x="80" y="120" width="80" height="64" fill="#0a0612">
        <animate attributeName="height" values="0;64;0" dur="3.2s" repeatCount="indefinite"/>
        <animate attributeName="y" values="184;120;184" dur="3.2s" repeatCount="indefinite"/>
      </rect>
      {/* home indicator */}
      <rect x="108" y="196" width="24" height="3" rx="1.5" fill={GOLD_DEEP} opacity="0.5" />
      <text x="120" y="222" textAnchor="middle" fontSize="8" fill={GOLD} opacity="0.6" fontFamily="Georgia" fontStyle="italic">chats erased before he looks</text>
    </SceneFrame>
  );
}

// V — best friend + girl behind boy, dagger
function Scene5() {
  return (
    <SceneFrame>
      {/* him in front, shocked */}
      <Char x={120} y={185} s={1.7} look="m" shirt="#3a2b4a" sad />
      {/* speech tear from him */}
      <g style={{ animation:"ss-tear 2s ease-in infinite", transformOrigin:"center", transformBox:"fill-box" }}>
        <ellipse cx="116" cy="168" rx="1" ry="1.5" fill="#9ac9ff" />
      </g>
      {/* behind him: her + best friend kissing behind a heart broken */}
      <g opacity="0.95">
        <Char x={78} y={100} s={1.05} look="f" shirt="#c76a83" hairColor="#3a2530" />
        <Char x={160} y={100} s={1.05} look="m" shirt="#5a4a2a" hairColor="#3a2820" />
      </g>
      <Heart x={120} y={95} s={1.1} color="#8a3a4d" broken className="ss-hb" />
      {/* dagger of betrayal */}
      <g transform="translate(120 130) rotate(30)" className="ss-glow">
        <rect x="-1.5" y="-38" width="3" height="52" fill="url(#ss-gold)" />
        <rect x="-9" y="14" width="18" height="4" fill={GOLD_DEEP} />
        <path d="M 0 -46 L -3 -38 L 3 -38 Z" fill={GOLD} />
      </g>
      <text x="60" y="120" fontSize="8" fill={GOLD} opacity="0.7" fontFamily="Georgia" fontStyle="italic">her</text>
      <text x="180" y="120" fontSize="8" fill={GOLD} opacity="0.7" fontFamily="Georgia" fontStyle="italic">his best friend</text>
    </SceneFrame>
  );
}

// VI — boy alone with candle, family words swirling
function Scene6() {
  return (
    <SceneFrame>
      {/* bed edge */}
      <rect x="20" y="180" width="200" height="8" fill={GOLD_DEEP} opacity="0.6" />
      <rect x="20" y="188" width="200" height="24" fill="#2a1a2f" />
      {/* him kneeling / sitting */}
      <g transform="translate(120 178)">
        <path d="M -18 0 Q -10 -34 0 -36 Q 10 -34 18 0 Z" fill="#3a2b4a" />
        <ellipse cx="0" cy="-38" rx="9" ry="10" fill={SKIN2} />
        <path d="M -8 -42 Q -8 -48 0 -48 Q 8 -48 8 -42 Q 8 -38 4 -38 Q 0 -42 -4 -38 Q -8 -38 -8 -42 Z" fill={HAIR_M} />
        <circle cx="-3" cy="-38" r="0.9" fill="#1a0714" />
        <circle cx="3" cy="-38" r="0.9" fill="#1a0714" />
        <path d="M -2 -33 Q 0 -34 2 -33" stroke="#7a2a3a" strokeWidth="0.8" fill="none" />
      </g>
      {/* candle beside */}
      <g transform="translate(180 158)">
        <rect x="-4" y="0" width="8" height="22" fill="#f2d59a" />
        <ellipse cx="0" cy="-4" rx="4" ry="10" fill="#ffb347" className="ss-flicker" />
        <ellipse cx="0" cy="-4" rx="2" ry="6" fill="#fff2c8" className="ss-flicker" />
      </g>
      {/* swirling family words */}
      <g style={{ animation:"ss-swirl 14s linear infinite", transformOrigin:"120px 100px", transformBox:"view-box" }}>
        {["you chose her","we warned you","look now","she used you"].map((t,i)=>{
          const a = i * (Math.PI * 2 / 4);
          return (
            <text key={i}
              x={120 + Math.cos(a)*72}
              y={100 + Math.sin(a)*54}
              fontSize="9" fill={GOLD} opacity="0.6"
              fontFamily="Georgia" fontStyle="italic" textAnchor="middle">
              {t}
            </text>
          );
        })}
      </g>
    </SceneFrame>
  );
}

// VII — mutual friend introduces; thread between phones
function Scene7() {
  return (
    <SceneFrame>
      {/* her phone */}
      <g transform="translate(50 155)">
        <rect x="-14" y="-24" width="28" height="48" rx="4" fill="#160c1e" stroke={GOLD} strokeOpacity="0.5" />
        <rect x="-11" y="-20" width="22" height="38" rx="2" fill="#3a2b4a" />
      </g>
      <Char x={50} y={108} s={0.9} look="f" shirt="#c76a83" />
      {/* his phone */}
      <g transform="translate(190 155)">
        <rect x="-14" y="-24" width="28" height="48" rx="4" fill="#160c1e" stroke={GOLD} strokeOpacity="0.5" />
        <rect x="-11" y="-20" width="22" height="38" rx="2" fill="#2a3b5a" />
      </g>
      <Char x={190} y={108} s={0.9} look="m" shirt="#3a2b4a" />
      {/* friend in middle behind */}
      <Char x={120} y={70} s={0.85} look="f" shirt="#8a6ab0" hairColor="#2a1a3a" />
      <text x="120" y="50" textAnchor="middle" fontSize="8" fill={GOLD} opacity="0.75" fontFamily="Georgia" fontStyle="italic">the mutual friend</text>
      {/* gold thread */}
      <path d="M 55 150 Q 120 70 185 150"
        fill="none" stroke="url(#ss-gold)" strokeWidth="1.6"
        strokeDasharray="300"
        style={{ animation:"ss-thread 3.4s ease-out infinite" }} />
      <circle cx="55" cy="150" r="3.5" fill={GOLD} />
      <circle cx="185" cy="150" r="3.5" fill={GOLD} />
    </SceneFrame>
  );
}

// VIII — 3am chats, moon, clock
function Scene8() {
  return (
    <SceneFrame>
      {/* moon */}
      <circle cx="180" cy="55" r="26" fill="#f5e5b8" opacity="0.9" className="ss-glow" />
      <circle cx="172" cy="50" r="21" fill="#0d0714" />
      {/* stars */}
      {[[50,42],[95,32],[210,110],[36,110],[130,30]].map(([x,y],i)=>(
        <g key={i} style={{ animation:`ss-sparkle 2.2s ${i*0.4}s ease-in-out infinite`, transformOrigin:`${x}px ${y}px`, transformBox:"view-box" }}>
          <circle cx={x} cy={y} r="1.6" fill={GOLD} />
        </g>
      ))}
      {/* clock 3:00 */}
      <g transform="translate(50 70)">
        <circle cx="0" cy="0" r="16" fill="#160c1e" stroke={GOLD} strokeOpacity="0.6" />
        <line x1="0" y1="0" x2="0" y2="-10" stroke={GOLD} strokeWidth="1.2" />
        <line x1="0" y1="0" x2="9" y2="0" stroke={GOLD} strokeWidth="1.2" />
        <circle cx="0" cy="0" r="1.5" fill={GOLD} />
        <text x="0" y="28" textAnchor="middle" fontSize="7" fill={GOLD} opacity="0.7" fontFamily="Georgia" fontStyle="italic">3:00 AM</text>
      </g>
      {/* bubbles */}
      <g style={{ animation:"ss-fadeIn 0.9s 0.2s both" }}>
        <rect x="30" y="120" width="86" height="26" rx="13" fill="#4a2b3a" />
        <text x="73" y="137" textAnchor="middle" fontSize="9" fill="#ffe0ea" fontFamily="Georgia" fontStyle="italic">still awake?</text>
      </g>
      <g style={{ animation:"ss-fadeIn 0.9s 1.3s both" }}>
        <rect x="126" y="156" width="90" height="26" rx="13" fill="#3a2b4a" />
        <text x="171" y="173" textAnchor="middle" fontSize="9" fill="#e2d8ff" fontFamily="Georgia" fontStyle="italic">always for you</text>
      </g>
      {/* typing dots */}
      <g transform="translate(35 200)">
        <circle cx="0" cy="0" r="2.2" fill={GOLD} className="ss-typing" />
        <circle cx="8" cy="0" r="2.2" fill={GOLD} className="ss-typing" style={{ animationDelay:"0.2s" }}/>
        <circle cx="16" cy="0" r="2.2" fill={GOLD} className="ss-typing" style={{ animationDelay:"0.4s" }}/>
      </g>
    </SceneFrame>
  );
}

// IX — boy praying, light from above
function Scene9() {
  return (
    <SceneFrame>
      {/* rays from top */}
      <g className="ss-glow" style={{ transformOrigin:"120px 30px", transformBox:"view-box" }}>
        {[...Array(9)].map((_,i)=>{
          const a = -Math.PI/2 + (i - 4) * 0.28;
          return (
            <line key={i}
              x1="120" y1="30"
              x2={120 + Math.cos(a)*140}
              y2={30 + Math.sin(a)*140}
              stroke="url(#ss-gold)" strokeOpacity="0.4" strokeWidth="1.2" />
          );
        })}
      </g>
      <circle cx="120" cy="30" r="14" fill="url(#ss-gold)" className="ss-pulse" />
      {/* boy kneeling with hands together */}
      <g transform="translate(120 175)">
        {/* legs / kneel */}
        <path d="M -22 26 Q -8 10 0 6 Q 8 10 22 26 Z" fill="#2a1a2f" />
        {/* body */}
        <path d="M -18 6 Q 0 -14 18 6 L 14 26 Q 0 30 -14 26 Z" fill="#3a2b4a" />
        {/* praying hands */}
        <path d="M -3 -12 Q -8 -30 0 -34 Q 8 -30 3 -12 Z" fill={SKIN2} />
        {/* head */}
        <ellipse cx="0" cy="-40" rx="8" ry="9" fill={SKIN2} />
        <path d="M -7 -44 Q -7 -50 0 -50 Q 7 -50 7 -44 Q 7 -40 4 -40 Q 0 -44 -4 -40 Q -7 -40 -7 -44 Z" fill={HAIR_M} />
        <circle cx="-2" cy="-40" r="0.8" fill="#1a0714" />
        <circle cx="2" cy="-40" r="0.8" fill="#1a0714" />
      </g>
      {/* sparkles rising */}
      {[[80,140],[160,140],[100,100],[140,100]].map(([x,y],i)=>(
        <g key={i} style={{ animation:`ss-rise 3s ${i*0.6}s ease-out infinite`, transformOrigin:`${x}px ${y}px`, transformBox:"view-box" }}>
          <text x={x} y={y} fontSize="11" fill={GOLD}>✦</text>
        </g>
      ))}
    </SceneFrame>
  );
}

// X — crystal ball, tiny future home + couple walking
function Scene10() {
  return (
    <SceneFrame>
      {/* stand */}
      <path d="M 96 188 L 144 188 L 154 208 L 86 208 Z" fill={GOLD_DEEP} />
      <ellipse cx="120" cy="188" rx="32" ry="5" fill={GOLD} opacity="0.6" />
      {/* ball */}
      <defs>
        <clipPath id="ss-ball">
          <circle cx="120" cy="132" r="52" />
        </clipPath>
      </defs>
      <circle cx="120" cy="132" r="55" fill="#1a1030" stroke={GOLD} strokeOpacity="0.6" strokeWidth="1.5" />
      <g clipPath="url(#ss-ball)">
        {/* horizon */}
        <rect x="68" y="132" width="104" height="52" fill="#3a2b4a" />
        {/* house */}
        <g className="ss-float" style={{ transformOrigin:"120px 150px", transformBox:"view-box" }}>
          <rect x="102" y="140" width="36" height="24" fill={GOLD_DEEP} />
          <path d="M 98 140 L 120 122 L 142 140 Z" fill={GOLD} />
          <rect x="115" y="150" width="10" height="14" fill="#1a0f0a" />
          <rect x="106" y="146" width="6" height="6" fill="#f7e2ad" opacity="0.9" />
          <rect x="128" y="146" width="6" height="6" fill="#f7e2ad" opacity="0.9" />
        </g>
        {/* couple */}
        <Char x={108} y={178} s={0.45} look="f" shirt={ROSE} />
        <Char x={132} y={178} s={0.45} look="m" shirt="#3a2b4a" />
      </g>
      {/* highlight */}
      <ellipse cx="102" cy="110" rx="16" ry="7" fill="#fff" opacity="0.2" />
      {[[54,90],[186,110],[58,170]].map(([x,y],i)=>(
        <g key={i} style={{ animation:`ss-sparkle 2.2s ${i*0.6}s ease-in-out infinite`, transformOrigin:`${x}px ${y}px`, transformBox:"view-box" }}>
          <text x={x} y={y} fontSize="10" fill={GOLD}>✦</text>
        </g>
      ))}
    </SceneFrame>
  );
}

// XI — calendar page 18 April 2026 + ring
function Scene11() {
  return (
    <SceneFrame>
      {/* calendar */}
      <g className="ss-float">
        <rect x="34" y="40" width="130" height="152" rx="8" fill="#f7ecd0" stroke={GOLD_DEEP} strokeOpacity="0.5" />
        <rect x="34" y="40" width="130" height="28" fill={GOLD_DEEP} />
        <text x="99" y="60" textAnchor="middle" fontSize="10" fill="#fff8e2" fontFamily="Georgia" fontStyle="italic" letterSpacing="2">APRIL · 2026</text>
        {/* grid */}
        {[0,1,2,3,4].map(r => (
          [0,1,2,3,4,5,6].map(c => (
            <rect key={`${r}-${c}`} x={38 + c*17.5} y={74 + r*20} width="17.5" height="20" fill="none" stroke={GOLD_DEEP} strokeOpacity="0.18" />
          ))
        ))}
        {/* the 18 highlight */}
        <rect x={38 + 3*17.5} y={74 + 2*20} width="17.5" height="20" fill={GOLD} opacity="0.35" />
        <text x="99" y="160" textAnchor="middle" fontSize="52" fill={GOLD_DEEP} fontFamily="Georgia" fontStyle="italic" fontWeight="700">18</text>
        <text x="99" y="180" textAnchor="middle" fontSize="8" fill={GOLD_DEEP} fontFamily="Georgia" fontStyle="italic" letterSpacing="3">the day</text>
      </g>
      {/* ring hanging by ribbon */}
      <g transform="translate(190 130)" className="ss-glow">
        <path d="M 0 -60 Q -6 -50 -2 -40 Q 4 -30 0 -20" stroke={ROSE} strokeWidth="1.2" fill="none" />
        <g style={{ animation:"ss-float 3s ease-in-out infinite" }}>
          <circle cx="0" cy="0" r="20" fill="none" stroke="url(#ss-gold)" strokeWidth="5" />
          <path d="M -5 -20 L 0 -32 L 5 -20 Z" fill={GOLD} />
          <circle cx="0" cy="-28" r="3.5" fill="#fff" opacity="0.95" />
        </g>
      </g>
    </SceneFrame>
  );
}

// XII — panda + laptop showing pandacine
function Scene12() {
  return (
    <SceneFrame>
      {/* laptop */}
      <g transform="translate(120 165)">
        <rect x="-56" y="-38" width="112" height="70" rx="4" fill="#1a1020" stroke={GOLD} strokeOpacity="0.5" />
        <rect x="-52" y="-34" width="104" height="62" rx="2" fill="#0a0612" />
        <rect x="-60" y="32" width="120" height="6" rx="2" fill={GOLD_DEEP} />
        <text x="0" y="8" textAnchor="middle" fontSize="9" fill={GOLD} fontFamily="Georgia" fontStyle="italic" letterSpacing="3">PANDACINE</text>
        <text x="0" y="22" textAnchor="middle" fontSize="6" fill={GOLD} opacity="0.6" fontFamily="Georgia" fontStyle="italic">for couples like us</text>
      </g>
      {/* panda peeking over laptop */}
      <g transform="translate(120 100)" className="ss-float">
        <circle cx="-24" cy="-24" r="12" fill="#1a1020" />
        <circle cx="24" cy="-24" r="12" fill="#1a1020" />
        <circle cx="0" cy="0" r="32" fill="#f7ecd0" />
        <ellipse cx="-12" cy="-4" rx="7" ry="10" fill="#1a1020" transform="rotate(-15 -12 -4)" />
        <ellipse cx="12" cy="-4" rx="7" ry="10" fill="#1a1020" transform="rotate(15 12 -4)" />
        <circle cx="-12" cy="-2" r="2" fill="#fff" />
        <circle cx="12" cy="-2" r="2" fill="#fff" />
        <ellipse cx="0" cy="10" rx="4" ry="3" fill="#1a1020" />
        <path d="M 0 12 Q -3 18 -6 16 M 0 12 Q 3 18 6 16" stroke="#1a1020" strokeWidth="1.2" fill="none" />
      </g>
      {/* tiny heart */}
      <Heart x={175} y={90} s={0.6} className="ss-hb" />
    </SceneFrame>
  );
}

// XIII — gilded 18 with fireworks
function Scene13() {
  return (
    <SceneFrame>
      {[[54,60],[184,66],[62,178],[184,180],[120,50]].map(([cx,cy],k)=>(
        <g key={k} style={{ animation:`ss-sparkle 2.2s ${k*0.4}s ease-in-out infinite`, transformOrigin:`${cx}px ${cy}px`, transformBox:"view-box" }}>
          {[...Array(10)].map((_,i)=>{
            const a = i * Math.PI/5;
            return (
              <line key={i}
                x1={cx} y1={cy}
                x2={cx + Math.cos(a)*16}
                y2={cy + Math.sin(a)*16}
                stroke={i%2 ? GOLD : ROSE} strokeWidth="1.2" />
            );
          })}
        </g>
      ))}
      <text x="120" y="160" textAnchor="middle"
        fontFamily="Georgia" fontStyle="italic" fontWeight="700"
        fontSize="104" fill="url(#ss-gold)"
        className="ss-glow"
        style={{ filter:`drop-shadow(0 0 12px ${GOLD})` }}>18</text>
      <text x="120" y="205" textAnchor="middle" fontSize="9" fill={GOLD} opacity="0.75" fontFamily="Georgia" fontStyle="italic" letterSpacing="3">EVERY MONTH, FOREVER</text>
    </SceneFrame>
  );
}

const SCENES = [Scene1, Scene2, Scene3, Scene4, Scene5, Scene6, Scene7, Scene8, Scene9, Scene10, Scene11, Scene12, Scene13];

export default function StoryScene({ idx }: { idx: number }) {
  const S = SCENES[idx] ?? Scene1;
  return (
    <>
      <style>{CSS}</style>
      <S />
    </>
  );
}
