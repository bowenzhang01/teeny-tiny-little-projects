import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { engineerStore } from '../state/engineerStore'
import { playDeploy, playDry } from '../audio/sfx'
import { useKeyBinding } from '../input/useKeyBinding'

interface ArmCfg {
  side: -1 | 1
}

const ARMS: ArmCfg[] = [
  { side: -1 },
  { side: -1 },
  { side: 1 },
  { side: 1 },
]

/**
 * C 工程兵四机械臂（C-3 打磨版）：
 * - 四段式结构：肩座 → 上臂 → 肘关节 → 前臂 → 腕 → 双指爪
 * - 展开（OPERATE）时从画面两侧探出；BUSY 时朝屏幕中央/地面前伸，
 *   配合 engineerStore.deploy.pending 实现"先伸手、部署物再出现"。
 */
export function QuadArms() {
  const { camera } = useThree()
  const follower = useRef<THREE.Group>(null!)
  const armRoots = useRef<(THREE.Group | null)[]>([])
  const upperSegs = useRef<(THREE.Group | null)[]>([])
  const forearmSegs = useRef<(THREE.Group | null)[]>([])
  const armsK = useRef(0)
  const busyK = useRef(0)

  const toggleArms = () => {
    const s = engineerStore.getState()
    if (s.armsMode === 'busy' || s.deploy.pending) {
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
    const s = engineerStore.getState()
    const mode = s.armsMode
    const pending = s.deploy.pending
    const targetMode = mode === 'stowed' ? 0 : 1
    const busyTarget = mode === 'busy' || pending ? 1 : 0
    armsK.current = THREE.MathUtils.damp(armsK.current, targetMode, 7, dt)
    busyK.current = THREE.MathUtils.damp(busyK.current, busyTarget, 8, dt)

    const open = armsK.current
    const reach = busyK.current
    follower.current.position.copy(camera.position)
    follower.current.quaternion.copy(camera.quaternion)
    follower.current.visible = open > 0.02

    for (let i = 0; i < ARMS.length; i++) {
      const cfg = ARMS[i]
      const root = armRoots.current[i]
      const upper = upperSegs.current[i]
      const forearm = forearmSegs.current[i]
      if (!root) continue

      const idle = Math.sin(state.clock.elapsedTime * 2 + i * 1.2) * 0.025 * open
      const baseX = cfg.side * THREE.MathUtils.lerp(0.3, 0.55, open)
      root.position.set(
        baseX * (1 - reach * 0.4),
        THREE.MathUtils.lerp(-0.48, -0.3, open) - reach * 0.08,
        THREE.MathUtils.lerp(0.2, -0.52, open) - reach * 0.3,
      )
      root.rotation.set(
        THREE.MathUtils.lerp(0, -0.3, reach) + idle,
        cfg.side * THREE.MathUtils.lerp(0.5, 0.08, open) - reach * cfg.side * 0.2,
        cfg.side * THREE.MathUtils.lerp(0.3, 0.08, open) + idle,
      )
      root.scale.setScalar(0.26 + open * 0.78)

      if (upper) {
        upper.rotation.x = THREE.MathUtils.lerp(0, -0.3, reach) + idle * 0.6
        upper.rotation.z = cfg.side * THREE.MathUtils.lerp(0.18, 0.05, open)
      }
      if (forearm) {
        forearm.rotation.x = THREE.MathUtils.lerp(0, 0.42, reach) + idle * 0.8
        forearm.rotation.z = cfg.side * THREE.MathUtils.lerp(-0.12, -0.03, open)
      }
    }
  })

  return (
    <group ref={follower} name="quad-arms" visible={false}>
      {ARMS.map((_, i) => (
        <group
          key={i}
          ref={(el) => {
            armRoots.current[i] = el
          }}
        >
          {/* 肩座 + 琥珀伺服环 */}
          <mesh userData={{ kind: 'fx' }}>
            <cylinderGeometry args={[0.07, 0.09, 0.14, 12]} />
            <meshStandardMaterial color="#2c323d" metalness={0.75} roughness={0.4} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.02, -0.06]} userData={{ kind: 'fx' }}>
            <torusGeometry args={[0.07, 0.012, 8, 16]} />
            <meshBasicMaterial color="#ffb54d" toneMapped={false} />
          </mesh>

          {/* 上臂段 */}
          <group
            ref={(el) => {
              upperSegs.current[i] = el
            }}
          >
            <mesh position={[0, -0.15, 0]} rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
              <cylinderGeometry args={[0.045, 0.045, 0.3, 10]} />
              <meshStandardMaterial color="#3a404c" metalness={0.8} roughness={0.35} />
            </mesh>
            {/* 液压杆 */}
            <mesh position={[0.02, -0.15, 0.01]} rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
              <cylinderGeometry args={[0.01, 0.01, 0.22, 6]} />
              <meshBasicMaterial color="#ff7a3c" toneMapped={false} />
            </mesh>
            {/* 肘关节 */}
            <mesh position={[0, -0.31, 0]} userData={{ kind: 'fx' }}>
              <sphereGeometry args={[0.06, 12, 12]} />
              <meshStandardMaterial color="#22262d" metalness={0.85} roughness={0.3} />
            </mesh>
            <mesh position={[0, -0.31, 0]} rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
              <torusGeometry args={[0.06, 0.008, 8, 14]} />
              <meshBasicMaterial color="#ffb54d" toneMapped={false} />
            </mesh>

            {/* 前臂段（挂在肘部下） */}
            <group
              ref={(el) => {
                forearmSegs.current[i] = el
              }}
            >
              <mesh position={[0, -0.13, 0]} rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
                <cylinderGeometry args={[0.035, 0.04, 0.26, 10]} />
                <meshStandardMaterial color="#333943" metalness={0.75} roughness={0.4} />
              </mesh>
              {/* 腕关节 */}
              <mesh position={[0, -0.27, 0]} userData={{ kind: 'fx' }}>
                <sphereGeometry args={[0.045, 10, 10]} />
                <meshStandardMaterial color="#22262d" metalness={0.8} roughness={0.35} />
              </mesh>
              {/* 双指爪 */}
              <mesh position={[0.028, -0.32, 0]} rotation={[0, 0, 0.55]} userData={{ kind: 'fx' }}>
                <boxGeometry args={[0.02, 0.1, 0.035]} />
                <meshStandardMaterial color="#2b2f38" metalness={0.7} roughness={0.4} />
              </mesh>
              <mesh position={[-0.028, -0.32, 0]} rotation={[0, 0, -0.55]} userData={{ kind: 'fx' }}>
                <boxGeometry args={[0.02, 0.1, 0.035]} />
                <meshStandardMaterial color="#2b2f38" metalness={0.7} roughness={0.4} />
              </mesh>
              <mesh position={[0, -0.35, 0]} userData={{ kind: 'fx' }}>
                <sphereGeometry args={[0.018, 8, 8]} />
                <meshBasicMaterial color="#ffb54d" toneMapped={false} />
              </mesh>
            </group>
          </group>
        </group>
      ))}
    </group>
  )
}
