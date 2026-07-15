import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Mic, MicOff, Video, VideoOff, PhoneOff, SwitchCamera, Volume2, VolumeX } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useCallMesh, type RemoteFeed } from "@/hooks/useCallMesh";
import { useProfile } from "@/hooks/useProfile";
import { startGroupCall } from "@/lib/callActions";

const searchSchema = z.object({
  role: z.enum(["caller", "callee"]).default("caller"),
  mode: z.enum(["video", "voice"]).default("video"),
  callId: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/app/call/group/$groupId")({
  validateSearch: searchSchema,
  component: GroupCall,
});

function fmtDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function GroupCall() {
  const { groupId } = Route.useParams();
  const { role, mode, callId: initialCallId } = Route.useSearch();
  const navigate = useNavigate();
  const { data: profileData } = useProfile();
  const me = profileData?.profile;

  const kind = mode;
  const [callId, setCallId] = useState<string | null>(initialCallId ?? null);
  const [startError, setStartError] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (role !== "caller" || callId || startedRef.current || !me) return;
    startedRef.current = true;
    (async () => {
      try {
        const c = await startGroupCall(groupId, kind);
        setCallId(c.id);
      } catch (e) {
        setStartError((e as Error).message ?? "Could not start call");
      }
    })();
  }, [role, callId, me, groupId, kind]);

  const {
    localStream, remoteFeeds, status, answered, error: meshError,
    hangup, toggleAudio, toggleVideo, flipCamera,
  } = useCallMesh({ callId, meId: me?.id ?? null, kind });

  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [duration, setDuration] = useState(0);
  const localRef = useRef<HTMLVideoElement>(null);
  const connectedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (localRef.current && localStream) localRef.current.srcObject = localStream;
  }, [localStream]);

  useEffect(() => {
    if ((answered || status === "active") && connectedAtRef.current === null) {
      connectedAtRef.current = Date.now();
    }
    if (!answered && status !== "active") return;
    const id = window.setInterval(() => {
      setDuration(Math.floor((Date.now() - (connectedAtRef.current ?? Date.now())) / 1000));
    }, 500);
    return () => window.clearInterval(id);
  }, [answered, status]);

  const loggedRef = useRef(false);
  useEffect(() => {
    if (status !== "ended" || loggedRef.current) return;
    loggedRef.current = true;
    const t = setTimeout(() => navigate({ to: "/app/chat/group/$groupId", params: { groupId } }), 800);
    return () => clearTimeout(t);
  }, [status, navigate, groupId]);

  const [names, setNames] = useState<Record<string, string>>({});
  useEffect(() => {
    const ids = Array.from(new Set(remoteFeeds.map((f) => f.user_id)));
    if (ids.length === 0) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("id, display_name").in("id", ids);
      const map: Record<string, string> = {};
      for (const p of data ?? []) map[(p as { id: string }).id] = (p as { display_name: string }).display_name;
      setNames(map);
    })();
  }, [remoteFeeds.map((f) => f.user_id).join(",")]);

  const statusLabel = useMemo(() => {
    if (answered || status === "active") return fmtDuration(duration);
    if (status === "ringing") return role === "caller" ? "Ringing everyone…" : "Incoming…";
    if (status === "connecting") return "Connecting…";
    if (status === "ended") return "Call ended";
    return status;
  }, [status, answered, role, duration]);

  const error = startError ?? meshError;

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-[#0f0714] text-white">
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,#0f0714_0%,#160820_45%,#0a0510_100%)]" />
      <header className="relative z-20 flex items-center justify-between px-5 pt-6 pb-3">
        <Link
          to="/app/chat/group/$groupId"
          params={{ groupId }}
          className="size-10 rounded-full bg-white/[0.04] backdrop-blur-xl border border-white/10 flex items-center justify-center text-white/70"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-[0.4em] text-white/40">{kind === "video" ? "Group video" : "Group voice"}</p>
          <p className="text-[11px] tabular-nums text-amber-200/70 mt-1">{statusLabel}</p>
        </div>
        <div className="size-10" />
      </header>

      <div className="relative flex-1 overflow-hidden px-3">
        {kind === "video" ? (
          <div className={`grid gap-2 h-full ${remoteFeeds.length <= 1 ? "grid-cols-1" : remoteFeeds.length <= 4 ? "grid-cols-2" : "grid-cols-3"}`}>
            {remoteFeeds.length === 0 && (
              <div className="col-span-full flex items-center justify-center">
                <p className="text-white/50">Waiting for people to join…</p>
              </div>
            )}
            {remoteFeeds.map((f) => (
              <RemoteTile key={f.key} feed={f} name={names[f.user_id]} muted={!speakerOn} />
            ))}
            <div className="absolute bottom-32 right-4 w-24 h-36 rounded-[24px] overflow-hidden border border-white/15 bg-black">
              <video ref={localRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              {videoOff && <div className="absolute inset-0 bg-[#0f0714] flex items-center justify-center"><VideoOff className="size-5 text-white/50" /></div>}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            {remoteFeeds.length === 0 && <p className="text-white/50">Waiting for people to join…</p>}
            {remoteFeeds.map((f) => (
              <RemoteVoiceTile key={f.key} feed={f} name={names[f.user_id]} muted={!speakerOn} />
            ))}
          </div>
        )}

        {error && (
          <div className="absolute bottom-36 left-5 right-5 p-3 bg-white/[0.06] backdrop-blur-xl border border-rose-400/30 rounded-2xl text-sm text-white/90 text-center">
            {error}
          </div>
        )}
      </div>

      <div className="relative z-20 px-5 pb-8 pt-3">
        <div className="mx-auto max-w-md bg-white/[0.04] backdrop-blur-3xl border border-white/10 rounded-[36px] p-2 flex items-center justify-between">
          <ControlBtn active={muted} onClick={() => { toggleAudio(); setMuted((m) => !m); }} label={muted ? "Unmute" : "Mute"}>
            {muted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
          </ControlBtn>
          {kind === "video" ? (
            <>
              <ControlBtn active={videoOff} onClick={() => { toggleVideo(); setVideoOff((v) => !v); }} label="Camera">
                {videoOff ? <VideoOff className="size-5" /> : <Video className="size-5" />}
              </ControlBtn>
              <ControlBtn onClick={() => flipCamera()} label="Flip">
                <SwitchCamera className="size-5" />
              </ControlBtn>
            </>
          ) : (
            <ControlBtn active={!speakerOn} onClick={() => setSpeakerOn((s) => !s)} label="Speaker">
              {speakerOn ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
            </ControlBtn>
          )}
          <button
            onClick={() => { void hangup(); navigate({ to: "/app/chat/group/$groupId", params: { groupId } }); }}
            className="w-20 h-12 rounded-[24px] bg-[#e11d48] text-white flex items-center justify-center shadow-[0_8px_25px_rgba(225,29,72,0.45)]"
            aria-label="Leave"
          >
            <PhoneOff className="size-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function RemoteTile({ feed, name, muted }: { feed: RemoteFeed; name?: string; muted: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    if (ref.current.srcObject !== feed.stream) ref.current.srcObject = feed.stream;
    ref.current.muted = muted;
    ref.current.play?.().catch(() => {});
  }, [feed.stream, feed.rev, muted]);
  return (
    <div className="relative rounded-2xl overflow-hidden bg-black border border-white/10">
      <video ref={ref} autoPlay playsInline className="w-full h-full object-cover" />
      <div className="absolute bottom-1 left-2 text-xs bg-black/40 px-2 py-0.5 rounded-full">{name ?? "…"}</div>
    </div>
  );
}

function RemoteVoiceTile({ feed, name, muted }: { feed: RemoteFeed; name?: string; muted: boolean }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    if (ref.current.srcObject !== feed.stream) ref.current.srcObject = feed.stream;
    ref.current.muted = muted;
    ref.current.play?.().catch(() => {});
  }, [feed.stream, feed.rev, muted]);
  return (
    <div className="flex items-center gap-3 bg-white/[0.04] border border-white/10 rounded-2xl px-4 py-3 w-full max-w-sm">
      <div className="size-10 rounded-full bg-amber-200/20 flex items-center justify-center font-serif italic">{name?.[0] ?? "?"}</div>
      <p className="flex-1 text-sm">{name ?? "Someone"}</p>
      <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
      <audio ref={ref} autoPlay playsInline style={{ position: "absolute", opacity: 0 }} />
    </div>
  );
}

function ControlBtn({ children, onClick, active, label }: { children: React.ReactNode; onClick: () => void; active?: boolean; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`size-12 rounded-full flex items-center justify-center transition-all active:scale-95 border ${
        active ? "bg-amber-100/90 text-[#0f0714] border-amber-200" : "bg-white/[0.04] border-white/10 text-white/75"
      }`}
    >
      {children}
    </button>
  );
}
