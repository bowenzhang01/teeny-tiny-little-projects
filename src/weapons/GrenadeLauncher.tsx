import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { gunFx } from '../state/gunFx'
import { rangeStore, grenadeInHand } from '../state/rangeStore'
import { targetRegistry } from '../combat/targetRegistry'
import { spawnGrenade } from '../combat/Projectiles'
import { playShot } from '../audio/sfx'
import { useMouseBinding } from '../input/useMouseBinding'

/**
 * B 的主武器：手持榴弹机枪。
 * - 始终跟随相机（固定射击位，只转动视角）
 * - 左键发射榴弹（有重力抛物线 + 爆炸）
 * - 有自动锁定时弹道向锁定目标辅助
 */
export function GrenadeLauncher() {
  const { camera } = useThree()
  const follower = useRef<THREE.Group>(null!)
  const recoil = useRef<THREE.Group>(null!)
  const flash = useRef<THREE.Mesh>(null!)
  const muzzle = useRef<THREE.Object3D>(null!)
  const lastShotAt = useRef(0)
  const _dir = useRef(new THREE.Vector3())
  const _aim = useRef(new THREE.Vector3())

  useMouseBinding('fire', {
    onDown: () => {
      const s = rangeStore.getState()
      if (!s.locked) return
      if (!grenadeInHand(s)) return
      if (performance.now() < s.weaponBusyUntil) return

      const now = performance.now()
      if (now - lastShotAt.current < 230) return
      lastShotAt.current = now

      gunFx.trigger()
      playShot()

      const muzzlePos = new THREE.Vector3()
      if (muzzle.current) muzzle.current.getWorldPosition(muzzlePos)

      camera.getWorldDirection(_dir.current)
      const dir = _dir.current.clone()
      const lock = s.lockedTargetId
      const target = lock ? targetRegistry.get(lock) : null
      if (target && target.alive) {
        targetRegistry.aimWorld(target, _aim.current)
        dir.copy(_aim.current).sub(muzzlePos).normalize()
      }

      rangeStore.set({ shots: s.shots + 1 })
      spawnGrenade(muzzlePos, dir)
    },
  })

  useFrame((_, dt) => {
    if (!follower.current) return
    const s = rangeStore.getState()
    const hand = grenadeInHand(s)
    follower.current.position.copy(camera.position)
    follower.current.quaternion.copy(camera.quaternion)
    // 背挂武器展开时，榴弹机枪自动隐藏
    follower.current.visible = hand

    gunFx.recoil = THREE.MathUtils.damp(gunFx.recoil, 0, 9, dt)
    gunFx.flash = Math.max(0, gunFx.flash - dt * 11)

    if (recoil.current) {
      const holster = hand ? 0 : 1
      recoil.current.position.set(
        THREE.MathUtils.lerp(0.3, 0, holster),
        THREE.MathUtils.lerp(-0.26, -0.06, holster),
        THREE.MathUtils.lerp(-0.5, -0.62, holster),
      )
      recoil.current.rotation.set(
        THREE.MathUtils.lerp(0, 1.15, holster),
        THREE.MathUtils.lerp(0.03, 0, holster),
        THREE.MathUtils.lerp(-0.04, 0, holster),
      )
      recoil.current.position.z += gunFx.recoil * 0.1
      recoil.current.rotation.x += gunFx.recoil * 0.18
      const scale = 1 - holster * 0.55
      recoil.current.scale.setScalar(scale)
    }
    if (flash.current) {
      flash.current.visible = hand && gunFx.flash > 0.02
      const s2 = 0.6 + Math.random() * 0.4
      flash.current.scale.setScalar(s2)
    }
  })

  return (
    <group ref={follower} name="grenade-launcher">
      <group ref={recoil} position={[0.3, -0.26, -0.5]} rotation={[0, 0.03, -0.04]}>
        {/* 机匣 */}
        <mesh userData={{ kind: 'fx' }}>
          <boxGeometry args={[0.12, 0.13, 0.42]} />
          <meshStandardMaterial color="#39404c" metalness={0.8} roughness={0.35} />
        </mesh>

        {/* 粗枪管（榴弹口径） */}
        <mesh position={[0, 0.015, -0.28]} rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
          <cylinderGeometry args={[0.045, 0.05, 0.3, 18]} />
          <meshStandardMaterial color="#22262d" metalness={0.9} roughness={0.25} />
        </mesh>

        {/* 弹鼓（榴弹弹链鼓） */}
        <mesh position={[-0.04, -0.12, 0.02]} rotation={[0.35, 0, 0]} userData={{ kind: 'fx' }}>
          <cylinderGeometry args={[0.13, 0.13, 0.08, 24]} />
          <meshStandardMaterial color="#2c323d" metalness={0.6} roughness={0.5} />
        </mesh>

        {/* 握把 */}
        <mesh position={[0, -0.15, 0.1]} rotation={[0.42, 0, 0]} userData={{ kind: 'fx' }}>
          <boxGeometry args={[0.08, 0.2, 0.11]} />
          <meshStandardMaterial color="#2a2e36" metalness={0.4} roughness={0.6} />
        </mesh>

        {/* 扳机护圈 */}
        <mesh position={[0, -0.075, 0.01]} rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
          <torusGeometry args={[0.05, 0.009, 10, 28]} />
          <meshStandardMaterial color="#20242b" metalness={0.7} roughness={0.4} />
        </mesh>

        {/* 光学瞄准具（战术感） */}
        <mesh position={[0, 0.12, -0.04]} userData={{ kind: 'fx' }}>
          <boxGeometry args={[0.055, 0.05, 0.16]} />
          <meshStandardMaterial color="#12151b" metalness={0.7} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0.12, -0.04]} userData={{ kind: 'fx' }}>
          <boxGeometry args={[0.03, 0.03, 0.005]} />
          <meshBasicMaterial color="#67e8f9" toneMapped={false} />
        </mesh>

        {/* 枪口闪光 */}
        <mesh ref={flash} position={[0, 0.02, -0.44]} visible={false}>
          <octahedronGeometry args={[0.08, 0]} />
          <meshBasicMaterial color="#ffc46b" toneMapped={false} />
        </mesh>

        {/* 隐藏枪口参考点 */}
        <object3D ref={muzzle} position={[0, 0.02, -0.45]} />
      </group>
    </group>
  )
}
