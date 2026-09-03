import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { engineerStore } from '../state/engineerStore'
import { playDeploy, playDry } from '../audio/sfx'
import { useKeyBinding } from '../input/useKeyBinding'

interface ArmCfg {
  side: -1 | 1
  /** 上臂对/下臂对的高度错位（避免四臂重叠） */
  offsetY: number
}

const ARMS: ArmCfg[] = [
  { side: -1, offsetY: -0.06 },
  { side: -1, offsetY: -0.4 },
  { side: 1, offsetY: -0.06 },
  { side: 1, offsetY: -0.4 },
]

/**
 * C 工程兵四机械臂（背后式四臂）：
 * - 背部左右各一个"肩挂架"，上/下两对机械臂从挂架探出
 * - 平时收起不可见；按 2 展开，四臂从左右边缘"扫进来"（不是悬空）
 * - 部署时向落点前伸但保持各自侧面，装配窗口做操作摆动
 */
export function QuadArms() {
  const { camera } = useThree()
  const follower = useRef<THREE.Group>(null!)
  const armRoots = useRef<(THREE.Group | null)[]>([])
  const upperSegs = useRef<(THREE.Group | null)[]>([])
  const forearmSegs = useRef<(THREE.Group | null)[]>([])
  const pods = useRef<(THREE.Group | null)[]>([])
  const armsK = useRef(0)
  const busyK = useRef(0)
  const _v = useRef(new THREE.Vector3())
  const _inv = useRef(new THREE.Quaternion())

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
    const now = performance.now()
    const targetMode = mode === 'stowed' ? 0 : 1
    const busyTarget = mode === 'busy' || pending ? 1 : 0
    armsK.current = THREE.MathUtils.damp(armsK.current, targetMode, 7, dt)
    busyK.current = THREE.MathUtils.damp(busyK.current, busyTarget, 8, dt)

    const open = armsK.current
    const reach = busyK.current
    const work = pending && now >= pending.commitAt ? 1 : 0
    follower.current.position.copy(camera.position)
    follower.current.quaternion.copy(camera.quaternion)
    follower.current.visible = open > 0.02

    // 部署目标在相机局部空间的坐标（只用于"方向感"，不把四臂完全拉向中心）
    let aimX = 0
    let aimY = -0.3
    let aimZ = -0.6
    if (pending) {
      _inv.current.copy(camera.quaternion).invert()
      _v.current
        .set(pending.x - camera.position.x, 0.22 - camera.position.y, pending.z - camera.position.z)
        .applyQuaternion(_inv.current)
      aimX = THREE.MathUtils.clamp(_v.current.x, -0.45, 0.45)
      aimY = THREE.MathUtils.clamp(_v.current.y, -0.62, -0.1)
      aimZ = THREE.MathUtils.clamp(_v.current.z, -0.95, -0.3)
    }

    // 肩挂架：四臂的"根"，展开时从画面两侧边缘出现并向前带出
    const podOpen = 0.22 + open * 0.78
    if (pods.current[0]) {
      const p = pods.current[0]
      p.visible = open > 0.02
      p.position.set(
        -THREE.MathUtils.lerp(0.66, 0.4, open),
        -0.2 - reach * 0.05,
        THREE.MathUtils.lerp(0.2, -0.4, open) - reach * 0.1,
      )
      p.scale.setScalar(podOpen)
    }
    if (pods.current[1]) {
      const p = pods.current[1]
      p.visible = open > 0.02
      p.position.set(
        THREE.MathUtils.lerp(0.66, 0.4, open),
        -0.2 - reach * 0.05,
        THREE.MathUtils.lerp(0.2, -0.4, open) - reach * 0.1,
      )
      p.scale.setScalar(podOpen)
    }

    for (let i = 0; i < ARMS.length; i++) {
      const cfg = ARMS[i]
      const root = armRoots.current[i]
      const upper = upperSegs.current[i]
      const forearm = forearmSegs.current[i]
      if (!root) continue

      const idle = Math.sin(state.clock.elapsedTime * 2 + i * 1.2) * 0.02 * open

      // 收起位（背侧/边缘）→ 展开位（肩前，保持在画面边缘但不完全出画）
      const stowX = cfg.side * 0.8
      const stowY = cfg.offsetY - 0.28
      const stowZ = 0.3
      const opX = cfg.side * 0.44
      const opY = cfg.offsetY
      const opZ = -0.5
      const x0 = THREE.MathUtils.lerp(stowX, opX, open)
      const y0 = THREE.MathUtils.lerp(stowY, opY, open)
      const z0 = THREE.MathUtils.lerp(stowZ, opZ, open)

      // 伸向落点：保持各自侧面（上/下、左/右有区分），不汇聚成一根
      const sideClamp = THREE.MathUtils.clamp(Math.abs(aimX) * 0.6, 0.2, 0.42)
      const rx = cfg.side * sideClamp
      const ry = THREE.MathUtils.lerp(opY, aimY + cfg.offsetY * 0.4, 0.55)
      const rz = THREE.MathUtils.lerp(opZ, aimZ, 0.6)
      const b = reach * 0.65

      root.position.set(
        THREE.MathUtils.lerp(x0, rx, b),
        THREE.MathUtils.lerp(y0, ry, b),
        THREE.MathUtils.lerp(z0, rz, b),
      )
      // 从背后"扫进来"：收起时向后仰，展开后转向前方
      root.rotation.set(
        THREE.MathUtils.lerp(0.78, -0.12, open) + idle + Math.sin(state.clock.elapsedTime * 8 + i * 1.5) * 0.07 * work,
        cfg.side * THREE.MathUtils.lerp(0.9, 0.16, open) - reach * cfg.side * 0.12,
        cfg.side * THREE.MathUtils.lerp(0.72, 0.12, open) + idle,
      )
      root.scale.setScalar(0.24 + open * 0.66)

      if (upper) {
        upper.rotation.x =
          THREE.MathUtils.lerp(0.35, -0.22, open) + idle * 0.6 + Math.sin(state.clock.elapsedTime * 9 + i * 1.7) * 0.11 * work
        upper.rotation.z = cfg.side * THREE.MathUtils.lerp(0.14, 0.04, open) + Math.cos(state.clock.elapsedTime * 7 + i) * 0.05 * work
      }
      if (forearm) {
        forearm.rotation.x =
          THREE.MathUtils.lerp(-0.3, 0.35, open) + idle * 0.8 + Math.sin(state.clock.elapsedTime * 11 + i * 1.3) * 0.13 * work
        forearm.rotation.z =
          cfg.side * THREE.MathUtils.lerp(-0.1, -0.02, open) - Math.sin(state.clock.elapsedTime * 10 + i) * 0.04 * work
      }
    }
  })

  return (
    <group ref={follower} name="quad-arms" visible={false}>
      {/* 背部左右肩挂架（视觉锚点，四臂从这里出来） */}
      {[-1, 1].map((side, i) => (
        <group
          key={`pod-${side}`}
          ref={(el) => {
            pods.current[i] = el
          }}
          visible={false}
        >
          <mesh userData={{ kind: 'fx' }}>
            <boxGeometry args={[0.14, 0.1, 0.16]} />
            <meshStandardMaterial color="#22262d" metalness={0.7} roughness={0.45} />
          </mesh>
          <mesh position={[0, 0.045, 0]} userData={{ kind: 'fx' }}>
            <boxGeometry args={[0.12, 0.02, 0.14]} />
            <meshBasicMaterial color="#ffb54d" toneMapped={false} />
          </mesh>
          <mesh position={[0, 0, -0.09]} rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
            <torusGeometry args={[0.06, 0.012, 8, 14]} />
            <meshStandardMaterial color="#2b2f38" metalness={0.7} roughness={0.4} />
          </mesh>
        </group>
      ))}

      {/* 四条机械臂：左上/左下/右上/右下 */}
      {ARMS.map((_, i) => (
        <group
          key={i}
          ref={(el) => {
            armRoots.current[i] = el
          }}
        >
          {/* 上臂段 */}
          <group
            ref={(el) => {
              upperSegs.current[i] = el
            }}
          >
            <mesh position={[0, -0.16, 0]} rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
              <cylinderGeometry args={[0.032, 0.038, 0.32, 10]} />
              <meshStandardMaterial color="#3a404c" metalness={0.72} roughness={0.42} />
            </mesh>
            <mesh position={[0.018, -0.16, 0.015]} rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
              <cylinderGeometry args={[0.008, 0.008, 0.22, 6]} />
              <meshBasicMaterial color="#ff7a3c" toneMapped={false} />
            </mesh>
            {/* 肘关节 */}
            <mesh position={[0, -0.33, 0]} userData={{ kind: 'fx' }}>
              <sphereGeometry args={[0.045, 10, 10]} />
              <meshStandardMaterial color="#262b34" metalness={0.8} roughness={0.4} />
            </mesh>
            <mesh position={[0, -0.33, 0]} rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
              <torusGeometry args={[0.045, 0.007, 8, 14]} />
              <meshBasicMaterial color="#ffb54d" toneMapped={false} />
            </mesh>

            {/* 前臂段 */}
            <group
              ref={(el) => {
                forearmSegs.current[i] = el
              }}
            >
              <mesh position={[0, -0.14, 0]} rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
                <cylinderGeometry args={[0.028, 0.034, 0.28, 10]} />
                <meshStandardMaterial color="#333943" metalness={0.68} roughness={0.45} />
              </mesh>
              {/* 腕关节 */}
              <mesh position={[0, -0.29, 0]} userData={{ kind: 'fx' }}>
                <sphereGeometry args={[0.035, 10, 10]} />
                <meshStandardMaterial color="#262b34" metalness={0.78} roughness={0.42} />
              </mesh>
              {/* 双指爪 */}
              <mesh position={[0.022, -0.34, 0]} rotation={[0, 0, 0.55]} userData={{ kind: 'fx' }}>
                <boxGeometry args={[0.016, 0.09, 0.028]} />
                <meshStandardMaterial color="#2b2f38" metalness={0.7} roughness={0.42} />
              </mesh>
              <mesh position={[-0.022, -0.34, 0]} rotation={[0, 0, -0.55]} userData={{ kind: 'fx' }}>
                <boxGeometry args={[0.016, 0.09, 0.028]} />
                <meshStandardMaterial color="#2b2f38" metalness={0.7} roughness={0.42} />
              </mesh>
              <mesh position={[0, -0.37, 0]} userData={{ kind: 'fx' }}>
                <sphereGeometry args={[0.014, 8, 8]} />
                <meshBasicMaterial color="#ffb54d" toneMapped={false} />
              </mesh>
            </group>
          </group>
        </group>
      ))}
    </group>
  )
}
