import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, MessageCircle, Phone, Video, Heart, Ban, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, type Profile } from "@/hooks/useProfile";

export const Route = createFileRoute("/_authenticated/app/user/$userId")({
  component: UserProfilePage,
});

function UserProfilePage() {
  const { userId } = Route.useParams();
  const router = useRouter();
  const { data: myData } = useProfile();
  const me = myData?.profile;
  const partner = myData?.partner;
  const isPartner = partner?.id === userId;
  const isMe = me?.id === userId;

  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const { data: user, isLoading } = useQuery({
    enabled: !!userId,
    queryKey: ["user-profile", userId],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      return (data as Profile) ?? null;
    },
  });

  const { data: blockRow } = useQuery({
    enabled: !!me?.id && !!userId && me?.id !== userId,
    queryKey: ["user-block", me?.id, userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_blocks" as any)
        .select("id")
        .eq("blocker_id", me!.id)
        .eq("blocked_id", userId)
        .maybeSingle();
      return (data as { id: string } | null) ?? null;
    },
  });
  const isBlocked = !!blockRow;

  async function toggleBlock() {
    if (!me?.id || isMe) return;
    setBusy(true);
    try {
      if (isBlocked) {
        const { error } = await supabase
          .from("user_blocks" as any)
          .delete()
          .eq("blocker_id", me.id)
          .eq("blocked_id", userId);
        if (error) throw error;
        toast.success("Unblocked");
      } else {
        if (!confirm(`Block ${displayName}? They won't be able to message you.`)) {
          setBusy(false);
          return;
        }
        const { error } = await supabase
          .from("user_blocks" as any)
          .insert({ blocker_id: me.id, blocked_id: userId });
        if (error) throw error;
        toast.success("Blocked");
      }
      qc.invalidateQueries({ queryKey: ["user-block", me.id, userId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) {
    return <div className="pt-10 text-center text-candle-muted">Loading…</div>;
  }

  if (!user) {
    return (
      <div className="pt-10 px-5 max-w-md mx-auto">
        <button onClick={() => router.history.back()} className="text-candle-muted mb-6 flex items-center gap-2">
          <ArrowLeft className="size-5" /> Back
        </button>
        <p className="text-candle-muted text-center">User not found.</p>
      </div>
    );
  }

  const displayName = (isPartner && me?.partner_nickname) || user.display_name || "Someone";

  return (
    <div className="pt-8 px-5 pb-24 max-w-md mx-auto">
      <header className="flex items-center gap-3 mb-6">
        <button onClick={() => router.history.back()} className="text-candle-muted">
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="font-serif italic text-xl truncate flex-1">{displayName}</h1>
      </header>

      <div className="rounded-3xl border border-petal/30 bg-petal-soft/10 p-6 text-center mb-4">
        <div className="size-28 mx-auto mb-4 rounded-full bg-petal-soft border border-petal/30 flex items-center justify-center overflow-hidden">
          {user.avatar_url ? (
            <img src={user.avatar_url} alt="" className="size-full object-cover" />
          ) : (
            <span className="font-serif italic text-5xl text-petal">
              {displayName[0]?.toUpperCase()}
            </span>
          )}
        </div>
        <h2 className="font-serif italic text-2xl text-candle">{displayName}</h2>
        {isPartner && (
          <p className="text-xs text-petal mt-1 flex items-center justify-center gap-1">
            <Heart className="size-3 fill-petal" /> Your partner
          </p>
        )}
        {(user as any).bio && (
          <p className="text-sm text-candle-muted mt-3 whitespace-pre-wrap">{(user as any).bio}</p>
        )}
      </div>

      {!isMe && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          <Link
            to="/app/chat/$peerId"
            params={{ peerId: user.id }}
            className="rounded-2xl border border-border bg-surface p-3 flex flex-col items-center gap-1 text-petal"
          >
            <MessageCircle className="size-5" />
            <span className="text-xs">Message</span>
          </Link>
          <Link
            to="/app/call/$peerId"
            params={{ peerId: user.id }}
            search={{ role: "caller", mode: "audio" }}
            className="rounded-2xl border border-border bg-surface p-3 flex flex-col items-center gap-1 text-petal"
          >
            <Phone className="size-5" />
            <span className="text-xs">Call</span>
          </Link>
          <Link
            to="/app/call/$peerId"
            params={{ peerId: user.id }}
            search={{ role: "caller", mode: "video" }}
            className="rounded-2xl border border-border bg-surface p-3 flex flex-col items-center gap-1 text-petal"
          >
            <Video className="size-5" />
            <span className="text-xs">Video</span>
          </Link>
        </div>
      )}

      {!isMe && (
        <button
          onClick={toggleBlock}
          disabled={busy}
          className={`w-full mt-2 h-11 rounded-full border flex items-center justify-center gap-2 text-sm font-semibold transition-colors disabled:opacity-60 ${
            isBlocked
              ? "border-border bg-surface text-candle hover:bg-surface-elevated"
              : "border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20"
          }`}
        >
          {isBlocked ? <ShieldCheck className="size-4" /> : <Ban className="size-4" />}
          {isBlocked ? "Unblock" : "Block user"}
        </button>
      )}

      {isPartner && (
        <Link
          to="/app/partner"
          className="block text-center text-sm text-petal underline underline-offset-4"
        >
          View partner details
        </Link>
      )}
    </div>
  );
}
