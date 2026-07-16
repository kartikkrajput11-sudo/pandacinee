import { useEffect, useState } from "react";

type Tone = "gold" | "rose" | "ivory" | "emerald";

const PALETTE: Record<Tone, { hi: string; mid: string; lo: string; deep: string; glow: string }> = {
  gold:    { hi: "#fff2c0", mid: "#e8c464", lo: "#a97f28", deep: "#4a2f08", glow: "rgba(232,196,100,0.55)" },
  rose:    { hi: "#ffd6df", mid: "#e8a1b0", lo: "#a83a4d", deep: "#3d0a17", glow: "rgba(232,161,176,0.55)" },
  ivory:   { hi: "#fbf6ea", mid: "#e8dcc4", lo: "#a89572", deep: "#3a3020", glow: "rgba(232,220,196,0.5)" },
  emerald: { hi: "#a4e8d8", mid: "#3fa08a", lo: "#0d5a48", deep: "#04231b", glow: "rgba(63,160,138,0.55)" },
};

/**
 * PANDACINE luxury wax seal with drips, embossed panda + ring text,
 * an idle molten shimmer, and a rich break sequence: crack → shards →
 * melt-away. Purely presentational — parent owns the trigger + timing.
 */
export function PandacineWaxSeal({
  tone = "gold",
  breaking = false,
  size = 176,
  onClick,
  ariaLabel = "Break seal",
  interactive = true,
  motto,
}: {
  tone?: Tone;
  breaking?: boolean;
  size?: number;
  onClick?: () => void;
  ariaLabel?: string;
  interactive?: boolean;
  motto?: string;
}) {
  const p = PALETTE[tone];
  const ringText = (() => {
    const base = (motto?.trim() || "PANDACINE · SEALED WITH LOVE").toUpperCase();
    // Repeat so the text always wraps the ring fully, no matter how short.
    const spaced = `${base} · `;
    let out = spaced;
    while (out.length < 60) out += spaced;
    return out;
  })();
  const [phase, setPhase] = useState<"idle" | "crack" | "melt">("idle");

  useEffect(() => {
    if (!breaking) {
      setPhase("idle");
      return;
    }
    setPhase("crack");
    const t = setTimeout(() => setPhase("melt"), 520);
    return () => clearTimeout(t);
  }, [breaking]);

  const Tag = interactive ? "button" : "div";

  return (
    <Tag
      onClick={onClick}
      aria-label={interactive ? ariaLabel : undefined}
      className={`pcs-wrap pcs-phase-${phase}`}
      style={{ width: size, height: size }}
    >
      {/* Molten aura */}
      <span
        className="pcs-aura"
        style={{
          background: `radial-gradient(circle, ${p.glow} 0%, transparent 70%)`,
        }}
      />

      {/* Rotating radial rays behind the disc */}
      <svg className="pcs-rays" viewBox="0 0 200 200" aria-hidden>
        <defs>
          <radialGradient id={`ray-${tone}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={p.hi} stopOpacity="0.5" />
            <stop offset="100%" stopColor={p.hi} stopOpacity="0" />
          </radialGradient>
        </defs>
        {Array.from({ length: 12 }).map((_, i) => (
          <polygon
            key={i}
            points="100,100 96,4 104,4"
            fill={`url(#ray-${tone})`}
            transform={`rotate(${i * 30} 100 100)`}
          />
        ))}
      </svg>

      {/* Pulsing outer glow ring */}
      <span
        className="pcs-pulse-ring"
        style={{ boxShadow: `0 0 0 2px ${p.mid}55, 0 0 40px 8px ${p.glow}` }}
      />

      {/* Twinkling star specks around the seal */}
      <div className="pcs-twinkle-field" aria-hidden>
        {[
          { top: "6%", left: "18%", d: "0s" },
          { top: "12%", left: "82%", d: "0.4s" },
          { top: "44%", left: "94%", d: "0.9s" },
          { top: "78%", left: "88%", d: "0.2s" },
          { top: "92%", left: "50%", d: "1.1s" },
          { top: "80%", left: "10%", d: "0.6s" },
          { top: "40%", left: "4%", d: "1.3s" },
          { top: "22%", left: "6%", d: "0.8s" },
        ].map((s, i) => (
          <span
            key={i}
            className="pcs-tw"
            style={{ top: s.top, left: s.left, animationDelay: s.d, color: p.hi }}
          />
        ))}
      </div>

      {/* Wax drips underneath (revealed by melt) */}
      <svg className="pcs-drips" viewBox="0 0 200 200" aria-hidden>
        <defs>
          <linearGradient id={`drip-${tone}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={p.mid} />
            <stop offset="60%" stopColor={p.lo} />
            <stop offset="100%" stopColor={p.deep} />
          </linearGradient>
        </defs>
        <path d="M40 110 Q42 150 32 172 Q28 182 36 184 Q46 182 50 168 Q54 148 58 116 Z" fill={`url(#drip-${tone})`} opacity="0.85"/>
        <path d="M155 118 Q162 160 172 178 Q178 188 168 190 Q158 186 152 172 Q146 152 144 122 Z" fill={`url(#drip-${tone})`} opacity="0.85"/>
        <path d="M95 150 Q92 178 88 190 Q92 196 100 196 Q108 196 108 190 Q104 176 104 150 Z" fill={`url(#drip-${tone})`} opacity="0.9"/>
      </svg>

      {/* The disc */}
      <svg className={`pcs-disc pcs-phase-${phase}`} viewBox="0 0 200 200" aria-hidden>
        <defs>
          <radialGradient id={`face-${tone}`} cx="35%" cy="30%" r="80%">
            <stop offset="0%" stopColor={p.hi} />
            <stop offset="45%" stopColor={p.mid} />
            <stop offset="100%" stopColor={p.lo} />
          </radialGradient>
          <radialGradient id={`shine-${tone}`} cx="30%" cy="25%" r="35%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.85)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
          <filter id={`emboss-${tone}`}>
            <feGaussianBlur in="SourceAlpha" stdDeviation="0.6" />
            <feSpecularLighting result="spec" specularExponent="20" lightingColor="#ffffff">
              <feDistantLight azimuth="225" elevation="55" />
            </feSpecularLighting>
            <feComposite in="spec" in2="SourceAlpha" operator="in" result="specOut" />
            <feComposite in="SourceGraphic" in2="specOut" operator="arithmetic" k1="0" k2="1" k3="0.9" k4="0" />
          </filter>
          <path id={`ringpath-${tone}`}
            d="M100,100 m-72,0 a72,72 0 1,1 144,0 a72,72 0 1,1 -144,0" />
        </defs>

        {/* Wax body */}
        <g filter={`url(#emboss-${tone})`}>
          {/* Irregular pressed edge */}
          <path
            d="M100 8
               C 130 10, 158 22, 176 46
               C 194 70, 196 108, 184 138
               C 172 168, 142 188, 108 192
               C 74 194, 42 178, 24 150
               C 6 122, 6 86, 22 58
               C 40 30, 70 12, 100 8 Z"
            fill={`url(#face-${tone})`}
          />
          {/* Inner rim */}
          <circle cx="100" cy="100" r="80" fill="none" stroke={p.deep} strokeOpacity="0.35" strokeWidth="1.2" />
          <circle cx="100" cy="100" r="74" fill="none" stroke={p.hi} strokeOpacity="0.35" strokeWidth="0.8" />
          <circle cx="100" cy="100" r="58" fill="none" stroke={p.deep} strokeOpacity="0.4" strokeWidth="0.9" strokeDasharray="1 3" />

          {/* Guilloché filigree — 24 tiny spokes on the inner rim */}
          <g stroke={p.deep} strokeOpacity="0.35" strokeWidth="0.6">
            {Array.from({ length: 24 }).map((_, i) => {
              const a = (i / 24) * Math.PI * 2;
              const x1 = 100 + Math.cos(a) * 62;
              const y1 = 100 + Math.sin(a) * 62;
              const x2 = 100 + Math.cos(a) * 70;
              const y2 = 100 + Math.sin(a) * 70;
              return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />;
            })}
          </g>

          {/* Dot studs on outer ring */}
          <g fill={p.deep} opacity="0.55">
            {Array.from({ length: 12 }).map((_, i) => {
              const a = (i / 12) * Math.PI * 2 + Math.PI / 12;
              return <circle key={i} cx={100 + Math.cos(a) * 84} cy={100 + Math.sin(a) * 84} r="1.2" />;
            })}
          </g>

          {/* Compass rose points N/E/S/W */}
          <g fill={p.hi} opacity="0.7">
            <polygon points="100,18 103,28 100,34 97,28" />
            <polygon points="182,100 172,103 166,100 172,97" />
            <polygon points="100,182 97,172 100,166 103,172" />
            <polygon points="18,100 28,97 34,100 28,103" />
          </g>

          {/* Laurel sprigs framing the panda */}
          <g stroke={p.deep} strokeOpacity="0.55" strokeWidth="1" fill={p.deep} fillOpacity="0.45">
            {/* left sprig */}
            <path d="M56 140 Q68 128 76 118" fill="none" strokeLinecap="round"/>
            <ellipse cx="60" cy="134" rx="3.2" ry="1.4" transform="rotate(-40 60 134)"/>
            <ellipse cx="65" cy="128" rx="3.2" ry="1.4" transform="rotate(-40 65 128)"/>
            <ellipse cx="70" cy="122" rx="3.2" ry="1.4" transform="rotate(-40 70 122)"/>
            <ellipse cx="74" cy="116" rx="3" ry="1.3" transform="rotate(-40 74 116)"/>
            {/* right sprig */}
            <path d="M144 140 Q132 128 124 118" fill="none" strokeLinecap="round"/>
            <ellipse cx="140" cy="134" rx="3.2" ry="1.4" transform="rotate(40 140 134)"/>
            <ellipse cx="135" cy="128" rx="3.2" ry="1.4" transform="rotate(40 135 128)"/>
            <ellipse cx="130" cy="122" rx="3.2" ry="1.4" transform="rotate(40 130 122)"/>
            <ellipse cx="126" cy="116" rx="3" ry="1.3" transform="rotate(40 126 116)"/>
          </g>

          {/* Fleuron corner ornaments */}
          <g fill={p.deep} opacity="0.55">
            <path d="M100 44 c -2 -3 -6 -3 -6 0 c 0 3 3 5 6 6 c 3 -1 6 -3 6 -6 c 0 -3 -4 -3 -6 0 z" />
            <path d="M100 156 c -2 3 -6 3 -6 0 c 0 -3 3 -5 6 -6 c 3 1 6 3 6 6 c 0 3 -4 3 -6 0 z" />
          </g>

          {/* Curved ring text */}
          <text fill={p.deep} fillOpacity="0.72" fontSize="10.5" letterSpacing="4"
                fontFamily="'Cormorant Garamond','Playfair Display',Georgia,serif" fontStyle="italic" fontWeight="600">
            <textPath href={`#ringpath-${tone}`} startOffset="0%">
              {ringText}
            </textPath>
          </text>

          {/* Panda mark */}
          <g transform="translate(100 104)">
            {/* ears */}
            <circle cx="-18" cy="-22" r="10" fill={p.deep} opacity="0.85" />
            <circle cx="18" cy="-22" r="10" fill={p.deep} opacity="0.85" />
            {/* head */}
            <ellipse cx="0" cy="0" rx="26" ry="24" fill={p.hi} opacity="0.95" />
            {/* eye patches */}
            <ellipse cx="-9" cy="-2" rx="6" ry="8" fill={p.deep} opacity="0.9" transform="rotate(-14 -9 -2)" />
            <ellipse cx="9" cy="-2" rx="6" ry="8" fill={p.deep} opacity="0.9" transform="rotate(14 9 -2)" />
            {/* eyes */}
            <circle cx="-9" cy="-1" r="1.6" fill={p.hi} />
            <circle cx="9" cy="-1" r="1.6" fill={p.hi} />
            {/* nose */}
            <ellipse cx="0" cy="8" rx="2.4" ry="1.7" fill={p.deep} />
            {/* mouth */}
            <path d="M-4 12 Q0 15 4 12" stroke={p.deep} strokeWidth="1.2" fill="none" strokeLinecap="round"/>
            {/* tiny heart above */}
            <path d="M0 -30 c -3 -4 -9 -1 -9 3 c 0 4 6 8 9 11 c 3 -3 9 -7 9 -11 c 0 -4 -6 -7 -9 -3 z"
                  fill={p.deep} opacity="0.55"/>
          </g>
        </g>

        {/* Specular sheen */}
        <ellipse cx="72" cy="60" rx="42" ry="22" fill={`url(#shine-${tone})`} className="pcs-sheen" />

        {/* Crack lines (revealed on break) */}
        <g className="pcs-cracks" stroke={p.deep} strokeOpacity="0.75" strokeLinecap="round" fill="none">
          <path d="M100 20 L96 60 L108 92 L94 122 L102 158 L96 186" strokeWidth="1.6"/>
          <path d="M40 70 L78 96 L64 132" strokeWidth="1.2"/>
          <path d="M160 74 L124 100 L142 138" strokeWidth="1.2"/>
        </g>

        {/* Shards (fly outward on break) */}
        <g className="pcs-shards">
          <polygon points="100,100 60,30 130,45" fill={p.mid} className="pcs-shard s1" />
          <polygon points="100,100 170,60 155,140" fill={p.lo}  className="pcs-shard s2" />
          <polygon points="100,100 40,140 90,180" fill={p.mid} className="pcs-shard s3" />
          <polygon points="100,100 155,150 105,190" fill={p.lo}  className="pcs-shard s4" />
        </g>

        {/* Orbiting stars around the seal */}
        <g className="pcs-orbit" fill={p.hi}>
          <g className="pcs-orbit-a">
            <path d="M100 12 l1.4 3.2 3.4 .3 -2.6 2.3 .8 3.3 -3 -1.8 -3 1.8 .8 -3.3 -2.6 -2.3 3.4 -.3 z" />
          </g>
          <g className="pcs-orbit-b">
            <path d="M188 100 l1.4 3.2 3.4 .3 -2.6 2.3 .8 3.3 -3 -1.8 -3 1.8 .8 -3.3 -2.6 -2.3 3.4 -.3 z" transform="translate(-8 -8) scale(0.7)" />
          </g>
          <g className="pcs-orbit-c">
            <circle cx="12" cy="100" r="1.6" />
          </g>
        </g>

        {/* Floating embers — little sparks that drift up when melting */}
        <g className="pcs-embers" fill={p.hi}>
          <circle cx="60" cy="110" r="1.4" className="pcs-ember e1" />
          <circle cx="100" cy="120" r="1.2" className="pcs-ember e2" />
          <circle cx="140" cy="108" r="1.6" className="pcs-ember e3" />
          <circle cx="80" cy="130" r="1.1" className="pcs-ember e4" />
          <circle cx="122" cy="132" r="1.3" className="pcs-ember e5" />
          <circle cx="94" cy="98"  r="1.0" className="pcs-ember e6" />
        </g>

        {/* Ribbon banner under the seal */}
        <g className="pcs-ribbon">
          <path d="M56 168 L56 188 L74 180 L92 190 L92 168 Z" fill={p.lo} opacity="0.9" />
          <path d="M144 168 L144 188 L126 180 L108 190 L108 168 Z" fill={p.lo} opacity="0.9" />
          <path d="M56 168 L144 168 L144 180 L56 180 Z" fill={p.mid} />
          <path d="M56 168 L144 168" stroke={p.deep} strokeOpacity="0.4" strokeWidth="0.6" />
        </g>
      </svg>

      <style>{`
        .pcs-wrap {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 9999px;
          background: transparent;
          border: none;
          padding: 0;
          cursor: ${interactive ? "pointer" : "default"};
          transition: transform 220ms ease;
        }
        .pcs-wrap:hover { transform: ${interactive ? "scale(1.03)" : "none"}; }
        .pcs-wrap:active { transform: ${interactive ? "scale(0.97)" : "none"}; }

        .pcs-aura {
          position: absolute; inset: -30%;
          filter: blur(24px);
          opacity: 0.85;
          animation: pcs-breathe 3.2s ease-in-out infinite;
          pointer-events: none;
        }
        @keyframes pcs-breathe {
          0%,100% { opacity: 0.55; transform: scale(1); }
          50%     { opacity: 0.95; transform: scale(1.06); }
        }

        .pcs-disc, .pcs-drips {
          position: absolute; inset: 0; width: 100%; height: 100%;
          overflow: visible;
        }
        .pcs-drips {
          opacity: 0;
          transform: translateY(-6px) scale(0.96);
          transition: opacity 700ms ease 120ms, transform 900ms cubic-bezier(.2,.7,.2,1) 120ms;
        }
        .pcs-wrap.pcs-phase-melt .pcs-drips {
          opacity: 1;
          transform: translateY(0) scale(1);
        }

        .pcs-sheen { animation: pcs-shimmer 4s ease-in-out infinite; transform-origin: 60px 55px; }
        @keyframes pcs-shimmer {
          0%,100% { opacity: 0.55; }
          50%     { opacity: 0.9;  }
        }

        .pcs-cracks path {
          stroke-dasharray: 220;
          stroke-dashoffset: 220;
          transition: stroke-dashoffset 480ms ease-out;
        }
        .pcs-phase-crack .pcs-cracks path,
        .pcs-phase-melt  .pcs-cracks path { stroke-dashoffset: 0; }

        .pcs-shards { opacity: 0; transform-origin: 100px 100px; }
        .pcs-shard { transition: transform 900ms cubic-bezier(.5,.1,.4,1), opacity 900ms ease; opacity: 0; }
        .pcs-phase-melt .pcs-shards { opacity: 1; }
        .pcs-phase-melt .pcs-shard { opacity: 1; }
        .pcs-phase-melt .pcs-shard.s1 { transform: translate(-40px,-56px) rotate(-22deg); }
        .pcs-phase-melt .pcs-shard.s2 { transform: translate(60px,-24px)  rotate(28deg); }
        .pcs-phase-melt .pcs-shard.s3 { transform: translate(-52px,42px)  rotate(-30deg); }
        .pcs-phase-melt .pcs-shard.s4 { transform: translate(56px,50px)   rotate(24deg); }

        .pcs-disc {
          transition: transform 900ms cubic-bezier(.5,.1,.4,1), filter 900ms ease, opacity 900ms ease;
        }
        .pcs-phase-crack { animation: pcs-shake 420ms ease-in-out; }
        .pcs-phase-melt {
          transform: scale(1.08);
          filter: blur(1px) saturate(1.15);
        }
        @keyframes pcs-shake {
          0%,100% { transform: translate(0,0) rotate(0); }
          20% { transform: translate(-2px,1px) rotate(-1.2deg); }
          40% { transform: translate(3px,-1px) rotate(1.4deg); }
          60% { transform: translate(-2px,2px) rotate(-1deg); }
          80% { transform: translate(2px,-2px) rotate(0.8deg); }
        }

        /* Orbiting stars */
        .pcs-orbit { transform-origin: 100px 100px; transform-box: fill-box; }
        .pcs-orbit-a { transform-origin: 100px 100px; transform-box: fill-box; animation: pcs-spin 14s linear infinite; }
        .pcs-orbit-b { transform-origin: 100px 100px; transform-box: fill-box; animation: pcs-spin 10s linear infinite reverse; }
        .pcs-orbit-c { transform-origin: 100px 100px; transform-box: fill-box; animation: pcs-spin 18s linear infinite; }
        .pcs-orbit-a, .pcs-orbit-b, .pcs-orbit-c { filter: drop-shadow(0 0 3px currentColor); }
        @keyframes pcs-spin { to { transform: rotate(360deg); } }

        /* Ribbon banner */
        .pcs-ribbon { opacity: 0; transform: translateY(-6px); transition: opacity 700ms ease 200ms, transform 700ms cubic-bezier(.2,.7,.2,1) 200ms; }
        .pcs-wrap.pcs-phase-melt .pcs-ribbon { opacity: 1; transform: translateY(0); }

        /* Embers */
        .pcs-embers { opacity: 0; }
        .pcs-wrap.pcs-phase-melt .pcs-embers { opacity: 1; }
        .pcs-ember { animation: pcs-ember-rise 1.4s ease-out forwards; opacity: 0; }
        .pcs-wrap.pcs-phase-melt .pcs-ember.e1 { animation-delay: 40ms; }
        .pcs-wrap.pcs-phase-melt .pcs-ember.e2 { animation-delay: 160ms; }
        .pcs-wrap.pcs-phase-melt .pcs-ember.e3 { animation-delay: 260ms; }
        .pcs-wrap.pcs-phase-melt .pcs-ember.e4 { animation-delay: 380ms; }
        .pcs-wrap.pcs-phase-melt .pcs-ember.e5 { animation-delay: 460ms; }
        .pcs-wrap.pcs-phase-melt .pcs-ember.e6 { animation-delay: 560ms; }
        @keyframes pcs-ember-rise {
          0%   { opacity: 0; transform: translate(0,0) scale(0.6); }
          25%  { opacity: 1; }
          100% { opacity: 0; transform: translate(var(--dx,4px), -60px) scale(1.2); }
        }
        .pcs-ember.e1 { --dx: -8px; }
        .pcs-ember.e2 { --dx: 4px; }
        .pcs-ember.e3 { --dx: 10px; }
        .pcs-ember.e4 { --dx: -12px; }
        .pcs-ember.e5 { --dx: 6px; }
        .pcs-ember.e6 { --dx: -4px; }
      `}</style>
    </Tag>
  );
}
