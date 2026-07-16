import { useMemo, useState } from "react";
import { Disc3, Play, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { MessageRow } from "@/lib/chat";
import { poster } from "@/routes/_authenticated/app.movies";
import type { WheelEntry } from "./MovieWheelPicker";

type WheelMeta = {
  entries?: WheelEntry[];
  winner_index?: number;
};

// Champagne / rose-noir palette — deeper, jewel-like alternating tones.
const SLICE_A = "hsl(340 45% 22%)"; // deep wine
const SLICE_B = "hsl(285 30% 18%)"; // aubergine
const GOLD = "hsl(38 60% 68%)";
const GOLD_SOFT = "hsl(38 45% 55%)";
const INK = "hsl(280 25% 8%)";

export function MovieWheelCard({ m, mine }: { m: MessageRow; mine: boolean }) {
  const meta = (m.media_meta ?? {}) as WheelMeta;
  const entries = meta.entries ?? [];
  const winner = typeof meta.winner_index === "number" ? meta.winner_index : 0;
  const n = Math.max(entries.length, 1);
  const sliceDeg = 360 / n;

  const [spun, setSpun] = useState(false);
  const [spinning, setSpinning] = useState(false);

  const finalRotation = useMemo(() => {
    const base = 360 * 6;
    const target = 360 - (winner * sliceDeg + sliceDeg / 2);
    return base + target;
  }, [winner, sliceDeg]);

  const size = 230;
  const r = size / 2;
  const cx = r;
  const cy = r;

  function polar(angleDeg: number, radius: number) {
    const a = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) };
  }

  function slicePath(i: number, radius = r) {
    const start = i * sliceDeg;
    const end = start + sliceDeg;
    const p0 = polar(start, radius);
    const p1 = polar(end, radius);
    const large = sliceDeg > 180 ? 1 : 0;
    return `M ${cx} ${cy} L ${p0.x} ${p0.y} A ${radius} ${radius} 0 ${large} 1 ${p1.x} ${p1.y} Z`;
  }

  function spin() {
    if (spinning) return;
    setSpinning(true);
    setTimeout(() => {
      setSpun(true);
      setSpinning(false);
    }, 4200);
  }

  const winnerEntry = entries[winner];
  const winnerPoster = poster(winnerEntry?.poster_path ?? null, "w342");

  // Tick marks around the rim
  const ticks = Array.from({ length: n * 3 }, (_, i) => (i * 360) / (n * 3));

  return (
    <div
      className={`w-[290px] rounded-3xl overflow-hidden border ${
        mine ? "border-velvet/40 bg-velvet/10" : "border-petal/30 bg-gradient-to-b from-surface-elevated to-velvet/40"
      } shadow-[0_20px_60px_-30px_rgba(236,72,153,0.55)]`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-white/5">
        <div className="flex items-center gap-1.5">
          <Disc3 className={`size-3.5 ${mine ? "text-velvet/70" : "text-petal"}`} />
          <span className={`text-[9px] uppercase tracking-[0.32em] font-medium ${mine ? "text-velvet/70" : "text-petal"}`}>
            Movie Wheel
          </span>
        </div>
        <span className="text-[9px] uppercase tracking-[0.28em] text-candle-muted">
          {entries.length} picks
        </span>
      </div>

      <div className="px-4 pt-5 pb-4 flex flex-col items-center">
        <div className="relative" style={{ width: size + 24, height: size + 24 }} onClick={(e) => e.stopPropagation()}>
          {/* ambient glow */}
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background: "radial-gradient(closest-side, rgba(236,72,153,0.22), transparent 70%)",
              filter: "blur(8px)",
            }}
          />

          {/* Pointer — refined diamond */}
          <div className="absolute left-1/2 -translate-x-1/2 top-0 z-20 flex flex-col items-center">
            <div
              className="w-0 h-0"
              style={{
                borderLeft: "9px solid transparent",
                borderRight: "9px solid transparent",
                borderTop: `18px solid ${GOLD}`,
                filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.6))",
              }}
            />
            <div
              className="size-2 rounded-full -mt-1"
              style={{ background: GOLD, boxShadow: `0 0 8px ${GOLD}` }}
            />
          </div>

          <div className="absolute inset-0 flex items-center justify-center">
            <svg
              viewBox={`0 0 ${size} ${size}`}
              width={size}
              height={size}
              style={{
                transform: `rotate(${spun || spinning ? finalRotation : 0}deg)`,
                transition: spinning ? "transform 4.2s cubic-bezier(0.15, 0.9, 0.2, 1)" : "none",
                filter: "drop-shadow(0 12px 24px rgba(0,0,0,0.6))",
              }}
            >
              <defs>
                <radialGradient id="wheelSheen" cx="50%" cy="35%" r="70%">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
                  <stop offset="60%" stopColor="rgba(255,255,255,0)" />
                </radialGradient>
                <radialGradient id="hubGold" cx="35%" cy="30%" r="80%">
                  <stop offset="0%" stopColor="hsl(45 80% 82%)" />
                  <stop offset="55%" stopColor={GOLD} />
                  <stop offset="100%" stopColor="hsl(30 55% 38%)" />
                </radialGradient>
                <linearGradient id="rimGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={GOLD} />
                  <stop offset="50%" stopColor="hsl(38 40% 40%)" />
                  <stop offset="100%" stopColor={GOLD} />
                </linearGradient>
              </defs>

              {/* Outer gold rim */}
              <circle cx={cx} cy={cy} r={r - 1} fill="none" stroke="url(#rimGrad)" strokeWidth="2" />

              {/* Slices */}
              {entries.map((e, i) => {
                const mid = i * sliceDeg + sliceDeg / 2;
                const label = polar(mid, r * 0.62);
                const fill = i % 2 === 0 ? SLICE_A : SLICE_B;
                return (
                  <g key={`${e.tmdb_id ?? e.title}-${i}`}>
                    <path d={slicePath(i, r - 3)} fill={fill} stroke={GOLD_SOFT} strokeWidth="0.6" opacity="0.98" />
                    <text
                      x={label.x}
                      y={label.y}
                      fill="hsl(40 55% 90%)"
                      fontSize="9.5"
                      fontFamily="'Cormorant Garamond', Georgia, serif"
                      fontStyle="italic"
                      fontWeight="500"
                      letterSpacing="0.3"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      transform={`rotate(${mid} ${label.x} ${label.y})`}
                      style={{ pointerEvents: "none" }}
                    >
                      {e.title.length > 14 ? e.title.slice(0, 12) + "…" : e.title}
                    </text>
                  </g>
                );
              })}

              {/* Rim ticks */}
              {ticks.map((deg, i) => {
                const inner = polar(deg, r - 6);
                const outer = polar(deg, r - 2);
                return (
                  <line
                    key={i}
                    x1={inner.x}
                    y1={inner.y}
                    x2={outer.x}
                    y2={outer.y}
                    stroke={GOLD_SOFT}
                    strokeWidth="0.6"
                    opacity="0.6"
                  />
                );
              })}

              {/* Glossy sheen overlay */}
              <circle cx={cx} cy={cy} r={r - 3} fill="url(#wheelSheen)" style={{ pointerEvents: "none" }} />

              {/* Hub */}
              <circle cx={cx} cy={cy} r={22} fill="url(#hubGold)" stroke={INK} strokeWidth="1" />
              <circle cx={cx} cy={cy} r={22} fill="none" stroke={GOLD} strokeWidth="0.5" opacity="0.7" />
              <text
                x={cx}
                y={cy + 1}
                fill={INK}
                fontSize="13"
                fontFamily="'Cormorant Garamond', Georgia, serif"
                fontStyle="italic"
                fontWeight="700"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                P
              </text>
            </svg>
          </div>
        </div>

        {!spun ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              spin();
            }}
            disabled={spinning || entries.length < 2}
            className="mt-5 group relative px-6 py-2.5 rounded-full text-[11px] font-medium tracking-[0.22em] uppercase disabled:opacity-50 disabled:cursor-not-allowed transition-transform active:scale-[0.98]"
            style={{
              background: `linear-gradient(135deg, ${GOLD} 0%, hsl(38 55% 48%) 100%)`,
              color: INK,
              boxShadow: `0 8px 24px -10px ${GOLD}, inset 0 1px 0 rgba(255,255,255,0.35)`,
            }}
          >
            <span className="flex items-center gap-2">
              <Sparkles className={`size-3.5 ${spinning ? "animate-spin" : ""}`} />
              {spinning ? "Turning…" : "Spin the wheel"}
            </span>
          </button>
        ) : (
          <div className="mt-5 w-full">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-petal/50 to-transparent" />
              <p className="text-[9px] uppercase tracking-[0.32em] text-petal">Tonight's pick</p>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-petal/50 to-transparent" />
            </div>
            <div className="flex gap-3 items-center bg-velvet/50 border border-petal/20 rounded-2xl p-2.5 shadow-inner">
              <div className="w-14 h-20 rounded-lg overflow-hidden bg-surface shrink-0 ring-1 ring-petal/25">
                {winnerPoster && <img src={winnerPoster} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-serif italic text-sm text-candle leading-tight line-clamp-2">
                  {winnerEntry?.title ?? "—"}
                </p>
                {winnerEntry?.release_date && (
                  <p className="text-[10px] text-candle-muted mt-0.5 tracking-wide">
                    {winnerEntry.release_date.slice(0, 4)}
                  </p>
                )}
                {winnerEntry?.tmdb_id && (
                  <Link
                    to="/app/movies/$id"
                    params={{ id: String(winnerEntry.tmdb_id) }}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1.5 inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.22em] text-petal hover:text-candle transition-colors"
                  >
                    <Play className="size-2.5 fill-current" /> Open
                  </Link>
                )}
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSpun(false);
              }}
              className="mt-2.5 w-full text-[9px] uppercase tracking-[0.32em] text-candle-muted hover:text-petal transition-colors"
            >
              Spin again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
