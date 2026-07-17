import { useState } from "react";
import { toast } from "sonner";
import {
  Heart, HeartHandshake, Sparkles, Lock, Unlock, Film, BookOpen,
  Volume2, MessageSquare, Bell, Crown, Flame, Hand, Play,
} from "lucide-react";
import { KissOverlay } from "@/components/chat/KissOverlay";
import { HugOverlay } from "@/components/chat/HugOverlay";
import { HeadpatOverlay } from "@/components/chat/HeadpatOverlay";
import { UnlockCelebration } from "@/components/chat/UnlockCelebration";
import OwnersStoryOverlay from "@/components/OwnersStoryOverlay";
import { Petals } from "@/components/Petals";
import { sfxSend, sfxReceive, sfxReaction, sfxKiss, sfxPollVote } from "@/lib/sfx";
import { sfx as chessSfx } from "@/lib/chess-sfx";

type Section = {
  title: string;
  desc: string;
  icon: React.ReactNode;
  entries: { label: string; onTest: () => void; hint?: string }[];
};

export default function AnimationsTab() {
  const [kissTrigger, setKissTrigger] = useState(0);
  const [hugTrigger, setHugTrigger] = useState(0);
  const [headpatTrigger, setHeadpatTrigger] = useState(0);
  const [unlockTrigger, setUnlockTrigger] = useState(0);
  const [storyOpen, setStoryOpen] = useState(false);
  const [petalsOn, setPetalsOn] = useState(false);
  const [anniv, setAnniv] = useState<null | { name: string; label: string }>(null);
  const [notif, setNotif] = useState<null | string>(null);

  const sections: Section[] = [
    {
      title: "Affection overlays",
      desc: "Full-screen intimate cinematics used in DMs.",
      icon: <Heart className="size-3.5 text-petal" />,
      entries: [
        { label: "Kiss — lipstick imprint", onTest: () => { setKissTrigger((v) => v + 1); sfxKiss(); } },
        { label: "Hug — warm arcs & heart ring", onTest: () => setHugTrigger((v) => v + 1) },
        { label: "Headpat — golden ripple", onTest: () => setHeadpatTrigger((v) => v + 1) },
      ],
    },
    {
      title: "Ceremonies & celebrations",
      desc: "Ritual moments the app celebrates in-place.",
      icon: <Sparkles className="size-3.5 text-petal" />,
      entries: [
        { label: "Unlock celebration — ribbons & lock swap", onTest: () => setUnlockTrigger((v) => v + 1) },
        {
          label: "Pair anniversary — milestone card",
          onTest: () => {
            setAnniv({ name: "your beloved", label: "3rd Month Together" });
            window.setTimeout(() => setAnniv(null), 4200);
          },
        },
        {
          label: "Owners' monthiversary — story overlay",
          onTest: () => setStoryOpen(true),
        },
        {
          label: "Petals rain — ambient",
          onTest: () => {
            setPetalsOn(true);
            window.setTimeout(() => setPetalsOn(false), 5000);
          },
        },
      ],
    },
    {
      title: "System notifications",
      desc: "Toasts and slide-ins used across the site.",
      icon: <Bell className="size-3.5 text-petal" />,
      entries: [
        {
          label: "Partner message notifier — top-right slide",
          onTest: () => {
            setNotif("New message from your love");
            window.setTimeout(() => setNotif(null), 3000);
          },
        },
        { label: "Success toast", onTest: () => toast.success("Saved to the velvet vault ✨") },
        { label: "Error toast", onTest: () => toast.error("The stars misaligned — try again") },
        { label: "Info toast", onTest: () => toast("A gentle reminder…") },
      ],
    },
    {
      title: "Chat sound effects",
      desc: "Chiptune-style WebAudio pings used in messaging.",
      icon: <MessageSquare className="size-3.5 text-petal" />,
      entries: [
        { label: "Send tone", onTest: sfxSend },
        { label: "Receive tone", onTest: sfxReceive },
        { label: "Reaction ping", onTest: sfxReaction },
        { label: "Kiss chime", onTest: sfxKiss },
        { label: "Poll vote click", onTest: sfxPollVote },
      ],
    },
    {
      title: "Chess sound effects",
      desc: "Wooden clicks, thunder stinger, and match audio.",
      icon: <Crown className="size-3.5 text-petal" />,
      entries: [
        { label: "Move (wooden click)", onTest: () => chessSfx.move() },
        { label: "Capture (crunchier thud)", onTest: () => chessSfx.capture() },
        { label: "Check (two-note alert)", onTest: () => chessSfx.check() },
        { label: "Castle (double click)", onTest: () => chessSfx.castle() },
        { label: "Promote (shimmer up)", onTest: () => chessSfx.promote() },
        { label: "Game start", onTest: () => chessSfx.gameStart() },
        { label: "Draw", onTest: () => chessSfx.draw() },
        { label: "Lose", onTest: () => chessSfx.lose() },
        { label: "Win — thunderstorm cinematic", onTest: () => chessSfx.winCinematic() },
      ],
    },
    {
      title: "Micro animations",
      desc: "Small CSS keyframes reused across the UI.",
      icon: <Flame className="size-3.5 text-petal" />,
      entries: [
        { label: "Fade-in", onTest: () => bump("anim-demo-fade") },
        { label: "Scale-in", onTest: () => bump("anim-demo-scale") },
        { label: "Slide-in-right", onTest: () => bump("anim-demo-slide") },
        { label: "Hover-scale (hover the tile →)", onTest: () => bump("anim-demo-hover") },
      ],
    },
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-surface p-4">
        <p className="text-[10px] uppercase tracking-widest text-petal flex items-center gap-1.5 mb-1">
          <Play className="size-3" /> Animation lab
        </p>
        <h2 className="font-serif text-xl italic">Preview every animation live</h2>
        <p className="text-xs text-candle-muted mt-1">
          Each button plays the exact animation currently deployed to users, right here in the console.
        </p>
      </div>

      {sections.map((s) => (
        <section key={s.title}>
          <div className="flex items-center gap-1.5 mb-2 px-1">
            {s.icon}
            <p className="text-[11px] uppercase tracking-widest text-candle-muted font-semibold">{s.title}</p>
          </div>
          <p className="text-xs text-candle-muted mb-3 px-1">{s.desc}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {s.entries.map((e) => (
              <div
                key={e.label}
                className="rounded-2xl border border-border bg-surface p-3.5 flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-candle font-medium truncate">{e.label}</p>
                  {e.hint && <p className="text-[11px] text-candle-muted truncate">{e.hint}</p>}
                </div>
                <button
                  onClick={e.onTest}
                  className="shrink-0 h-8 px-3 rounded-full bg-petal text-velvet text-[11px] font-semibold flex items-center gap-1 hover:brightness-110 active:scale-95 transition"
                >
                  <Play className="size-3" /> Test
                </button>
              </div>
            ))}
          </div>
        </section>
      ))}

      {/* Live animation demos ─────────────────────────────── */}
      <MicroDemos />

      {/* Overlay hosts */}
      <KissOverlay trigger={kissTrigger} />
      <HugOverlay trigger={hugTrigger} />
      <HeadpatOverlay trigger={headpatTrigger} />
      <UnlockCelebration trigger={unlockTrigger} />
      <OwnersStoryOverlay open={storyOpen} onClose={() => setStoryOpen(false)} />
      {petalsOn && (
        <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
          <Petals count={20} />
        </div>
      )}
      {anniv && <AnnivPreview name={anniv.name} label={anniv.label} />}
      {notif && <NotifPreview text={notif} />}
    </div>
  );
}

function bump(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove("anim-play");
  // force reflow to restart animation
  void el.offsetWidth;
  el.classList.add("anim-play");
}

function MicroDemos() {
  return (
    <section>
      <div className="flex items-center gap-1.5 mb-2 px-1">
        <Sparkles className="size-3.5 text-petal" />
        <p className="text-[11px] uppercase tracking-widest text-candle-muted font-semibold">
          Live demo stage
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <DemoTile id="anim-demo-fade" label="Fade-in" className="anim-fade" />
        <DemoTile id="anim-demo-scale" label="Scale-in" className="anim-scale" />
        <DemoTile id="anim-demo-slide" label="Slide-in-right" className="anim-slide" />
        <DemoTile id="anim-demo-hover" label="Hover-scale" className="transition-transform duration-200 hover:scale-105" />
      </div>
      <style>{`
        #anim-demo-fade.anim-play { animation: adm-fade .5s ease-out both; }
        #anim-demo-scale.anim-play { animation: adm-scale .4s ease-out both; }
        #anim-demo-slide.anim-play { animation: adm-slide .5s ease-out both; }
        @keyframes adm-fade { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        @keyframes adm-scale { from { opacity: 0; transform: scale(.85); } to { opacity: 1; transform: none; } }
        @keyframes adm-slide { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: none; } }
      `}</style>
    </section>
  );
}

function DemoTile({ id, label, className }: { id: string; label: string; className?: string }) {
  return (
    <div
      id={id}
      className={`aspect-square rounded-2xl border border-petal/30 bg-gradient-to-br from-petal/20 to-transparent flex items-center justify-center text-xs text-candle text-center px-2 ${className ?? ""}`}
    >
      {label}
    </div>
  );
}

function AnnivPreview({ name, label }: { name: string; label: string }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-velvet/70 backdrop-blur-sm animate-fade-in">
      <div className="rounded-3xl border border-petal/40 bg-surface px-8 py-6 text-center shadow-2xl shadow-petal/30 animate-scale-in">
        <Heart className="size-8 text-petal mx-auto mb-2" fill="currentColor" />
        <p className="text-[10px] uppercase tracking-widest text-petal">Milestone</p>
        <p className="font-serif text-2xl italic text-candle mt-1">{label}</p>
        <p className="text-xs text-candle-muted mt-1">with {name}</p>
      </div>
    </div>
  );
}

function NotifPreview({ text }: { text: string }) {
  return (
    <div className="fixed top-4 right-4 z-50 rounded-2xl border border-petal/30 bg-surface px-4 py-3 shadow-xl shadow-petal/20 animate-slide-in-right flex items-center gap-2">
      <MessageSquare className="size-4 text-petal" />
      <span className="text-sm text-candle">{text}</span>
    </div>
  );
}
