import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Copy, Users, Send, LogOut, Play, Pause, RefreshCw, MessageCircle, X, UserPlus, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  buildEmbedUrl,
  joinWatchPartyByCode,
  leaveWatchParty,
  publishPartyState,
  sendPartyMessage,
  type WatchParty,
  type WatchPartyMessage,
} from "@/lib/watchParty";
import { useProfile } from "@/hooks/useProfile";
import { useFriendships } from "@/hooks/useFriends";

export const Route = createFileRoute("/_authenticated/app/watch-party/$code")({
  component: WatchPartyRoom,
});

type MemberProfile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

function WatchPartyRoom() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const { data: prof } = useProfile();
  const me = prof?.profile;
  const [party, setParty] = useState<WatchParty | null>(null);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [messages, setMessages] = useState<WatchPartyMessage[]>([]);
  const [chatOpen, setChatOpen] = useState(true);
  const [draft, setDraft] = useState("");
  const [iframeKey, setIframeKey] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Join / load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const p = await joinWatchPartyByCode(code);
        if (cancelled) return;
        setParty(p);
      } catch (e: any) {
        toast.error(e?.message ?? "Could not join party");
        navigate({ to: "/app/watch-party" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, navigate]);

  const partyId = party?.id ?? null;

  // Subscribe to party state changes
  useEffect(() => {
    if (!partyId) return;
    const channel = supabase
      .channel(`wp:${partyId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "watch_parties", filter: `id=eq.${partyId}` },
        (payload) => {
          const next = payload.new as WatchParty;
          setParty((prev) => {
            // Reload iframe when episode / source changes.
            if (
              prev &&
              (prev.source_idx !== next.source_idx ||
                prev.season !== next.season ||
                prev.episode !== next.episode ||
                prev.media_id !== next.media_id)
            ) {
              setIframeKey((k) => k + 1);
            }
            return next;
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "watch_party_messages", filter: `party_id=eq.${partyId}` },
        (payload) => {
          setMessages((m) => [...m, payload.new as WatchPartyMessage]);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "watch_party_members", filter: `party_id=eq.${partyId}` },
        () => refreshMembers(partyId),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [partyId]);

  // Initial members + messages
  useEffect(() => {
    if (!partyId) return;
    refreshMembers(partyId);
    (async () => {
      const { data } = await supabase
        .from("watch_party_messages")
        .select("*")
        .eq("party_id", partyId)
        .order("created_at", { ascending: true })
        .limit(200);
      setMessages((data ?? []) as WatchPartyMessage[]);
    })();
  }, [partyId]);

  async function refreshMembers(pid: string) {
    const { data: mem } = await supabase
      .from("watch_party_members")
      .select("user_id")
      .eq("party_id", pid);
    const ids = (mem ?? []).map((m) => m.user_id);
    if (ids.length === 0) {
      setMembers([]);
      return;
    }
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", ids);
    setMembers((profs ?? []) as MemberProfile[]);
  }

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  // Leave on unmount (best effort)
  useEffect(() => {
    return () => {
      if (partyId) void leaveWatchParty(partyId);
    };
  }, [partyId]);

  const isHost = !!(me && party && me.id === party.host_id);

  const embedUrl = useMemo(() => {
    if (!party) return "";
    return buildEmbedUrl({
      media_kind: party.media_kind,
      media_id: party.media_id,
      season: party.season,
      episode: party.episode,
      position_seconds: party.position_seconds,
    });
  }, [party]);

  async function handleSend() {
    if (!partyId) return;
    const text = draft;
    setDraft("");
    try {
      await sendPartyMessage(partyId, text);
    } catch (e: any) {
      toast.error(e?.message ?? "Send failed");
      setDraft(text);
    }
  }

  async function handleResync() {
    if (!partyId) return;
    setIframeKey((k) => k + 1);
    toast.success("Reloaded to sync");
  }

  async function handleTogglePlay() {
    if (!partyId || !party) return;
    await publishPartyState(partyId, {
      is_playing: !party.is_playing,
      last_event: party.is_playing ? "pause" : "play",
    });
  }

  async function handleLeave() {
    if (partyId) await leaveWatchParty(partyId);
    navigate({ to: "/app/watch-party" });
  }

  function copyInvite() {
    if (!party) return;
    const url = `${window.location.origin}/app/watch-party/${party.code}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success("Invite link copied"),
      () => {
        navigator.clipboard.writeText(party.code);
        toast.success("Code copied");
      },
    );
  }

  if (loading || !party) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <p className="text-candle-muted">Joining party…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-canvas/95 backdrop-blur border-b border-border">
        <div className="px-4 py-2 flex items-center gap-2">
          <button
            onClick={handleLeave}
            className="p-2 -ml-2 rounded-full hover:bg-surface transition-colors"
            aria-label="Leave"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-serif italic text-base leading-tight truncate">
              {party.media_title ?? "Watch Party"}
              {party.media_kind === "tv" && party.season != null && (
                <span className="text-candle-muted text-sm"> · S{party.season} E{party.episode}</span>
              )}
            </p>
            <p className="text-[11px] text-candle-muted font-mono tracking-widest">{party.code}</p>
          </div>
          <button
            onClick={copyInvite}
            className="p-2 rounded-full hover:bg-surface transition-colors"
            aria-label="Copy invite"
          >
            <Copy className="size-4" />
          </button>
          <button
            onClick={() => setChatOpen((v) => !v)}
            className="p-2 rounded-full hover:bg-surface transition-colors md:hidden"
            aria-label="Toggle chat"
          >
            {chatOpen ? <X className="size-4" /> : <MessageCircle className="size-4" />}
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex flex-col md:flex-row md:max-w-7xl md:mx-auto md:w-full md:gap-3 md:p-3">
        {/* Player */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="relative w-full aspect-video bg-black md:rounded-2xl overflow-hidden">
            <iframe
              key={iframeKey}
              src={embedUrl}
              title="Watch party player"
              className="absolute inset-0 w-full h-full"
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="no-referrer"
            />
          </div>

          {/* Controls */}
          <div className="p-3 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface border border-border">
              <span className="size-2 rounded-full bg-petal animate-pulse" />
              <Users className="size-3.5 text-candle-muted" />
              <span className="text-xs">{members.length} watching</span>
            </div>
            {isHost && (
              <button
                onClick={handleTogglePlay}
                className="px-3 py-1.5 rounded-full bg-petal text-white text-xs font-medium flex items-center gap-1.5"
              >
                {party.is_playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                {party.is_playing ? "Broadcast pause" : "Broadcast play"}
              </button>
            )}
            <button
              onClick={handleResync}
              className="px-3 py-1.5 rounded-full bg-surface border border-border text-xs flex items-center gap-1.5 hover:border-petal/40 transition-colors"
            >
              <RefreshCw className="size-3.5" /> Resync
            </button>
            <button
              onClick={handleLeave}
              className="ml-auto px-3 py-1.5 rounded-full bg-surface border border-border text-xs text-candle-muted flex items-center gap-1.5"
            >
              <LogOut className="size-3.5" /> Leave
            </button>
          </div>

          <p className="px-3 pb-3 text-[11px] text-candle-muted leading-relaxed">
            Third-party player can't be script-controlled, so playback timing is a soft sync — tap
            <span className="font-medium"> Resync </span>if you fall behind. Chat, source, and episode changes are always live.
          </p>
        </div>

        {/* Chat */}
        {chatOpen && (
          <aside className="md:w-80 md:flex-shrink-0 bg-surface border-t md:border md:border-border md:rounded-2xl flex flex-col max-h-[60vh] md:max-h-[calc(100vh-6rem)]">
            <div className="px-4 py-2 border-b border-border flex items-center justify-between">
              <p className="text-xs uppercase tracking-widest text-candle-muted">Chat</p>
              <div className="flex -space-x-2">
                {members.slice(0, 4).map((m) =>
                  m.avatar_url ? (
                    <img
                      key={m.id}
                      src={m.avatar_url}
                      alt=""
                      className="size-6 rounded-full border-2 border-surface object-cover"
                    />
                  ) : (
                    <div
                      key={m.id}
                      className="size-6 rounded-full border-2 border-surface bg-petal-soft text-petal text-[10px] flex items-center justify-center"
                    >
                      {(m.display_name ?? m.username ?? "?").slice(0, 1).toUpperCase()}
                    </div>
                  ),
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {messages.length === 0 && (
                <p className="text-center text-xs text-candle-muted py-8">Say hi 👋</p>
              )}
              {messages.map((m) => {
                const author = members.find((u) => u.id === m.sender_id);
                const mine = m.sender_id === me?.id;
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[80%] px-3 py-1.5 rounded-2xl text-sm ${
                        mine ? "bg-petal text-white" : "bg-canvas border border-border"
                      }`}
                    >
                      {!mine && (
                        <p className="text-[10px] opacity-70 mb-0.5">
                          {author?.display_name ?? author?.username ?? "Someone"}
                        </p>
                      )}
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSend();
              }}
              className="p-2 border-t border-border flex gap-2"
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Message…"
                maxLength={2000}
                className="flex-1 bg-canvas rounded-full border border-border px-4 py-2 text-sm outline-none focus:border-petal/60"
              />
              <button
                type="submit"
                disabled={!draft.trim()}
                className="size-9 rounded-full bg-petal text-white flex items-center justify-center disabled:opacity-50"
                aria-label="Send"
              >
                <Send className="size-4" />
              </button>
            </form>
          </aside>
        )}
      </div>
    </div>
  );
}
