import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type SealedLetter = {
  id: string;
  title: string;
  sender_id: string;
  unlock_at: string;
};

/** Upcoming sealed letters, surfaced on the couple's calendar. */
export function SealedLettersCard({ meId }: { meId: string | null }) {
  const [rows, setRows] = useState<SealedLetter[]>([]);

  useEffect(() => {
    if (!meId) return;
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from("love_letters")
        .select("id, title, sender_id, unlock_at")
        .is("opened_at", null)
        .gt("unlock_at", new Date().toISOString())
        .order("unlock_at", { ascending: true })
        .limit(5);
      if (!cancelled) setRows((data ?? []) as SealedLetter[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [meId]);

  if (rows.length === 0) return null;

  return (
    <section className="rounded-3xl border border-petal/30 bg-surface-elevated/40 p-5 backdrop-blur-xl">
      <p className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-petal">
        <Lock className="size-3" /> Sealed letters
      </p>
      <ul className="divide-y divide-border/40">
        {rows.map((l) => {
          const when = new Date(l.unlock_at);
          const mine = l.sender_id === meId;
          const days = Math.max(
            0,
            Math.ceil((when.getTime() - Date.now()) / 86400000),
          );
          return (
            <li key={l.id}>
              <Link
                to="/app/letters/$id"
                params={{ id: l.id }}
                className="flex items-center gap-3 py-3"
              >
                <span className="text-lg">💌</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-serif italic text-candle">
                    {mine ? l.title || "Untitled" : "Sealed for you"}
                  </span>
                  <span className="block text-[11px] text-candle-muted">
                    Opens {when.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                </span>
                <span className="text-[11px] text-petal">
                  {days === 0 ? "today" : `${days}d`}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
