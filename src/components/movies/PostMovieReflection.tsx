import { useEffect, useState } from "react";
import { Star, X, Heart, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AvatarImg } from "@/components/AvatarImg";

type Reflection = {
  id?: string;
  movie_id: string;
  user_id: string;
  partner_id: string | null;
  rating: number | null;
  favorite_moment: string | null;
  mood: string | null;
  would_rewatch: boolean;
  note: string | null;
};

const MOODS = ["🥹 Moved", "😂 Delighted", "😱 Thrilled", "🥰 In love", "🤔 Curious", "😴 Meh"];

export function PostMovieReflection({
  movieId,
  movieTitle,
  meId,
  partnerId,
  partnerName,
  partnerAvatar,
  onClose,
}: {
  movieId: string;
  movieTitle: string;
  meId: string;
  partnerId: string | null;
  partnerName?: string;
  partnerAvatar?: string | null;
  onClose: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [mood, setMood] = useState<string | null>(null);
  const [favorite, setFavorite] = useState("");
  const [note, setNote] = useState("");
  const [rewatch, setRewatch] = useState(false);
  const [saving, setSaving] = useState(false);
  const [partnerReflection, setPartnerReflection] = useState<Reflection | null>(null);
  const [saved, setSaved] = useState(false);

  // Load partner's reflection if exists
  useEffect(() => {
    if (!partnerId) return;
    supabase
      .from("post_movie_prompts")
      .select("*")
      .eq("movie_id", movieId)
      .eq("user_id", partnerId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setPartnerReflection(data as Reflection);
      });
    const channel = supabase
      .channel(`reflection-${movieId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "post_movie_prompts", filter: `movie_id=eq.${movieId}` },
        (payload) => {
          const row = payload.new as Reflection;
          if (row?.user_id === partnerId) setPartnerReflection(row);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [movieId, partnerId]);

  async function save() {
    if (rating === 0) {
      toast.error("Add a rating first");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("post_movie_prompts").upsert(
      {
        movie_id: movieId,
        user_id: meId,
        partner_id: partnerId,
        rating,
        favorite_moment: favorite.trim() || null,
        mood,
        would_rewatch: rewatch,
        note: note.trim() || null,
      },
      { onConflict: "movie_id,user_id" },
    );
    setSaving(false);
    if (error) return toast.error("Couldn't save reflection");
    setSaved(true);
    toast.success("Saved 💌");
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-xl flex items-end sm:items-center justify-center p-3 sm:p-6">
      <div className="w-full max-w-lg glass-strong rounded-3xl border border-petal/30 overflow-hidden max-h-[92vh] flex flex-col">
        <div className="relative p-5 border-b border-petal/20">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 size-8 rounded-full glass flex items-center justify-center text-candle-muted hover:text-candle"
          >
            <X className="size-4" />
          </button>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-petal/15 text-[9px] uppercase tracking-[0.32em] text-petal">
            <Sparkles className="size-3" /> After the credits
          </div>
          <h2 className="font-serif text-2xl italic mt-2 pr-8">How was {movieTitle}?</h2>
          <p className="text-candle-muted text-xs mt-1">A small reflection for you two to keep.</p>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto">
          {/* Rating */}
          <div>
            <div className="text-[10px] uppercase tracking-[0.28em] text-candle-muted mb-2">Your rating</div>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setRating(n)}
                  className="p-1 transition-transform active:scale-90"
                  aria-label={`${n} stars`}
                >
                  <Star
                    className={`size-8 transition ${
                      n <= rating ? "fill-petal text-petal" : "text-candle-muted/40"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Mood */}
          <div>
            <div className="text-[10px] uppercase tracking-[0.28em] text-candle-muted mb-2">Left you feeling</div>
            <div className="flex flex-wrap gap-2">
              {MOODS.map((m) => (
                <button
                  key={m}
                  onClick={() => setMood(m)}
                  className={`px-3 py-1.5 rounded-full text-xs transition ${
                    mood === m
                      ? "bg-petal text-velvet"
                      : "glass text-candle-muted hover:text-candle"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Favorite moment */}
          <div>
            <div className="text-[10px] uppercase tracking-[0.28em] text-candle-muted mb-2">Favorite moment</div>
            <input
              value={favorite}
              onChange={(e) => setFavorite(e.target.value)}
              placeholder="The scene, the line, the look…"
              className="w-full px-4 py-2.5 rounded-2xl bg-surface/60 border border-petal/20 text-sm outline-none focus:border-petal/60"
            />
          </div>

          {/* Note */}
          <div>
            <div className="text-[10px] uppercase tracking-[0.28em] text-candle-muted mb-2">A note to your panda</div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Whisper something they'll read after they finish too…"
              rows={3}
              className="w-full px-4 py-2.5 rounded-2xl bg-surface/60 border border-petal/20 text-sm outline-none focus:border-petal/60 resize-none"
            />
          </div>

          {/* Rewatch */}
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={rewatch}
              onChange={(e) => setRewatch(e.target.checked)}
              className="size-4 rounded accent-petal"
            />
            <span>I'd rewatch this with you 💫</span>
          </label>

          {/* Partner's reflection (revealed only after you saved) */}
          {partnerReflection && (
            <div className={`rounded-2xl p-4 border border-petal/30 bg-petal/5 transition ${saved ? "" : "blur-sm select-none"}`}>
              <div className="flex items-center gap-2 mb-2">
                {partnerAvatar !== undefined && (
                  <AvatarImg
                    src={partnerAvatar}
                    alt={partnerName ?? ""}
                    className="size-7 rounded-full object-cover"
                  />
                )}
                <div className="text-xs">
                  <div className="text-candle">{partnerName ?? "Your panda"}</div>
                  <div className="text-[10px] uppercase tracking-[0.24em] text-candle-muted">
                    said too
                  </div>
                </div>
                <div className="ml-auto flex">
                  {Array.from({ length: partnerReflection.rating ?? 0 }).map((_, i) => (
                    <Star key={i} className="size-3 fill-petal text-petal" />
                  ))}
                </div>
              </div>
              {partnerReflection.mood && (
                <div className="text-xs text-candle-muted mb-1">{partnerReflection.mood}</div>
              )}
              {partnerReflection.favorite_moment && (
                <div className="text-sm italic">"{partnerReflection.favorite_moment}"</div>
              )}
              {partnerReflection.note && (
                <div className="text-sm mt-1 text-candle-muted">{partnerReflection.note}</div>
              )}
              {partnerReflection.would_rewatch && (
                <div className="text-xs text-petal mt-2 flex items-center gap-1">
                  <Heart className="size-3 fill-petal" /> Would rewatch with you
                </div>
              )}
              {!saved && (
                <div className="text-[10px] text-center text-petal mt-2 uppercase tracking-[0.24em]">
                  Save yours to reveal
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-petal/20 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-full glass text-xs uppercase tracking-[0.28em] text-candle-muted hover:text-candle"
          >
            Later
          </button>
          <button
            onClick={save}
            disabled={saving || rating === 0 || saved}
            className="flex-1 py-3 rounded-full bg-petal text-velvet text-xs font-medium uppercase tracking-[0.28em] disabled:opacity-50 hover:brightness-110 transition"
          >
            {saved ? "Saved 💌" : saving ? "Saving…" : "Save reflection"}
          </button>
        </div>
      </div>
    </div>
  );
}
