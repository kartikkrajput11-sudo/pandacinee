import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Html, PerspectiveCamera, RoundedBox, Stars } from "@react-three/drei";
import * as THREE from "three";

export type Chat3DEffect = "kiss" | "hug" | "nudge" | "sticker" | "voice" | "reply";

type Beat =
  | { t: number; kind: "msg"; from: "me" | "peer"; text: string }
  | { t: number; kind: "reaction"; on: number; emoji: string }
  | { t: number; kind: Chat3DEffect };

const LOOP_SECONDS = 18;
const SCRIPT: Beat[] = [
  { t: 0.6, kind: "msg", from: "me", text: "movie at 8?" },
  { t: 2.0, kind: "msg", from: "peer", text: "yes, save my seat 🍿" },
  { t: 3.1, kind: "reaction", on: 0, emoji: "❤️" },
  { t: 4.2, kind: "reply" },
  { t: 5.6, kind: "msg", from: "me", text: "sending a soft nudge" },
  { t: 7.0, kind: "nudge" },
  { t: 8.5, kind: "hug" },
  { t: 10.2, kind: "sticker" },
  { t: 11.8, kind: "voice" },
  { t: 13.3, kind: "kiss" },
  { t: 15.0, kind: "msg", from: "peer", text: "this chat feels alive" },
  { t: 16.4, kind: "reaction", on: 8, emoji: "🐼" },
];

const EFFECT_LABEL: Record<Chat3DEffect, string> = {
  kiss: "kiss animation",
  hug: "hug animation",
  nudge: "nudge wave",
  sticker: "panda sticker",
  voice: "voice note",
  reply: "reply thread",
};

const EFFECT_EMOJI: Record<Exclude<Chat3DEffect, "nudge" | "reply" | "voice">, string> = {
  kiss: "💫",
  hug: "🫂",
  sticker: "🐼",
};

type SceneMessage = { i: number; from: "me" | "peer"; text: string };

function Phone({
  side,
  name,
  messages,
  reactions,
}: {
  side: "me" | "peer";
  name: string;
  messages: SceneMessage[];
  reactions: Record<number, string>;
}) {
  const groupRef = useRef<THREE.Group | null>(null);
  const mine = side === "me";

  useFrame((state) => {
    const group = groupRef.current;
    if (!group) return;
    const t = state.clock.elapsedTime;
    group.position.y = Math.sin(t * 0.85 + (mine ? 0 : Math.PI)) * 0.055;
    group.rotation.y = (mine ? 0.28 : -0.28) + Math.sin(t * 0.45) * 0.035;
    group.rotation.z = (mine ? -0.035 : 0.035) + Math.sin(t * 0.5) * 0.01;
  });

  return (
    <group ref={groupRef} position={[mine ? -1.05 : 1.05, 0, 0]}>
      <RoundedBox args={[1.24, 2.62, 0.13]} radius={0.13} smoothness={8} castShadow receiveShadow>
        <meshPhysicalMaterial color="#151018" roughness={0.26} metalness={0.72} clearcoat={1} clearcoatRoughness={0.18} />
      </RoundedBox>

      <mesh position={[0, 0, 0.071]}>
        <planeGeometry args={[1.12, 2.44]} />
        <meshBasicMaterial color="#120c16" />
      </mesh>

      <mesh position={[0, 1.1, 0.076]}>
        <planeGeometry args={[0.44, 0.025]} />
        <meshBasicMaterial color="#f6e8d7" transparent opacity={0.25} />
      </mesh>

      <Html transform position={[0, 1.03, 0.09]} distanceFactor={2.2} zIndexRange={[20, 10]}>
        <div className="w-[200px] text-center font-serif italic text-candle">
          <p className="text-[8px] uppercase tracking-[0.3em] text-petal not-italic">PANDACINE</p>
          <p className="mt-0.5 truncate text-[14px] leading-none">{name}</p>
          <p className="mt-1 text-[8px] not-italic text-candle-muted">● live in chat</p>
        </div>
      </Html>

      <Html transform position={[0, -0.05, 0.09]} distanceFactor={2.2} zIndexRange={[20, 10]}>
        <div className="flex w-[210px] flex-col gap-1.5 px-2">
          {messages.slice(-4).map((message) => {
            const outgoing = message.from === side;
            return (
              <div key={`${side}-${message.i}`} className={`relative flex ${outgoing ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[78%] rounded-2xl px-2.5 py-1.5 text-[10px] leading-tight shadow-2xl ${
                    outgoing
                      ? "rounded-br-md bg-petal text-velvet"
                      : "rounded-bl-md border border-border bg-surface-elevated text-candle"
                  }`}
                >
                  {message.text}
                </div>
                {reactions[message.i] && (
                  <span
                    className={`absolute -bottom-2 rounded-full border border-border bg-velvet px-1 text-[9px] ${
                      outgoing ? "left-2" : "right-2"
                    }`}
                  >
                    {reactions[message.i]}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </Html>

      <Html transform position={[0, -1.06, 0.09]} distanceFactor={2.2} zIndexRange={[20, 10]}>
        <div className="flex w-[210px] items-center gap-1.5 px-2">
          <div className="h-5 flex-1 rounded-full border border-border bg-surface/70" />
          <div className="size-5 rounded-full bg-petal shadow-petal" />
        </div>
      </Html>
    </group>
  );
}

function FloatingEmoji({ emoji, start, spin = false }: { emoji: string; start: [number, number, number]; spin?: boolean }) {
  const ref = useRef<THREE.Group | null>(null);
  const born = useRef(0);

  useFrame((state) => {
    const group = ref.current;
    if (!group) return;
    if (born.current === 0) born.current = state.clock.elapsedTime;
    const age = state.clock.elapsedTime - born.current;
    const progress = Math.min(age / 2.45, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    group.position.set(start[0] * (1 - eased), start[1] + eased * 1.25 + Math.sin(age * 4) * 0.045, start[2] + eased * 0.55);
    group.scale.setScalar((0.55 + eased * 0.72) * (1 - Math.max(0, age - 2) / 0.5));
    if (spin) group.rotation.z = Math.sin(age * 7) * 0.45;
  });

  return (
    <group ref={ref}>
      <Html transform center distanceFactor={2.4} zIndexRange={[30, 20]}>
        <div className="text-4xl drop-shadow-2xl">{emoji}</div>
      </Html>
    </group>
  );
}

function NudgeRing({ trigger }: { trigger: number }) {
  const groupRef = useRef<THREE.Group | null>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const born = useRef(0);

  useEffect(() => {
    if (!trigger) return;
    born.current = 0;
    if (groupRef.current) groupRef.current.visible = true;
  }, [trigger]);

  useFrame((state) => {
    const group = groupRef.current;
    const material = materialRef.current;
    if (!group || !material || !trigger) return;
    if (born.current === 0) born.current = state.clock.elapsedTime;
    const age = state.clock.elapsedTime - born.current;
    if (age > 1.2) {
      group.visible = false;
      return;
    }
    const k = age / 1.2;
    group.scale.setScalar(0.65 + k * 3.8);
    material.opacity = 0.58 * (1 - k);
  });

  return (
    <group ref={groupRef} visible={false}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.56, 0.66, 80]} />
        <meshBasicMaterial ref={materialRef} color="#f0a6ba" transparent opacity={0.58} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function FeatureBanner({ label, tick }: { label: string; tick: number }) {
  const [visible, setVisible] = useState(false);
  const [text, setText] = useState(label);

  useEffect(() => {
    if (!tick) return;
    setText(label);
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), 1500);
    return () => window.clearTimeout(timer);
  }, [label, tick]);

  if (!visible) return null;

  return (
    <Html center position={[0, 1.58, 0]} zIndexRange={[40, 30]}>
      <div className="whitespace-nowrap rounded-full border border-petal/30 bg-petal px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-velvet shadow-petal animate-scale-in">
        {text}
      </div>
    </Html>
  );
}

function Scene({
  meName,
  peerName,
  effect,
  effectTick,
}: {
  meName: string;
  peerName: string;
  effect: Chat3DEffect;
  effectTick: number;
}) {
  const [messages, setMessages] = useState<SceneMessage[]>([]);
  const [reactions, setReactions] = useState<Record<number, string>>({});
  const [effects, setEffects] = useState<{ id: number; kind: Chat3DEffect }[]>([]);
  const [nudgeTick, setNudgeTick] = useState(0);
  const [banner, setBanner] = useState({ label: "", tick: 0 });
  const cursorRef = useRef(0);
  const loopStartRef = useRef<number | null>(null);
  const effectIdRef = useRef(0);

  const launchEffect = (kind: Chat3DEffect) => {
    if (kind === "nudge") {
      setNudgeTick((v) => v + 1);
      setBanner({ label: EFFECT_LABEL[kind], tick: Date.now() });
      return;
    }
    const id = ++effectIdRef.current;
    setEffects((current) => [...current, { id, kind }]);
    setBanner({ label: EFFECT_LABEL[kind], tick: id });
    window.setTimeout(() => setEffects((current) => current.filter((item) => item.id !== id)), 2600);
  };

  useEffect(() => {
    if (!effectTick) return;
    launchEffect(effect);
  }, [effect, effectTick]);

  useFrame((state) => {
    if (loopStartRef.current === null) loopStartRef.current = state.clock.elapsedTime;
    const t = (state.clock.elapsedTime - loopStartRef.current) % LOOP_SECONDS;
    if (t < 0.05 && cursorRef.current !== 0) {
      cursorRef.current = 0;
      setMessages([]);
      setReactions({});
    }
    while (cursorRef.current < SCRIPT.length && SCRIPT[cursorRef.current].t <= t) {
      const beat = SCRIPT[cursorRef.current];
      cursorRef.current += 1;
      if (beat.kind === "msg") {
        setMessages((current) => [...current, { i: cursorRef.current - 1, from: beat.from, text: beat.text }]);
      } else if (beat.kind === "reaction") {
        setReactions((current) => ({ ...current, [beat.on]: beat.emoji }));
      } else {
        launchEffect(beat.kind);
      }
    }
  });

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0.25, 5.35]} fov={39} />
      <ambientLight intensity={0.42} />
      <pointLight position={[-3, 2.4, 3.5]} intensity={34} color="#f0a6ba" distance={14} decay={2} />
      <pointLight position={[3, 2.2, 3.5]} intensity={24} color="#f6e8d7" distance={14} decay={2} />
      <Stars radius={24} depth={18} count={950} factor={2.3} fade speed={0.35} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.64, 0]} receiveShadow>
        <circleGeometry args={[4.8, 80]} />
        <meshStandardMaterial color="#120c16" roughness={0.88} />
      </mesh>

      <Suspense fallback={null}>
        <Float speed={1.25} rotationIntensity={0.13} floatIntensity={0.18}>
          <Phone side="me" name={meName} messages={messages} reactions={reactions} />
        </Float>
        <Float speed={1.18} rotationIntensity={0.13} floatIntensity={0.18}>
          <Phone side="peer" name={peerName} messages={messages} reactions={reactions} />
        </Float>
      </Suspense>

      <mesh position={[0, -0.04, 0]} rotation={[0, 0, Math.PI]}>
        <torusGeometry args={[0.83, 0.012, 16, 90, Math.PI]} />
        <meshBasicMaterial color="#f0a6ba" transparent opacity={0.34} />
      </mesh>

      {effects.map((item) => {
        if (item.kind === "voice") {
          return (
            <group key={item.id}>
              <FloatingEmoji emoji="🎙️" start={[-0.45, -0.45, 0.1]} spin />
              <FloatingEmoji emoji="〰️" start={[0.45, -0.25, 0.1]} />
            </group>
          );
        }
        if (item.kind === "reply") {
          return (
            <group key={item.id}>
              <FloatingEmoji emoji="↩️" start={[-0.7, 0.05, 0.1]} spin />
              <FloatingEmoji emoji="💬" start={[0.7, -0.05, 0.1]} />
            </group>
          );
        }
        return (
          <group key={item.id}>
            <FloatingEmoji emoji={EFFECT_EMOJI[item.kind]} start={item.kind === "kiss" ? [-0.85, 0.05, 0.1] : [0, -0.25, 0.1]} spin />
            {(item.kind === "kiss" || item.kind === "hug") && <FloatingEmoji emoji="♡" start={[0.55, 0.15, 0.1]} />}
          </group>
        );
      })}

      <NudgeRing trigger={nudgeTick} />
      <FeatureBanner label={banner.label} tick={banner.tick} />
    </>
  );
}

export function Chat3DPhoneScene(props: {
  meName: string;
  peerName: string;
  effect: Chat3DEffect;
  effectTick: number;
}) {
  const cameraKey = useMemo(() => `${props.meName}-${props.peerName}`, [props.meName, props.peerName]);

  return (
    <Canvas key={cameraKey} dpr={[1, 1.7]} gl={{ antialias: true, alpha: true }} shadows>
      <Scene {...props} />
    </Canvas>
  );
}