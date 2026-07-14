import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as unknown as {
  from: (t: string) => any;
  channel: (n: string) => any;
  removeChannel: (c: any) => void;
  storage: typeof supabase.storage;
};

export type VerificationKind = "text" | "image" | "video" | "voice" | "card" | "drawing";

export type VerificationMessage = {
  id: string;
  lock_id: string;
  sender_id: string;
  kind: VerificationKind;
  content: string | null;
  media_url: string | null;
  media_meta: Record<string, unknown> | null;
  submission: boolean;
  approved: boolean | null;
  feedback: string | null;
  created_at: string;
};

export function usePunishmentVerification(lockId: string | null, meId: string | null) {
  const [messages, setMessages] = useState<VerificationMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const chRef = useRef<any>(null);

  useEffect(() => {
    if (!lockId || !meId) {
      setMessages([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    (async () => {
      const { data } = await db
        .from("punishment_verification_messages")
        .select("*")
        .eq("lock_id", lockId)
        .order("created_at", { ascending: true });
      if (!cancelled) {
        setMessages((data ?? []) as VerificationMessage[]);
        setLoading(false);
      }
    })();

    const ch = db.channel(`pvm:${lockId}:${crypto.randomUUID()}`);
    ch.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "punishment_verification_messages", filter: `lock_id=eq.${lockId}` },
      (payload: any) => {
        if (payload.eventType === "INSERT") {
          setMessages((prev) => (prev.find((m) => m.id === payload.new.id) ? prev : [...prev, payload.new as VerificationMessage]));
        } else if (payload.eventType === "UPDATE") {
          setMessages((prev) => prev.map((m) => (m.id === payload.new.id ? (payload.new as VerificationMessage) : m)));
        } else if (payload.eventType === "DELETE") {
          setMessages((prev) => prev.filter((m) => m.id !== (payload.old as any).id));
        }
      },
    );
    ch.subscribe();
    chRef.current = ch;

    return () => {
      cancelled = true;
      db.removeChannel(ch);
      chRef.current = null;
    };
  }, [lockId, meId]);

  const sendMessage = useCallback(
    async (input: {
      kind: VerificationKind;
      content?: string | null;
      media_url?: string | null;
      media_meta?: Record<string, unknown> | null;
      submission?: boolean;
    }) => {
      if (!lockId || !meId) return;
      const { error } = await db.from("punishment_verification_messages").insert({
        lock_id: lockId,
        sender_id: meId,
        kind: input.kind,
        content: input.content ?? null,
        media_url: input.media_url ?? null,
        media_meta: input.media_meta ?? null,
        submission: !!input.submission,
      });
      if (error) throw error;
    },
    [lockId, meId],
  );

  const reviewMessage = useCallback(
    async (messageId: string, approved: boolean, feedback?: string | null) => {
      const { error } = await db
        .from("punishment_verification_messages")
        .update({ approved, feedback: feedback ?? null })
        .eq("id", messageId);
      if (error) throw error;
    },
    [],
  );

  return { messages, loading, sendMessage, reviewMessage };
}

/**
 * Permanently wipe a punishment lock and its verification chat, including
 * uploaded media in the chat-media storage bucket. Called on approval
 * (or cancel) so nothing persists on server or clients.
 */
export async function wipePunishment(lockId: string) {
  // 1. Collect all media paths
  const { data: rows } = await db
    .from("punishment_verification_messages")
    .select("id, media_url")
    .eq("lock_id", lockId);
  const paths = ((rows ?? []) as { media_url: string | null }[])
    .map((r) => r.media_url)
    .filter((p): p is string => !!p);

  // 2. Remove storage files (best effort)
  if (paths.length > 0) {
    try {
      await supabase.storage.from("chat-media").remove(paths);
    } catch {
      /* ignore */
    }
  }

  // 3. Delete lock — cascade removes verification messages
  await db.from("punishment_locks").delete().eq("id", lockId);
}
