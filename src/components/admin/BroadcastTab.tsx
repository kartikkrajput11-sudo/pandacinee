import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  Megaphone, Send, Bell, BellRing, Sparkles, Heart, AlertTriangle, Info, CheckCircle2, Loader2,
  Users, Cake, CalendarHeart, CreditCard, Activity, MoonStar, ShieldCheck, Mail,
} from "lucide-react";
import { previewAudience, sendTargetedBroadcast } from "@/lib/admin-broadcast.functions";

type ToneKey = "info" | "success" | "warning" | "love" | "sparkle";
type Audience =
  | "all"
  | "anniversary_today"
  | "paired_monthiversary"
  | "payment_pending"
  | "active_7d"
  | "inactive_14d"
  | "admins";

const TONES: { key: ToneKey; label: string; Icon: typeof Info }[] = [
  { key: "sparkle", label: "Sparkle", Icon: Sparkles },
  { key: "love",    label: "Love",    Icon: Heart },
  { key: "info",    label: "Info",    Icon: Info },
  { key: "success", label: "Success", Icon: CheckCircle2 },
  { key: "warning", label: "Warning", Icon: AlertTriangle },
];

const AUDIENCES: { key: Audience; label: string; hint: string; Icon: typeof Users }[] = [
  { key: "all",                   label: "Everyone",           hint: "All registered users",       Icon: Users },
  { key: "anniversary_today",     label: "Anniversary today",  hint: "Owner-set anniversary date", Icon: Cake },
  { key: "paired_monthiversary",  label: "Month-iversary",     hint: "Paired on this day-of-month",Icon: CalendarHeart },
  { key: "payment_pending",       label: "Payment due",        hint: "Purchases still pending",    Icon: CreditCard },
  { key: "active_7d",             label: "Active · last 7d",   hint: "Seen in the last 7 days",    Icon: Activity },
  { key: "inactive_14d",          label: "Idle · 14d+",        hint: "No visit in 14+ days",       Icon: MoonStar },
  { key: "admins",                label: "Admins",             hint: "Site administrators only",   Icon: ShieldCheck },
];

const TEMPLATES: { title: string; body: string; tone: ToneKey; audience?: Audience }[] = [
  { title: "New feature unlocked", body: "Something magical just landed in your studio ✨", tone: "sparkle", audience: "all" },
  { title: "Happy anniversary 💗", body: "A little story is unlocked at the top of your salon today.", tone: "love", audience: "anniversary_today" },
  { title: "Movie night at 9 PM", body: "Grab a blanket. We'll press play together tonight.", tone: "info" },
  { title: "Complete your coin purchase", body: "Your order is waiting — finish it whenever you're ready.", tone: "warning", audience: "payment_pending" },
];

export default function BroadcastTab() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tone, setTone] = useState<ToneKey>("sparkle");
  const [audience, setAudience] = useState<Audience>("all");
  const [sendEmail, setSendEmail] = useState(false);
  const [sending, setSending] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");

  const previewFn = useServerFn(previewAudience);
  const sendFn = useServerFn(sendTargetedBroadcast);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) { setPermission("unsupported"); return; }
    setPermission(Notification.permission);
  }, []);

  // Resolve audience count whenever the selection changes.
  useEffect(() => {
    let cancelled = false;
    setCountLoading(true);
    setCount(null);
    previewFn({ data: { audience } })
      .then((r) => { if (!cancelled) setCount(r.count); })
      .catch(() => { if (!cancelled) setCount(null); })
      .finally(() => { if (!cancelled) setCountLoading(false); });
    return () => { cancelled = true; };
  }, [audience, previewFn]);

  const canSend = title.trim().length > 1 && body.trim().length > 1 && !sending;
  const charCountBody = useMemo(() => body.length, [body]);

  async function askPermission() {
    if (!("Notification" in window)) return;
    const p = await Notification.requestPermission();
    setPermission(p);
    if (p === "granted") toast.success("Browser notifications enabled");
    else toast("Notifications blocked. Enable them in your browser to preview.");
  }

  function previewLocal() {
    if (!canSend) return;
    window.dispatchEvent(new CustomEvent("admin-broadcast-preview", {
      detail: {
        id: crypto.randomUUID(),
        title: title.trim(), body: body.trim(), tone,
        sent_at: Date.now(), preview: true,
      },
    }));
    toast("Preview shown locally");
  }

  async function send() {
    if (!canSend) return;
    setSending(true);
    try {
      const res = await sendFn({
        data: {
          audience,
          title: title.trim(),
          body: body.trim(),
          tone,
          sendEmail,
        },
      });
      const parts = [`Broadcast sent to ${res.recipients} ${res.recipients === 1 ? "person" : "people"}`];
      if (sendEmail) parts.push(`${res.emailQueued} emails queued${res.emailSkipped ? `, ${res.emailSkipped} skipped` : ""}`);
      toast.success(parts.join(" · "));
    } catch (e: any) {
      toast.error(e?.message ?? "Could not send broadcast");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-surface p-5">
        <div className="absolute -top-20 -right-16 size-56 rounded-full bg-petal/20 blur-3xl pointer-events-none" />
        <div className="flex items-start gap-3 relative">
          <div className="size-11 rounded-2xl bg-petal/15 border border-petal/30 flex items-center justify-center">
            <Megaphone className="size-5 text-petal" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-petal">Targeted broadcast</p>
            <h2 className="font-serif italic text-2xl">Send to just the right people</h2>
            <p className="text-xs text-candle-muted mt-1">
              Pick an audience — anniversary folks, payment-due, admins — and reach them in-app with a luxury toast, optionally by email too.
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

      {/* Audience */}
      <div className="rounded-3xl border border-border bg-surface p-5 space-y-3">
        <div className="flex items-baseline justify-between">
          <label className="text-[10px] uppercase tracking-widest text-candle-muted">Audience</label>
          <span className="text-[11px] text-candle-muted">
            {countLoading ? "counting…" : count === null ? "—" : `${count} ${count === 1 ? "recipient" : "recipients"}`}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {AUDIENCES.map(({ key, label, hint, Icon }) => {
            const active = audience === key;
            return (
              <button
                key={key}
                onClick={() => setAudience(key)}
                className={`text-left rounded-2xl px-3 py-2.5 transition border ${
                  active
                    ? "bg-petal/15 border-petal/50 shadow-lg shadow-petal/10"
                    : "bg-velvet/40 border-border hover:border-petal/40"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className={`size-4 ${active ? "text-petal" : "text-candle-muted"}`} />
                  <p className={`text-xs font-semibold ${active ? "text-candle" : "text-candle-muted"}`}>{label}</p>
                </div>
                <p className="text-[10px] text-candle-muted mt-1 truncate">{hint}</p>
              </button>
            );
          })}
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
            placeholder="A little something for the right people…"
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
                onClick={() => {
                  setTitle(t.title); setBody(t.body); setTone(t.tone);
                  if (t.audience) setAudience(t.audience);
                }}
                className="text-left rounded-2xl border border-border bg-velvet/40 hover:border-petal/40 hover:bg-velvet/60 transition px-3 py-2"
              >
                <p className="font-serif italic text-sm text-candle">{t.title}</p>
                <p className="text-[11px] text-candle-muted truncate">{t.body}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Email toggle */}
        <label className="flex items-start gap-3 rounded-2xl border border-border bg-velvet/40 px-3 py-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={sendEmail}
            onChange={(e) => setSendEmail(e.target.checked)}
            className="mt-1 accent-petal size-4"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Mail className="size-3.5 text-petal" />
              <p className="text-xs font-semibold text-candle">Also send by email</p>
            </div>
            <p className="text-[11px] text-candle-muted mt-0.5">
              Queues a branded email to every recipient via your verified sender.
              Suppressed & unsubscribed addresses are skipped automatically.
            </p>
          </div>
        </label>

        <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
          <button
            onClick={previewLocal}
            disabled={!canSend}
            className="h-10 px-4 rounded-full bg-velvet/60 border border-border text-xs font-semibold text-candle disabled:opacity-40 hover:border-petal/40 transition"
          >
            Preview locally
          </button>
          <button
            onClick={send}
            disabled={!canSend || (count !== null && count === 0)}
            className="h-10 px-5 rounded-full bg-petal text-velvet text-xs font-bold flex items-center gap-2 shadow-lg shadow-petal/30 disabled:opacity-40 hover:shadow-petal/50 transition"
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {sendEmail ? "Send · in-app + email" : "Send · in-app"}
          </button>
        </div>
      </div>
    </div>
  );
}
