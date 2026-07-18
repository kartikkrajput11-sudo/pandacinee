import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Send, Swords, Eye, Play, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useGroupMatch, joinGroupMatch, DUEL_GAMES } from "@/hooks/useGroupMatch";
import { UserAvatar } from "@/components/UserAvatar";

export const Route = createFileRoute("/_authenticated/app/group-match/$matchId")({
  component: GroupMatchLobby,
});

type Profile = { id: string; display_name: string; avatar_url: string | null };

function GroupMatchLobby() {
  const { matchId } = Route.useParams();
  const navigate = useNavigate();
  const { data: pd } = useProfile();
  const meId = pd?.profile?.id ?? null;
  const m = useGroupMatch(matchId, meId);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [tab, setTab] = useState<"players" | "observers">("players");

  // Load participant profiles.
  useEffect(() => {
    const ids = m.participants.map((p) => p.user_id);
    if (ids.length === 0) return;
    supabase.from("profiles").select("id,display_name,avatar_url").in("id", ids).then(({ data }) => {
      const map: Record<string, Profile> = {};
      for (const p of (data ?? []) as Profile[]) map[p.id] = p;
      setProfiles(map);
    });
  }, [m.participants]);

  const gameDef = DUEL_GAMES.find((g) => g.id === m.match?.game);
  const iAmParticipant = m.myRole !== null;

  // Auto-join anyone opening the lobby who isn't seated.
  useEffect(() => {
    if (!m.match || !meId || iAmParticipant || m.loading) return;
    joinGroupMatch(matchId).catch(() => {});
  }, [m.match, m.loading, meId, iAmParticipant, matchId]);

  const seatsFilled = m.players.length >= (m.match?.max_players ?? 2);
  const canLaunchToGame = iAmParticipant && seatsFilled && gameDef;

  function launch() {
    if (!gameDef) return;
    navigate({ to: gameDef.href, search: { matchId } as never });
  }

  if (m.loading || !m.match) {
    return <div className="p-8 text-center text-candle-muted">Loading lobby…</div>;
  }

  return (
    <div className="min-h-[100dvh] velvet-bg text-candle flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-surface/50 backdrop-blur">
        <Link to="/app/chat/group/$groupId" params={{ groupId: m.match.group_id }} className="text-candle-muted">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-[0.25em] text-petal flex items-center gap-1">
            <Swords className="size-3" /> Group duel
          </p>
          <p className="font-serif italic text-lg truncate">
            {gameDef ? `${gameDef.emoji} ${gameDef.name}` : m.match.game}
          </p>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-petal-soft border border-petal/30 text-petal">
          {m.myRole === "player" ? "You are seated" : m.myRole === "observer" ? "Observer" : "…"}
        </span>
      </header>

      {/* Seats */}
      <div className="px-4 py-5 grid grid-cols-2 gap-3">
        {[0, 1].map((idx) => {
          const p = m.players[idx];
          const prof = p ? profiles[p.user_id] : null;
          return (
            <div key={idx} className={`rounded-3xl p-4 border ${p ? "border-petal/40 bg-petal-soft/20" : "border-dashed border-border bg-surface/50"} flex flex-col items-center gap-2 min-h-[130px] justify-center`}>
              <p className="text-[10px] uppercase tracking-[0.25em] text-petal">Seat {idx + 1}</p>
              {p ? (
                <>
                  <UserAvatar src={prof?.avatar_url ?? undefined} name={prof?.display_name} className="size-14" />
                  <p className="text-sm font-medium text-candle truncate max-w-full">
                    {prof?.display_name ?? "…"}{p.user_id === meId && " (you)"}
                  </p>
                </>
              ) : (
                <p className="text-xs italic text-candle-muted">Waiting…</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Observers row */}
      {m.observers.length > 0 && (
        <div className="px-4 pb-3 flex items-center gap-2 overflow-x-auto">
          <Eye className="size-3.5 text-candle-muted shrink-0" />
          <span className="text-[10px] uppercase tracking-widest text-candle-muted shrink-0">Observers ·</span>
          {m.observers.map((o) => {
            const prof = profiles[o.user_id];
            return (
              <div key={o.user_id} className="flex items-center gap-1 shrink-0">
                <UserAvatar src={prof?.avatar_url ?? undefined} name={prof?.display_name} className="size-6" />
                <span className="text-[11px] text-candle-muted">{prof?.display_name ?? "…"}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Launch */}
      <div className="px-4 pb-3">
        <button
          onClick={launch}
          disabled={!canLaunchToGame}
          className="w-full py-3 rounded-full bg-petal text-velvet font-semibold text-sm petal-glow disabled:opacity-40 flex items-center justify-center gap-2"
        >
          <Play className="size-4" />
          {m.myRole === "player"
            ? seatsFilled ? "Enter the arena" : "Waiting for opponent…"
            : "Watch as observer"}
        </button>
        {m.myRole === "observer" && seatsFilled && (
          <button
            onClick={launch}
            className="w-full mt-2 py-2 rounded-full bg-surface border border-border text-candle-muted text-xs"
          >
            Open the arena view →
          </button>
        )}
      </div>

      {/* Chat tabs */}
      <div className="flex-1 flex flex-col min-h-0 border-t border-border">
        <div className="flex bg-surface/40">
          {m.myRole === "observer" && (
            <TabBtn active={tab === "observers"} onClick={() => setTab("observers")}>
              <Eye className="size-3" /> Observer chat
            </TabBtn>
          )}
          <TabBtn active={tab === "players"} onClick={() => setTab("players")}>
            <MessageCircle className="size-3" /> Players' chat {m.myRole === "observer" && "(watching)"}
          </TabBtn>
        </div>

        {tab === "observers" && m.myRole === "observer" ? (
          <ChatPane
            title="Observer chat"
            note="Only observers see this. Whisper about their moves 🐼"
            messages={m.observerMessages}
            profiles={profiles}
            meId={meId}
            onSend={(t) => m.sendObserver(t)}
          />
        ) : (
          <ChatPane
            title="Players' chat"
            note={m.myRole === "player" ? "Say something to your opponent." : "Read-only. You're watching the duel banter."}
            messages={m.playerMessages}
            profiles={profiles}
            meId={meId}
            onSend={m.myRole === "player" ? (t) => m.sendPlayer(t) : null}
          />
        )}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2 text-xs flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
        active ? "border-petal text-candle font-medium" : "border-transparent text-candle-muted"
      }`}
    >
      {children}
    </button>
  );
}

function ChatPane({
  title, note, messages, profiles, meId, onSend,
}: {
  title: string;
  note: string;
  messages: { id: string; sender_id: string; content: string; created_at: string }[];
  profiles: Record<string, Profile>;
  meId: string | null;
  onSend: ((t: string) => Promise<void> | void) | null;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const nodes = useMemo(() => messages, [messages]);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [nodes.length]);

  async function send() {
    if (!onSend || !text.trim() || sending) return;
    setSending(true);
    try { await onSend(text.trim()); setText(""); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't send"); }
    finally { setSending(false); }
  }

  return (
    <>
      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        <p className="text-[11px] italic text-candle-muted text-center">{note}</p>
        {nodes.map((msg) => {
          const mine = msg.sender_id === meId;
          const prof = profiles[msg.sender_id];
          return (
            <div key={msg.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
              {!mine && <UserAvatar src={prof?.avatar_url ?? undefined} name={prof?.display_name} className="size-7" />}
              <div className={`max-w-[75%] px-3 py-1.5 rounded-2xl text-sm ${mine ? "bg-petal text-velvet rounded-br-sm" : "bg-surface border border-border rounded-bl-sm"}`}>
                {!mine && <p className="text-[10px] mb-0.5 text-petal">{prof?.display_name ?? "…"}</p>}
                <span className="break-words">{msg.content}</span>
              </div>
            </div>
          );
        })}
      </div>
      {onSend ? (
        <div className="flex gap-2 px-3 py-3 border-t border-border bg-surface/50">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void send(); } }}
            placeholder={`Message ${title.toLowerCase()}…`}
            className="flex-1 px-3 py-2 rounded-full bg-surface border border-border text-sm text-candle"
          />
          <button onClick={send} disabled={!text.trim() || sending} className="size-10 rounded-full bg-petal text-velvet flex items-center justify-center disabled:opacity-50">
            <Send className="size-4" />
          </button>
        </div>
      ) : (
        <div className="px-3 py-3 text-[11px] italic text-center text-candle-muted border-t border-border bg-surface/50">
          Read-only — observers watch the players talk.
        </div>
      )}
    </>
  );
}
