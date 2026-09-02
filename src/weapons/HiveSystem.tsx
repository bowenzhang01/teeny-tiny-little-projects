import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { rangeStore } from '../state/rangeStore'
import { targetRegistry } from '../combat/targetRegistry'
import { spawnHiveMissile } from '../combat/Projectiles'

interface VolleyEntry {
  delay: number
  side: 'left' | 'right'
  seed: number
}

/**
 * 蜂巢导弹系统：
 * - 右键长按 = 轮射（左右肩交替逐发）
 * - 右键双击 = 齐射（两肩各 10 发，共 20）
 * - 弹药无上限（冷却结束自动补充 60/60），但有独立冷却
 * - 导弹自动锁定当前 lockedTarget，无锁定时飞向准星前方 20m
 * - 使用时画面下方两侧可见"肩部火焰"
 */
export function HiveSystem() {
  const { camera } = useThree()
  const holding = useRef(false)
  const lastDownAt = useRef(0)
  const fireTimer = useRef(0)
  const alternate = useRef<'left' | 'right'>('left')
  const streamFired = useRef(false)
  const volleyQueue = useRef<VolleyEntry[]>([])
  const volleyActive = useRef(false)
  const flameGroup = useRef<THREE.Group>(null!)
  const _dir = useRef(new THREE.Vector3())
  const _right = useRef(new THREE.Vector3())
  const _up = useRef(new THREE.Vector3())
  const _point = useRef(new THREE.Vector3())

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 2) return
      if (!rangeStore.getState().locked) return
      e.preventDefault()
      const now = performance.now()
      if (now - lastDownAt.current < 280) {
        // 双击 -> 齐射
        lastDownAt.current = 0
        holding.current = false
        fireVolley()
      } else {
        lastDownAt.current = now
        holding.current = true
        fireTimer.current = 0
        streamFired.current = false
      }
    }

    const onMouseUp = (e: MouseEvent) => {
      if (e.button !== 2) return
      if (!holding.current) return
      holding.current = false
      if (streamFired.current) {
        startCooldown(rangeStore.getState().hive.streamCooldown)
        streamFired.current = false
      }
    }

    const onContextMenu = (e: Event) => {
      if (rangeStore.getState().locked) e.preventDefault()
    }

    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('contextmenu', onContextMenu)
    return () => {
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('contextmenu', onContextMenu)
    }
  }, [])

  const getSideOrigin = (side: 'left' | 'right', out: THREE.Vector3) => {
    const dir = camera.getWorldDirection(_dir.current)
    _right.current.setFromMatrixColumn(camera.matrixWorld, 0)
    _up.current.setFromMatrixColumn(camera.matrixWorld, 1)
    const sideSign = side === 'left' ? -1 : 1
    out
      .copy(camera.position)
      .addScaledVector(_right.current, sideSign * 0.95)
      .addScaledVector(_up.current, -0.28)
      .addScaledVector(dir, 0.25)
    return out
  }

  const getAimPoint = (out: THREE.Vector3) => {
    const lock = rangeStore.getState().lockedTargetId
    const target = lock ? targetRegistry.get(lock) : null
    if (target && target.alive) {
      targetRegistry.aimWorld(target, out)
    } else {
      const dir = camera.getWorldDirection(_dir.current)
      out.copy(camera.position).addScaledVector(dir, 20)
    }
    return out
  }

  function startCooldown(ms: number) {
    const prev = rangeStore.getState()
    rangeStore.set({
      hive: { ...prev.hive, cooldownUntil: performance.now() + ms },
    })
  }

  function fireVolley() {
    const state = rangeStore.getState()
    const now = performance.now()
    if (state.hive.cooldownUntil > now) {
      rangeStore.set({ message: '蜂巢冷却中', messageId: state.messageId + 1 })
      return
    }
    const perSide = 10
    const ammo = Math.min(perSide, state.hive.left, state.hive.right)
    if (ammo <= 0) return

    const queue: VolleyEntry[] = []
    for (let i = 0; i < ammo; i++) {
      queue.push({ delay: i * 0.035, side: 'left', seed: Math.random() * 1000 })
      queue.push({ delay: i * 0.035 + 0.015, side: 'right', seed: Math.random() * 1000 })
    }
    volleyQueue.current.push(...queue)
    volleyActive.current = true

    rangeStore.set({
      hive: { ...state.hive, left: state.hive.left - ammo, right: state.hive.right - ammo },
      shots: state.shots + ammo * 2,
      message: `蜂巢齐射 ×${ammo * 2}`,
      messageId: state.messageId + 1,
    })
    startCooldown(state.hive.volleyCooldown)
  }

  function fireSingle() {
    const state = rangeStore.getState()
    const now = performance.now()
    if (state.hive.cooldownUntil > now) return

    const side = alternate.current
    const cur = side === 'left' ? state.hive.left : state.hive.right
    if (cur <= 0) {
      // 一肩打空：直接转冷却自动补充（无限弹药设定）
      startCooldown(state.hive.volleyCooldown)
      return
    }
    alternate.current = side === 'left' ? 'right' : 'left'

    const origin = getSideOrigin(side, new THREE.Vector3())
    const aim = getAimPoint(_point.current)
    spawnHiveMissile({
      origin,
      targetId: state.lockedTargetId,
      fallbackPoint: aim.clone(),
      seed: Math.random() * 1000,
      side,
    })

    rangeStore.set({
      hive: {
        ...state.hive,
        [side]: state.hive[side] - 1,
      },
      shots: state.shots + 1,
    })
    streamFired.current = true
  }

  useFrame((_, dt) => {
    // 处理齐射队列
    if (volleyQueue.current.length > 0) {
      const state = rangeStore.getState()
      const remaining: VolleyEntry[] = []
      for (const entry of volleyQueue.current) {
        entry.delay -= dt
        if (entry.delay <= 0) {
          const origin = getSideOrigin(entry.side, new THREE.Vector3())
          const aim = getAimPoint(_point.current)
          spawnHiveMissile({
            origin,
            targetId: state.lockedTargetId,
            fallbackPoint: aim.clone(),
            seed: entry.seed,
            side: entry.side,
          })
        } else {
          remaining.push(entry)
        }
      }
      volleyQueue.current = remaining
      if (remaining.length === 0) volleyActive.current = false
    } else {
      volleyActive.current = false
    }

    // 长按轮射
    if (holding.current) {
      fireTimer.current += dt
      if (fireTimer.current >= 0.16) {
        fireTimer.current = 0
        fireSingle()
      }
    }

    // 冷却结束自动补充弹药（无限弹药设定）
    const s = rangeStore.getState()
    const now = performance.now()
    if (now > s.hive.cooldownUntil && (s.hive.left < s.hive.capacity || s.hive.right < s.hive.capacity)) {
      rangeStore.set({
        hive: { ...s.hive, left: s.hive.capacity, right: s.hive.capacity },
      })
    }

    // 肩部火焰：只在发射期间可见
    const g = flameGroup.current
    if (!g) return
    const firing = holding.current || volleyActive.current
    g.visible = firing
    if (firing) {
      g.position.copy(camera.position)
      g.quaternion.copy(camera.quaternion)
      const flick = 0.8 + Math.random() * 0.5
      const leftFlame = g.children[0] as THREE.Mesh
      const rightFlame = g.children[1] as THREE.Mesh
      leftFlame.scale.setScalar(flick)
      rightFlame.scale.setScalar(flick)
      ;(leftFlame.material as THREE.MeshBasicMaterial).opacity = 0.7 + Math.random() * 0.3
      ;(rightFlame.material as THREE.MeshBasicMaterial).opacity = 0.7 + Math.random() * 0.3
    }
  })

  return (
    <group ref={flameGroup} visible={false}>
      <mesh position={[-0.95, -0.28, -0.45]} rotation={[Math.PI / 2.6, 0, -0.5]}>
        <coneGeometry args={[0.09, 0.42, 10]} />
        <meshBasicMaterial color="#ffc46b" transparent opacity={0.85} toneMapped={false} depthWrite={false} />
      </mesh>
      <mesh position={[0.95, -0.28, -0.45]} rotation={[Math.PI / 2.6, 0, 0.5]}>
        <coneGeometry args={[0.09, 0.42, 10]} />
        <meshBasicMaterial color="#ff8c42" transparent opacity={0.85} toneMapped={false} depthWrite={false} />
      </mesh>
    </group>
  )
}
