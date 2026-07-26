import { Canvas, useFrame } from "@react-three/fiber";
import { Float, ContactShadows, Environment } from "@react-three/drei";
import { useRef } from "react";
import type { Group } from "three";

function Panda({ mood = "wave" }: { mood?: "wave" | "cheer" | "peek" | "sleep" }) {
  const root = useRef<Group>(null);
  const rightArm = useRef<Group>(null);
  const leftArm = useRef<Group>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (root.current) {
      root.current.rotation.y = Math.sin(t * 0.6) * 0.25;
      root.current.position.y = Math.sin(t * 1.6) * 0.05;
    }
    if (rightArm.current) {
      if (mood === "wave") rightArm.current.rotation.z = -0.8 + Math.sin(t * 5) * 0.5;
      else if (mood === "cheer") rightArm.current.rotation.z = -1.6 + Math.sin(t * 3) * 0.15;
      else rightArm.current.rotation.z = -0.2;
    }
    if (leftArm.current) {
      if (mood === "cheer") leftArm.current.rotation.z = 1.6 + Math.sin(t * 3 + 1) * 0.15;
      else leftArm.current.rotation.z = 0.2;
    }
  });

  const white = "#f7ecec";
  const black = "#1b1220";
  const pink = "#ec789b";

  return (
    <group ref={root} position={[0, -0.2, 0]}>
      {/* body */}
      <mesh position={[0, -0.35, 0]} castShadow>
        <sphereGeometry args={[0.55, 32, 32]} />
        <meshStandardMaterial color={white} roughness={0.6} />
      </mesh>
      {/* belly patch */}
      <mesh position={[0, -0.4, 0.35]}>
        <sphereGeometry args={[0.32, 24, 24]} />
        <meshStandardMaterial color="#fff6f8" roughness={0.7} />
      </mesh>
      {/* head */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <sphereGeometry args={[0.55, 32, 32]} />
        <meshStandardMaterial color={white} roughness={0.55} />
      </mesh>
      {/* ears */}
      {[-0.42, 0.42].map((x, i) => (
        <mesh key={i} position={[x, 0.95, -0.05]} castShadow>
          <sphereGeometry args={[0.18, 20, 20]} />
          <meshStandardMaterial color={black} roughness={0.5} />
        </mesh>
      ))}
      {/* eye patches */}
      {[-0.2, 0.2].map((x, i) => (
        <mesh key={i} position={[x, 0.55, 0.42]} rotation={[0, 0, x < 0 ? 0.3 : -0.3]}>
          <sphereGeometry args={[0.14, 20, 20]} />
          <meshStandardMaterial color={black} roughness={0.55} />
        </mesh>
      ))}
      {/* eyes */}
      {[-0.2, 0.2].map((x, i) => (
        <mesh key={i} position={[x, 0.56, 0.53]}>
          <sphereGeometry args={[0.05, 16, 16]} />
          <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={0.4} />
        </mesh>
      ))}
      {/* nose */}
      <mesh position={[0, 0.36, 0.55]}>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshStandardMaterial color={black} />
      </mesh>
      {/* blush */}
      {[-0.3, 0.3].map((x, i) => (
        <mesh key={i} position={[x, 0.32, 0.5]}>
          <sphereGeometry args={[0.07, 16, 16]} />
          <meshStandardMaterial color={pink} transparent opacity={0.6} />
        </mesh>
      ))}
      {/* arms */}
      <group ref={rightArm} position={[0.45, -0.15, 0.1]}>
        <mesh position={[0.15, 0.1, 0]} castShadow>
          <sphereGeometry args={[0.18, 20, 20]} />
          <meshStandardMaterial color={black} roughness={0.55} />
        </mesh>
      </group>
      <group ref={leftArm} position={[-0.45, -0.15, 0.1]}>
        <mesh position={[-0.15, 0.1, 0]} castShadow>
          <sphereGeometry args={[0.18, 20, 20]} />
          <meshStandardMaterial color={black} roughness={0.55} />
        </mesh>
      </group>
      {/* feet */}
      {[-0.22, 0.22].map((x, i) => (
        <mesh key={i} position={[x, -0.72, 0.15]} castShadow>
          <sphereGeometry args={[0.16, 20, 20]} />
          <meshStandardMaterial color={black} roughness={0.55} />
        </mesh>
      ))}
    </group>
  );
}

export default function PandaGuide3D({ mood = "wave" }: { mood?: "wave" | "cheer" | "peek" | "sleep" }) {
  return (
    <Canvas
      dpr={[1, 1.8]}
      camera={{ position: [0, 0.4, 3], fov: 38 }}
      gl={{ antialias: true, alpha: true }}
      style={{ width: "100%", height: "100%", background: "transparent" }}
    >
      <ambientLight intensity={0.8} />
      <directionalLight position={[2, 3, 2]} intensity={1.1} castShadow />
      <directionalLight position={[-2, 1, -1]} intensity={0.35} color="#ec789b" />
      <Environment preset="studio" />
      <Float speed={2} rotationIntensity={0.4} floatIntensity={0.6}>
        <Panda mood={mood} />
      </Float>
      <ContactShadows position={[0, -1.05, 0]} opacity={0.35} scale={4} blur={2.4} far={2} />
    </Canvas>
  );
}
