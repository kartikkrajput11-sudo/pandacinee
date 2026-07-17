import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Megaphone, Send, Bell, BellRing, Sparkles, Heart, AlertTriangle, Info, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type ToneKey = "info" | "success" | "warning" | "love" | "sparkle";

const TONES: { key: ToneKey; label: string; Icon: typeof Info; hint: string }[] = [
  { key: "sparkle", label: "Sparkle", Icon: Sparkles, hint: "Feature launch" },
  { key: "love",    label: "Love",    Icon: Heart,    hint: "Anniversary / romance" },
  { key: "info",    label: "Info",    Icon: Info,     hint: "General notice" },
  { key: "success", label: "Success", Icon: CheckCircle2, hint: "Good news" },
  { key: "warning", label: "Warning", Icon: AlertTriangle, hint: "Maintenance" },
];

const TEMPLATES: { title: string; body: string; tone: ToneKey }[] = [
  { title: "New feature unlocked", body: "Something magical just landed in your studio ✨", tone: "sparkle" },
  { title: "Anniversary lights are on", body: "Peek at the top banner — a little story awaits.", tone: "love" },
  { title: "Movie night at 9 PM", body: "Grab a blanket. We'll press play together tonight.", tone: "info" },
  { title: "Short maintenance", body: "We'll polish the velvet for ~5 minutes. Sit tight 💫", tone: "warning" },
];

export default function BroadcastTab() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tone, setTone] = useState<ToneKey>("sparkle");
  const [sending, setSending] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) { setPermission("unsupported"); return; }
    setPermission(Notification.permission);
  }, []);

  const canSend = title.trim().length > 1 && body.trim().length > 1 && !sending;

  const charCountBody = useMemo(() => body.length, [body]);

  async function askPermission() {
    if (!("Notification" in window)) return;
    const p = await Notification.requestPermission();
    setPermission(p);
    if (p === "granted") toast.success("Browser notifications enabled");
    else toast("Notifications blocked. Enable them in your browser to preview.");
  }

  async function send(preview = false) {
    if (!canSend) return;
    setSending(true);
    try {
      const payload = {
        id: crypto.randomUUID(),
        title: title.trim(),
        body: body.trim(),
        tone,
        sent_at: Date.now(),
        preview,
      };

      if (!preview) {
        const channel = supabase.channel("admin-broadcast");
        await new Promise<void>((resolve) => {
          channel.subscribe((status) => {
            if (status === "SUBSCRIBED") resolve();
          });
          setTimeout(() => resolve(), 1500);
        });
        await channel.send({ type: "broadcast", event: "push", payload });
        setTimeout(() => channel.unsubscribe(), 800);
        toast.success("Broadcast sent to everyone online");
      } else {
        // Local preview only — dispatch a fake broadcast event for this tab
        window.dispatchEvent(new CustomEvent("admin-broadcast-preview", { detail: payload }));
        toast("Preview shown locally");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Could not send broadcast");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header card */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-surface p-5">
        <div className="absolute -top-20 -right-16 size-56 rounded-full bg-petal/20 blur-3xl pointer-events-none" />
        <div className="flex items-start gap-3 relative">
          <div className="size-11 rounded-2xl bg-petal/15 border border-petal/30 flex items-center justify-center">
            <Megaphone className="size-5 text-petal" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-petal">Push broadcast</p>
            <h2 className="font-serif italic text-2xl">Speak to everyone online</h2>
            <p className="text-xs text-candle-muted mt-1">
              Delivers a luxury toast to every open Pandacine tab in realtime, plus a native browser
              notification when the user granted permission.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {permission === "unsupported" ? (
            <span className="text-[11px] text-candle-muted">This browser has no Notification API.</span>
          ) : permission === "granted" ? (
            <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold">
              <BellRing className="size-3.5" /> Notifications enabled
            </span>
          ) : (
            <button
              onClick={askPermission}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-petal/15 text-petal border border-petal/30 text-[11px] font-semibold hover:bg-petal/25 transition"
            >
              <Bell className="size-3.5" /> Enable browser notifications
            </button>
          )}
        </div>
      </div>

      {/* Compose */}
      <div className="rounded-3xl border border-border bg-surface p-5 space-y-4">
        <div>
          <label className="text-[10px] uppercase tracking-widest text-candle-muted">Tone</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {TONES.map(({ key, label, Icon }) => {
              const active = tone === key;
              return (
                <button
                  key={key}
                  onClick={() => setTone(key)}
                  className={`h-9 px-3 rounded-full flex items-center gap-1.5 text-[11px] font-semibold transition ${
                    active
                      ? "bg-petal text-velvet shadow-lg shadow-petal/30"
                      : "bg-velvet/40 border border-border text-candle-muted hover:text-candle"
                  }`}
                >
                  <Icon className="size-3.5" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-widest text-candle-muted">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 80))}
            placeholder="A little something for everyone…"
            className="mt-2 w-full bg-velvet/50 border border-border rounded-2xl px-4 py-3 text-candle placeholder:text-candle-muted focus:outline-none focus:border-petal/60 focus:ring-2 focus:ring-petal/20 font-serif italic"
          />
          <p className="text-right text-[10px] text-candle-muted mt-1">{title.length}/80</p>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-widest text-candle-muted">Message</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, 240))}
            rows={3}
            placeholder="Type your message… emoji welcome ✨"
            className="mt-2 w-full bg-velvet/50 border border-border rounded-2xl px-4 py-3 text-candle placeholder:text-candle-muted focus:outline-none focus:border-petal/60 focus:ring-2 focus:ring-petal/20 resize-none"
          />
          <p className="text-right text-[10px] text-candle-muted mt-1">{charCountBody}/240</p>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-widest text-candle-muted mb-2">Templates</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.title}
                onClick={() => { setTitle(t.title); setBody(t.body); setTone(t.tone); }}
                className="text-left rounded-2xl border border-border bg-velvet/40 hover:border-petal/40 hover:bg-velvet/60 transition px-3 py-2"
              >
                <p className="font-serif italic text-sm text-candle">{t.title}</p>
                <p className="text-[11px] text-candle-muted truncate">{t.body}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
          <button
            onClick={() => send(true)}
            disabled={!canSend}
            className="h-10 px-4 rounded-full bg-velvet/60 border border-border text-xs font-semibold text-candle disabled:opacity-40 hover:border-petal/40 transition"
          >
            Preview locally
          </button>
          <button
            onClick={() => send(false)}
            disabled={!canSend}
            className="h-10 px-5 rounded-full bg-petal text-velvet text-xs font-bold flex items-center gap-2 shadow-lg shadow-petal/30 disabled:opacity-40 hover:shadow-petal/50 transition"
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Send to everyone
          </button>
        </div>
      </div>
    </div>
  );
}
