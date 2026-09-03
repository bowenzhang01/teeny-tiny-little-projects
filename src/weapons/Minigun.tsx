import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { rangeStore } from '../state/rangeStore'
import { targetRegistry } from '../combat/targetRegistry'
import { spawnBullet } from '../combat/Projectiles'
import { playMinigunShot, playMinigunSpin } from '../audio/sfx'
import { useInputReset } from '../input/useInputReset'
import { useMouseBinding } from '../input/useMouseBinding'

/**
 * 六管机枪（背部右侧）：
 * - 平时在背上不可见；3 键展开到身体右侧
 * - 展开后左键按住：先 spin-up 预热，随后持续射击
 * - 与轨道炮可同时展开；展开后榴弹机枪自动隐藏
 */
export function Minigun() {
  const { camera } = useThree()
  const follower = useRef<THREE.Group>(null!)
  const root = useRef<THREE.Group>(null!)
  const barrels = useRef<THREE.Group>(null!)
  const flash = useRef<THREE.Mesh>(null!)
  const muzzle = useRef<THREE.Object3D>(null!)
  const deployK = useRef(0)
  const spinning = useRef(false)
  const firing = useRef(false)
  const spinStart = useRef(0)
  const fireTimer = useRef(0)
  const _dir = useRef(new THREE.Vector3())
  const _aim = useRef(new THREE.Vector3())

  // P0：失焦 / 锁丢失 / 换人时停止 spin-up 与射击
  useInputReset(() => {
    spinning.current = false
    firing.current = false
    rangeStore.set({ minigunSpinning: false, minigunFiring: false })
  })

  // P1：统一鼠标分发（左键按住 = spin-up + 持续射击）
  useMouseBinding('fire', {
    onDown: () => {
      const s = rangeStore.getState()
      if (!s.locked || !s.minigunDeployed) return
      if (performance.now() < s.weaponBusyUntil) return
      spinning.current = true
      firing.current = false
      spinStart.current = performance.now()
      fireTimer.current = 0
      rangeStore.set({ minigunSpinning: true, minigunFiring: false })
      playMinigunSpin()
    },
    onUp: () => {
      spinning.current = false
      firing.current = false
      rangeStore.set({ minigunSpinning: false, minigunFiring: false })
    },
  })

  const fireBullet = () => {
    const s = rangeStore.getState()
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
    // 轻微散布，模拟持续射击
    dir.x += (Math.random() - 0.5) * 0.012
    dir.y += (Math.random() - 0.5) * 0.012
    spawnBullet(muzzlePos, dir)
    playMinigunShot()
    rangeStore.set({ shots: s.shots + 1 })
  }

  useFrame((state, dt) => {
    if (!follower.current || !root.current) return
    const s = rangeStore.getState()
    if (!s.minigunDeployed) {
      spinning.current = false
      firing.current = false
    }
    const target = s.minigunDeployed ? 1 : 0
    deployK.current = THREE.MathUtils.damp(deployK.current, target, 6, dt)
    const k = deployK.current

    follower.current.position.copy(camera.position)
    follower.current.quaternion.copy(camera.quaternion)

    root.current.visible = k > 0.02
    const x = THREE.MathUtils.lerp(1.7, 0.42, k)
    const y = THREE.MathUtils.lerp(-1.0, -0.26, k)
    const z = THREE.MathUtils.lerp(0.35, -0.62, k)
    root.current.position.set(x, y, z)

    // 预热计时
    if (spinning.current && !firing.current && s.minigunDeployed) {
      if (performance.now() - spinStart.current > 450) {
        firing.current = true
        rangeStore.set({ minigunSpinning: true, minigunFiring: true })
      }
    }

    // 持续射击
    if (firing.current && s.minigunDeployed && s.locked) {
      fireTimer.current += dt
      if (fireTimer.current >= 0.05) {
        fireTimer.current = 0
        fireBullet()
      }
    }

    // 枪管旋转
    if (barrels.current && (spinning.current || firing.current)) {
      barrels.current.rotation.z += dt * (firing.current ? 34 : 18)
    }

    // 枪口闪光
    if (flash.current) {
      flash.current.visible = firing.current
      if (firing.current) {
        flash.current.scale.setScalar(0.7 + Math.random() * 0.5)
      }
    }

    void state
  })

  return (
    <group ref={follower} name="minigun">
      <group ref={root} visible={false} position={[1.7, -1.0, 0.35]}>
        {/* 机匣主体 */}
        <mesh userData={{ kind: 'fx' }}>
          <boxGeometry args={[0.16, 0.18, 0.72]} />
          <meshStandardMaterial color="#39404c" metalness={0.82} roughness={0.32} />
        </mesh>
        {/* 弹链鼓 */}
        <mesh position={[0, -0.16, -0.02]} rotation={[0.3, 0, 0]} userData={{ kind: 'fx' }}>
          <cylinderGeometry args={[0.14, 0.14, 0.13, 22]} />
          <meshStandardMaterial color="#2c323d" metalness={0.6} roughness={0.5} />
        </mesh>
        {/* 六根枪管 */}
        <group ref={barrels} position={[0, 0.03, -0.42]}>
          {Array.from({ length: 6 }, (_, i) => {
            const a = (i / 6) * Math.PI * 2
            return (
              <mesh
                key={i}
                position={[Math.cos(a) * 0.055, Math.sin(a) * 0.055, 0]}
                rotation={[Math.PI / 2, 0, 0]}
                userData={{ kind: 'fx' }}
              >
                <cylinderGeometry args={[0.024, 0.024, 0.72, 10]} />
                <meshStandardMaterial color="#23262d" metalness={0.9} roughness={0.25} />
              </mesh>
            )
          })}
        </group>
        {/* 枪口旋转盘 */}
        <mesh position={[0, 0.03, -0.44]} rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
          <cylinderGeometry args={[0.12, 0.12, 0.05, 22]} />
          <meshStandardMaterial color="#2a2e36" metalness={0.8} roughness={0.35} />
        </mesh>
        {/* 握把 */}
        <mesh position={[0, -0.17, 0.14]} rotation={[0.42, 0, 0]} userData={{ kind: 'fx' }}>
          <boxGeometry args={[0.08, 0.2, 0.1]} />
          <meshStandardMaterial color="#2a2e36" metalness={0.4} roughness={0.6} />
        </mesh>
        {/* 枪口闪光 */}
        <mesh ref={flash} position={[0, 0.03, -0.82]} visible={false}>
          <octahedronGeometry args={[0.09, 0]} />
          <meshBasicMaterial color="#ffc46b" toneMapped={false} />
        </mesh>
        <object3D ref={muzzle} position={[0, 0.03, -0.8]} />
      </group>
    </group>
  )
}
