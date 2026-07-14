import { Lock, X, MessageCircle } from "lucide-react";
import { typeMeta, type PunishmentLock } from "@/lib/punishment";

type Props = {
  lock: PunishmentLock;
  targetName: string;
  onCancel: (id: string) => void;
  onOpenVerification?: () => void;
  hasPending?: boolean;
};

export function PunishmentLockBanner({ lock, targetName, onCancel, onOpenVerification, hasPending }: Props) {
  const meta = typeMeta(lock.type);
  const isVerify = meta.mode === "verify";
  const pct = Math.round((lock.progress / lock.required_count) * 100);
  return (
    <div className="px-4 py-2 border-b border-petal/30 bg-petal-soft/20 flex items-center gap-3">
      <Lock className="size-4 text-petal shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-candle truncate">
          <span className="text-petal font-medium">You locked {targetName}</span>{" "}
          · {meta.emoji} {isVerify ? "verify" : `${lock.progress}/${lock.required_count}`} · "{lock.prompt}"
        </p>
        {!isVerify && (
          <div className="h-1 mt-1 rounded-full bg-surface overflow-hidden">
            <div className="h-full bg-petal transition-all" style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>
      {isVerify && onOpenVerification && (
        <button
          onClick={onOpenVerification}
          className={`relative text-xs px-3 py-1.5 rounded-full font-semibold ${hasPending ? "bg-petal text-velvet animate-pulse" : "bg-velvet border border-border text-candle"}`}
        >
          <MessageCircle className="size-3 inline mr-1" />
          Review{hasPending ? " · 1" : ""}
        </button>
      )}
      <button
        onClick={() => onCancel(lock.id)}
        className="text-candle-muted hover:text-petal"
        aria-label="Cancel punishment"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
