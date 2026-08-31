import {
  ContactShadows,
  Environment,
  Float,
  Grid,
  Lightformer,
  OrbitControls,
  Sparkles,
  Stats,
} from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import { useControls } from 'leva'
import { useRef } from 'react'
import type { Mesh } from 'three'

/**
 * 默认演示场景：
 * 一个可实时调节参数的抽象 3D 组合，用于验证整条渲染链路。
 * 后续正式需求可以直接替换这里的场景内容。
 */
export function Scene() {
  const knot = useRef<Mesh>(null)
  const metal = useRef<Mesh>(null)
  const glass = useRef<Mesh>(null)

  const { color, metalness, speed, autoRotate } = useControls('场景参数', {
    color: { value: '#8b5cf6', label: '主色' },
    metalness: { value: 0.6, min: 0, max: 1, step: 0.01, label: '金属感' },
    speed: { value: 1, min: 0, max: 3, step: 0.1, label: '旋转速度' },
    autoRotate: { value: true, label: '自动旋转' },
  })

  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (knot.current) {
      knot.current.rotation.x = t * 0.15 * speed
      knot.current.rotation.y = t * 0.25 * speed
    }
    if (metal.current) {
      metal.current.rotation.x = -t * 0.4 * speed
      metal.current.rotation.y = t * 0.3 * speed
    }
    if (glass.current) {
      glass.current.rotation.y = t * 0.2 * speed
      glass.current.position.y = 1.2 + Math.sin(t * 1.2) * 0.25
    }
  })

  return (
    <>
      {/* 背景与雾 */}
      <color attach="background" args={['#141926']} />
      <fog attach="fog" args={['#141926', 20, 50]} />

      {/* 灯光 */}
      <ambientLight intensity={1} />
      <hemisphereLight args={['#46506a', '#0b0e14', 1.1]} />
      <directionalLight
        castShadow
        position={[6, 8, 4]}
        intensity={3.5}
        shadow-mapSize={[2048, 2048]}
      />
      <pointLight position={[-6, -2, -4]} intensity={60} color="#7c5cff" />

      {/* 地面网格 */}
      <Grid
        args={[40, 40]}
        cellSize={0.6}
        cellThickness={0.6}
        cellColor="#2a2f3d"
        sectionSize={3}
        sectionThickness={1}
        sectionColor="#4c5568"
        fadeDistance={38}
        fadeStrength={1.5}
        infiniteGrid
      />

      {/* 中心主物件：扭转环 */}
      <Float speed={1.6} rotationIntensity={0.4} floatIntensity={0.6}>
        <mesh ref={knot} castShadow receiveShadow position={[0, 2.2, 0]}>
          <torusKnotGeometry args={[1.1, 0.34, 220, 36]} />
          <meshStandardMaterial
            color={color}
            metalness={metalness}
            roughness={0.22}
          />
        </mesh>
      </Float>

      {/* 金属多面体 */}
      <Float speed={2} rotationIntensity={1.2} floatIntensity={1}>
        <mesh ref={metal} castShadow position={[-3.4, 0.9, 1.2]}>
          <icosahedronGeometry args={[0.9, 0]} />
          <meshStandardMaterial color="#d4d8e0" metalness={1} roughness={0.28} />
        </mesh>
      </Float>

      {/* 透明玻璃八面体 */}
      <mesh ref={glass} castShadow position={[3.3, 1.2, -1.2]}>
        <octahedronGeometry args={[0.9, 0]} />
        <meshPhysicalMaterial
          color="#9be7ff"
          metalness={0}
          roughness={0.08}
          transmission={0.9}
          thickness={0.8}
          ior={1.45}
        />
      </mesh>

      {/* 地面圆盘 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[12, 64]} />
        <meshStandardMaterial color="#161a24" roughness={0.85} metalness={0.1} />
      </mesh>

      {/* 氛围粒子 */}
      <Sparkles
        count={140}
        scale={[18, 8, 18]}
        size={2.2}
        speed={0.25}
        opacity={0.55}
        color="#a78bfa"
      />

      {/* 接触阴影 */}
      <ContactShadows
        position={[0, 0.01, 0]}
        opacity={0.65}
        scale={16}
        blur={2.4}
        far={10}
        resolution={1024}
        color="#000000"
      />

      {/* 程序化环境光照（无需下载 HDR 贴图） */}
      <Environment resolution={256}>
        <Lightformer intensity={6} position={[0, 6, -8]} scale={[12, 8, 1]} color="#b7c1d6" />
        <Lightformer intensity={5} position={[-8, 3, 4]} scale={[10, 6, 1]} color="#9b7cf5" />
        <Lightformer intensity={5} position={[8, 2, 5]} scale={[10, 6, 1]} color="#4b8bdd" />
      </Environment>

      {/* 相机控制 */}
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        autoRotate={autoRotate}
        autoRotateSpeed={0.6}
        minDistance={3}
        maxDistance={30}
        maxPolarAngle={Math.PI / 2.05}
        target={[0, 1.4, 0]}
      />

      {/* 后期处理 */}
      <EffectComposer>
        <Bloom
          intensity={0.55}
          luminanceThreshold={0.72}
          luminanceSmoothing={0.2}
          mipmapBlur
        />
        <Vignette eskil={false} offset={0.25} darkness={0.7} />
      </EffectComposer>

      {/* FPS 面板 */}
      <Stats showPanel={0} className="stats" />
    </>
  )
}
