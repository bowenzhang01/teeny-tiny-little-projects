import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { rangeStore } from '../state/rangeStore'
import { targetRegistry } from '../combat/targetRegistry'
import { spawnRailBolt } from '../combat/Projectiles'
import { playDry, playRailCharge, playRailShot } from '../audio/sfx'

/**
 * 电磁轨道炮（背部左侧）：
 * - 平时在背上不可见；2 键展开到身体左侧
 * - 展开后：Q 长按充能、松开发射（六管同时展开时用 Q）；
 *   若只有轨道炮展开，左键也可按住充能/松开发射
 * - 单发高伤，有充能音效 + 电浆曳光 + 大爆炸
 */
export function Railgun() {
  const { camera } = useThree()
  const follower = useRef<THREE.Group>(null!)
  const root = useRef<THREE.Group>(null!)
  const recoil = useRef<THREE.Group>(null!)
  const chargeGlow = useRef<THREE.Mesh>(null!)
  const muzzle = useRef<THREE.Object3D>(null!)
  const deployK = useRef(0)
  const charging = useRef(false)
  const chargeStart = useRef(0)
  const lastShotAt = useRef(0)
  const _dir = useRef(new THREE.Vector3())
  const _aim = useRef(new THREE.Vector3())

  const canFire = () => {
    const s = rangeStore.getState()
    return s.locked && s.railgunDeployed && performance.now() >= s.railgunCooldownUntil
  }

  const startCharge = () => {
    if (charging.current || !canFire()) {
      if (!charging.current) playDry()
      return
    }
    charging.current = true
    chargeStart.current = performance.now()
    rangeStore.set({ railgunCharging: true })
    playRailCharge()
  }

  const fireRailgun = () => {
    if (!charging.current) return
    charging.current = false
    const held = performance.now() - chargeStart.current
    rangeStore.set({ railgunCharging: false })
    if (held < 220) return // 充能不足自动取消

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
    spawnRailBolt(muzzlePos, dir)
    playRailShot()
    lastShotAt.current = performance.now()
    rangeStore.set({
      shots: s.shots + 1,
      railgunCooldownUntil: performance.now() + s.railgunCooldownMax,
    })
    if (recoil.current) recoil.current.position.z = 0.14
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'KeyQ') return
      if (rangeStore.getState().locked && rangeStore.getState().railgunDeployed) startCharge()
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'KeyQ') return
      fireRailgun()
    }
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      const s = rangeStore.getState()
      if (s.locked && s.railgunDeployed && !s.minigunDeployed) startCharge()
    }
    const onMouseUp = (e: MouseEvent) => {
      if (e.button !== 0) return
      fireRailgun()
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  useFrame((state, dt) => {
    if (!follower.current || !root.current) return
    const s = rangeStore.getState()
    if (!s.railgunDeployed) charging.current = false
    const target = s.railgunDeployed ? 1 : 0
    deployK.current = THREE.MathUtils.damp(deployK.current, target, 6, dt)
    const k = deployK.current

    follower.current.position.copy(camera.position)
    follower.current.quaternion.copy(camera.quaternion)

    root.current.visible = k > 0.02
    const x = THREE.MathUtils.lerp(-1.7, -0.42, k)
    const y = THREE.MathUtils.lerp(-1.0, -0.26, k)
    const z = THREE.MathUtils.lerp(0.35, -0.62, k)
    root.current.position.set(x, y, z)

    if (recoil.current) {
      recoil.current.position.z = THREE.MathUtils.damp(recoil.current.position.z, 0, 9, dt)
      recoil.current.rotation.x = THREE.MathUtils.damp(recoil.current.rotation.x, 0, 9, dt)
    }

    // 充能特效
    if (chargeGlow.current) {
      const show = charging.current
      chargeGlow.current.visible = show
      if (show) {
        const t = Math.min(1, (performance.now() - chargeStart.current) / 500)
        const pulse = 0.5 + t * 1.1 + Math.sin(state.clock.elapsedTime * 22) * 0.08
        chargeGlow.current.scale.setScalar(pulse)
      }
    }
  })

  return (
    <group ref={follower} name="railgun">
      <group ref={root} visible={false} position={[-1.7, -1.0, 0.35]}>
        <group ref={recoil}>
          {/* 主炮体 */}
          <mesh userData={{ kind: 'fx' }}>
            <boxGeometry args={[0.14, 0.16, 0.9]} />
            <meshStandardMaterial color="#39404c" metalness={0.82} roughness={0.32} />
          </mesh>
          {/* 双导轨（电磁轨道） */}
          <mesh position={[0.055, 0.02, -0.1]} userData={{ kind: 'fx' }}>
            <boxGeometry args={[0.03, 0.04, 1.15]} />
            <meshBasicMaterial color="#67e8f9" toneMapped={false} />
          </mesh>
          <mesh position={[-0.055, 0.02, -0.1]} userData={{ kind: 'fx' }}>
            <boxGeometry args={[0.03, 0.04, 1.15]} />
            <meshBasicMaterial color="#67e8f9" toneMapped={false} />
          </mesh>
          {/* 炮口 */}
          <mesh position={[0, 0.02, -0.62]} rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
            <cylinderGeometry args={[0.075, 0.06, 0.16, 18]} />
            <meshStandardMaterial color="#23262d" metalness={0.9} roughness={0.25} />
          </mesh>
          {/* 电容块 */}
          <mesh position={[0, 0.02, 0.24]} userData={{ kind: 'fx' }}>
            <boxGeometry args={[0.18, 0.14, 0.26]} />
            <meshStandardMaterial color="#2c323d" metalness={0.6} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.02, 0.34]} userData={{ kind: 'fx' }}>
            <boxGeometry args={[0.1, 0.08, 0.08]} />
            <meshBasicMaterial color="#67e8f9" toneMapped={false} />
          </mesh>
          {/* 侧握把 */}
          <mesh position={[0.1, -0.14, 0.05]} rotation={[0.3, 0, -0.2]} userData={{ kind: 'fx' }}>
            <boxGeometry args={[0.07, 0.2, 0.1]} />
            <meshStandardMaterial color="#2a2e36" metalness={0.4} roughness={0.6} />
          </mesh>
          {/* 充能光球 */}
          <mesh ref={chargeGlow} position={[0, 0.02, -0.72]} visible={false}>
            <sphereGeometry args={[0.1, 14, 14]} />
            <meshBasicMaterial color="#a5f3fc" transparent opacity={0.85} toneMapped={false} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
          <object3D ref={muzzle} position={[0, 0.02, -0.7]} />
        </group>
      </group>
    </group>
  )
}
