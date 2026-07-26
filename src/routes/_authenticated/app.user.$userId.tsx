import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, MessageCircle, Phone, Video, Heart, Ban, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, type Profile } from "@/hooks/useProfile";
import { AchievementBadges } from "@/components/AchievementBadges";
import { UserAvatar } from "@/components/UserAvatar";

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

  function openTour() {
    window.dispatchEvent(new CustomEvent("pandacine:open-tour"));
  }

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
    return <div className="pt-10 text-center text-candle/50 font-serif italic">Loading…</div>;
  }

  if (!user) {
    return (
      <div className="pt-10 px-5 max-w-md mx-auto">
        <button onClick={() => router.history.back()} className="text-candle/60 mb-6 flex items-center gap-2">
          <ArrowLeft className="size-5" /> Back
        </button>
        <p className="text-candle/50 text-center font-serif italic">User not found.</p>
      </div>
    );
  }

  const displayName = (isPartner && me?.partner_nickname) || user.display_name || "Someone";
  const bio = (user as any).bio as string | undefined;

  return (
    <div className="relative pb-24 max-w-md mx-auto min-h-screen">
      {/* Ambient bloom */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-80"
        style={{
          background:
            "radial-gradient(closest-side at 50% 0%, hsl(340 60% 55% / 0.22), hsl(38 55% 55% / 0.08) 45%, transparent 75%)",
        }}
      />

      <header className="relative flex items-center justify-between px-5 pt-6">
        <button
          onClick={() => router.history.back()}
          aria-label="Back"
          className="size-9 rounded-full border border-candle/15 bg-velvet/60 backdrop-blur flex items-center justify-center text-candle/70 hover:text-petal transition-colors"
        >
          <ArrowLeft className="size-4" strokeWidth={1.5} />
        </button>
        <span className="text-[9px] uppercase tracking-[0.35em] text-candle/40 font-semibold">Profile</span>
        <span className="size-9" />
      </header>

      {/* Hero card */}
      <section className="relative mx-5 mt-8">
        <div className="relative rounded-[28px] border border-candle/15 bg-gradient-to-b from-velvet/80 via-velvet/60 to-velvet/80 backdrop-blur-md px-6 pt-10 pb-7 text-center shadow-[0_30px_80px_-30px_hsl(340_70%_20%/0.6)]">
          {/* Corner filigrees */}
          <div className="absolute top-2 left-2 w-3 h-3 border-t border-l border-candle/40" />
          <div className="absolute top-2 right-2 w-3 h-3 border-t border-r border-candle/40" />
          <div className="absolute bottom-2 left-2 w-3 h-3 border-b border-l border-candle/40" />
          <div className="absolute bottom-2 right-2 w-3 h-3 border-b border-r border-candle/40" />

          {/* Avatar with rings */}
          <div className="relative mx-auto w-fit">
            <span className="absolute inset-0 -m-3 rounded-full border border-petal/25" />
            <span className="absolute inset-0 -m-6 rounded-full border border-candle/10" />
            <div
              className="relative rounded-full p-[2px]"
              style={{
                background:
                  "conic-gradient(from 140deg, hsl(38 65% 68%), hsl(340 70% 60%), hsl(38 65% 68%))",
              }}
            >
              <div className="rounded-full bg-velvet p-1">
                <UserAvatar src={user.avatar_url} name={displayName} className="size-28" />
              </div>
            </div>
          </div>

          {/* Name */}
          <h1 className="font-serif italic text-[26px] leading-tight text-candle mt-5">{displayName}</h1>

          {/* Meta row */}
          <div className="mt-2 flex items-center justify-center gap-3">
            {isPartner ? (
              <span className="inline-flex items-center gap-1.5 text-[9px] uppercase tracking-[0.28em] text-petal font-semibold">
                <Heart className="size-2.5 fill-petal" /> Your Partner
              </span>
            ) : isMe ? (
              <span className="text-[9px] uppercase tracking-[0.28em] text-candle/50 font-semibold">You</span>
            ) : (
              <span className="text-[9px] uppercase tracking-[0.28em] text-candle/50 font-semibold">Member</span>
            )}
          </div>

          {/* Ornament divider */}
          <div className="mt-5 flex items-center justify-center gap-3">
            <span className="h-px w-12 bg-gradient-to-r from-transparent to-candle/25" />
            <span className="size-1 rotate-45 bg-candle/40" />
            <span className="h-px w-12 bg-gradient-to-l from-transparent to-candle/25" />
          </div>

          {bio && (
            <p className="text-[13px] leading-relaxed text-candle/70 font-serif italic mt-4 whitespace-pre-wrap px-2">
              "{bio}"
            </p>
          )}
        </div>
      </section>

      {/* Equipped honors */}
      <section className="px-5 mt-6">
        <div className="flex items-center gap-3 mb-3">
          <span className="h-px flex-1 bg-candle/10" />
          <span className="text-[9px] uppercase tracking-[0.3em] text-candle/45 font-semibold">Honors</span>
          <span className="h-px flex-1 bg-candle/10" />
        </div>
        <AchievementBadges userId={user.id} />
      </section>

      {/* Full collection of earned tags */}
      <section className="px-5 mt-6">
        <div className="flex items-center gap-3 mb-3">
          <span className="h-px flex-1 bg-candle/10" />
          <span className="text-[9px] uppercase tracking-[0.3em] text-candle/45 font-semibold">Collection</span>
          <span className="h-px flex-1 bg-candle/10" />
        </div>
        <AchievementBadges userId={user.id} equippedOnly={false} />
      </section>


      {/* Actions */}
      {!isMe && (
        <>
          <section className="px-5 mt-8">
            <div className="flex items-center gap-3 mb-3">
              <span className="h-px flex-1 bg-candle/10" />
              <span className="text-[9px] uppercase tracking-[0.3em] text-candle/45 font-semibold">Reach Out</span>
              <span className="h-px flex-1 bg-candle/10" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { to: "/app/chat/$peerId" as const, params: { peerId: user.id }, search: undefined, Icon: MessageCircle, label: "Message" },
                { to: "/app/call/$peerId" as const, params: { peerId: user.id }, search: { role: "caller" as const, mode: "audio" as const }, Icon: Phone, label: "Voice" },
                { to: "/app/call/$peerId" as const, params: { peerId: user.id }, search: { role: "caller" as const, mode: "video" as const }, Icon: Video, label: "Video" },
              ].map(({ to, params, search, Icon, label }) => (
                <Link
                  key={label}
                  to={to}
                  params={params}
                  {...(search ? { search } : {})}
                  className="group relative rounded-2xl border border-candle/15 bg-velvet/50 backdrop-blur p-4 flex flex-col items-center gap-2 overflow-hidden hover:border-petal/40 transition-colors"
                >
                  <span
                    aria-hidden
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{
                      background:
                        "radial-gradient(closest-side at 50% 0%, hsl(340 65% 55% / 0.22), transparent 70%)",
                    }}
                  />
                  <Icon className="relative size-[18px] text-petal" strokeWidth={1.5} />
                  <span className="relative text-[9px] uppercase tracking-[0.25em] text-candle/70 font-semibold">
                    {label}
                  </span>
                </Link>
              ))}
            </div>
          </section>

          <section className="px-5 mt-6">
            <button
              onClick={toggleBlock}
              disabled={busy}
              className={`w-full h-12 rounded-full border flex items-center justify-center gap-2 text-[11px] uppercase tracking-[0.3em] font-semibold transition-colors disabled:opacity-60 ${
                isBlocked
                  ? "border-candle/20 bg-velvet/50 text-candle/80 hover:bg-velvet"
                  : "border-red-500/30 bg-red-500/[0.06] text-red-300 hover:bg-red-500/15"
              }`}
            >
              {isBlocked ? <ShieldCheck className="size-4" strokeWidth={1.5} /> : <Ban className="size-4" strokeWidth={1.5} />}
              {isBlocked ? "Unblock" : "Block"}
            </button>
          </section>
        </>
      )}

      {isPartner && (
        <section className="px-5 mt-6">
          <Link
            to="/app/partner"
            className="group block rounded-2xl border border-petal/25 bg-gradient-to-r from-petal/[0.08] via-transparent to-[hsl(38_60%_55%/0.08)] px-5 py-4 text-center transition-colors hover:border-petal/50"
          >
            <span className="text-[9px] uppercase tracking-[0.3em] text-petal font-semibold">Partner Suite</span>
            <p className="font-serif italic text-candle mt-1 text-base">View partner details →</p>
          </Link>
        </section>
      )}
    </div>
  );
}
