import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { rangeStore } from '../state/rangeStore'
import { droneStore, type DroneAiState } from '../state/droneStore'
import { targetRegistry } from '../combat/targetRegistry'
import { spawnDroneMissile, spawnDroneRound } from '../combat/Projectiles'
import { playDeploy, playDry, playLmgShot, playRailShot } from '../audio/sfx'
import { useKeyBinding } from '../input/useKeyBinding'
import { useInputReset } from '../input/useInputReset'
import { useMouseBinding } from '../input/useMouseBinding'

/**
 * A 突击兵背载四足机器人（占位编号 Q-01）。
 *
 * 状态机：
 *   STOWED ──Q──▶ AUTO（巡逻+自动交战）
 *   AUTO   ──F──▶ REMOTE（全屏手控）
 *   REMOTE ──F──▶ AUTO
 *   AUTO/REMOTE ──Q──▶ STOWING（走回 A 背后）──▶ STOWED
 *
 * 扩展点：AUTO 移动集中在 moveToward / aiStateRef，
 * 未来换寻路/避障系统只需替换这里，接口不变。
 */
export function QuadDrone() {
  const { camera, gl } = useThree()

  const root = useRef<THREE.Group>(null!)
  const body = useRef<THREE.Group>(null!)
  const head = useRef<THREE.Group>(null!)
  const turret = useRef<THREE.Group>(null!)
  const muzzle = useRef<THREE.Object3D>(null!)
  const leftMsl = useRef<THREE.Object3D>(null!)
  const rightMsl = useRef<THREE.Object3D>(null!)
  const leftPod = useRef<THREE.Group>(null!)
  const rightPod = useRef<THREE.Group>(null!)
  const upperLegs = useRef<(THREE.Group | null)[]>([])
  const lowerLegs = useRef<(THREE.Group | null)[]>([])

  // 运动学（高频，放在 ref）
  const pos = useRef(new THREE.Vector3(1.4, 0, 1.4))
  const yaw = useRef(0)
  const pitch = useRef(-0.05)
  const jumpY = useRef(0)
  const jumpVel = useRef(0)
  const deployK = useRef(0)
  const keys = useRef(new Set<string>())
  const mouseDown = useRef(false)
  const mgFireTimer = useRef(0)
  const mgHeat = useRef(0)
  const aiStateRef = useRef<DroneAiState>('HOLD')
  const waypointIndex = useRef(0)
  const scanTimer = useRef(0)
  const lastHudWrite = useRef(0)
  const lastBatteryWrite = useRef(0)
  const savedCamPos = useRef(new THREE.Vector3(0, 2.35, 0))
  const savedCamQuat = useRef(new THREE.Quaternion())
  const hasSavedCam = useRef(false)
  const _dir = useRef(new THREE.Vector3())
  const _aim = useRef(new THREE.Vector3())
  const _tmp = useRef(new THREE.Vector3())
  const _euler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'))

  const WAYPOINTS = [
    new THREE.Vector3(1.6, 0, 1.3),
    new THREE.Vector3(3.2, 0, -2.2),
    new THREE.Vector3(-0.6, 0, -5.4),
    new THREE.Vector3(-3.2, 0, -1.6),
  ]
  const BACK_SPOT = new THREE.Vector3(0, 0, 2.05)
  const ROOM_BOUNDS = { minX: -4.4, maxX: 4.4, minZ: -12.4, maxZ: 2.2 }

  const isRemote = () => droneStore.getState().mode === 'remote'

  /** 清空遥控时的所有按下状态（键集合 + 鼠标 + HUD firing 标志） */
  const clearHeldInput = () => {
    keys.current.clear()
    mouseDown.current = false
    const s = droneStore.getState()
    if (s.mgFiring) droneStore.set({ mgFiring: false })
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

  const syncLockAfterExit = () => {
    const lockedNow = document.pointerLockElement !== null
    rangeStore.set({ locked: lockedNow, lockedTargetId: lockedNow ? rangeStore.getState().lockedTargetId : null })
  }

  const enterRemote = () => {
    clearHeldInput()
    saveCamera()
    aiStateRef.current = 'REMOTE'
    droneStore.set({ mode: 'remote', aiState: 'REMOTE' })
    rangeStore.set({ weaponBusyUntil: performance.now() + 300 })
  }

  const exitRemote = () => {
    clearHeldInput()
    restoreCamera()
    syncLockAfterExit()
    droneStore.set({ mode: 'auto', aiState: aiStateRef.current })
    rangeStore.set({ weaponBusyUntil: performance.now() + 300 })
  }

  const beginStow = () => {
    clearHeldInput()
    if (droneStore.getState().mode === 'remote') {
      restoreCamera()
      syncLockAfterExit()
    }
    aiStateRef.current = 'STOWING'
    droneStore.set({ mode: 'stowing', mgFiring: false, aiState: 'STOWING' })
    rangeStore.set({ weaponBusyUntil: performance.now() + 400 })
    playDeploy()
  }

  const toggleDeploy = () => {
    const s = droneStore.getState()
    if (s.mode === 'stowed' || s.mode === 'stowing') {
      if (s.mode === 'stowed') {
        pos.current.set(1.4, 0, 1.4)
        yaw.current = 0
        aiStateRef.current = 'PATROL'
        droneStore.set({ mode: 'auto', aiState: 'PATROL' })
        rangeStore.set({ weaponBusyUntil: performance.now() + 400 })
        playDeploy()
      }
    } else {
      beginStow()
    }
  }

  const toggleMode = () => {
    const s = droneStore.getState()
    if (s.mode === 'auto') enterRemote()
    else if (s.mode === 'remote') exitRemote()
  }

  const getAimPoint = (out: THREE.Vector3, targetId: string | null, manual: boolean) => {
    const id = targetId ?? (manual ? rangeStore.getState().lockedTargetId : null)
    const target = id ? targetRegistry.get(id) : null
    if (target && target.alive) {
      targetRegistry.aimWorld(target, out)
    } else if (manual) {
      camera.getWorldDirection(_dir.current)
      out.copy(camera.position).addScaledVector(_dir.current, 20)
    } else {
      // AUTO 无目标时朝机器人自身前方
      out.set(
        pos.current.x - Math.sin(yaw.current) * 12,
        1.2,
        pos.current.z - Math.cos(yaw.current) * 12,
      )
    }
    return out
  }

  const fireMg = (manual: boolean, targetId: string | null = null) => {
    const origin = new THREE.Vector3()
    if (muzzle.current) muzzle.current.getWorldPosition(origin)
    const aim = getAimPoint(_aim.current, targetId, manual)
    const dir = aim.clone().sub(origin).normalize()
    spawnDroneRound(origin, dir)
    playLmgShot()
    mgHeat.current = Math.min(1, mgHeat.current + 0.012)
    const s = rangeStore.getState()
    rangeStore.set({ shots: s.shots + 1 })
  }

  const fireMissiles = (targetId: string | null = null) => {
    const s = droneStore.getState()
    const now = performance.now()
    if (now < s.missileCooldownUntil) {
      playDry()
      return
    }
    if (s.missileLeft <= 0 && s.missileRight <= 0) {
      playDry()
      rangeStore.set({ message: '机器人导弹耗尽', messageId: rangeStore.getState().messageId + 1 })
      return
    }

    const fallback = getAimPoint(_tmp.current, targetId, isRemote())
    const left = new THREE.Vector3()
    const right = new THREE.Vector3()
    if (leftMsl.current) leftMsl.current.getWorldPosition(left)
    if (rightMsl.current) rightMsl.current.getWorldPosition(right)

    if (s.missileLeft > 0) {
      spawnDroneMissile({ origin: left, targetId, fallbackPoint: fallback.clone(), seed: Math.random() * 1000 })
    }
    if (s.missileRight > 0) {
      spawnDroneMissile({ origin: right, targetId, fallbackPoint: fallback.clone(), seed: Math.random() * 1000 })
    }
    if (s.missileLeft > 0 && s.missileRight > 0) playRailShot()

    droneStore.set({
      missileLeft: Math.max(0, s.missileLeft - 1),
      missileRight: Math.max(0, s.missileRight - 1),
      missileCooldownUntil: now + 6000,
    })
    rangeStore.set({ shots: rangeStore.getState().shots + 2 })
  }

  // P1：统一按键分发（动作 id → inputMap 键位 → 上下文过滤）
  useInputReset(() => {
    clearHeldInput()
  })

  useKeyBinding('deployDrone', { onDown: () => toggleDeploy() })
  useKeyBinding('toggleDroneMode', { onDown: () => toggleMode() })
  useKeyBinding('droneWeaponMg', {
    contexts: ['droneRemote'],
    onDown: () => droneStore.set({ weapon: 'mg' }),
  })
  useKeyBinding('droneWeaponMissile', {
    contexts: ['droneRemote'],
    onDown: () => droneStore.set({ weapon: 'missile' }),
  })
  useKeyBinding('moveForward', {
    contexts: ['droneRemote'],
    onDown: () => keys.current.add('KeyW'),
    onUp: () => keys.current.delete('KeyW'),
  })
  useKeyBinding('moveBackward', {
    contexts: ['droneRemote'],
    onDown: () => keys.current.add('KeyS'),
    onUp: () => keys.current.delete('KeyS'),
  })
  useKeyBinding('moveLeft', {
    contexts: ['droneRemote'],
    onDown: () => keys.current.add('KeyA'),
    onUp: () => keys.current.delete('KeyA'),
  })
  useKeyBinding('moveRight', {
    contexts: ['droneRemote'],
    onDown: () => keys.current.add('KeyD'),
    onUp: () => keys.current.delete('KeyD'),
  })
  useKeyBinding('jump', {
    contexts: ['droneRemote'],
    onDown: () => keys.current.add('Space'),
    onUp: () => keys.current.delete('Space'),
  })
  useKeyBinding('sprint', {
    contexts: ['droneRemote'],
    onDown: (e) => keys.current.add(e.code),
    onUp: (e) => keys.current.delete(e.code),
  })

  // P1：统一鼠标分发（遥控时左键开火/切枪发射导弹）
  useMouseBinding('fire', {
    contexts: ['droneRemote'],
    onDown: () => {
      const s = droneStore.getState()
      if (s.mode !== 'remote') return
      if (!document.pointerLockElement && gl.domElement.requestPointerLock) {
        gl.domElement.requestPointerLock()
      }
      mouseDown.current = true
      if (s.weapon === 'missile') fireMissiles()
    },
    onUp: () => {
      mouseDown.current = false
    },
  })

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (droneStore.getState().mode !== 'remote') return
      if (!document.pointerLockElement) return
      yaw.current -= e.movementX * 0.0021
      pitch.current = THREE.MathUtils.clamp(pitch.current - e.movementY * 0.0021, -1.15, 1.1)
    }
    const onContextMenu = (e: Event) => {
      if (rangeStore.getState().locked) e.preventDefault()
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('contextmenu', onContextMenu)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('contextmenu', onContextMenu)
      // 卸载（换人）时确保还原 A 视角并收起机器人
      restoreCamera()
      droneStore.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const dampAngle = (from: number, to: number, lambda: number, dt: number) => {
    const diff = ((to - from + Math.PI * 3) % (Math.PI * 2)) - Math.PI
    return from + diff * (1 - Math.exp(-lambda * dt))
  }

  const moveToward = (target: THREE.Vector3, speed: number, dt: number) => {
    const dx = target.x - pos.current.x
    const dz = target.z - pos.current.z
    const len = Math.hypot(dx, dz)
    if (len < 0.001) return
    const nx = dx / len
    const nz = dz / len
    const step = Math.min(speed * dt, len)
    pos.current.x += nx * step
    pos.current.z += nz * step
    const targetYaw = Math.atan2(-nx, -nz)
    yaw.current = dampAngle(yaw.current, targetYaw, 5, dt)
  }

  const nearestTargetId = (): string | null => {
    let best: string | null = null
    let bestDist = Infinity
    for (const t of targetRegistry.alive()) {
      const p = targetRegistry.aimWorld(t, _tmp.current)
      const d = Math.hypot(p.x - pos.current.x, p.z - pos.current.z)
      if (d < bestDist) {
        bestDist = d
        best = t.id
      }
    }
    return best
  }

  useFrame((state, dt) => {
    const s = droneStore.getState()
    const now = performance.now()
    const deployed = s.mode !== 'stowed'
    deployK.current = THREE.MathUtils.damp(deployK.current, deployed ? 1 : 0, 6, dt)
    const k = deployK.current

    if (root.current) {
      root.current.visible = k > 0.02 && s.mode !== 'remote'
      root.current.position.set(pos.current.x, jumpY.current, pos.current.z)
      const sc = 0.2 + k * 0.8
      root.current.scale.setScalar(sc)
    }

    // 导弹冷却结束后自动补满（避免“一直弹药不足”）
    if (deployed && now >= s.missileCooldownUntil && (s.missileLeft < s.missileCapacity || s.missileRight < s.missileCapacity)) {
      droneStore.set({ missileLeft: s.missileCapacity, missileRight: s.missileCapacity })
    }

    const moving =
      s.mode === 'stowing' ||
      (s.mode === 'auto' && (aiStateRef.current === 'PATROL' || aiStateRef.current === 'MOVE_TO')) ||
      (s.mode === 'remote' && (keys.current.has('KeyW') || keys.current.has('KeyA') || keys.current.has('KeyS') || keys.current.has('KeyD')))
    const legPhase = state.clock.elapsedTime * (moving ? 9 : 0)
    for (let i = 0; i < 4; i++) {
      const upper = upperLegs.current[i]
      const lower = lowerLegs.current[i]
      if (upper) {
        const target = moving ? Math.sin(legPhase + i * (Math.PI / 2)) * 0.5 : 0
        upper.rotation.x = THREE.MathUtils.damp(upper.rotation.x, target, 8, dt)
      }
      if (lower) {
        const target = moving ? Math.sin(legPhase + i * (Math.PI / 2) + 0.9) * 0.38 : -0.06
        lower.rotation.x = THREE.MathUtils.damp(lower.rotation.x, target, 8, dt)
      }
    }
    if (body.current) {
      const bob = moving ? Math.abs(Math.sin(legPhase)) * 0.035 : 0
      body.current.position.y = THREE.MathUtils.damp(body.current.position.y, bob, 8, dt)
    }

    // ---- REMOTE：全屏手控 ----
    if (s.mode === 'remote' && head.current) {
      const headPos = _tmp.current
      head.current.getWorldPosition(headPos)
      camera.position.copy(headPos)
      _euler.current.set(pitch.current, yaw.current, 0)
      camera.quaternion.setFromEuler(_euler.current)
      camera.updateMatrixWorld()

      const speed = keys.current.has('ShiftLeft') || keys.current.has('ShiftRight') ? 3.6 : 2.3
      const f = keys.current.has('KeyW') ? 1 : keys.current.has('KeyS') ? -1 : 0
      const r = keys.current.has('KeyD') ? 1 : keys.current.has('KeyA') ? -1 : 0
      const sin = Math.sin(yaw.current)
      const cos = Math.cos(yaw.current)
      if (f !== 0 || r !== 0) {
        pos.current.x += (-sin * f + cos * r) * speed * dt
        pos.current.z += (-cos * f - sin * r) * speed * dt
        pos.current.x = THREE.MathUtils.clamp(pos.current.x, ROOM_BOUNDS.minX, ROOM_BOUNDS.maxX)
        pos.current.z = THREE.MathUtils.clamp(pos.current.z, ROOM_BOUNDS.minZ, ROOM_BOUNDS.maxZ)
      }

      if (keys.current.has('Space') && jumpY.current <= 0.001) {
        jumpVel.current = 4.2
      }
      if (jumpY.current > 0 || jumpVel.current > 0) {
        jumpVel.current -= 12 * dt
        jumpY.current = Math.max(0, jumpY.current + jumpVel.current * dt)
      }

      if (mouseDown.current && s.weapon === 'mg') {
        mgFireTimer.current += dt
        if (mgFireTimer.current >= 0.09) {
          mgFireTimer.current = 0
          fireMg(true)
        }
      }
    }

    // ---- AUTO：巡逻 + 交战 ----
    if (s.mode === 'auto') {
      const targetId = nearestTargetId()
      const target = targetId ? targetRegistry.get(targetId) : null

      if (target && target.alive && !targetRegistry.isDown(target.id)) {
        const aim = targetRegistry.aimWorld(target, _tmp.current)
        const dx = aim.x - pos.current.x
        const dz = aim.z - pos.current.z
        const dist = Math.hypot(dx, dz)

        if (dist > 7) {
          aiStateRef.current = 'MOVE_TO'
          moveToward(aim, 2.0, dt)
        } else {
          aiStateRef.current = 'ENGAGE'
          const targetYaw = Math.atan2(-dx, -dz)
          yaw.current = dampAngle(yaw.current, targetYaw, 6, dt)
          mgFireTimer.current += dt
          if (mgFireTimer.current >= 0.13) {
            mgFireTimer.current = 0
            fireMg(false, target.id)
          }
          if (performance.now() >= s.missileCooldownUntil && (s.missileLeft > 0 || s.missileRight > 0)) {
            fireMissiles(target.id)
          }
        }
      } else {
        const wp = WAYPOINTS[waypointIndex.current]
        const d = Math.hypot(wp.x - pos.current.x, wp.z - pos.current.z)
        if (d < 0.45) {
          aiStateRef.current = 'SCAN'
          scanTimer.current += dt
          if (scanTimer.current > 1.2) {
            scanTimer.current = 0
            waypointIndex.current = (waypointIndex.current + 1) % WAYPOINTS.length
            aiStateRef.current = 'PATROL'
          }
        } else {
          aiStateRef.current = 'PATROL'
          moveToward(wp, 1.6, dt)
        }
      }

      if (body.current) body.current.rotation.y = yaw.current
      if (turret.current && target && target.alive) {
        const aim = targetRegistry.aimWorld(target, _tmp.current)
        const local = body.current!.worldToLocal(aim.clone())
        turret.current.rotation.y = Math.atan2(-local.x, -local.z)
      }
    }

    // ---- STOWING：走回 A 背后再回收 ----
    if (s.mode === 'stowing') {
      aiStateRef.current = 'STOWING'
      moveToward(BACK_SPOT, 1.8, dt)
      if (body.current) body.current.rotation.y = yaw.current
      const d = Math.hypot(BACK_SPOT.x - pos.current.x, BACK_SPOT.z - pos.current.z)
      if (d < 0.35) {
        droneStore.set({ mode: 'stowed', mgFiring: false, aiState: 'HOLD' })
      }
    }

    // ---- 低频率状态回写（HUD） ----
    if (now - lastHudWrite.current > 180) {
      lastHudWrite.current = now
      const cur = droneStore.getState()
      const movingNow =
        cur.mode === 'remote' &&
        (keys.current.has('KeyW') || keys.current.has('KeyA') || keys.current.has('KeyS') || keys.current.has('KeyD'))
      const autoSpeed = cur.mode === 'auto' ? (aiStateRef.current === 'MOVE_TO' ? 2 : aiStateRef.current === 'PATROL' ? 1.6 : 0) : cur.mode === 'stowing' ? 1.8 : 0
      droneStore.set({
        speed: movingNow ? 2.3 : autoSpeed,
        mgHeat: mgHeat.current,
        mgFiring: mouseDown.current,
        sensorMark: nearestTargetId(),
        aiState: aiStateRef.current,
      })
      mgHeat.current = Math.max(0, mgHeat.current - 0.008)
    }
    if (now - lastBatteryWrite.current > 2000) {
      lastBatteryWrite.current = now
      const cur = droneStore.getState()
      if (cur.mode !== 'stowed') {
        const drain = cur.mode === 'remote' ? 0.5 : 0.2
        droneStore.set({ battery: Math.max(0, cur.battery - drain), link: Math.min(99.9, cur.link + (Math.random() - 0.5) * 0.6) })
      }
    }
  })

  const legPos: [number, number, number][] = [
    [-0.26, 0.52, -0.32],
    [0.26, 0.52, -0.32],
    [-0.26, 0.52, 0.32],
    [0.26, 0.52, 0.32],
  ]

  return (
    <group ref={root} visible={false} name="quad-drone">
      <group ref={body}>
        {/* 躯干 */}
        <mesh position={[0, 0.42, 0]} castShadow userData={{ kind: 'solid' }}>
          <boxGeometry args={[0.52, 0.26, 0.92]} />
          <meshStandardMaterial color="#3a404c" metalness={0.8} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0.55, 0.02]} userData={{ kind: 'fx' }}>
          <boxGeometry args={[0.34, 0.1, 0.5]} />
          <meshStandardMaterial color="#2c323d" metalness={0.7} roughness={0.42} />
        </mesh>
        {/* 红色识别条 */}
        <mesh position={[0, 0.5, -0.47]} userData={{ kind: 'fx' }}>
          <boxGeometry args={[0.3, 0.03, 0.01]} />
          <meshBasicMaterial color="#ff5f5f" toneMapped={false} />
        </mesh>

        {/* 头部传感器塔 */}
        <group ref={head} position={[0, 0.62, -0.5]}>
          <mesh castShadow userData={{ kind: 'solid' }}>
            <boxGeometry args={[0.16, 0.14, 0.2]} />
            <meshStandardMaterial color="#262b34" metalness={0.75} roughness={0.35} />
          </mesh>
          <mesh position={[0, 0.01, -0.11]} userData={{ kind: 'fx' }}>
            <cylinderGeometry args={[0.05, 0.06, 0.06, 12]} />
            <meshBasicMaterial color="#ff5f5f" toneMapped={false} />
          </mesh>
        </group>

        {/* 背部武器塔（枪口朝 -Z = 机器人正前方） */}
        <group ref={turret} position={[0, 0.66, 0.02]}>
          {/* 底座/后机匣 */}
          <mesh castShadow userData={{ kind: 'solid' }}>
            <boxGeometry args={[0.3, 0.2, 0.42]} />
            <meshStandardMaterial color="#343a45" metalness={0.85} roughness={0.3} />
          </mesh>
          {/* 枪管护套 */}
          <mesh position={[0, 0.06, -0.3]} rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
            <cylinderGeometry args={[0.05, 0.055, 0.5, 12]} />
            <meshStandardMaterial color="#22262d" metalness={0.9} roughness={0.25} />
          </mesh>
          {/* 散热环 */}
          {[-0.2, -0.28, -0.36].map((z) => (
            <mesh key={z} position={[0, 0.06, z]} rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
              <cylinderGeometry args={[0.065, 0.065, 0.02, 12]} />
              <meshStandardMaterial color="#191d24" metalness={0.85} roughness={0.3} />
            </mesh>
          ))}
          {/* 枪口制退器 */}
          <mesh position={[0, 0.06, -0.57]} rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
            <cylinderGeometry args={[0.07, 0.055, 0.1, 12]} />
            <meshStandardMaterial color="#191d24" metalness={0.9} roughness={0.22} />
          </mesh>
          {/* 红色能量条（枪管上方） */}
          <mesh position={[0, 0.115, -0.3]} userData={{ kind: 'fx' }}>
            <boxGeometry args={[0.012, 0.01, 0.42]} />
            <meshBasicMaterial color="#ff5f5f" toneMapped={false} />
          </mesh>
          <mesh position={[0, 0.06, -0.65]} rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
            <cylinderGeometry args={[0.028, 0.028, 0.04, 10]} />
            <meshBasicMaterial color="#ffa94d" toneMapped={false} />
          </mesh>
          <object3D ref={muzzle} position={[0, 0.06, -0.68]} />
        </group>

        {/* 左右导弹舱（明显可见：舱体 + 双管 + 红色弹头） */}
        <group ref={leftPod} position={[-0.42, 0.5, 0.08]}>
          <mesh castShadow userData={{ kind: 'solid' }}>
            <boxGeometry args={[0.2, 0.2, 0.52]} />
            <meshStandardMaterial color="#2c323d" metalness={0.6} roughness={0.5} />
          </mesh>
          {[0.055, -0.055].map((y) => (
            <mesh key={y} position={[0, y, -0.22]} rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
              <cylinderGeometry args={[0.035, 0.04, 0.42, 10]} />
              <meshStandardMaterial color="#22262d" metalness={0.85} roughness={0.3} />
            </mesh>
          ))}
          <mesh position={[0, 0.055, -0.43]} userData={{ kind: 'fx' }}>
            <coneGeometry args={[0.035, 0.08, 10]} />
            <meshBasicMaterial color="#ff5f5f" toneMapped={false} />
          </mesh>
          <mesh position={[0, -0.055, -0.43]} userData={{ kind: 'fx' }}>
            <coneGeometry args={[0.035, 0.08, 10]} />
            <meshBasicMaterial color="#ffa94d" toneMapped={false} />
          </mesh>
          <object3D ref={leftMsl} position={[0, 0, -0.28]} />
        </group>
        <group ref={rightPod} position={[0.42, 0.5, 0.08]}>
          <mesh castShadow userData={{ kind: 'solid' }}>
            <boxGeometry args={[0.2, 0.2, 0.52]} />
            <meshStandardMaterial color="#2c323d" metalness={0.6} roughness={0.5} />
          </mesh>
          {[0.055, -0.055].map((y) => (
            <mesh key={y} position={[0, y, -0.22]} rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
              <cylinderGeometry args={[0.035, 0.04, 0.42, 10]} />
              <meshStandardMaterial color="#22262d" metalness={0.85} roughness={0.3} />
            </mesh>
          ))}
          <mesh position={[0, 0.055, -0.43]} userData={{ kind: 'fx' }}>
            <coneGeometry args={[0.035, 0.08, 10]} />
            <meshBasicMaterial color="#ffa94d" toneMapped={false} />
          </mesh>
          <mesh position={[0, -0.055, -0.43]} userData={{ kind: 'fx' }}>
            <coneGeometry args={[0.035, 0.08, 10]} />
            <meshBasicMaterial color="#ff5f5f" toneMapped={false} />
          </mesh>
          <object3D ref={rightMsl} position={[0, 0, -0.28]} />
        </group>

        {/* 四条两段式腿（大腿摆动 + 小腿回勾） */}
        {legPos.map((p, i) => (
          <group
            key={i}
            position={p}
            ref={(el) => {
              upperLegs.current[i] = el
            }}
          >
            <mesh position={[0, -0.16, 0]} castShadow userData={{ kind: 'solid' }}>
              <boxGeometry args={[0.09, 0.34, 0.1]} />
              <meshStandardMaterial color="#2a2e38" metalness={0.7} roughness={0.45} />
            </mesh>
            <group
              position={[0, -0.34, 0]}
              ref={(el) => {
                lowerLegs.current[i] = el
              }}
            >
              <mesh position={[0, -0.16, -0.02]} castShadow userData={{ kind: 'solid' }}>
                <boxGeometry args={[0.07, 0.32, 0.08]} />
                <meshStandardMaterial color="#333943" metalness={0.75} roughness={0.4} />
              </mesh>
              <mesh position={[0, -0.32, -0.04]} userData={{ kind: 'fx' }}>
                <boxGeometry args={[0.1, 0.05, 0.14]} />
                <meshStandardMaterial color="#22262d" metalness={0.6} roughness={0.5} />
              </mesh>
            </group>
          </group>
        ))}
      </group>
    </group>
  )
}
