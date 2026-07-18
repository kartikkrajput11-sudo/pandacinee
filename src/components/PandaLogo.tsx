import { cn } from "@/lib/utils";
import logoUrl from "@/assets/pandacine-logo.png";

export function PandaLogo({ className, showWordmark = true }: { className?: string; showWordmark?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <img
        src={logoUrl}
        alt="Pandacine"
        width={40}
        height={40}
        loading="lazy"
        className="size-10 object-contain drop-shadow-[0_2px_8px_rgba(147,51,234,0.35)]"
      />
      {showWordmark && (
        <span className="font-serif text-xl italic tracking-tight">PANDACINE</span>
      )}
    </div>
  );
}
