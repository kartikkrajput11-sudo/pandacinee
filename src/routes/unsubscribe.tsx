import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/unsubscribe")({
  component: UnsubscribePage,
  head: () => ({
    meta: [
      { title: "Unsubscribe · Pandacine" },
      { name: "description", content: "Manage your Pandacine email preferences." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});

type State =
  | { status: "loading" }
  | { status: "valid" }
  | { status: "already" }
  | { status: "invalid" }
  | { status: "done" }
  | { status: "error"; message: string };

function UnsubscribePage() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [submitting, setSubmitting] = useState(false);

  const token = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("token")
    : null;

  useEffect(() => {
    if (!token) { setState({ status: "invalid" }); return; }
    (async () => {
      try {
        const r = await fetch(`/email/unsubscribe?token=${encodeURIComponent(token)}`);
        const j = await r.json();
        if (!r.ok || j.error) setState({ status: "invalid" });
        else if (j.valid === false && j.reason === "already_unsubscribed") setState({ status: "already" });
        else setState({ status: "valid" });
      } catch (e: any) {
        setState({ status: "error", message: e?.message ?? "Something went wrong" });
      }
    })();
  }, [token]);

  const confirm = async () => {
    if (!token) return;
    setSubmitting(true);
    try {
      const r = await fetch(`/email/unsubscribe`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const j = await r.json();
      if (j?.success) setState({ status: "done" });
      else if (j?.reason === "already_unsubscribed") setState({ status: "already" });
      else setState({ status: "error", message: j?.error ?? "Could not unsubscribe" });
    } catch (e: any) {
      setState({ status: "error", message: e?.message ?? "Network error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-md rounded-3xl border border-petal/30 bg-[var(--surface-elevated)]/90 p-8 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <p className="text-[11px] uppercase tracking-[0.22em] text-petal">Pandacine</p>
        <h1 className="mt-1 font-serif italic text-2xl text-candle">Email preferences</h1>

        {state.status === "loading" && <p className="mt-6 text-sm text-candle-muted">Checking your link…</p>}
        {state.status === "invalid" && <p className="mt-6 text-sm text-candle-muted">This unsubscribe link is invalid or expired.</p>}
        {state.status === "already" && <p className="mt-6 text-sm text-candle-muted">You've already been unsubscribed. Nothing more to do.</p>}
        {state.status === "error"   && <p className="mt-6 text-sm text-rose-400">{state.message}</p>}
        {state.status === "done"    && <p className="mt-6 text-sm text-emerald-400">You're unsubscribed. Sorry to see you go — you can always sign back in inside the app.</p>}
        {state.status === "valid" && (
          <>
            <p className="mt-6 text-sm text-candle-muted">Confirm you want to stop receiving broadcast emails from Pandacine.</p>
            <button
              onClick={confirm}
              disabled={submitting}
              className="mt-6 w-full h-11 rounded-full bg-petal text-velvet font-semibold shadow-lg shadow-petal/30 disabled:opacity-50"
            >
              {submitting ? "Unsubscribing…" : "Confirm unsubscribe"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
