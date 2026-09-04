import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { rangeStore } from '../state/rangeStore'
import { medicStore } from '../state/medicStore'
import { spawnSmokeGrenade } from '../combat/Projectiles'
import { playDry, playSmokeThrow } from '../audio/sfx'
import { useKeyBinding } from '../input/useKeyBinding'

/**
 * D 医疗兵投掷物：烟雾弹（Smoke）。
 * - G 向左前方投出抛物线（复用榴弹运动模型）
 * - 库存 3 颗，放置后约 6s 自动补满
 * - 落地后约 6s 灰绿色半透明烟雾云（不伤害、不推倒，纯视觉遮蔽）
 */
export function SmokeKit() {
  const { camera } = useThree()
  const root = useRef<THREE.Group>(null!)
  const grenade = useRef<THREE.Group>(null!)

  const message = (text: string) => {
    const s = rangeStore.getState()
    rangeStore.set({ message: text, messageId: s.messageId + 1 })
  }

  const throwSmoke = () => {
    const s = medicStore.getState()
    const range = rangeStore.getState()
    if (!range.locked || performance.now() < range.weaponBusyUntil) return
    if (s.smoke.count <= 0) {
      playDry()
      message('烟雾弹耗尽 · 待补充')
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

    // 向左前方投出
    const left = right.clone().multiplyScalar(-0.22)
    spawnSmokeGrenade(origin, dir.clone().addScaledVector(up, 0.12).add(left))
    playSmokeThrow()
    rangeStore.set({ shots: range.shots + 1 })
    medicStore.setSmoke({ count: s.smoke.count - 1, replenishAt: performance.now() + 6000 })
  }

  useKeyBinding('smokeThrow', {
    contexts: ['roleHud'],
    onDown: (e) => {
      if (e.repeat) return
      throwSmoke()
    },
  })

  useFrame((state, dt) => {
    if (!root.current) return
    const s = medicStore.getState()
    const range = rangeStore.getState()
    const now = performance.now()

    root.current.position.copy(camera.position)
    root.current.quaternion.copy(camera.quaternion)
    root.current.visible = range.locked

    // 库存补充：抛掷后 6s 自动补满
    if (s.smoke.replenishAt > 0 && now >= s.smoke.replenishAt) {
      medicStore.setSmoke({ count: s.smoke.capacity, replenishAt: 0 })
      message('烟雾弹库存已补充 · SMOKE REFILLED')
    }

    // 手持烟幕弹微动
    if (grenade.current) {
      grenade.current.rotation.x = Math.sin(state.clock.elapsedTime * 2) * 0.04
      grenade.current.rotation.z = Math.cos(state.clock.elapsedTime * 1.6) * 0.04
    }
    void dt
  })

  return (
    <group ref={root} name="smoke-kit" visible={false}>
      <group ref={grenade} position={[-0.52, -0.52, -0.72]} rotation={[0.3, -0.2, 0.25]} scale={0.55}>
        {/* 手持小烟幕弹：圆柱体 + 绿色警示环 */}
        <mesh rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
          <cylinderGeometry args={[0.045, 0.045, 0.16, 14]} />
          <meshStandardMaterial color="#3f4648" metalness={0.6} roughness={0.45} />
        </mesh>
        <mesh position={[0, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
          <cylinderGeometry args={[0.047, 0.047, 0.035, 14]} />
          <meshBasicMaterial color="#4ade80" toneMapped={false} />
        </mesh>
        <mesh position={[0, -0.055, 0]} rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
          <cylinderGeometry args={[0.045, 0.036, 0.035, 10]} />
          <meshStandardMaterial color="#2b2f38" metalness={0.6} roughness={0.5} />
        </mesh>
      </group>
    </group>
  )
}
