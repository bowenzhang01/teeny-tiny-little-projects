import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { engineerStore } from '../state/engineerStore'
import { playDeploy, playDry } from '../audio/sfx'
import { useKeyBinding } from '../input/useKeyBinding'

interface ArmCfg {
  side: -1 | 1
  kind: 'shoulder' | 'waist'
  /** [x, y, z]：收纳位（背侧/画外） */
  stow: [number, number, number]
  /** [x, y, z]：展开位（肩上/腰前） */
  op: [number, number, number]
}

const ARMS: ArmCfg[] = [
  { side: -1, kind: 'shoulder', stow: [-0.7, 0.55, 0.3], op: [-0.42, 0.04, -0.4] },
  { side: 1, kind: 'shoulder', stow: [0.7, 0.55, 0.3], op: [0.42, 0.04, -0.4] },
  { side: -1, kind: 'waist', stow: [-0.62, -0.62, 0.3], op: [-0.42, -0.34, -0.42] },
  { side: 1, kind: 'waist', stow: [0.62, -0.62, 0.3], op: [0.42, -0.34, -0.42] },
]

/**
 * C 工程兵四机械臂（背后式，按用户原设定）：
 * - 上两条从肩膀上方伸出（画面左上/右上，从背后扫入）
 * - 下两条从腰间伸出（画面左下/右下）
 * - 每条为多关节臂：肩座 → 上臂 → 肘 → 前臂 → 腕 → 双指爪
 */
export function QuadArms() {
  const { camera } = useThree()
  const follower = useRef<THREE.Group>(null!)
  const armRoots = useRef<(THREE.Group | null)[]>([])
  const upperSegs = useRef<(THREE.Group | null)[]>([])
  const forearmSegs = useRef<(THREE.Group | null)[]>([])
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

    // 部署目标在相机局部空间的坐标（只用于方向感，不把四臂拉成一根）
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

    for (let i = 0; i < ARMS.length; i++) {
      const cfg = ARMS[i]
      const root = armRoots.current[i]
      const upper = upperSegs.current[i]
      const forearm = forearmSegs.current[i]
      if (!root) continue

      const isShoulder = cfg.kind === 'shoulder'
      const idle = Math.sin(state.clock.elapsedTime * 2 + i * 1.2) * 0.02 * open

      // 收起位 → 展开位
      const x0 = THREE.MathUtils.lerp(cfg.stow[0], cfg.op[0], open)
      const y0 = THREE.MathUtils.lerp(cfg.stow[1], cfg.op[1], open)
      const z0 = THREE.MathUtils.lerp(cfg.stow[2], cfg.op[2], open)

      // 伸向落点：肩上臂向中下、腰臂向中上，但保持各自侧向与上下分层
      const sideClamp = THREE.MathUtils.clamp(Math.abs(aimX) * 0.55, 0.22, 0.45)
      const rx = cfg.side * sideClamp
      const ry = THREE.MathUtils.lerp(cfg.op[1], isShoulder ? aimY + 0.08 : aimY - 0.06, reach * 0.7)
      const rz = THREE.MathUtils.lerp(cfg.op[2], aimZ, reach * 0.6)
      const b = reach * 0.65

      root.position.set(
        THREE.MathUtils.lerp(x0, rx, b),
        THREE.MathUtils.lerp(y0, ry, b),
        THREE.MathUtils.lerp(z0, rz, b),
      )
      // 从背后"扫进来"：肩上臂从上方翻入，腰臂从下方翻入
      const fold = isShoulder ? 1.15 : -1.15
      const unfold = isShoulder ? -0.12 : 0.12
      root.rotation.set(
        THREE.MathUtils.lerp(fold, unfold, open) + idle + Math.sin(state.clock.elapsedTime * 8 + i * 1.5) * 0.06 * work,
        cfg.side * THREE.MathUtils.lerp(0.75, 0.14, open) - reach * cfg.side * 0.1,
        cfg.side * THREE.MathUtils.lerp(0.55, 0.1, open) + idle,
      )
      root.scale.setScalar(0.22 + open * 0.68)

      // 多关节姿态：肩/腰两组的折叠方向相反
      if (upper) {
        upper.rotation.x =
          THREE.MathUtils.lerp(isShoulder ? 0.55 : -0.5, isShoulder ? -0.2 : 0.24, open) +
          idle * 0.6 +
          Math.sin(state.clock.elapsedTime * 9 + i * 1.7) * 0.1 * work
        upper.rotation.z =
          cfg.side * THREE.MathUtils.lerp(0.16, 0.04, open) + Math.cos(state.clock.elapsedTime * 7 + i) * 0.05 * work
      }
      if (forearm) {
        forearm.rotation.x =
          THREE.MathUtils.lerp(isShoulder ? -0.7 : 0.6, isShoulder ? 0.42 : -0.36, open) +
          idle * 0.8 +
          Math.sin(state.clock.elapsedTime * 11 + i * 1.3) * 0.12 * work
        forearm.rotation.z =
          cfg.side * THREE.MathUtils.lerp(-0.1, -0.02, open) - Math.sin(state.clock.elapsedTime * 10 + i) * 0.04 * work
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
          {/* 肩/腰挂点基座 */}
          <mesh userData={{ kind: 'fx' }}>
            <boxGeometry args={[0.12, 0.08, 0.12]} />
            <meshStandardMaterial color="#22262d" metalness={0.72} roughness={0.42} />
          </mesh>
          <mesh position={[0, 0.04, 0]} userData={{ kind: 'fx' }}>
            <boxGeometry args={[0.1, 0.015, 0.1]} />
            <meshBasicMaterial color="#ffb54d" toneMapped={false} />
          </mesh>

          {/* 上臂段 */}
          <group
            ref={(el) => {
              upperSegs.current[i] = el
            }}
          >
            <mesh position={[0, -0.16, 0]} rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
              <cylinderGeometry args={[0.03, 0.036, 0.32, 10]} />
              <meshStandardMaterial color="#3a404c" metalness={0.72} roughness={0.42} />
            </mesh>
            <mesh position={[0.018, -0.16, 0.015]} rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
              <cylinderGeometry args={[0.008, 0.008, 0.22, 6]} />
              <meshBasicMaterial color="#ff7a3c" toneMapped={false} />
            </mesh>
            {/* 肘关节（多关节节段结构） */}
            <mesh position={[0, -0.33, 0]} userData={{ kind: 'fx' }}>
              <sphereGeometry args={[0.042, 10, 10]} />
              <meshStandardMaterial color="#262b34" metalness={0.8} roughness={0.4} />
            </mesh>
            <mesh position={[0, -0.33, 0]} rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
              <torusGeometry args={[0.042, 0.007, 8, 14]} />
              <meshBasicMaterial color="#ffb54d" toneMapped={false} />
            </mesh>

            {/* 前臂 + 腕 + 爪 */}
            <group
              ref={(el) => {
                forearmSegs.current[i] = el
              }}
            >
              <mesh position={[0, -0.15, 0]} rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
                <cylinderGeometry args={[0.026, 0.032, 0.3, 10]} />
                <meshStandardMaterial color="#333943" metalness={0.68} roughness={0.45} />
              </mesh>
              {/* 腕关节 */}
              <mesh position={[0, -0.31, 0]} userData={{ kind: 'fx' }}>
                <sphereGeometry args={[0.032, 10, 10]} />
                <meshStandardMaterial color="#262b34" metalness={0.78} roughness={0.42} />
              </mesh>
              {/* 双指爪 */}
              <mesh position={[0.021, -0.36, 0]} rotation={[0, 0, 0.55]} userData={{ kind: 'fx' }}>
                <boxGeometry args={[0.015, 0.09, 0.026]} />
                <meshStandardMaterial color="#2b2f38" metalness={0.7} roughness={0.42} />
              </mesh>
              <mesh position={[-0.021, -0.36, 0]} rotation={[0, 0, -0.55]} userData={{ kind: 'fx' }}>
                <boxGeometry args={[0.015, 0.09, 0.026]} />
                <meshStandardMaterial color="#2b2f38" metalness={0.7} roughness={0.42} />
              </mesh>
              <mesh position={[0, -0.39, 0]} userData={{ kind: 'fx' }}>
                <sphereGeometry args={[0.013, 8, 8]} />
                <meshBasicMaterial color="#ffb54d" toneMapped={false} />
              </mesh>
            </group>
          </group>
        </group>
      ))}
    </group>
  )
}
