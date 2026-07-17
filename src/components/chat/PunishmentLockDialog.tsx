import { useState } from "react";
import { X, Lock } from "lucide-react";
import { toast } from "sonner";
import {
  PUNISHMENT_TYPES,
  DURATION_OPTIONS,
  containsBlocked,
  typeMeta,
  type PunishmentType,
} from "@/lib/punishment";

type Props = {
  open: boolean;
  onClose: () => void;
  targetName: string;
  mePrefs?: Record<string, boolean> | null;
  peerPrefs?: Record<string, boolean> | null;
  onCreate: (input: {
    type: PunishmentType;
    prompt: string;
    required_count: number;
    max_duration_seconds: number | null;
  }) => Promise<void>;
};

export function PunishmentLockDialog({ open, onClose, targetName, mePrefs, peerPrefs, onCreate }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [type, setType] = useState<PunishmentType>("write");
  const [prompt, setPrompt] = useState("Sorry ❤️");
  const [count, setCount] = useState(20);
  const [duration, setDuration] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) return null;
  const meta = typeMeta(type);

  function reset() {
    setStep(1);
    setType("write");
    setPrompt("Sorry ❤️");
    setCount(20);
    setDuration(null);
    setBusy(false);
  }

  function pickType(t: PunishmentType) {
    setType(t);
    const m = typeMeta(t);
    setPrompt(m.presets[0]?.prompt ?? "");
    setCount(m.presets[0]?.count ?? m.defaultCount);
    setStep(2);
  }

  async function submit() {
    const clean = prompt.trim();
    if (!clean) return toast.error("Add a prompt");
    if (containsBlocked(clean))
      return toast.error("Keep it playful ❤️ — that word isn't allowed");
    if (clean.length > 140) return toast.error("Keep the prompt short");
    setBusy(true);
    try {
      await onCreate({
        type,
        prompt: clean,
        required_count: meta.countable ? Math.max(1, Math.min(100, count)) : 1,
        max_duration_seconds: duration,
      });
      toast.success(`Chat locked for ${targetName} 🔒`);
      reset();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't lock chat");
    } finally {
      setBusy(false);
    }
  }

  const steps = [1, 2, 3] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center animate-fade-in">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-velvet/80 backdrop-blur-md" onClick={() => { reset(); onClose(); }} />
      <div
        className="absolute inset-0 pointer-events-none opacity-70"
        style={{
          background:
            "radial-gradient(50% 40% at 50% 0%, rgba(236,72,153,0.18), transparent 70%), radial-gradient(45% 45% at 100% 100%, rgba(217,164,102,0.12), transparent 70%)",
        }}
      />

      {/* Sheet */}
      <div
        className="studio-surface relative w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl p-5 max-h-[88vh] overflow-y-auto border shadow-[0_30px_80px_-30px_rgba(236,72,153,0.55)]"
        style={{
          borderColor: "hsl(38 55% 62% / 0.25)",
        }}
      >
        {/* Champagne hairline */}
        <div
          className="absolute inset-x-0 top-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, hsl(38 60% 68% / 0.7), transparent)" }}
        />

        <header className="flex items-center gap-3 mb-5">
          {/* Mini wax seal */}
          <div
            className="relative size-9 rounded-full flex items-center justify-center shrink-0"
            style={{
              background:
                "conic-gradient(from 210deg, hsl(38 55% 62%), hsl(340 55% 45%), hsl(285 45% 32%), hsl(38 55% 62%))",
              boxShadow:
                "0 8px 20px -10px rgba(236,72,153,0.6), inset 0 1px 0 rgba(255,255,255,0.25)",
            }}
          >
            <div className="size-[30px] rounded-full bg-background/85 flex items-center justify-center">
              <Lock className="size-3.5 text-petal" strokeWidth={1.7} />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[9px] uppercase tracking-[0.38em] text-petal">Chambre Privée</p>
            <h2 className="font-serif italic text-lg text-candle truncate">
              A ritual for {targetName}
            </h2>
          </div>
          <button
            onClick={() => { reset(); onClose(); }}
            className="size-8 rounded-full bg-candle/[0.05] hover:bg-candle/[0.09] border border-border text-candle-muted flex items-center justify-center transition-colors"
          >
            <X className="size-4" />
          </button>
        </header>

        {/* Stepper */}
        <div className="flex items-center gap-2 mb-5">
          {steps.map((n, i) => (
            <div key={n} className="flex items-center gap-2 flex-1">
              <div
                className={`h-6 flex-1 rounded-full flex items-center justify-center text-[9px] uppercase tracking-[0.28em] font-medium border transition-all ${
                  step === n
                    ? "text-velvet border-transparent"
                    : step > n
                      ? "text-petal border-petal/40 bg-petal/10"
                      : "text-candle-muted border-border bg-candle/[0.03]"
                }`}
                style={
                  step === n
                    ? {
                        background:
                          "linear-gradient(135deg, hsl(38 62% 68%), hsl(340 65% 60%))",
                        boxShadow: "0 6px 16px -8px rgba(236,72,153,0.6)",
                      }
                    : undefined
                }
              >
                {n === 1 ? "Ritual" : n === 2 ? "Prompt" : "Terms"}
              </div>
              {i < steps.length - 1 && (
                <span className="size-1 rotate-45 bg-petal/40" />
              )}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="grid grid-cols-2 gap-2.5">
            {PUNISHMENT_TYPES.filter((p) => {
              if (!p.optInKey) return true;
              const meOK = mePrefs?.[p.optInKey] !== false;
              const peerOK = peerPrefs?.[p.optInKey] !== false;
              return meOK && peerOK;
            }).map((p) => (
              <button
                key={p.id}
                onClick={() => pickType(p.id)}
                className="group relative rounded-2xl border border-border hover:border-petal/50 bg-gradient-to-b from-candle/[0.05] to-candle/[0.02] p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-16px_rgba(236,72,153,0.6)]"
              >
                <div className="text-2xl mb-1">{p.emoji}</div>
                <p className="font-serif italic text-sm text-candle">{p.label}</p>
                <p className="text-[10px] text-candle-muted mt-0.5 leading-snug">{p.hint}</p>
                {p.mode === "verify" && (
                  <p className="text-[9px] text-petal mt-1.5 uppercase tracking-[0.28em]">Verified</p>
                )}
                <span
                  className="absolute top-2 right-2 size-1 rotate-45 bg-petal/50 opacity-0 group-hover:opacity-100 transition-opacity"
                />
              </button>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-gradient-to-r from-transparent to-petal/40" />
              <p className="text-[9px] uppercase tracking-[0.38em] text-petal">
                {meta.emoji} {meta.label}
              </p>
              <span className="h-px flex-1 bg-gradient-to-l from-transparent to-petal/40" />
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-[0.28em] text-candle-muted mb-2">Presets</label>
              <div className="flex gap-2 flex-wrap">
                {meta.presets.map((pr) => {
                  const active = prompt === pr.prompt;
                  return (
                    <button
                      key={pr.prompt}
                      onClick={() => {
                        setPrompt(pr.prompt);
                        if (pr.count) setCount(pr.count);
                      }}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                        active
                          ? "border-transparent text-velvet"
                          : "border-border bg-candle/[0.04] text-candle-muted hover:border-petal/40 hover:text-candle"
                      }`}
                      style={
                        active
                          ? {
                              background:
                                "linear-gradient(135deg, hsl(38 62% 68%), hsl(340 65% 60%))",
                              boxShadow: "0 6px 16px -8px rgba(236,72,153,0.55)",
                            }
                          : undefined
                      }
                    >
                      {pr.prompt}
                      {pr.count ? ` · ${pr.count}` : ""}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-[0.28em] text-candle-muted mb-2">Prompt</label>
              <input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                maxLength={140}
                className="w-full bg-candle/[0.04] border border-border focus:border-petal/50 rounded-2xl px-4 py-3 text-sm text-candle placeholder:text-candle-muted/60 outline-none transition-colors"
              />
            </div>

            {meta.countable && (
              <div>
                <label className="flex justify-between items-baseline text-[10px] uppercase tracking-[0.28em] text-candle-muted mb-2">
                  <span>Required count</span>
                  <span className="text-candle font-serif italic text-base normal-case tracking-normal">{count}</span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  className="w-full accent-petal"
                />
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <GhostButton onClick={() => setStep(1)}>Back</GhostButton>
              <GoldButton onClick={() => setStep(3)}>Next</GoldButton>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-gradient-to-r from-transparent to-petal/40" />
              <p className="text-[9px] uppercase tracking-[0.38em] text-petal">Terms of the seal</p>
              <span className="h-px flex-1 bg-gradient-to-l from-transparent to-petal/40" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              {DURATION_OPTIONS.map((d) => {
                const active = duration === d.seconds;
                return (
                  <button
                    key={d.label}
                    onClick={() => setDuration(d.seconds)}
                    className={`py-2.5 rounded-2xl border text-sm transition-all ${
                      active
                        ? "border-transparent text-velvet"
                        : "border-border bg-candle/[0.04] text-candle-muted hover:border-petal/40 hover:text-candle"
                    }`}
                    style={
                      active
                        ? {
                            background:
                              "linear-gradient(135deg, hsl(38 62% 68%), hsl(340 65% 60%))",
                            boxShadow: "0 6px 16px -8px rgba(236,72,153,0.55)",
                          }
                        : undefined
                    }
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>

            {/* Decree card */}
            <div
              className="studio-surface relative rounded-2xl p-4 border overflow-hidden"
              style={{
                borderColor: "hsl(38 55% 62% / 0.3)",
              }}
            >
              <div
                className="absolute inset-x-0 top-0 h-px"
                style={{ background: "linear-gradient(90deg, transparent, hsl(38 60% 68% / 0.7), transparent)" }}
              />
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{meta.emoji}</span>
                <p className="font-serif italic text-candle">{meta.label}</p>
              </div>
              <p className="font-serif italic text-candle/90 text-sm leading-snug">
                <span className="text-petal">&ldquo;</span>
                {prompt}
                <span className="text-petal">&rdquo;</span>
                {meta.countable ? (
                  <span className="text-candle-muted"> · {count} times</span>
                ) : null}
              </p>
              <div className="flex items-center gap-2 mt-3">
                <span className="h-px flex-1 bg-petal/20" />
                <span className="text-petal/70 text-sm">❦</span>
                <span className="h-px flex-1 bg-petal/20" />
              </div>
              <p className="text-[10px] text-candle-muted text-center mt-2 tracking-wide">
                Playful & consensual only.
              </p>
            </div>

            <div className="flex gap-2 pt-1">
              <GhostButton onClick={() => setStep(2)} disabled={busy}>Back</GhostButton>
              <GoldButton onClick={submit} disabled={busy}>
                {busy ? "Sealing…" : "Seal the chat"}
              </GoldButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function GoldButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex-1 py-3 rounded-full text-[11px] uppercase tracking-[0.28em] font-medium text-velvet disabled:opacity-60 active:scale-[0.99] transition-transform"
      style={{
        background: "linear-gradient(135deg, hsl(38 62% 68%) 0%, hsl(340 65% 60%) 55%, hsl(38 62% 68%) 100%)",
        boxShadow:
          "0 12px 26px -12px rgba(236,72,153,0.6), inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -2px 0 rgba(0,0,0,0.15)",
      }}
    >
      {children}
    </button>
  );
}

function GhostButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex-1 py-3 rounded-full text-[11px] uppercase tracking-[0.28em] font-medium text-candle bg-candle/[0.04] border border-border hover:border-petal/40 hover:text-petal disabled:opacity-60 transition-colors"
    >
      {children}
    </button>
  );
}
