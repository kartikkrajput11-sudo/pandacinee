import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Send, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";

export const Route = createFileRoute("/_authenticated/app/chat")({
  component: Chat,
});

type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
};

function Chat() {
  const { data, isLoading } = useProfile();
  const me = data?.profile;
  const partner = data?.partner;
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!me || !partner) return;
    let cancelled = false;
    (async () => {
      const { data: rows, error } = await supabase
        .from("messages")
        .select("*")
        .or(
          `and(sender_id.eq.${me.id},receiver_id.eq.${partner.id}),and(sender_id.eq.${partner.id},receiver_id.eq.${me.id})`,
        )
        .order("created_at", { ascending: true })
        .limit(200);
      if (!cancelled && !error && rows) setMessages(rows as Message[]);
    })();

    const channel = supabase
      .channel(`chat:${me.id}:${partner.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const m = payload.new as Message;
          if (
            (m.sender_id === me.id && m.receiver_id === partner.id) ||
            (m.sender_id === partner.id && m.receiver_id === me.id)
          ) {
            setMessages((prev) =>
              prev.some((x) => x.id === m.id) ? prev : [...prev, m],
            );
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [me?.id, partner?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!content || !me || !partner) return;
    setSending(true);
    setText("");
    const { error } = await supabase
      .from("messages")
      .insert({ sender_id: me.id, receiver_id: partner.id, content });
    if (error) {
      toast.error(error.message);
      setText(content);
    }
    setSending(false);
  }

  if (isLoading) return <ChatShell><div className="p-8 text-center text-candle-muted">Loading…</div></ChatShell>;

  if (!partner) {
    return (
      <ChatShell>
        <div className="px-6 py-16 text-center">
          <h2 className="font-serif text-2xl italic mb-2">No one to chat with yet</h2>
          <p className="text-sm text-candle-muted mb-6">Pair with your partner to start a private conversation.</p>
          <Link
            to="/app/invite"
            className="inline-block px-6 py-3 bg-petal text-velvet rounded-full font-semibold text-sm"
          >
            Invite partner
          </Link>
        </div>
      </ChatShell>
    );
  }

  return (
    <ChatShell partnerName={partner.display_name}>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {messages.length === 0 && (
          <div className="text-center py-12 text-sm text-candle-muted">
            <p className="font-serif italic text-lg text-candle mb-1">Say hi 🐼</p>
            <p>This is the start of your private cinema.</p>
          </div>
        )}
        {messages.map((m, i) => {
          const mine = m.sender_id === me?.id;
          const prev = messages[i - 1];
          const tight = prev && prev.sender_id === m.sender_id;
          return (
            <div
              key={m.id}
              className={`flex ${mine ? "justify-end" : "justify-start"} ${tight ? "mt-0.5" : "mt-2"}`}
            >
              <div
                className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  mine
                    ? "bg-petal text-velvet rounded-br-md"
                    : "bg-surface-elevated text-candle rounded-bl-md border border-border"
                }`}
              >
                {m.content}
              </div>
            </div>
          );
        })}
      </div>

      <form
        onSubmit={send}
        className="px-3 py-3 flex items-center gap-2 border-t border-border bg-velvet/80 backdrop-blur"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Message ${partner.display_name}…`}
          className="flex-1 px-4 py-3 bg-surface border border-border rounded-full text-sm text-candle placeholder:text-candle-muted focus:outline-none focus:border-petal/60"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="size-11 rounded-full bg-petal text-velvet flex items-center justify-center disabled:opacity-40 petal-glow"
        >
          <Send className="size-4" />
        </button>
      </form>
    </ChatShell>
  );
}

function ChatShell({ children, partnerName }: { children: React.ReactNode; partnerName?: string }) {
  return (
    <div className="flex flex-col h-[calc(100vh-7rem)]">
      <header className="px-5 pt-8 pb-4 flex items-center gap-3 border-b border-border">
        <Link to="/app" className="text-candle-muted">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-widest text-petal">Private chat</p>
          <h1 className="font-serif text-xl italic">{partnerName ?? "Just you, for now"}</h1>
        </div>
      </header>
      {children}
    </div>
  );
}
