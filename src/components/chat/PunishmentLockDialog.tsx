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

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-velvet/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full sm:max-w-md bg-surface border border-border sm:rounded-3xl rounded-t-3xl p-5 max-h-[85vh] overflow-y-auto">
        <header className="flex items-center gap-2 mb-4">
          <Lock className="size-4 text-petal" />
          <h2 className="font-serif italic text-lg flex-1">
            Lock {targetName}'s chat
          </h2>
          <button onClick={() => { reset(); onClose(); }} className="text-candle-muted">
            <X className="size-5" />
          </button>
        </header>

        {step === 1 && (
          <div className="grid grid-cols-2 gap-2">
            {PUNISHMENT_TYPES.map((p) => (
              <button
                key={p.id}
                onClick={() => pickType(p.id)}
                className="rounded-2xl border border-border bg-velvet hover:border-petal/50 p-3 text-left transition-colors"
              >
                <div className="text-2xl mb-1">{p.emoji}</div>
                <p className="text-sm font-medium text-candle">{p.label}</p>
                <p className="text-[10px] text-candle-muted mt-0.5">{p.hint}</p>
              </button>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <p className="text-[10px] uppercase tracking-widest text-petal">
              {meta.emoji} {meta.label}
            </p>
            <div>
              <label className="block text-xs text-candle-muted mb-1.5">Presets</label>
              <div className="flex gap-2 flex-wrap">
                {meta.presets.map((pr) => (
                  <button
                    key={pr.prompt}
                    onClick={() => {
                      setPrompt(pr.prompt);
                      if (pr.count) setCount(pr.count);
                    }}
                    className={`text-xs px-3 py-1.5 rounded-full border ${
                      prompt === pr.prompt
                        ? "border-petal bg-petal-soft text-candle"
                        : "border-border bg-velvet text-candle-muted"
                    }`}
                  >
                    {pr.prompt}
                    {pr.count ? ` · ${pr.count}` : ""}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs text-candle-muted mb-1.5">Prompt</label>
              <input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                maxLength={140}
                className="w-full bg-velvet border border-border rounded-2xl px-4 py-2.5 text-sm text-candle"
              />
            </div>
            {meta.countable && (
              <div>
                <label className="block text-xs text-candle-muted mb-1.5">
                  Required count: <span className="text-candle">{count}</span>
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
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setStep(1)}
                className="flex-1 py-2.5 rounded-full bg-velvet border border-border text-sm text-candle"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-1 py-2.5 rounded-full bg-petal text-velvet text-sm font-semibold"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <p className="text-[10px] uppercase tracking-widest text-petal">Max duration</p>
            <div className="grid grid-cols-2 gap-2">
              {DURATION_OPTIONS.map((d) => (
                <button
                  key={d.label}
                  onClick={() => setDuration(d.seconds)}
                  className={`py-2.5 rounded-2xl border text-sm ${
                    duration === d.seconds
                      ? "border-petal bg-petal-soft text-candle"
                      : "border-border bg-velvet text-candle-muted"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <div className="rounded-2xl bg-velvet border border-border p-3 text-xs text-candle-muted">
              <p className="text-candle mb-1">{meta.emoji} {meta.label}</p>
              <p>"{prompt}"{meta.countable ? ` · ${count} times` : ""}</p>
              <p className="mt-1 text-[10px]">Playful & consensual only.</p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setStep(2)}
                disabled={busy}
                className="flex-1 py-2.5 rounded-full bg-velvet border border-border text-sm text-candle"
              >
                Back
              </button>
              <button
                onClick={submit}
                disabled={busy}
                className="flex-1 py-2.5 rounded-full bg-petal text-velvet text-sm font-semibold disabled:opacity-60"
              >
                {busy ? "Locking…" : "🔒 Lock chat"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
