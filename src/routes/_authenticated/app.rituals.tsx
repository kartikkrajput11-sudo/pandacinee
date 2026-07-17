import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Flame, Heart, Wind, X, Check, Coins, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { awardRitualCoins } from "@/lib/achievements.functions";
import { RITUAL_REWARD } from "@/lib/achievements";

export const Route = createFileRoute("/_authenticated/app/rituals")({
  component: RitualsRoute,
});

type RitualKind = "gratitude" | "breathing" | "candle";

type Ritual = {
  id: string;
  host_id: string;
  partner_id: string;
  kind: RitualKind;
  state: any;
  status: "active" | "ended";
  started_at: string;
  ended_at: string | null;
};

const RITUALS: {
  id: RitualKind;
  name: string;
  emoji: string;
  Icon: typeof Heart;
  blurb: string;
  minutes: number;
}[] = [
  { id: "gratitude", name: "Three Thank-Yous", emoji: "🌸", Icon: Heart, blurb: "Take turns naming three small things about today.", minutes: 3 },
  { id: "breathing", name: "Breathe Together", emoji: "🫧", Icon: Wind, blurb: "Guided 4-7-8. Match each other's breath.", minutes: 2 },
  { id: "candle", name: "Candle Hour", emoji: "🕯️", Icon: Flame, blurb: "Both phones dim. A shared candle melts down.", minutes: 3 },
];

function RitualsRoute() {
  const { data } = useProfile();
  const me = data?.profile;
  const partner = data?.partner;
  const [active, setActive] = useState<Ritual | null>(null);
  const [starting, setStarting] = useState<RitualKind | null>(null);

  async function loadActive() {
    if (!me || !partner) return;
    const { data: rows } = await (supabase as any)
      .from("rituals")
      .select("*")
      .eq("status", "active")
      .or(
        `and(host_id.eq.${me.id},partner_id.eq.${partner.id}),and(host_id.eq.${partner.id},partner_id.eq.${me.id})`,
      )
      .order("started_at", { ascending: false })
      .limit(1);
    setActive(((rows ?? [])[0] as Ritual) ?? null);
  }
  useEffect(() => {
    loadActive();
  }, [me?.id, partner?.id]);

  useEffect(() => {
    if (!me || !partner) return;
    const ch = supabase
      .channel("rituals")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rituals" },
        () => loadActive(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id, partner?.id]);

  async function start(kind: RitualKind) {
    if (!me || !partner) return;
    setStarting(kind);
    const meta = RITUALS.find((r) => r.id === kind)!;
    const endsAt = new Date(Date.now() + meta.minutes * 60_000).toISOString();
    const { data: created, error } = await (supabase as any)
      .from("rituals")
      .insert({
        host_id: me.id,
        partner_id: partner.id,
        kind,
        state: { endsAt, step: 0, acks: {} },
        status: "active",
      })
      .select("*")
      .single();
    setStarting(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    setActive(created as Ritual);
  }

  async function endRitual() {
    if (!active) return;
    await (supabase as any)
      .from("rituals")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("id", active.id);
    setActive(null);
  }

  return (
    <div className="pt-10 px-5 pb-20">
      <header className="flex items-center gap-3 mb-6">
        <Link to="/app" className="text-candle-muted">
          <ArrowLeft className="size-5" />
        </Link>
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-petal">Nightly</p>
          <h1 className="font-serif text-2xl italic">Rituals & Candles</h1>
        </div>
      </header>

      {!partner && (
        <div className="p-5 mb-5 rounded-3xl border border-petal/30 bg-petal-soft">
          <p className="text-sm text-candle">
            Rituals are for two. <Link to="/app/invite" className="text-petal underline">Pair with your panda →</Link>
          </p>
        </div>
      )}

      {partner && !active && (
        <div className="space-y-3">
          {RITUALS.map((r) => (
            <button
              key={r.id}
              onClick={() => start(r.id)}
              disabled={starting !== null}
              className="w-full text-left p-5 rounded-3xl glass-strong hover:-translate-y-0.5 transition-transform disabled:opacity-60 flex items-start gap-4"
            >
              <div className="size-14 rounded-2xl bg-petal-soft border border-petal/30 flex items-center justify-center text-2xl shrink-0">
                {r.emoji}
              </div>
              <div className="flex-1">
                <p className="font-serif italic text-xl leading-tight">{r.name}</p>
                <p className="text-xs text-candle-muted mt-1">{r.blurb}</p>
                <div className="flex items-center gap-3 mt-2">
                  <p className="text-[10px] uppercase tracking-widest text-petal">{r.minutes} min</p>
                  <p className="text-[10px] uppercase tracking-widest text-petal/80 inline-flex items-center gap-1">
                    <Coins className="size-3" /> +{RITUAL_REWARD[r.id] ?? 15} each
                  </p>
                </div>
              </div>
              <div className="text-petal font-serif italic text-2xl mt-1 opacity-60">→</div>
            </button>
          ))}
        </div>
      )}

      {partner && active && me && (
        <ActiveRitual ritual={active} me={me.id} onEnd={endRitual} />
      )}
    </div>
  );
}

function ActiveRitual({ ritual, me, onEnd }: { ritual: Ritual; me: string; onEnd: () => void }) {
  const [now, setNow] = useState(Date.now());
  const [awarded, setAwarded] = useState<{ reward: number; already: boolean } | null>(null);
  const [awarding, setAwarding] = useState(false);
  const award = useServerFn(awardRitualCoins);

  useEffect(() => {
    // Tick every second — matches "melts every second" and drives the flame flicker.
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const endsAt = new Date(ritual.state?.endsAt ?? Date.now()).getTime();
  const totalMs = endsAt - new Date(ritual.started_at).getTime();
  const remaining = Math.max(0, endsAt - now);
  const progress = Math.min(1, 1 - remaining / totalMs);
  const meta = RITUALS.find((r) => r.id === ritual.kind)!;

  const acks = (ritual.state?.acks ?? {}) as Record<string, number>;
  const otherId = ritual.host_id === me ? ritual.partner_id : ritual.host_id;
  const meDone = !!acks[me];
  const theyDone = !!acks[otherId];

  async function patchState(patch: Record<string, unknown>) {
    await (supabase as any).from("rituals").update({ state: { ...ritual.state, ...patch } }).eq("id", ritual.id);
  }

  async function ackStep() {
    await patchState({ acks: { ...acks, [me]: (acks[me] ?? 0) + 1 } });
  }

  // On completion, auto-claim coins.
  useEffect(() => {
    if (remaining > 0 || awarded || awarding || ritual.state?.coins_awarded) {
      if (ritual.state?.coins_awarded && !awarded) {
        setAwarded({ reward: ritual.state?.reward ?? 0, already: true });
      }
      return;
    }
    setAwarding(true);
    award({ data: { ritualId: ritual.id } })
      .then((res: any) => {
        setAwarded({ reward: res?.reward ?? 0, already: !!res?.alreadyAwarded });
      })
      .catch((e) => {
        toast.error(e?.message ?? "Couldn't award coins");
      })
      .finally(() => setAwarding(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining <= 0]);

  if (remaining <= 0) {
    return (
      <div className="p-8 rounded-3xl bg-gradient-to-br from-petal-soft via-transparent to-transparent border border-petal/30 text-center">
        <p className="text-5xl mb-3">{meta.emoji}</p>
        <p className="font-serif italic text-2xl">Held together.</p>
        <p className="text-sm text-candle-muted mt-2 mb-4">
          {meta.name} · {meta.minutes} min · both hearts steady
        </p>
        <div className="mx-auto mb-5 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-petal-soft border border-petal/40">
          <Coins className="size-4 text-petal" />
          <span className="text-petal font-semibold">
            {awarding
              ? "Counting the coins…"
              : awarded
                ? awarded.already
                  ? "Already collected"
                  : `+${awarded.reward} coins each`
                : `+${RITUAL_REWARD[ritual.kind] ?? 15} coins each`}
          </span>
        </div>
        <div className="flex gap-2 justify-center">
          <Link
            to="/app/shop"
            className="px-5 py-3 bg-petal text-velvet rounded-full font-semibold inline-flex items-center gap-2"
          >
            <Sparkles className="size-4" /> Spend on tags
          </Link>
          <button onClick={onEnd} className="px-5 py-3 rounded-full font-semibold border border-border text-candle">
            Close
          </button>
        </div>
      </div>
    );
  }


  return (
    <div className="relative">
      <div className="rounded-3xl overflow-hidden bg-gradient-to-b from-velvet via-[#1a0810] to-velvet border border-petal/20 min-h-[440px] flex flex-col items-center justify-center p-6 text-center relative">
        {/* Ambient glow */}
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{
            background: `radial-gradient(circle at 50% ${45 + Math.sin(now / 1000) * 8}%, rgba(232, 196, 100, 0.35), transparent 60%)`,
          }}
        />

        {ritual.kind === "candle" && <CandleVisual progress={progress} now={now} />}
        {ritual.kind === "breathing" && <BreathVisual now={now} />}
        {ritual.kind === "gratitude" && <GratitudeVisual acks={acks} />}

        <div className="relative z-10 mt-6">
          <p className="text-[10px] uppercase tracking-[0.25em] text-petal mb-1">
            {meta.name}
          </p>
          <p className="font-serif italic text-3xl text-candle mb-1">
            {formatMs(remaining)}
          </p>
          <p className="text-xs text-candle-muted">until this settles</p>
        </div>

        <div className="relative z-10 mt-6 flex items-center gap-3">
          <StatusDot on={meDone} label="You" />
          <StatusDot on={theyDone} label="Them" />
        </div>

        {ritual.kind === "gratitude" && (
          <button
            onClick={ackStep}
            className="relative z-10 mt-6 px-6 py-3 bg-petal text-velvet rounded-full font-semibold inline-flex items-center gap-2"
          >
            <Check className="size-4" /> Named one
          </button>
        )}
      </div>

      <button
        onClick={onEnd}
        className="absolute top-4 right-4 z-20 size-8 rounded-full bg-velvet/60 border border-white/10 flex items-center justify-center text-candle-muted"
        aria-label="End early"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

function CandleVisual({ progress, now }: { progress: number; now: number }) {
  // Real candle: melts every second across a 3-minute burn. Height goes from
  // 100% → ~8% linearly, with a soft rounded top and a drip streak on the side.
  const MAX_H = 170;
  const MIN_H = 14;
  const height = Math.max(MIN_H, MAX_H - progress * (MAX_H - MIN_H));

  // Flame flicker — deterministic wobble driven by `now` so both partners
  // stay in loose visual sync (they see similar phase).
  const flick = Math.sin(now / 140) * 0.35 + Math.sin(now / 71) * 0.15;
  const flameH = 34 + flick * 6;
  const flameW = 18 - Math.abs(flick) * 2;
  const flameOffset = Math.sin(now / 210) * 1.6;
  const glowOpacity = 0.55 + Math.sin(now / 180) * 0.12;

  // Wax drip length grows with progress.
  const dripLen = 8 + progress * 42;

  return (
    <div className="relative flex flex-col items-center z-10" aria-label="Melting candle">
      {/* Halo of light */}
      <div
        className="absolute -inset-16 rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(circle, rgba(255,190,90,${glowOpacity}) 0%, rgba(232,140,60,0.15) 40%, transparent 70%)`,
          filter: "blur(12px)",
        }}
      />

      {/* Flame */}
      <div
        className="relative"
        style={{
          transform: `translateX(${flameOffset}px) rotate(${flameOffset * 1.2}deg)`,
          transition: "transform 120ms linear",
        }}
      >
        <div
          style={{
            width: flameW,
            height: flameH,
            background:
              "radial-gradient(ellipse at 50% 80%, #fff2b0 0%, #ffcf5c 25%, #ff8a2b 55%, #b13a0a 85%, transparent 100%)",
            borderRadius: "50% 50% 45% 45% / 65% 65% 35% 35%",
            filter: "blur(0.4px) drop-shadow(0 0 14px rgba(255,170,60,0.9))",
          }}
        />
        {/* Inner blue core */}
        <div
          className="absolute left-1/2 -translate-x-1/2"
          style={{
            bottom: 2,
            width: flameW * 0.35,
            height: flameH * 0.35,
            background:
              "radial-gradient(ellipse, rgba(140,200,255,0.9) 0%, rgba(140,200,255,0) 70%)",
            borderRadius: "50%",
          }}
        />
      </div>

      {/* Wick */}
      <div className="w-[2px] h-2 bg-[#2a1005] -mt-1 z-10" />

      {/* Wax body */}
      <div
        className="relative w-14 shrink-0 overflow-visible"
        style={{
          height: `${height}px`,
          background:
            "linear-gradient(180deg,#faf3d6 0%,#f2dc99 25%,#e6c07a 55%,#c8975c 100%)",
          borderRadius: "12px 12px 6px 6px",
          boxShadow:
            "inset -6px 0 12px rgba(120,70,20,0.35), inset 6px 0 10px rgba(255,240,190,0.6), 0 0 40px rgba(255,180,80,0.35)",
          transition: "height 1000ms linear",
        }}
      >
        {/* Melted top pool */}
        <div
          className="absolute -top-1 left-1/2 -translate-x-1/2 w-14 h-3 rounded-[50%]"
          style={{
            background:
              "radial-gradient(ellipse at 50% 30%, #fff2c8 0%, #e6b866 60%, #a06a2a 100%)",
            boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
          }}
        />
        {/* Wax drip on the side */}
        <div
          className="absolute top-1 -right-1 w-2 rounded-b-full"
          style={{
            height: `${dripLen}px`,
            background:
              "linear-gradient(180deg,#f2dc99 0%,#e6c07a 60%,#c8975c 100%)",
            boxShadow: "inset -1px 0 2px rgba(80,40,10,0.4)",
            transition: "height 1000ms linear",
          }}
        />
      </div>

      {/* Holder / base */}
      <div
        className="w-20 h-3 rounded-b-2xl -mt-0.5"
        style={{
          background: "linear-gradient(180deg,#3a1a10 0%,#1a0805 100%)",
          boxShadow: "0 6px 14px rgba(0,0,0,0.5)",
        }}
      />
      <div className="w-24 h-1 rounded-full bg-[#0e0303] mt-0.5" />

      {/* Melt readout */}
      <p className="text-[10px] uppercase tracking-widest text-petal/80 mt-3">
        {Math.round((1 - progress) * 100)}% left
      </p>
    </div>
  );
}


function BreathVisual({ now }: { now: number }) {
  // 4s in, 7s hold, 8s out — visualize as expanding circle
  const cycle = 19_000;
  const t = (now % cycle) / cycle;
  const phase = t < 4 / 19 ? "in" : t < 11 / 19 ? "hold" : "out";
  const size = phase === "in" ? 90 + (t / (4 / 19)) * 120 : phase === "hold" ? 210 : 210 - ((t - 11 / 19) / (8 / 19)) * 120;
  return (
    <div className="relative flex flex-col items-center z-10">
      <div
        className="rounded-full bg-gradient-to-br from-petal/40 to-transparent border border-petal/40"
        style={{ width: size, height: size, transition: "width 200ms, height 200ms" }}
      />
      <p className="font-serif italic text-xl text-candle mt-4 capitalize">{phase}</p>
    </div>
  );
}

function GratitudeVisual({ acks }: { acks: Record<string, number> }) {
  const total = Object.values(acks).reduce((s, v) => s + v, 0);
  return (
    <div className="relative z-10 flex flex-col items-center">
      <p className="text-5xl mb-2">🌸</p>
      <p className="font-serif italic text-2xl text-candle">{total} named</p>
      <p className="text-xs text-candle-muted mt-1">take turns · three each</p>
    </div>
  );
}

function StatusDot({ on, label }: { on: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`size-2 rounded-full ${on ? "bg-petal shadow-[0_0_8px_rgba(255,140,150,0.7)]" : "bg-candle-muted/40"}`} />
      <span className="text-[10px] uppercase tracking-widest text-candle-muted">{label}</span>
    </div>
  );
}

function formatMs(ms: number) {
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}
