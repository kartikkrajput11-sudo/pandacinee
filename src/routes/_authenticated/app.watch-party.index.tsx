import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Users, Plus, LogIn } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { joinWatchPartyByCode, type WatchParty } from "@/lib/watchParty";

export const Route = createFileRoute("/_authenticated/app/watch-party/")({
  component: WatchPartyIndex,
});

function WatchPartyIndex() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [myParties, setMyParties] = useState<WatchParty[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) return;
      const { data: memberships } = await supabase
        .from("watch_party_members")
        .select("party_id")
        .eq("user_id", uid);
      const ids = (memberships ?? []).map((m) => m.party_id);
      if (ids.length === 0) {
        if (!cancelled) setMyParties([]);
        return;
      }
      const { data: parties } = await supabase
        .from("watch_parties")
        .select("*")
        .in("id", ids)
        .order("updated_at", { ascending: false })
        .limit(20);
      if (!cancelled) setMyParties((parties ?? []) as WatchParty[]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleJoin() {
    const trimmed = code.trim();
    if (trimmed.length < 4) {
      toast.error("Enter a valid code");
      return;
    }
    setJoining(true);
    try {
      const party = await joinWatchPartyByCode(trimmed);
      navigate({ to: "/app/watch-party/$code", params: { code: party.code } });
    } catch (e: any) {
      toast.error(e?.message ?? "Could not join party");
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="min-h-screen bg-canvas pb-24">
      <header className="sticky top-0 z-10 bg-canvas/95 backdrop-blur border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/app/movies" className="p-2 -ml-2 rounded-full hover:bg-surface transition-colors">
            <ArrowLeft className="size-5" />
          </Link>
          <h1 className="font-serif italic text-xl">Watch Party</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <section className="p-5 rounded-3xl border border-border bg-surface">
          <div className="flex items-center gap-3 mb-4">
            <div className="size-11 rounded-2xl bg-petal-soft text-petal flex items-center justify-center">
              <LogIn className="size-5" />
            </div>
            <div>
              <p className="font-serif italic text-lg leading-tight">Join a party</p>
              <p className="text-[12px] text-candle-muted">Enter the 6-character code your friend shared.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={8}
              className="flex-1 bg-canvas rounded-2xl border border-border px-4 py-3 text-lg tracking-widest font-mono uppercase text-center outline-none focus:border-petal/60"
            />
            <button
              onClick={handleJoin}
              disabled={joining || code.length < 4}
              className="px-5 rounded-2xl bg-petal text-white font-medium disabled:opacity-50"
            >
              {joining ? "…" : "Join"}
            </button>
          </div>
        </section>

        <section className="p-5 rounded-3xl border border-border bg-surface">
          <div className="flex items-center gap-3 mb-2">
            <div className="size-11 rounded-2xl bg-petal-soft text-petal flex items-center justify-center">
              <Plus className="size-5" />
            </div>
            <div>
              <p className="font-serif italic text-lg leading-tight">Start a party</p>
              <p className="text-[12px] text-candle-muted">Open any movie or episode and tap the "Watch Party" button.</p>
            </div>
          </div>
          <Link
            to="/app/movies"
            className="inline-block mt-3 px-4 py-2 rounded-2xl bg-canvas border border-border text-sm hover:border-petal/40 transition-colors"
          >
            Browse movies →
          </Link>
        </section>

        {myParties.length > 0 && (
          <section>
            <p className="text-xs uppercase tracking-widest text-candle-muted mb-2 px-2">Recent parties</p>
            <div className="space-y-2">
              {myParties.map((p) => (
                <Link
                  key={p.id}
                  to="/app/watch-party/$code"
                  params={{ code: p.code }}
                  className="block p-3 rounded-2xl border border-border bg-surface hover:border-petal/40 transition-colors flex items-center gap-3"
                >
                  {p.media_poster ? (
                    <img src={p.media_poster} alt="" className="w-10 h-14 rounded-lg object-cover" />
                  ) : (
                    <div className="w-10 h-14 rounded-lg bg-canvas flex items-center justify-center">
                      <Users className="size-4 text-candle-muted" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.media_title ?? "Untitled"}</p>
                    <p className="text-[11px] text-candle-muted font-mono">{p.code}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
