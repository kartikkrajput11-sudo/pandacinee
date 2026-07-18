import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isPollMeta, type PollMeta } from "@/lib/poll";
import { sfxPollVote } from "@/lib/sfx";
import { Check, Crown, Sparkles } from "lucide-react";
import { AvatarImg } from "@/components/AvatarImg";


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
      <div className="relative rounded-2xl border border-border/70 bg-card/80 backdrop-blur-sm p-3 shadow-sm overflow-hidden">
        <div className="pointer-events-none absolute -top-8 -right-8 size-24 rounded-full bg-primary/5 blur-2xl" />

        <div className="relative flex items-center gap-1.5 mb-2.5">
          <Sparkles className="size-3 text-muted-foreground" />
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-medium">Poll</span>
          <div className="flex-1 h-px bg-gradient-to-r from-border to-transparent" />
        </div>

        <p className="relative font-serif text-[13px] leading-snug text-foreground mb-3">
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
                    ? "border-primary/60 bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary)/0.2)]"
                    : "border-border/60 bg-background/40 hover:border-border hover:bg-background/70"
                } ${pulsing ? "animate-[poll-pulse_0.6s_ease-out]" : ""}`}
              >
                <div
                  className={`absolute inset-y-0 left-0 transition-all duration-700 ease-out ${
                    mine ? "bg-primary/15" : "bg-muted/60"
                  }`}
                  style={{ width: `${pct}%` }}
                />
                {leading && (
                  <div className="pointer-events-none absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${pct}%` }}>
                    <div className="absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-foreground/10 to-transparent animate-[poll-shimmer_2.4s_linear_infinite]" />
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
                  <span className="flex-1 text-[12px] text-foreground truncate font-medium">
                    {poll.kind === "emoji" ? "" : o.label}
                  </span>
                  {leading && total > 0 && (
                    <Crown className="size-3.5 text-muted-foreground" />
                  )}
                  {mine && (
                    <span className="flex items-center justify-center size-4 rounded-full bg-primary text-[10px] text-primary-foreground">
                      <Check className="size-2.5" strokeWidth={3} />
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums font-mono">
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
                            className="size-4 rounded-full object-cover ring-[1.5px] ring-card"
                          />
                        ) : (
                          <div
                            key={uid}
                            className="size-4 rounded-full bg-muted ring-[1.5px] ring-card flex items-center justify-center text-[8px] text-foreground font-semibold"
                            title={p?.display_name ?? "Panda"}
                          >
                            {initial}
                          </div>
                        );
                      })}
                    </div>
                    {voters.length > 6 && (
                      <span className="text-[9px] text-muted-foreground">+{voters.length - 6}</span>
                    )}
                    <span className="ml-auto text-[9px] text-muted-foreground tabular-nums">
                      {count} vote{count === 1 ? "" : "s"}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="relative flex items-center gap-1.5 mt-2.5 pt-2 border-t border-border/50">
          <p className="text-[10px] text-muted-foreground tracking-wide mx-auto">
            {total} vote{total === 1 ? "" : "s"} · tap to {myVote ? "change" : "cast"}
          </p>
        </div>
      </div>
    </div>
  );
}
