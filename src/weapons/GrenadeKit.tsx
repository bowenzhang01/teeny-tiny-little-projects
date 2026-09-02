import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { rangeStore } from '../state/rangeStore'
import { assaultStore, useAssault } from '../state/assaultStore'
import type { GrenadeKind } from '../state/assaultStore'
import { droneStore } from '../state/droneStore'
import { spawnGrenade } from '../combat/Projectiles'
import { playDry, playThrow } from '../audio/sfx'

/**
 * A 突击兵手雷系统：
 * - G 投掷当前选中手雷
 * - T 循环切换（碎片 / 闪光 / 燃烧），有库存才可选
 * - 左下角持续显示当前手雷的小模型（随选中类型变色）
 */
export function GrenadeKit() {
  const { camera } = useThree()
  const root = useRef<THREE.Group>(null!)
  const body = useRef<THREE.Mesh>(null!)
  const a = useAssault()
  const slot = a.grenades[a.grenadeIndex]

  const throwGrenade = () => {
    const s = assaultStore.getState()
    const range = rangeStore.getState()
    if (!range.locked) return
    if (droneStore.getState().mode === 'remote') return
    const cur = s.grenades[s.grenadeIndex]
    if (cur.count <= 0) {
      playDry()
      rangeStore.set({ message: '手中雷耗尽 · 请切换类型', messageId: range.messageId + 1 })
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

    const type: GrenadeKind = cur.type
    spawnGrenade(origin, dir.clone().addScaledVector(up, 0.1), type)
    playThrow()
    rangeStore.set({ shots: range.shots + 1 })

    const grenades = s.grenades.map((g, i) => (i === s.grenadeIndex ? { ...g, count: g.count - 1 } : g))
    const remaining = grenades[s.grenadeIndex].count
    assaultStore.set({ grenades })
    if (remaining <= 0) {
      rangeStore.set({ message: '该手雷耗尽 · 自动切换', messageId: range.messageId + 1 })
      assaultStore.cycleGrenade()
    }
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.code === 'KeyG') throwGrenade()
      else if (e.code === 'KeyT') assaultStore.cycleGrenade()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useFrame(() => {
    if (!root.current) return
    root.current.position.copy(camera.position)
    root.current.quaternion.copy(camera.quaternion)
    root.current.visible = rangeStore.getState().locked && droneStore.getState().mode !== 'remote'
    if (body.current) {
      ;(body.current.material as THREE.MeshStandardMaterial).color.set(slot.color)
      const empty = slot.count <= 0
      body.current.visible = !empty
    }
  })

  return (
    <group ref={root} name="grenade-kit">
      {/* 持在右手的当前手雷 */}
      <group position={[0.48, -0.42, -0.62]} rotation={[0.3, 0.2, -0.2]}>
        <mesh ref={body}>
          <sphereGeometry args={[0.06, 14, 14]} />
          <meshStandardMaterial color="#ff8a5c" roughness={0.4} metalness={0.5} />
        </mesh>
        <mesh position={[0, 0.07, 0]}>
          <boxGeometry args={[0.03, 0.04, 0.03]} />
          <meshStandardMaterial color="#2a2e36" roughness={0.5} metalness={0.6} />
        </mesh>
        {/* 保险环发光点 */}
        <mesh position={[0, 0.09, 0]}>
          <sphereGeometry args={[0.012, 8, 8]} />
          <meshBasicMaterial color={slot.color} toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}
