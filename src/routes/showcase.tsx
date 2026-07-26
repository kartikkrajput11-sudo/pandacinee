import { createFileRoute, Link } from "@tanstack/react-router";
import { Suspense, useMemo, useRef, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Html, RoundedBox, Stars, Environment, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";

export const Route = createFileRoute("/showcase")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "PANDACINE — 3D Feature Showcase" },
      { name: "description", content: "A cinematic 3D preview of Pandacine — chat, kiss, hug, nudge, stickers, and reactions floating in space." },
      { property: "og:title", content: "PANDACINE — 3D Feature Showcase" },
      { property: "og:description", content: "A cinematic 3D preview of Pandacine — chat, kiss, hug, nudge, stickers, and reactions floating in space." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Showcase,
});

/* -------------------- Scripted mock chat -------------------- */

type Beat =
  | { t: number; kind: "msg"; from: "a" | "b"; text: string }
  | { t: number; kind: "kiss" }
  | { t: number; kind: "hug" }
  | { t: number; kind: "nudge" }
  | { t: number; kind: "sticker"; emoji: string }
  | { t: number; kind: "reaction"; on: number; emoji: string };

const SCRIPT: Beat[] = [
  { t: 0.6, kind: "msg", from: "a", text: "movie night?" },
  { t: 2.0, kind: "msg", from: "b", text: "always. 🍿" },
  { t: 3.4, kind: "reaction", on: 0, emoji: "❤️" },
  { t: 4.2, kind: "kiss" },
  { t: 6.0, kind: "msg", from: "a", text: "miss you" },
  { t: 7.4, kind: "hug" },
  { t: 9.2, kind: "sticker", emoji: "🐼" },
  { t: 10.6, kind: "msg", from: "b", text: "poke 👉" },
  { t: 11.6, kind: "nudge" },
  { t: 13.0, kind: "msg", from: "a", text: "see you at 8 ✨" },
  { t: 14.4, kind: "reaction", on: 4, emoji: "🌹" },
];
const LOOP = 16;

/* -------------------- Scene -------------------- */

function Phone({ side, msgs, reactions }: { side: "a" | "b"; msgs: { i: number; from: "a" | "b"; text: string }[]; reactions: Record<number, string> }) {
  const g = useRef<THREE.Group>(null!);
  const isA = side === "a";
  useFrame((s) => {
    if (!g.current) return;
    const t = s.clock.elapsedTime;
    g.current.position.y = Math.sin(t * 0.9 + (isA ? 0 : Math.PI)) * 0.08;
    g.current.rotation.y = (isA ? 0.35 : -0.35) + Math.sin(t * 0.5) * 0.04;
  });
  return (
    <group ref={g} position={[isA ? -1.7 : 1.7, 0, 0]}>
      {/* body */}
      <RoundedBox args={[1.5, 3, 0.14]} radius={0.14} smoothness={6} castShadow receiveShadow>
        <meshPhysicalMaterial color="#1a0f18" roughness={0.35} metalness={0.6} clearcoat={1} clearcoatRoughness={0.2} />
      </RoundedBox>
      {/* screen */}
      <mesh position={[0, 0, 0.076]}>
        <planeGeometry args={[1.36, 2.82]} />
        <meshBasicMaterial color="#170912" />
      </mesh>
      {/* screen glow rim */}
      <mesh position={[0, 0, 0.077]}>
        <planeGeometry args={[1.38, 2.84]} />
        <meshBasicMaterial color={isA ? "#c96b7a" : "#c9a84c"} transparent opacity={0.08} />
      </mesh>
      {/* header */}
      <Html transform position={[0, 1.28, 0.09]} distanceFactor={2.2} zIndexRange={[10, 0]}>
        <div style={{ width: 220, textAlign: "center", color: "#f6e7d6", fontFamily: "serif", fontStyle: "italic" }}>
          <div style={{ fontSize: 9, letterSpacing: "0.3em", color: "#c9a84c", textTransform: "uppercase" }}>Pandacine</div>
          <div style={{ fontSize: 15 }}>{isA ? "rae ♡" : "kai ♡"}</div>
          <div style={{ fontSize: 8, color: "#c96b7a" }}>● online</div>
        </div>
      </Html>
      {/* bubbles */}
      <Html transform position={[0, -0.1, 0.09]} distanceFactor={2.2} zIndexRange={[10, 0]}>
        <div style={{ width: 240, display: "flex", flexDirection: "column", gap: 8, padding: "0 10px" }}>
          {msgs.slice(-4).map((m) => {
            const mine = m.from === side;
            return (
              <div key={m.i} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", position: "relative" }}>
                <div
                  style={{
                    maxWidth: "78%",
                    padding: "7px 11px",
                    borderRadius: 14,
                    fontSize: 12,
                    lineHeight: 1.25,
                    color: mine ? "#170912" : "#f6e7d6",
                    background: mine
                      ? "linear-gradient(135deg,#f6d78a,#c9a84c)"
                      : "linear-gradient(135deg,rgba(201,107,122,0.35),rgba(255,255,255,0.08))",
                    border: mine ? "none" : "1px solid rgba(246,231,214,0.18)",
                    boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
                    animation: "bubbleIn 300ms ease-out",
                  }}
                >
                  {m.text}
                  {reactions[m.i] && (
                    <span
                      style={{
                        position: "absolute",
                        bottom: -8,
                        [mine ? "left" : "right"]: -6,
                        background: "#170912",
                        border: "1px solid rgba(201,168,76,0.4)",
                        borderRadius: 999,
                        padding: "1px 5px",
                        fontSize: 10,
                      } as any}
                    >
                      {reactions[m.i]}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Html>
      {/* footer */}
      <Html transform position={[0, -1.28, 0.09]} distanceFactor={2.2} zIndexRange={[10, 0]}>
        <div style={{ width: 240, display: "flex", gap: 6, alignItems: "center", padding: "0 10px" }}>
          <div style={{ flex: 1, height: 22, borderRadius: 999, background: "rgba(246,231,214,0.08)", border: "1px solid rgba(246,231,214,0.16)" }} />
          <div style={{ width: 22, height: 22, borderRadius: 999, background: "linear-gradient(135deg,#f6d78a,#c96b7a)" }} />
        </div>
      </Html>
    </group>
  );
}

function FloatingEmoji({ emoji, from, size = 0.6, spin = false }: { emoji: string; from: [number, number, number]; size?: number; spin?: boolean }) {
  const ref = useRef<THREE.Group>(null!);
  const born = useRef(performance.now() / 1000);
  useFrame((s) => {
    if (!ref.current) return;
    const age = s.clock.elapsedTime - born.current;
    const k = Math.min(age / 2.4, 1);
    const eased = 1 - Math.pow(1 - k, 3);
    ref.current.position.set(
      from[0] * (1 - eased),
      from[1] + eased * 1.2 + Math.sin(age * 3) * 0.05,
      from[2] + eased * 0.6,
    );
    const s2 = 0.6 + eased * 0.9;
    ref.current.scale.setScalar(s2 * (1 - Math.max(0, (age - 2) / 0.6)));
    if (spin) ref.current.rotation.z = Math.sin(age * 6) * 0.4;
  });
  return (
    <group ref={ref}>
      <Html transform distanceFactor={2.2} zIndexRange={[20, 10]}>
        <div style={{ fontSize: 48 * size, filter: "drop-shadow(0 10px 20px rgba(201,107,122,0.55))" }}>{emoji}</div>
      </Html>
    </group>
  );
}

function Heart({ from }: { from: [number, number, number] }) {
  return <FloatingEmoji emoji="❤️" from={from} size={0.7} />;
}

function NudgeShockwave({ trigger }: { trigger: number }) {
  const g = useRef<THREE.Group>(null!);
  const born = useRef(0);
  const active = useRef(false);
  useEffect(() => {
    if (!trigger) return;
    born.current = performance.now() / 1000;
    active.current = true;
  }, [trigger]);
  useFrame((s) => {
    if (!g.current || !active.current) return;
    const age = s.clock.elapsedTime - born.current;
    if (age > 1.2) {
      active.current = false;
      g.current.scale.setScalar(0);
      return;
    }
    const k = age / 1.2;
    g.current.scale.setScalar(0.4 + k * 4);
    (g.current.children[0] as THREE.Mesh).material &&
      ((g.current.children[0] as any).material.opacity = 0.6 * (1 - k));
  });
  return (
    <group ref={g} scale={0}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.6, 0.7, 64]} />
        <meshBasicMaterial color="#c96b7a" transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function CenterBanner({ label, trigger }: { label: string; trigger: number }) {
  const [visible, setVisible] = useState(false);
  const [text, setText] = useState(label);
  useEffect(() => {
    if (!trigger) return;
    setText(label);
    setVisible(true);
    const to = setTimeout(() => setVisible(false), 1600);
    return () => clearTimeout(to);
  }, [trigger, label]);
  if (!visible) return null;
  return (
    <Html center position={[0, 1.9, 0]} zIndexRange={[30, 20]}>
      <div
        style={{
          padding: "6px 16px",
          borderRadius: 999,
          fontFamily: "serif",
          fontStyle: "italic",
          fontSize: 14,
          color: "#170912",
          background: "linear-gradient(135deg,#f6d78a,#c9a84c)",
          border: "1px solid rgba(255,255,255,0.35)",
          boxShadow: "0 10px 30px rgba(201,107,122,0.5)",
          whiteSpace: "nowrap",
          animation: "bubbleIn 300ms ease-out",
        }}
      >
        {text}
      </div>
    </Html>
  );
}

function Scene() {
  const [msgs, setMsgs] = useState<{ i: number; from: "a" | "b"; text: string }[]>([]);
  const [reactions, setReactions] = useState<Record<number, string>>({});
  const [effects, setEffects] = useState<{ id: number; kind: "kiss" | "hug" | "sticker"; emoji: string }[]>([]);
  const [nudge, setNudge] = useState(0);
  const [banner, setBanner] = useState<{ label: string; k: number }>({ label: "", k: 0 });
  const cursor = useRef(0);
  const loopStart = useRef<number | null>(null);
  const idCounter = useRef(0);

  useFrame((s) => {
    if (loopStart.current === null) loopStart.current = s.clock.elapsedTime;
    const t = (s.clock.elapsedTime - loopStart.current) % LOOP;
    if (t < 0.05 && cursor.current !== 0) {
      cursor.current = 0;
      setMsgs([]);
      setReactions({});
    }
    while (cursor.current < SCRIPT.length && SCRIPT[cursor.current].t <= t) {
      const beat = SCRIPT[cursor.current++];
      if (beat.kind === "msg") {
        setMsgs((m) => [...m, { i: cursor.current - 1, from: beat.from, text: beat.text }]);
      } else if (beat.kind === "reaction") {
        setReactions((r) => ({ ...r, [beat.on]: beat.emoji }));
      } else if (beat.kind === "kiss") {
        idCounter.current++;
        const id = idCounter.current;
        setEffects((e) => [...e, { id, kind: "kiss", emoji: "💋" }]);
        setBanner({ label: "a kiss", k: id });
        setTimeout(() => setEffects((e) => e.filter((x) => x.id !== id)), 2600);
      } else if (beat.kind === "hug") {
        idCounter.current++;
        const id = idCounter.current;
        setEffects((e) => [...e, { id, kind: "hug", emoji: "🫂" }]);
        setBanner({ label: "a warm hug", k: id });
        setTimeout(() => setEffects((e) => e.filter((x) => x.id !== id)), 2600);
      } else if (beat.kind === "sticker") {
        idCounter.current++;
        const id = idCounter.current;
        setEffects((e) => [...e, { id, kind: "sticker", emoji: beat.emoji }]);
        setBanner({ label: "panda sticker", k: id });
        setTimeout(() => setEffects((e) => e.filter((x) => x.id !== id)), 2600);
      } else if (beat.kind === "nudge") {
        setNudge((n) => n + 1);
        setBanner({ label: "nudge!", k: Date.now() });
      }
    }
  });

  const msgsA = msgs;
  const msgsB = msgs;

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0.4, 6.2]} fov={40} />
      <ambientLight intensity={0.35} />
      <pointLight position={[-4, 3, 4]} intensity={30} color="#c96b7a" distance={20} decay={2} />
      <pointLight position={[4, 3, 4]} intensity={30} color="#c9a84c" distance={20} decay={2} />
      <directionalLight position={[0, 5, 5]} intensity={0.6} />

      <Suspense fallback={null}>
        <Environment preset="night" />
      </Suspense>
      <Stars radius={40} depth={30} count={2500} factor={3} fade speed={0.6} />

      {/* velvet floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.2, 0]} receiveShadow>
        <circleGeometry args={[8, 64]} />
        <meshStandardMaterial color="#1a0710" roughness={0.9} />
      </mesh>

      <Float speed={1.2} rotationIntensity={0.15} floatIntensity={0.25}>
        <Phone side="a" msgs={msgsA} reactions={reactions} />
      </Float>
      <Float speed={1.2} rotationIntensity={0.15} floatIntensity={0.25}>
        <Phone side="b" msgs={msgsB} reactions={reactions} />
      </Float>

      {/* connecting glow arc */}
      <mesh position={[0, 0, 0]}>
        <torusGeometry args={[1.2, 0.02, 16, 100, Math.PI]} />
        <meshBasicMaterial color="#c9a84c" transparent opacity={0.35} />
      </mesh>

      {/* Effects */}
      {effects.map((e) =>
        e.kind === "kiss" ? (
          <group key={e.id}>
            <FloatingEmoji emoji="💋" from={[-1.7, 0, 0.1]} spin />
            <Heart from={[-1.1, 0.2, 0.1]} />
            <Heart from={[1.1, -0.1, 0.1]} />
          </group>
        ) : e.kind === "hug" ? (
          <group key={e.id}>
            <FloatingEmoji emoji="🫂" from={[0, 0, 0.1]} size={0.9} />
            <Heart from={[-0.6, 0.4, 0.1]} />
            <Heart from={[0.6, -0.3, 0.1]} />
          </group>
        ) : (
          <FloatingEmoji key={e.id} emoji={e.emoji} from={[0, -0.4, 0.1]} size={1} spin />
        ),
      )}

      <NudgeShockwave trigger={nudge} />
      <CenterBanner label={banner.label} trigger={banner.k} />
    </>
  );
}

/* -------------------- Page -------------------- */

function Showcase() {
  const features = useMemo(
    () => [
      { t: "Chat", d: "Serif-warm bubbles, reactions, replies." },
      { t: "Kiss", d: "Lipstick imprint bloom." },
      { t: "Hug", d: "Panda-hug sticker warmth." },
      { t: "Nudge", d: "Screen-wide shockwave." },
      { t: "Stickers", d: "Panda mascots + AI packs." },
      { t: "Watch", d: "Same-room movie sync." },
    ],
    [],
  );

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: "radial-gradient(1200px 700px at 50% 0%, #2a0f22 0%, #0d0509 60%, #05020a 100%)" }}>
      <style>{`
        @keyframes bubbleIn { from { opacity: 0; transform: translateY(6px) scale(0.9); } to { opacity: 1; transform: none; } }
      `}</style>

      <header className="relative z-10 max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <Link to="/" className="font-serif italic text-lg" style={{ color: "#f6e7d6" }}>
          PANDACINE
        </Link>
        <Link
          to="/auth"
          className="text-sm px-4 py-2 rounded-full"
          style={{ background: "linear-gradient(135deg,#f6d78a,#c9a84c)", color: "#170912" }}
        >
          Enter
        </Link>
      </header>

      <section className="relative z-10 max-w-6xl mx-auto px-6 pt-4 text-center">
        <p className="text-[10px] uppercase tracking-[0.35em]" style={{ color: "#c9a84c" }}>Live demo</p>
        <h1 className="font-serif italic text-4xl md:text-5xl mt-2" style={{ color: "#f6e7d6" }}>
          Two phones. One velvet room.
        </h1>
        <p className="mt-3 max-w-xl mx-auto text-sm" style={{ color: "rgba(246,231,214,0.75)" }}>
          A cinematic preview of Pandacine — messages, kisses, hugs, nudges, and stickers, all floating between you.
        </p>
      </section>

      <div className="relative w-full" style={{ height: "min(70vh, 640px)" }}>
        <Canvas dpr={[1, 2]} gl={{ antialias: true, alpha: true }} shadows>
          <Scene />
        </Canvas>
      </div>

      <section className="relative z-10 max-w-5xl mx-auto px-6 pb-16 grid grid-cols-2 md:grid-cols-3 gap-3">
        {features.map((f) => (
          <div
            key={f.t}
            className="rounded-2xl p-4 border"
            style={{
              background: "linear-gradient(135deg,rgba(201,107,122,0.12),rgba(23,9,18,0.6))",
              borderColor: "rgba(201,168,76,0.25)",
            }}
          >
            <p className="font-serif italic text-lg" style={{ color: "#f6e7d6" }}>{f.t}</p>
            <p className="text-xs mt-1" style={{ color: "rgba(246,231,214,0.7)" }}>{f.d}</p>
          </div>
        ))}
      </section>

      <footer className="relative z-10 text-center pb-10">
        <Link
          to="/auth"
          className="inline-block px-8 py-3 rounded-full font-medium"
          style={{ background: "linear-gradient(135deg,#f6d78a,#c9a84c)", color: "#170912", boxShadow: "0 20px 60px rgba(201,107,122,0.5)" }}
        >
          Step inside →
        </Link>
      </footer>
    </div>
  );
}
