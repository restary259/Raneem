
import { Canvas } from '@react-three/fiber'
import { Text, Float } from '@react-three/drei'

const HeroScene = () => {
  return (
    <Canvas camera={{ position: [0, 0, 10], fov: 45 }}>
      <ambientLight intensity={1.5} />
      <pointLight position={[10, 10, 10]} />
      <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.5}>
        <Text
          fontSize={2}
          color="#FFA500"
          maxWidth={10}
          textAlign="center"
          font="https://fonts.gstatic.com/s/cairo/v28/SLXgc-MaZaZoY4msu-AGiA.ttf"
          anchorX="center"
          anchorY="middle"
        >
          رفيقك الدراسي العالمي
        </Text>
      </Float>
    </Canvas>
  )
}
export default HeroScene;
