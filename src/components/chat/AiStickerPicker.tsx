import { useEffect, useMemo, useState } from "react";
import { X, Sparkles, Loader2, RefreshCw, ImagePlus } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { signMedia } from "@/lib/chat";
import { generateAiSticker, AI_STICKER_MOODS, type AiStickerMood } from "@/lib/ai-stickers.functions";

type StickerRow = {
  id: string;
  user_id: string;
  mood: AiStickerMood;
  storage_path: string;
  created_at: string;
};

const MOOD_LABEL: Record<AiStickerMood, string> = {
  happy: "Happy", love: "In love", kiss: "Kiss", hug: "Hug", shy: "Shy",
  wink: "Wink", laugh: "Laugh", cry: "Cry", wow: "Wow", cool: "Cool",
  sleepy: "Sleepy", wave: "Hi!", dance: "Dance", party: "Party",
  "heart-hands": "Heart", angry: "Angry", think: "Think", blush: "Blush",
};

type Props = {
  open: boolean;
  onClose: () => void;
  onPick: (storagePath: string, mood: AiStickerMood) => void;
};

export function AiStickerPicker({ open, onClose, onPick }: Props) {
  const { data: profileData } = useProfile();
  const me = profileData?.profile;
  const partner = profileData?.partner;
  const qc = useQueryClient();
  const genFn = useServerFn(generateAiSticker);

  const [tab, setTab] = useState<"me" | "partner">("me");
  const [busyMood, setBusyMood] = useState<AiStickerMood | null>(null);

  const activeUserId = tab === "me" ? me?.id : partner?.id;
  const activeAvatar = tab === "me" ? me?.avatar_url : partner?.avatar_url;
  const activeName = tab === "me" ? "you" : (me?.partner_nickname || partner?.display_name || "them");

  const { data: rows } = useQuery({
    enabled: open && !!activeUserId,
    queryKey: ["ai-stickers", activeUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_stickers" as any)
        .select("*")
        .eq("user_id", activeUserId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as StickerRow[]) ?? [];
    },
  });

  const byMood = useMemo(() => {
    const m = new Map<AiStickerMood, StickerRow>();
    (rows ?? []).forEach((r) => { if (!m.has(r.mood)) m.set(r.mood, r); });
    return m;
  }, [rows]);

  async function generate(mood: AiStickerMood) {
    if (tab !== "me") {
      toast.info(`${activeName} needs to generate their own AI stickers.`);
      return;
    }
    setBusyMood(mood);
    try {
      await genFn({ data: { mood } });
      qc.invalidateQueries({ queryKey: ["ai-stickers", me?.id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't generate sticker");
    } finally {
      setBusyMood(null);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-velvet/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-surface border-t border-petal/30 rounded-t-3xl p-4 pb-6 shadow-2xl animate-slide-in-right"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-petal flex items-center gap-1.5">
              <Sparkles className="size-3" /> AI stickers
            </p>
            <p className="font-serif italic text-lg text-candle">Anime stickers of us</p>
          </div>
          <button
            onClick={onClose}
            className="size-9 rounded-full bg-surface-elevated border border-border flex items-center justify-center text-candle-muted hover:text-petal transition-colors"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        {partner && (
          <div className="grid grid-cols-2 gap-1 p-1 rounded-full bg-surface-elevated border border-border mb-3">
            {(["me", "partner"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`h-8 rounded-full text-xs font-medium transition-colors ${
                  tab === t ? "bg-petal text-velvet" : "text-candle-muted"
                }`}
              >
                {t === "me" ? "You" : (me?.partner_nickname || partner.display_name || "Partner")}
              </button>
            ))}
          </div>
        )}

        {!activeAvatar ? (
          <div className="py-10 text-center px-4">
            <div className="size-16 mx-auto mb-3 rounded-full bg-petal-soft/40 border border-petal/30 flex items-center justify-center">
              <ImagePlus className="size-7 text-petal" />
            </div>
            <p className="font-serif italic text-lg text-candle mb-1">
              {tab === "me" ? "Add a profile photo first" : `${activeName} needs a profile photo`}
            </p>
            <p className="text-xs text-candle-muted mb-4 max-w-xs mx-auto">
              {tab === "me"
                ? "To create AI-generated anime stickers of yourself, upload a profile picture first."
                : `Ask ${activeName} to upload their profile photo so we can make anime stickers of them.`}
            </p>
            {tab === "me" && (
              <Link
                to="/app/me"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 h-10 px-5 rounded-full bg-petal text-velvet font-semibold text-xs"
              >
                Upload photo
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 max-h-[55vh] overflow-y-auto pr-1">
              {AI_STICKER_MOODS.map((mood) => {
                const row = byMood.get(mood);
                const busy = busyMood === mood;
                return (
                  <StickerCell
                    key={mood}
                    mood={mood}
                    label={MOOD_LABEL[mood]}
                    row={row}
                    busy={busy}
                    canRegenerate={tab === "me"}
                    onPick={() => row && onPick(row.storage_path, mood)}
                    onGenerate={() => generate(mood)}
                  />
                );
              })}
            </div>
            <p className="text-[10px] text-candle-muted text-center mt-3">
              {tab === "me"
                ? "Tap ✨ to generate, tap a sticker to send."
                : `Sending ${activeName}'s stickers back to them 💕`}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function StickerCell({
  mood,
  label,
  row,
  busy,
  canRegenerate,
  onPick,
  onGenerate,
}: {
  mood: AiStickerMood;
  label: string;
  row: StickerRow | undefined;
  busy: boolean;
  canRegenerate: boolean;
  onPick: () => void;
  onGenerate: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!row) { setUrl(null); return; }
    let m = true;
    signMedia(row.storage_path).then((u) => m && setUrl(u));
    return () => { m = false; };
  }, [row?.storage_path]);

  if (!row) {
    return (
      <button
        onClick={onGenerate}
        disabled={busy}
        className="aspect-square rounded-2xl bg-surface-elevated border border-dashed border-petal/40 hover:border-petal hover:bg-petal/10 transition-all flex flex-col items-center justify-center gap-1 disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="size-5 text-petal animate-spin" />
        ) : (
          <Sparkles className="size-5 text-petal" />
        )}
        <span className="text-[10px] text-candle-muted">{busy ? "Creating…" : label}</span>
      </button>
    );
  }

  return (
    <div className="relative group">
      <button
        onClick={onPick}
        className="w-full aspect-square rounded-2xl bg-surface-elevated border border-border hover:border-petal/60 transition-all p-1.5 flex items-center justify-center active:scale-95"
        aria-label={label}
      >
        {url ? (
          <img src={url} alt={label} className="w-full h-full object-contain" draggable={false} />
        ) : (
          <div className="w-full h-full rounded-xl bg-velvet/30 animate-pulse" />
        )}
      </button>
      <span className="absolute bottom-1 left-1 right-1 text-center text-[9px] text-candle-muted bg-velvet/70 backdrop-blur-sm rounded-full py-0.5">
        {label}
      </span>
      {canRegenerate && (
        <button
          onClick={(e) => { e.stopPropagation(); onGenerate(); }}
          disabled={busy}
          className="absolute top-1 right-1 size-6 rounded-full bg-velvet/80 backdrop-blur border border-border flex items-center justify-center text-petal opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-100"
          title="Regenerate"
        >
          {busy ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
        </button>
      )}
    </div>
  );
}
