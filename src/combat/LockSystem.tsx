import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { rangeStore } from '../state/rangeStore'
import { targetRegistry } from './targetRegistry'

/**
 * 自动锁定系统（第一批）：
 * - 准星靠近目标（约 5°）即锁定，离开后保留 0.9s 的"记忆锁定"。
 * - 锁定结果写入 rangeStore.lockedTargetId，四套武器共享。
 * - 同时把 camera 注册给 targetRegistry，供 HUD 投影敌标用。
 */
export function LockSystem() {
  const { camera } = useThree()
  const lastLockAt = useRef(0)
  const lastLockedId = useRef<string | null>(null)
  const _dir = useRef(new THREE.Vector3())
  const _to = useRef(new THREE.Vector3())
  const _aim = useRef(new THREE.Vector3())

  useEffect(() => {
    targetRegistry.setCamera(camera)
    return () => targetRegistry.setCamera(null)
  }, [camera])

  useFrame(() => {
    const dir = camera.getWorldDirection(_dir.current)
    let best: { id: string; angle: number; dist: number } | null = null

    for (const t of targetRegistry.alive()) {
      targetRegistry.aimWorld(t, _aim.current)
      const to = _to.current.copy(_aim.current).sub(camera.position)
      const dist = to.length()
      if (dist <= 0.001) continue
      const angle = to.normalize().angleTo(dir)
      if (!best || angle < best.angle) best = { id: t.id, angle, dist }
    }

    const now = performance.now()
    const current = rangeStore.getState()
    let next: string | null = null

    if (best && best.angle < 0.09 && best.dist < 40) {
      next = best.id
      lastLockedId.current = best.id
      lastLockAt.current = now
    } else if (
      lastLockedId.current &&
      now - lastLockAt.current < 900 &&
      best &&
      best.angle < 0.45
    ) {
      next = lastLockedId.current
    }

    if (next !== current.lockedTargetId) {
      rangeStore.set({ lockedTargetId: next })
    } else {
      lastLockedId.current = next
    }
  })

  return null
}

/** 3D 世界中显示在锁定目标上的括架/光环 */
export function LockMarker() {
  const marker = useRef<THREE.Group>(null!)
  const _pos = useRef(new THREE.Vector3())

  useFrame(({ clock }) => {
    const lock = rangeStore.getState().lockedTargetId
    const t = lock ? targetRegistry.get(lock) : null
    if (!marker.current) return
    if (!t) {
      marker.current.visible = false
      return
    }
    targetRegistry.aimWorld(t, _pos.current)
    marker.current.visible = true
    marker.current.position.copy(_pos.current)
    const pulse = 1 + Math.sin(clock.elapsedTime * 6) * 0.05
    marker.current.scale.setScalar(pulse)
  })

  return (
    <group ref={marker} visible={false}>
      {/* 四角锁定框（环绕准心所指目标） */}
      {[-0.42, 0.42].map((x) =>
        [-0.62, 0.62].map((y) => (
          <mesh key={`${x}-${y}`} position={[x, y, 0]}>
            <boxGeometry args={[0.16, 0.05, 0.03]} />
            <meshBasicMaterial color="#67e8f9" toneMapped={false} />
          </mesh>
        )),
      )}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.34, 0.38, 40]} />
        <meshBasicMaterial color="#67e8f9" transparent opacity={0.55} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <pointLight color="#67e8f9" intensity={1.4} distance={3} />
    </group>
  )
}
