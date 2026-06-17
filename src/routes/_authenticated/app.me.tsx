import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, LogOut, Heart, Copy } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";

export const Route = createFileRoute("/_authenticated/app/me")({
  component: Me,
});

function Me() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading } = useProfile();
  const me = data?.profile;
  const partner = data?.partner;

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  async function copyCode() {
    if (!me) return;
    await navigator.clipboard.writeText(me.invite_code);
    toast.success("Invite code copied");
  }

  return (
    <div className="pt-10 px-5">
      <header className="flex items-center gap-3 mb-6">
        <Link to="/app" className="text-candle-muted">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="font-serif text-2xl italic">Profile</h1>
      </header>

      {isLoading || !me ? (
        <div className="text-candle-muted text-sm">Loading…</div>
      ) : (
        <>
          <div className="flex items-center gap-4 mb-8">
            <div className="size-16 rounded-full bg-petal-soft border border-petal/20 flex items-center justify-center">
              <span className="font-serif text-2xl italic text-petal">
                {me.display_name?.[0]?.toUpperCase() ?? "🐼"}
              </span>
            </div>
            <div>
              <p className="font-serif text-2xl italic">{me.display_name}</p>
              <p className="text-sm text-candle-muted">@{me.username}</p>
            </div>
          </div>

          <div className="p-5 rounded-3xl border border-border bg-surface mb-4">
            <p className="text-[10px] uppercase tracking-widest text-petal mb-2">Partner</p>
            {partner ? (
              <div className="flex items-center gap-3">
                <Heart className="size-5 text-petal" />
                <div>
                  <p className="font-serif italic text-lg">{partner.display_name}</p>
                  <p className="text-xs text-candle-muted">@{partner.username}</p>
                </div>
              </div>
            ) : (
              <Link
                to="/app/invite"
                className="block py-2 text-sm text-petal underline"
              >
                Invite your partner →
              </Link>
            )}
          </div>

          <div className="p-5 rounded-3xl border border-border bg-surface mb-4">
            <p className="text-[10px] uppercase tracking-widest text-petal mb-2">Your invite code</p>
            <div className="flex items-center justify-between gap-3">
              <p className="font-serif text-3xl italic tracking-widest text-candle">
                {me.invite_code}
              </p>
              <button
                onClick={copyCode}
                className="size-10 rounded-full bg-velvet border border-border flex items-center justify-center text-candle-muted hover:text-petal"
                aria-label="Copy code"
              >
                <Copy className="size-4" />
              </button>
            </div>
          </div>

          <button
            onClick={signOut}
            className="w-full py-3.5 bg-surface border border-border rounded-2xl text-candle text-sm font-medium flex items-center justify-center gap-2 hover:border-petal/40 transition-colors"
          >
            <LogOut className="size-4" /> Sign out
          </button>
        </>
      )}
    </div>
  );
}
