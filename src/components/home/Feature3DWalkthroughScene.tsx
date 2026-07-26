import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Html, PerspectiveCamera, RoundedBox, Stars } from "@react-three/drei";
import * as THREE from "three";

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function clamp(v: number, lo = 0, hi = 1) {
  return Math.max(lo, Math.min(hi, v));
}
/** Bell curve — 1 at center, 0 outside window. */
function bell(p: number, center: number, width = 0.6) {
  const d = Math.abs(p - center) / width;
  return clamp(1 - d, 0, 1);
}

/** Screen index (0..sceneCount-1) from progress, floating. */
function sceneFloat(progress: number, sceneCount: number) {
  return progress * (sceneCount - 1);
}

function Phone({
  side,
  progress,
  sceneCount,
}: {
  side: "L" | "R";
  progress: number;
  sceneCount: number;
}) {
  const group = useRef<THREE.Group | null>(null);
  const mine = side === "L";
  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    const s = sceneFloat(progress, sceneCount);
    const seg = Math.floor(s);
    const f = s - seg;
    // Distinct poses per feature scene (8 total). Anything past index reuses last.
    const poses = [
      { x: mine ? -1.15 : 1.15, y: 0, z: 0, rotY: mine ? 0.32 : -0.32, rotZ: 0 },    // Chat
      { x: mine ? -1.25 : 1.25, y: 0.05, z: -0.05, rotY: mine ? 0.42 : -0.42, rotZ: mine ? 0.05 : -0.05 }, // Stickers
      { x: mine ? -1.2 : 1.2, y: -0.05, z: -0.1, rotY: mine ? 0.5 : -0.5, rotZ: 0 }, // Voice/media
      { x: mine ? -1.35 : 1.35, y: -0.1, z: -0.25, rotY: mine ? 0.6 : -0.6, rotZ: 0 }, // Movie
      { x: mine ? -1.75 : 1.75, y: 0.15, z: -0.4, rotY: mine ? 0.2 : -0.2, rotZ: mine ? -0.14 : 0.14 }, // Games
      { x: mine ? -1.5 : 1.5, y: 0.1, z: -0.15, rotY: mine ? 0.45 : -0.45, rotZ: 0 }, // Groups
      { x: mine ? -1.1 : 1.1, y: 0.2, z: 0.1, rotY: mine ? 0.25 : -0.25, rotZ: 0 }, // Milestones
      { x: mine ? -1.4 : 1.4, y: 0, z: -0.1, rotY: mine ? 0.5 : -0.5, rotZ: 0 }, // Notifications
    ];
    const a = poses[Math.min(seg, poses.length - 1)];
    const b = poses[Math.min(seg + 1, poses.length - 1)];
    g.position.x = lerp(a.x, b.x, f) + Math.sin(t * 0.6 + (mine ? 0 : 1.5)) * 0.02;
    g.position.y = lerp(a.y, b.y, f) + Math.sin(t * 0.9 + (mine ? 0 : 2)) * 0.05;
    g.position.z = lerp(a.z, b.z, f);
    g.rotation.y = lerp(a.rotY, b.rotY, f);
    g.rotation.z = lerp(a.rotZ, b.rotZ, f);
  });

  return (
    <group ref={group}>
      <RoundedBox args={[1.28, 2.7, 0.14]} radius={0.14} smoothness={8} castShadow>
        <meshPhysicalMaterial color="#171018" roughness={0.24} metalness={0.75} clearcoat={1} clearcoatRoughness={0.16} />
      </RoundedBox>
      <mesh position={[0, 0, 0.076]}>
        <planeGeometry args={[1.15, 2.5]} />
        <meshBasicMaterial color="#150e18" />
      </mesh>
      <mesh position={[0, 0, 0.077]}>
        <ringGeometry args={[0.94, 0.965, 60]} />
        <meshBasicMaterial color="#f0a6ba" transparent opacity={0.35} />
      </mesh>
      <Html transform position={[0, 1.05, 0.09]} distanceFactor={2.2} zIndexRange={[20, 10]}>
        <div className="w-[220px] text-center">
          <p className="text-[8px] uppercase tracking-[0.32em] text-petal">PANDACINE</p>
          <p className="mt-0.5 font-serif italic text-[13px] text-candle">{mine ? "You" : "Your panda"}</p>
        </div>
      </Html>
      <PhoneContent side={side} progress={progress} sceneCount={sceneCount} />
    </group>
  );
}

/** Screen content per scene, cross-fades via bell windows. */
function PhoneContent({ side, progress, sceneCount }: { side: "L" | "R"; progress: number; sceneCount: number }) {
  const s = sceneFloat(progress, sceneCount);
  const op = (i: number) => bell(s, i, 0.7);
  return (
    <Html transform position={[0, -0.05, 0.09]} distanceFactor={2.2} zIndexRange={[20, 10]}>
      <div className="relative h-[280px] w-[210px]">
        {/* 0 · Chat */}
        <div className="absolute inset-0 flex flex-col justify-end gap-1.5 px-2" style={{ opacity: op(0) }}>
          <Bubble mine={side === "L"}>{side === "L" ? "movie at 8?" : "yes, save my seat 🍿"}</Bubble>
          <Bubble mine={side !== "L"}>{side === "L" ? "sending a hug 🫂" : "felt it ♡"}</Bubble>
          <Bubble mine={side === "L"}>a soft nudge…</Bubble>
        </div>

        {/* 1 · Stickers & reactions */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-2" style={{ opacity: op(1) }}>
          <div className="grid grid-cols-3 gap-1.5">
            {["🐼", "💗", "🫂", "😽", "✨", "🌸"].map((e, i) => (
              <div key={i} className="h-11 w-11 rounded-xl border border-petal/30 bg-surface/80 flex items-center justify-center text-xl">{e}</div>
            ))}
          </div>
          <p className="text-[9px] uppercase tracking-[0.3em] text-petal">tap · long-press</p>
        </div>

        {/* 2 · Voice note & media */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-2" style={{ opacity: op(2) }}>
          <div className="w-full rounded-full border border-petal/40 bg-surface/80 p-1.5 flex items-center gap-1.5">
            <div className="h-6 w-6 rounded-full bg-petal flex items-center justify-center text-velvet text-[10px]">▶</div>
            <div className="flex-1 flex items-center gap-[2px] h-6">
              {Array.from({ length: 22 }).map((_, i) => (
                <div key={i} className="w-[2px] rounded-full bg-petal/70" style={{ height: `${20 + Math.sin(i * 1.3) * 40 + 30}%` }} />
              ))}
            </div>
            <span className="text-[9px] text-candle-muted pr-1">0:07</span>
          </div>
          <div className="h-16 w-full rounded-lg border border-petal/30 bg-gradient-to-br from-petal/20 to-velvet flex items-center justify-center text-lg">🖼️</div>
        </div>

        {/* 3 · Movie sync */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-3" style={{ opacity: op(3) }}>
          <div className="h-24 w-full rounded-lg border border-petal/40 bg-gradient-to-br from-petal/20 to-velvet flex items-center justify-center text-2xl">🎬</div>
          <div className="w-full">
            <div className="h-1 w-full rounded-full bg-surface">
              <div className="h-1 rounded-full bg-petal" style={{ width: "62%" }} />
            </div>
            <p className="mt-1 text-[9px] text-candle-muted text-center">In sync · 01:14:22</p>
          </div>
        </div>

        {/* 4 · Games */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2" style={{ opacity: op(4) }}>
          <div className="flex gap-1">
            {["♠", "♥", "♦", "♣"].map((c, i) => (
              <div key={i} className="h-14 w-9 rounded-md border border-petal/40 bg-candle/95 text-velvet flex items-center justify-center font-serif text-lg shadow">
                {c}
              </div>
            ))}
          </div>
          <p className="text-[9px] uppercase tracking-[0.3em] text-petal">your turn</p>
        </div>

        {/* 5 · Group rooms & polls */}
        <div className="absolute inset-0 flex flex-col justify-end gap-1.5 px-2" style={{ opacity: op(5) }}>
          <p className="text-[9px] uppercase tracking-[0.3em] text-petal text-center">Velvet Room · 4</p>
          <Bubble mine={false}>What tonight?</Bubble>
          <div className="rounded-xl border border-petal/30 bg-surface/80 p-2">
            <p className="text-[10px] text-candle">Movie or game?</p>
            <div className="mt-1 space-y-1">
              <div className="h-1.5 rounded-full bg-petal" style={{ width: "72%" }} />
              <div className="h-1.5 rounded-full bg-petal/40" style={{ width: "28%" }} />
            </div>
          </div>
        </div>

        {/* 6 · Milestones */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2" style={{ opacity: op(6) }}>
          <div className="relative h-20 w-20 rounded-full border-2 border-petal/50 bg-gradient-to-br from-petal/40 to-velvet flex items-center justify-center">
            <span className="font-serif italic text-2xl text-candle">100</span>
          </div>
          <p className="text-[9px] uppercase tracking-[0.3em] text-petal">days together</p>
          <p className="font-serif italic text-[11px] text-candle">a hundred sunsets ♡</p>
        </div>

        {/* 7 · Notifications */}
        <div className="absolute inset-0 flex flex-col items-start justify-start gap-2 pt-4 px-2" style={{ opacity: op(7) }}>
          <div className="ml-auto w-[85%] rounded-xl border border-petal/40 bg-surface-elevated/95 p-2 shadow-lg animate-fade-in">
            <p className="text-[9px] uppercase tracking-[0.3em] text-petal">new message</p>
            <p className="text-[10px] text-candle mt-0.5">Your panda: "look up ✦"</p>
          </div>
          <div className="ml-auto w-[75%] rounded-xl border border-petal/25 bg-surface/70 p-2">
            <p className="text-[9px] text-candle-muted">2 min ago · kiss received</p>
          </div>
        </div>
      </div>
    </Html>
  );
}

function Bubble({ mine, children }: { mine: boolean; children: React.ReactNode }) {
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[78%] rounded-2xl px-2.5 py-1.5 text-[10px] leading-tight ${
          mine ? "rounded-br-md bg-petal text-velvet" : "rounded-bl-md border border-border bg-surface-elevated text-candle"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function FilmReel({ progress, sceneCount }: { progress: number; sceneCount: number }) {
  const ref = useRef<THREE.Group | null>(null);
  const op = bell(sceneFloat(progress, sceneCount), 3, 0.7);
  useFrame((s) => {
    if (ref.current) ref.current.rotation.z = s.clock.elapsedTime * 0.4;
  });
  if (op < 0.02) return null;
  return (
    <group ref={ref} position={[0, 0, -0.4]}>
      <mesh>
        <torusGeometry args={[0.6, 0.04, 16, 60]} />
        <meshStandardMaterial color="#f0a6ba" emissive="#f0a6ba" emissiveIntensity={0.6 * op} transparent opacity={op} />
      </mesh>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <mesh key={i} position={[Math.cos((i / 6) * Math.PI * 2) * 0.4, Math.sin((i / 6) * Math.PI * 2) * 0.4, 0]}>
          <sphereGeometry args={[0.05, 12, 12]} />
          <meshStandardMaterial color="#f6e8d7" transparent opacity={op} />
        </mesh>
      ))}
    </group>
  );
}

function GameTable({ progress, sceneCount }: { progress: number; sceneCount: number }) {
  const op = bell(sceneFloat(progress, sceneCount), 4, 0.6);
  if (op < 0.02) return null;
  return (
    <group position={[0, -0.9, 0.2]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.1, 60]} />
        <meshStandardMaterial color="#2a1620" transparent opacity={op * 0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
        <ringGeometry args={[1.02, 1.08, 60]} />
        <meshBasicMaterial color="#f0a6ba" transparent opacity={op} />
      </mesh>
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.7, 0.05, Math.sin(a) * 0.7]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.2, 0.3]} />
            <meshStandardMaterial color="#f6e8d7" transparent opacity={op} />
          </mesh>
        );
      })}
    </group>
  );
}

function GroupOrbs({ progress, sceneCount }: { progress: number; sceneCount: number }) {
  const op = bell(sceneFloat(progress, sceneCount), 5, 0.6);
  const ref = useRef<THREE.Group | null>(null);
  useFrame((s) => {
    if (ref.current) ref.current.rotation.y = s.clock.elapsedTime * 0.25;
  });
  if (op < 0.02) return null;
  return (
    <group ref={ref} position={[0, 0.9, -0.3]}>
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 1.4, Math.sin(a) * 0.4, Math.sin(a) * 1.4]}>
            <sphereGeometry args={[0.12, 24, 24]} />
            <meshStandardMaterial
              color={i % 2 ? "#f0a6ba" : "#f6e8d7"}
              emissive={i % 2 ? "#f0a6ba" : "#f6e8d7"}
              emissiveIntensity={0.5}
              transparent
              opacity={op}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function Hearts({ progress, sceneCount }: { progress: number; sceneCount: number }) {
  const op = bell(sceneFloat(progress, sceneCount), 0, 0.7);
  if (op < 0.02) return null;
  return (
    <group position={[0, 0.4, 0.2]}>
      {[-0.6, 0, 0.6].map((x, i) => (
        <Float key={i} speed={2} floatIntensity={1.2} rotationIntensity={0.4}>
          <Html center distanceFactor={2.6} position={[x, i * 0.15, 0]} zIndexRange={[25, 15]}>
            <div className="text-2xl drop-shadow-lg" style={{ opacity: op }}>♡</div>
          </Html>
        </Float>
      ))}
    </group>
  );
}

/** Floating panda stickers around scene 1. */
function StickerBurst({ progress, sceneCount }: { progress: number; sceneCount: number }) {
  const op = bell(sceneFloat(progress, sceneCount), 1, 0.55);
  if (op < 0.02) return null;
  const items = ["🐼", "🌸", "✨", "💗", "🫧"];
  return (
    <group position={[0, 0.5, 0.4]}>
      {items.map((e, i) => (
        <Float key={i} speed={1.6} floatIntensity={1.6} rotationIntensity={0.3}>
          <Html center distanceFactor={2.6} position={[Math.cos(i) * 1.3, Math.sin(i * 1.7) * 0.5, 0]} zIndexRange={[25, 15]}>
            <div className="text-2xl drop-shadow-lg" style={{ opacity: op }}>{e}</div>
          </Html>
        </Float>
      ))}
    </group>
  );
}

/** Sound wave halo for scene 2 (voice notes). */
function SoundWaves({ progress, sceneCount }: { progress: number; sceneCount: number }) {
  const op = bell(sceneFloat(progress, sceneCount), 2, 0.55);
  const g = useRef<THREE.Group | null>(null);
  useFrame((s) => {
    if (!g.current) return;
    const t = s.clock.elapsedTime;
    g.current.children.forEach((c, i) => {
      const scale = 1 + ((t + i * 0.6) % 2) * 0.6;
      c.scale.setScalar(scale);
      (c as THREE.Mesh).material && ((((c as THREE.Mesh).material) as THREE.MeshBasicMaterial).opacity = op * (1 - ((t + i * 0.6) % 2) / 2));
    });
  });
  if (op < 0.02) return null;
  return (
    <group ref={g} position={[0, 0, -0.2]}>
      {[0, 1, 2].map((i) => (
        <mesh key={i}>
          <ringGeometry args={[0.9, 0.94, 60]} />
          <meshBasicMaterial color="#f0a6ba" transparent opacity={op} />
        </mesh>
      ))}
    </group>
  );
}

/** Ribbon confetti for milestones (scene 6). */
function ConfettiRibbon({ progress, sceneCount }: { progress: number; sceneCount: number }) {
  const op = bell(sceneFloat(progress, sceneCount), 6, 0.6);
  const g = useRef<THREE.Group | null>(null);
  useFrame((s) => {
    if (!g.current) return;
    const t = s.clock.elapsedTime;
    g.current.children.forEach((c, i) => {
      c.position.y = ((t * 0.6 + i * 0.3) % 3) - 1.5;
      c.rotation.z = t + i;
    });
  });
  if (op < 0.02) return null;
  const petals = Array.from({ length: 14 });
  return (
    <group ref={g}>
      {petals.map((_, i) => (
        <mesh key={i} position={[(i - 7) * 0.3, 0, 0]}>
          <planeGeometry args={[0.08, 0.22]} />
          <meshBasicMaterial color={i % 2 ? "#f0a6ba" : "#f6e8d7"} transparent opacity={op} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

/** Slide-in notification card in world space for scene 7. */
function NotificationSweep({ progress, sceneCount }: { progress: number; sceneCount: number }) {
  const op = bell(sceneFloat(progress, sceneCount), 7, 0.55);
  const g = useRef<THREE.Group | null>(null);
  useFrame((s) => {
    if (!g.current) return;
    const t = s.clock.elapsedTime;
    g.current.position.x = 2.4 - ((t * 0.8) % 4);
  });
  if (op < 0.02) return null;
  return (
    <group ref={g} position={[0, 1.1, 0.5]}>
      <mesh>
        <planeGeometry args={[1.1, 0.32]} />
        <meshBasicMaterial color="#f0a6ba" transparent opacity={op * 0.85} />
      </mesh>
      <Html center distanceFactor={2.4} zIndexRange={[25, 15]}>
        <div className="rounded-lg px-2 py-1 text-[10px] text-velvet" style={{ opacity: op }}>✦ new message</div>
      </Html>
    </group>
  );
}

function Rig({ progress, sceneCount }: { progress: number; sceneCount: number }) {
  useFrame((state) => {
    const cam = state.camera;
    const target = 5.6 - progress * 0.7;
    cam.position.z = lerp(cam.position.z, target, 0.08);
    cam.position.y = lerp(cam.position.y, 0.3 + Math.sin(progress * Math.PI * 2) * 0.18, 0.08);
    cam.lookAt(0, 0, 0);
  });
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0.3, 5.6]} fov={40} />
      <ambientLight intensity={0.45} />
      <pointLight position={[-3, 2.4, 3.5]} intensity={38} color="#f0a6ba" distance={16} decay={2} />
      <pointLight position={[3, 2.2, 3.5]} intensity={26} color="#f6e8d7" distance={16} decay={2} />
      <Stars radius={26} depth={20} count={900} factor={2.4} fade speed={0.3} />
      <Suspense fallback={null}>
        <Phone side="L" progress={progress} sceneCount={sceneCount} />
        <Phone side="R" progress={progress} sceneCount={sceneCount} />
        <Hearts progress={progress} sceneCount={sceneCount} />
        <StickerBurst progress={progress} sceneCount={sceneCount} />
        <SoundWaves progress={progress} sceneCount={sceneCount} />
        <FilmReel progress={progress} sceneCount={sceneCount} />
        <GameTable progress={progress} sceneCount={sceneCount} />
        <GroupOrbs progress={progress} sceneCount={sceneCount} />
        <ConfettiRibbon progress={progress} sceneCount={sceneCount} />
        <NotificationSweep progress={progress} sceneCount={sceneCount} />
      </Suspense>
    </>
  );
}

export function Feature3DWalkthroughScene({ sceneCount }: { sceneCount: number }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const container = document.querySelector<HTMLElement>("[data-walkthrough-root]");
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const scrolled = Math.min(Math.max(-rect.top, 0), total);
      setProgress(total > 0 ? scrolled / total : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const key = useMemo(() => `walk-${sceneCount}`, [sceneCount]);

  return (
    <Canvas key={key} dpr={[1, 1.7]} gl={{ antialias: true, alpha: true }}>
      <Rig progress={progress} sceneCount={sceneCount} />
    </Canvas>
  );
}
