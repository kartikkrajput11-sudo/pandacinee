import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Coins, Pencil, Check, Sparkles, Flame } from "lucide-react";
import { toast } from "sonner";
import { PandaStage } from "@/components/panda/PandaStage";
import { Button } from "@/components/ui/button";
import { getPet, renamePet, savePetProgress, unlockPet } from "@/lib/pet.functions";

export const Route = createFileRoute("/_authenticated/app/pet")({
  head: () => ({
    meta: [
      { title: "Your Panda — PANDACINE" },
      { name: "description", content: "Adopt, name and play with your very own PANDACINE panda." },
      { property: "og:title", content: "Your Panda — PANDACINE" },
      { property: "og:description", content: "Adopt, name and play with your very own PANDACINE panda." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PetRoute,
});

function PetRoute() {
  const qc = useQueryClient();
  const fetchPet = useServerFn(getPet);
  const adopt = useServerFn(unlockPet);
  const rename = useServerFn(renamePet);
  const save = useServerFn(savePetProgress);

  const { data, isLoading } = useQuery({ queryKey: ["pet"], queryFn: () => fetchPet({ data: undefined as never }) });
  const pet = data?.pet;
  const coins = data?.coins ?? 0;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [adoptName, setAdoptName] = useState("Pan");
  const counter = useRef({ interactions: 0, affection: 0 });

  const adoptM = useMutation({
    mutationFn: () => adopt({ data: { name: adoptName } }),
    onSuccess: () => {
      toast.success("Your panda is home 🐼");
      qc.invalidateQueries({ queryKey: ["pet"] });
      qc.invalidateQueries({ queryKey: ["profile", "me"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Couldn't adopt"),
  });

  const renameM = useMutation({
    mutationFn: (name: string) => rename({ data: { name } }),
    onSuccess: () => {
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["pet"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Couldn't rename"),
  });

  // Persist play progress every 20s while there's something new.
  useEffect(() => {
    if (!pet?.unlocked) return;
    const id = window.setInterval(() => {
      const c = counter.current;
      if (c.interactions === 0) return;
      void save({ data: { interactions: (pet.interactions ?? 0) + c.interactions, affection: c.affection } }).catch(
        () => undefined,
      );
    }, 20_000);
    return () => window.clearInterval(id);
  }, [pet?.unlocked, pet?.interactions, save]);

  const name = pet?.name ?? "Pan";

  return (
    <div className="relative px-5 pt-8 pb-28 space-y-6">
      <header className="flex items-center gap-3">
        <Link to="/app" aria-label="Back" className="grid size-10 place-items-center rounded-full glass">
          <ArrowLeft className="size-4" />
        </Link>
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-[0.24em] text-petal">Your companion</p>
          <h1 className="font-serif text-2xl italic leading-tight">The Panda</h1>
        </div>
        <span className="flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-sm">
          <Coins className="size-4 text-petal" />
          <span className="tabular-nums font-semibold text-petal">{coins}</span>
        </span>
      </header>

      {isLoading && <p className="text-sm text-candle-muted">Waking the panda…</p>}

      {!isLoading && !pet?.unlocked && (
        <section className="rounded-3xl glass-strong p-5 space-y-4">
          <div className="pointer-events-none opacity-60 blur-[1px]">
            <PandaStage playful={false} lite className="mx-auto max-w-[260px]" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="font-serif text-2xl italic">Adopt your panda</h2>
            <p className="text-sm text-candle-muted">
              A living mascot that reacts to you, sleeps, dreams and grows fonder every day.
            </p>
          </div>
          <input
            value={adoptName}
            onChange={(e) => setAdoptName(e.target.value)}
            maxLength={20}
            placeholder="Name your panda"
            className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-center font-serif text-lg italic outline-none focus:border-petal/60"
          />
          <Button
            variant="petal"
            size="block"
            disabled={adoptM.isPending || coins < (data?.cost ?? 250)}
            onClick={() => adoptM.mutate()}
          >
            {coins < (data?.cost ?? 250)
              ? `Needs ${data?.cost ?? 250} coins — you have ${coins}`
              : `Adopt for ${data?.cost ?? 250} coins`}
          </Button>
          <p className="text-center text-[11px] text-candle-muted">
            Earn coins from rituals, streaks and daily questions.
          </p>
        </section>
      )}

      {!isLoading && pet?.unlocked && (
        <>
          <section className="rounded-3xl glass-strong p-4">
            <div className="mb-2 flex items-center justify-center gap-2">
              {editing ? (
                <>
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    maxLength={20}
                    className="w-40 rounded-xl border border-border bg-surface px-3 py-1.5 text-center font-serif italic outline-none focus:border-petal/60"
                  />
                  <Button variant="petal" size="icon" onClick={() => renameM.mutate(draft)} aria-label="Save name">
                    <Check className="size-4" />
                  </Button>
                </>
              ) : (
                <>
                  <h2 className="font-serif text-3xl italic">{name}</h2>
                  <button
                    onClick={() => {
                      setDraft(name);
                      setEditing(true);
                    }}
                    aria-label="Rename panda"
                    className="text-candle-muted hover:text-petal"
                  >
                    <Pencil className="size-4" />
                  </button>
                </>
              )}
            </div>

            <PandaStage
              name={name}
              onInteract={() => {
                counter.current.interactions += 1;
                counter.current.affection = Math.min(100, counter.current.affection + 1);
              }}
            />
          </section>

          <section className="grid grid-cols-3 gap-3">
            <Stat label="Affection" value={`${pet.affection ?? 0}%`} Icon={Sparkles} />
            <Stat label="Playtime" value={String(pet.interactions ?? 0)} Icon={Sparkles} />
            <Stat label="Streak" value={`${pet.streak ?? 0}d`} Icon={Flame} />
          </section>

          <p className="text-center text-[11px] text-candle-muted">
            Seven days in a row unlocks the Golden Panda. Rare costumes appear on their own — keep visiting.
          </p>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, Icon }: { label: string; value: string; Icon: typeof Flame }) {
  return (
    <div className="rounded-2xl glass p-4 text-center">
      <Icon className="mx-auto size-4 text-petal" />
      <p className="mt-1 font-serif text-xl italic">{value}</p>
      <p className="text-[10px] uppercase tracking-widest text-candle-muted">{label}</p>
    </div>
  );
}
