import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Film, Play, Pause } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";

export const Route = createFileRoute("/_authenticated/app/watch")({
  component: Watch,
});

type Room = {
  id: string;
  host_id: string;
  partner_id: string;
  video_url: string | null;
  video_title: string | null;
  position_seconds: number;
  is_playing: boolean;
  last_actor_id: string | null;
  last_event: string | null;
  updated_at: string;
};

function Watch() {
  const { data, isLoading } = useProfile();
  const me = data?.profile;
  const partner = data?.partner;
  const [room, setRoom] = useState<Room | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const suppressEvent = useRef(false);

  // Find or wait for room
  useEffect(() => {
    if (!me || !partner) return;
    let cancelled = false;
    (async () => {
      const { data: rows } = await supabase
        .from("watch_rooms")
        .select("*")
        .or(
          `and(host_id.eq.${me.id},partner_id.eq.${partner.id}),and(host_id.eq.${partner.id},partner_id.eq.${me.id})`,
        )
        .order("updated_at", { ascending: false })
        .limit(1);
      if (!cancelled && rows && rows[0]) setRoom(rows[0] as Room);
    })();

    const channel = supabase
      .channel(`watch:${me.id}:${partner.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "watch_rooms" },
        (payload) => {
          const r = (payload.new ?? payload.old) as Room | undefined;
          if (!r) return;
          const involved =
            (r.host_id === me.id && r.partner_id === partner.id) ||
            (r.host_id === partner.id && r.partner_id === me.id);
          if (involved) setRoom(r);
        },
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [me?.id, partner?.id]);

  // Apply remote state to video element
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !room || room.last_actor_id === me?.id) return;
    suppressEvent.current = true;
    if (Math.abs(v.currentTime - room.position_seconds) > 1.5) {
      v.currentTime = room.position_seconds;
    }
    if (room.is_playing && v.paused) v.play().catch(() => {});
    if (!room.is_playing && !v.paused) v.pause();
    setTimeout(() => (suppressEvent.current = false), 200);
  }, [room?.is_playing, room?.position_seconds, room?.last_actor_id, room?.video_url, me?.id]);

  async function createRoom() {
    if (!me || !partner || !videoUrl.trim()) return;
    const { data: created, error } = await supabase
      .from("watch_rooms")
      .upsert(
        {
          host_id: me.id,
          partner_id: partner.id,
          video_url: videoUrl.trim(),
          video_title: videoTitle.trim() || "Untitled",
          position_seconds: 0,
          is_playing: false,
          last_actor_id: me.id,
          last_event: "create",
        },
        { onConflict: "host_id,partner_id" },
      )
      .select()
      .maybeSingle();
    if (error) {
      toast.error(error.message);
      return;
    }
    if (created) setRoom(created as Room);
    toast.success("Room ready — press play when your partner's in 🎬");
  }

  async function pushState(patch: Partial<Room>) {
    if (!room || !me) return;
    await supabase
      .from("watch_rooms")
      .update({ ...patch, last_actor_id: me.id })
      .eq("id", room.id);
  }

  if (isLoading) return <Shell><div className="p-8 text-center text-candle-muted">Loading…</div></Shell>;

  if (!partner) {
    return (
      <Shell>
        <div className="px-6 py-16 text-center">
          <h2 className="font-serif text-2xl italic mb-2">Watching is for two</h2>
          <p className="text-sm text-candle-muted mb-6">Pair with your partner to open the cinema.</p>
          <Link to="/app/invite" className="inline-block px-6 py-3 bg-petal text-velvet rounded-full font-semibold text-sm">
            Invite partner
          </Link>
        </div>
      </Shell>
    );
  }

  if (!room || !room.video_url) {
    return (
      <Shell>
        <div className="px-5 py-8">
          <h2 className="font-serif text-2xl italic mb-2">Start tonight's room</h2>
          <p className="text-sm text-candle-muted mb-6">
            Paste a direct video URL (MP4/WebM). Both of you will see the same playback.
          </p>
          <div className="space-y-3">
            <input
              value={videoTitle}
              onChange={(e) => setVideoTitle(e.target.value)}
              placeholder="Movie title (e.g. Casablanca)"
              className="w-full px-4 py-3 bg-surface border border-border rounded-2xl text-sm text-candle placeholder:text-candle-muted focus:outline-none focus:border-petal/60"
            />
            <input
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://…/movie.mp4"
              className="w-full px-4 py-3 bg-surface border border-border rounded-2xl text-sm text-candle placeholder:text-candle-muted focus:outline-none focus:border-petal/60"
            />
            <button
              onClick={createRoom}
              className="w-full py-3.5 bg-petal text-velvet font-semibold rounded-full text-sm petal-glow"
            >
              Open the room
            </button>
          </div>
          <p className="text-[11px] text-candle-muted mt-4 leading-relaxed">
            Tip: try <code className="text-petal">https://archive.org/download/BigBuckBunny_124/Content/big_buck_bunny_720p_surround.mp4</code>
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell title={room.video_title ?? "Watching"}>
      <div className="px-3">
        <div className="relative rounded-3xl overflow-hidden bg-black border border-border">
          <video
            ref={videoRef}
            src={room.video_url}
            className="w-full aspect-video"
            playsInline
            controls
            onPlay={() => {
              if (suppressEvent.current) return;
              pushState({
                is_playing: true,
                position_seconds: videoRef.current?.currentTime ?? 0,
                last_event: "play",
              });
            }}
            onPause={() => {
              if (suppressEvent.current) return;
              pushState({
                is_playing: false,
                position_seconds: videoRef.current?.currentTime ?? 0,
                last_event: "pause",
              });
            }}
            onSeeked={() => {
              if (suppressEvent.current) return;
              pushState({
                position_seconds: videoRef.current?.currentTime ?? 0,
                last_event: "seek",
              });
            }}
          />
        </div>

        <div className="mt-4 p-4 bg-surface rounded-2xl border border-border flex items-center gap-3">
          <div className="size-10 rounded-xl bg-petal-soft text-petal flex items-center justify-center">
            <Film className="size-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-candle-muted">
              Watching with {partner.display_name}
            </p>
            <p className="font-serif italic truncate">{room.video_title}</p>
          </div>
          <span className="text-xs text-candle-muted flex items-center gap-1">
            {room.is_playing ? <Play className="size-3 text-petal" /> : <Pause className="size-3" />}
            {room.is_playing ? "Playing" : "Paused"}
          </span>
        </div>

        <button
          onClick={() => pushState({ video_url: null, video_title: null, is_playing: false, position_seconds: 0, last_event: "end" })}
          className="mt-3 w-full py-3 text-xs text-candle-muted hover:text-candle"
        >
          End this room
        </button>
      </div>
    </Shell>
  );
}

function Shell({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <div className="pt-8">
      <header className="px-5 pb-4 flex items-center gap-3">
        <Link to="/app" className="text-candle-muted">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-widest text-petal">Watch together</p>
          <h1 className="font-serif text-xl italic">{title ?? "Cinema"}</h1>
        </div>
      </header>
      {children}
    </div>
  );
}
