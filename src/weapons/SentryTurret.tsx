import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { engineerStore } from '../state/engineerStore'
import { rangeStore } from '../state/rangeStore'
import { targetRegistry } from '../combat/targetRegistry'
import { spawnTurretRound } from '../combat/Projectiles'
import { crosshairGroundPoint } from '../combat/placement'
import { playDeploy, playDry, playMinigunShot } from '../audio/sfx'
import { useKeyBinding } from '../input/useKeyBinding'
import { useMouseBinding } from '../input/useMouseBinding'
import { triggerInputReset } from '../input/inputReset'

const PLACE_MIN = 3
const PLACE_MAX = 12

/**
 * C 固定哨戒炮塔（C-4）：
 * - 3 键对准星落点部署（3~12m 范围限制），再次按 3 回收
 * - 最多一台：已部署时按 3 直接回收（不会替换/重复部署）
 * - 双联重机炮：自动索敌、交替开火、单发 +6（火力强于 A 机器人，但固定）
 * - 无部署冷却与寿命；回收/部署时驱动四臂 BUSY 动画
 */
export function SentryTurret() {
  const { camera, gl } = useThree()
  const root = useRef<THREE.Group>(null!)
  const head = useRef<THREE.Group>(null!)
  const barrels = useRef<THREE.Group>(null!)
  const leftMuzzle = useRef<THREE.Object3D>(null!)
  const rightMuzzle = useRef<THREE.Object3D>(null!)
  const leftFlash = useRef<THREE.Mesh>(null!)
  const rightFlash = useRef<THREE.Mesh>(null!)
  const buildRing = useRef<THREE.Mesh>(null!)
  const deployK = useRef(0)
  const spawned = useRef(false)
  const yaw = useRef(0)
  const fireTimer = useRef(0)
  const alternate = useRef(false)
  const flashUntil = useRef(0)
  const _aim = useRef(new THREE.Vector3())
  const _dir = useRef(new THREE.Vector3())
  const _euler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'))
  const manualYaw = useRef(0)
  const manualPitch = useRef(0)
  const manualFiring = useRef(false)
  const savedCamPos = useRef(new THREE.Vector3())
  const savedCamQuat = useRef(new THREE.Quaternion())
  const hasSavedCam = useRef(false)

  const message = (text: string) => {
    const s = rangeStore.getState()
    rangeStore.set({ message: text, messageId: s.messageId + 1 })
  }

  const saveCamera = () => {
    if (hasSavedCam.current) return
    savedCamPos.current.copy(camera.position)
    savedCamQuat.current.copy(camera.quaternion)
    hasSavedCam.current = true
  }

  const restoreCamera = () => {
    if (!hasSavedCam.current) return
    camera.position.copy(savedCamPos.current)
    camera.quaternion.copy(savedCamQuat.current)
    hasSavedCam.current = false
  }

  const enterManual = () => {
    const s = engineerStore.getState()
    if (!s.turret.deployed) {
      message('请先部署哨戒炮塔')
      return
    }
    saveCamera()
    manualYaw.current = yaw.current
    manualPitch.current = 0
    manualFiring.current = false
    engineerStore.set({ turret: { ...s.turret, manual: true } })
    triggerInputReset('context')
    message('哨戒炮塔手动接管 · SENTRY LINK')
  }

  const exitManual = () => {
    const s = engineerStore.getState()
    if (!s.turret.manual) return
    manualFiring.current = false
    restoreCamera()
    engineerStore.set({ turret: { ...s.turret, manual: false } })
    triggerInputReset('context')
    message('交还自动 · AUTO ENGAGE')
  }

  const toggleManual = () => {
    if (engineerStore.getState().turret.manual) exitManual()
    else enterManual()
  }

  const deploy = () => {
    if (!rangeStore.getState().locked) return
    const s = engineerStore.getState()
    if (s.deploy.pending) return
    if (s.turret.manual) {
      // 手动遥控中按 3：退出手动并回收
      exitManual()
      recall()
      return
    }
    if (s.turret.deployed) {
      // 3 为部署/回收切换：已有一台时直接回收（不会出现第二台/替换）
      recall()
      return
    }
    const p = crosshairGroundPoint(camera, PLACE_MIN, PLACE_MAX)
    if (!p) {
      message(`部署范围 ${PLACE_MIN}-${PLACE_MAX}M · 请对准地面`)
      playDry()
      return
    }
    // 先让四臂伸手，commitAt 后炮塔装配出现，operateUntil 后四臂收回
    engineerStore.beginDeploy('turret', p.x, p.z, 700, 1100)
    playDeploy()
    message('机械臂展开 · 炮塔部署中…')
  }

  const recall = () => {
    const s = engineerStore.getState()
    if (!s.turret.deployed) return
    if (s.turret.manual) restoreCamera()
    engineerStore.set({ turret: { deployed: false, x: 0, z: 0, manual: false } })
    engineerStore.runArmsBusy(700)
    playDeploy()
    message('哨戒炮塔回收')
  }

  useKeyBinding('deployTurret', {
    onDown: (e) => {
      if (e.repeat) return
      deploy()
    },
  })

  // 1 = 收回全部：取消部署/退出遥控/回收炮塔 + 收起四臂（地雷不回收）
  useKeyBinding('recallAll', {
    onDown: (e) => {
      if (e.repeat) return
      const s0 = engineerStore.getState()
      if (s0.deploy.pending) {
        engineerStore.cancelPendingDeploy()
        message('部署取消')
        return
      }
      if (s0.turret.manual) exitManual()
      recall()
      engineerStore.set({ armsMode: 'stowed' })
    },
  })

  // F = 炮塔手动遥控 / 自动 切换（类似 A 机器人 REMOTE，但不移动）
  useKeyBinding('toggleTurretManual', {
    onDown: (e) => {
      if (e.repeat) return
      toggleManual()
    },
  })

  // 手动模式下左键开火（并请求指针锁定）
  useMouseBinding('fire', {
    contexts: ['turretRemote'],
    onDown: () => {
      const t = engineerStore.getState().turret
      if (!t.manual || !t.deployed) return
      if (!document.pointerLockElement && gl.domElement.requestPointerLock) {
        gl.domElement.requestPointerLock()
      }
      manualFiring.current = true
    },
    onUp: () => {
      manualFiring.current = false
    },
  })

  // 手动遥控的鼠标视角 + contextmenu 屏蔽
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const t = engineerStore.getState().turret
      if (!t.manual || !t.deployed) return
      if (!document.pointerLockElement) return
      manualYaw.current -= e.movementX * 0.0021
      manualPitch.current = THREE.MathUtils.clamp(manualPitch.current - e.movementY * 0.0021, -1.15, 0.9)
    }
    const onContextMenu = (e: Event) => {
      if (rangeStore.getState().locked) e.preventDefault()
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('contextmenu', onContextMenu)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('contextmenu', onContextMenu)
      // 卸载（换人）时还原 A/C 视角
      if (engineerStore.getState().turret.manual) restoreCamera()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fire = (muzzle: THREE.Object3D | null, targetId: string) => {
    if (!muzzle) return
    const origin = new THREE.Vector3()
    muzzle.getWorldPosition(origin)
    const target = targetRegistry.get(targetId)
    if (!target || !target.alive) return
    const aim = targetRegistry.aimWorld(target, _aim.current)
    const dir = aim.clone().sub(origin).normalize()
    spawnTurretRound(origin, dir)
    playMinigunShot()
    const rs = rangeStore.getState()
    rangeStore.set({ shots: rs.shots + 1 })
  }

  /** 手动遥控：按当前相机方向开火 */
  const fireManual = (muzzle: THREE.Object3D | null) => {
    if (!muzzle) return
    const origin = new THREE.Vector3()
    muzzle.getWorldPosition(origin)
    camera.getWorldDirection(_dir.current)
    const dir = _dir.current.clone()
    spawnTurretRound(origin, dir)
    playMinigunShot()
    const rs = rangeStore.getState()
    rangeStore.set({ shots: rs.shots + 1 })
  }

  useFrame((state, dt) => {
    const s = engineerStore.getState()
    const now = performance.now()

    // 部署动作 commit：四臂伸手后炮塔装配出现，操作完成后再收回
    const pending = s.deploy.pending
    if (pending && pending.kind === 'turret') {
      if (now >= pending.commitAt && !spawned.current) {
        engineerStore.set({ turret: { deployed: true, x: pending.x, z: pending.z, manual: false } })
        spawned.current = true
        playDeploy()
        message('机械臂装配中 · ASSEMBLING')
      }
      if (now >= pending.operateUntil) {
        engineerStore.commitDeploy(pending.id)
        spawned.current = false
        message('哨戒炮塔就绪 · SENTRY ONLINE')
      }
    } else {
      spawned.current = false
    }

    const t = s.turret
    const targetK = t.deployed ? 1 : 0
    deployK.current = THREE.MathUtils.damp(deployK.current, targetK, 6, dt)
    const k = deployK.current

    if (root.current) {
      root.current.position.set(t.x, 0, t.z)
      root.current.visible = k > 0.02 && !t.manual
      const sc = 0.15 + k * 0.85
      root.current.scale.setScalar(sc)
    }

    // 装配光环：炮塔出现到完全成型期间显示旋转琥珀环
    if (buildRing.current) {
      const assembling = t.deployed && k < 0.98
      buildRing.current.visible = assembling
      if (assembling) {
        buildRing.current.position.y = 0.45
        buildRing.current.scale.setScalar(1 + (1 - k) * 2.2)
        ;(buildRing.current.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.65
        buildRing.current.rotation.z += dt * 1.6
      }
    }

    // ---- 手动遥控：相机移到炮塔头部，鼠标瞄准，左键开火（不移动） ----
    if (t.manual && head.current) {
      const headPos = new THREE.Vector3()
      head.current.getWorldPosition(headPos)
      camera.position.copy(headPos)
      _euler.current.set(manualPitch.current, manualYaw.current, 0)
      camera.quaternion.setFromEuler(_euler.current)
      camera.updateMatrixWorld()
      head.current.rotation.y = manualYaw.current

      fireTimer.current += dt
      if (manualFiring.current && fireTimer.current >= 0.11) {
        fireTimer.current = 0
        alternate.current = !alternate.current
        const muzzle = alternate.current ? leftMuzzle.current : rightMuzzle.current
        fireManual(muzzle)
        flashUntil.current = performance.now() + 55
      }
      if (leftFlash.current) leftFlash.current.visible = alternate.current && now < flashUntil.current
      if (rightFlash.current) rightFlash.current.visible = !alternate.current && now < flashUntil.current
      void state
      return
    }

    if (!t.deployed || !head.current) return

    // 找离炮塔最近的活目标
    let best: string | null = null
    let bestDist = Infinity
    for (const tg of targetRegistry.alive()) {
      const p = targetRegistry.aimWorld(tg, _aim.current)
      const d = Math.hypot(p.x - t.x, p.z - t.z)
      if (d < bestDist) {
        bestDist = d
        best = tg.id
      }
    }

    if (best && !targetRegistry.isDown(best)) {
      const target = targetRegistry.get(best)
      if (target) {
        const aim = targetRegistry.aimWorld(target, _aim.current)
        const dx = aim.x - t.x
        const dz = aim.z - t.z
        const targetYaw = Math.atan2(-dx, -dz)
        yaw.current = dampAngle(yaw.current, targetYaw, 6, dt)
      }
      fireTimer.current += dt
      if (fireTimer.current >= 0.11) {
        fireTimer.current = 0
        alternate.current = !alternate.current
        const muzzle = alternate.current ? leftMuzzle.current : rightMuzzle.current
        fire(muzzle, best)
        flashUntil.current = performance.now() + 55
      }
    } else {
      // 无目标：缓慢扫描
      yaw.current += dt * 0.25
      fireTimer.current = 0
    }

    if (head.current) head.current.rotation.y = yaw.current
    if (barrels.current) barrels.current.rotation.x = THREE.MathUtils.damp(barrels.current.rotation.x, 0, 10, dt)
    if (leftFlash.current) leftFlash.current.visible = alternate.current && now < flashUntil.current
    if (rightFlash.current) rightFlash.current.visible = !alternate.current && now < flashUntil.current

    void state
  })

  return (
    <group ref={root} name="sentry-turret" visible={false}>
      {/* 底座 */}
      <mesh position={[0, 0.16, 0]} castShadow userData={{ kind: 'solid' }}>
        <cylinderGeometry args={[0.42, 0.52, 0.34, 8]} />
        <meshStandardMaterial color="#2c323d" metalness={0.7} roughness={0.45} />
      </mesh>
      <mesh position={[0, 0.36, 0]} rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
        <torusGeometry args={[0.42, 0.025, 8, 20]} />
        <meshStandardMaterial color="#22262d" metalness={0.85} roughness={0.3} />
      </mesh>

      {/* 装配光环 */}
      <mesh ref={buildRing} position={[0, 0.45, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.6, 0.68, 32]} />
        <meshBasicMaterial color="#ffd166" transparent opacity={0} toneMapped={false} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>

      {/* 回转头部 */}
      <group ref={head} position={[0, 0.62, 0]}>
        <mesh position={[0, 0.05, 0.02]} castShadow userData={{ kind: 'solid' }}>
          <boxGeometry args={[0.72, 0.34, 0.5]} />
          <meshStandardMaterial color="#3a404c" metalness={0.82} roughness={0.35} />
        </mesh>
        {/* 传感器罩 */}
        <mesh position={[0, 0.26, 0.02]} userData={{ kind: 'fx' }}>
          <sphereGeometry args={[0.14, 12, 12]} />
          <meshStandardMaterial color="#191d24" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.26, -0.1]} rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
          <cylinderGeometry args={[0.055, 0.055, 0.05, 12]} />
          <meshBasicMaterial color="#ffb54d" toneMapped={false} />
        </mesh>
        {/* 警示条 */}
        <mesh position={[0, 0.14, -0.27]} userData={{ kind: 'fx' }}>
          <boxGeometry args={[0.5, 0.04, 0.01]} />
          <meshBasicMaterial color="#ffb54d" toneMapped={false} />
        </mesh>

        {/* 双联重机炮管 */}
        <group ref={barrels} position={[0, 0.02, -0.22]}>
          {[-0.12, 0.12].map((x, idx) => (
            <group key={x} position={[x, 0.04, -0.2]}>
              <mesh position={[0, 0, -0.25]} rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
                <cylinderGeometry args={[0.05, 0.058, 0.5, 12]} />
                <meshStandardMaterial color="#22262d" metalness={0.9} roughness={0.25} />
              </mesh>
              {[0, -0.08, -0.16].map((z) => (
                <mesh key={z} position={[0, 0, -0.2 + z]} rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
                  <torusGeometry args={[0.06, 0.008, 8, 14]} />
                  <meshStandardMaterial color="#191d24" metalness={0.8} roughness={0.3} />
                </mesh>
              ))}
              {/* 枪口闪光 */}
              {idx === 0 && (
                <mesh ref={leftFlash} position={[0, 0, -0.55]} visible={false}>
                  <octahedronGeometry args={[0.09, 0]} />
                  <meshBasicMaterial color="#ffd166" toneMapped={false} />
                </mesh>
              )}
              {idx === 1 && (
                <mesh ref={rightFlash} position={[0, 0, -0.55]} visible={false}>
                  <octahedronGeometry args={[0.09, 0]} />
                  <meshBasicMaterial color="#ffd166" toneMapped={false} />
                </mesh>
              )}
              <object3D ref={idx === 0 ? leftMuzzle : rightMuzzle} position={[0, 0, -0.52]} />
            </group>
          ))}
        </group>

        {/* 弹药箱 */}
        <mesh position={[0, -0.2, 0.25]} userData={{ kind: 'fx' }}>
          <boxGeometry args={[0.5, 0.28, 0.34]} />
          <meshStandardMaterial color="#2b2f38" metalness={0.6} roughness={0.5} />
        </mesh>
      </group>
    </group>
  )
}

function dampAngle(from: number, to: number, lambda: number, dt: number) {
  const diff = ((to - from + Math.PI * 3) % (Math.PI * 2)) - Math.PI
  return from + diff * (1 - Math.exp(-lambda * dt))
}
