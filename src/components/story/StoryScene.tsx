import React from "react";

// Animated SVG scenes — one per chapter — that literally depict the story.
// Uses pure inline SVG + CSS keyframes so the "stickers" move.

const GOLD = "#e6c98a";
const GOLD_DEEP = "#b98a3d";
const ROSE = "#e79aad";
const SHADOW = "#1a1220";

const CSS = `
@keyframes ss-float   { 0%,100%{ transform: translateY(0);} 50%{ transform: translateY(-6px);} }
@keyframes ss-drift-x { 0%,100%{ transform: translateX(0);} 50%{ transform: translateX(4px);} }
@keyframes ss-pulse   { 0%,100%{ transform: scale(1); opacity:.9;} 50%{ transform: scale(1.12); opacity:1;} }
@keyframes ss-shake   { 0%,100%{ transform: translateX(0) rotate(0);} 25%{ transform: translateX(-1.5px) rotate(-1deg);} 75%{ transform: translateX(1.5px) rotate(1deg);} }
@keyframes ss-fall    { 0%{ transform: translateY(-30px); opacity:0;} 20%{ opacity:1;} 100%{ transform: translateY(70px); opacity:0;} }
@keyframes ss-peek    { 0%,100%{ transform: translateX(0);} 50%{ transform: translateX(3px);} }
@keyframes ss-flicker { 0%,100%{ opacity:.95; transform: scaleY(1);} 45%{ opacity:.7; transform: scaleY(0.92);} 70%{ opacity:1; transform: scaleY(1.06);} }
@keyframes ss-tear    { 0%{ transform: translateY(0); opacity:0;} 15%{ opacity:1;} 100%{ transform: translateY(24px); opacity:0;} }
@keyframes ss-typing  { 0%,100%{ opacity:.35;} 50%{ opacity:1;} }
@keyframes ss-slash   { 0%{ stroke-dashoffset: 120; opacity:0;} 30%{ opacity:1;} 100%{ stroke-dashoffset: 0; opacity:1;} }
@keyframes ss-swirl   { from{ transform: rotate(0);} to{ transform: rotate(360deg);} }
@keyframes ss-heartbeat { 0%,100%{ transform: scale(1);} 20%{ transform: scale(1.15);} 40%{ transform: scale(1);} 60%{ transform: scale(1.08);} }
@keyframes ss-thread  { 0%{ stroke-dashoffset: 200;} 100%{ stroke-dashoffset: 0;} }
@keyframes ss-sparkle { 0%,100%{ opacity:0; transform: scale(0.6);} 50%{ opacity:1; transform: scale(1);} }
@keyframes ss-ring    { 0%{ transform: scale(0.9) rotate(-8deg);} 100%{ transform: scale(1.05) rotate(6deg);} }
@keyframes ss-fadeIn  { from{ opacity:0;} to{ opacity:1;} }
@keyframes ss-glow    { 0%,100%{ filter: drop-shadow(0 0 6px ${GOLD}88);} 50%{ filter: drop-shadow(0 0 18px ${GOLD}); } }
@keyframes ss-walk    { 0%,100%{ transform: translateX(-4px);} 50%{ transform: translateX(4px);} }
.ss-float{animation:ss-float 3.5s ease-in-out infinite;}
.ss-drift{animation:ss-drift-x 4s ease-in-out infinite;}
.ss-pulse{animation:ss-pulse 2.4s ease-in-out infinite;transform-origin:center;}
.ss-shake{animation:ss-shake 1.2s ease-in-out infinite;transform-origin:center;}
.ss-flicker{animation:ss-flicker 1.6s ease-in-out infinite;transform-origin:bottom center;}
.ss-typing{animation:ss-typing 1s ease-in-out infinite;}
.ss-heartbeat{animation:ss-heartbeat 1.6s ease-in-out infinite;transform-origin:center;}
.ss-swirl{animation:ss-swirl 14s linear infinite;transform-origin:center;transform-box:fill-box;}
.ss-glow{animation:ss-glow 3s ease-in-out infinite;}
.ss-walk{animation:ss-walk 2.2s ease-in-out infinite;}
.ss-ring-anim{animation:ss-ring 2.4s ease-in-out infinite alternate;transform-origin:center;transform-box:fill-box;}
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
      </defs>
      <rect x="0" y="0" width="240" height="240" rx="24" fill="url(#ss-bg)" />
      <rect x="1" y="1" width="238" height="238" rx="23" fill="none" stroke={GOLD} strokeOpacity="0.35" />
      {children}
    </svg>
  );
}

// Tiny reusable primitives
const Person = ({ x, y, s = 1, color = "#f0dfa8", className = "" }: any) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} className={className}>
    <circle cx="0" cy="-16" r="7" fill={color} />
    <path d={`M -9 -8 Q 0 -10 9 -8 L 8 12 Q 0 14 -8 12 Z`} fill={color} opacity="0.95" />
    <rect x="-8" y="12" width="6" height="10" fill={color} opacity="0.85" />
    <rect x="2" y="12" width="6" height="10" fill={color} opacity="0.85" />
  </g>
);

const Heart = ({ x, y, s = 1, color = ROSE, className = "" }: any) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} className={className}>
    <path
      d="M0 8 C -6 0 -12 -4 -12 -10 A 6 6 0 0 1 0 -12 A 6 6 0 0 1 12 -10 C 12 -4 6 0 0 8 Z"
      fill={color}
    />
  </g>
);

/* ─────── 13 scenes ─────── */

function Scene1() { // Her love that gave too much — hand offering hearts that fade
  return (
    <SceneFrame>
      <Person x={120} y={155} s={1.2} />
      <Heart x={120} y={90} s={1.3} className="ss-heartbeat" />
      {[0,1,2].map(i => (
        <g key={i} style={{ animation:`ss-fall 3s ${i*0.9}s ease-in infinite`, transformOrigin:"center", transformBox:"fill-box" }}>
          <Heart x={120} y={70} s={0.6} color="#c76a83" />
        </g>
      ))}
      <text x="120" y="220" textAnchor="middle" fontSize="9" fill={GOLD} opacity="0.6" fontFamily="Georgia" fontStyle="italic">she gave everything</text>
    </SceneFrame>
  );
}

function Scene2() { // Classroom door — girl peeks, boy + other girl inside
  return (
    <SceneFrame>
      {/* room */}
      <rect x="30" y="55" width="180" height="130" fill="#1a1020" stroke={GOLD} strokeOpacity="0.25" />
      {/* door frame on left */}
      <rect x="30" y="55" width="60" height="130" fill="#0e0716" stroke={GOLD} strokeOpacity="0.4" />
      <line x1="90" y1="55" x2="90" y2="185" stroke={GOLD} strokeOpacity="0.6" strokeWidth="1.2" />
      {/* two figures inside sitting */}
      <g transform="translate(150 130)">
        <Person x={-14} y={0} s={0.9} color="#e0c88a" />
        <Person x={14} y={0} s={0.9} color={ROSE} />
        <Heart x={0} y={-14} s={0.55} color="#c76a83" className="ss-pulse" />
      </g>
      {/* peeking girl at door edge */}
      <g className="ss-peek" style={{ animation:"ss-peek 2.4s ease-in-out infinite" }}>
        <circle cx="88" cy="120" r="7" fill="#f0dfa8" />
        <circle cx="85" cy="119" r="1.2" fill={SHADOW} />
        <path d="M 78 115 Q 84 108 92 112" stroke="#5b3a2e" strokeWidth="2" fill="none" />
      </g>
      {/* tear */}
      <circle cx="86" cy="126" r="1.4" fill="#9ac9ff">
        <animate attributeName="cy" values="126;140;126" dur="2.4s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0;1;0" dur="2.4s" repeatCount="indefinite"/>
      </circle>
    </SceneFrame>
  );
}

function Scene3() { // Rainy night, silhouette crying
  return (
    <SceneFrame>
      {[...Array(14)].map((_,i)=>(
        <line key={i}
          x1={20 + i*15} y1="20"
          x2={10 + i*15} y2="60"
          stroke="#8fb6ff" strokeOpacity="0.35" strokeWidth="1"
          style={{ animation:`ss-fall 1.4s ${(i%5)*0.2}s linear infinite`, transformOrigin:"center", transformBox:"fill-box" }}
        />
      ))}
      {/* window */}
      <rect x="60" y="60" width="120" height="90" fill="#0a0612" stroke={GOLD} strokeOpacity="0.35" />
      <line x1="120" y1="60" x2="120" y2="150" stroke={GOLD} strokeOpacity="0.25" />
      <line x1="60" y1="105" x2="180" y2="105" stroke={GOLD} strokeOpacity="0.25" />
      {/* silhouette */}
      <g transform="translate(120 175)">
        <circle cx="0" cy="-14" r="10" fill="#2a1a2f" />
        <path d="M -18 -4 Q 0 -8 18 -4 L 16 30 L -16 30 Z" fill="#2a1a2f" />
      </g>
      {/* tear stream */}
      <g style={{ animation:"ss-tear 1.6s ease-in infinite", transformOrigin:"center", transformBox:"fill-box" }}>
        <circle cx="115" cy="164" r="1.2" fill="#9ac9ff" />
      </g>
    </SceneFrame>
  );
}

function Scene4() { // Phone — texts appearing, chats deleting
  return (
    <SceneFrame>
      <rect x="80" y="30" width="80" height="150" rx="12" fill="#160c1e" stroke={GOLD} strokeOpacity="0.5" />
      <rect x="88" y="40" width="64" height="110" rx="4" fill="#0a0612" />
      {/* incoming bubbles */}
      <g>
        {[
          { y: 52, side: "l", delay: 0 },
          { y: 72, side: "r", delay: 0.4 },
          { y: 92, side: "l", delay: 0.9 },
        ].map((b,i)=>(
          <rect key={i}
            x={b.side === "l" ? 92 : 116} y={b.y}
            width="32" height="12" rx="6"
            fill={b.side === "l" ? "#4a2b3a" : "#3a2b4a"}
            style={{ animation:`ss-fadeIn 0.6s ${b.delay}s both, ss-shake 0.5s ${b.delay + 1.4}s 1 both` }}
          />
        ))}
      </g>
      {/* deletion sweep */}
      <rect x="88" y="110" width="64" height="40" fill="#0a0612">
        <animate attributeName="height" values="0;40;0" dur="3s" repeatCount="indefinite"/>
        <animate attributeName="y" values="150;110;150" dur="3s" repeatCount="indefinite"/>
      </rect>
      <text x="120" y="200" textAnchor="middle" fontSize="8" fill={GOLD} opacity="0.55" fontFamily="Georgia" fontStyle="italic">chats vanish before he looks</text>
    </SceneFrame>
  );
}

function Scene5() { // Two betrayals — bf and best friend with sword
  return (
    <SceneFrame>
      {/* two figures */}
      <Person x={80} y={150} s={1.1} color="#c8a884" />
      <Person x={160} y={150} s={1.1} color="#a88a6a" />
      <text x="80" y="185" textAnchor="middle" fontSize="8" fill={GOLD} opacity="0.55" fontFamily="Georgia" fontStyle="italic">her</text>
      <text x="160" y="185" textAnchor="middle" fontSize="8" fill={GOLD} opacity="0.55" fontFamily="Georgia" fontStyle="italic">best friend</text>
      {/* he — small, offset behind */}
      <Person x={120} y={200} s={0.7} color="#e0c88a" />
      {/* dagger */}
      <g transform="translate(120 100) rotate(35)" className="ss-glow">
        <rect x="-2" y="-40" width="4" height="55" fill="url(#ss-gold)" />
        <rect x="-10" y="15" width="20" height="4" fill={GOLD_DEEP} />
        <path d="M 0 -48 L -3 -40 L 3 -40 Z" fill={GOLD} />
      </g>
      {/* slash */}
      <line x1="60" y1="80" x2="200" y2="140"
        stroke="#c76a83" strokeWidth="2" strokeLinecap="round"
        strokeDasharray="120" style={{ animation:"ss-slash 2.4s ease-out infinite" }} />
    </SceneFrame>
  );
}

function Scene6() { // Alone with candle; family words swirl
  return (
    <SceneFrame>
      <Person x={120} y={165} s={1.15} color="#e0c88a" />
      {/* candle */}
      <g transform="translate(120 105)">
        <rect x="-4" y="0" width="8" height="24" fill="#f2d59a" />
        <ellipse cx="0" cy="-4" rx="4" ry="10" fill="#ffb347" className="ss-flicker" />
        <ellipse cx="0" cy="-4" rx="2" ry="6" fill="#fff2c8" className="ss-flicker" />
      </g>
      {/* swirling words */}
      <g style={{ animation:"ss-swirl 12s linear infinite", transformOrigin:"120px 120px", transformBox:"view-box" }}>
        {["you chose her", "look now", "we warned you"].map((t,i)=>(
          <text key={i}
            x={120 + Math.cos(i*2.1)*70}
            y={120 + Math.sin(i*2.1)*60}
            fontSize="9" fill={GOLD} opacity="0.55"
            fontFamily="Georgia" fontStyle="italic" textAnchor="middle">
            {t}
          </text>
        ))}
      </g>
    </SceneFrame>
  );
}

function Scene7() { // Mutual friend threads two silhouettes
  return (
    <SceneFrame>
      <Person x={60} y={150} s={1.05} color={ROSE} />
      <Person x={180} y={150} s={1.05} color="#e0c88a" />
      <Person x={120} y={90} s={0.9} color="#c8b4e8" />
      <text x="120" y="70" textAnchor="middle" fontSize="8" fill={GOLD} opacity="0.7" fontFamily="Georgia" fontStyle="italic">the friend</text>
      {/* thread */}
      <path d="M 70 145 Q 120 90 170 145"
        fill="none" stroke="url(#ss-gold)" strokeWidth="1.5"
        strokeDasharray="200" style={{ animation:"ss-thread 3s ease-out infinite" }} />
      <circle cx="70" cy="145" r="3" fill={GOLD} />
      <circle cx="170" cy="145" r="3" fill={GOLD} />
    </SceneFrame>
  );
}

function Scene8() { // 3am moon with two chat bubbles
  return (
    <SceneFrame>
      <circle cx="180" cy="65" r="24" fill="#f5e5b8" opacity="0.9" className="ss-glow" />
      <circle cx="172" cy="60" r="20" fill="#0d0714" />
      {/* stars */}
      {[[50,50],[90,35],[210,110],[40,110]].map(([x,y],i)=>(
        <circle key={i} cx={x} cy={y} r="1.5" fill={GOLD}
          style={{ animation:`ss-sparkle 2s ${i*0.4}s ease-in-out infinite` }} />
      ))}
      {/* bubbles */}
      <g style={{ animation:"ss-fadeIn 1s 0.2s both" }}>
        <rect x="35" y="130" width="80" height="30" rx="14" fill="#3a2b4a" />
        <text x="75" y="150" textAnchor="middle" fontSize="10" fill="#f2e2b8" fontFamily="Georgia" fontStyle="italic">still up?</text>
      </g>
      <g style={{ animation:"ss-fadeIn 1s 1.2s both" }}>
        <rect x="130" y="170" width="80" height="30" rx="14" fill="#4a2b3a" />
        <text x="170" y="190" textAnchor="middle" fontSize="10" fill="#ffe0ea" fontFamily="Georgia" fontStyle="italic">always for you</text>
      </g>
      <g className="ss-typing"><circle cx="40" cy="210" r="2" fill={GOLD}/></g>
      <g className="ss-typing" style={{ animationDelay:"0.2s" }}><circle cx="48" cy="210" r="2" fill={GOLD}/></g>
      <g className="ss-typing" style={{ animationDelay:"0.4s" }}><circle cx="56" cy="210" r="2" fill={GOLD}/></g>
    </SceneFrame>
  );
}

function Scene9() { // Praying hands + light returning
  return (
    <SceneFrame>
      {/* rays */}
      <g className="ss-glow" style={{ transformOrigin:"120px 60px" }}>
        {[...Array(10)].map((_,i)=>(
          <line key={i}
            x1="120" y1="60"
            x2={120 + Math.cos(i*Math.PI/5)*90}
            y2={60 + Math.sin(i*Math.PI/5)*90}
            stroke="url(#ss-gold)" strokeOpacity="0.5" strokeWidth="1" />
        ))}
      </g>
      <circle cx="120" cy="60" r="14" fill="url(#ss-gold)" className="ss-pulse" />
      {/* hands */}
      <g transform="translate(120 160)">
        <path d="M -22 0 Q -10 -40 0 -30 Q 10 -40 22 0 Q 12 20 0 15 Q -12 20 -22 0 Z" fill="#e0c88a" />
        <line x1="0" y1="-30" x2="0" y2="15" stroke={GOLD_DEEP} strokeOpacity="0.6" />
      </g>
      {/* sparkles */}
      {[[70,120],[170,120],[95,180],[145,180]].map(([x,y],i)=>(
        <text key={i} x={x} y={y} fontSize="12" fill={GOLD}
          style={{ animation:`ss-sparkle 2.4s ${i*0.5}s ease-in-out infinite` }}>✦</text>
      ))}
    </SceneFrame>
  );
}

function Scene10() { // Crystal ball with future home
  return (
    <SceneFrame>
      {/* stand */}
      <path d="M 100 180 L 140 180 L 150 200 L 90 200 Z" fill={GOLD_DEEP} />
      {/* ball */}
      <circle cx="120" cy="140" r="55" fill="#1a1030" stroke={GOLD} strokeOpacity="0.6" />
      <circle cx="120" cy="140" r="55" fill="url(#ss-bg)" opacity="0.4" />
      {/* future inside */}
      <g clipPath="url(#ss-ball)">
        <defs>
          <clipPath id="ss-ball">
            <circle cx="120" cy="140" r="52" />
          </clipPath>
        </defs>
        {/* little house */}
        <g className="ss-float">
          <rect x="100" y="145" width="40" height="26" fill={GOLD_DEEP} />
          <path d="M 96 145 L 120 128 L 144 145 Z" fill={GOLD} />
          <rect x="115" y="155" width="10" height="16" fill="#1a0f0a" />
        </g>
        {/* two little people */}
        <g className="ss-walk">
          <Person x={112} y={175} s={0.45} color={ROSE} />
          <Person x={128} y={175} s={0.45} color="#e0c88a" />
        </g>
      </g>
      {/* highlight */}
      <ellipse cx="100" cy="118" rx="18" ry="8" fill="#fff" opacity="0.15" />
      {[[60,90],[190,110],[55,170]].map(([x,y],i)=>(
        <text key={i} x={x} y={y} fontSize="10" fill={GOLD}
          style={{ animation:`ss-sparkle 2.2s ${i*0.6}s ease-in-out infinite` }}>✦</text>
      ))}
    </SceneFrame>
  );
}

function Scene11() { // 18 April 2026 — calendar page + ring
  return (
    <SceneFrame>
      {/* calendar */}
      <g className="ss-float">
        <rect x="40" y="50" width="120" height="140" rx="8" fill="#f7ecd0" />
        <rect x="40" y="50" width="120" height="26" fill={GOLD_DEEP} />
        <text x="100" y="68" textAnchor="middle" fontSize="10" fill="#fff8e2" fontFamily="Georgia" fontStyle="italic" letterSpacing="2">APRIL · 2026</text>
        <text x="100" y="155" textAnchor="middle" fontSize="72" fill={GOLD_DEEP} fontFamily="Georgia" fontStyle="italic" fontWeight="700">18</text>
      </g>
      {/* ring */}
      <g transform="translate(180 155)" className="ss-ring-anim ss-glow">
        <circle cx="0" cy="0" r="22" fill="none" stroke="url(#ss-gold)" strokeWidth="5" />
        <path d="M -6 -22 L 0 -34 L 6 -22 Z" fill={GOLD} />
        <circle cx="0" cy="-30" r="4" fill="#fff" opacity="0.9" />
      </g>
    </SceneFrame>
  );
}

function Scene12() { // Pandacine logo build — panda face
  return (
    <SceneFrame>
      <g transform="translate(120 125)" className="ss-float">
        {/* ears */}
        <circle cx="-38" cy="-40" r="16" fill="#1a1020" className="ss-pulse" />
        <circle cx="38" cy="-40" r="16" fill="#1a1020" className="ss-pulse" />
        {/* head */}
        <circle cx="0" cy="0" r="46" fill="#f7ecd0" />
        {/* eye patches */}
        <ellipse cx="-18" cy="-6" rx="10" ry="14" fill="#1a1020" transform="rotate(-15 -18 -6)" />
        <ellipse cx="18" cy="-6" rx="10" ry="14" fill="#1a1020" transform="rotate(15 18 -6)" />
        {/* eyes */}
        <circle cx="-18" cy="-4" r="3" fill="#fff" />
        <circle cx="18" cy="-4" r="3" fill="#fff" />
        {/* nose */}
        <ellipse cx="0" cy="14" rx="5" ry="3.5" fill="#1a1020" />
        <path d="M 0 17 Q -4 24 -8 22 M 0 17 Q 4 24 8 22" stroke="#1a1020" strokeWidth="1.5" fill="none" />
      </g>
      <text x="120" y="215" textAnchor="middle" fontSize="10" fill={GOLD} fontFamily="Georgia" fontStyle="italic" letterSpacing="4">P A N D A C I N E</text>
    </SceneFrame>
  );
}

function Scene13() { // Golden 18 with fireworks
  return (
    <SceneFrame>
      {/* fireworks bursts */}
      {[[60,60],[180,70],[70,180],[180,180]].map(([cx,cy],k)=>(
        <g key={k} style={{ animation:`ss-sparkle 2.2s ${k*0.5}s ease-in-out infinite`, transformOrigin:`${cx}px ${cy}px`, transformBox:"view-box" }}>
          {[...Array(8)].map((_,i)=>(
            <line key={i}
              x1={cx} y1={cy}
              x2={cx + Math.cos(i*Math.PI/4)*14}
              y2={cy + Math.sin(i*Math.PI/4)*14}
              stroke={GOLD} strokeWidth="1.2" />
          ))}
        </g>
      ))}
      <text x="120" y="155" textAnchor="middle"
        fontFamily="Georgia" fontStyle="italic" fontWeight="700"
        fontSize="92" fill="url(#ss-gold)"
        className="ss-glow"
        style={{ filter:`drop-shadow(0 0 12px ${GOLD})` }}>18</text>
      <text x="120" y="200" textAnchor="middle" fontSize="9" fill={GOLD} opacity="0.7" fontFamily="Georgia" fontStyle="italic" letterSpacing="3">EVERY MONTH, FOREVER</text>
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
