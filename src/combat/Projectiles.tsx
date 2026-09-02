import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useRef } from 'react'
import { rangeStore, registerImpact } from '../state/rangeStore'
import { targetRegistry } from './targetRegistry'

interface GrenadeActor {
  kind: 'grenade'
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

type Actor = GrenadeActor | HiveActor | RailActor | BulletActor

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
}

const pending: Actor[] = []
const actors: Actor[] = []
const explosions: Explosion[] = []

let lastFxMessageAt = 0

/** 节流地推送一条 HUD 消息 */
function pushFxMessage(text: string) {
  const now = performance.now()
  if (now - lastFxMessageAt < 350) return
  lastFxMessageAt = now
  const prev = rangeStore.getState()
  rangeStore.set({ message: text, messageId: prev.messageId + 1 })
}

function buildGrenade(): THREE.Group {
  const g = new THREE.Group()
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 14, 14),
    new THREE.MeshStandardMaterial({ color: '#2f3540', roughness: 0.5, metalness: 0.6 }),
  )
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(0.093, 0.093, 0.05, 16),
    new THREE.MeshBasicMaterial({ color: '#ff8c42', toneMapped: false }),
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

function buildTracer(): THREE.Object3D {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.03, 0.03, 0.42),
    new THREE.MeshBasicMaterial({ color: '#ffd166', toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false }),
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

export function spawnGrenade(origin: THREE.Vector3, dir: THREE.Vector3) {
  const object = buildGrenade()
  object.position.copy(origin)
  pending.push({
    kind: 'grenade',
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
  const object = buildTracer()
  object.position.copy(origin)
  pending.push({
    kind: 'bullet',
    object,
    vel: dir.clone().normalize().multiplyScalar(90),
    life: 0,
    maxLife: 0.6,
  })
}

export function Projectiles() {
  const group = useRef<THREE.Group>(null!)

  const spawnExplosion = (parent: THREE.Group, pos: THREE.Vector3, color: THREE.Color, big: boolean) => {
    const object = new THREE.Group()
    object.position.copy(pos)

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(1, 14, 14),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 1,
        toneMapped: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    )
    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(1, 8, 8),
      new THREE.MeshBasicMaterial({
        color: '#fff3da',
        transparent: true,
        opacity: 0.9,
        toneMapped: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    )
    object.add(core, flash)

    const sparkCount = big ? 14 : 8
    const sparks: Spark[] = []
    for (let i = 0; i < sparkCount; i++) {
      const s = new THREE.Mesh(
        new THREE.SphereGeometry(0.03, 6, 6),
        new THREE.MeshBasicMaterial({ color: i % 2 ? '#ffd166' : '#ff8c42', toneMapped: false }),
      )
      s.position.copy(pos)
      object.add(s)
      sparks.push({
        mesh: s,
        vel: new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 2.5, (Math.random() - 0.5) * 4),
        life: 0,
      })
    }

    const light = new THREE.PointLight(color, big ? 18 : 9, big ? 7 : 4.5, 2)
    object.add(light)

    parent.add(object)
    explosions.push({ object, age: 0, life: big ? 0.55 : 0.38, sparks, light, color })
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

        const hit = findTargetAt(a.object.position)
        if (hit) {
          spawnExplosion(parent, a.object.position.clone(), new THREE.Color('#ff8c42'), true)
          targetRegistry.knockDown('T-01')
          registerImpact({ points: 5, shots: 0 })
          pushFxMessage(`榴弹命中 +5`)
          exploded = true
        } else if (a.object.position.y < 0.02 || a.life > a.maxLife) {
          spawnExplosion(parent, a.object.position.clone(), new THREE.Color('#ff8c42'), false)
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
          spawnExplosion(parent, pos.clone(), new THREE.Color('#ffc46b'), false)
          targetRegistry.knockDown('T-01')
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
          targetRegistry.knockDown('T-01')
          registerImpact({ points: 15, shots: 0 })
          pushFxMessage('轨道炮命中 +15')
          exploded = true
        } else if (a.life > a.maxLife) {
          spawnExplosion(parent, a.object.position.clone(), new THREE.Color('#67e8f9'), false)
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
          targetRegistry.knockDown('T-01')
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
      const flash = e.object.children[1] as THREE.Mesh
      const coreScale = 0.25 + (1 - k) * 0.95
      core.scale.setScalar(Math.max(0.05, coreScale * k))
      flash.scale.setScalar(Math.max(0.05, coreScale * k * 0.8 + 0.2))
      ;(core.material as THREE.MeshBasicMaterial).opacity = k
      ;(flash.material as THREE.MeshBasicMaterial).opacity = k * 0.9
      e.light.intensity = (e.age < 0.05 ? 30 : 12) * k

      for (const s of e.sparks) {
        s.life += dt
        s.mesh.position.addScaledVector(s.vel, dt)
        s.vel.y -= 3.5 * dt
        ;(s.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - s.life / 0.6)
      }

      if (e.age >= e.life) {
        disposeObject(e.object)
        explosions.splice(i, 1)
      }
    }
  })

  return <group ref={group} />
}
