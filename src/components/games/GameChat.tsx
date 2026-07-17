import { useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, X, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { sfxSend, sfxReceive } from "@/lib/sfx";

type Msg = { id: string; from: string; name: string; text: string; at: number };

type Props = {
  /** Stable key shared by both players (e.g. sorted user ids joined). */
  roomKey: string;
  me: { id: string; display_name?: string | null } | null | undefined;
  partnerName?: string | null;
  /** Optional label shown at top of the panel. */
  title?: string;
};

/**
 * Floating in-game chat. Ephemeral (no DB persist) — uses Supabase
 * realtime broadcast on a per-room channel. Sits fixed bottom-right so it
 * never overlaps the play surface.
 */
export function GameChat({ roomKey, me, partnerName, title = "Table talk" }: Props) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [unread, setUnread] = useState(0);
  const chRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const channelName = useMemo(() => `game-chat:${roomKey}`, [roomKey]);
  const myName = me?.display_name ?? "You";

  useEffect(() => {
    if (!me?.id || !roomKey) return;
    const ch = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });
    ch.on("broadcast", { event: "msg" }, (payload) => {
      const m = payload.payload as Msg;
      if (!m || m.from === me.id) return;
      setMsgs((s) => [...s.slice(-49), m]);
      sfxReceive();
      setUnread((u) => (open ? 0 : u + 1));
    }).subscribe();
    chRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
      chRef.current = null;
    };
  }, [channelName, me?.id, roomKey, open]);

  useEffect(() => {
    if (open) setUnread(0);
  }, [open]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, open]);

  function send() {
    const t = text.trim();
    if (!t || !me?.id || !chRef.current) return;
    const m: Msg = {
      id: crypto.randomUUID(),
      from: me.id,
      name: myName,
      text: t.slice(0, 400),
      at: Date.now(),
    };
    setMsgs((s) => [...s.slice(-49), m]);
    chRef.current.send({ type: "broadcast", event: "msg", payload: m });
    sfxSend();
    setText("");
  }

  if (!me?.id) return null;

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed right-4 bottom-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/70 text-champagne shadow-[0_15px_40px_-10px_rgba(0,0,0,0.6)] backdrop-blur-md hover:brightness-110"
          aria-label="Open game chat"
        >
          <MessageCircle className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white shadow">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      )}

      {open && (
        <div className="fixed right-4 bottom-4 z-40 w-[min(320px,calc(100vw-2rem))] rounded-2xl border border-white/10 bg-black/85 backdrop-blur-xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] animate-fade-in overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
            <div className="flex flex-col leading-tight">
              <span className="font-serif italic text-sm text-champagne">{title}</span>
              {partnerName && (
                <span className="text-[10px] uppercase tracking-[0.2em] text-white/40">
                  with {partnerName}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full p-1 text-white/60 hover:text-white hover:bg-white/10"
              aria-label="Close chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div
            ref={listRef}
            className="max-h-64 min-h-32 overflow-y-auto px-3 py-2 space-y-1.5"
          >
            {msgs.length === 0 && (
              <p className="text-center text-xs italic text-white/40 py-6">
                Say something velvet…
              </p>
            )}
            {msgs.map((m) => {
              const mine = m.from === me.id;
              return (
                <div
                  key={m.id}
                  className={`flex ${mine ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-1.5 text-sm break-words ${
                      mine
                        ? "bg-champagne/20 text-champagne border border-champagne/25"
                        : "bg-white/10 text-white/90 border border-white/10"
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              );
            })}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex items-center gap-2 border-t border-white/10 px-2 py-2"
          >
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Message…"
              maxLength={400}
              className="flex-1 rounded-full bg-white/5 border border-white/10 px-3 py-1.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-champagne/40"
            />
            <button
              type="submit"
              disabled={!text.trim()}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-champagne/25 text-champagne border border-champagne/30 disabled:opacity-40 hover:brightness-110"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
