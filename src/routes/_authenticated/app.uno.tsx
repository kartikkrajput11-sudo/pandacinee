import { createFileRoute, Link } from "@tanstack/react-router";
import { GameBackLink } from "@/components/games/GameBackLink";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, RotateCcw, Send, User, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import {
  initialState,
  playCard,
  chooseWildColor,
  drawTurn,
  canPlay,
  callUno,
  catchUno,
  top,
  COLORS,
  VALUE_LABEL,
  type UnoState,
  type UnoCard,
  type UnoColor,
  type UnoPlayer,
} from "@/lib/uno";
import { sfxReaction, sfxPollVote, sfxKiss } from "@/lib/sfx";
import { GroupPlayersBar } from "@/components/games/GroupPlayersBar";
import { GameChat } from "@/components/games/GameChat";


export const Route = createFileRoute("/_authenticated/app/uno")({
  component: UnoPage,
  validateSearch: (search: Record<string, unknown>) => ({
    matchId: typeof search.matchId === "string" ? search.matchId : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Uno — PandaCine" },
      { name: "description", content: "Play a luxury Uno with your panda." },
    ],
  }),
});


type Mode = "partner" | "local";

// Color -> velvet gradient tokens
const COLOR_GRAD: Record<UnoColor | "wild", string> = {
  red:    "linear-gradient(140deg, oklch(0.62 0.22 25), oklch(0.42 0.18 25))",
  yellow: "linear-gradient(140deg, oklch(0.82 0.17 88), oklch(0.58 0.14 70))",
  green:  "linear-gradient(140deg, oklch(0.62 0.17 155), oklch(0.38 0.14 160))",
  blue:   "linear-gradient(140deg, oklch(0.60 0.17 250), oklch(0.36 0.14 260))",
  wild:   "conic-gradient(from 140deg, oklch(0.62 0.22 25), oklch(0.82 0.17 88), oklch(0.62 0.17 155), oklch(0.60 0.17 250), oklch(0.62 0.22 25))",
};

const COLOR_SWATCH: Record<UnoColor, string> = {
  red:    "oklch(0.62 0.22 25)",
  yellow: "oklch(0.82 0.17 88)",
  green:  "oklch(0.62 0.17 155)",
  blue:   "oklch(0.60 0.17 250)",
};

function UnoPage() {
  const { data } = useProfile();
  const me = data?.profile;
  const { matchId } = Route.useSearch();
  const [matchOpponentId, setMatchOpponentId] = useState<string | null>(null);

  // If arrived from a group match lobby, resolve the seated opponent so we can
  // auto-enter partner mode and skip the mode picker.
  useEffect(() => {
    if (!matchId || !me) return;
    let cancelled = false;
    (async () => {
      const { data: rows } = await supabase
        .from("group_match_participants" as never)
        .select("user_id,role,seat")
        .eq("match_id", matchId)
        .eq("role", "player")
        .order("seat", { ascending: true });
      if (cancelled) return;
      const players = ((rows ?? []) as { user_id: string }[]).map((r) => r.user_id);
      const opp = players.find((id) => id !== me.id) ?? null;
      setMatchOpponentId(opp);
    })();
    return () => { cancelled = true; };
  }, [matchId, me]);

  const partner = matchId
    ? (matchOpponentId ? { id: matchOpponentId } as { id: string } : null)
    : data?.partner;
  const [mode, setMode] = useState<Mode | null>(null);
  // Auto-enter partner mode when we arrived from a group match with an opponent seated.
  useEffect(() => {
    if (matchId && partner && !mode) setMode("partner");
  }, [matchId, partner, mode]);
  const [state, setState] = useState<UnoState>(() => initialState());
  const [flashId, setFlashId] = useState<string | null>(null);
  const [deckPulse, setDeckPulse] = useState(0);
  const [dealNonce, setDealNonce] = useState(0);
  const [chat, setChat] = useState<{ id: string; from: UnoPlayer; text: string; at: number }[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [unoBurst, setUnoBurst] = useState<{ n: number; from: UnoPlayer } | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // In partner mode: lower UUID plays "you", partner plays "them".
  const mySeat: UnoPlayer = useMemo(() => {
    if (mode !== "partner" || !me || !partner) return "you";
    return me.id < partner.id ? "you" : "them";
  }, [mode, me, partner]);


  const stateRef = useRef<UnoState>(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const chRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  useEffect(() => {
    if (mode !== "partner" || !me || !partner) return;
    const key = matchId ?? [me.id, partner.id].sort().join(":");
    const isHost = me.id < partner.id;

    const ch = supabase.channel(`uno:${key}`, { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: "state" }, ({ payload }) => {
      setState(payload as UnoState);
    });
    ch.on("broadcast", { event: "hello" }, () => {
      // Host answers late-joiner with the authoritative current state.
      if (isHost) {
        ch.send({ type: "broadcast", event: "state", payload: stateRef.current });
      }
    });
    ch.on("broadcast", { event: "chat" }, ({ payload }) => {
      setChat((prev) => [...prev, payload as { id: string; from: UnoPlayer; text: string; at: number }]);
      sfxReaction();
    });
    ch.on("broadcast", { event: "uno-call" }, ({ payload }) => {
      setUnoBurst({ n: Date.now(), from: (payload as { from: UnoPlayer }).from });
      sfxKiss();
    });
    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        // Announce presence — host will echo the current state so both sides match.
        ch.send({ type: "broadcast", event: "hello", payload: { from: me.id } });
      }
    });
    chRef.current = ch;
    return () => { ch.unsubscribe(); chRef.current = null; };
  }, [mode, me?.id, partner?.id, matchId]);

  function sync(next: UnoState) {
    setState(next);
    if (mode === "partner" && chRef.current) {
      chRef.current.send({ type: "broadcast", event: "state", payload: next });
    }
  }

  function sendChat() {
    const text = chatDraft.trim();
    if (!text) return;
    const msg = { id: crypto.randomUUID(), from: mySeat, text, at: Date.now() };
    setChat((prev) => [...prev, msg]);
    setChatDraft("");
    if (mode === "partner" && chRef.current) {
      chRef.current.send({ type: "broadcast", event: "chat", payload: msg });
    }
  }

  useEffect(() => {
    const el = chatScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.length]);

  // From the seat's perspective, remap "you"/"them" for display.
  // We store state with fixed "you"/"them" seats. In partner mode `mySeat` decides
  // whose hand is shown at the bottom.
  const isMyTurn = state.turn === mySeat && !state.winner;
  const myHand = state.hands[mySeat];
  const theirHand = state.hands[mySeat === "you" ? "them" : "you"];
  const topCard = top(state);

  function handlePlay(card: UnoCard) {
    if (!isMyTurn) { toast("Not your turn"); return; }
    if (!canPlay(state, card)) { toast("Doesn't match", { description: "Match color, value, or play a Wild." }); return; }
    setFlashId(card.id);
    setTimeout(() => setFlashId(null), 500);
    if (card.color === "wild") {
      // Ask for color
      const ns = playCard(state, mySeat, card.id);
      sfxReaction();
      sync(ns);
      return;
    }
    const ns = playCard(state, mySeat, card.id);
    sfxPollVote();
    if (ns.winner) sfxKiss();
    sync(ns);
  }

  function handleDraw() {
    if (!isMyTurn) { toast("Not your turn"); return; }
    sfxReaction();
    setDeckPulse((n) => n + 1);
    sync(drawTurn(state, mySeat));
  }

  function handleColor(color: UnoColor) {
    if (state.awaitingWildFrom !== mySeat) return;
    sfxPollVote();
    const ns = chooseWildColor(state, mySeat, color);
    if (ns.winner) sfxKiss();
    sync(ns);
  }

  function handleCallUno() {
    if (state.hands[mySeat].length !== 1 || state.unoCalled[mySeat] || state.winner) return;
    const ns = callUno(state, mySeat);
    sfxKiss();
    setUnoBurst({ n: Date.now(), from: mySeat });
    sync(ns);
    if (mode === "partner" && chRef.current) {
      chRef.current.send({ type: "broadcast", event: "uno-call", payload: { from: mySeat } });
    }
  }

  function handleCatch() {
    const opp: UnoPlayer = mySeat === "you" ? "them" : "you";
    if (state.hands[opp].length !== 1 || state.unoCalled[opp] || state.winner) return;
    sfxReaction();
    toast("Caught silent!", { description: "+2 penalty cards dealt." });
    sync(catchUno(state, mySeat));
  }

  function reset() {
    if (mode === "partner" && !state.winner) {
      if (!window.confirm("Reshuffle and deal a new hand? This resets the match for both of you.")) return;
    }
    const s = initialState();
    setDealNonce((n) => n + 1);
    sync(s);
  }

  // Auto: if it's opponent's turn in LOCAL mode, we let both players share the phone.
  // Nothing automatic — pass and play.

  if (matchId && !mode) {
    return (
      <div className="min-h-screen flex items-center justify-center text-candle-muted text-sm italic">
        Dealing the group table…
      </div>
    );
  }

  if (!mode) {

    return (
      <div className="min-h-screen relative overflow-hidden">
        <UnoAmbient />
        <div className="relative z-10 pt-10 px-5 pb-20">
          <header className="flex items-center gap-3 mb-8">
            <GameBackLink className="text-candle-muted">
              <ArrowLeft className="size-5" />
            </GameBackLink>
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-petal">Card salon</p>
              <h1 className="font-serif text-3xl italic">Uno, velveteen</h1>
            </div>
          </header>

          <div className="relative rounded-[28px] p-6 border border-petal/30 bg-surface/70 backdrop-blur-xl shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)] overflow-hidden">
            <div className="absolute inset-0 pointer-events-none opacity-40"
              style={{ background: "radial-gradient(120% 80% at 50% 0%, color-mix(in oklab, var(--petal) 22%, transparent), transparent 60%)" }} />
            <p className="relative text-[10px] uppercase tracking-[0.3em] text-petal mb-2">Choose your table</p>
            <h2 className="relative font-serif italic text-2xl mb-5">How will you play?</h2>

            <div className="relative flex flex-col gap-3">
              <button
                type="button"
                onClick={() => setMode("partner")}
                disabled={!partner}
                className="group relative rounded-2xl p-4 border border-petal/30 bg-gradient-to-br from-petal/10 to-transparent text-left disabled:opacity-40 hover:border-petal/60 transition-all"
              >
                <div className="flex items-center gap-3">
                  <Users className="size-5 text-petal" />
                  <div>
                    <p className="font-serif italic text-lg">With your panda</p>
                    <p className="text-xs text-candle-muted">Long-distance, live sync</p>
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setMode("local")}
                className="group relative rounded-2xl p-4 border border-border bg-surface-elevated/60 text-left hover:border-petal/60 transition-all"
              >
                <div className="flex items-center gap-3">
                  <User className="size-5 text-candle" />
                  <div>
                    <p className="font-serif italic text-lg">Side-by-side</p>
                    <p className="text-xs text-candle-muted">Pass the phone each turn</p>
                  </div>
                </div>
              </button>
              {!partner && (
                <p className="text-xs text-candle-muted mt-1">Pair with a partner to unlock live play.</p>
              )}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-4 gap-2">
            {(["red","yellow","green","blue"] as UnoColor[]).map((c) => (
              <div key={c} className="aspect-[2/3] rounded-2xl border border-white/10 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.6)]"
                style={{ background: COLOR_GRAD[c] }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {matchId && <GroupPlayersBar matchId={matchId} meId={me?.id} gameName="Uno" />}
      <UnoAmbient />
      <div className="relative z-10 pt-8 px-4 pb-24">
        {/* Header */}
        <header className="flex items-center justify-between mb-4">
          <button type="button" onClick={() => setMode(null)} className="text-candle-muted">
            <ArrowLeft className="size-5" />
          </button>
          <div className="text-center">
            <p className="text-[9px] uppercase tracking-[0.3em] text-petal">Uno · velveteen</p>
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={reset} className="text-candle-muted">
              <RotateCcw className="size-5" />
            </button>
          </div>
        </header>

        {/* Opponent hand (face down) */}
        <div className="mb-5">
          <p className="text-[9px] uppercase tracking-widest text-candle-muted text-center mb-2">
            {mode === "partner" ? "Panda" : "Player 2"} · {theirHand.length} cards
          </p>
          <div className="flex justify-center -space-x-6">
            {theirHand.slice(0, 10).map((c, i) => (
              <div
                key={c.id}
                className="uno-oppo-card w-11 h-16 rounded-lg border border-petal/30 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.6)]"
                style={{
                  background: "linear-gradient(135deg, oklch(0.22 0.06 340), oklch(0.14 0.04 340))",
                  transform: `rotate(${(i - Math.min(theirHand.length,10)/2) * 3}deg)`,
                  animationDelay: `${i * 40}ms`,
                }}
              >
                <div className="w-full h-full rounded-lg flex items-center justify-center">
                  <div className="w-6 h-8 rounded-sm rotate-12 border border-petal/40"
                    style={{ background: "radial-gradient(circle at 30% 30%, color-mix(in oklab, var(--petal) 60%, transparent), transparent 70%)" }} />
                </div>
              </div>
            ))}
            {theirHand.length > 10 && (
              <span className="ml-2 text-xs text-candle-muted self-center">+{theirHand.length - 10}</span>
            )}
          </div>
        </div>

        {/* Table: deck + discard + active color */}
        <div className={`uno-table relative rounded-[28px] p-5 border bg-gradient-to-b from-petal/10 to-transparent backdrop-blur-xl mb-5 transition-all duration-500 ${
          isMyTurn && !state.winner ? "uno-table-active border-petal/60" : "border-petal/25"
        }`}>
          <div className="absolute inset-0 pointer-events-none rounded-[28px] opacity-30"
            style={{ background: "radial-gradient(60% 60% at 50% 50%, color-mix(in oklab, var(--petal) 25%, transparent), transparent 70%)" }} />


          {/* Turn banner — sits on the table so it's impossible to miss */}
          <div className="relative flex justify-center mb-4">
            <div
              key={`turn-${isMyTurn}-${state.winner ?? "live"}`}
              className={`uno-turn-banner px-5 py-2 rounded-full border backdrop-blur-md shadow-[0_10px_30px_-10px_rgba(0,0,0,0.7)] ${
                state.winner
                  ? "border-petal/50 bg-velvet/70"
                  : isMyTurn
                    ? "border-petal/70 bg-petal/25"
                    : "border-white/10 bg-velvet/60"
              }`}
            >
              <p className="text-[9px] uppercase tracking-[0.35em] text-petal text-center">
                {state.winner ? "Round over" : isMyTurn ? "Your turn" : "Their turn"}
              </p>
              <p className={`font-serif italic text-center leading-tight ${isMyTurn && !state.winner ? "text-candle text-lg" : "text-candle-muted text-base"}`}>
                {state.winner
                  ? (state.winner === mySeat ? "You reign." : "They reign.")
                  : isMyTurn
                    ? "Play a card or draw"
                    : "Waiting for them…"}
              </p>
            </div>
          </div>

          <div className="relative flex items-center justify-center gap-4">

            {/* Deck */}
            <button
              key={`deck-${deckPulse}`}
              type="button"
              onClick={handleDraw}
              disabled={!isMyTurn || !!state.awaitingWildFrom}
              className="uno-deck-draw relative w-20 h-28 rounded-xl border border-petal/40 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.7)] disabled:opacity-50 transition-transform hover:-translate-y-1 active:translate-y-0"
              style={{ background: "linear-gradient(135deg, oklch(0.22 0.06 340), oklch(0.12 0.04 340))" }}
            >
              <div className="absolute inset-1 rounded-lg border border-petal/30 flex items-center justify-center">
                <span className="font-serif italic text-petal text-lg">Uno</span>
              </div>
              {state.pendingDraw > 0 && (
                <span className="uno-pending-badge absolute -top-2 -right-2 bg-petal text-velvet text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg">
                  +{state.pendingDraw}
                </span>
              )}
            </button>

            {/* Discard top */}
            <div className="relative">
              <div key={topCard.id} className="uno-discard">
                <UnoCardVisual card={topCard} activeColor={state.activeColor} large />
              </div>
              <div
                className="absolute -inset-3 rounded-2xl pointer-events-none"
                style={{
                  background: `radial-gradient(60% 60% at 50% 50%, ${topCard.color === "wild" ? COLOR_SWATCH[state.activeColor] : COLOR_SWATCH[topCard.color as UnoColor]} , transparent 70%)`,
                  opacity: 0.35,
                  filter: "blur(14px)",
                }}
              />
            </div>

            {/* Active color chip */}
            <div className="flex flex-col items-center gap-1">
              <span className="text-[9px] uppercase tracking-widest text-candle-muted">Color</span>
              <div
                key={`chip-${state.activeColor}`}
                className="uno-color-chip w-8 h-8 rounded-full border border-white/20 shadow-[0_10px_20px_-10px_rgba(0,0,0,0.7)]"
                style={{ background: COLOR_SWATCH[state.activeColor] }}
              />
            </div>
          </div>

          {state.lastAction && (
            <p className="relative text-center text-[11px] italic text-candle-muted mt-3 font-serif">
              {state.lastAction}
            </p>
          )}
        </div>

        {/* Wild color picker */}
        {state.awaitingWildFrom === mySeat && (
          <div className="uno-wild-picker mb-5 rounded-2xl p-4 border border-petal/40 bg-surface/80 backdrop-blur-xl">
            <p className="text-[10px] uppercase tracking-widest text-petal mb-2">Declare a color</p>
            <div className="grid grid-cols-4 gap-2">
              {COLORS.map((c, i) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => handleColor(c)}
                  className="uno-wild-swatch aspect-square rounded-xl border border-white/10 hover:scale-105 transition-transform shadow-[0_10px_30px_-10px_rgba(0,0,0,0.7)]"
                  style={{ background: COLOR_GRAD[c], animationDelay: `${i * 70}ms` }}
                />
              ))}
            </div>
          </div>
        )}

        {/* My hand */}
        <div>
          <div className="flex items-center justify-center gap-3 mb-2">
            <p className="text-[9px] uppercase tracking-widest text-candle-muted">
              You · {myHand.length} {myHand.length === 1 ? "card" : "cards"}
            </p>
            {(myHand.length === 1 && !state.unoCalled[mySeat] && !state.winner) && (
              <button
                type="button"
                onClick={handleCallUno}
                aria-label="Call Uno"
                className="rounded-full px-3 py-1 text-[10px] uppercase tracking-widest font-serif italic border border-petal/40 bg-surface/80 text-petal hover:bg-petal/10 transition-colors shadow-[0_6px_18px_-8px_rgba(0,0,0,0.6)]"
              >
                Call Uno
              </button>
            )}
            {(theirHand.length === 1 && !state.unoCalled[mySeat === "you" ? "them" : "you"] && !state.winner) && (
              <button
                type="button"
                onClick={handleCatch}
                className="rounded-full px-3 py-1 text-[10px] uppercase tracking-widest font-serif italic border border-border bg-surface/80 text-candle-muted hover:text-candle hover:border-petal/40 transition-colors shadow-[0_6px_18px_-8px_rgba(0,0,0,0.6)]"
              >
                Catch silent
              </button>
            )}
          </div>
          <div className="flex justify-center overflow-x-auto no-scrollbar py-6 -mx-4 px-4">
            <div className="flex items-end" style={{ paddingLeft: 24, paddingRight: 24 }}>
              {myHand.map((c, i) => {
                const mid = (myHand.length - 1) / 2;
                const rot = ((i - mid) / Math.max(mid, 1)) * 10;
                const y = Math.abs((i - mid) / Math.max(mid, 1)) * 6;
                const playable = isMyTurn && canPlay(state, c);
                return (
                  <button
                    key={`${dealNonce}-${c.id}`}
                    type="button"
                    onClick={() => handlePlay(c)}
                    className="uno-hand-card"
                    style={{
                      marginLeft: i === 0 ? 0 : -22,
                      transform: `rotate(${rot}deg) translateY(${y}px)`,
                      opacity: playable ? 1 : 0.55,
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      ["--deal-delay" as any]: `${i * 55}ms`,
                    }}
                    data-flash={flashId === c.id ? "1" : undefined}
                    data-playable={playable ? "1" : undefined}
                  >
                    <UnoCardVisual card={c} activeColor={state.activeColor} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>


        {/* UNO! call burst */}
        {unoBurst && (
          <UnoCallBurst
            key={unoBurst.n}
            fromMe={unoBurst.from === mySeat}
            onDone={() => setUnoBurst(null)}
          />
        )}

        {/* Table-side chat */}
        {mode === "partner" && (
          <div className="mt-6 rounded-2xl border border-petal/25 bg-surface/80 backdrop-blur-xl overflow-hidden lg:fixed lg:top-24 lg:right-4 lg:w-72 lg:mt-0 lg:z-30 lg:shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)]">
            <div className="px-4 py-2 border-b border-petal/15 flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.3em] text-petal">Table talk</p>
              <p className="text-[10px] text-candle-muted">{chat.length} whispers</p>
            </div>
            <div ref={chatScrollRef} className="max-h-40 lg:max-h-[60vh] overflow-y-auto px-3 py-2 space-y-1.5">
              {chat.length === 0 ? (
                <p className="text-xs italic text-candle-muted text-center py-3 font-serif">Say something velvet…</p>
              ) : chat.map((m) => {
                const mine = m.from === mySeat;
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[80%] px-3 py-1.5 rounded-2xl text-sm ${mine ? "bg-petal text-velvet rounded-br-sm" : "bg-surface-elevated text-candle rounded-bl-sm border border-border"}`}
                    >
                      {m.text}
                    </div>
                  </div>
                );
              })}
            </div>
            <form
              onSubmit={(e) => { e.preventDefault(); sendChat(); }}
              className="flex items-center gap-2 px-3 py-2 border-t border-petal/15 bg-surface-elevated/50"
            >
              <input
                type="text"
                value={chatDraft}
                onChange={(e) => setChatDraft(e.target.value)}
                placeholder="Whisper to your panda…"
                maxLength={200}
                className="flex-1 bg-transparent outline-none text-sm placeholder:text-candle-muted/70"
              />
              <button
                type="submit"
                disabled={!chatDraft.trim()}
                className="rounded-full p-2 bg-petal text-velvet disabled:opacity-40 hover:brightness-110 transition"
              >
                <Send className="size-4" />
              </button>
            </form>
          </div>
        )}



        {/* Winner overlay */}
        {state.winner && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-velvet/80 backdrop-blur-xl animate-fade-in">
            {/* Ambient rays behind everything */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-[520px] h-[520px] max-w-[95vw] max-h-[95vw]">
                <div className="uno-win-rays" />
                <div className="uno-win-ring" />
              </div>
            </div>

            {/* Card burst */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {Array.from({ length: 18 }).map((_, i) => {
                const angle = (i / 18) * Math.PI * 2;
                const dist = 180 + (i % 3) * 40;
                const color = [COLOR_SWATCH.red, COLOR_SWATCH.yellow, COLOR_SWATCH.green, COLOR_SWATCH.blue][i % 4];
                const grad = COLOR_GRAD[(["red","yellow","green","blue"] as UnoColor[])[i % 4]];
                return (
                  <div
                    key={`c-${i}`}
                    className="uno-win-card"
                    style={{
                      background: grad,
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      ["--tx" as any]: `${Math.cos(angle) * dist}px`,
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      ["--ty" as any]: `${Math.sin(angle) * dist}px`,
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      ["--tr" as any]: `${(i * 47) % 360}deg`,
                      animationDelay: `${(i % 6) * 120}ms`,
                      boxShadow: `0 20px 40px -12px ${color}80`,
                    }}
                  />
                );
              })}
              {/* Sparks */}
              {Array.from({ length: 14 }).map((_, i) => (
                <span
                  key={`s-${i}`}
                  className="uno-win-spark"
                  style={{
                    left: `${(i * 71) % 100}%`,
                    top: `${60 + (i * 13) % 30}%`,
                    animationDelay: `${(i * 180) % 2400}ms`,
                  }}
                />
              ))}
            </div>

            <div className="relative rounded-3xl border border-petal/40 bg-surface/90 p-8 max-w-sm w-full text-center overflow-hidden">
              <div className="absolute inset-0 pointer-events-none opacity-70"
                style={{ background: "radial-gradient(60% 60% at 50% 30%, color-mix(in oklab, var(--petal) 35%, transparent), transparent 70%)" }} />
              <div className="relative">
                <div className="uno-win-crown text-5xl mb-2 leading-none">👑</div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-petal">Salon closes</p>
                <h2 className="uno-win-title font-serif italic text-4xl mt-1 mb-3">
                  {state.winner === mySeat ? "You win" : "They win"}
                </h2>
                <p className="text-sm text-candle-muted mb-5 font-serif italic">
                  {state.winner === mySeat ? "The last card, a curtsy." : "Well played, panda."}
                </p>
                <button
                  type="button"
                  onClick={reset}
                  className="w-full rounded-full py-3 bg-petal text-velvet font-serif italic tracking-wide hover:brightness-110 transition"
                >
                  Deal again
                </button>
              </div>
              {/* confetti-like drift */}
              <div className="pointer-events-none absolute inset-0">
                {Array.from({ length: 18 }).map((_, i) => (
                  <span
                    key={i}
                    className="uno-confetti absolute block w-2 h-3 rounded-sm"
                    style={{
                      left: `${(i * 73) % 100}%`,
                      top: `${(i * 41) % 100}%`,
                      background: [COLOR_SWATCH.red, COLOR_SWATCH.yellow, COLOR_SWATCH.green, COLOR_SWATCH.blue][i % 4],
                      animationDelay: `${i * 0.12}s`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      {me && (mode === "partner" || matchId) && partner && (
        <GameChat
          roomKey={matchId ?? `uno:${[me.id, partner.id].sort().join(":")}`}
          me={me}
          partnerName={"display_name" in partner ? partner.display_name : null}
          title="Table talk"
        />
      )}

    </div>
  );
}


function UnoAmbient() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <div className="absolute -top-24 -left-16 w-72 h-72 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, oklch(0.62 0.22 25 / 0.5), transparent 70%)" }} />
      <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, oklch(0.60 0.17 250 / 0.5), transparent 70%)" }} />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[120%] h-64 opacity-30 blur-3xl"
        style={{ background: "radial-gradient(ellipse, oklch(0.62 0.17 155 / 0.35), transparent 70%)" }} />
    </div>
  );
}

function UnoCardVisual({ card, large = false }: { card: UnoCard; activeColor: UnoColor; large?: boolean }) {
  const w = large ? 84 : 60;
  const h = large ? 118 : 88;
  const bg = COLOR_GRAD[card.color];
  const label = VALUE_LABEL[card.value];
  return (
    <div
      className="relative rounded-xl border border-white/15 shadow-[0_18px_36px_-18px_rgba(0,0,0,0.7)] overflow-hidden"
      style={{ width: w, height: h, background: bg }}
    >
      {/* inner oval */}
      <div className="absolute inset-[10%] rounded-[50%] bg-white/95 flex items-center justify-center rotate-[-20deg]">
        <span
          className="font-serif italic font-bold"
          style={{
            fontSize: large ? 34 : 24,
            color: card.color === "wild" ? "oklch(0.2 0.04 340)" : COLOR_SWATCH[card.color as UnoColor],
            textShadow: "0 1px 0 rgba(0,0,0,0.15)",
          }}
        >
          {label}
        </span>
      </div>
      {/* corner labels */}
      <span
        className="absolute top-1 left-1.5 font-serif italic font-bold text-white/90"
        style={{ fontSize: large ? 14 : 11 }}
      >
        {label}
      </span>
      <span
        className="absolute bottom-1 right-1.5 font-serif italic font-bold text-white/90 rotate-180"
        style={{ fontSize: large ? 14 : 11 }}
      >
        {label}
      </span>
      {/* sheen */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "linear-gradient(140deg, rgba(255,255,255,0.18), transparent 40%)" }} />
    </div>
  );
}

function UnoCallBurst({ fromMe, onDone }: { fromMe: boolean; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1800);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="fixed inset-0 z-[60] pointer-events-none flex items-center justify-center">
      <div className="uno-burst-backdrop absolute inset-0" />
      {/* Radiating color rays */}
      <div className="uno-burst-rays absolute" />
      {/* Petal ring */}
      <div className="uno-burst-ring absolute" />
      {/* Confetti cards */}
      {Array.from({ length: 22 }).map((_, i) => {
        const angle = (i / 22) * Math.PI * 2;
        const dist = 220 + (i % 4) * 40;
        const colors = [
          "oklch(0.62 0.22 25)",
          "oklch(0.82 0.17 88)",
          "oklch(0.62 0.17 155)",
          "oklch(0.60 0.17 250)",
        ];
        return (
          <span
            key={i}
            className="uno-burst-chip absolute"
            style={{
              background: colors[i % 4],
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ["--tx" as any]: `${Math.cos(angle) * dist}px`,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ["--ty" as any]: `${Math.sin(angle) * dist}px`,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ["--tr" as any]: `${(i * 53) % 360}deg`,
              animationDelay: `${(i % 6) * 60}ms`,
            }}
          />
        );
      })}
      {/* The word */}
      <div className="uno-burst-word relative font-serif italic">
        <span className="uno-burst-word-inner">UNO!</span>
        <span className="uno-burst-word-sub block text-center text-[10px] uppercase tracking-[0.4em] mt-2 text-petal">
          {fromMe ? "You called it" : "They called it"}
        </span>
      </div>
    </div>
  );
}
