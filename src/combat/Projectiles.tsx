import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useRef } from 'react'
import { rangeStore, registerImpact } from '../state/rangeStore'
import type { GrenadeKind } from '../state/assaultStore'
import { targetRegistry } from './targetRegistry'

/** 榴弹发射器沿用 B 的默认行为；A 手雷使用 frag/flash/incendiary */
type GrenadeVariant = GrenadeKind | 'launcher'

interface GrenadeActor {
  kind: 'grenade'
  type: GrenadeVariant
  object: THREE.Group
  vel: THREE.Vector3
  life: number
  maxLife: number
}

interface HiveActor {
  kind: 'hive'
  object: THREE.Group
  vel: THREE.Vector3
  life: number
  maxLife: number
  targetId: string | null
  seed: number
  side: 'left' | 'right'
  fallbackPoint: THREE.Vector3
}

interface RailActor {
  kind: 'rail'
  object: THREE.Group
  vel: THREE.Vector3
  life: number
  maxLife: number
}

interface BulletActor {
  kind: 'bullet'
  object: THREE.Object3D
  vel: THREE.Vector3
  life: number
  maxLife: number
}

interface LmgActor {
  kind: 'lmg'
  object: THREE.Object3D
  vel: THREE.Vector3
  life: number
  maxLife: number
}

type Actor = GrenadeActor | HiveActor | RailActor | BulletActor | LmgActor

interface Spark {
  mesh: THREE.Mesh
  vel: THREE.Vector3
  life: number
}

interface Explosion {
  object: THREE.Group
  age: number
  life: number
  sparks: Spark[]
  light: THREE.PointLight
  color: THREE.Color
  /** 是否为大白闪（闪光弹） */
  flash: boolean
}

/** 燃烧弹落地后的持续火焰区 */
interface BurnZone {
  object: THREE.Group
  age: number
  ignition: number
  life: number
  flames: THREE.Mesh[]
  light: THREE.PointLight
}

const pending: Actor[] = []
const actors: Actor[] = []
const explosions: Explosion[] = []
const burns: BurnZone[] = []

let lastFxMessageAt = 0

/** 节流地推送一条 HUD 消息 */
function pushFxMessage(text: string) {
  const now = performance.now()
  if (now - lastFxMessageAt < 350) return
  lastFxMessageAt = now
  const prev = rangeStore.getState()
  rangeStore.set({ message: text, messageId: prev.messageId + 1 })
}

function buildGrenade(type: GrenadeVariant): THREE.Group {
  const g = new THREE.Group()
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 14, 14),
    new THREE.MeshStandardMaterial({ color: '#2f3540', roughness: 0.5, metalness: 0.6 }),
  )
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(0.093, 0.093, 0.05, 16),
    new THREE.MeshBasicMaterial({
      color: type === 'launcher' ? '#ff8c42' : type === 'frag' ? '#ff8a5c' : type === 'flash' ? '#fde68a' : '#ff9f43',
      toneMapped: false,
    }),
  )
  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(0.05, 0.1, 12),
    new THREE.MeshStandardMaterial({ color: '#434a56', roughness: 0.4, metalness: 0.7 }),
  )
  tip.position.y = 0.12
  g.add(shell, band, tip)
  return g
}

function buildHive(): THREE.Group {
  const g = new THREE.Group()
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 10, 10),
    new THREE.MeshBasicMaterial({ color: '#ffc46b', toneMapped: false }),
  )
  const tail = new THREE.Mesh(
    new THREE.ConeGeometry(0.03, 0.2, 8),
    new THREE.MeshBasicMaterial({ color: '#ff8c42', transparent: true, opacity: 0.7, toneMapped: false }),
  )
  tail.position.z = 0.14
  tail.rotation.x = Math.PI / 2
  g.add(body, tail)
  return g
}

function buildRailBolt(): THREE.Group {
  const g = new THREE.Group()
  const core = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 0.9, 10),
    new THREE.MeshBasicMaterial({ color: '#a5f3fc', toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false }),
  )
  core.rotation.x = Math.PI / 2
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 10, 10),
    new THREE.MeshBasicMaterial({ color: '#67e8f9', toneMapped: false, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }),
  )
  g.add(core, glow)
  return g
}

function buildTracer(color: string): THREE.Object3D {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.03, 0.03, 0.42),
    new THREE.MeshBasicMaterial({ color, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false }),
  )
  return mesh
}

function disposeObject(root: THREE.Object3D) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (mesh.geometry) mesh.geometry.dispose()
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
    else if (mat) mat.dispose()
  })
  root.removeFromParent()
}

export function spawnGrenade(origin: THREE.Vector3, dir: THREE.Vector3, type: GrenadeVariant = 'launcher') {
  const object = buildGrenade(type)
  object.position.copy(origin)
  pending.push({
    kind: 'grenade',
    type,
    object,
    vel: dir.clone().normalize().multiplyScalar(19),
    life: 0,
    maxLife: 5,
  })
}

export function spawnHiveMissile(opts: {
  origin: THREE.Vector3
  targetId: string | null
  fallbackPoint: THREE.Vector3
  seed: number
  side: 'left' | 'right'
}) {
  const object = buildHive()
  object.position.copy(opts.origin)
  pending.push({
    kind: 'hive',
    object,
    vel: new THREE.Vector3((Math.random() - 0.5) * 3, 2 + Math.random() * 3, (Math.random() - 0.5) * 3),
    life: 0,
    maxLife: 6.5,
    targetId: opts.targetId,
    seed: opts.seed,
    side: opts.side,
    fallbackPoint: opts.fallbackPoint.clone(),
  })
}

export function spawnRailBolt(origin: THREE.Vector3, dir: THREE.Vector3) {
  const object = buildRailBolt()
  object.position.copy(origin)
  pending.push({
    kind: 'rail',
    object,
    vel: dir.clone().normalize().multiplyScalar(55),
    life: 0,
    maxLife: 1.5,
  })
}

export function spawnBullet(origin: THREE.Vector3, dir: THREE.Vector3) {
  const object = buildTracer('#ffd166')
  object.position.copy(origin)
  pending.push({
    kind: 'bullet',
    object,
    vel: dir.clone().normalize().multiplyScalar(90),
    life: 0,
    maxLife: 0.6,
  })
}

/** A 突击兵 LMG 的红色高速曳光弹 */
export function spawnLmgRound(origin: THREE.Vector3, dir: THREE.Vector3) {
  const object = buildTracer('#ff6b5e')
  object.position.copy(origin)
  pending.push({
    kind: 'lmg',
    object,
    vel: dir.clone().normalize().multiplyScalar(110),
    life: 0,
    maxLife: 0.5,
  })
}

function grenadePalette(type: GrenadeVariant) {
  if (type === 'launcher') return { color: '#ff8c42', points: 5, label: '榴弹', flash: false }
  if (type === 'frag') return { color: '#ff8a5c', points: 8, label: '碎片手雷', flash: false }
  if (type === 'flash') return { color: '#ffffff', points: 4, label: '闪光弹', flash: true }
  return { color: '#ff9f43', points: 6, label: '燃烧弹', flash: false }
}

export function Projectiles() {
  const group = useRef<THREE.Group>(null!)

  const spawnExplosion = (
    parent: THREE.Group,
    pos: THREE.Vector3,
    color: THREE.Color,
    big: boolean,
    opts?: { flash?: boolean; shards?: number },
  ) => {
    const flash = opts?.flash ?? false
    const object = new THREE.Group()
    object.position.copy(pos)

    // 闪光弹：白色大核心 + 快闪；普通爆炸：彩色核心
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(1, 14, 14),
      new THREE.MeshBasicMaterial({
        color: flash ? '#ffffff' : color,
        transparent: true,
        opacity: 1,
        toneMapped: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    )
    const flashMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 8, 8),
      new THREE.MeshBasicMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: flash ? 1 : 0.9,
        toneMapped: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    )
    object.add(core, flashMesh)

    // 闪光弹追加扩散光环
    if (flash) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.5, 0.72, 40),
        new THREE.MeshBasicMaterial({
          color: '#ffffff',
          transparent: true,
          opacity: 0.85,
          toneMapped: false,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      )
      ring.rotation.x = Math.PI / 2
      object.add(ring)
    }

    const sparkCount = opts?.shards ?? (big ? 14 : 8)
    const sparks: Spark[] = []
    for (let i = 0; i < sparkCount; i++) {
      const s = new THREE.Mesh(
        new THREE.SphereGeometry(flash ? 0.02 : 0.03, 6, 6),
        new THREE.MeshBasicMaterial({ color: flash ? '#ffffff' : i % 2 ? '#ffd166' : '#ff8c42', toneMapped: false }),
      )
      s.position.copy(pos)
      object.add(s)
      sparks.push({
        mesh: s,
        vel: new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 2.5, (Math.random() - 0.5) * 4),
        life: 0,
      })
    }

    const light = new THREE.PointLight(flash ? '#ffffff' : color, flash ? 45 : big ? 18 : 9, flash ? 12 : big ? 7 : 4.5, 2)
    object.add(light)

    parent.add(object)
    explosions.push({
      object,
      age: 0,
      life: flash ? 0.34 : big ? 0.55 : 0.38,
      sparks,
      light,
      color,
      flash,
    })
  }

  /** 燃烧弹火焰区：0.25s 引燃延迟，随后持续约 1.6s */
  const spawnBurn = (parent: THREE.Group, pos: THREE.Vector3) => {
    const object = new THREE.Group()
    object.position.copy(pos)
    const flames: THREE.Mesh[] = []
    for (let i = 0; i < 9; i++) {
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.09 + Math.random() * 0.08, 0.5 + Math.random() * 0.55, 8),
        new THREE.MeshBasicMaterial({
          color: i % 2 ? '#ff9f43' : '#ff5c33',
          transparent: true,
          opacity: 0.85,
          toneMapped: false,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      )
      flame.position.set((Math.random() - 0.5) * 0.85, 0.3, (Math.random() - 0.5) * 0.85)
      object.add(flame)
      flames.push(flame)
    }
    const light = new THREE.PointLight('#ff7a3c', 0, 6, 2)
    object.add(light)
    object.visible = false
    parent.add(object)
    burns.push({ object, age: 0, ignition: 0.25, life: 1.85, flames, light })
  }

  const findTargetAt = (pos: THREE.Vector3) =>
    targetRegistry.alive().find((t) => targetRegistry.pointInTarget(pos, t)) ?? null

  useFrame((_, dt) => {
    const parent = group.current
    if (!parent) return

    // 驱动标靶倒下/立起（以 Projectiles 的帧循环为准，确保动画生效）
    const rangeTarget = targetRegistry.get('T-01')
    const human = rangeTarget?.object.getObjectByName('squad-target-human') as THREE.Group | undefined
    if (human) {
      const goal = targetRegistry.isDown('T-01') ? -Math.PI / 2.05 : 0
      human.rotation.x = THREE.MathUtils.damp(human.rotation.x, goal, 7, dt)
    }

    // 取出排队中的弹体
    while (pending.length > 0) {
      const a = pending.shift()!
      parent.add(a.object)
      actors.push(a)
    }

    // 更新弹体
    for (let i = actors.length - 1; i >= 0; i--) {
      const a = actors[i]
      let exploded = false

      if (a.kind === 'grenade') {
        a.vel.y -= 9.8 * dt
        a.object.position.addScaledVector(a.vel, dt)
        a.object.rotation.x += dt * 9
        a.life += dt

        const palette = grenadePalette(a.type)
        const hit = findTargetAt(a.object.position)
        if (hit) {
          if (a.type === 'flash') {
            // 闪光弹：大白闪 + 全屏白屏 + 不推倒标靶
            spawnExplosion(parent, a.object.position.clone(), new THREE.Color('#ffffff'), true, { flash: true, shards: 5 })
            rangeStore.set({ screenFlashUntil: performance.now() + 260 })
          } else if (a.type === 'incendiary') {
            // 燃烧弹：小爆点 + 延迟火焰带
            spawnExplosion(parent, a.object.position.clone(), new THREE.Color(palette.color), false)
            spawnBurn(parent, a.object.position.clone())
          } else {
            // 榴弹 / 碎片手雷：碎片更多，爆炸更大
            spawnExplosion(
              parent,
              a.object.position.clone(),
              new THREE.Color(palette.color),
              true,
              { shards: a.type === 'frag' ? 20 : 14 },
            )
          }
          if (a.type !== 'flash') targetRegistry.knockDown(hit.id)
          registerImpact({ points: palette.points, shots: 0 })
          pushFxMessage(`${palette.label}命中 +${palette.points}`)
          exploded = true
        } else if (a.object.position.y < 0.02 || a.life > a.maxLife) {
          // 地面/超时：也保留类型差异（闪光白闪、燃烧引燃火焰）
          if (a.type === 'flash') {
            spawnExplosion(parent, a.object.position.clone(), new THREE.Color('#ffffff'), true, { flash: true, shards: 4 })
            rangeStore.set({ screenFlashUntil: performance.now() + 220 })
          } else if (a.type === 'incendiary') {
            spawnExplosion(parent, a.object.position.clone(), new THREE.Color(palette.color), false)
            spawnBurn(parent, a.object.position.clone())
          } else {
            spawnExplosion(parent, a.object.position.clone(), new THREE.Color(palette.color), false)
          }
          exploded = true
        }
      } else if (a.kind === 'hive') {
        a.life += dt
        const target = a.targetId ? targetRegistry.get(a.targetId) : null
        const goal = new THREE.Vector3()
        if (target && target.alive) {
          targetRegistry.aimWorld(target, goal)
        } else {
          goal.copy(a.fallbackPoint)
        }

        const pos = a.object.position
        const toGoal = goal.clone().sub(pos)
        const dist = toGoal.length()
        const speed = 13 + Math.sin(a.seed + a.life * 7) * 1.5
        const desired = toGoal.clone().normalize().multiplyScalar(speed)

        // “小蜜蜂”式不规则路径：横向摆动 + 随机扰动
        const t = a.life
        const sway = Math.sin(a.seed * 13.7 + t * 9) * 2.4
        const up = Math.cos(a.seed * 7.1 + t * 11) * 1.7
        const right = new THREE.Vector3().crossVectors(toGoal.normalize(), new THREE.Vector3(0, 1, 0))
        if (right.lengthSq() < 0.01) right.set(1, 0, 0)
        right.normalize()
        desired.addScaledVector(right, sway).addScaledVector(new THREE.Vector3(0, 1, 0), up)

        a.vel.lerp(desired, Math.min(1, dt * 5.5))
        pos.addScaledVector(a.vel, dt)

        // 弹体朝向
        if (a.vel.lengthSq() > 0.01) {
          a.object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), a.vel.clone().normalize())
        }

        if (dist < 0.55 || a.life > a.maxLife) {
          const hit = findTargetAt(pos)
          spawnExplosion(parent, pos.clone(), new THREE.Color('#ffc46b'), false)
          if (hit) targetRegistry.knockDown(hit.id)
          registerImpact({ points: 2, shots: 0 })
          pushFxMessage('蜂巢导弹命中 +2')
          exploded = true
        }
      } else if (a.kind === 'rail') {
        a.object.position.addScaledVector(a.vel, dt)
        a.life += dt
        if (a.vel.lengthSq() > 0.01) {
          a.object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), a.vel.clone().normalize())
        }
        const hit = findTargetAt(a.object.position)
        if (hit) {
          spawnExplosion(parent, a.object.position.clone(), new THREE.Color('#67e8f9'), true)
          targetRegistry.knockDown(hit.id)
          registerImpact({ points: 15, shots: 0 })
          pushFxMessage('轨道炮命中 +15')
          exploded = true
        } else if (a.life > a.maxLife) {
          spawnExplosion(parent, a.object.position.clone(), new THREE.Color('#67e8f9'), false)
          exploded = true
        }
      } else if (a.kind === 'lmg') {
        // A 突击兵 LMG 红色曳光
        a.object.position.addScaledVector(a.vel, dt)
        a.life += dt
        if (a.vel.lengthSq() > 0.01) {
          a.object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), a.vel.clone().normalize())
        }
        const hit = findTargetAt(a.object.position)
        if (hit) {
          spawnExplosion(parent, a.object.position.clone(), new THREE.Color('#ff6b5e'), false)
          targetRegistry.knockDown(hit.id)
          registerImpact({ points: 1, shots: 0 })
          pushFxMessage('LMG 命中 +1')
          exploded = true
        } else if (a.life > a.maxLife) {
          exploded = true
        }
      } else {
        // 六管机枪曳光弹
        a.object.position.addScaledVector(a.vel, dt)
        a.life += dt
        if (a.vel.lengthSq() > 0.01) {
          a.object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), a.vel.clone().normalize())
        }
        const hit = findTargetAt(a.object.position)
        if (hit) {
          spawnExplosion(parent, a.object.position.clone(), new THREE.Color('#ffd166'), false)
          targetRegistry.knockDown(hit.id)
          registerImpact({ points: 1, shots: 0 })
          pushFxMessage('六管命中 +1')
          exploded = true
        } else if (a.life > a.maxLife) {
          exploded = true
        }
      }

      if (exploded) {
        disposeObject(a.object)
        actors.splice(i, 1)
      }
    }

    // 更新爆炸特效
    for (let i = explosions.length - 1; i >= 0; i--) {
      const e = explosions[i]
      e.age += dt
      const k = Math.max(0, 1 - e.age / e.life)
      const core = e.object.children[0] as THREE.Mesh
      const flashMesh = e.object.children[1] as THREE.Mesh
      const coreScale = e.flash ? 0.5 + (1 - k) * 1.7 : 0.25 + (1 - k) * 0.95
      core.scale.setScalar(Math.max(0.05, coreScale * k))
      flashMesh.scale.setScalar(Math.max(0.05, coreScale * k * 0.8 + (e.flash ? 0.55 : 0.2)))
      ;(core.material as THREE.MeshBasicMaterial).opacity = k
      ;(flashMesh.material as THREE.MeshBasicMaterial).opacity = k * (e.flash ? 1 : 0.9)
      e.light.intensity = e.flash ? (e.age < 0.045 ? 60 : 26) * k : (e.age < 0.05 ? 30 : 12) * k

      for (const s of e.sparks) {
        s.life += dt
        s.mesh.position.addScaledVector(s.vel, dt)
        s.vel.y -= 3.5 * dt
        ;(s.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - s.life / 0.6)
      }

      // 闪光环扩散
      if (e.flash && e.object.children[2]) {
        const ring = e.object.children[2] as THREE.Mesh
        const rk = Math.max(0, 1 - e.age / e.life)
        ring.scale.setScalar(1 + (1 - rk) * 8)
        ;(ring.material as THREE.MeshBasicMaterial).opacity = rk * 0.85
      }

      if (e.age >= e.life) {
        disposeObject(e.object)
        explosions.splice(i, 1)
      }
    }

    // 更新燃烧带（引燃延迟 + 持续火焰）
    for (let i = burns.length - 1; i >= 0; i--) {
      const b = burns[i]
      b.age += dt
      const visible = b.age >= b.ignition
      b.object.visible = visible
      if (visible) {
        const t = b.age - b.ignition
        const k = Math.max(0, 1 - t / (b.life - b.ignition))
        const flicker = 0.75 + Math.random() * 0.45
        for (const f of b.flames) {
          f.scale.set(0.7 + Math.random() * 0.5, (0.6 + Math.random() * 0.8) * k, 0.7 + Math.random() * 0.5)
          f.rotation.y += dt * (1 + Math.random())
          ;(f.material as THREE.MeshBasicMaterial).opacity = k * 0.85 * flicker
        }
        b.light.intensity = 12 * k * flicker
      }
      if (b.age >= b.life) {
        disposeObject(b.object)
        burns.splice(i, 1)
      }
    }
  })

  return <group ref={group} />
}
