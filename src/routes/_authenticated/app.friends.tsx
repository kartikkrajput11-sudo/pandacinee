import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Search, UserPlus, Check, X, Video, Phone, Gamepad2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useFriendships, useFriendActions, FriendProfile } from "@/hooks/useFriends";
import { useProfile } from "@/hooks/useProfile";
import { AvatarImg } from "@/components/AvatarImg";
import { GameInvitePicker, type GamePick } from "@/components/chat/GameInvitePicker";


export const Route = createFileRoute("/_authenticated/app/friends")({
  component: Friends,
});

function Friends() {
  const { data, isLoading } = useFriendships();
  const { request, accept, remove } = useFriendActions();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<FriendProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      const { data, error } = await supabase.rpc("search_profiles", { _q: q.trim() });
      setSearching(false);
      if (!error) setResults((data ?? []) as FriendProfile[]);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const { data: profileData } = useProfile();
  const partnerId = profileData?.profile?.partner_id ?? null;

  const me = data?.me;
  const friendships = data?.friendships ?? [];
  const profiles = data?.profiles ?? {};

  const relatedIdOf = (f: typeof friendships[number]) =>
    f.requester_id === me ? f.addressee_id : f.requester_id;

  // Only count/show friends whose profile still exists (skip deleted accounts) and exclude partner
  const accepted = friendships.filter(
    (f) =>
      f.status === "accepted" &&
      relatedIdOf(f) !== partnerId &&
      !!profiles[relatedIdOf(f)]
  );
  const incoming = friendships.filter((f) => f.status === "pending" && f.addressee_id === me);
  const outgoing = friendships.filter((f) => f.status === "pending" && f.requester_id === me);

  function relatedId(f: typeof friendships[number]) {
    return f.requester_id === me ? f.addressee_id : f.requester_id;
  }

  async function startCall(peerId: string, mode: "video" | "audio") {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const kind = mode === "audio" ? "voice" : "video";
    const { startDirectCall } = await import("@/lib/callActions");
    try {
      const call = await startDirectCall(peerId, kind);
      navigate({
        to: "/app/call/$peerId",
        params: { peerId },
        search: { role: "caller", mode: kind, callId: call.id },
      });
    } catch (e) {
      console.warn("startCall failed", e);
    }
  }

  const [invitePeer, setInvitePeer] = useState<FriendProfile | null>(null);

  async function sendGameInvite(peer: FriendProfile, g: GamePick) {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("messages").insert({
      sender_id: u.user.id,
      receiver_id: peer.id,
      content: g.name,
      type: "game_invite",
      media_meta: { game_id: g.id, emoji: g.emoji, body: g.body, href: g.href } as never,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setInvitePeer(null);
    toast.success(`Invite sent to @${peer.username}`);
    navigate({ to: g.href });
  }


  return (
    <div className="pt-10 px-5">
      <header className="flex items-center gap-3 mb-6">
        <Link to="/app" className="text-candle-muted">
          <ArrowLeft className="size-5" />
        </Link>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-petal">Your circle</p>
          <h1 className="font-serif text-2xl italic">Friends</h1>
        </div>
      </header>

      <div className="relative mb-5">
        <Search className="size-4 text-candle-muted absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by username or name"
          className="w-full bg-surface border border-border rounded-2xl pl-11 pr-4 py-3 text-sm text-candle"
        />
      </div>

      {results.length > 0 && (
        <section className="mb-6">
          <h3 className="text-[10px] uppercase tracking-widest text-candle-muted mb-2">Results</h3>
          <div className="space-y-2">
            {results.map((p) => {
              const existing = friendships.find((f) => relatedId(f) === p.id);
              return (
                <Row key={p.id} profile={p}>
                  {existing?.status === "pending" && existing.addressee_id === me ? (
                    <>
                      <button
                        onClick={() =>
                          accept.mutate(existing.id, {
                            onSuccess: () => toast.success("Request accepted"),
                            onError: (e: any) => toast.error(e.message),
                          })
                        }
                        className="size-9 rounded-full bg-petal text-velvet flex items-center justify-center"
                        aria-label="Accept"
                      >
                        <Check className="size-4" />
                      </button>
                      <button
                        onClick={() =>
                          remove.mutate(existing.id, {
                            onSuccess: () => toast.success("Request declined"),
                            onError: (e: any) => toast.error(e.message),
                          })
                        }
                        className="size-9 rounded-full bg-velvet border border-border text-candle-muted flex items-center justify-center"
                        aria-label="Decline"
                      >
                        <X className="size-4" />
                      </button>
                    </>
                  ) : existing ? (
                    <span className="text-[10px] uppercase tracking-widest text-candle-muted px-3 py-2">
                      {existing.status === "pending" ? "Requested" : existing.status}
                    </span>
                  ) : (
                    <button
                      onClick={() =>
                        request.mutate(p.id, {
                          onSuccess: () => toast.success("Request sent"),
                          onError: (e: any) => toast.error(e.message),
                        })
                      }
                      className="size-9 rounded-full bg-petal text-velvet flex items-center justify-center"
                      aria-label="Add friend"
                    >
                      <UserPlus className="size-4" />
                    </button>
                  )}
                </Row>
              );
            })}
          </div>
        </section>
      )}

      {q && !searching && results.length === 0 && (
        <p className="text-sm text-candle-muted mb-6">No pandas found.</p>
      )}

      {incoming.length > 0 && (
        <section className="mb-6">
          <h3 className="text-[10px] uppercase tracking-widest text-candle-muted mb-2">Requests</h3>
          <div className="space-y-2">
            {incoming.map((f) => {
              const p = profiles[relatedId(f)];
              if (!p) return null;
              return (
                <Row key={f.id} profile={p}>
                  <button
                    onClick={() =>
                      accept.mutate(f.id, {
                        onSuccess: () => toast.success("Request accepted"),
                        onError: (e: any) => toast.error(e.message),
                      })
                    }
                    className="size-9 rounded-full bg-petal text-velvet flex items-center justify-center"
                    aria-label="Accept"
                  >
                    <Check className="size-4" />
                  </button>
                  <button
                    onClick={() =>
                      remove.mutate(f.id, {
                        onSuccess: () => toast.success("Request declined"),
                        onError: (e: any) => toast.error(e.message),
                      })
                    }
                    className="size-9 rounded-full bg-velvet border border-border text-candle-muted flex items-center justify-center"
                    aria-label="Decline"
                  >
                    <X className="size-4" />
                  </button>
                </Row>
              );
            })}
          </div>
        </section>
      )}

      <section className="mb-6">
        <h3 className="text-[10px] uppercase tracking-widest text-candle-muted mb-2">
          Friends · {accepted.length}
        </h3>
        {isLoading ? (
          <p className="text-sm text-candle-muted">Loading…</p>
        ) : accepted.length === 0 ? (
          <p className="text-sm text-candle-muted">No friends yet — search above to add one.</p>
        ) : (
          <div className="space-y-2">
            {accepted.map((f) => {
              const p = profiles[relatedId(f)];
              if (!p) return null;
              return (
                <Row key={f.id} profile={p}>
                  <button
                    onClick={() => setInvitePeer(p)}
                    className="size-9 rounded-full bg-velvet border border-border text-candle hover:text-petal flex items-center justify-center"
                    aria-label="Invite to play"
                    title="Invite to play"
                  >
                    <Gamepad2 className="size-4" />
                  </button>
                  <Link
                    to="/app/chat/$peerId"
                    params={{ peerId: p.id }}
                    className="hidden sm:inline-flex px-3 h-9 items-center rounded-full bg-velvet border border-border text-[10px] uppercase tracking-widest text-candle-muted hover:text-petal"
                  >
                    Chat
                  </Link>
                  <button
                    onClick={() => startCall(p.id, "audio")}
                    className="size-9 rounded-full bg-velvet border border-border text-candle hover:text-petal flex items-center justify-center"
                    aria-label="Voice call"
                  >
                    <Phone className="size-4" />
                  </button>
                  <button
                    onClick={() => startCall(p.id, "video")}
                    className="size-9 rounded-full bg-petal text-velvet flex items-center justify-center"
                    aria-label="Video call"
                  >
                    <Video className="size-4" />
                  </button>
                </Row>
              );

            })}
          </div>
        )}
      </section>

      {outgoing.length > 0 && (
        <section className="mb-6">
          <h3 className="text-[10px] uppercase tracking-widest text-candle-muted mb-2">Pending</h3>
          <div className="space-y-2">
            {outgoing.map((f) => {
              const p = profiles[relatedId(f)];
              if (!p) return null;
              return (
                <Row key={f.id} profile={p}>
                  <button
                    onClick={() => remove.mutate(f.id)}
                    className="px-3 py-2 text-[10px] uppercase tracking-widest text-candle-muted hover:text-petal"
                  >
                    Cancel
                  </button>
                </Row>
              );
            })}
          </div>
        </section>
      )}

      <GameInvitePicker
        open={!!invitePeer}
        onClose={() => setInvitePeer(null)}
        onPick={(g) => invitePeer && sendGameInvite(invitePeer, g)}
      />
    </div>
  );
}


function Row({ profile, children }: { profile: FriendProfile; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-surface border border-border rounded-2xl">
      <div className="size-10 rounded-full bg-petal-soft border border-petal/20 flex items-center justify-center overflow-hidden">
        {profile.avatar_url ? (
          <AvatarImg src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="font-serif italic text-petal">{profile.display_name?.[0]?.toUpperCase()}</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-serif italic text-base truncate">{profile.display_name}</p>
        <p className="text-xs text-candle-muted truncate">@{profile.username}</p>
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}
