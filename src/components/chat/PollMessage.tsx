import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isPollMeta, type PollMeta } from "@/lib/poll";
import { sfxPollVote } from "@/lib/sfx";
import { Check } from "lucide-react";

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

  if (!poll) return <span className="italic text-candle-muted text-sm">Broken poll</span>;

  async function vote(optionId: string) {
    if (!meId || busy) return;
    setBusy(true);
    try {
      // single-choice: remove any existing vote for this message by me
      await supabase.from("poll_votes").delete().eq("message_id", messageId).eq("user_id", meId);
      if (optionId !== myVote) {
        const { error } = await supabase
          .from("poll_votes")
          .insert({ message_id: messageId, user_id: meId, option_id: optionId });
        if (!error) sfxPollVote();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-w-[240px] max-w-[300px]">
      <p className="font-serif italic text-sm mb-2">{poll.question}</p>
      <div className="space-y-1.5">
        {poll.options.map((o) => {
          const count = counts.get(o.id) ?? 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const mine = myVote === o.id;
          const poster = (o.meta?.poster_url as string | null | undefined) ?? null;
          const voters = votersByOption.get(o.id) ?? [];
          return (
            <button
              key={o.id}
              onClick={() => vote(o.id)}
              disabled={busy}
              className={`relative w-full text-left rounded-xl overflow-hidden border transition ${
                mine ? "border-petal/60 bg-petal-soft/40" : "border-border bg-velvet/60"
              }`}
            >
              <div
                className="absolute inset-y-0 left-0 bg-petal/25 transition-all"
                style={{ width: `${pct}%` }}
              />
              <div className="relative flex items-center gap-2 px-2.5 py-1.5">
                {poster && <img src={poster} alt="" className="size-8 rounded object-cover shrink-0" />}
                {poll.kind === "emoji" && <span className="text-xl">{o.label}</span>}
                <span className="flex-1 text-xs text-candle truncate">
                  {poll.kind === "emoji" ? (voters.length ? "" : "") : o.label}
                </span>
                {mine && <Check className="size-3.5 text-petal shrink-0" />}
                <span className="text-[11px] text-candle-muted shrink-0 tabular-nums">
                  {pct}% · {count}
                </span>
              </div>
              {voters.length > 0 && (
                <div className="relative flex -space-x-1 px-2.5 pb-1.5 pt-0">
                  {voters.slice(0, 5).map((uid) => {
                    const p = memberById.get(uid);
                    const initial = (p?.display_name ?? "?").charAt(0).toUpperCase();
                    return (
                      <div
                        key={uid}
                        className="size-4 rounded-full bg-petal-soft border border-surface flex items-center justify-center text-[8px] text-candle"
                        title={p?.display_name ?? "Panda"}
                      >
                        {initial}
                      </div>
                    );
                  })}
                  {voters.length > 5 && (
                    <span className="text-[9px] text-candle-muted pl-2">+{voters.length - 5}</span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
      <p className="text-[10px] text-candle-muted mt-1.5">
        {total} vote{total === 1 ? "" : "s"} · tap to {myVote ? "change / unvote" : "vote"}
      </p>
    </div>
  );
}
