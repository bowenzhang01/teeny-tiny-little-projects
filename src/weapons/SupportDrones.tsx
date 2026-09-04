import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { rangeStore } from '../state/rangeStore'
import { medicStore, type DroneSupport } from '../state/medicStore'
import { targetRegistry } from '../combat/targetRegistry'
import { playDeploy, playDry } from '../audio/sfx'
import { useKeyBinding } from '../input/useKeyBinding'

/** 虚拟队友全息标记点（占位：未来替换为真实队友实体位置） */
const TEAM_SPOTS = [
  { id: 'A', x: -2.4, z: -2.3, color: '#f87171' },
  { id: 'B', x: 2.4, z: -2.3, color: '#41e3ff' },
  { id: 'C', x: -2.4, z: 1.9, color: '#fbbf24' },
  { id: 'E', x: 2.4, z: 1.9, color: '#c084fc' },
] as const

const SUPPORT_ORDER: DroneSupport[] = ['heal', 'enhance', 'cloak']

/**
 * D 医疗兵第四系统：四台支援无人机（D1–D4）。
 * - Q：展开（环绕）/ 收回；F：环绕 ↔ 支援（飞向虚拟队友全息点）
 * - T：HEAL → ENHANCE → CLOAK 现场循环切换
 * - HOVER：围绕玩家空域环绕；ASSIST：飞往 A/B/C/E 全息点并投放支援特效
 * - 传感器自动标记最近活目标，写入 medicStore；LockSystem 读取以放宽锁定
 */
export function SupportDrones() {
  const { camera } = useThree()
  const droneRefs = useRef<(THREE.Group | null)[]>([])
  const beamRefs = useRef<(THREE.Mesh | null)[]>([])
  const waveRefs = useRef<(THREE.Mesh | null)[]>([])
  const cloakRefs = useRef<(THREE.Mesh | null)[]>([])
  const teamAuraRef = useRef<THREE.Mesh | null>(null)
  const cloakSelfRef = useRef<THREE.Mesh | null>(null)
  const deployK = useRef(0)
  const lastSensorAt = useRef(0)
  const _dir = useRef(new THREE.Vector3())
  const _v = useRef(new THREE.Vector3())
  const _stowLocal = useRef(new THREE.Vector3())
  const _up = useRef(new THREE.Vector3(0, 1, 0))

  const message = (text: string) => {
    const s = rangeStore.getState()
    rangeStore.set({ message: text, messageId: s.messageId + 1 })
  }

  const toggleDrone = () => {
    const s = medicStore.getState().drones
    if (s.mode === 'stowed') {
      medicStore.setDrones({ mode: 'hover', transitionUntil: performance.now() + 400 })
      playDeploy()
      message('无人机阵列展开 · DRONE ARRAY ONLINE')
    } else {
      medicStore.setDrones({ mode: 'stowed', transitionUntil: performance.now() + 400, sensorTarget: null })
      playDeploy()
      message('无人机收回 · DRONES STOWED')
    }
  }

  const toggleAssist = () => {
    const s = medicStore.getState().drones
    if (s.mode === 'stowed') {
      playDry()
      message('无人机未展开 · 先按 Q')
      return
    }
    if (s.mode === 'hover') {
      medicStore.setDrones({ mode: 'assist' })
      playDeploy()
      message('无人机支援展开 · ASSIST LINK')
    } else {
      medicStore.setDrones({ mode: 'hover' })
      playDeploy()
      message('无人机回归环绕 · HOVER')
    }
  }

  const cycleSupport = () => {
    const cur = medicStore.getState().drones.support
    const idx = SUPPORT_ORDER.indexOf(cur)
    const next: DroneSupport = SUPPORT_ORDER[(idx + 1) % SUPPORT_ORDER.length]
    medicStore.setDrones({ support: next })
    playDeploy()
    message(`支援模式切换 · ${next.toUpperCase()}`)
  }

  useKeyBinding('medicDroneToggle', {
    contexts: ['roleHud'],
    onDown: (e) => {
      if (e.repeat) return
      toggleDrone()
    },
  })
  useKeyBinding('medicDroneMove', {
    contexts: ['roleHud'],
    onDown: (e) => {
      if (e.repeat) return
      toggleAssist()
    },
  })
  useKeyBinding('medicDroneMode', {
    contexts: ['roleHud'],
    onDown: (e) => {
      if (e.repeat) return
      cycleSupport()
    },
  })

  useFrame((state, dt) => {
    const st = medicStore.getState().drones
    const range = rangeStore.getState()
    const now = performance.now()
    const active = st.mode !== 'stowed'
    const support = st.support
    const assist = st.mode === 'assist'

    deployK.current = THREE.MathUtils.damp(deployK.current, active ? 1 : 0, 7, dt)
    const k = deployK.current
    const show = range.locked && k > 0.02

    // 传感器：自动标记最近活目标（烟雾中不受影响，文档语义保留）
    if (now - lastSensorAt.current > 350) {
      lastSensorAt.current = now
      let best: string | null = null
      let bestDist = Infinity
      for (const tg of targetRegistry.alive()) {
        const p = targetRegistry.aimWorld(tg, _v.current)
        const d = p.distanceTo(camera.position)
        if (d < bestDist) {
          bestDist = d
          best = tg.id
        }
      }
      const next = active ? best : null
      if (st.sensorTarget !== next) medicStore.setDrones({ sensorTarget: next })
    }

    // 环绕/支援位置
    camera.getWorldDirection(_dir.current)
    const yaw = Math.atan2(_dir.current.x, -_dir.current.z)
    const t = state.clock.elapsedTime

    for (let i = 0; i < TEAM_SPOTS.length; i++) {
      const drone = droneRefs.current[i]
      if (!drone) continue
      const spot = TEAM_SPOTS[i]
      drone.visible = show
      drone.scale.setScalar(0.06 + k * 0.82)

      const desired = _v.current
      if (st.mode === 'stowed') {
        // 收回：飞到角色背部（相机背后），保持水平姿态并缩小
        const x = i % 2 === 0 ? -0.26 : 0.26
        const y = i < 2 ? -0.12 : -0.36
        const z = 0.62 + (i < 2 ? 0 : 0.1)
        _stowLocal.current.set(x, y, z).applyQuaternion(camera.quaternion)
        desired.copy(_stowLocal.current).add(camera.position)
        drone.position.lerp(desired, Math.min(1, dt * 5.5))
        drone.rotation.set(0, drone.rotation.y, 0)
      } else if (assist) {
        desired.set(spot.x, 2.35, spot.z)
        drone.position.lerp(desired, Math.min(1, dt * 2.4))
        // 水平飞向队友标记点：只保持偏航朝目标，机身保持横向/平飞
        const dyaw = Math.atan2(spot.x - drone.position.x, spot.z - drone.position.z)
        drone.rotation.set(0, dyaw, 0)
      } else {
        const angle = t * 0.55 + (i * Math.PI) / 2 + yaw
        desired.set(
          camera.position.x + Math.cos(angle) * 1.7,
          camera.position.y + 0.65,
          camera.position.z + Math.sin(angle) * 1.7,
        )
        drone.position.lerp(desired, Math.min(1, dt * 6))
        // 环绕时同样保持水平，机身沿切向偏航，不做“点头”姿态
        drone.rotation.set(0, -angle, 0)
      }

      // 旋翼快速旋转
      drone.traverse((o) => {
        if ((o as THREE.Object3D).name === 'rotor') {
          ;(o as THREE.Object3D).rotation.y += dt * 30
        }
      })

      // HEAL 治疗链路：无人机 → 队友全息点光束 + 治疗波环
      const beam = beamRefs.current[i]
      if (beam) {
        if (active && assist && support === 'heal' && drone.visible) {
          const from = drone.position
          const to = _v.current.set(spot.x, 1.4, spot.z)
          const dir = to.clone().sub(from)
          const len = Math.max(0.001, dir.length())
          const norm = dir.clone().normalize()
          beam.visible = true
          beam.position.copy(from).addScaledVector(norm, len / 2)
          beam.quaternion.setFromUnitVectors(_up.current, norm)
          beam.scale.set(1, len, 1)
        } else {
          beam.visible = false
        }
      }

      const wave = waveRefs.current[i]
      if (wave) {
        const on = active && assist && support === 'heal'
        wave.visible = on
        if (on) {
          const phase = (t * 0.75 + i * 0.28) % 1
          wave.scale.setScalar(0.6 + phase * 2.1)
          ;(wave.material as THREE.MeshBasicMaterial).opacity = (1 - phase) * 0.8
        }
      }

      const cloak = cloakRefs.current[i]
      if (cloak) {
        const on = active && support === 'cloak'
        cloak.visible = on
        if (on) {
          cloak.scale.setScalar(1 + Math.sin(t * 2 + i) * 0.06)
          ;(cloak.material as THREE.MeshBasicMaterial).opacity = 0.13 + Math.sin(t * 2.4 + i) * 0.03
        }
      }
    }

    // 自身效果：HEAL/ENHANCE 绿色能量场 / CLOAK 隐形泡
    if (teamAuraRef.current) {
      const on = range.locked && active && (support === 'heal' || support === 'enhance')
      teamAuraRef.current.visible = on
      if (on) {
        teamAuraRef.current.position.copy(camera.position)
        teamAuraRef.current.scale.setScalar(1 + Math.sin(t * 2.2) * 0.05)
      }
    }
    if (cloakSelfRef.current) {
      const on = range.locked && active && support === 'cloak'
      cloakSelfRef.current.visible = on
      if (on) {
        cloakSelfRef.current.position.copy(camera.position)
        cloakSelfRef.current.scale.setScalar(1 + Math.sin(t * 1.8) * 0.04)
        ;(cloakSelfRef.current.material as THREE.MeshBasicMaterial).opacity = 0.1 + Math.sin(t * 2.2) * 0.02
      }
    }
  })

  return (
    <group name="support-drones">
      {/* 虚拟队友全息标记点（颜色区分 A/B/C/E） */}
      {TEAM_SPOTS.map((s) => (
        <group key={s.id} name={`holo-${s.id}`} position={[s.x, 0, s.z]}>
          <mesh position={[0, 1.2, 0]}>
            <cylinderGeometry args={[0.32, 0.32, 2.3, 18, 1, true]} />
            <meshBasicMaterial color={s.color} transparent opacity={0.15} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.42, 0.5, 36]} />
            <meshBasicMaterial color={s.color} transparent opacity={0.5} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
          </mesh>
          <mesh position={[0, 2.42, 0]}>
            <boxGeometry args={[0.14, 0.14, 0.14]} />
            <meshBasicMaterial color={s.color} transparent opacity={0.7} toneMapped={false} />
          </mesh>
        </group>
      ))}

      {/* 四台小型四旋翼无人机 */}
      {TEAM_SPOTS.map((_, i) => (
        <group key={`drone-${i}`} ref={(el) => { droneRefs.current[i] = el }} visible={false}>
          <mesh castShadow userData={{ kind: 'fx' }}>
            <boxGeometry args={[0.13, 0.08, 0.13]} />
            <meshStandardMaterial color="#2b2f38" metalness={0.75} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.075, 0]} userData={{ kind: 'fx' }}>
            <boxGeometry args={[0.04, 0.018, 0.04]} />
            <meshBasicMaterial color="#4ade80" toneMapped={false} />
          </mesh>
          {[
            [-0.14, -0.14],
            [0.14, -0.14],
            [-0.14, 0.14],
            [0.14, 0.14],
          ].map(([x, z], j) => (
            <group key={j}>
              <mesh position={[x / 2, 0.02, z / 2]} rotation={[0, Math.atan2(z, x), 0]} userData={{ kind: 'fx' }}>
                <boxGeometry args={[0.17, 0.022, 0.03]} />
                <meshStandardMaterial color="#3a404c" metalness={0.8} roughness={0.35} />
              </mesh>
              <group name="rotor" position={[x, 0.055, z]}>
                <mesh rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
                  <cylinderGeometry args={[0.07, 0.07, 0.01, 16]} />
                  <meshBasicMaterial color="#86efac" transparent opacity={0.35} toneMapped={false} depthWrite={false} />
                </mesh>
                <mesh rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
                  <cylinderGeometry args={[0.02, 0.02, 0.018, 8]} />
                  <meshStandardMaterial color="#191d24" metalness={0.8} roughness={0.3} />
                </mesh>
              </group>
            </group>
          ))}
        </group>
      ))}

      {/* 世界特效：治疗波环 / 隐形泡 / 治疗光束 */}
      {TEAM_SPOTS.map((s, i) => (
        <group key={`fx-${s.id}`}>
          <mesh ref={(el) => { waveRefs.current[i] = el }} position={[s.x, 1.15, s.z]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
            <ringGeometry args={[0.42, 0.5, 40]} />
            <meshBasicMaterial color="#4ade80" transparent opacity={0.8} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
          </mesh>
          <mesh ref={(el) => { cloakRefs.current[i] = el }} position={[s.x, 1.35, s.z]} visible={false}>
            <sphereGeometry args={[0.85, 20, 14]} />
            <meshBasicMaterial color="#86efac" transparent opacity={0.13} depthWrite={false} toneMapped={false} />
          </mesh>
          <mesh ref={(el) => { beamRefs.current[i] = el }} visible={false}>
            <cylinderGeometry args={[0.012, 0.012, 1, 6]} />
            <meshBasicMaterial color="#4ade80" transparent opacity={0.8} depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} />
          </mesh>
        </group>
      ))}

      {/* 自身能量场/隐形泡 */}
      <mesh ref={teamAuraRef} visible={false}>
        <sphereGeometry args={[0.95, 20, 14]} />
        <meshBasicMaterial color="#4ade80" transparent opacity={0.08} depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh ref={cloakSelfRef} visible={false}>
        <sphereGeometry args={[1.05, 20, 14]} />
        <meshBasicMaterial color="#86efac" transparent opacity={0.1} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}
