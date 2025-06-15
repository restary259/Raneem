
import { Canvas, useFrame } from '@react-three/fiber'
import { Text, Sphere } from '@react-three/drei'
import React, { useRef } from 'react'
import * as THREE from 'three'

const RotatingGlobe = () => {
  const ref = useRef<THREE.Group>(null!)

  useFrame((_state, delta) => {
    if (ref.current) {
        ref.current.rotation.y -= delta / 15;
        ref.current.rotation.x -= delta / 20;
    }
  });

  return (
    <group ref={ref} rotation={[0.1, 0, 0]}>
        <Sphere args={[2.5, 64, 64]}>
            <meshStandardMaterial color="#FFA500" wireframe={true} />
        </Sphere>
    </group>
  )
}

const FloatingText = () => {
  return (
    <Text
      fontSize={1.5}
      color="white"
      maxWidth={10}
      textAlign="center"
      anchorX="center"
      anchorY="middle"
      position={[0, 0, 4]}
    >
      رفيقك الدراسي العالمي
    </Text>
  );
};

const HeroScene = () => {
  return (
    <Canvas camera={{ position: [0, 0, 10], fov: 45 }} frameloop="always">
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      <RotatingGlobe />
      <FloatingText />
    </Canvas>
  )
}
export default HeroScene;
