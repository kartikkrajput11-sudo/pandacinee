import { useMemo, useState } from "react";
import { Disc3, Play, RotateCw } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { MessageRow } from "@/lib/chat";
import { poster } from "@/routes/_authenticated/app.movies";
import type { WheelEntry } from "./MovieWheelPicker";

type WheelMeta = {
  entries?: WheelEntry[];
  winner_index?: number;
};

const SLICE_COLORS = [
  "hsl(320 65% 62%)",
  "hsl(280 55% 55%)",
  "hsl(340 70% 68%)",
  "hsl(20 80% 65%)",
  "hsl(260 60% 62%)",
  "hsl(300 70% 60%)",
  "hsl(350 75% 65%)",
  "hsl(240 55% 60%)",
];

export function MovieWheelCard({ m, mine }: { m: MessageRow; mine: boolean }) {
  const meta = (m.media_meta ?? {}) as WheelMeta;
  const entries = meta.entries ?? [];
  const winner = typeof meta.winner_index === "number" ? meta.winner_index : 0;
  const n = Math.max(entries.length, 1);
  const sliceDeg = 360 / n;

  const [spun, setSpun] = useState(false);
  const [spinning, setSpinning] = useState(false);

  // Final rotation lands the winner slice at top (pointer at 12 o'clock).
  const finalRotation = useMemo(() => {
    const base = 360 * 6; // 6 full turns for drama
    const target = 360 - (winner * sliceDeg + sliceDeg / 2);
    return base + target;
  }, [winner, sliceDeg]);

  const size = 220;
  const r = size / 2;
  const cx = r;
  const cy = r;

  function polar(angleDeg: number, radius: number) {
    const a = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) };
  }

  function slicePath(i: number) {
    const start = i * sliceDeg;
    const end = start + sliceDeg;
    const p0 = polar(start, r);
    const p1 = polar(end, r);
    const large = sliceDeg > 180 ? 1 : 0;
    return `M ${cx} ${cy} L ${p0.x} ${p0.y} A ${r} ${r} 0 ${large} 1 ${p1.x} ${p1.y} Z`;
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

  return (
    <div
      className={`w-[280px] rounded-2xl overflow-hidden border ${
        mine ? "border-velvet/30 bg-velvet/10" : "border-petal/40 bg-surface-elevated"
      }`}
    >
      <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-1.5 border-b border-border/50">
        <Disc3 className={`size-3.5 ${mine ? "text-velvet/70" : "text-petal"}`} />
        <span className={`text-[10px] uppercase tracking-[0.25em] ${mine ? "text-velvet/70" : "text-petal"}`}>
          Movie wheel · {entries.length} picks
        </span>
      </div>

      <div className="p-3 flex flex-col items-center">
        <div className="relative" style={{ width: size, height: size }} onClick={(e) => e.stopPropagation()}>
          {/* pointer */}
          <div className="absolute left-1/2 -translate-x-1/2 -top-1 z-20">
            <div className="w-0 h-0 border-x-[10px] border-x-transparent border-t-[16px] border-t-petal drop-shadow" />
          </div>
          <svg
            viewBox={`0 0 ${size} ${size}`}
            width={size}
            height={size}
            className="drop-shadow-lg"
            style={{
              transform: `rotate(${spun || spinning ? finalRotation : 0}deg)`,
              transition: spinning ? "transform 4.2s cubic-bezier(0.15, 0.9, 0.2, 1)" : spun ? "none" : "none",
            }}
          >
            {entries.map((e, i) => {
              const mid = i * sliceDeg + sliceDeg / 2;
              const label = polar(mid, r * 0.62);
              return (
                <g key={`${e.tmdb_id ?? e.title}-${i}`}>
                  <path d={slicePath(i)} fill={SLICE_COLORS[i % SLICE_COLORS.length]} stroke="hsl(280 30% 12%)" strokeWidth="1.5" />
                  <text
                    x={label.x}
                    y={label.y}
                    fill="white"
                    fontSize="9"
                    fontWeight="600"
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
            <circle cx={cx} cy={cy} r={18} fill="hsl(280 30% 12%)" stroke="hsl(320 65% 62%)" strokeWidth="2" />
          </svg>
        </div>

        {!spun ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              spin();
            }}
            disabled={spinning || entries.length < 2}
            className="mt-3 px-5 py-2 rounded-full bg-petal text-velvet text-xs font-medium petal-glow disabled:opacity-50 flex items-center gap-1.5"
          >
            <RotateCw className={`size-3.5 ${spinning ? "animate-spin" : ""}`} />
            {spinning ? "Spinning…" : "Spin the wheel"}
          </button>
        ) : (
          <div className="mt-3 w-full">
            <p className="text-center text-[10px] uppercase tracking-[0.25em] text-petal mb-1">Tonight's pick 🍿</p>
            <div className="flex gap-2 items-center bg-velvet/40 border border-border rounded-2xl p-2">
              <div className="w-14 h-20 rounded-lg overflow-hidden bg-surface shrink-0">
                {winnerPoster && <img src={winnerPoster} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-serif italic text-sm text-candle leading-tight line-clamp-2">
                  {winnerEntry?.title ?? "—"}
                </p>
                {winnerEntry?.release_date && (
                  <p className="text-[10px] text-candle-muted">{winnerEntry.release_date.slice(0, 4)}</p>
                )}
                {winnerEntry?.tmdb_id && (
                  <Link
                    to="/app/movie/$id"
                    params={{ id: String(winnerEntry.tmdb_id) }}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1 inline-flex items-center gap-1 text-[11px] text-petal hover:underline"
                  >
                    <Play className="size-3" /> Open movie
                  </Link>
                )}
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSpun(false);
              }}
              className="mt-2 w-full text-[10px] text-candle-muted hover:text-petal"
            >
              Spin again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
