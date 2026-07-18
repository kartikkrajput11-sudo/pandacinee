import { useState } from "react";
import { X, Calendar } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export function GroupEventComposer({
  open,
  onClose,
  groupId,
  meId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  groupId: string;
  meId: string | null;
  onCreated: (event: { id: string; title: string; starts_at: string; location: string | null }) => void;
}) {
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState("");
  const [where, setWhere] = useState("");
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  async function submit() {
    if (!meId) return;
    if (!title.trim() || !when) {
      toast.error("Give it a title and a time");
      return;
    }
    setSaving(true);
    try {
      const iso = new Date(when).toISOString();
      const { data, error } = await supabase
        .from("group_events" as never)
        .insert({
          group_id: groupId,
          created_by: meId,
          title: title.trim(),
          starts_at: iso,
          location: where.trim() || null,
        } as never)
        .select()
        .maybeSingle();
      if (error) throw error;
      const ev = data as unknown as { id: string; title: string; starts_at: string; location: string | null };
      onCreated(ev);
      setTitle(""); setWhen(""); setWhere("");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't create the plan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-velvet/80 backdrop-blur-sm flex items-end sm:items-center justify-center animate-fade-in" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full sm:max-w-md bg-surface-elevated border border-border rounded-t-3xl sm:rounded-3xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-petal">New plan</p>
            <p className="font-serif italic text-lg flex items-center gap-2"><Calendar className="size-4 text-petal" /> Schedule an event</p>
          </div>
          <button onClick={onClose} className="text-candle-muted hover:text-candle"><X className="size-4" /></button>
        </div>
        <div className="space-y-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What's the plan?" className="w-full px-3 py-2 rounded-xl bg-surface border border-border text-sm text-candle" />
          <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-surface border border-border text-sm text-candle" />
          <input value={where} onChange={(e) => setWhere(e.target.value)} placeholder="Where? (optional)" className="w-full px-3 py-2 rounded-xl bg-surface border border-border text-sm text-candle" />
        </div>
        <button
          onClick={submit}
          disabled={saving}
          className="w-full mt-4 py-2.5 rounded-full bg-petal text-velvet font-medium text-sm disabled:opacity-60"
        >
          {saving ? "Creating…" : "Post to the circle"}
        </button>
      </div>
    </div>
  );
}
