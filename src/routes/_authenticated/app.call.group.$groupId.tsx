import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Mic, MicOff, Video as VideoIcon, VideoOff, PhoneOff, Users,
} from "lucide-react";
import { z } from "zod";
import { useProfile } from "@/hooks/useProfile";
import { useGroup } from "@/hooks/useGroups";
import { useLiveKitCall } from "@/hooks/useLiveKitCall";
import { UserAvatar } from "@/components/UserAvatar";

const searchSchema = z.object({
  role: z.enum(["caller", "callee"]).default("caller"),
  mode: z.enum(["voice", "video"]).default("video"),
  callId: z.string(),
});

export const Route = createFileRoute("/_authenticated/app/call/group/$groupId")({
  validateSearch: searchSchema,
  component: GroupCall,
});

function formatElapsed(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h > 0) return `${h}:${String(mm).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${mm}:${String(sec).padStart(2, "0")}`;
}

function GroupCall() {
  const { groupId } = Route.useParams();
  const { callId, mode } = Route.useSearch();
  const navigate = useNavigate();
  const { data: profileData } = useProfile();
  const { data: groupData } = useGroup(groupId);
  const meId = profileData?.profile?.id ?? null;

  const call = useLiveKitCall({ callId, meId, kind: mode });
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(mode === "voice");
  const [showRoster, setShowRoster] = useState(false);
  const [now, setNow] = useState(Date.now());

  const localRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (localRef.current && call.localStream) {
      localRef.current.srcObject = call.localStream;
    }
  }, [call.localStream]);

  // Elapsed timer (starts when call flips active)
  const startedAtRef = useRef<number | null>(null);
  useEffect(() => {
    if (call.status === "active" && !startedAtRef.current) startedAtRef.current = Date.now();
  }, [call.status]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const elapsed = startedAtRef.current ? now - startedAtRef.current : 0;

  function toggleMic() {
    if (!call.localStream) return;
    call.localStream.getAudioTracks().forEach((t) => (t.enabled = muted));
    setMuted((m) => !m);
  }
  function toggleCam() {
    if (!call.localStream) return;
    call.localStream.getVideoTracks().forEach((t) => (t.enabled = camOff));
    setCamOff((c) => !c);
  }

  async function hangup() {
    try { await call.hangup(); } catch { /* ignore */ }
    navigate({ to: "/app/chat/group/$groupId", params: { groupId } });
  }

  const feeds = call.remoteFeeds;
  const group = groupData?.group;
  const members = groupData?.members ?? [];
  const memberById = useMemo(
    () => new Map(members.map((m) => [m.user_id, m])),
    [members],
  );

  // Distinct participants (dedupe multi-device by user_id).
  const remoteByUser = useMemo(() => {
    const map = new Map<string, typeof feeds[number]>();
    for (const f of feeds) if (!map.has(f.user_id)) map.set(f.user_id, f);
    return map;
  }, [feeds]);
  const joinedUserIds = new Set<string>([...remoteByUser.keys()]);
  if (meId) joinedUserIds.add(meId);

  const statusLabel =
    call.status === "ringing" ? "Ringing the circle…" :
    call.status === "active" ? formatElapsed(elapsed) :
    call.status === "connecting" ? "Connecting…" :
    call.status;

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-velvet text-candle flex flex-col">
      {/* Ambient bloom */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 left-1/3 h-[520px] w-[520px] rounded-full blur-3xl opacity-40"
             style={{ background: "radial-gradient(circle, hsl(var(--petal)/0.55), transparent 70%)" }} />
        <div className="absolute bottom-[-160px] right-[-80px] h-[480px] w-[480px] rounded-full blur-3xl opacity-30"
             style={{ background: "radial-gradient(circle, hsl(var(--gold)/0.45), transparent 70%)" }} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.06),transparent_60%)]" />
      </div>

      {/* Header */}
      <header className="relative flex items-center gap-3 px-4 py-3 border-b border-white/10 backdrop-blur-md bg-black/30">
        <Link to="/app/chat/group/$groupId" params={{ groupId }} className="text-candle-muted hover:text-candle transition">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-[0.25em] text-petal">
            {mode === "video" ? "Group video" : "Group voice"}
          </p>
          <p className="font-serif italic text-lg truncate">{group?.name ?? "Circle"}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-mono tracking-wide px-2 py-1 rounded-full border ${
            call.status === "active"
              ? "border-emerald-400/40 text-emerald-300 bg-emerald-400/10"
              : "border-petal/40 text-petal bg-petal/10"
          }`}>
            {call.status === "active" && <span className="inline-block size-1.5 rounded-full bg-emerald-400 animate-pulse mr-1.5 align-middle" />}
            {statusLabel}
          </span>
          <button
            onClick={() => setShowRoster((v) => !v)}
            className="size-9 rounded-full border border-white/10 bg-white/5 flex items-center justify-center hover:bg-white/10 transition"
            aria-label="Participants"
          >
            <Users className="size-4" />
          </button>
        </div>
      </header>

      {/* Main stage */}
      <div className="relative flex-1 min-h-0">
        {mode === "video" ? (
          <VideoStage
            feeds={feeds}
            memberById={memberById}
            localRef={localRef}
            camOff={camOff}
            meDisplay={profileData?.profile?.display_name ?? "You"}
          />
        ) : (
          <VoiceStage
            joinedUserIds={joinedUserIds}
            invited={members.map((m) => m.user_id)}
            memberById={memberById}
            meId={meId}
            meDisplay={profileData?.profile?.display_name ?? "You"}
            muted={muted}
          />
        )}

        {/* Hidden audio for voice-mode playback (video tiles play their own audio). */}
        {mode === "voice" && feeds.map((f) => (
          <RemoteAudio key={f.key} stream={f.stream} />
        ))}

        {/* Roster drawer */}
        {showRoster && (
          <div className="absolute inset-y-0 right-0 w-72 max-w-[85%] bg-black/70 backdrop-blur-xl border-l border-white/10 p-4 overflow-y-auto animate-in slide-in-from-right">
            <div className="flex items-center justify-between mb-3">
              <p className="font-serif italic text-lg">In the circle</p>
              <button onClick={() => setShowRoster(false)} className="text-candle-muted text-xs">Close</button>
            </div>
            <div className="space-y-1">
              {members.map((m) => {
                const joined = joinedUserIds.has(m.user_id);
                return (
                  <div key={m.user_id} className="flex items-center gap-3 py-2 px-2 rounded-xl hover:bg-white/5">
                    <UserAvatar url={m.profile?.avatar_url ?? null} name={m.profile?.display_name ?? "…"} size={36} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{m.profile?.display_name ?? "…"}</p>
                      <p className={`text-[10px] uppercase tracking-widest ${joined ? "text-emerald-300" : "text-candle-muted"}`}>
                        {joined ? "Connected" : "Not joined"}
                      </p>
                    </div>
                    {m.role === "admin" && (
                      <span className="text-[9px] uppercase tracking-widest text-gold">Admin</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Control dock */}
      <div className="relative flex justify-center py-6 border-t border-white/10 bg-black/40 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <ControlBtn
            onClick={toggleMic}
            active={!muted}
            onLabel="Mute"
            offLabel="Unmute"
            iconOn={<Mic className="size-5" />}
            iconOff={<MicOff className="size-5" />}
          />
          {mode === "video" && (
            <ControlBtn
              onClick={toggleCam}
              active={!camOff}
              onLabel="Stop video"
              offLabel="Start video"
              iconOn={<VideoIcon className="size-5" />}
              iconOff={<VideoOff className="size-5" />}
            />
          )}
          <button
            onClick={hangup}
            className="size-16 rounded-full bg-gradient-to-br from-rose-500 to-red-600 text-white flex items-center justify-center shadow-[0_0_30px_hsl(0_80%_55%/0.55)] hover:scale-105 active:scale-95 transition"
            aria-label="Leave call"
          >
            <PhoneOff className="size-6" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ControlBtn({
  onClick, active, onLabel, offLabel, iconOn, iconOff,
}: {
  onClick: () => void;
  active: boolean;
  onLabel: string;
  offLabel: string;
  iconOn: React.ReactNode;
  iconOff: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={active ? onLabel : offLabel}
      className={`size-14 rounded-full flex items-center justify-center border transition ${
        active
          ? "bg-white/5 border-white/15 text-candle hover:bg-white/10"
          : "bg-red-500/20 border-red-400/40 text-red-200"
      }`}
    >
      {active ? iconOn : iconOff}
    </button>
  );
}

function VideoStage({
  feeds, memberById, localRef, camOff, meDisplay,
}: {
  feeds: ReturnType<typeof useLiveKitCall>["remoteFeeds"];
  memberById: Map<string, { profile: { display_name: string; avatar_url: string | null } | null }>;
  localRef: React.RefObject<HTMLVideoElement | null>;
  camOff: boolean;
  meDisplay: string;
}) {
  const total = feeds.length + 1;
  const cols = total <= 1 ? 1 : total <= 4 ? 2 : total <= 9 ? 3 : 4;
  return (
    <div
      className="w-full h-full p-3 grid gap-3 auto-rows-fr"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      <Tile label={`${meDisplay} · you`}>
        {camOff ? (
          <AvatarFallback name={meDisplay} url={null} />
        ) : (
          <video ref={localRef} autoPlay muted playsInline className="w-full h-full object-cover" />
        )}
      </Tile>
      {feeds.map((f) => {
        const m = memberById.get(f.user_id);
        return (
          <Tile key={f.key} label={m?.profile?.display_name ?? "Panda"}>
            <RemoteVideo stream={f.stream} />
          </Tile>
        );
      })}
    </div>
  );
}

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative rounded-3xl overflow-hidden border border-white/10 bg-surface shadow-[0_20px_60px_-30px_rgba(0,0,0,0.7)]">
      <div className="absolute inset-0 pointer-events-none rounded-3xl ring-1 ring-inset ring-white/5" />
      {children}
      <span className="absolute bottom-2 left-2 text-[11px] px-2 py-1 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 max-w-[70%] truncate">
        {label}
      </span>
    </div>
  );
}

function RemoteVideo({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return <video ref={ref} autoPlay playsInline className="w-full h-full object-cover" />;
}

function RemoteAudio({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return <audio ref={ref} autoPlay playsInline className="hidden" />;
}

function VoiceStage({
  joinedUserIds, invited, memberById, meId, meDisplay, muted,
}: {
  joinedUserIds: Set<string>;
  invited: string[];
  memberById: Map<string, { profile: { display_name: string; avatar_url: string | null } | null; role: "admin" | "member" }>;
  meId: string | null;
  meDisplay: string;
  muted: boolean;
}) {
  // Order: me first, then other joined, then not-yet-joined invitees.
  const ordered = useMemo(() => {
    const seen = new Set<string>();
    const list: Array<{ id: string; joined: boolean; isMe: boolean }> = [];
    if (meId) {
      list.push({ id: meId, joined: joinedUserIds.has(meId), isMe: true });
      seen.add(meId);
    }
    for (const uid of joinedUserIds) {
      if (seen.has(uid)) continue;
      list.push({ id: uid, joined: true, isMe: false });
      seen.add(uid);
    }
    for (const uid of invited) {
      if (seen.has(uid)) continue;
      list.push({ id: uid, joined: false, isMe: false });
      seen.add(uid);
    }
    return list;
  }, [joinedUserIds, invited, meId]);

  return (
    <div className="h-full w-full flex items-center justify-center p-6">
      <div className="grid gap-8 place-items-center"
           style={{ gridTemplateColumns: `repeat(${Math.min(ordered.length, 4)}, minmax(0, 1fr))` }}>
        {ordered.map((p) => {
          const m = memberById.get(p.id);
          const name = p.isMe ? meDisplay : m?.profile?.display_name ?? "Panda";
          const url = m?.profile?.avatar_url ?? null;
          const activeSpeaker = p.joined && !(p.isMe && muted);
          return (
            <div key={p.id} className="flex flex-col items-center gap-3">
              <div className="relative">
                {activeSpeaker && (
                  <>
                    <span className="absolute inset-[-14px] rounded-full border border-petal/40 animate-ping" />
                    <span className="absolute inset-[-22px] rounded-full border border-gold/30 animate-[ping_2.2s_ease-out_infinite]" />
                  </>
                )}
                <div
                  className={`relative rounded-full p-1 ${
                    p.joined
                      ? "bg-gradient-to-br from-petal via-gold to-petal shadow-[0_0_40px_hsl(var(--petal)/0.55)]"
                      : "bg-white/10"
                  }`}
                >
                  <div className="rounded-full bg-velvet p-1">
                    <UserAvatar url={url} name={name} size={96} />
                  </div>
                </div>
                {p.isMe && muted && (
                  <span className="absolute bottom-0 right-0 size-8 rounded-full bg-red-500/90 border-2 border-velvet flex items-center justify-center">
                    <MicOff className="size-4 text-white" />
                  </span>
                )}
              </div>
              <div className="text-center">
                <p className="text-sm font-medium truncate max-w-[10rem]">
                  {name}{p.isMe && <span className="text-candle-muted text-xs"> · you</span>}
                </p>
                <p className={`text-[10px] uppercase tracking-[0.2em] ${p.joined ? "text-emerald-300" : "text-candle-muted"}`}>
                  {p.joined ? "Connected" : "Ringing…"}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AvatarFallback({ name, url }: { name: string; url: string | null }) {
  return (
    <div className="w-full h-full bg-gradient-to-br from-velvet via-surface to-velvet flex items-center justify-center">
      <div className="rounded-full p-1 bg-gradient-to-br from-petal via-gold to-petal">
        <div className="rounded-full bg-velvet p-1">
          <UserAvatar url={url} name={name} size={96} />
        </div>
      </div>
    </div>
  );
}
