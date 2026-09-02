import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { gunFx } from '../state/gunFx'

/**
 * 第一人称手枪：
 * - 始终跟随相机（射手位置固定，只转动视角）
 * - 挂在画面右下角，朝屏幕中心方向
 * - 开枪时后坐 + 枪口闪光（由 gunFx 驱动，帧内衰减）
 */
export function Gun() {
  const follower = useRef<THREE.Group>(null)
  const recoilGroup = useRef<THREE.Group>(null)
  const flash = useRef<THREE.Mesh>(null)

  useFrame((state, dt) => {
    if (!follower.current) return

    // 跟随相机：位置 + 朝向
    follower.current.position.copy(state.camera.position)
    follower.current.quaternion.copy(state.camera.quaternion)

    // 特效衰减
    gunFx.recoil = THREE.MathUtils.damp(gunFx.recoil, 0, 9, dt)
    gunFx.flash = Math.max(0, gunFx.flash - dt * 11)

    if (recoilGroup.current) {
      recoilGroup.current.position.z = -0.5 + gunFx.recoil * 0.09
      recoilGroup.current.rotation.x = gunFx.recoil * 0.16
    }
    if (flash.current) {
      flash.current.visible = gunFx.flash > 0.02
      const s = 0.55 + Math.random() * 0.35
      flash.current.scale.setScalar(s)
    }
  })

  return (
    <group ref={follower} name="gun">
      <group ref={recoilGroup} position={[0.26, -0.24, -0.5]} rotation={[0, 0.02, -0.03]}>
        {/* 套筒 / 枪身 */}
        <mesh userData={{ kind: 'fx' }}>
          <boxGeometry args={[0.075, 0.085, 0.3]} />
          <meshStandardMaterial color="#3c414b" metalness={0.85} roughness={0.32} />
        </mesh>

        {/* 枪管 */}
        <mesh position={[0, 0.025, -0.1]} rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
          <cylinderGeometry args={[0.022, 0.022, 0.22, 20]} />
          <meshStandardMaterial color="#23262d" metalness={0.9} roughness={0.25} />
        </mesh>

        {/* 握把 */}
        <mesh position={[0, -0.1, 0.06]} rotation={[0.38, 0, 0]} userData={{ kind: 'fx' }}>
          <boxGeometry args={[0.065, 0.17, 0.095]} />
          <meshStandardMaterial color="#2a2e36" metalness={0.4} roughness={0.6} />
        </mesh>

        {/* 扳机护圈（细环） */}
        <mesh position={[0, -0.045, -0.02]} rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
          <torusGeometry args={[0.045, 0.008, 10, 28]} />
          <meshStandardMaterial color="#20242b" metalness={0.7} roughness={0.4} />
        </mesh>

        {/* 准星 */}
        <mesh position={[0, 0.065, -0.13]} userData={{ kind: 'fx' }}>
          <boxGeometry args={[0.008, 0.02, 0.008]} />
          <meshStandardMaterial color="#8b93a3" metalness={0.6} roughness={0.4} />
        </mesh>

        {/* 枪口闪光 */}
        <mesh ref={flash} position={[0, 0.02, -0.22]} visible={false}>
          <octahedronGeometry args={[0.055, 0]} />
          <meshBasicMaterial color="#ffc46b" toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}
