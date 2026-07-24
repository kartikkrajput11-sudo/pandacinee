import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Trash2, Send, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Target = { receiver_id?: string; group_id?: string };

type Row = {
  id: string;
  content: string;
  type: string;
  scheduled_for: string;
  delivered_at: string | null;
};

function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ScheduleDialog({
  open,
  onClose,
  meId,
  target,
  initialText = "",
}: {
  open: boolean;
  onClose: () => void;
  meId: string;
  target: Target;
  initialText?: string;
}) {
  const [text, setText] = useState(initialText);
  const [when, setWhen] = useState(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000); // +1h default
    return toLocalInputValue(d);
  });
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => { if (open) setText(initialText); }, [open, initialText]);

  const load = useMemo(() => async () => {
    if (!open) return;
    const q = (supabase as any).from("scheduled_messages").select("*").eq("sender_id", meId).is("delivered_at", null);
    if (target.receiver_id) q.eq("receiver_id", target.receiver_id);
    if (target.group_id) q.eq("group_id", target.group_id);
    const { data } = await q.order("scheduled_for", { ascending: true }).limit(30);
    setRows((data as Row[]) ?? []);
  }, [open, meId, target.receiver_id, target.group_id]);

  useEffect(() => { load(); }, [load]);

  async function schedule() {
    const body = text.trim();
    if (!body) { toast.error("Write something first"); return; }
    const iso = new Date(when).toISOString();
    if (new Date(iso).getTime() <= Date.now()) { toast.error("Pick a future time"); return; }
    setSaving(true);
    const payload: Record<string, unknown> = {
      sender_id: meId,
      content: body,
      type: "text",
      scheduled_for: iso,
    };
    if (target.receiver_id) payload.receiver_id = target.receiver_id;
    if (target.group_id) payload.group_id = target.group_id;
    const { error } = await (supabase as any).from("scheduled_messages").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Scheduled");
    setText("");
    load();
  }

  async function cancel(id: string) {
    const { error } = await (supabase as any).from("scheduled_messages").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setRows((r) => r.filter((x) => x.id !== id));
  }

  const quick = [
    { label: "In 1h", ms: 60 * 60 * 1000 },
    { label: "Tonight 9pm", at: () => { const d = new Date(); d.setHours(21, 0, 0, 0); if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1); return d; } },
    { label: "Tomorrow 9am", at: () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d; } },
    { label: "Next week", ms: 7 * 24 * 60 * 60 * 1000 },
  ];

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[210] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xl px-3 pb-3 sm:p-6" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md rounded-3xl bg-surface-elevated border border-border shadow-2xl overflow-hidden animate-scale-in"
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <div className="size-9 rounded-2xl bg-petal/20 flex items-center justify-center">
            <CalendarClock className="size-4 text-petal" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] uppercase tracking-[0.3em] text-candle-muted">Send later</p>
            <h3 className="text-lg font-serif italic text-candle">Schedule a message</h3>
          </div>
          <button onClick={onClose} className="size-8 rounded-full hover:bg-muted text-candle-muted">
            <X className="size-4 mx-auto" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="Write your message…"
            className="w-full rounded-2xl bg-surface border border-border px-3 py-2 text-sm text-candle placeholder:text-candle-muted resize-none focus:outline-none focus:border-petal/60"
          />

          <div className="flex flex-wrap gap-1.5">
            {quick.map((q) => (
              <button
                key={q.label}
                onClick={() => {
                  const d = "at" in q ? q.at() : new Date(Date.now() + (q as any).ms);
                  setWhen(toLocalInputValue(d));
                }}
                className="text-[11px] px-2.5 h-7 rounded-full bg-surface border border-border text-candle hover:border-petal/60"
              >
                {q.label}
              </button>
            ))}
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-candle-muted mb-1">Send at</p>
            <input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              className="w-full rounded-xl bg-surface border border-border px-3 h-10 text-sm text-candle focus:outline-none focus:border-petal/60"
            />
          </div>

          <button
            onClick={schedule}
            disabled={saving}
            className="w-full h-11 rounded-full bg-petal text-white font-medium hover:bg-petal/90 disabled:opacity-60 inline-flex items-center justify-center gap-2"
          >
            <Send className="size-4" /> Schedule
          </button>
          <p className="text-[10px] text-candle-muted text-center">Delivers when either of you has the app open near that time.</p>
        </div>

        {rows.length > 0 && (
          <div className="border-t border-border">
            <p className="px-5 pt-3 text-[10px] uppercase tracking-[0.3em] text-candle-muted">Upcoming</p>
            <div className="max-h-56 overflow-y-auto p-3 space-y-1.5">
              {rows.map((r) => (
                <div key={r.id} className="rounded-xl bg-surface border border-border px-3 py-2 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-candle truncate">{r.content || `📎 ${r.type}`}</p>
                    <p className="text-[10px] text-candle-muted">{new Date(r.scheduled_for).toLocaleString()}</p>
                  </div>
                  <button onClick={() => cancel(r.id)} className="size-8 rounded-full hover:bg-red-500/10 text-destructive">
                    <Trash2 className="size-4 mx-auto" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
