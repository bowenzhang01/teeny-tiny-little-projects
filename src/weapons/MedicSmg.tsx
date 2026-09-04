import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { rangeStore } from '../state/rangeStore'
import { medicStore } from '../state/medicStore'
import { targetRegistry } from '../combat/targetRegistry'
import { spawnMedicSmgRound } from '../combat/Projectiles'
import { playDry, playSmgShot, playReload } from '../audio/sfx'
import { useKeyBinding } from '../input/useKeyBinding'
import { useInputReset } from '../input/useInputReset'
import { useMouseBinding } from '../input/useMouseBinding'

/**
 * D 医疗兵主武器：轻型冲锋枪（SMG）。
 * - 左键按住连射，射速约 0.08s/发，弹匣 40 发，R 换弹（约 1.2s）
 * - 绿色高速曳光 + 小型绿色爆点，命中推倒标靶 +1
 * - ENHANCE 支援模式生效时：散布更低、后坐更小、换弹更快
 */
export function MedicSmg() {
  const { camera } = useThree()
  const follower = useRef<THREE.Group>(null!)
  const recoil = useRef<THREE.Group>(null!)
  const flash = useRef<THREE.Mesh>(null!)
  const muzzle = useRef<THREE.Object3D>(null!)
  const firing = useRef(false)
  const fireTimer = useRef(0)
  const _dir = useRef(new THREE.Vector3())
  const _aim = useRef(new THREE.Vector3())

  const enhanceActive = () => {
    const d = medicStore.getState().drones
    return d.mode !== 'stowed' && d.support === 'enhance'
  }

  const startReload = () => {
    const s = medicStore.getState()
    if (s.weapon !== 'smg' || s.smg.reloading || s.smg.mag >= s.smg.magSize) return
    const duration = enhanceActive() ? 800 : 1200
    medicStore.setSmg({
      reloading: true,
      reloadUntil: performance.now() + duration,
      reloadDuration: duration,
      firing: false,
    })
    firing.current = false
    playReload()
  }

  const fireShot = () => {
    const s = medicStore.getState()
    const range = rangeStore.getState()
    if (s.weapon !== 'smg' || s.smg.reloading || s.smg.mag <= 0) return
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

    // ENHANCE：散布更低
    const spread = enhanceActive() ? 0.005 : 0.009
    dir.x += (Math.random() - 0.5) * spread
    dir.y += (Math.random() - 0.5) * spread

    spawnMedicSmgRound(muzzlePos, dir)
    playSmgShot()

    if (recoil.current) {
      recoil.current.position.z = enhanceActive() ? 0.032 : 0.052
      recoil.current.rotation.x = enhanceActive() ? 0.055 : 0.085
    }
    rangeStore.set({ shots: range.shots + 1 })
    medicStore.setSmg({ mag: s.smg.mag - 1 })
    if (s.smg.mag - 1 <= 0) startReload()
  }

  // 1 = 切回 SMG
  useKeyBinding('medicWeaponSmg', {
    contexts: ['roleHud'],
    onDown: (e) => {
      if (e.repeat) return
      firing.current = false
      medicStore.set({ weapon: 'smg' })
    },
  })

  // R = 当前武器换弹（SMG 时由这里处理，针枪时由 DartGun 处理）
  useKeyBinding('reload', {
    contexts: ['roleHud'],
    onDown: (e) => {
      if (e.repeat) return
      if (medicStore.getState().weapon !== 'smg') return
      if (medicStore.getState().smg.mag < medicStore.getState().smg.magSize) startReload()
      else playDry()
    },
  })

  useMouseBinding('fire', {
    contexts: ['roleHud'],
    onDown: () => {
      if (medicStore.getState().weapon !== 'smg') return
      if (!rangeStore.getState().locked) return
      firing.current = true
      medicStore.setSmg({ firing: true })
    },
    onUp: () => {
      firing.current = false
      medicStore.setSmg({ firing: false })
    },
  })

  useInputReset(() => {
    firing.current = false
    medicStore.setSmg({ firing: false })
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
    const s = medicStore.getState()
    const range = rangeStore.getState()
    const smgSelected = s.weapon === 'smg'

    follower.current.position.copy(camera.position)
    follower.current.quaternion.copy(camera.quaternion)
    follower.current.visible = range.locked && smgSelected

    if (!range.locked || !smgSelected || s.smg.reloading) {
      firing.current = false
      if (s.smg.firing) medicStore.setSmg({ firing: false })
    }

    // 打空自动换弹
    if (firing.current && range.locked && s.smg.mag <= 0 && !s.smg.reloading) {
      startReload()
    }

    // 持续射击
    if (firing.current && range.locked && smgSelected && !s.smg.reloading) {
      fireTimer.current += dt
      if (fireTimer.current >= 0.08) {
        fireTimer.current = 0
        fireShot()
      }
    } else {
      fireTimer.current = 0
    }

    // 换弹完成
    if (s.smg.reloading && performance.now() >= s.smg.reloadUntil) {
      medicStore.setSmg({ reloading: false, mag: s.smg.magSize })
    }

    // 后坐力/枪口闪光衰减
    recoil.current.position.z = THREE.MathUtils.damp(recoil.current.position.z, 0, 12, dt)
    recoil.current.rotation.x = THREE.MathUtils.damp(recoil.current.rotation.x, 0, 12, dt)
    if (flash.current) {
      const show = firing.current && range.locked && smgSelected
      flash.current.visible = show
      if (show) flash.current.scale.setScalar(0.55 + Math.random() * 0.45)
    }

    void state
  })

  return (
    <group ref={follower} name="medic-smg" visible={false}>
      <group ref={recoil} position={[0.3, -0.26, -0.5]} rotation={[0.02, 0.06, -0.02]} scale={1.05}>
        {/* 紧凑枪身 */}
        <mesh userData={{ kind: 'fx' }}>
          <boxGeometry args={[0.1, 0.095, 0.4]} />
          <meshStandardMaterial color="#3b3f49" metalness={0.82} roughness={0.32} />
        </mesh>
        {/* 上导轨 */}
        <mesh position={[0, 0.06, -0.02]} userData={{ kind: 'fx' }}>
          <boxGeometry args={[0.06, 0.014, 0.34]} />
          <meshStandardMaterial color="#191d24" metalness={0.8} roughness={0.3} />
        </mesh>
        {/* 短枪管 + 绿色能量环 */}
        <mesh position={[0, 0.01, -0.28]} rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
          <cylinderGeometry args={[0.04, 0.045, 0.24, 12]} />
          <meshStandardMaterial color="#22262d" metalness={0.9} roughness={0.25} />
        </mesh>
        {[-0.24, -0.3].map((z) => (
          <mesh key={z} position={[0, 0.01, z]} rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
            <torusGeometry args={[0.045, 0.007, 8, 14]} />
            <meshBasicMaterial color="#4ade80" toneMapped={false} />
          </mesh>
        ))}
        {/* 枪口 */}
        <mesh position={[0, 0.01, -0.4]} rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
          <cylinderGeometry args={[0.052, 0.044, 0.07, 12]} />
          <meshStandardMaterial color="#191d24" metalness={0.9} roughness={0.22} />
        </mesh>
        <mesh ref={flash} position={[0, 0.01, -0.44]} visible={false}>
          <octahedronGeometry args={[0.055, 0]} />
          <meshBasicMaterial color="#86efac" toneMapped={false} />
        </mesh>

        {/* 下挂式握把 + 弹匣（40 发方匣） */}
        <mesh position={[0.01, -0.11, 0.08]} rotation={[0.38, 0, 0]} userData={{ kind: 'fx' }}>
          <boxGeometry args={[0.06, 0.15, 0.08]} />
          <meshStandardMaterial color="#2a2e36" metalness={0.4} roughness={0.6} />
        </mesh>
        <mesh position={[0, -0.13, -0.02]} rotation={[0.08, 0, 0]} userData={{ kind: 'fx' }}>
          <boxGeometry args={[0.075, 0.2, 0.11]} />
          <meshStandardMaterial color="#2b2f38" metalness={0.6} roughness={0.5} />
        </mesh>
        <mesh position={[0, -0.13, -0.02]} rotation={[0.08, 0, 0]} userData={{ kind: 'fx' }}>
          <boxGeometry args={[0.078, 0.05, 0.112]} />
          <meshBasicMaterial color="#4ade80" toneMapped={false} />
        </mesh>

        {/* 枪身绿色能量线 + 小型医疗十字标识 */}
        <mesh position={[0.055, -0.01, -0.04]} userData={{ kind: 'fx' }}>
          <boxGeometry args={[0.004, 0.006, 0.28]} />
          <meshBasicMaterial color="#4ade80" toneMapped={false} />
        </mesh>
        <mesh position={[0.052, 0.01, 0.1]} userData={{ kind: 'fx' }}>
          <boxGeometry args={[0.005, 0.045, 0.012]} />
          <meshBasicMaterial color="#86efac" toneMapped={false} />
        </mesh>
        <mesh position={[0.052, 0.01, 0.1]} userData={{ kind: 'fx' }}>
          <boxGeometry args={[0.005, 0.012, 0.045]} />
          <meshBasicMaterial color="#86efac" toneMapped={false} />
        </mesh>

        {/* 顶部光学小件 */}
        <mesh position={[0, 0.105, -0.02]} userData={{ kind: 'fx' }}>
          <boxGeometry args={[0.045, 0.04, 0.13]} />
          <meshStandardMaterial color="#151920" metalness={0.7} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0.105, -0.02]} userData={{ kind: 'fx' }}>
          <boxGeometry args={[0.028, 0.01, 0.004]} />
          <meshBasicMaterial color="#4ade80" toneMapped={false} />
        </mesh>

        <object3D ref={muzzle} position={[0, 0.01, -0.46]} />
      </group>
    </group>
  )
}
