
import { Canvas, useFrame } from '@react-three/fiber'
import { Points, PointMaterial, Text, Sphere } from '@react-three/drei'
import React, { useRef } from 'react'
import * as random from 'maath/random/dist/maath-random.esm'
import * as THREE from 'three'

const GlobeWithPoints = () => {
  const ref = useRef<THREE.Group>(null!)

  useFrame((_state, delta) => {
    if (ref.current) {
        ref.current.rotation.y -= delta / 15;
        ref.current.rotation.x -= delta / 20;
    }
  });

  const sphere = random.inSphere(new Float32Array(5001), { radius: 2.7 })

  return (
    <group ref={ref} rotation={[0.1, 0, 0]}>
        <Points positions={sphere as Float32Array} stride={3} frustumCulled>
            <PointMaterial
              transparent
              color="#FFA500"
              size={0.02}
              sizeAttenuation={true}
              depthWrite={false}
            />
        </Points>
        <Sphere args={[2.5, 32, 32]}>
            <meshStandardMaterial color="#050816" wireframe={false} polygonOffset polygonOffsetFactor={-5} />
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
      font="https://fonts.gstatic.com/s/cairo/v28/SLXgc-MaZaZoY4msu-AGiA.ttf"
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
      <GlobeWithPoints />
      <FloatingText />
    </Canvas>
  )
}
export default HeroScene;
