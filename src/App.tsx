import { Canvas } from '@react-three/fiber'
import { Leva } from 'leva'
import { Suspense, useState } from 'react'
import { Scene } from './scene/Scene'
import { Hud } from './ui/Hud'

export default function App() {
  const [ready, setReady] = useState(false)

  return (
    <div className="app">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [1.5, 1.05, 2.0], fov: 40, near: 0.1, far: 100 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.toneMappingExposure = 1.15
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
