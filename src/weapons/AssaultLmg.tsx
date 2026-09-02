import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { rangeStore } from '../state/rangeStore'
import { assaultStore } from '../state/assaultStore'
import { droneStore } from '../state/droneStore'
import { targetRegistry } from '../combat/targetRegistry'
import { spawnLmgRound } from '../combat/Projectiles'
import { playDry, playLmgShot, playReload } from '../audio/sfx'

/**
 * A 突击兵主武器：大弹夹轻机枪（LMG）。
 * - 左键按住持续射击，射速约 0.085s/发，弹匣 120 发，R 换弹
 * - 右键按住 = 稳定瞄准（激光收束 + 散布收敛）
 * - 激光瞄具：枪口红色激光直指锁定目标/准星落点，命中前可见瞄准线
 * - 热度机制：连续射击提升 heat，散布变大；停火后缓慢冷却
 */
export function AssaultLmg() {
  const { camera } = useThree()
  const follower = useRef<THREE.Group>(null!)
  const recoil = useRef<THREE.Group>(null!)
  const flash = useRef<THREE.Mesh>(null!)
  const muzzle = useRef<THREE.Object3D>(null!)
  const laserBeam = useRef<THREE.Mesh>(null!)
  const laserDot = useRef<THREE.Mesh>(null!)
  const firing = useRef(false)
  const fireTimer = useRef(0)
  const lastHeatWrite = useRef(0)
  const _dir = useRef(new THREE.Vector3())
  const _aim = useRef(new THREE.Vector3())
  const _up = useRef(new THREE.Vector3())

  const startReload = () => {
    const s = assaultStore.getState()
    if (s.reloading || s.mag >= s.magSize) return
    assaultStore.set({
      reloading: true,
      reloadUntil: performance.now() + s.reloadDuration,
      firing: false,
    })
    playReload()
  }

  const fireShot = () => {
    const s = assaultStore.getState()
    if (s.reloading || s.mag <= 0) return
    const range = rangeStore.getState()
    if (!range.locked) return
    if (droneStore.getState().mode === 'remote') return

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

    // 热度越高散布越大；稳定瞄准（右键）收束
    const spread = 0.006 + s.heat * 0.022 + (s.stabilize ? -0.004 : 0.002)
    dir.x += (Math.random() - 0.5) * spread
    dir.y += (Math.random() - 0.5) * spread

    spawnLmgRound(muzzlePos, dir)
    playLmgShot()

    if (recoil.current) {
      recoil.current.position.z = 0.06
      recoil.current.rotation.x = 0.1
    }
    rangeStore.set({ shots: range.shots + 1 })

    const heat = Math.min(1, s.heat + 0.014 + (s.stabilize ? 0.008 : 0))
    assaultStore.set({ mag: Math.max(0, s.mag - 1), heat })
    if (s.mag - 1 <= 0) startReload()
  }

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        if (!rangeStore.getState().locked) return
        firing.current = true
        assaultStore.set({ firing: true })
      } else if (e.button === 2) {
        if (!rangeStore.getState().locked) return
        e.preventDefault()
        assaultStore.set({ stabilize: true })
      }
    }
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        firing.current = false
        assaultStore.set({ firing: false })
      } else if (e.button === 2) {
        assaultStore.set({ stabilize: false })
      }
    }
    const onContextMenu = (e: Event) => {
      if (rangeStore.getState().locked) e.preventDefault()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyR') {
        const s = assaultStore.getState()
        if (s.mag < s.magSize) startReload()
        else playDry()
      }
    }

    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('contextmenu', onContextMenu)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('contextmenu', onContextMenu)
      window.removeEventListener('keydown', onKeyDown)
      firing.current = false
    }
  }, [])

  useFrame((state, dt) => {
    if (!follower.current || !recoil.current) return
    const a = assaultStore.getState()
    const range = rangeStore.getState()
    const droneRemote = droneStore.getState().mode === 'remote'

    follower.current.position.copy(camera.position)
    follower.current.quaternion.copy(camera.quaternion)
    // 机器人遥控时隐藏 A 的持枪模型
    follower.current.visible = !droneRemote

    // 未锁定/换弹/机器人遥控时停止射击
    if (!range.locked || a.reloading || droneRemote) {
      firing.current = false
      if (a.firing) assaultStore.set({ firing: false })
    }

    // 打空弹匣自动换弹
    if (firing.current && range.locked && !a.reloading && a.mag <= 0) {
      startReload()
    }

    // 持续射击
    if (firing.current && range.locked && !a.reloading) {
      fireTimer.current += dt
      if (fireTimer.current >= 0.085) {
        fireTimer.current = 0
        fireShot()
      }
    } else {
      fireTimer.current = 0
    }

    // 懒冷却：每 ~90ms 写一次 heat，避免 HUD 每帧重渲染
    if (!firing.current && a.heat > 0) {
      const now = performance.now()
      if (now - lastHeatWrite.current > 90) {
        lastHeatWrite.current = now
        assaultStore.set({ heat: Math.max(0, a.heat - dt * 0.06) })
      }
    }

    // 换弹完成
    if (a.reloading && performance.now() >= a.reloadUntil) {
      assaultStore.set({ reloading: false, mag: a.magSize, heat: Math.max(0, a.heat - 0.35) })
    }

    // 后坐力/枪口闪光衰减
    recoil.current.position.z = THREE.MathUtils.damp(recoil.current.position.z, 0, 10, dt)
    recoil.current.rotation.x = THREE.MathUtils.damp(recoil.current.rotation.x, 0, 10, dt)
    if (flash.current) {
      const show = firing.current && range.locked
      flash.current.visible = show
      if (show) flash.current.scale.setScalar(0.6 + Math.random() * 0.5)
    }

    // 激光瞄具：从枪口射向锁定目标（或准星 30m 落点）
    if (laserBeam.current && laserDot.current) {
      const on = a.laserOn && range.locked && !droneRemote
      laserBeam.current.visible = on
      laserDot.current.visible = on
      if (on && muzzle.current) {
        const start = new THREE.Vector3()
        muzzle.current.getWorldPosition(start)
        const end = new THREE.Vector3()
        const lock = range.lockedTargetId
        const target = lock ? targetRegistry.get(lock) : null
        if (target && target.alive) {
          targetRegistry.aimWorld(target, end)
        } else {
          camera.getWorldDirection(_dir.current)
          end.copy(camera.position).addScaledVector(_dir.current, 30)
        }
        const dir = end.clone().sub(start)
        const len = Math.max(0.001, dir.length())
        const norm = dir.clone().normalize()
        laserBeam.current.position.copy(start).addScaledVector(norm, len / 2)
        laserBeam.current.quaternion.setFromUnitVectors(_up.current.set(0, 1, 0), norm)
        laserBeam.current.scale.set(1, len, 1)
        laserDot.current.position.copy(end)
        laserDot.current.scale.setScalar(a.stabilize ? 0.9 : 1.2)
      }
    }
    void state
  })

  return (
    <>
      <group ref={follower} name="assault-lmg">
        <group ref={recoil} position={[0.3, -0.25, -0.48]} rotation={[0, 0.05, -0.02]} scale={1.12}>
          {/* 上机匣（主结构） */}
          <mesh userData={{ kind: 'fx' }}>
            <boxGeometry args={[0.13, 0.1, 0.52]} />
            <meshStandardMaterial color="#3b3f49" metalness={0.82} roughness={0.32} />
          </mesh>
          {/* 下机匣（略窄，形成分层轮廓） */}
          <mesh position={[0, -0.07, 0.04]} userData={{ kind: 'fx' }}>
            <boxGeometry args={[0.1, 0.08, 0.34]} />
            <meshStandardMaterial color="#2c323d" metalness={0.7} roughness={0.42} />
          </mesh>
          {/* 顶部导轨 */}
          <mesh position={[0, 0.062, -0.02]} userData={{ kind: 'fx' }}>
            <boxGeometry args={[0.07, 0.012, 0.44]} />
            <meshStandardMaterial color="#191d24" metalness={0.8} roughness={0.3} />
          </mesh>

          {/* 大弹箱（方箱 · A 的视觉标志） */}
          <mesh position={[0.03, -0.16, 0.06]} rotation={[0.12, 0, 0]} userData={{ kind: 'fx' }}>
            <boxGeometry args={[0.11, 0.3, 0.2]} />
            <meshStandardMaterial color="#2b2f38" metalness={0.5} roughness={0.55} />
          </mesh>
          <mesh position={[0.03, -0.16, 0.06]} rotation={[0.12, 0, 0]} userData={{ kind: 'fx' }}>
            <boxGeometry args={[0.115, 0.08, 0.205]} />
            <meshBasicMaterial color="#f87171" toneMapped={false} />
          </mesh>
          {/* 弹箱侧盖/卡扣 */}
          <mesh position={[0.092, -0.11, 0.06]} rotation={[0, 0.12, 0]} userData={{ kind: 'fx' }}>
            <boxGeometry args={[0.02, 0.2, 0.18]} />
            <meshStandardMaterial color="#22262d" metalness={0.6} roughness={0.5} />
          </mesh>

          {/* 散热护木（枪管外筒 + 散热孔） */}
          <mesh position={[0, 0.01, -0.34]} rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
            <cylinderGeometry args={[0.055, 0.06, 0.34, 14]} />
            <meshStandardMaterial color="#22262d" metalness={0.9} roughness={0.25} />
          </mesh>
          {[-0.05, 0.05].map((x) =>
            [-0.26, -0.34, -0.42].map((z) => (
              <mesh key={`${x}-${z}`} position={[x, 0.01, z]} userData={{ kind: 'fx' }}>
                <boxGeometry args={[0.012, 0.05, 0.02]} />
                <meshStandardMaterial color="#0d1015" metalness={0.6} roughness={0.5} />
              </mesh>
            )),
          )}
          {/* 散热鳍片（筒身分段，增加机械感） */}
          {[-0.22, -0.28, -0.34, -0.4].map((z) => (
            <mesh key={z} position={[0, 0.01, z]} rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
              <cylinderGeometry args={[0.07, 0.07, 0.018, 14]} />
              <meshStandardMaterial color="#191d24" metalness={0.85} roughness={0.3} />
            </mesh>
          ))}
          {/* 枪管侧红色能量条（强调激光武装感） */}
          {[-0.058, 0.058].map((x) => (
            <mesh key={x} position={[x, 0.01, -0.32]} userData={{ kind: 'fx' }}>
              <boxGeometry args={[0.006, 0.01, 0.26]} />
              <meshBasicMaterial color="#ff5f5f" toneMapped={false} />
            </mesh>
          ))}
          {/* 前准星 */}
          <mesh position={[0, 0.09, -0.46]} userData={{ kind: 'fx' }}>
            <boxGeometry args={[0.015, 0.06, 0.015]} />
            <meshStandardMaterial color="#2a2e36" metalness={0.7} roughness={0.35} />
          </mesh>
          {/* 枪口制退器 */}
          <mesh position={[0, 0.01, -0.57]} rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
            <cylinderGeometry args={[0.062, 0.052, 0.1, 14]} />
            <meshStandardMaterial color="#191d24" metalness={0.9} roughness={0.22} />
          </mesh>
          <mesh position={[0, 0.01, -0.615]} rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
            <cylinderGeometry args={[0.03, 0.03, 0.04, 10]} />
            <meshBasicMaterial color="#ff6b5e" toneMapped={false} />
          </mesh>

          {/* 前握把 */}
          <mesh position={[0.03, -0.13, -0.16]} rotation={[0.32, 0, -0.06]} userData={{ kind: 'fx' }}>
            <boxGeometry args={[0.07, 0.18, 0.09]} />
            <meshStandardMaterial color="#2a2e36" metalness={0.4} roughness={0.6} />
          </mesh>
          {/* 后握把 */}
          <mesh position={[0, -0.14, 0.16]} rotation={[0.42, 0, 0]} userData={{ kind: 'fx' }}>
            <boxGeometry args={[0.07, 0.17, 0.08]} />
            <meshStandardMaterial color="#262a32" metalness={0.4} roughness={0.6} />
          </mesh>
          {/* 折叠枪托 */}
          <mesh position={[-0.02, -0.02, 0.31]} rotation={[0.08, 0, 0]} userData={{ kind: 'fx' }}>
            <boxGeometry args={[0.06, 0.12, 0.16]} />
            <meshStandardMaterial color="#2c323d" metalness={0.6} roughness={0.5} />
          </mesh>

          {/* 顶部提把 + 光学模块 */}
          <mesh position={[0, 0.12, -0.04]} userData={{ kind: 'fx' }}>
            <boxGeometry args={[0.05, 0.05, 0.24]} />
            <meshStandardMaterial color="#151920" metalness={0.7} roughness={0.35} />
          </mesh>
          <mesh position={[0, 0.12, -0.04]} userData={{ kind: 'fx' }}>
            <boxGeometry args={[0.032, 0.014, 0.005]} />
            <meshBasicMaterial color="#ff6b5e" toneMapped={false} />
          </mesh>

          {/* 侧面激光模块（瞄具的一部分） */}
          <mesh position={[0.072, 0.03, -0.3]} userData={{ kind: 'fx' }}>
            <boxGeometry args={[0.018, 0.035, 0.12]} />
            <meshStandardMaterial color="#1c2028" metalness={0.75} roughness={0.35} />
          </mesh>
          <mesh position={[0.082, 0.03, -0.365]} userData={{ kind: 'fx' }}>
            <cylinderGeometry args={[0.012, 0.012, 0.02, 8]} />
            <meshBasicMaterial color="#ff5f5f" toneMapped={false} />
          </mesh>

          {/* 红色能量线（科技感点缀） */}
          <mesh position={[0.068, -0.02, 0.02]} userData={{ kind: 'fx' }}>
            <boxGeometry args={[0.004, 0.004, 0.3]} />
            <meshBasicMaterial color="#ff5f5f" toneMapped={false} />
          </mesh>

          {/* 枪口闪光 */}
          <mesh ref={flash} position={[0, 0.01, -0.62]} visible={false}>
            <octahedronGeometry args={[0.07, 0]} />
            <meshBasicMaterial color="#ff8a5c" toneMapped={false} />
          </mesh>

          {/* 枪口参考点 */}
          <object3D ref={muzzle} position={[0, 0.01, -0.63]} />
        </group>
      </group>

      {/* 激光瞄具：世界空间光束（不跟随相机的坐标准确性） */}
      <group name="assault-lmg-laser">
        <mesh ref={laserBeam} visible={false}>
          <cylinderGeometry args={[0.005, 0.005, 1, 6]} />
          <meshBasicMaterial
            color="#ff5f5f"
            transparent
            opacity={0.85}
            toneMapped={false}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
        <mesh ref={laserDot} visible={false}>
          <sphereGeometry args={[0.02, 8, 8]} />
          <meshBasicMaterial color="#ff7a70" toneMapped={false} depthWrite={false} />
        </mesh>
      </group>
    </>
  )
}
