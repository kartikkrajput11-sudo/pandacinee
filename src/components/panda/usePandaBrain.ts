import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { pandaSfx } from "@/lib/panda-sfx";

export type Emotion =
  | "idle"
  | "happy"
  | "curious"
  | "sleepy"
  | "asleep"
  | "excited"
  | "shy"
  | "embarrassed"
  | "confused"
  | "playful"
  | "hungry"
  | "proud"
  | "chaotic"
  | "angry"
  | "sulking"
  | "surprised"
  | "scared"
  | "relaxed"
  | "dreaming"
  | "celebrating"
  | "focused"
  | "dizzy"
  | "crossEyed"
  | "laughing"
  | "disappointed";

export type Action =
  | null
  | "wave"
  | "pullBamboo"
  | "eat"
  | "chew"
  | "rubBelly"
  | "yawn"
  | "snore"
  | "dream"
  | "wake"
  | "stretch"
  | "headpat"
  | "tickle"
  | "sneeze"
  | "earScratch"
  | "pawShake"
  | "holdHands"
  | "tailPull"
  | "pose"
  | "roll"
  | "dance"
  | "search"
  | "celebrate"
  | "gift"
  | "sugarRush"
  | "throwBack"
  | "stir"
  | "sulk";

export type Costume =
  | "classic"
  | "director"
  | "astronaut"
  | "wizard"
  | "cyber"
  | "pirate"
  | "chef"
  | "detective"
  | "ninja"
  | "king"
  | "golden"
  | "santa"
  | "ghost"
  | "valentine";

export type Zone = "head" | "ear-l" | "ear-r" | "nose" | "belly" | "paw-l" | "paw-r" | "tail" | "body";

export type PandaState = {
  emotion: Emotion;
  action: Action;
  look: { x: number; y: number };
  tickle: number; // 0..5
  interactions: number;
  chaos: boolean;
  costume: Costume;
  thought: string | null;
  hearts: number;
  confetti: number;
  says: string | null;
  /** Neglected too long — the panda sulks and refuses to look at you. */
  ignoring: boolean;
  /** 0..1, how long since the last treat. */
  hunger: number;
};

const DREAMS = [
  "🎬 directing a masterpiece",
  "🐼 a pile of baby pandas",
  "🎋 an endless bamboo forest",
  "🍿 flying popcorn",
  "💥 VFX explosions",
  "🏆 winning an award",
  "🚀 a space adventure",
  "🎥 vintage film cameras",
];

const RARE: Costume[] = [
  "director",
  "astronaut",
  "wizard",
  "cyber",
  "pirate",
  "chef",
  "detective",
  "ninja",
  "king",
  "golden",
];

const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)]!;

function seasonalCostume(): Costume | null {
  const d = new Date();
  const m = d.getMonth();
  const day = d.getDate();
  if (m === 11 && day >= 18 && day <= 27) return "santa";
  if (m === 9 && day >= 25) return "ghost";
  if (m === 1 && day >= 7 && day <= 15) return "valentine";
  return null;
}

function timeOfDayEmotion(): Emotion {
  const h = new Date().getHours();
  if (h < 5) return "sleepy";
  if (h < 11) return "happy"; // coffee panda
  if (h < 17) return "focused"; // working panda
  if (h < 22) return "relaxed";
  return "sleepy";
}

export type BrainOptions = {
  /** Element the panda is drawn into — used for cursor geometry. */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Called every time the user interacts (for persistence / affection). */
  onInteract?: (kind: string) => void;
  /** Disable the auto idle story (used for the tiny hero variant). */
  idleStory?: boolean;
};

/**
 * The mascot's little brain: emotion state machine, cursor intelligence,
 * a 60-second idle story, tickle meter, rare events and easter eggs.
 */
export function usePandaBrain({ containerRef, onInteract, idleStory = true }: BrainOptions) {
  const [emotion, setEmotionRaw] = useState<Emotion>(() => timeOfDayEmotion());
  const [action, setAction] = useState<Action>(null);
  const [look, setLook] = useState({ x: 0, y: 0 });
  const [tickle, setTickle] = useState(0);
  const [interactions, setInteractions] = useState(0);
  const [chaos, setChaos] = useState(false);
  const [costume, setCostume] = useState<Costume>(() => seasonalCostume() ?? "classic");
  const [thought, setThought] = useState<string | null>(null);
  const [hearts, setHearts] = useState(0);
  const [confetti, setConfetti] = useState(0);
  const [says, setSays] = useState<string | null>(null);

  const timers = useRef<number[]>([]);
  const emotionTimer = useRef<number | null>(null);
  const baseEmotion = useRef<Emotion>(timeOfDayEmotion());
  const asleep = useRef(false);
  const tickleDecay = useRef<number | null>(null);

  const after = useCallback((ms: number, fn: () => void) => {
    const id = window.setTimeout(fn, ms);
    timers.current.push(id);
    return id;
  }, []);

  const clearAll = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);

  useEffect(() => () => clearAll(), [clearAll]);

  /** Set an emotion for `ms`, then blend back to the ambient base emotion. */
  const feel = useCallback((e: Emotion, ms = 2000) => {
    setEmotionRaw(e);
    if (emotionTimer.current) window.clearTimeout(emotionTimer.current);
    emotionTimer.current = window.setTimeout(() => {
      if (!asleep.current) setEmotionRaw(baseEmotion.current);
    }, ms);
  }, []);

  const doAction = useCallback(
    (a: Action, ms = 1600) => {
      setAction(a);
      after(ms, () => setAction((cur) => (cur === a ? null : cur)));
    },
    [after],
  );

  const say = useCallback(
    (text: string, ms = 2200) => {
      setSays(text);
      after(ms, () => setSays((s) => (s === text ? null : s)));
    },
    [after],
  );

  const burstHearts = useCallback(
    (n = 6) => {
      setHearts((h) => h + n);
      after(2400, () => setHearts((h) => Math.max(0, h - n)));
    },
    [after],
  );

  const burstConfetti = useCallback(
    (n = 40) => {
      setConfetti(n);
      after(3200, () => setConfetti(0));
    },
    [after],
  );

  /* ------------------------------------------------------------------ *
   * Life cycle — drowsiness grows with silence, sleep is gradual, and   *
   * neglect (no treats for hours) makes the panda sulk and ignore you.  *
   * ------------------------------------------------------------------ */
  const lastTouch = useRef(Date.now());
  const stage = useRef<"awake" | "bored" | "drowsy" | "dozing" | "asleep" | "dreaming">("awake");
  const [ignoring, setIgnoring] = useState(false);
  const [hunger, setHunger] = useState(0);
  const lastFed = useRef<number>(Date.now());
  const sulkArmed = useRef(false);

  const FED_KEY = "panda:lastFed";
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(FED_KEY);
      if (raw) lastFed.current = Number(raw) || Date.now();
    } catch {
      /* storage unavailable */
    }
  }, []);

  const markFed = useCallback(() => {
    lastFed.current = Date.now();
    try {
      window.localStorage.setItem(FED_KEY, String(lastFed.current));
    } catch {
      /* ignore */
    }
    sulkArmed.current = false;
    setHunger(0);
    setIgnoring(false);
  }, []);

  /** Slow, believable waking: a stir, a yawn, a long stretch, then alert. */
  const wakeUp = useCallback(() => {
    if (stage.current === "awake" || stage.current === "bored") return;
    const wasDeep = stage.current === "asleep" || stage.current === "dreaming";
    stage.current = "awake";
    asleep.current = false;
    setThought(null);
    if (!wasDeep) {
      setEmotionRaw(baseEmotion.current);
      return;
    }
    doAction("stir", 2200);
    setEmotionRaw("sleepy");
    after(2000, () => {
      doAction("yawn", 1800);
      pandaSfx.yawn();
    });
    after(3600, () => {
      doAction("wake", 2200);
      setEmotionRaw("confused");
    });
    after(5600, () => {
      doAction("stretch", 1800);
      feel("relaxed", 2400);
    });
    after(7600, () => {
      feel("happy", 1800);
      pandaSfx.giggle();
    });
  }, [after, doAction, feel]);

  const resetIdle = useCallback(() => {
    lastTouch.current = Date.now();
    wakeUp();
  }, [wakeUp]);

  useEffect(() => {
    if (!idleStory) return;
    const id = window.setInterval(() => {
      const quiet = (Date.now() - lastTouch.current) / 1000; // seconds of no interaction
      const hoursHungry = (Date.now() - lastFed.current) / 3.6e6;
      setHunger(Math.max(0, Math.min(1, hoursHungry / 10)));

      /* --- neglect: cutely angry, then pointedly ignoring you --------- */
      if (hoursHungry > 8 && !sulkArmed.current && stage.current === "awake") {
        sulkArmed.current = true;
        setEmotionRaw("angry");
        doAction("sulk", 2000);
        pandaSfx.growl();
        say("hmph.", 2400);
        window.setTimeout(() => {
          setEmotionRaw("sulking");
          setIgnoring(true);
        }, 2400);
        return;
      }
      if (ignoring) {
        // Sulking pandas do very little — an occasional huff, back turned.
        if (Math.random() < 0.06) {
          doAction("sulk", 1600);
          say(pick(["…", "hmph", "no bamboo, no talk"]), 2000);
        }
        return;
      }

      /* --- the awake loop: little life beats ------------------------- */
      if (quiet < 25) {
        stage.current = "awake";
        if (Math.random() < 0.05) feel(pick(["curious", "playful", "happy", "shy"] as Emotion[]), 1500);
        if (Math.random() < 0.02) {
          doAction("earScratch", 1400);
        }
        if (hoursHungry > 3 && Math.random() < 0.05) {
          feel("hungry", 2400);
          say("bamboo? 🎋", 2000);
        }
        if (Math.random() < 0.0015) {
          const rare = pick(RARE);
          setCostume(rare);
          say(`${rare} panda!`, 2600);
          burstConfetti(30);
          window.setTimeout(() => setCostume(seasonalCostume() ?? "classic"), 12000);
        }
        return;
      }

      /* --- silence: drift down into sleep, stage by stage ------------ */
      if (quiet < 45) {
        if (stage.current !== "bored") {
          stage.current = "bored";
          doAction(pick(["stretch", "pullBamboo", "wave"]), 2000);
          feel("relaxed", 3000);
        } else if (Math.random() < 0.08) {
          doAction(pick(["earScratch", "chew", "pose"]), 1600);
        }
        return;
      }
      if (quiet < 80) {
        if (stage.current !== "drowsy") {
          stage.current = "drowsy";
          doAction("yawn", 2600);
          setEmotionRaw("sleepy");
          pandaSfx.yawn();
        }
        return;
      }
      if (quiet < 110) {
        if (stage.current !== "dozing") {
          stage.current = "dozing";
          setEmotionRaw("sleepy");
          doAction("stir", 3000);
        }
        return;
      }
      if (quiet < 190) {
        if (stage.current !== "asleep") {
          stage.current = "asleep";
          asleep.current = true;
          setEmotionRaw("asleep");
          setAction(null);
          window.setTimeout(() => {
            if (stage.current === "asleep") {
              doAction("snore", 6000);
              pandaSfx.snore();
            }
          }, 4000);
        }
        return;
      }
      if (stage.current !== "dreaming") {
        stage.current = "dreaming";
        asleep.current = true;
        setEmotionRaw("dreaming");
        setThought(pick(DREAMS));
      } else if (Math.random() < 0.05) {
        setThought(pick(DREAMS));
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [burstConfetti, doAction, feel, idleStory, ignoring, say]);

  /* --------------------------- cursor brain -------------------------- */
  const angleAcc = useRef(0);
  const lastAngle = useRef<number | null>(null);
  const lastMove = useRef(Date.now());
  const shakeCount = useRef(0);
  const lastDir = useRef(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height * 0.38;
      const dx = (e.clientX - cx) / (rect.width / 2);
      const dy = (e.clientY - cy) / (rect.height / 2);
      setLook({ x: Math.max(-1, Math.min(1, dx)), y: Math.max(-1, Math.min(1, dy)) });

      const dist = Math.hypot(dx, dy);
      const now = Date.now();
      const dt = now - lastMove.current;
      lastMove.current = now;

      // circling detection → dizzy
      const ang = Math.atan2(dy, dx);
      if (lastAngle.current != null) {
        let d = ang - lastAngle.current;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        angleAcc.current += d;
        // shake detection (rapid direction flips)
        const dir = Math.sign(d);
        if (dir !== 0 && dir !== lastDir.current) {
          shakeCount.current += 1;
          lastDir.current = dir;
        }
      }
      lastAngle.current = ang;

      if (Math.abs(angleAcc.current) > Math.PI * 4 && dist < 1.4) {
        angleAcc.current = 0;
        feel("dizzy", 2600);
        doAction("roll", 2400);
        pandaSfx.squeak();
      }
      if (shakeCount.current > 14) {
        shakeCount.current = 0;
        feel("dizzy", 2200);
      }

      if (dist < 0.22) {
        feel("crossEyed", 900);
      } else if (dist < 0.65 && dt > 12) {
        if (!asleep.current) feel("happy", 1200);
      } else if (dt < 8 && Math.abs(dx) > 0.4) {
        feel("surprised", 700);
      }
    };

    const onLeave = () => {
      setLook({ x: 0, y: 0 });
      feel("disappointed", 1800);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    const decay = window.setInterval(() => {
      angleAcc.current *= 0.7;
      shakeCount.current = Math.max(0, shakeCount.current - 2);
      if (Date.now() - lastMove.current > 6000) setLook({ x: 0, y: 0 });
    }, 900);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      window.clearInterval(decay);
    };
  }, [containerRef, doAction, feel]);

  /* ------------------------- keyboard easter eggs -------------------- */
  useEffect(() => {
    let buf = "";
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /input|textarea/i.test(target.tagName)) return;
      if (!/^[a-zA-Z]$/.test(e.key)) return;
      buf = (buf + e.key.toUpperCase()).slice(-6);
      if (buf.endsWith("PANDA")) {
        burstConfetti(60);
        feel("celebrating", 3000);
        doAction("celebrate", 2600);
        pandaSfx.celebrate();
        say("You said my name!", 2400);
      } else if (buf.endsWith("CGI")) {
        setCostume("cyber");
        say("Holograms online", 2200);
        window.setTimeout(() => setCostume(seasonalCostume() ?? "classic"), 9000);
      } else if (buf.endsWith("VFX")) {
        setCostume("director");
        say("Action!", 2000);
        window.setTimeout(() => setCostume(seasonalCostume() ?? "classic"), 9000);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [burstConfetti, doAction, feel, say]);

  /* ------------------------------ chaos ------------------------------ */
  const bumpInteractions = useCallback(
    (kind: string) => {
      onInteract?.(kind);
      setInteractions((n) => {
        const next = n + 1;
        if (next > 0 && next % 100 === 0) {
          setChaos(true);
          setEmotionRaw("chaotic");
          burstConfetti(90);
          pandaSfx.celebrate();
          window.setTimeout(() => {
            setChaos(false);
            setEmotionRaw(baseEmotion.current);
          }, 9000);
        }
        return next;
      });
    },
    [burstConfetti, onInteract],
  );

  /* ------------------------- tickle meter ---------------------------- */
  const bumpTickle = useCallback(() => {
    setTickle((t) => {
      const next = Math.min(5, t + 1);
      if (next <= 2) pandaSfx.giggle();
      else pandaSfx.laugh();
      if (next >= 5) {
        setEmotionRaw("angry");
        pandaSfx.growl();
        window.setTimeout(() => {
          setEmotionRaw("shy");
          burstHearts(4);
        }, 2600);
        window.setTimeout(() => {
          setEmotionRaw(baseEmotion.current);
          setTickle(0);
        }, 4200);
      } else {
        feel("laughing", 1800);
      }
      return next;
    });
    if (tickleDecay.current) window.clearTimeout(tickleDecay.current);
    tickleDecay.current = window.setTimeout(() => setTickle(0), 9000);
  }, [burstHearts, feel]);

  /* --------------------------- interactions -------------------------- */
  const interact = useCallback(
    (zone: Zone | "camera" | "bamboo" | "popcorn" | "cookie" | "peekaboo" | "drag") => {
      resetIdle();
      bumpInteractions(zone);
      switch (zone) {
        case "head":
          feel("happy", 2200);
          doAction("headpat", 2000);
          burstHearts(5);
          pandaSfx.happy();
          break;
        case "nose":
          feel("crossEyed", 900);
          doAction("sneeze", 1500);
          pandaSfx.sneeze();
          after(1000, () => feel("embarrassed", 1800));
          break;
        case "ear-l":
        case "ear-r":
          feel("relaxed", 2000);
          doAction("earScratch", 1800);
          pandaSfx.giggle();
          break;
        case "belly":
          doAction("rubBelly", 2200);
          bumpTickle();
          break;
        case "paw-l":
        case "paw-r":
          feel("playful", 1800);
          doAction("pawShake", 1600);
          pandaSfx.pop();
          break;
        case "tail":
          pandaSfx.squeak();
          feel("confused", 1800);
          doAction("tailPull", 1400);
          break;
        case "body":
          bumpTickle();
          doAction("tickle", 1800);
          break;
        case "camera":
          pandaSfx.camera();
          doAction("pose", 2000);
          feel("proud", 2200);
          break;
        case "bamboo":
          doAction("eat", 2600);
          feel("hungry", 2600);
          pandaSfx.chew();
          after(2400, () => feel("happy", 2000));
          break;
        case "popcorn":
          doAction("throwBack", 1800);
          feel("playful", 2000);
          pandaSfx.pop();
          break;
        case "cookie":
          doAction("sugarRush", 3200);
          feel("excited", 3400);
          pandaSfx.laugh();
          break;
        case "peekaboo":
          doAction("search", 2200);
          feel("curious", 2400);
          after(2000, () => {
            feel("celebrating", 1800);
            burstHearts(4);
            pandaSfx.happy();
          });
          break;
        case "drag":
          feel("surprised", 900);
          break;
      }
    },
    [after, bumpInteractions, bumpTickle, burstHearts, doAction, feel, resetIdle],
  );

  const state: PandaState = useMemo(
    () => ({ emotion, action, look, tickle, interactions, chaos, costume, thought, hearts, confetti, says }),
    [emotion, action, look, tickle, interactions, chaos, costume, thought, hearts, confetti, says],
  );

  return {
    state,
    interact,
    feel,
    doAction,
    say,
    setCostume,
    burstConfetti,
    burstHearts,
    resetIdle,
    isAsleep: () => asleep.current,
  };
}
