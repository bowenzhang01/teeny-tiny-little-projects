import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { rangeStore } from '../state/rangeStore'
import { commsStore } from '../state/commsStore'
import { targetRegistry } from '../combat/targetRegistry'
import { spawnCommsRifleRound } from '../combat/Projectiles'
import { playDry, playLmgShot, playReload } from '../audio/sfx'
import { useKeyBinding } from '../input/useKeyBinding'
import { useInputReset } from '../input/useInputReset'
import { useMouseBinding } from '../input/useMouseBinding'

/**
 * E 通信兵主武器：AR-05 侦察突击步枪。
 * - 30 发弹匣，0.10s/发，R 换弹（约 1.1s）
 * - 紫色高速曳光，命中 +1 并推倒标靶
 * - 命中即打上“侦察标记”（E-MARK），自动锁定阈值放宽
 */
export function CommsRifle() {
  const { camera } = useThree()
  const follower = useRef<THREE.Group>(null!)
  const recoil = useRef<THREE.Group>(null!)
  const flash = useRef<THREE.Mesh>(null!)
  const muzzle = useRef<THREE.Object3D>(null!)
  const firing = useRef(false)
  const fireTimer = useRef(0)
  const _dir = useRef(new THREE.Vector3())
  const _aim = useRef(new THREE.Vector3())

  const startReload = () => {
    const s = commsStore.getState()
    if (s.rifle.reloading || s.rifle.mag >= s.rifle.magSize) return
    commsStore.setRifle({
      reloading: true,
      reloadUntil: performance.now() + s.rifle.reloadDuration,
      firing: false,
    })
    firing.current = false
    playReload()
  }

  const fireShot = () => {
    const s = commsStore.getState()
    const range = rangeStore.getState()
    if (s.rifle.reloading || s.rifle.mag <= 0) return
    if (s.drone.linkView) return
    if (!range.locked || performance.now() < range.weaponBusyUntil) return

    const muzzlePos = new THREE.Vector3()
    if (muzzle.current) muzzle.current.getWorldPosition(muzzlePos)

    camera.getWorldDirection(_dir.current)
    const dir = _dir.current.clone()
    const lock = range.lockedTargetId
    const target = lock ? targetRegistry.get(lock) : null
    if (target && target.alive) {
      targetRegistry.aimWorld(target, _aim.current)
      dir.copy(_aim.current).sub(muzzlePos).normalize()
    }

    // 侦察步枪：比 LMG 更聚拢的散布
    dir.x += (Math.random() - 0.5) * 0.007
    dir.y += (Math.random() - 0.5) * 0.007

    spawnCommsRifleRound(muzzlePos, dir)
    playLmgShot()

    if (recoil.current) {
      recoil.current.position.z = 0.05
      recoil.current.rotation.x = 0.08
    }
    rangeStore.set({ shots: range.shots + 1 })
    commsStore.setRifle({ mag: Math.max(0, s.rifle.mag - 1) })
    if (s.rifle.mag - 1 <= 0) startReload()
  }

  useKeyBinding('reload', {
    contexts: ['roleHud'],
    onDown: (e) => {
      if (e.repeat) return
      const s = commsStore.getState()
      if (s.drone.linkView) return
      if (s.rifle.mag < s.rifle.magSize) startReload()
      else playDry()
    },
  })

  useInputReset(() => {
    firing.current = false
    commsStore.setRifle({ firing: false })
  })

  useMouseBinding('fire', {
    contexts: ['roleHud'],
    onDown: () => {
      if (commsStore.getState().drone.linkView) return
      if (!rangeStore.getState().locked) return
      firing.current = true
      commsStore.setRifle({ firing: true })
    },
    onUp: () => {
      firing.current = false
      commsStore.setRifle({ firing: false })
    },
  })

  useEffect(() => {
    const onContextMenu = (e: Event) => {
      if (rangeStore.getState().locked) e.preventDefault()
    }
    window.addEventListener('contextmenu', onContextMenu)
    return () => {
      window.removeEventListener('contextmenu', onContextMenu)
      firing.current = false
    }
  }, [])

  useFrame((state, dt) => {
    if (!follower.current || !recoil.current) return
    const s = commsStore.getState()
    const range = rangeStore.getState()
    const linkView = s.drone.linkView

    follower.current.position.copy(camera.position)
    follower.current.quaternion.copy(camera.quaternion)
    follower.current.visible = range.locked && !linkView

    if (!range.locked || s.rifle.reloading || linkView) {
      firing.current = false
      if (s.rifle.firing) commsStore.setRifle({ firing: false })
    }

    if (firing.current && range.locked && !s.rifle.reloading && !linkView) {
      fireTimer.current += dt
      if (fireTimer.current >= 0.1) {
        fireTimer.current = 0
        fireShot()
      }
    } else {
      fireTimer.current = 0
    }

    if (s.rifle.reloading && performance.now() >= s.rifle.reloadUntil) {
      commsStore.setRifle({ reloading: false, mag: s.rifle.magSize })
    }

    recoil.current.position.z = THREE.MathUtils.damp(recoil.current.position.z, 0, 12, dt)
    recoil.current.rotation.x = THREE.MathUtils.damp(recoil.current.rotation.x, 0, 12, dt)
    if (flash.current) {
      const show = firing.current && range.locked && !linkView
      flash.current.visible = show
      if (show) flash.current.scale.setScalar(0.55 + Math.random() * 0.45)
    }

    void state
  })

  return (
    <group ref={follower} name="comms-rifle" visible={false}>
      <group ref={recoil} position={[0.3, -0.25, -0.5]} rotation={[0, 0.04, -0.02]} scale={1.04}>
        {/* 上机匣 */}
        <mesh userData={{ kind: 'fx' }}>
          <boxGeometry args={[0.11, 0.1, 0.46]} />
          <meshStandardMaterial color="#3b3f49" metalness={0.82} roughness={0.32} />
        </mesh>
        {/* 下机匣 */}
        <mesh position={[0, -0.07, 0.04]} userData={{ kind: 'fx' }}>
          <boxGeometry args={[0.09, 0.075, 0.3]} />
          <meshStandardMaterial color="#2c323d" metalness={0.7} roughness={0.42} />
        </mesh>
        {/* 顶部导轨 + 光学镜 */}
        <mesh position={[0, 0.065, -0.02]} userData={{ kind: 'fx' }}>
          <boxGeometry args={[0.06, 0.012, 0.42]} />
          <meshStandardMaterial color="#191d24" metalness={0.8} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.12, -0.04]} userData={{ kind: 'fx' }}>
          <boxGeometry args={[0.05, 0.06, 0.16]} />
          <meshStandardMaterial color="#151920" metalness={0.7} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0.12, -0.04]} userData={{ kind: 'fx' }}>
          <boxGeometry args={[0.032, 0.014, 0.005]} />
          <meshBasicMaterial color="#c084fc" toneMapped={false} />
        </mesh>
        {/* 枪管 + 紫色能量环 */}
        <mesh position={[0, 0.01, -0.32]} rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
          <cylinderGeometry args={[0.038, 0.044, 0.3, 14]} />
          <meshStandardMaterial color="#22262d" metalness={0.9} roughness={0.25} />
        </mesh>
        {[-0.2, -0.26, -0.32].map((z) => (
          <mesh key={z} position={[0, 0.01, z]} rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
            <torusGeometry args={[0.048, 0.007, 8, 14]} />
            <meshBasicMaterial color="#c084fc" toneMapped={false} />
          </mesh>
        ))}
        {/* 30 发直弹匣 */}
        <mesh position={[0, -0.16, -0.02]} rotation={[0.07, 0, 0]} userData={{ kind: 'fx' }}>
          <boxGeometry args={[0.07, 0.22, 0.1]} />
          <meshStandardMaterial color="#2b2f38" metalness={0.6} roughness={0.5} />
        </mesh>
        <mesh position={[0, -0.16, -0.02]} rotation={[0.07, 0, 0]} userData={{ kind: 'fx' }}>
          <boxGeometry args={[0.072, 0.05, 0.102]} />
          <meshBasicMaterial color="#a855f7" toneMapped={false} />
        </mesh>
        {/* 握把 / 枪托 */}
        <mesh position={[0, -0.14, 0.14]} rotation={[0.42, 0, 0]} userData={{ kind: 'fx' }}>
          <boxGeometry args={[0.065, 0.17, 0.09]} />
          <meshStandardMaterial color="#2a2e36" metalness={0.4} roughness={0.6} />
        </mesh>
        <mesh position={[-0.02, -0.01, 0.3]} rotation={[0.06, 0, 0]} userData={{ kind: 'fx' }}>
          <boxGeometry args={[0.055, 0.11, 0.14]} />
          <meshStandardMaterial color="#2c323d" metalness={0.6} roughness={0.5} />
        </mesh>
        {/* 侧面紫色识别条 */}
        <mesh position={[0.058, -0.01, 0.02]} userData={{ kind: 'fx' }}>
          <boxGeometry args={[0.004, 0.006, 0.3]} />
          <meshBasicMaterial color="#d8b4fe" toneMapped={false} />
        </mesh>
        {/* 前握把 */}
        <mesh position={[0.02, -0.12, -0.2]} rotation={[0.3, 0, -0.04]} userData={{ kind: 'fx' }}>
          <boxGeometry args={[0.06, 0.16, 0.08]} />
          <meshStandardMaterial color="#2a2e36" metalness={0.4} roughness={0.6} />
        </mesh>
        {/* 枪口制退器 + 闪光 */}
        <mesh position={[0, 0.01, -0.52]} rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
          <cylinderGeometry args={[0.052, 0.042, 0.09, 14]} />
          <meshStandardMaterial color="#191d24" metalness={0.9} roughness={0.22} />
        </mesh>
        <mesh ref={flash} position={[0, 0.01, -0.56]} visible={false}>
          <octahedronGeometry args={[0.065, 0]} />
          <meshBasicMaterial color="#d8b4fe" toneMapped={false} />
        </mesh>
        <object3D ref={muzzle} position={[0, 0.01, -0.57]} />
      </group>
    </group>
  )
}
