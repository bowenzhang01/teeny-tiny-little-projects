import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { rangeStore, registerImpact } from '../state/rangeStore'
import { engineerStore } from '../state/engineerStore'
import { targetRegistry } from '../combat/targetRegistry'
import { deployRegistry } from '../combat/deployRegistry'
import { crosshairGroundPoint } from '../combat/placement'
import { playDeploy, playDry, playRailShot } from '../audio/sfx'
import { useKeyBinding } from '../input/useKeyBinding'

interface PlacedMine {
  id: string
  mesh: THREE.Group
  pos: THREE.Vector3
  birthAt: number
}

interface PlacedBarrier {
  id: string
  mesh: THREE.Group
  pos: THREE.Vector3
  box: THREE.Box3
  birthAt: number
}

interface Burst {
  obj: THREE.Group
  core: THREE.Mesh
  flash: THREE.Mesh
  light: THREE.PointLight
  age: number
  life: number
}

const PLACE_MIN = 3
const PLACE_MAX = 12

/**
 * C 部署包（C-5）：
 * - 4 切换蓝图（地雷 / 屏障）；G 对准星落点放置（3~12m）
 * - 地雷×3 / 屏障×3，放置后 6s 自动补满
 * - T 手动引爆离 C 最远的一颗地雷（2.2m 内命中标靶 +8 并推倒）
 * - 屏障纯视觉 + 注册小 AABB（deployRegistry，当前不参与弹道）
 * - 1 不回收地雷/屏障
 */
export function DeployKit() {
  const { camera } = useThree()
  const group = useRef<THREE.Group>(null!)
  const rangeRing = useRef<THREE.Mesh>(null!)
  const mines = useRef<PlacedMine[]>([])
  const barriers = useRef<PlacedBarrier[]>([])
  const bursts = useRef<Burst[]>([])
  const nextId = useRef(1)
  const spawned = useRef<string | null>(null)
  const _aim = useRef(new THREE.Vector3())

  const message = (text: string) => {
    const s = rangeStore.getState()
    rangeStore.set({ message: text, messageId: s.messageId + 1 })
  }

  const createMine = (): THREE.Group => {
    const g = new THREE.Group()
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.17, 0.06, 10),
      new THREE.MeshStandardMaterial({ color: '#2c323d', metalness: 0.6, roughness: 0.5 }),
    )
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 12, 12),
      new THREE.MeshStandardMaterial({ color: '#22262d', metalness: 0.7, roughness: 0.4 }),
    )
    dome.position.y = 0.06
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 8, 8),
      new THREE.MeshBasicMaterial({ color: '#ffb54d', toneMapped: false }),
    )
    lamp.position.y = 0.1
    g.add(base, dome, lamp)
    return g
  }

  const createBarrier = (): THREE.Group => {
    const g = new THREE.Group()
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 1.1, 0.1),
      new THREE.MeshStandardMaterial({ color: '#3a404c', metalness: 0.75, roughness: 0.4 }),
    )
    wall.position.y = 0.58
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 0.14, 0.11),
      new THREE.MeshStandardMaterial({ color: '#fbbf24', metalness: 0.4, roughness: 0.5 }),
    )
    stripe.position.y = 0.35
    const postL = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 1.2, 0.14),
      new THREE.MeshStandardMaterial({ color: '#22262d', metalness: 0.8, roughness: 0.35 }),
    )
    postL.position.set(-0.48, 0.6, 0)
    const postR = postL.clone()
    postR.position.x = 0.48
    g.add(wall, stripe, postL, postR)
    return g
  }

  const place = () => {
    if (!rangeStore.getState().locked) return
    const s = engineerStore.getState()
    if (s.deploy.pending) {
      message('部署进行中…')
      return
    }
    const p = crosshairGroundPoint(camera)
    if (!p) {
      message('部署范围 3-12M · 请对准地面')
      playDry()
      return
    }
    if (s.deploy.blueprint === 'mine') {
      if (s.deploy.mines <= 0) {
        message('地雷耗尽 · 待补充')
        playDry()
        return
      }
      engineerStore.beginDeploy('mine', p.x, p.z, 620, 950)
    } else {
      if (s.deploy.barriers <= 0) {
        message('屏障耗尽 · 待补充')
        playDry()
        return
      }
      engineerStore.beginDeploy('barrier', p.x, p.z, 750, 1050)
    }
    playDeploy()
    message('机械臂展开 · 部署中…')
  }

  const detonate = () => {
    if (!rangeStore.getState().locked) return
    const current = mines.current
    if (current.length === 0) {
      message('没有已部署地雷')
      playDry()
      return
    }
    // 引爆离 C 最远的一颗
    let target: PlacedMine = current[0]
    let maxDist = -1
    for (const m of current) {
      const d = m.pos.distanceTo(camera.position)
      if (d > maxDist) {
        maxDist = d
        target = m
      }
    }

    spawnBurst(target.pos.clone(), new THREE.Color('#ffd166'))
    playRailShot()

    // 清除本体与注册表
    deployRegistry.unregister(target.id)
    group.current.remove(target.mesh)
    mines.current = current.filter((m) => m.id !== target.id)

    // 2.2m 内命中标靶：+8 并推倒
    let hitCount = 0
    for (const t of targetRegistry.alive()) {
      const aim = targetRegistry.aimWorld(t, _aim.current)
      if (aim.distanceTo(target.pos) < 2.2 && !targetRegistry.isDown(t.id)) {
        targetRegistry.knockDown(t.id)
        registerImpact({ points: 8, shots: 0 })
        hitCount++
      }
    }
    message(hitCount > 0 ? `地雷引爆 · 命中 +${8 * hitCount}` : '地雷引爆 · 未命中')
  }

  const spawnBurst = (pos: THREE.Vector3, color: THREE.Color) => {
    const obj = new THREE.Group()
    obj.position.copy(pos)
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 12, 12),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false }),
    )
    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 8, 8),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.95, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false }),
    )
    const light = new THREE.PointLight(color, 22, 7, 2)
    obj.add(core, flash, light)
    if (group.current) group.current.add(obj)
    bursts.current.push({ obj, core, flash, light, age: 0, life: 0.5 })
  }

  useKeyBinding('cycleBlueprint', {
    onDown: (e) => {
      if (e.repeat) return
      const s = engineerStore.getState()
      engineerStore.set({
        deploy: { ...s.deploy, blueprint: s.deploy.blueprint === 'mine' ? 'barrier' : 'mine' },
      })
      playDeploy()
    },
  })

  useKeyBinding('placeDeployable', {
    onDown: (e) => {
      if (e.repeat) return
      place()
    },
  })

  useKeyBinding('detonateMines', {
    onDown: (e) => {
      if (e.repeat) return
      detonate()
    },
  })

  useFrame((state, dt) => {
    const now = performance.now()
    const s = engineerStore.getState()

    // 部署动作：四臂先伸手（commitAt），随后操作地雷/屏障装配（operateUntil）
    const pending = s.deploy.pending
    if (pending && (pending.kind === 'mine' || pending.kind === 'barrier')) {
      if (now >= pending.commitAt && spawned.current !== pending.id) {
        spawned.current = pending.id
        const cur = engineerStore.getState()
        if (pending.kind === 'mine') {
          if (cur.deploy.mines > 0) {
            const mesh = createMine()
            mesh.scale.setScalar(0.12)
            mesh.position.set(pending.x, 0.42, pending.z)
            group.current.add(mesh)
            const id = `mine-${nextId.current++}`
            mines.current.push({
              id,
              mesh,
              pos: new THREE.Vector3(pending.x, 0, pending.z),
              birthAt: now,
            })
            deployRegistry.register({
              id,
              kind: 'mine',
              position: new THREE.Vector3(pending.x, 0, pending.z),
              radius: 0.3,
            })
            engineerStore.set({
              deploy: {
                ...cur.deploy,
                mines: cur.deploy.mines - 1,
                replenishAt: now + 6000,
              },
            })
          }
          message('机械臂操作 · 布雷中…')
        } else {
          if (cur.deploy.barriers > 0) {
            const mesh = createBarrier()
            mesh.scale.set(1, 0.06, 1)
            mesh.position.set(pending.x, 0, pending.z)
            group.current.add(mesh)
            const id = `barrier-${nextId.current++}`
            const box = new THREE.Box3().setFromObject(mesh).clone().expandByScalar(0.06)
            barriers.current.push({
              id,
              mesh,
              pos: new THREE.Vector3(pending.x, 0, pending.z),
              box,
              birthAt: now,
            })
            deployRegistry.register({
              id,
              kind: 'barrier',
              position: new THREE.Vector3(pending.x, 0, pending.z),
              radius: 0.12,
            })
            engineerStore.set({
              deploy: {
                ...cur.deploy,
                barriers: cur.deploy.barriers - 1,
                replenishAt: now + 6000,
              },
            })
          }
          message('机械臂操作 · 架设屏障中…')
        }
      }
      if (now >= pending.operateUntil) {
        engineerStore.commitDeploy(pending.id)
        spawned.current = null
        message(pending.kind === 'mine' ? '地雷部署 · MINE ARMED' : '屏障部署 · BARRIER UP')
      }
    } else {
      spawned.current = null
    }

    // 部署范围指示：准星落点处显示琥珀/红色环形（3~12M）
    const rs = rangeStore.getState()
    const guide = rs.locked ? crosshairGroundPoint(camera, 0, 100) : null
    if (rangeRing.current) {
      if (guide) {
        rangeRing.current.visible = true
        rangeRing.current.position.set(guide.x, 0.035, guide.z)
        const dist = guide.distanceTo(camera.position)
        const ok = dist >= PLACE_MIN && dist <= PLACE_MAX
        const mat = rangeRing.current.material as THREE.MeshBasicMaterial
        mat.color.set(ok ? '#ffb54d' : '#ff4d3c')
        mat.opacity = ok ? 0.62 : 0.45
        rangeRing.current.scale.setScalar(0.9 + Math.sin(state.clock.elapsedTime * 3) * 0.06)
      } else {
        rangeRing.current.visible = false
      }
    }

    // 地雷/屏障库存自动补满
    if (s.deploy.replenishAt > 0 && now >= s.deploy.replenishAt) {
      engineerStore.set({
        deploy: {
          ...s.deploy,
          mines: s.deploy.mineCapacity,
          barriers: s.deploy.barrierCapacity,
          replenishAt: 0,
        },
      })
      message('部署库存已补充 · STOCK REFILLED')
    }

    // 爆炸特效动画
    for (let i = bursts.current.length - 1; i >= 0; i--) {
      const b = bursts.current[i]
      b.age += dt
      const k = Math.max(0, 1 - b.age / b.life)
      b.core.scale.setScalar(0.4 + (1 - k) * 2.2)
      b.flash.scale.setScalar(0.3 + (1 - k) * 1.4)
      ;(b.core.material as THREE.MeshBasicMaterial).opacity = k
      ;(b.flash.material as THREE.MeshBasicMaterial).opacity = k * 0.9
      b.light.intensity = 22 * k
      if (b.age >= b.life) {
        group.current?.remove(b.obj)
        bursts.current.splice(i, 1)
      }
    }

    // 地雷/屏障装配动画 + 闲置微动画
    const pulse = 0.75 + Math.sin(state.clock.elapsedTime * 5) * 0.25
    for (const m of mines.current) {
      const b = Math.min(1, (now - m.birthAt) / 650)
      m.mesh.scale.setScalar(0.12 + 0.88 * b)
      m.mesh.position.y = THREE.MathUtils.lerp(0.42, 0.03, b)
      const lamp = m.mesh.children[2] as THREE.Mesh
      ;(lamp.material as THREE.MeshBasicMaterial).color.setRGB(pulse, pulse * 0.7, pulse * 0.35)
    }
    for (const b of barriers.current) {
      const t = Math.min(1, (now - b.birthAt) / 850)
      b.mesh.scale.set(1, Math.max(0.06, t), 1)
    }
  })

  // 卸载（换人）时清空部署注册表
  useEffect(() => {
    return () => {
      deployRegistry.clear()
    }
  }, [])

  return (
    <>
      <group ref={group} name="c-deployables" />
      {/* 部署范围指示环（世界空间，跟随准星地面落点） */}
      <mesh ref={rangeRing} visible={false} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.85, 1.0, 40]} />
        <meshBasicMaterial color="#ffb54d" transparent opacity={0.6} toneMapped={false} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </>
  )
}
