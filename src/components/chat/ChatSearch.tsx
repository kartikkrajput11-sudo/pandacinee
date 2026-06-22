import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import type { MessageRow } from "@/lib/chat";

export function ChatSearch({
  messages,
  onJump,
}: {
  messages: MessageRow[];
  onJump: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return messages
      .filter((m) => (m.content ?? "").toLowerCase().includes(term))
      .slice(-50)
      .reverse();
  }, [q, messages]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Search messages"
        className="size-10 rounded-full bg-surface border border-border flex items-center justify-center text-petal"
      >
        <Search className="size-4" />
      </button>
    );
  }

  return (
    <div className="absolute inset-x-0 top-0 z-20 bg-velvet/95 backdrop-blur border-b border-border">
      <div className="flex items-center gap-2 px-3 py-3">
        <Search className="size-4 text-candle-muted" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search this chat…"
          className="flex-1 bg-transparent outline-none text-sm text-candle placeholder:text-candle-muted"
        />
        <button onClick={() => { setOpen(false); setQ(""); }} className="text-candle-muted">
          <X className="size-4" />
        </button>
      </div>
      {q && (
        <div className="max-h-64 overflow-y-auto border-t border-border">
          {results.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-candle-muted">No matches</p>
          ) : (
            results.map((m) => (
              <button
                key={m.id}
                onClick={() => { onJump(m.id); setOpen(false); setQ(""); }}
                className="w-full text-left px-4 py-2 hover:bg-surface border-b border-border/40"
              >
                <p className="text-sm text-candle line-clamp-2">{m.content}</p>
                <p className="text-[10px] text-candle-muted mt-0.5">
                  {new Date(m.created_at).toLocaleString()}
                </p>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
