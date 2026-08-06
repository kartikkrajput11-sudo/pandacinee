import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";

const db = supabase as unknown as {
  from: (t: string) => any;
  channel: (n: string) => any;
  removeChannel: (c: any) => void;
};

type ActiveLock = {
  id: string;
  locker_id: string;
  prompt: string;
  expires_at: string | null;
  status: string;
};

/**
 * Global punishment enforcement.
 *
 * A lock used to be escapable simply by navigating away from the chat.
 * This guard watches for any active lock placed on me anywhere in the app
 * and pulls me back into the locked conversation.
 */
export function PunishmentLockGuard() {
  const { data } = useProfile();
  const meId = data?.profile?.id ?? null;
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [lock, setLock] = useState<ActiveLock | null>(null);

  useEffect(() => {
    if (!meId) return;
    let cancelled = false;

    async function refresh() {
      const { data: rows } = await db
        .from("punishment_locks")
        .select("id, locker_id, prompt, expires_at, status")
        .eq("target_id", meId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1);
      if (cancelled) return;
      const row = (rows ?? [])[0] as ActiveLock | undefined;
      const live =
        row && (!row.expires_at || new Date(row.expires_at).getTime() > Date.now())
          ? row
          : null;
      setLock(live ?? null);
    }

    refresh();
    const poll = window.setInterval(refresh, 20000);
    const ch = db.channel(`lock-guard:${meId}`);
    ch.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "punishment_locks", filter: `target_id=eq.${meId}` },
      () => refresh(),
    );
    ch.subscribe();

    return () => {
      cancelled = true;
      window.clearInterval(poll);
      db.removeChannel(ch);
    };
  }, [meId]);

  const lockedChatPath = lock ? `/app/chat/${lock.locker_id}` : null;
  const onLockedChat = !!lockedChatPath && pathname.startsWith(lockedChatPath);

  // Auto-return: any navigation away from the locked chat snaps back.
  useEffect(() => {
    if (!lock || onLockedChat) return;
    const t = window.setTimeout(() => {
      navigate({ to: "/app/chat/$peerId", params: { peerId: lock.locker_id } });
    }, 1200);
    return () => window.clearTimeout(t);
  }, [lock?.id, onLockedChat, navigate]);

  if (!lock || onLockedChat) return null;

  return (
    <div className="fixed inset-0 z-[95] bg-velvet/92 backdrop-blur-xl flex items-center justify-center px-6 animate-fade-in">
      <div className="max-w-sm w-full text-center">
        <div className="mx-auto size-16 rounded-full bg-petal/15 border border-petal/40 flex items-center justify-center mb-5">
          <Lock className="size-7 text-petal" />
        </div>
        <p className="text-[10px] uppercase tracking-[0.3em] text-petal mb-2">Locked</p>
        <h2 className="font-serif italic text-2xl text-candle mb-2">
          Your chapter isn't finished
        </h2>
        <p className="text-sm text-candle-muted mb-6">"{lock.prompt}"</p>
        <button
          onClick={() =>
            navigate({ to: "/app/chat/$peerId", params: { peerId: lock.locker_id } })
          }
          className="w-full rounded-full bg-petal text-velvet font-semibold py-3"
        >
          Return to the challenge
        </button>
      </div>
    </div>
  );
}
