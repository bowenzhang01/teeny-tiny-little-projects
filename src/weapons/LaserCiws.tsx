import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { rangeStore } from '../state/rangeStore'
import { assaultStore } from '../state/assaultStore'
import { targetRegistry } from '../combat/targetRegistry'

/**
 * A 突击兵双肩激光反导系统（肩部自动追踪塔）。
 * - 与 B 蜂巢同位置：双肩各一座小转塔
 * - 锁定视野内最近目标时，射出红色激光标记线（追踪/标记）
 * - 被标记目标在 LockSystem 中享受更宽的锁定角度（激光辅助锁定）
 * - 预留：未来敌方导弹/飞行物接入时，这里作为硬拦截的执行点
 */
export function LaserCiws() {
  const { camera } = useThree()
  const root = useRef<THREE.Group>(null!)
  const leftBeam = useRef<THREE.Mesh>(null!)
  const rightBeam = useRef<THREE.Mesh>(null!)
  const leftPod = useRef<THREE.Group>(null!)
  const rightPod = useRef<THREE.Group>(null!)
  const lastTracking = useRef<string | null>(null)
  const _dir = useRef(new THREE.Vector3())
  const _right = useRef(new THREE.Vector3())
  const _up = useRef(new THREE.Vector3())
  const _end = useRef(new THREE.Vector3())

  const getShoulderOrigin = (side: 'left' | 'right', out: THREE.Vector3) => {
    camera.getWorldDirection(_dir.current)
    _right.current.setFromMatrixColumn(camera.matrixWorld, 0)
    _up.current.setFromMatrixColumn(camera.matrixWorld, 1)
    const sign = side === 'left' ? -1 : 1
    out
      .copy(camera.position)
      .addScaledVector(_right.current, sign * 0.95)
      .addScaledVector(_up.current, -0.18)
      .addScaledVector(_dir.current, 0.2)
    return out
  }

  const updateBeam = (mesh: THREE.Mesh | null, start: THREE.Vector3, end: THREE.Vector3) => {
    if (!mesh) return
    const dir = end.clone().sub(start)
    const len = Math.max(0.001, dir.length())
    const norm = dir.clone().normalize()
    mesh.visible = true
    mesh.position.copy(start).addScaledVector(norm, len / 2)
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), norm)
    mesh.scale.set(1, len, 1)
  }

  useFrame(() => {
    if (!root.current) return
    const range = rangeStore.getState()
    root.current.position.copy(camera.position)
    root.current.quaternion.copy(camera.quaternion)

    if (!range.locked) {
      if (leftBeam.current) leftBeam.current.visible = false
      if (rightBeam.current) rightBeam.current.visible = false
      if (lastTracking.current !== null) {
        lastTracking.current = null
        assaultStore.set({ ciws: { online: false, tracking: null } })
      }
      return
    }

    // 挑选视野内最近的目标进行激光标记
    let best: { id: string; dist: number } | null = null
    for (const t of targetRegistry.alive()) {
      const p = targetRegistry.aimWorld(t, _end.current)
      const d = p.distanceTo(camera.position)
      if (d < 40 && (!best || d < best.dist)) best = { id: t.id, dist: d }
    }

    const trackingId = best?.id ?? null
    if (trackingId !== lastTracking.current) {
      lastTracking.current = trackingId
      assaultStore.set({ ciws: { online: trackingId !== null, tracking: trackingId } })
    }

    if (!trackingId) {
      if (leftBeam.current) leftBeam.current.visible = false
      if (rightBeam.current) rightBeam.current.visible = false
      return
    }

    const target = targetRegistry.get(trackingId)
    if (!target) return
    targetRegistry.aimWorld(target, _end.current)

    const left = getShoulderOrigin('left', new THREE.Vector3())
    const right = getShoulderOrigin('right', new THREE.Vector3())
    updateBeam(leftBeam.current, left, _end.current)
    updateBeam(rightBeam.current, right, _end.current)

    // 转塔轻微指向目标（小模型跟随）
    if (leftPod.current) {
      leftPod.current.lookAt(_end.current)
    }
    if (rightPod.current) {
      rightPod.current.lookAt(_end.current)
    }
  })

  return (
    <>
      <group ref={root} name="laser-ciws">
        {/* 左右肩转塔 */}
        <group ref={leftPod} position={[-0.95, -0.18, -0.42]} rotation={[0.2, 0, 0]}>
          <mesh userData={{ kind: 'fx' }}>
            <boxGeometry args={[0.1, 0.09, 0.16]} />
            <meshStandardMaterial color="#2b2f38" metalness={0.7} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0, -0.09]}>
            <cylinderGeometry args={[0.03, 0.03, 0.06, 10]} />
            <meshBasicMaterial color="#ff5f5f" toneMapped={false} />
          </mesh>
        </group>
        <group ref={rightPod} position={[0.95, -0.18, -0.42]} rotation={[0.2, 0, 0]}>
          <mesh userData={{ kind: 'fx' }}>
            <boxGeometry args={[0.1, 0.09, 0.16]} />
            <meshStandardMaterial color="#2b2f38" metalness={0.7} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0, -0.09]}>
            <cylinderGeometry args={[0.03, 0.03, 0.06, 10]} />
            <meshBasicMaterial color="#ff5f5f" toneMapped={false} />
          </mesh>
        </group>
      </group>

      {/* 激光标记线（世界空间） */}
      <group name="laser-ciws-beams">
        <mesh ref={leftBeam} visible={false}>
          <cylinderGeometry args={[0.004, 0.004, 1, 6]} />
          <meshBasicMaterial
            color="#ff5f5f"
            transparent
            opacity={0.6}
            toneMapped={false}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
        <mesh ref={rightBeam} visible={false}>
          <cylinderGeometry args={[0.004, 0.004, 1, 6]} />
          <meshBasicMaterial
            color="#ff5f5f"
            transparent
            opacity={0.6}
            toneMapped={false}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </group>
    </>
  )
}
