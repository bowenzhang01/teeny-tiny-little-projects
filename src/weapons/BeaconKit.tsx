import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { rangeStore } from '../state/rangeStore'
import { commsStore } from '../state/commsStore'
import { spawnReconBeacon } from '../combat/Projectiles'
import { playDry, playSmokeThrow } from '../audio/sfx'
import { useKeyBinding } from '../input/useKeyBinding'

/**
 * E 通信兵侦察部署物：TRI-05 三角定位信标。
 * - G 向左前方抛射（复用榴弹运动模型），落地展开为紫色全息信标
 * - 库存 3 颗，放置后约 6s 自动补满
 * - 信标落地会标记最近目标（TRI MARK），自动锁定阈值放宽
 */
export function BeaconKit() {
  const { camera } = useThree()
  const root = useRef<THREE.Group>(null!)
  const beacon = useRef<THREE.Group>(null!)

  const message = (text: string) => {
    const s = rangeStore.getState()
    rangeStore.set({ message: text, messageId: s.messageId + 1 })
  }

  const throwBeacon = () => {
    const s = commsStore.getState()
    const range = rangeStore.getState()
    if (s.drone.linkView) return
    if (!range.locked || performance.now() < range.weaponBusyUntil) return
    if (s.beacon.count <= 0) {
      playDry()
      message('信标耗尽 · 待补充')
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
    spawnReconBeacon(origin, dir.clone().addScaledVector(up, 0.12).add(left))
    playSmokeThrow()
    rangeStore.set({ shots: range.shots + 1 })
    commsStore.setBeacon({ count: s.beacon.count - 1, replenishAt: performance.now() + 6000 })
  }

  useKeyBinding('beaconThrow', {
    contexts: ['roleHud'],
    onDown: (e) => {
      if (e.repeat) return
      throwBeacon()
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
    if (s.beacon.replenishAt > 0 && now >= s.beacon.replenishAt) {
      commsStore.setBeacon({ count: s.beacon.capacity, replenishAt: 0 })
      message('信标库存已补充 · TRI REFILLED')
    }

    if (beacon.current) {
      beacon.current.rotation.x = Math.sin(state.clock.elapsedTime * 2.2) * 0.04
      beacon.current.rotation.z = Math.cos(state.clock.elapsedTime * 1.7) * 0.04
    }
    void dt
  })

  return (
    <group ref={root} name="beacon-kit" visible={false}>
      <group ref={beacon} position={[-0.52, -0.52, -0.72]} rotation={[0.3, -0.2, 0.25]} scale={0.5}>
        {/* 手持小信标：圆柱体 + 紫色警示环 + 顶部发光钉 */}
        <mesh rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
          <cylinderGeometry args={[0.04, 0.04, 0.14, 12]} />
          <meshStandardMaterial color="#3f4648" metalness={0.6} roughness={0.45} />
        </mesh>
        <mesh position={[0, 0.045, 0]} rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
          <cylinderGeometry args={[0.043, 0.043, 0.03, 12]} />
          <meshBasicMaterial color="#c084fc" toneMapped={false} />
        </mesh>
        <mesh position={[0, -0.05, 0]} rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
          <cylinderGeometry args={[0.038, 0.03, 0.035, 10]} />
          <meshStandardMaterial color="#2b2f38" metalness={0.6} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.08, 0]} userData={{ kind: 'fx' }}>
          <sphereGeometry args={[0.012, 8, 8]} />
          <meshBasicMaterial color="#d8b4fe" toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}
