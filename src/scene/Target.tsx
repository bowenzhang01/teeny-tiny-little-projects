import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { targetRegistry } from '../combat/targetRegistry'

function targetZone(zone: string, points: number) {
  return { kind: 'target', zone, points } as const
}

/**
 * 固定静止的人形标靶：
 * - 用基础几何体拼出头部 / 躯干 / 手臂 / 腿
 * - 正面有圆形靶心，命中按部位计分
 * - 被打中后向后倒下，约 2.4s 后自动立起来
 */
export function Target({ distance }: { distance: number }) {
  const root = useRef<THREE.Group>(null)

  useEffect(() => {
    if (!root.current) return
    const t = targetRegistry.get('T-01')
    if (t) t.object = root.current
    else {
      targetRegistry.register({
        id: 'T-01',
        name: '训练标靶',
        object: root.current,
        aimLocal: new THREE.Vector3(0, 1.2, 0.1),
        alive: true,
      })
    }
    return () => {
      targetRegistry.unregister('T-01')
    }
  }, [distance])

  return (
    <group ref={root} name="target" position={[0, 0, -distance]}>
      {/* 靶架：底座 + 立柱 + 背景板 */}
      <mesh position={[0, 0.06, -0.5]} castShadow userData={{ kind: 'solid' }}>
        <boxGeometry args={[1.6, 0.12, 0.4]} />
        <meshStandardMaterial color="#3a3f48" roughness={0.85} />
      </mesh>
      <mesh position={[0, 1.15, -0.5]} castShadow userData={{ kind: 'solid' }}>
        <boxGeometry args={[0.1, 2.2, 0.1]} />
        <meshStandardMaterial color="#555b66" roughness={0.75} metalness={0.4} />
      </mesh>
      <mesh position={[0, 1.42, -0.46]} castShadow userData={{ kind: 'solid' }}>
        <boxGeometry args={[1.5, 2.1, 0.08]} />
        <meshStandardMaterial color="#2b2f38" roughness={0.9} />
      </mesh>

      {/* 人形标靶（以脚底为轴心，倒下时向后倒） */}
      <group name="squad-target-human">
        {/* 腿部 */}
        <mesh position={[-0.14, 0.39, 0]} castShadow userData={targetZone('腿部', 2)}>
          <boxGeometry args={[0.17, 0.78, 0.15]} />
          <meshStandardMaterial color="#e9e5da" roughness={0.65} />
        </mesh>
        <mesh position={[0.14, 0.39, 0]} castShadow userData={targetZone('腿部', 2)}>
          <boxGeometry args={[0.17, 0.78, 0.15]} />
          <meshStandardMaterial color="#e9e5da" roughness={0.65} />
        </mesh>

        {/* 骨盆 + 躯干 */}
        <mesh position={[0, 0.86, 0]} castShadow userData={targetZone('躯干', 5)}>
          <boxGeometry args={[0.46, 0.2, 0.17]} />
          <meshStandardMaterial color="#e9e5da" roughness={0.65} />
        </mesh>
        <mesh position={[0, 1.2, 0]} castShadow userData={targetZone('躯干', 5)}>
          <boxGeometry args={[0.5, 0.62, 0.21]} />
          <meshStandardMaterial color="#e9e5da" roughness={0.65} />
        </mesh>

        {/* 手臂（微微张开） */}
        <mesh position={[-0.36, 1.17, 0]} rotation={[0, 0, 0.16]} castShadow userData={targetZone('手臂', 3)}>
          <boxGeometry args={[0.12, 0.62, 0.13]} />
          <meshStandardMaterial color="#e9e5da" roughness={0.65} />
        </mesh>
        <mesh position={[0.36, 1.17, 0]} rotation={[0, 0, -0.16]} castShadow userData={targetZone('手臂', 3)}>
          <boxGeometry args={[0.12, 0.62, 0.13]} />
          <meshStandardMaterial color="#e9e5da" roughness={0.65} />
        </mesh>

        {/* 脖子 + 头 */}
        <mesh position={[0, 1.56, 0]} castShadow userData={targetZone('头部', 10)}>
          <cylinderGeometry args={[0.05, 0.06, 0.14, 16]} />
          <meshStandardMaterial color="#e9e5da" roughness={0.65} />
        </mesh>
        <mesh position={[0, 1.72, 0]} castShadow userData={targetZone('头部', 10)}>
          <sphereGeometry args={[0.15, 24, 24]} />
          <meshStandardMaterial color="#e9e5da" roughness={0.65} />
        </mesh>

        {/* 胸口靶心（三环） */}
        <mesh position={[0, 1.2, 0.115]} userData={targetZone('靶心', 10)}>
          <ringGeometry args={[0.1, 0.19, 40]} />
          <meshBasicMaterial color="#e11d48" side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 1.2, 0.118]} userData={targetZone('靶心', 10)}>
          <ringGeometry args={[0.05, 0.095, 40]} />
          <meshBasicMaterial color="#f5f3ec" side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 1.2, 0.121]} userData={targetZone('靶心', 10)}>
          <circleGeometry args={[0.045, 32]} />
          <meshBasicMaterial color="#e11d48" side={THREE.DoubleSide} />
        </mesh>

        {/* 头部小圆点 */}
        <mesh position={[0, 1.72, 0.15]} userData={targetZone('头部', 10)}>
          <ringGeometry args={[0.05, 0.085, 32]} />
          <meshBasicMaterial color="#e11d48" side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  )
}
