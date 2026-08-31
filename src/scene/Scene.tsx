import {
  ContactShadows,
  Environment,
  Grid,
  Lightformer,
  OrbitControls,
  Stats,
} from '@react-three/drei'
import { useControls } from 'leva'
import { Vignette, EffectComposer } from '@react-three/postprocessing'
import { HemController } from './HemController'
import { Legs } from './Legs'
import { Pantyhose } from './Pantyhose'

const wireFromUrl =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('wire') === '1'

export function Scene() {
  const { iterations, opacity, hoseColor, wireframe } = useControls('连裤袜', {
    iterations: { value: 4, min: 1, max: 8, step: 1, label: '褶皱幅度' },
    opacity: { value: 0.55, min: 0.1, max: 1, step: 0.01, label: '透明度' },
    hoseColor: { value: '#5a4a6e', label: '袜子颜色' },
    wireframe: { value: wireFromUrl, label: '线框调试' },
  })

  return (
    <>
      {/* 背景与雾 */}
      <color attach="background" args={['#141926']} />
      <fog attach="fog" args={['#141926', 7, 20]} />

      {/* 摄影棚灯光 */}
      <ambientLight intensity={0.7} />
      <hemisphereLight args={['#48536e', '#0b0e14', 0.85]} />
      <directionalLight
        castShadow
        position={[4, 7, 5]}
        intensity={3.4}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0002}
      />
      <pointLight position={[-4, 2.2, 2]} intensity={50} color="#7c5cff" />
      <pointLight position={[0, 3, -6]} intensity={35} color="#60a5fa" />

      {/* 地面 */}
      <Grid
        args={[20, 20]}
        cellSize={0.4}
        cellThickness={0.5}
        cellColor="#2a3142"
        sectionSize={2}
        sectionThickness={1}
        sectionColor="#434e66"
        fadeDistance={18}
        fadeStrength={1.5}
        infiniteGrid
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[2.6, 64]} />
        <meshStandardMaterial color="#171b26" roughness={0.9} metalness={0.05} />
      </mesh>

      {/* 主体：腿 + 裙子 + 连裤袜布料 */}
      <group position={[0, 0, 0]}>
        <Legs />
        <HemController />
        <Pantyhose side={-1} iterations={iterations} opacity={opacity} color={hoseColor} wireframe={wireframe} />
        <Pantyhose side={1} iterations={iterations} opacity={opacity} color={hoseColor} wireframe={wireframe} />
      </group>

      <ContactShadows
        position={[0, 0.01, 0]}
        opacity={0.6}
        scale={7}
        blur={2.2}
        far={5}
        resolution={1024}
        color="#000000"
      />

      {/* 程序化环境光 */}
      <Environment resolution={256}>
        <Lightformer intensity={6} position={[0, 5, -7]} scale={[10, 6, 1]} color="#b7c1d6" />
        <Lightformer intensity={4} position={[-6, 3, 4]} scale={[8, 5, 1]} color="#8b6cf0" />
        <Lightformer intensity={4} position={[6, 2, 4]} scale={[8, 5, 1]} color="#4b8bdd" />
      </Environment>

      {/* 相机控制 */}
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={1.2}
        maxDistance={8}
        maxPolarAngle={Math.PI / 2.1}
        target={[0, 0.5, 0]}
      />

      <EffectComposer>
        <Vignette eskil={false} offset={0.28} darkness={0.62} />
      </EffectComposer>

      <Stats showPanel={0} className="stats" />
    </>
  )
}
