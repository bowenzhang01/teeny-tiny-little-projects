import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { rangeStore } from '../state/rangeStore'
import { droneStore, type DroneAiState } from '../state/droneStore'
import { targetRegistry } from '../combat/targetRegistry'
import { spawnDroneMissile, spawnDroneRound } from '../combat/Projectiles'
import { playDeploy, playDry, playLmgShot, playRailShot } from '../audio/sfx'

/**
 * A 突击兵背载四足机器人（占位编号 Q-01）。
 *
 * 状态机：
 *   STOWED ──Q──▶ AUTO（巡逻+自动交战）
 *   AUTO   ──F──▶ REMOTE（全屏手控：相机接管 + WASD 移动 + 跳跃）
 *   REMOTE ──F──▶ AUTO
 *   任何状态 ──Q──▶ STOWED
 *
 * 扩展点：AUTO 的移动逻辑集中在 moveToward / aIStateRef ，
 * 未来换寻路/避障系统时只需替换这里，接口（droneStore + targetRegistry）不变。
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
  const legs = useRef<(THREE.Group | null)[]>([])

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
  const ROOM_BOUNDS = { minX: -4.4, maxX: 4.4, minZ: -12.4, maxZ: 2.2 }

  const isRemote = () => droneStore.getState().mode === 'remote'

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

  const enterRemote = () => {
    saveCamera()
    aiStateRef.current = 'REMOTE'
    droneStore.set({ mode: 'remote', aiState: 'REMOTE' })
  }

  const exitRemote = () => {
    restoreCamera()
    const lockedNow = document.pointerLockElement !== null
    rangeStore.set({ locked: lockedNow, lockedTargetId: lockedNow ? rangeStore.getState().lockedTargetId : null })
    droneStore.set({ mode: 'auto', aiState: aiStateRef.current })
  }

  const toggleDeploy = () => {
    const s = droneStore.getState()
    if (s.mode === 'stowed') {
      pos.current.set(1.4, 0, 1.4)
      yaw.current = 0
      droneStore.set({ mode: 'auto', aiState: 'PATROL' })
      playDeploy()
    } else {
      if (s.mode === 'remote') {
        restoreCamera()
        const lockedNow = document.pointerLockElement !== null
        rangeStore.set({ locked: lockedNow, lockedTargetId: lockedNow ? rangeStore.getState().lockedTargetId : null })
      }
      droneStore.set({ mode: 'stowed', mgFiring: false, aiState: 'HOLD' })
      playDeploy()
    }
  }

  const toggleMode = () => {
    const s = droneStore.getState()
    if (s.mode === 'auto') enterRemote()
    else if (s.mode === 'remote') exitRemote()
  }

  const getAimTarget = (out: THREE.Vector3, manual: boolean) => {
    const lock = rangeStore.getState().lockedTargetId
    const target = lock ? targetRegistry.get(lock) : null
    if (target && target.alive) {
      targetRegistry.aimWorld(target, out)
    } else if (manual) {
      camera.getWorldDirection(_dir.current)
      out.copy(camera.position).addScaledVector(_dir.current, 20)
    } else {
      camera.getWorldDirection(_dir.current)
      out.copy(camera.position).addScaledVector(_dir.current, 20)
    }
    return out
  }

  const fireMg = (manual: boolean) => {
    const origin = new THREE.Vector3()
    if (muzzle.current) muzzle.current.getWorldPosition(origin)
    const aim = getAimTarget(_aim.current, manual)
    const dir = aim.clone().sub(origin).normalize()
    spawnDroneRound(origin, dir)
    playLmgShot()
    mgHeat.current = Math.min(1, mgHeat.current + 0.012)
    const s = rangeStore.getState()
    rangeStore.set({ shots: s.shots + 1 })
  }

  const fireMissiles = () => {
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

    const state = droneStore.getState()
    const range = rangeStore.getState()
    const locks = range.lockedTargetId
    const fallback = getAimTarget(_tmp.current, isRemote())
    const left = new THREE.Vector3()
    const right = new THREE.Vector3()
    if (leftMsl.current) leftMsl.current.getWorldPosition(left)
    if (rightMsl.current) rightMsl.current.getWorldPosition(right)

    if (state.missileLeft > 0) {
      spawnDroneMissile({ origin: left, targetId: locks, fallbackPoint: fallback.clone(), seed: Math.random() * 1000 })
    }
    if (state.missileRight > 0) {
      spawnDroneMissile({ origin: right, targetId: locks, fallbackPoint: fallback.clone(), seed: Math.random() * 1000 })
    }
    if (state.missileLeft > 0 && state.missileRight > 0) playRailShot()

    droneStore.set({
      missileLeft: Math.max(0, state.missileLeft - 1),
      missileRight: Math.max(0, state.missileRight - 1),
      missileCooldownUntil: now + 6000,
    })
    rangeStore.set({ shots: rangeStore.getState().shots + 2 })
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const code = e.code
      if (code === 'KeyQ') {
        toggleDeploy()
      } else if (code === 'KeyF') {
        toggleMode()
      } else if (code === 'Digit1') {
        droneStore.set({ weapon: 'mg' })
      } else if (code === 'Digit2') {
        droneStore.set({ weapon: 'missile' })
      } else if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight', 'Space'].includes(code)) {
        keys.current.add(code)
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      keys.current.delete(e.code)
    }
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      const s = droneStore.getState()
      if (s.mode !== 'remote') return
      if (!document.pointerLockElement && gl.domElement.requestPointerLock) {
        gl.domElement.requestPointerLock()
      }
      mouseDown.current = true
      if (s.weapon === 'missile') fireMissiles()
    }
    const onMouseUp = (e: MouseEvent) => {
      if (e.button !== 0) return
      mouseDown.current = false
    }
    const onMouseMove = (e: MouseEvent) => {
      if (droneStore.getState().mode !== 'remote') return
      if (!document.pointerLockElement) return
      yaw.current -= e.movementX * 0.0021
      pitch.current = THREE.MathUtils.clamp(pitch.current - e.movementY * 0.0021, -1.15, 1.1)
    }
    const onContextMenu = (e: Event) => {
      if (rangeStore.getState().locked) e.preventDefault()
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('contextmenu', onContextMenu)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('contextmenu', onContextMenu)
      // 卸载（换人）时确保还原 A 视角并收起机器人
      restoreCamera()
      droneStore.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  const dampAngle = (from: number, to: number, lambda: number, dt: number) => {
    const diff = ((to - from + Math.PI * 3) % (Math.PI * 2)) - Math.PI
    return from + diff * (1 - Math.exp(-lambda * dt))
  }

  useFrame((state, dt) => {
    const s = droneStore.getState()
    const deployed = s.mode !== 'stowed'
    deployK.current = THREE.MathUtils.damp(deployK.current, deployed ? 1 : 0, 6, dt)
    const k = deployK.current

    if (root.current) {
      root.current.visible = k > 0.02 && s.mode !== 'remote'
      root.current.position.set(pos.current.x, jumpY.current, pos.current.z)
      const sc = 0.2 + k * 0.8
      root.current.scale.setScalar(sc)
    }

    const moving =
      (s.mode === 'auto' && aiStateRef.current !== 'HOLD' && aiStateRef.current !== 'SCAN') ||
      (s.mode === 'remote' && (keys.current.has('KeyW') || keys.current.has('KeyA') || keys.current.has('KeyS') || keys.current.has('KeyD')))
    const legPhase = state.clock.elapsedTime * (moving ? 9 : 0)
    legs.current.forEach((leg, i) => {
      if (!leg) return
      const target = moving ? Math.sin(legPhase + i * (Math.PI / 2)) * 0.5 : 0
      leg.rotation.x = THREE.MathUtils.damp(leg.rotation.x, target, 8, dt)
    })
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

      // WASD 相对镜头朝向移动
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

      // Space 四足小跳
      if (keys.current.has('Space') && jumpY.current <= 0.001) {
        jumpVel.current = 4.2
      }
      if (jumpY.current > 0 || jumpVel.current > 0) {
        jumpVel.current -= 12 * dt
        jumpY.current = Math.max(0, jumpY.current + jumpVel.current * dt)
      }

      // 机枪持续射击
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
          // 机枪自动射击
          mgFireTimer.current += dt
          if (mgFireTimer.current >= 0.13) {
            mgFireTimer.current = 0
            fireMg(false)
          }
          // 导弹自动齐射（冷却好且有余弹）
          if (performance.now() >= s.missileCooldownUntil && (s.missileLeft > 0 || s.missileRight > 0)) {
            fireMissiles()
          }
        }
      } else {
        // 目标倒下 / 无目标：巡逻
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
        turret.current.rotation.y = Math.atan2(local.x, local.z) * -1
      }
    }

    // ---- 低频率状态回写（HUD） ----
    const now = performance.now()
    if (now - lastHudWrite.current > 180) {
      lastHudWrite.current = now
      const cur = droneStore.getState()
      const movingNow =
        cur.mode === 'remote' &&
        (keys.current.has('KeyW') || keys.current.has('KeyA') || keys.current.has('KeyS') || keys.current.has('KeyD'))
      const autoSpeed = cur.mode === 'auto' ? (aiStateRef.current === 'MOVE_TO' ? 2 : aiStateRef.current === 'PATROL' ? 1.6 : 0) : 0
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

        {/* 背部武器塔 */}
        <group ref={turret} position={[0, 0.66, 0.02]}>
          <mesh castShadow userData={{ kind: 'solid' }}>
            <boxGeometry args={[0.26, 0.16, 0.34]} />
            <meshStandardMaterial color="#343a45" metalness={0.85} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.06, -0.26]} rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
            <cylinderGeometry args={[0.035, 0.04, 0.34, 12]} />
            <meshStandardMaterial color="#22262d" metalness={0.9} roughness={0.25} />
          </mesh>
          <mesh position={[0, 0.06, -0.44]} rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
            <cylinderGeometry args={[0.045, 0.045, 0.05, 12]} />
            <meshStandardMaterial color="#191d24" metalness={0.9} roughness={0.22} />
          </mesh>
          <object3D ref={muzzle} position={[0, 0.06, -0.46]} />
        </group>

        {/* 左右导弹舱 */}
        <group ref={leftPod} position={[-0.36, 0.48, 0.14]}>
          <mesh castShadow userData={{ kind: 'solid' }}>
            <boxGeometry args={[0.12, 0.12, 0.42]} />
            <meshStandardMaterial color="#2c323d" metalness={0.6} roughness={0.5} />
          </mesh>
          <object3D ref={leftMsl} position={[0, 0, -0.24]} />
        </group>
        <group ref={rightPod} position={[0.36, 0.48, 0.14]}>
          <mesh castShadow userData={{ kind: 'solid' }}>
            <boxGeometry args={[0.12, 0.12, 0.42]} />
            <meshStandardMaterial color="#2c323d" metalness={0.6} roughness={0.5} />
          </mesh>
          <object3D ref={rightMsl} position={[0, 0, -0.24]} />
        </group>

        {/* 四条腿（整体摆动动画） */}
        {legPos.map((p, i) => (
          <group
            key={i}
            position={p}
            ref={(el) => {
              legs.current[i] = el
            }}
          >
            <mesh position={[0, -0.16, 0]} castShadow userData={{ kind: 'solid' }}>
              <boxGeometry args={[0.09, 0.34, 0.1]} />
              <meshStandardMaterial color="#2a2e38" metalness={0.7} roughness={0.45} />
            </mesh>
            <mesh position={[0, -0.34, -0.02]} castShadow userData={{ kind: 'solid' }}>
              <boxGeometry args={[0.07, 0.32, 0.08]} />
              <meshStandardMaterial color="#333943" metalness={0.75} roughness={0.4} />
            </mesh>
            <mesh position={[0, -0.52, -0.04]} userData={{ kind: 'fx' }}>
              <boxGeometry args={[0.1, 0.04, 0.14]} />
              <meshStandardMaterial color="#22262d" metalness={0.6} roughness={0.5} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  )
}
