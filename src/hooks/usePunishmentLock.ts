import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { PunishmentLock, PunishmentType } from "@/lib/punishment";

// Cast helper — table types are regenerated after the migration runs.
const db = supabase as unknown as {
  from: (t: string) => any;
  channel: (n: string) => any;
  removeChannel: (c: any) => void;
};

export function usePunishmentLock(meId: string | null, peerId: string | null) {
  const [locks, setLocks] = useState<PunishmentLock[]>([]);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!meId || !peerId) return;
    let cancelled = false;

    (async () => {
      const { data } = await db
        .from("punishment_locks")
        .select("*")
        .or(
          `and(locker_id.eq.${meId},target_id.eq.${peerId}),and(locker_id.eq.${peerId},target_id.eq.${meId})`,
        )
        .order("created_at", { ascending: false })
        .limit(20);
      if (!cancelled && data) setLocks(data as PunishmentLock[]);
    })();

    const ch = db.channel(`punish:${[meId, peerId].sort().join(":")}`);
    const applyRow = (row: PunishmentLock) => {
      const involvesPair =
        (row.locker_id === meId && row.target_id === peerId) ||
        (row.locker_id === peerId && row.target_id === meId);
      if (!involvesPair) return;
      setLocks((prev) => {
        const rest = prev.filter((x) => x.id !== row.id);
        return [row, ...rest];
      });
    };
    ch.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "punishment_locks" },
      (payload: any) => {
        if (payload.eventType === "DELETE") {
          const old = payload.old as { id: string };
          setLocks((prev) => prev.filter((x) => x.id !== old.id));
        } else {
          applyRow(payload.new as PunishmentLock);
        }
      },
    );
    ch.subscribe();
    channelRef.current = ch;

    return () => {
      cancelled = true;
      db.removeChannel(ch);
      channelRef.current = null;
    };
  }, [meId, peerId]);

  const liveLocks = useMemo(() => {
    const now = Date.now();
    return locks.filter(
      (l) =>
        l.status === "active" &&
        (!l.expires_at || new Date(l.expires_at).getTime() > now),
    );
  }, [locks]);

  /** A lock the partner placed on me (I must complete it). */
  const lockOnMe = useMemo(
    () => liveLocks.find((l) => l.target_id === meId) ?? null,
    [liveLocks, meId],
  );
  /** A lock I placed on the partner (I supervise it). */
  const lockByMe = useMemo(
    () => liveLocks.find((l) => l.locker_id === meId) ?? null,
    [liveLocks, meId],
  );

  const activeLock = lockOnMe ?? lockByMe;

  useEffect(() => {
    if (!activeLock?.expires_at) return;
    // Only the locker writes the "expired" status so both clients don't race
    // to update the same row on timer tick.
    if (activeLock.locker_id !== meId) return;
    const remaining = new Date(activeLock.expires_at).getTime() - Date.now();
    if (remaining <= 0) {
      db.from("punishment_locks").update({ status: "expired" }).eq("id", activeLock.id).then(() => {});
      return;
    }
    const t = window.setTimeout(() => {
      db.from("punishment_locks").update({ status: "expired" }).eq("id", activeLock.id).then(() => {});
    }, remaining + 200);
    return () => window.clearTimeout(t);
  }, [activeLock?.id, activeLock?.expires_at, activeLock?.locker_id, meId]);

  const iAmLocked = !!activeLock && activeLock.target_id === meId;
  const iAmLocker = !!activeLock && activeLock.locker_id === meId;

  const createLock = useCallback(
    async (input: {
      type: PunishmentType;
      prompt: string;
      required_count: number;
      max_duration_seconds: number | null;
      /** Shared punishment — both partners take on the same challenge together. */
      shared?: boolean;
    }) => {
      if (!meId || !peerId) return;
      const expires_at = input.max_duration_seconds
        ? new Date(Date.now() + input.max_duration_seconds * 1000).toISOString()
        : null;
      const base = {
        type: input.type,
        prompt: input.prompt,
        required_count: input.required_count,
        max_duration_seconds: input.max_duration_seconds,
        expires_at,
        shared: !!input.shared,
      };
      const rows = input.shared
        ? [
            { ...base, locker_id: meId, target_id: peerId },
            // Mirror row: the partner locks me with the same challenge.
            { ...base, locker_id: peerId, target_id: meId },
          ]
        : [{ ...base, locker_id: meId, target_id: peerId }];
      const { error } = await db.from("punishment_locks").insert(rows);
      if (error) throw error;
    },
    [meId, peerId],
  );


  const incrementProgress = useCallback(
    async (lockId: string, current: number, next: number) => {
      const { data, error } = await db
        .from("punishment_locks")
        .update({ progress: next })
        .eq("id", lockId)
        .eq("progress", current)
        .select()
        .maybeSingle();
      if (error) throw error;
      return (data as PunishmentLock | null) ?? null;
    },
    [],
  );

  const completeLock = useCallback(async (lockId: string) => {
    await db
      .from("punishment_locks")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", lockId);
    window.setTimeout(() => {
      db.from("punishment_locks").delete().eq("id", lockId).then(() => {});
    }, 30000);
  }, []);

  const cancelLock = useCallback(async (lockId: string) => {
    await db.from("punishment_locks").update({ status: "cancelled" }).eq("id", lockId);
  }, []);

  return {
    activeLock,
    iAmLocked,
    iAmLocker,
    createLock,
    incrementProgress,
    completeLock,
    cancelLock,
  };
}
