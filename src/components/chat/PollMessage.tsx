import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isPollMeta, type PollMeta } from "@/lib/poll";
import { sfxPollVote } from "@/lib/sfx";
import { Check, Crown, Sparkles } from "lucide-react";

type Vote = { message_id: string; user_id: string; option_id: string };

export function PollMessage({
  messageId,
  meta,
  meId,
  memberById,
}: {
  messageId: string;
  meta: unknown;
  meId: string | null;
  memberById: Map<string, { display_name: string; avatar_url: string | null }>;
}) {
  const [votes, setVotes] = useState<Vote[]>([]);
  const [busy, setBusy] = useState(false);
  const [pulseId, setPulseId] = useState<string | null>(null);

  const poll: PollMeta | null = isPollMeta(meta) ? meta : null;

  useEffect(() => {
    let alive = true;
    async function load() {
      const { data } = await supabase
        .from("poll_votes")
        .select("message_id,user_id,option_id")
        .eq("message_id", messageId);
      if (alive) setVotes((data ?? []) as Vote[]);
    }
    void load();
    const ch = supabase
      .channel(`poll-${messageId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "poll_votes", filter: `message_id=eq.${messageId}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      alive = false;
      supabase.removeChannel(ch);
    };
  }, [messageId]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of votes) m.set(v.option_id, (m.get(v.option_id) ?? 0) + 1);
    return m;
  }, [votes]);

  const total = votes.length;
  const myVote = meId ? votes.find((v) => v.user_id === meId)?.option_id ?? null : null;
  const votersByOption = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const v of votes) m.set(v.option_id, [...(m.get(v.option_id) ?? []), v.user_id]);
    return m;
  }, [votes]);

  const leadingId = useMemo(() => {
    if (total === 0) return null;
    let best: string | null = null;
    let bestCount = 0;
    let tie = false;
    for (const [id, c] of counts) {
      if (c > bestCount) {
        best = id;
        bestCount = c;
        tie = false;
      } else if (c === bestCount) {
        tie = true;
      }
    }
    return tie ? null : best;
  }, [counts, total]);

  if (!poll) return <span className="italic text-candle-muted text-sm">Broken poll</span>;

  async function vote(optionId: string) {
    if (!meId || busy) return;
    setBusy(true);
    setPulseId(optionId);
    try {
      await supabase.from("poll_votes").delete().eq("message_id", messageId).eq("user_id", meId);
      if (optionId !== myVote) {
        const { error } = await supabase
          .from("poll_votes")
          .insert({ message_id: messageId, user_id: meId, option_id: optionId });
        if (!error) sfxPollVote();
      }
    } finally {
      setBusy(false);
      setTimeout(() => setPulseId(null), 600);
    }
  }

  return (
    <div className="min-w-[260px] max-w-[320px] relative">
      {/* velvet card frame */}
      <div className="relative rounded-2xl border border-petal/25 bg-gradient-to-br from-velvet/80 via-surface/60 to-velvet/80 p-3 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)] overflow-hidden">
        {/* filigree corner accents */}
        <div className="pointer-events-none absolute -top-8 -right-8 size-24 rounded-full bg-petal/15 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-8 size-24 rounded-full bg-gold/10 blur-2xl" />

        <div className="relative flex items-center gap-1.5 mb-2.5">
          <Sparkles className="size-3 text-gold/80" />
          <span className="text-[10px] uppercase tracking-[0.18em] text-gold/80 font-medium">Poll</span>
          <div className="flex-1 h-px bg-gradient-to-r from-gold/40 via-gold/10 to-transparent" />
        </div>

        <p className="relative font-serif text-[13px] leading-snug text-candle mb-3">
          {poll.question}
        </p>

        <div className="relative space-y-1.5">
          {poll.options.map((o) => {
            const count = counts.get(o.id) ?? 0;
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            const mine = myVote === o.id;
            const leading = leadingId === o.id && total > 0;
            const poster = (o.meta?.poster_url as string | null | undefined) ?? null;
            const voters = votersByOption.get(o.id) ?? [];
            const pulsing = pulseId === o.id;
            return (
              <button
                key={o.id}
                onClick={() => vote(o.id)}
                disabled={busy}
                className={`group relative w-full text-left rounded-xl overflow-hidden border transition-all duration-300 active:scale-[0.985] ${
                  mine
                    ? "border-petal/70 bg-petal-soft/30 shadow-[0_0_0_1px_hsl(var(--petal)/0.25),0_6px_18px_-8px_hsl(var(--petal)/0.5)]"
                    : "border-border/60 bg-velvet/50 hover:border-petal/40 hover:bg-velvet/70"
                } ${pulsing ? "animate-[poll-pulse_0.6s_ease-out]" : ""}`}
              >
                {/* animated fill */}
                <div
                  className={`absolute inset-y-0 left-0 transition-all duration-700 ease-out ${
                    leading
                      ? "bg-gradient-to-r from-gold/30 via-petal/25 to-petal/10"
                      : mine
                        ? "bg-gradient-to-r from-petal/35 to-petal/10"
                        : "bg-gradient-to-r from-petal/20 to-transparent"
                  }`}
                  style={{ width: `${pct}%` }}
                />
                {/* shimmer sweep on leader */}
                {leading && (
                  <div className="pointer-events-none absolute inset-y-0 left-0 w-full overflow-hidden" style={{ width: `${pct}%` }}>
                    <div className="absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/15 to-transparent animate-[poll-shimmer_2.4s_linear_infinite]" />
                  </div>
                )}

                <div className="relative flex items-center gap-2 px-3 py-2">
                  {poster && (
                    <img
                      src={poster}
                      alt=""
                      className="size-9 rounded-md object-cover shrink-0 ring-1 ring-border/60"
                    />
                  )}
                  {poll.kind === "emoji" && <span className="text-xl leading-none">{o.label}</span>}
                  <span className="flex-1 text-[12px] text-candle truncate font-medium">
                    {poll.kind === "emoji" ? "" : o.label}
                  </span>
                  {leading && total > 0 && (
                    <Crown className="size-3.5 text-gold drop-shadow-[0_0_6px_hsl(var(--gold)/0.6)]" />
                  )}
                  {mine && (
                    <span className="flex items-center justify-center size-4 rounded-full bg-petal text-[10px] text-primary-foreground shadow-[0_0_10px_hsl(var(--petal)/0.6)]">
                      <Check className="size-2.5" strokeWidth={3} />
                    </span>
                  )}
                  <span className="text-[10px] text-candle-muted shrink-0 tabular-nums font-mono">
                    {pct}%
                  </span>
                </div>

                {voters.length > 0 && (
                  <div className="relative flex items-center gap-1 px-3 pb-1.5">
                    <div className="flex -space-x-1.5">
                      {voters.slice(0, 6).map((uid) => {
                        const p = memberById.get(uid);
                        const initial = (p?.display_name ?? "?").charAt(0).toUpperCase();
                        return p?.avatar_url ? (
                          <img
                            key={uid}
                            src={p.avatar_url}
                            alt=""
                            title={p?.display_name ?? "Panda"}
                            className="size-4 rounded-full object-cover ring-[1.5px] ring-surface"
                          />
                        ) : (
                          <div
                            key={uid}
                            className="size-4 rounded-full bg-gradient-to-br from-petal to-petal-soft ring-[1.5px] ring-surface flex items-center justify-center text-[8px] text-primary-foreground font-semibold"
                            title={p?.display_name ?? "Panda"}
                          >
                            {initial}
                          </div>
                        );
                      })}
                    </div>
                    {voters.length > 6 && (
                      <span className="text-[9px] text-candle-muted">+{voters.length - 6}</span>
                    )}
                    <span className="ml-auto text-[9px] text-candle-muted tabular-nums">
                      {count} vote{count === 1 ? "" : "s"}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="relative flex items-center gap-1.5 mt-2.5 pt-2 border-t border-border/40">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
          <p className="text-[10px] text-candle-muted tracking-wide">
            {total} vote{total === 1 ? "" : "s"} · tap to {myVote ? "change" : "cast"}
          </p>
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
        </div>
      </div>
    </div>
  );
}
