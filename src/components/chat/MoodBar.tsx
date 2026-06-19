import { useState } from "react";
import { Smile, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/hooks/useProfile";

const MOOD_EMOJIS = ["🥰", "😌", "🍿", "🎬", "😴", "💜", "✨", "🐼", "🌙", "🔥", "🥺", "☕"];

export function MoodBar({ me, partner }: { me: Profile; partner: Profile | null }) {
  const [editing, setEditing] = useState(false);
  const [emoji, setEmoji] = useState(me.mood_emoji ?? "💜");
  const [text, setText] = useState(me.mood ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await supabase.from("profiles").update({
      mood_emoji: emoji,
      mood: text.trim() || null,
      mood_updated_at: new Date().toISOString(),
    }).eq("id", me.id);
    setSaving(false);
    setEditing(false);
  }

  async function clear() {
    await supabase.from("profiles").update({ mood: null, mood_emoji: null, mood_updated_at: null }).eq("id", me.id);
    setText("");
    setEditing(false);
  }

  return (
    <div className="px-4 py-2 border-b border-border bg-surface/40 flex items-center gap-3 text-xs">
      {partner?.mood && (
        <div className="flex-1 min-w-0 flex items-center gap-1.5">
          <span className="text-base">{partner.mood_emoji ?? "💜"}</span>
          <span className="text-candle truncate">{partner.mood}</span>
        </div>
      )}
      {!partner?.mood && <div className="flex-1 text-candle-muted italic">No vibe from partner</div>}

      {!editing ? (
        <button onClick={() => setEditing(true)} className="flex items-center gap-1 px-2 py-1 rounded-full bg-petal/20 text-petal">
          <Smile className="size-3" />
          {me.mood ? <span>{me.mood_emoji} {me.mood.slice(0, 12)}</span> : <span>Set vibe</span>}
        </button>
      ) : (
        <div className="flex items-center gap-1">
          <select value={emoji} onChange={(e) => setEmoji(e.target.value)} className="bg-surface border border-border rounded-full px-2 py-1 text-base">
            {MOOD_EMOJIS.map((e) => <option key={e}>{e}</option>)}
          </select>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="what's your vibe?"
            maxLength={40}
            className="w-28 px-2 py-1 bg-surface border border-border rounded-full text-xs"
          />
          <button disabled={saving} onClick={save} className="px-2 py-1 rounded-full bg-petal text-velvet">Save</button>
          {me.mood && <button onClick={clear} className="text-candle-muted"><X className="size-3" /></button>}
        </div>
      )}
    </div>
  );
}
