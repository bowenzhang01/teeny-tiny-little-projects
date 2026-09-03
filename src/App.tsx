import { Canvas } from '@react-three/fiber'
import { Leva } from 'leva'
import { Suspense, useState } from 'react'
import { Scene } from './scene/Scene'
import { Hud } from './hud/Hud'
import { useInputHygiene } from './input/useInputHygiene'

export default function App() {
  const [ready, setReady] = useState(false)
  useInputHygiene()

  return (
    <div className="app">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 2.35, 0], rotation: [-0.07, 0, 0], fov: 72, near: 0.08, far: 60 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.toneMappingExposure = 1.1
          setReady(true)
        }}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
      <Hud ready={ready} />
      <Leva collapsed />
    </div>
  )
}
