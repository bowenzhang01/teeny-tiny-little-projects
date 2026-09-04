import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { rangeStore } from '../state/rangeStore'
import { commsStore } from '../state/commsStore'
import { spawnEmpGrenade } from '../combat/Projectiles'
import { playDry, playRailCharge } from '../audio/sfx'
import { useKeyBinding } from '../input/useKeyBinding'

/**
 * E 通信兵电子战投掷物：EMP-05 电磁干扰弹。
 * - T 向左前方投出（复用榴弹运动模型）
 * - 库存 2 颗，放置后约 8s 自动补满
 * - 命中后紫色电磁爆 + 短暂全屏扰动；标靶“瘫痪”倒下更久（4s）
 */
export function EmpKit() {
  const { camera } = useThree()
  const root = useRef<THREE.Group>(null!)
  const grenade = useRef<THREE.Group>(null!)

  const message = (text: string) => {
    const s = rangeStore.getState()
    rangeStore.set({ message: text, messageId: s.messageId + 1 })
  }

  const throwEmp = () => {
    const s = commsStore.getState()
    const range = rangeStore.getState()
    if (s.drone.linkView) return
    if (!range.locked || performance.now() < range.weaponBusyUntil) return
    if (s.emp.count <= 0) {
      playDry()
      message('EMP 耗尽 · 待补充')
      return
    }

    const dir = new THREE.Vector3()
    camera.getWorldDirection(dir)
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0)
    const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1)
    const origin = camera.position
      .clone()
      .addScaledVector(right, 0.42)
      .addScaledVector(up, -0.22)
      .addScaledVector(dir, 0.35)

    const left = right.clone().multiplyScalar(-0.22)
    spawnEmpGrenade(origin, dir.clone().addScaledVector(up, 0.12).add(left))
    playRailCharge()
    rangeStore.set({ shots: range.shots + 1 })
    commsStore.setEmp({ count: s.emp.count - 1, replenishAt: performance.now() + 8000 })
  }

  useKeyBinding('empThrow', {
    contexts: ['roleHud'],
    onDown: (e) => {
      if (e.repeat) return
      throwEmp()
    },
  })

  useFrame((state, dt) => {
    if (!root.current) return
    const s = commsStore.getState()
    const range = rangeStore.getState()
    const now = performance.now()

    root.current.position.copy(camera.position)
    root.current.quaternion.copy(camera.quaternion)
    root.current.visible = range.locked && !s.drone.linkView

    // 库存补充
    if (s.emp.replenishAt > 0 && now >= s.emp.replenishAt) {
      commsStore.setEmp({ count: s.emp.capacity, replenishAt: 0 })
      message('EMP 库存已补充 · EMP REFILLED')
    }

    if (grenade.current) {
      grenade.current.rotation.x = Math.sin(state.clock.elapsedTime * 2.5) * 0.05
      grenade.current.rotation.z = Math.cos(state.clock.elapsedTime * 1.9) * 0.05
    }
    void dt
  })

  return (
    <group ref={root} name="emp-kit" visible={false}>
      <group ref={grenade} position={[-0.52, -0.52, -0.72]} rotation={[0.3, -0.2, 0.25]} scale={0.5}>
        {/* 手持 EMP 弹：深色圆柱 + 紫色能量环 + 尖端电极 */}
        <mesh rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
          <cylinderGeometry args={[0.045, 0.045, 0.17, 12]} />
          <meshStandardMaterial color="#2c323d" metalness={0.7} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
          <cylinderGeometry args={[0.047, 0.047, 0.04, 12]} />
          <meshBasicMaterial color="#a855f7" toneMapped={false} />
        </mesh>
        <mesh position={[0, -0.08, 0]} rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
          <cylinderGeometry args={[0.02, 0.045, 0.05, 8]} />
          <meshStandardMaterial color="#22262d" metalness={0.75} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.1, 0]} userData={{ kind: 'fx' }}>
          <octahedronGeometry args={[0.018, 0]} />
          <meshBasicMaterial color="#e9d5ff" toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}
