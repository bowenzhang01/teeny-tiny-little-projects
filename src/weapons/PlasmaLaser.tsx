import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { rangeStore, registerImpact } from '../state/rangeStore'
import { engineerStore } from '../state/engineerStore'
import { targetRegistry } from '../combat/targetRegistry'
import { playDry, playReload } from '../audio/sfx'
import { useKeyBinding } from '../input/useKeyBinding'
import { useMouseBinding } from '../input/useMouseBinding'
import { useInputReset } from '../input/useInputReset'

/**
 * C 工程兵主武器：等离子激光枪。
 * - 左键按住 = 持续等离子光束（消耗能量，命中标靶打出小分）
 * - 右键按住 = 过载聚焦（能量消耗更快、光束更粗、伤害更高）
 * - R = 散热 / 能量核心快充（vent 结束后能量回满、热度清零）
 * - 命中通过 targetRegistry 判定，按 160ms 节流计一次分并推倒标靶。
 */
export function PlasmaLaser() {
  const { camera } = useThree()
  const follower = useRef<THREE.Group>(null!)
  const recoil = useRef<THREE.Group>(null!)
  const muzzle = useRef<THREE.Object3D>(null!)
  const beam = useRef<THREE.Mesh>(null!)
  const beamDot = useRef<THREE.Mesh>(null!)
  const emitterGlow = useRef<THREE.Mesh>(null!)

  const firing = useRef(false)
  const overcharge = useRef(false)
  const energy = useRef(engineerStore.getState().plasma.energy)
  const heat = useRef(engineerStore.getState().plasma.heat)
  const lastWrite = useRef(0)
  const lastDamageAt = useRef(0)

  const _dir = useRef(new THREE.Vector3())
  const _aim = useRef(new THREE.Vector3())
  const _up = useRef(new THREE.Vector3(0, 1, 0))

  const startFire = () => {
    const e = engineerStore.getState().plasma
    if (e.venting) return
    if (energy.current <= 0) {
      playDry()
      return
    }
    firing.current = true
    engineerStore.setPlasma({ firing: true })
  }

  const stopFire = () => {
    firing.current = false
    engineerStore.setPlasma({ firing: false })
  }

  const vent = () => {
    const e = engineerStore.getState().plasma
    if (e.venting) return
    playReload()
    engineerStore.setPlasma({ venting: true, ventUntil: performance.now() + 900, firing: false })
    firing.current = false
    rangeStore.set({
      message: '等离子核心散热 · VENTING',
      messageId: rangeStore.getState().messageId + 1,
    })
  }

  useMouseBinding('fire', {
    contexts: ['roleHud'],
    onDown: () => {
      if (!rangeStore.getState().locked) return
      startFire()
    },
    onUp: () => stopFire(),
  })

  useMouseBinding('altFire', {
    contexts: ['roleHud'],
    onDown: (e) => {
      if (!rangeStore.getState().locked) return
      e.preventDefault()
      overcharge.current = true
      engineerStore.setPlasma({ overcharge: true })
    },
    onUp: () => {
      overcharge.current = false
      engineerStore.setPlasma({ overcharge: false })
    },
  })

  useKeyBinding('plasmaVent', {
    contexts: ['roleHud'],
    onDown: (e) => {
      if (e.repeat) return
      vent()
    },
  })

  useInputReset(() => {
    firing.current = false
    overcharge.current = false
    engineerStore.setPlasma({ firing: false, overcharge: false })
  })

  /** 光束射线对目标包围盒的近似命中（瞄准点横向距离 < 0.55m） */
  const findBeamHit = (origin: THREE.Vector3, dir: THREE.Vector3) => {
    let best: { id: string; point: THREE.Vector3; dist: number } | null = null
    for (const t of targetRegistry.alive()) {
      const p = targetRegistry.aimWorld(t, _aim.current)
      const to = p.clone().sub(origin)
      const dist = to.length()
      if (dist > 45 || dist < 0.1) continue
      const proj = to.dot(dir)
      if (proj < 0 || proj > dist + 0.8) continue
      const perp = to.clone().addScaledVector(dir, -proj).length()
      if (perp < 0.55 && (!best || dist < best.dist)) {
        best = { id: t.id, point: p.clone(), dist }
      }
    }
    return best
  }

  useFrame((state, dt) => {
    if (!follower.current || !recoil.current) return
    const rs = rangeStore.getState()
    const e = engineerStore.getState().plasma

    // R 散热完成：能量回满、热度清零
    if (e.venting && performance.now() >= e.ventUntil) {
      energy.current = engineerStore.getState().plasma.maxEnergy
      heat.current = 0
      engineerStore.setPlasma({ venting: false, heat: 0, energy: energy.current })
      rangeStore.set({
        message: '等离子核心就绪 · READY',
        messageId: rs.messageId + 1,
      })
    }

    const wantFire = firing.current && rs.locked && !e.venting && energy.current > 0

    // 能量与热度（写回 store 节流，避免 HUD 每帧重渲染）
    if (wantFire) {
      energy.current = Math.max(0, energy.current - (overcharge.current ? 20 : 10) * dt)
      heat.current = Math.min(1, heat.current + (overcharge.current ? 0.22 : 0.11) * dt)
    } else {
      energy.current = Math.min(e.maxEnergy, energy.current + 14 * dt)
      heat.current = Math.max(0, heat.current - 0.08 * dt)
    }
    const now = performance.now()
    if (now - lastWrite.current > 90) {
      lastWrite.current = now
      engineerStore.setPlasma({
        energy: energy.current,
        heat: heat.current,
        firing: firing.current,
      })
    }

    follower.current.position.copy(camera.position)
    follower.current.quaternion.copy(camera.quaternion)

    camera.getWorldDirection(_dir.current)
    const dir = _dir.current.clone()
    // 锁定目标时辅助瞄准
    const lock = rs.lockedTargetId
    const target = lock ? targetRegistry.get(lock) : null
    if (target && target.alive) {
      targetRegistry.aimWorld(target, _aim.current)
      const origin = new THREE.Vector3()
      if (muzzle.current) muzzle.current.getWorldPosition(origin)
      dir.copy(_aim.current).sub(origin).normalize()
    }

    // 光束起点与终点
    const origin = new THREE.Vector3()
    if (muzzle.current) muzzle.current.getWorldPosition(origin)
    const hit = findBeamHit(origin, dir)
    const end = hit ? hit.point : origin.clone().addScaledVector(dir, 30)

    if (beam.current && beamDot.current) {
      const on = wantFire
      beam.current.visible = on
      beamDot.current.visible = on && !!hit
      if (on) {
        const len = Math.max(0.001, end.clone().sub(origin).length())
        const norm = end.clone().sub(origin).normalize()
        beam.current.position.copy(origin).addScaledVector(norm, len / 2)
        beam.current.quaternion.setFromUnitVectors(_up.current, norm)
        beam.current.scale.set(overcharge.current ? 1.5 : 1, len, overcharge.current ? 1.5 : 1)
        beamDot.current.position.copy(end)
        beamDot.current.scale.setScalar(overcharge.current ? 1.25 : 0.9)
      }
    }
    if (emitterGlow.current) {
      emitterGlow.current.visible = wantFire
      if (wantFire) emitterGlow.current.scale.setScalar(overcharge.current ? 1.5 : 1.1 + Math.random() * 0.2)
    }

    // 命中计分 + 推倒（每 160ms 一次；标靶倒下期间不重复计分）
    if (wantFire && hit && !targetRegistry.isDown(hit.id) && now - lastDamageAt.current > 160) {
      lastDamageAt.current = now
      registerImpact({ points: overcharge.current ? 2 : 1, shots: 0 })
      targetRegistry.knockDown(hit.id)
    }

    // 后坐力微动
    if (recoil.current) {
      recoil.current.position.z = THREE.MathUtils.damp(recoil.current.position.z, wantFire ? 0.045 : 0, 12, dt)
      recoil.current.rotation.x = THREE.MathUtils.damp(recoil.current.rotation.x, wantFire ? 0.07 : 0, 12, dt)
    }

    void state
  })

  return (
    <>
      {/* 第一人称持枪模型 */}
      <group ref={follower} name="plasma-laser">
        <group ref={recoil} position={[0.32, -0.24, -0.46]} rotation={[0, 0.04, -0.03]}>
          {/* 主枪体 */}
          <mesh userData={{ kind: 'fx' }}>
            <boxGeometry args={[0.12, 0.12, 0.5]} />
            <meshStandardMaterial color="#3b3f49" metalness={0.82} roughness={0.35} />
          </mesh>
          {/* 上导轨 */}
          <mesh position={[0, 0.075, -0.03]} userData={{ kind: 'fx' }}>
            <boxGeometry args={[0.07, 0.014, 0.44]} />
            <meshStandardMaterial color="#191d24" metalness={0.8} roughness={0.3} />
          </mesh>
          {/* 能量电池（琥珀色） */}
          <mesh position={[0.045, -0.1, 0.08]} rotation={[0.12, 0, 0]} userData={{ kind: 'fx' }}>
            <cylinderGeometry args={[0.06, 0.06, 0.24, 12]} />
            <meshStandardMaterial color="#2b2f38" metalness={0.55} roughness={0.5} />
          </mesh>
          <mesh position={[0.045, -0.1, 0.08]} rotation={[0.12, 0, 0]} userData={{ kind: 'fx' }}>
            <cylinderGeometry args={[0.045, 0.045, 0.2, 12]} />
            <meshBasicMaterial color="#ffb54d" toneMapped={false} transparent opacity={0.85} />
          </mesh>
          {/* 枪管 + 发射环 */}
          <mesh position={[0, 0.01, -0.3]} rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
            <cylinderGeometry args={[0.045, 0.05, 0.32, 14]} />
            <meshStandardMaterial color="#22262d" metalness={0.9} roughness={0.25} />
          </mesh>
          {[-0.2, -0.26, -0.32].map((z) => (
            <mesh key={z} position={[0, 0.01, z]} rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
              <torusGeometry args={[0.055, 0.008, 8, 18]} />
              <meshBasicMaterial color="#ffb54d" toneMapped={false} />
            </mesh>
          ))}
          {/* 枪口/发射器 */}
          <mesh position={[0, 0.01, -0.48]} rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
            <cylinderGeometry args={[0.07, 0.055, 0.08, 14]} />
            <meshStandardMaterial color="#191d24" metalness={0.9} roughness={0.22} />
          </mesh>
          <mesh ref={emitterGlow} position={[0, 0.01, -0.52]} visible={false}>
            <sphereGeometry args={[0.045, 12, 12]} />
            <meshBasicMaterial color="#ffd166" toneMapped={false} transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
          {/* 握把 */}
          <mesh position={[0, -0.14, 0.12]} rotation={[0.42, 0, 0]} userData={{ kind: 'fx' }}>
            <boxGeometry args={[0.07, 0.18, 0.1]} />
            <meshStandardMaterial color="#2a2e36" metalness={0.4} roughness={0.6} />
          </mesh>
          {/* 顶部光学模块 */}
          <mesh position={[0, 0.13, -0.02]} userData={{ kind: 'fx' }}>
            <boxGeometry args={[0.05, 0.05, 0.14]} />
            <meshStandardMaterial color="#151920" metalness={0.7} roughness={0.35} />
          </mesh>
          <mesh position={[0, 0.13, -0.02]} userData={{ kind: 'fx' }}>
            <boxGeometry args={[0.028, 0.012, 0.005]} />
            <meshBasicMaterial color="#ffb54d" toneMapped={false} />
          </mesh>
          <object3D ref={muzzle} position={[0, 0.01, -0.55]} />
        </group>
      </group>

      {/* 世界空间等离子光束 */}
      <group name="plasma-laser-beam">
        <mesh ref={beam} visible={false}>
          <cylinderGeometry args={[0.014, 0.014, 1, 8]} />
          <meshBasicMaterial
            color="#ffd166"
            transparent
            opacity={0.9}
            toneMapped={false}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
        <mesh ref={beamDot} visible={false}>
          <sphereGeometry args={[0.045, 10, 10]} />
          <meshBasicMaterial color="#ffb54d" toneMapped={false} transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      </group>
    </>
  )
}
