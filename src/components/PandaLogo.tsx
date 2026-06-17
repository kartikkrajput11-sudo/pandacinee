import { cn } from "@/lib/utils";

export function PandaLogo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="relative size-8 rounded-full bg-candle flex items-center justify-center">
        {/* ears */}
        <span className="absolute -top-1 -left-1 size-3 rounded-full bg-velvet" />
        <span className="absolute -top-1 -right-1 size-3 rounded-full bg-velvet" />
        {/* eyes */}
        <span className="absolute top-2.5 left-1.5 size-1.5 rounded-full bg-velvet" />
        <span className="absolute top-2.5 right-1.5 size-1.5 rounded-full bg-velvet" />
        {/* nose */}
        <span className="absolute bottom-2 size-1 rounded-full bg-petal" />
      </div>
      <span className="font-serif text-xl italic tracking-tight">PANDACINE</span>
    </div>
  );
}
