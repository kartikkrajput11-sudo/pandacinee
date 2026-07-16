import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { ArrowLeft, Heart, Calendar, MessageCircle, Film, HeartCrack } from "lucide-react";
import { toast } from "sonner";
import { useProfile } from "@/hooks/useProfile";
import { unpairPartner } from "@/lib/partner.functions";
import { AvatarImg } from "@/components/AvatarImg";

export const Route = createFileRoute("/_authenticated/app/partner")({
  component: PartnerProfile,
});

function PartnerProfile() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data } = useProfile();
  const me = data?.profile;
  const partner = data?.partner;
  const unpair = useServerFn(unpairPartner);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [unpairing, setUnpairing] = useState(false);

  const daysTogether = useMemo(() => {
    const anniv = me?.anniversary_date;
    if (!anniv) return null;
    const diff = Math.floor((Date.now() - new Date(anniv).getTime()) / 86400000);
    return diff >= 0 ? diff : null;
  }, [me?.anniversary_date]);

  async function onUnpair() {
    setUnpairing(true);
    try {
      await unpair({});
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Unpaired");
      navigate({ to: "/app" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not unpair");
    } finally {
      setUnpairing(false);
      setConfirmOpen(false);
    }
  }

  if (!partner) {
    return (
      <div className="pt-10 px-5 pb-24 max-w-md mx-auto">
        <header className="flex items-center gap-3 mb-8">
          <Link to="/app/me" className="text-candle-muted"><ArrowLeft className="size-5" /></Link>
          <h1 className="font-serif text-2xl italic">Your partner</h1>
        </header>
        <div className="text-center py-12">
          <div className="size-16 mx-auto mb-4 rounded-full bg-petal-soft flex items-center justify-center">
            <Heart className="size-7 text-petal" />
          </div>
          <p className="text-candle-muted mb-4">You haven't paired yet.</p>
          <Link to="/app/invite" className="inline-block h-11 px-6 leading-[44px] rounded-full bg-petal text-velvet font-semibold text-sm">
            Invite your partner
          </Link>
        </div>
      </div>
    );
  }

  const partnerName = me?.partner_nickname || partner.display_name;

  return (
    <div className="pt-10 px-5 pb-24 max-w-md mx-auto">
      <header className="flex items-center gap-3 mb-6">
        <Link to="/app/me" className="text-candle-muted"><ArrowLeft className="size-5" /></Link>
        <h1 className="font-serif text-2xl italic">Your partner</h1>
      </header>

      <div className="rounded-3xl border border-petal/30 bg-petal-soft/10 p-6 text-center mb-4 ring-petal">
        <div className="size-24 mx-auto mb-3 rounded-full bg-petal-soft border border-petal/30 flex items-center justify-center overflow-hidden">
          {partner.avatar_url ? (
            <AvatarImg src={partner.avatar_url} alt="" className="size-full object-cover" />
          ) : (
            <span className="font-serif italic text-4xl text-petal">{partnerName[0]?.toUpperCase()}</span>
          )}
        </div>
        <h2 className="font-serif italic text-3xl">{partnerName}</h2>
        <p className="text-sm text-candle-muted">@{partner.username}</p>
        {partner.mood && (
          <p className="mt-2 text-sm text-petal">{partner.mood_emoji} {partner.mood}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <Stat label="Days together" value={daysTogether != null ? String(daysTogether) : "—"} icon={<Heart className="size-4 text-petal" />} />
        <Stat label="Anniversary" value={me?.anniversary_date ? new Date(me.anniversary_date).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "Not set"} icon={<Calendar className="size-4 text-petal" />} />
      </div>

      <div className="rounded-3xl border border-border bg-surface p-4 mb-4">
        <p className="text-[10px] uppercase tracking-widest text-petal mb-3">Together</p>
        <Link to="/app/chat/$peerId" params={{ peerId: partner.id }} className="flex items-center gap-3 py-2.5 border-b border-border">
          <div className="size-9 rounded-full bg-petal-soft flex items-center justify-center"><MessageCircle className="size-4 text-petal" /></div>
          <div className="flex-1"><p className="text-sm text-candle">Whispers</p><p className="text-[11px] text-candle-muted">Your private chat</p></div>
        </Link>
        <Link to="/app/watch" className="flex items-center gap-3 py-2.5 border-b border-border">
          <div className="size-9 rounded-full bg-petal-soft flex items-center justify-center"><Film className="size-4 text-petal" /></div>
          <div className="flex-1"><p className="text-sm text-candle">Watch together</p><p className="text-[11px] text-candle-muted">Sync movie nights</p></div>
        </Link>
        <Link to="/app/memories" className="flex items-center gap-3 py-2.5">
          <div className="size-9 rounded-full bg-petal-soft flex items-center justify-center"><Heart className="size-4 text-petal" /></div>
          <div className="flex-1"><p className="text-sm text-candle">Memories</p><p className="text-[11px] text-candle-muted">Photos and notes</p></div>
        </Link>
      </div>

      <button
        onClick={() => setConfirmOpen(true)}
        className="w-full py-3.5 rounded-2xl bg-surface border border-destructive/40 text-destructive text-sm font-medium flex items-center justify-center gap-2"
      >
        <HeartCrack className="size-4" /> Unpair from {partnerName}
      </button>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 bg-velvet/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-surface border border-border p-6 animate-fade-up">
            <div className="size-14 mx-auto mb-3 rounded-full bg-destructive/15 flex items-center justify-center">
              <HeartCrack className="size-6 text-destructive" />
            </div>
            <h3 className="font-serif italic text-xl text-center mb-2">Unpair from {partnerName}?</h3>
            <p className="text-sm text-candle-muted text-center mb-5">
              Your chats stay, but shared features — watch parties, streak, daily questions — will stop until you pair again.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmOpen(false)} className="flex-1 h-11 rounded-full bg-surface-elevated text-candle text-sm">Cancel</button>
              <button onClick={onUnpair} disabled={unpairing} className="flex-1 h-11 rounded-full bg-destructive text-candle text-sm font-semibold disabled:opacity-50">
                {unpairing ? "Unpairing…" : "Unpair"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2 mb-1.5">{icon}<span className="text-[10px] uppercase tracking-widest text-candle-muted">{label}</span></div>
      <p className="font-serif italic text-2xl">{value}</p>
    </div>
  );
}
