import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { rangeStore } from '../state/rangeStore'
import { medicStore } from '../state/medicStore'
import { targetRegistry } from '../combat/targetRegistry'
import { spawnDartRound } from '../combat/Projectiles'
import { playDry, playDart, playReload } from '../audio/sfx'
import { useKeyBinding } from '../input/useKeyBinding'
import { useInputReset } from '../input/useInputReset'
import { useMouseBinding } from '../input/useMouseBinding'

/**
 * D 医疗兵副武器：镇定剂针枪（Tranq Dart）。
 * - 2 键切换到针枪，单发射击约 0.65s/发，弹药 6 发
 * - 打空后约 1.8s 自动装填；R 也可手动触发装填（仅当前武器为针枪时）
 * - 绿色细弹道 + 轻微药雾，命中标靶“镇定”倒下 +4
 */
export function DartGun() {
  const { camera } = useThree()
  const follower = useRef<THREE.Group>(null!)
  const recoil = useRef<THREE.Group>(null!)
  const flash = useRef<THREE.Mesh>(null!)
  const muzzle = useRef<THREE.Object3D>(null!)
  const _dir = useRef(new THREE.Vector3())
  const _aim = useRef(new THREE.Vector3())

  const startReload = () => {
    const s = medicStore.getState()
    if (s.weapon !== 'dart' || s.dart.reloading || s.dart.ammo >= s.dart.capacity) return
    medicStore.setDart({
      reloading: true,
      reloadUntil: performance.now() + s.dart.reloadDuration,
    })
    playReload()
  }

  const fire = () => {
    const s = medicStore.getState()
    const range = rangeStore.getState()
    if (s.weapon !== 'dart') return
    if (!range.locked || performance.now() < range.weaponBusyUntil) return
    if (s.dart.reloading) return
    if (s.dart.ammo <= 0) {
      playDry()
      startReload()
      return
    }
    const now = performance.now()
    if (now < s.dart.cooldownUntil) return

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

    spawnDartRound(muzzlePos, dir)
    playDart()

    if (recoil.current) {
      recoil.current.position.z = 0.03
      recoil.current.rotation.x = 0.045
    }
    rangeStore.set({ shots: range.shots + 1 })

    const left = s.dart.ammo - 1
    medicStore.setDart({ ammo: left, cooldownUntil: now + s.dart.cooldownMs })
    if (left <= 0) {
      // 打空后约 1.8s 自动装填（不占 R，R 也可手动）
      medicStore.setDart({
        reloading: true,
        reloadUntil: performance.now() + medicStore.getState().dart.reloadDuration,
      })
    }
  }

  // 2 = 切到镇定剂针枪
  useKeyBinding('medicWeaponDart', {
    contexts: ['roleHud'],
    onDown: (e) => {
      if (e.repeat) return
      medicStore.set({ weapon: 'dart' })
    },
  })

  // R = 当前武器手动装填（仅针枪时响应）
  useKeyBinding('reload', {
    contexts: ['roleHud'],
    onDown: (e) => {
      if (e.repeat) return
      if (medicStore.getState().weapon !== 'dart') return
      if (medicStore.getState().dart.ammo < medicStore.getState().dart.capacity) startReload()
      else playDry()
    },
  })

  useMouseBinding('fire', {
    contexts: ['roleHud'],
    onDown: () => {
      if (medicStore.getState().weapon !== 'dart') return
      if (!rangeStore.getState().locked) return
      fire()
    },
    onUp: () => {
      // 针枪是单发，无按住状态需要清
    },
  })

  useInputReset(() => {
    // 无持续按下状态，仅确保不残留 ref
  })

  useEffect(() => {
    const onContextMenu = (e: Event) => {
      if (rangeStore.getState().locked) e.preventDefault()
    }
    window.addEventListener('contextmenu', onContextMenu)
    return () => window.removeEventListener('contextmenu', onContextMenu)
  }, [])

  useFrame((state, dt) => {
    if (!follower.current || !recoil.current) return
    const s = medicStore.getState()
    const range = rangeStore.getState()
    const dartSelected = s.weapon === 'dart'

    follower.current.position.copy(camera.position)
    follower.current.quaternion.copy(camera.quaternion)
    follower.current.visible = range.locked && dartSelected

    // 自动装填完成
    if (s.dart.reloading && performance.now() >= s.dart.reloadUntil) {
      medicStore.setDart({ reloading: false, ammo: s.dart.capacity })
    }

    // 后坐力衰减
    recoil.current.position.z = THREE.MathUtils.damp(recoil.current.position.z, 0, 12, dt)
    recoil.current.rotation.x = THREE.MathUtils.damp(recoil.current.rotation.x, 0, 12, dt)
    if (flash.current) {
      const show = dartSelected && range.locked && performance.now() - s.dart.cooldownUntil < 80
      flash.current.visible = show
      if (show) flash.current.scale.setScalar(0.5 + Math.random() * 0.5)
    }

    void state
  })

  return (
    <group ref={follower} name="dart-gun" visible={false}>
      <group ref={recoil} position={[0.32, -0.29, -0.56]} rotation={[0.04, 0.06, -0.02]} scale={0.78}>
        {/* 小巧注射/麻醉枪主体 */}
        <mesh userData={{ kind: 'fx' }}>
          <boxGeometry args={[0.06, 0.085, 0.24]} />
          <meshStandardMaterial color="#2f3540" metalness={0.7} roughness={0.4} />
        </mesh>
        {/* 顶侧透明药囊 */}
        <mesh position={[0, 0.035, 0.07]} rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
          <cylinderGeometry args={[0.014, 0.014, 0.1, 12]} />
          <meshStandardMaterial color="#9db9a5" transparent opacity={0.45} roughness={0.2} metalness={0.1} />
        </mesh>
        <mesh position={[0, 0.035, 0.07]} rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
          <cylinderGeometry args={[0.008, 0.008, 0.09, 10]} />
          <meshBasicMaterial color="#86efac" transparent opacity={0.85} toneMapped={false} />
        </mesh>
        {/* 后握把 */}
        <mesh position={[0, -0.085, 0.09]} rotation={[0.4, 0, 0]} userData={{ kind: 'fx' }}>
          <boxGeometry args={[0.05, 0.14, 0.06]} />
          <meshStandardMaterial color="#262a32" metalness={0.4} roughness={0.6} />
        </mesh>
        {/* 细针管 + 绿色发光针头 */}
        <mesh position={[0, 0.02, -0.22]} rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
          <cylinderGeometry args={[0.013, 0.013, 0.16, 10]} />
          <meshStandardMaterial color="#1d2128" metalness={0.85} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.02, -0.32]} rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
          <cylinderGeometry args={[0.007, 0.002, 0.08, 8]} />
          <meshBasicMaterial color="#4ade80" toneMapped={false} />
        </mesh>
        {/* 药囊发光点 */}
        <mesh position={[0, 0.035, 0.12]} userData={{ kind: 'fx' }}>
          <sphereGeometry args={[0.009, 8, 8]} />
          <meshBasicMaterial color="#86efac" toneMapped={false} />
        </mesh>
        {/* 枪口回弹闪光 */}
        <mesh ref={flash} position={[0, 0.02, -0.38]} visible={false}>
          <octahedronGeometry args={[0.04, 0]} />
          <meshBasicMaterial color="#86efac" toneMapped={false} />
        </mesh>
        <object3D ref={muzzle} position={[0, 0.02, -0.4]} />
      </group>
    </group>
  )
}
