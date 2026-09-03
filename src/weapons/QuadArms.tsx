import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { engineerStore } from '../state/engineerStore'
import { playDeploy, playDry } from '../audio/sfx'
import { useKeyBinding } from '../input/useKeyBinding'

interface ArmCfg {
  x: number
  y: number
  z: number
  side: -1 | 1
}

const ARMS: ArmCfg[] = [
  { x: -0.72, y: -0.26, z: -0.42, side: -1 },
  { x: -0.42, y: -0.06, z: -0.5, side: -1 },
  { x: 0.42, y: -0.06, z: -0.5, side: 1 },
  { x: 0.72, y: -0.26, z: -0.42, side: 1 },
]

/**
 * C 工程兵四机械臂（C-3）：
 * - 平时收起不可见；按 2 展开到画面两侧，进入 OPERATE 操作姿态
 * - 不直接伤害；BUSY 状态时四臂向前伸，作为部署炮塔/地雷/屏障的动画载体
 * - 部署/回收动画由 armsMode（stowed/operate/busy）驱动
 */
export function QuadArms() {
  const { camera } = useThree()
  const follower = useRef<THREE.Group>(null!)
  const armRefs = useRef<(THREE.Group | null)[]>([])
  const armsK = useRef(0)
  const busyK = useRef(0)

  const toggleArms = () => {
    const s = engineerStore.getState()
    if (s.armsMode === 'busy') {
      playDry()
      return
    }
    const next: 'stowed' | 'operate' = s.armsMode === 'stowed' ? 'operate' : 'stowed'
    engineerStore.set({ armsMode: next })
    if (next === 'operate') playDeploy()
  }

  useKeyBinding('toggleArms', {
    onDown: (e) => {
      if (e.repeat) return
      toggleArms()
    },
  })

  useFrame((state, dt) => {
    if (!follower.current) return
    const mode = engineerStore.getState().armsMode
    const target = mode === 'stowed' ? 0 : 1
    const busyTarget = mode === 'busy' ? 1 : 0
    armsK.current = THREE.MathUtils.damp(armsK.current, target, 7, dt)
    busyK.current = THREE.MathUtils.damp(busyK.current, busyTarget, 7, dt)

    const k = armsK.current
    const busy = busyK.current
    follower.current.position.copy(camera.position)
    follower.current.quaternion.copy(camera.quaternion)
    follower.current.visible = k > 0.02

    for (let i = 0; i < ARMS.length; i++) {
      const g = armRefs.current[i]
      if (!g) continue
      const cfg = ARMS[i]
      const idle = Math.sin(state.clock.elapsedTime * 2 + i * 1.3) * 0.03 * k
      g.position.set(
        cfg.x * k,
        THREE.MathUtils.lerp(-0.5, cfg.y, k) + busy * -0.04,
        THREE.MathUtils.lerp(0.15, cfg.z, k) + busy * -0.22,
      )
      g.rotation.set(
        THREE.MathUtils.lerp(0, -0.28, busy) + idle,
        cfg.side * (0.3 * k) + busy * 0.12 * -cfg.side,
        -cfg.side * (0.32 * k) + idle,
      )
      g.scale.setScalar(0.25 + k * 0.75)
    }
  })

  return (
    <group ref={follower} name="quad-arms" visible={false}>
      {ARMS.map((_, i) => (
        <group
          key={i}
          ref={(el) => {
            armRefs.current[i] = el
          }}
        >
          {/* 肩部基座 */}
          <mesh userData={{ kind: 'fx' }}>
            <boxGeometry args={[0.12, 0.14, 0.16]} />
            <meshStandardMaterial color="#2b2f38" metalness={0.75} roughness={0.4} />
          </mesh>
          {/* 上臂 */}
          <mesh position={[0, -0.14, -0.02]} userData={{ kind: 'fx' }}>
            <boxGeometry args={[0.07, 0.3, 0.08]} />
            <meshStandardMaterial color="#3a404c" metalness={0.8} roughness={0.35} />
          </mesh>
          {/* 肘部 */}
          <mesh position={[0, -0.3, -0.02]} userData={{ kind: 'fx' }}>
            <sphereGeometry args={[0.05, 10, 10]} />
            <meshStandardMaterial color="#22262d" metalness={0.8} roughness={0.35} />
          </mesh>
          {/* 前臂 */}
          <mesh position={[0, -0.42, -0.06]} rotation={[0.15, 0, 0]} userData={{ kind: 'fx' }}>
            <boxGeometry args={[0.06, 0.26, 0.07]} />
            <meshStandardMaterial color="#333943" metalness={0.75} roughness={0.4} />
          </mesh>
          {/* 末端机械爪 */}
          <group position={[0, -0.56, -0.1]}>
            <mesh position={[0.025, 0, 0]} rotation={[0, 0, 0.5]} userData={{ kind: 'fx' }}>
              <boxGeometry args={[0.02, 0.09, 0.04]} />
              <meshStandardMaterial color="#262b34" metalness={0.7} roughness={0.4} />
            </mesh>
            <mesh position={[-0.025, 0, 0]} rotation={[0, 0, -0.5]} userData={{ kind: 'fx' }}>
              <boxGeometry args={[0.02, 0.09, 0.04]} />
              <meshStandardMaterial color="#262b34" metalness={0.7} roughness={0.4} />
            </mesh>
            <mesh userData={{ kind: 'fx' }}>
              <sphereGeometry args={[0.02, 8, 8]} />
              <meshBasicMaterial color="#ffb54d" toneMapped={false} />
            </mesh>
          </group>
          {/* 液压红线 */}
          <mesh position={[0.02, -0.2, -0.02]} rotation={[0.18, 0, 0]} userData={{ kind: 'fx' }}>
            <cylinderGeometry args={[0.008, 0.008, 0.2, 6]} />
            <meshBasicMaterial color="#ff7a3c" toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
