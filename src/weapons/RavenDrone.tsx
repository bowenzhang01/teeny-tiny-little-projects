import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { rangeStore } from '../state/rangeStore'
import { commsStore, type RavenAiState } from '../state/commsStore'
import { targetRegistry } from '../combat/targetRegistry'
import { spawnDroneMissile, spawnDroneRound } from '../combat/Projectiles'
import { playDeploy, playDry, playLmgShot, playRailShot } from '../audio/sfx'
import { useKeyBinding } from '../input/useKeyBinding'
import { useInputReset } from '../input/useInputReset'
import { useMouseBinding } from '../input/useMouseBinding'
import { triggerInputReset } from '../input/inputReset'

/**
 * E 通信兵特殊系统：RAVEN-05 大型多用途无人机。
 *
 * 状态机（与 A 机器人的区别：空中平台 + 工作模式循环，不做全屏遥控行走）：
 *   STOWED ──Q──▶ RELAY（通信中继·悬停）
 *   RELAY  ──F──▶ SWEEP（侦察扫描·绕场巡航）
 *   SWEEP  ──F──▶ STRIKE（协同交战）
 *   STRIKE ──F──▶ RELAY
 *   任意状态 ──Q──▶ STOWING ──▶ STOWED
 *
 * V 进入「链路视角」：相机移到无人机头部，观瞄 + 开火，并可用
 * WASD 飞行 / Space 上升 / Ctrl 下降；1/2 切换 MG / 微型导弹。
 */
export function RavenDrone() {
  const { camera, gl } = useThree()
  const root = useRef<THREE.Group>(null!)
  const body = useRef<THREE.Group>(null!)
  const turret = useRef<THREE.Group>(null!)
  const muzzle = useRef<THREE.Object3D>(null!)
  const leftMsl = useRef<THREE.Object3D>(null!)
  const rightMsl = useRef<THREE.Object3D>(null!)
  const flash = useRef<THREE.Mesh>(null!)

  const pos = useRef(new THREE.Vector3(1.2, 2.6, 1.2))
  const yaw = useRef(0)
  const pitch = useRef(-0.05)
  const deployK = useRef(0)
  const keys = useRef(new Set<string>())
  const mouseDown = useRef(false)
  const mgFireTimer = useRef(0)
  const mgHeat = useRef(0)
  const lastHudWrite = useRef(0)
  const lastSensorAt = useRef(0)
  const waypointIndex = useRef(0)
  const savedCamPos = useRef(new THREE.Vector3(0, 2.35, 0))
  const savedCamQuat = useRef(new THREE.Quaternion())
  const hasSavedCam = useRef(false)
  const _dir = useRef(new THREE.Vector3())
  const _right = useRef(new THREE.Vector3())
  const _up = useRef(new THREE.Vector3())
  const _aim = useRef(new THREE.Vector3())
  const _tmp = useRef(new THREE.Vector3())
  const _euler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'))

  const ROOM_BOUNDS = { minX: -4.4, maxX: 4.4, minY: 1.4, maxY: 4.2, minZ: -12.4, maxZ: 2.2 }

  const WAYPOINTS = [
    new THREE.Vector3(1.8, 2.5, 0.8),
    new THREE.Vector3(3.2, 2.9, -2.4),
    new THREE.Vector3(0, 3.1, -6.2),
    new THREE.Vector3(-3.2, 2.7, -2.0),
    new THREE.Vector3(-1.6, 2.4, 1.2),
  ]

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

  const syncLockAfterExit = () => {
    const lockedNow = document.pointerLockElement !== null
    rangeStore.set({ locked: lockedNow, lockedTargetId: lockedNow ? rangeStore.getState().lockedTargetId : null })
  }

  const exitLinkView = () => {
    const d = commsStore.getState().drone
    if (!d.linkView) return
    mouseDown.current = false
    keys.current.clear()
    restoreCamera()
    syncLockAfterExit()
    const mode = d.mode
    commsStore.setDrone({ linkView: false, aiState: mode.toUpperCase() as RavenAiState, mgFiring: false })
    triggerInputReset('context')
    rangeStore.set({ weaponBusyUntil: performance.now() + 300 })
    message('退出链路 · LINK VIEW OFF')
  }

  const enterLinkView = () => {
    const d = commsStore.getState().drone
    if (d.mode === 'stowed' || d.mode === 'stowing') {
      playDry()
      message('RAVEN 未部署 · 先按 Q')
      return
    }
    saveCamera()
    yaw.current = 0
    pitch.current = -0.05
    mouseDown.current = false
    keys.current.clear()
    commsStore.setDrone({ linkView: true, aiState: 'LINK' })
    triggerInputReset('context')
    rangeStore.set({ weaponBusyUntil: performance.now() + 300 })
    message('链路视角开启 · RAVEN LINK')
  }

  const toggleLinkView = () => {
    if (commsStore.getState().drone.linkView) exitLinkView()
    else enterLinkView()
  }

  const toggleDrone = () => {
    const d = commsStore.getState().drone
    if (d.mode === 'stowed' || d.mode === 'stowing') {
      if (d.mode === 'stowed') {
        pos.current.set(1.2, 2.6, 1.2)
        yaw.current = 0
        commsStore.setDrone({ mode: 'relay', aiState: 'RELAY', transitionUntil: performance.now() + 400 })
        playDeploy()
        message('RAVEN 部署 · RELAY LINK')
      }
      return
    }
    if (d.linkView) exitLinkView()
    commsStore.setDrone({ mode: 'stowing', aiState: 'STOWING', linkView: false, mgFiring: false })
    playDeploy()
    message('RAVEN 回收中…')
  }

  const cycleMode = () => {
    const d = commsStore.getState().drone
    if (d.mode === 'stowed' || d.mode === 'stowing') {
      playDry()
      message('RAVEN 未部署 · 先按 Q')
      return
    }
    const next = commsStore.cycleRavenMode()
    playDeploy()
    message(`RAVEN 模式 · ${next.toUpperCase()}`)
  }

  const getAimPoint = (out: THREE.Vector3, manual: boolean, targetId: string | null = null) => {
    const target = targetId ? targetRegistry.get(targetId) : null
    if (target && target.alive) {
      targetRegistry.aimWorld(target, out)
    } else if (manual) {
      camera.getWorldDirection(_dir.current)
      out.copy(camera.position).addScaledVector(_dir.current, 24)
    } else {
      out.set(pos.current.x - Math.sin(yaw.current) * 14, 1.2, pos.current.z - Math.cos(yaw.current) * 14)
    }
    return out
  }

  const fireMg = (manual: boolean, targetId: string | null = null) => {
    const origin = new THREE.Vector3()
    if (muzzle.current) muzzle.current.getWorldPosition(origin)
    const aim = getAimPoint(_aim.current, manual, targetId)
    const dir = aim.clone().sub(origin).normalize()
    spawnDroneRound(origin, dir)
    playLmgShot()
    mgHeat.current = Math.min(1, mgHeat.current + 0.012)
    const s = rangeStore.getState()
    rangeStore.set({ shots: s.shots + 1 })
    if (flash.current) flash.current.scale.setScalar(0.7 + Math.random() * 0.5)
  }

  const fireMissiles = (targetId: string | null = null) => {
    const s = commsStore.getState().drone
    const now = performance.now()
    if (now < s.missileCooldownUntil) {
      playDry()
      return
    }
    if (s.missileLeft <= 0 && s.missileRight <= 0) {
      playDry()
      message('RAVEN 导弹耗尽 · 冷却补满')
      return
    }
    const missileTarget = targetId ?? rangeStore.getState().lockedTargetId
    const fallback = getAimPoint(_tmp.current, s.linkView, missileTarget)
    const left = new THREE.Vector3()
    const right = new THREE.Vector3()
    if (leftMsl.current) leftMsl.current.getWorldPosition(left)
    if (rightMsl.current) rightMsl.current.getWorldPosition(right)
    if (s.missileLeft > 0) {
      spawnDroneMissile({ origin: left, targetId: missileTarget, fallbackPoint: fallback.clone(), seed: Math.random() * 1000 })
    }
    if (s.missileRight > 0) {
      spawnDroneMissile({ origin: right, targetId: missileTarget, fallbackPoint: fallback.clone(), seed: Math.random() * 1000 })
    }
    playRailShot()
    commsStore.setDrone({
      missileLeft: Math.max(0, s.missileLeft - 1),
      missileRight: Math.max(0, s.missileRight - 1),
      missileCooldownUntil: now + 6000,
    })
    rangeStore.set({ shots: rangeStore.getState().shots + 2 })
  }

  useKeyBinding('commsDroneToggle', {
    contexts: ['roleHud', 'linkRemote'],
    onDown: (e) => {
      if (e.repeat) return
      toggleDrone()
    },
  })
  useKeyBinding('commsDroneMode', {
    contexts: ['roleHud', 'linkRemote'],
    onDown: (e) => {
      if (e.repeat) return
      cycleMode()
    },
  })
  useKeyBinding('commsLinkView', {
    contexts: ['roleHud', 'linkRemote'],
    onDown: (e) => {
      if (e.repeat) return
      toggleLinkView()
    },
  })
  useKeyBinding('commsDroneMg', {
    contexts: ['linkRemote'],
    onDown: (e) => {
      if (e.repeat) return
      commsStore.setDrone({ weapon: 'mg' })
    },
  })
  useKeyBinding('commsDroneMissile', {
    contexts: ['linkRemote'],
    onDown: (e) => {
      if (e.repeat) return
      commsStore.setDrone({ weapon: 'missile' })
    },
  })

  // 链路视角：WASD 飞行 / Space 上升 / Ctrl 下降
  useKeyBinding('moveForward', {
    contexts: ['linkRemote'],
    onDown: () => keys.current.add('KeyW'),
    onUp: () => keys.current.delete('KeyW'),
  })
  useKeyBinding('moveBackward', {
    contexts: ['linkRemote'],
    onDown: () => keys.current.add('KeyS'),
    onUp: () => keys.current.delete('KeyS'),
  })
  useKeyBinding('moveLeft', {
    contexts: ['linkRemote'],
    onDown: () => keys.current.add('KeyA'),
    onUp: () => keys.current.delete('KeyA'),
  })
  useKeyBinding('moveRight', {
    contexts: ['linkRemote'],
    onDown: () => keys.current.add('KeyD'),
    onUp: () => keys.current.delete('KeyD'),
  })
  useKeyBinding('droneUp', {
    contexts: ['linkRemote'],
    onDown: () => keys.current.add('Space'),
    onUp: () => keys.current.delete('Space'),
  })
  useKeyBinding('droneDown', {
    contexts: ['linkRemote'],
    onDown: (e) => keys.current.add(e.code),
    onUp: (e) => keys.current.delete(e.code),
  })

  useInputReset(() => {
    mouseDown.current = false
    keys.current.clear()
    commsStore.setDrone({ mgFiring: false })
  })

  useMouseBinding('fire', {
    contexts: ['linkRemote'],
    onDown: () => {
      const d = commsStore.getState().drone
      if (!d.linkView || d.mode === 'stowed') return
      if (!document.pointerLockElement && gl.domElement.requestPointerLock) {
        gl.domElement.requestPointerLock()
      }
      mouseDown.current = true
      if (d.weapon === 'missile') fireMissiles()
    },
    onUp: () => {
      mouseDown.current = false
    },
  })

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const d = commsStore.getState().drone
      if (!d.linkView) return
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
      restoreCamera()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const nearestTargetId = (): string | null => {
    let best: string | null = null
    let bestDist = Infinity
    for (const t of targetRegistry.alive()) {
      const p = targetRegistry.aimWorld(t, _tmp.current)
      const d = p.distanceTo(pos.current)
      if (d < bestDist) {
        bestDist = d
        best = t.id
      }
    }
    return best
  }

  useFrame((state, dt) => {
    const st = commsStore.getState().drone
    const now = performance.now()
    const deployed = st.mode !== 'stowed'

    // 展开/收回过渡
    deployK.current = THREE.MathUtils.damp(deployK.current, st.mode === 'stowed' ? 0 : 1, 6, dt)
    const k = deployK.current
    if (root.current) {
      root.current.position.copy(pos.current)
      root.current.visible = k > 0.02 && !st.linkView
      root.current.scale.setScalar(0.2 + k * 0.8)
    }

    // 传感器：部署状态每 300ms 标记最近活目标
    if (deployed && now - lastSensorAt.current > 300) {
      lastSensorAt.current = now
      const best = nearestTargetId()
      if (st.sensorMark !== best) commsStore.setDrone({ sensorMark: best })
    }

    // ---- 链路视角：相机到无人机头部，观瞄 + 手动飞行 + 开火 ----
    if (st.linkView && turret.current) {
      const headPos = _tmp.current
      if (body.current) {
        body.current.getWorldPosition(headPos)
        headPos.y += 0.32
      }
      camera.position.copy(headPos)
      _euler.current.set(pitch.current, yaw.current, 0)
      camera.quaternion.setFromEuler(_euler.current)
      camera.updateMatrixWorld()

      // 手动飞行：WASD 水平移动 / Space 上升 / Ctrl 下降
      const speed = 2.8
      const f = keys.current.has('KeyW') ? 1 : keys.current.has('KeyS') ? -1 : 0
      const r = keys.current.has('KeyD') ? 1 : keys.current.has('KeyA') ? -1 : 0
      if (f !== 0 || r !== 0) {
        const sin = Math.sin(yaw.current)
        const cos = Math.cos(yaw.current)
        pos.current.x += (-sin * f + cos * r) * speed * dt
        pos.current.z += (-cos * f - sin * r) * speed * dt
      }
      if (keys.current.has('Space')) pos.current.y += 2.2 * dt
      if (keys.current.has('ControlLeft') || keys.current.has('ControlRight')) pos.current.y -= 2.2 * dt
      pos.current.x = THREE.MathUtils.clamp(pos.current.x, ROOM_BOUNDS.minX, ROOM_BOUNDS.maxX)
      pos.current.y = THREE.MathUtils.clamp(pos.current.y, ROOM_BOUNDS.minY, ROOM_BOUNDS.maxY)
      pos.current.z = THREE.MathUtils.clamp(pos.current.z, ROOM_BOUNDS.minZ, ROOM_BOUNDS.maxZ)

      // 转角塔跟随视角
      if (body.current) body.current.rotation.y = yaw.current

      if (mouseDown.current && st.weapon === 'mg') {
        mgFireTimer.current += dt
        if (mgFireTimer.current >= 0.1) {
          mgFireTimer.current = 0
          fireMg(true)
        }
      } else if (!mouseDown.current) {
        mgFireTimer.current = 0
      }
    } else {
      // ---- 自动飞行 ----
      const desired = _tmp.current
      if (st.mode === 'stowing') {
        // 飞回玩家背后再回收
        const backLocal = _right.current.set(0, -0.4, 0.9).applyQuaternion(camera.quaternion)
        desired.copy(camera.position).add(backLocal)
        pos.current.lerp(desired, Math.min(1, dt * 3))
        const d = pos.current.distanceTo(desired)
        if (d < 0.35) {
          commsStore.setDrone({ mode: 'stowed', aiState: 'STOWED', linkView: false, sensorMark: null, mgFiring: false })
          message('RAVEN 已回收 · STOWED')
        }
      } else if (st.mode === 'relay') {
        camera.getWorldDirection(_dir.current)
        _right.current.setFromMatrixColumn(camera.matrixWorld, 0)
        _up.current.setFromMatrixColumn(camera.matrixWorld, 1)
        desired
          .copy(camera.position)
          .addScaledVector(_right.current, 0.95)
          .addScaledVector(_up.current, 0.72)
          .addScaledVector(_dir.current, -0.25)
        pos.current.lerp(desired, Math.min(1, dt * 4))
        yaw.current = THREE.MathUtils.damp(yaw.current, -Math.PI / 2, 3, dt)
        if (body.current) body.current.rotation.y = yaw.current
      } else if (st.mode === 'sweep') {
        const wp = WAYPOINTS[waypointIndex.current]
        const d = Math.hypot(wp.x - pos.current.x, wp.z - pos.current.z)
        if (d < 0.5) {
          waypointIndex.current = (waypointIndex.current + 1) % WAYPOINTS.length
        } else {
          const dx = wp.x - pos.current.x
          const dz = wp.z - pos.current.z
          const len = Math.max(0.001, Math.hypot(dx, dz))
          pos.current.x += (dx / len) * 2.4 * dt
          pos.current.z += (dz / len) * 2.4 * dt
          pos.current.y = THREE.MathUtils.damp(pos.current.y, wp.y, 3, dt)
          const targetYaw = Math.atan2(-dx, -dz)
          yaw.current = dampAngle(yaw.current, targetYaw, 5, dt)
          if (body.current) body.current.rotation.y = yaw.current
        }

        // 巡逻扫描：先自动索敌，机炮塔跟踪最近目标（不射击）
        const scanTarget = st.sensorMark ? targetRegistry.get(st.sensorMark) : null
        if (scanTarget && scanTarget.alive && turret.current && body.current) {
          const aim = targetRegistry.aimWorld(scanTarget, _aim.current)
          const local = body.current.worldToLocal(aim.clone())
          turret.current.rotation.y = Math.atan2(-local.x, -local.z)
        } else if (turret.current) {
          turret.current.rotation.y += dt * 0.3
        }
      } else if (st.mode === 'strike') {
        // 悬停在玩家的前上方，面向目标
        camera.getWorldDirection(_dir.current)
        _right.current.setFromMatrixColumn(camera.matrixWorld, 0)
        _up.current.setFromMatrixColumn(camera.matrixWorld, 1)
        desired
          .copy(camera.position)
          .addScaledVector(_dir.current, 1.6)
          .addScaledVector(_right.current, 0.6)
          .addScaledVector(_up.current, 0.5)
        pos.current.lerp(desired, Math.min(1, dt * 3.5))

        let best: string | null = null
        let bestDist = Infinity
        for (const t of targetRegistry.alive()) {
          const p = targetRegistry.aimWorld(t, _tmp.current)
          const d = p.distanceTo(pos.current)
          if (d < bestDist) {
            bestDist = d
            best = t.id
          }
        }
        if (best && !targetRegistry.isDown(best) && turret.current) {
          const target = targetRegistry.get(best)
          if (target) {
            const aim = targetRegistry.aimWorld(target, _aim.current)
            const local = body.current!.worldToLocal(aim.clone())
            turret.current.rotation.y = Math.atan2(-local.x, -local.z)
          }
          mgFireTimer.current += dt
          if (mgFireTimer.current >= 0.13) {
            mgFireTimer.current = 0
            fireMg(false, best)
          }
          if (now >= st.missileCooldownUntil && (st.missileLeft > 0 || st.missileRight > 0)) {
            fireMissiles(best)
          }
        } else {
          mgFireTimer.current = 0
          if (turret.current) turret.current.rotation.y += dt * 0.35
        }
      }
    }

    // 旋翼旋转
    if (root.current) {
      root.current.traverse((o) => {
        if ((o as THREE.Object3D).name === 'rotor') {
          ;(o as THREE.Object3D).rotation.y += dt * 34
        }
      })
    }

    // 枪口闪光
    if (flash.current) {
      const show = st.linkView
        ? st.weapon === 'mg' && mouseDown.current
        : st.mode === 'strike' && mgFireTimer.current > 0
      flash.current.visible = show
      if (show) flash.current.scale.setScalar(0.7 + Math.random() * 0.5)
    }

    // 低频率状态回写（HUD）
    if (now - lastHudWrite.current > 180) {
      lastHudWrite.current = now
      const cur = commsStore.getState().drone
      commsStore.setDrone({
        mgHeat: mgHeat.current,
        mgFiring: mouseDown.current || (cur.mode === 'strike' && cur.sensorMark !== null && !cur.linkView),
      })
      mgHeat.current = Math.max(0, mgHeat.current - 0.008)
    }

    // 电量缓慢消耗（仅部署时）
    if (deployed && now % 2000 < dt * 1000) {
      const cur = commsStore.getState().drone
      commsStore.setDrone({ power: Math.max(0, cur.power - (cur.linkView ? 0.4 : 0.12)) })
    }

    void state
  })

  return (
    <group ref={root} visible={false} name="raven-drone">
      <group ref={body} position={[0, 0, 0]}>
        {/* 机身 */}
        <mesh castShadow userData={{ kind: 'solid' }}>
          <boxGeometry args={[0.5, 0.22, 0.8]} />
          <meshStandardMaterial color="#343a45" metalness={0.8} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0.16, 0.02]} userData={{ kind: 'fx' }}>
          <boxGeometry args={[0.4, 0.09, 0.55]} />
          <meshStandardMaterial color="#2c323d" metalness={0.7} roughness={0.42} />
        </mesh>
        {/* 传感器球罩 */}
        <mesh position={[0, 0.16, -0.42]} userData={{ kind: 'fx' }}>
          <sphereGeometry args={[0.11, 12, 12]} />
          <meshStandardMaterial color="#191d24" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.16, -0.5]} rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
          <cylinderGeometry args={[0.05, 0.05, 0.05, 10]} />
          <meshBasicMaterial color="#c084fc" toneMapped={false} />
        </mesh>
        {/* 紫色识别条 */}
        <mesh position={[0, 0.05, -0.41]} userData={{ kind: 'fx' }}>
          <boxGeometry args={[0.3, 0.03, 0.01]} />
          <meshBasicMaterial color="#c084fc" toneMapped={false} />
        </mesh>

        {/* 背部武器塔（双管机枪） */}
        <group ref={turret} position={[0, 0.24, 0.08]}>
          <mesh castShadow userData={{ kind: 'solid' }}>
            <boxGeometry args={[0.26, 0.16, 0.36]} />
            <meshStandardMaterial color="#3a404c" metalness={0.82} roughness={0.32} />
          </mesh>
          {[-0.08, 0.08].map((x) => (
            <mesh key={x} position={[x, 0.07, -0.28]} rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
              <cylinderGeometry args={[0.028, 0.033, 0.5, 10]} />
              <meshStandardMaterial color="#22262d" metalness={0.9} roughness={0.25} />
            </mesh>
          ))}
          <mesh position={[0, 0.07, -0.55]} rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
            <cylinderGeometry args={[0.045, 0.035, 0.08, 10]} />
            <meshStandardMaterial color="#191d24" metalness={0.9} roughness={0.22} />
          </mesh>
          <mesh ref={flash} position={[0, 0.07, -0.6]} visible={false}>
            <octahedronGeometry args={[0.07, 0]} />
            <meshBasicMaterial color="#d8b4fe" toneMapped={false} />
          </mesh>
          <object3D ref={muzzle} position={[0, 0.07, -0.6]} />
        </group>

        {/* 左右微型导弹舱 */}
        {[-0.36, 0.36].map((x, i) => (
          <group key={i} position={[x, 0.16, 0.1]}>
            <mesh castShadow userData={{ kind: 'solid' }}>
              <boxGeometry args={[0.16, 0.16, 0.42]} />
              <meshStandardMaterial color="#2c323d" metalness={0.6} roughness={0.5} />
            </mesh>
            <mesh position={[0, 0.045, -0.24]} rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
              <cylinderGeometry args={[0.028, 0.032, 0.36, 10]} />
              <meshStandardMaterial color="#22262d" metalness={0.85} roughness={0.3} />
            </mesh>
            <mesh position={[0, -0.045, -0.24]} rotation={[Math.PI / 2, 0, 0]} userData={{ kind: 'fx' }}>
              <cylinderGeometry args={[0.028, 0.032, 0.36, 10]} />
              <meshStandardMaterial color="#22262d" metalness={0.85} roughness={0.3} />
            </mesh>
            <mesh position={[0, 0.045, -0.43]} userData={{ kind: 'fx' }}>
              <coneGeometry args={[0.028, 0.06, 10]} />
              <meshBasicMaterial color="#a855f7" toneMapped={false} />
            </mesh>
            <mesh position={[0, -0.045, -0.43]} userData={{ kind: 'fx' }}>
              <coneGeometry args={[0.028, 0.06, 10]} />
              <meshBasicMaterial color="#c084fc" toneMapped={false} />
            </mesh>
            <object3D ref={i === 0 ? leftMsl : rightMsl} position={[0, 0, -0.24]} />
          </group>
        ))}

        {/* 四臂旋翼（大尺寸水平桨盘：桨叶绕 Y 轴高速旋转） */}
        {[
          [-0.46, -0.38],
          [0.46, -0.38],
          [-0.46, 0.38],
          [0.46, 0.38],
        ].map(([x, z], i) => (
          <group key={i}>
            <mesh position={[x / 2, 0.02, z / 2]} rotation={[0, Math.atan2(z, x), 0]} userData={{ kind: 'fx' }}>
              <boxGeometry args={[0.4, 0.03, 0.04]} />
              <meshStandardMaterial color="#3a404c" metalness={0.8} roughness={0.35} />
            </mesh>
            <group name="rotor" position={[x, 0.09, z]}>
              <mesh userData={{ kind: 'fx' }}>
                <cylinderGeometry args={[0.3, 0.3, 0.014, 28]} />
                <meshBasicMaterial color="#d8b4fe" transparent opacity={0.2} toneMapped={false} depthWrite={false} />
              </mesh>
              {[0, 45, 90, 135].map((deg) => (
                <mesh key={deg} rotation={[0, (deg * Math.PI) / 180, 0]} userData={{ kind: 'fx' }}>
                  <boxGeometry args={[0.56, 0.01, 0.045]} />
                  <meshBasicMaterial color="#c084fc" transparent opacity={0.55} toneMapped={false} depthWrite={false} />
                </mesh>
              ))}
              <mesh userData={{ kind: 'fx' }}>
                <cylinderGeometry args={[0.035, 0.035, 0.05, 10]} />
                <meshStandardMaterial color="#191d24" metalness={0.8} roughness={0.3} />
              </mesh>
            </group>
          </group>
        ))}
      </group>
    </group>
  )
}

function dampAngle(from: number, to: number, lambda: number, dt: number) {
  const diff = ((to - from + Math.PI * 3) % (Math.PI * 2)) - Math.PI
  return from + diff * (1 - Math.exp(-lambda * dt))
}
