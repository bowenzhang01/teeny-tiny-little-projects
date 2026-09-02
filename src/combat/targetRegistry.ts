import * as THREE from 'three'

export interface RegisteredTarget {
  id: string
  name: string
  /** 用于自动锁定/标记的根对象（通常是标靶分组） */
  object: THREE.Object3D
  /** 锁定基准点（根对象局部坐标，通常取胸口） */
  aimLocal: THREE.Vector3
  alive: boolean
  /** 缓存的包围盒（静态标靶注册时计算一次，未来移动标靶可标记 dirty） */
  bounds?: THREE.Box3
}

const targets = new Map<string, RegisteredTarget>()
const downUntil = new Map<string, number>()
let camera: THREE.Camera | null = null

const _b = new THREE.Box3()

export const targetRegistry = {
  setCamera(c: THREE.Camera | null) {
    camera = c
  },
  getCamera() {
    return camera
  },
  register(t: RegisteredTarget) {
    this.updateBounds(t)
    targets.set(t.id, t)
  },
  unregister(id: string) {
    targets.delete(id)
    downUntil.delete(id)
  },
  /** 命中后让标靶倒下（不依赖 React 订阅，帧循环直接读取） */
  knockDown(id: string, duration = 2400) {
    downUntil.set(id, performance.now() + duration)
  },
  isDown(id: string): boolean {
    const until = downUntil.get(id)
    return until !== undefined && performance.now() < until
  },
  get(id: string) {
    return targets.get(id) ?? null
  },
  all(): RegisteredTarget[] {
    return [...targets.values()]
  },
  alive(): RegisteredTarget[] {
    return this.all().filter((t) => t.alive)
  },
  /** 更新标靶的世界瞄准点 */
  aimWorld(t: RegisteredTarget, out: THREE.Vector3 = new THREE.Vector3()): THREE.Vector3 {
    t.object.getWorldPosition(out)
    out.add(t.aimLocal)
    return out
  },
  updateBounds(t: RegisteredTarget): THREE.Box3 {
    t.bounds = _b.setFromObject(t.object).clone()
    return t.bounds
  },
  /** 点是否落在某个标靶包围盒内（稍微外扩，方便爆炸判定） */
  pointInTarget(pos: THREE.Vector3, t: RegisteredTarget, expand = 0.18): boolean {
    if (!t.bounds) this.updateBounds(t)
    return t.bounds!.clone().expandByScalar(expand).containsPoint(pos)
  },
  /** 世界坐标投影到屏幕像素坐标（无相机或不可见返回 null） */
  projectToScreen(world: THREE.Vector3, width: number, height: number): { x: number; y: number; behind: boolean } | null {
    if (!camera) return null
    const ndc = world.clone().project(camera)
    const behind = ndc.z > 1 || ndc.z < -1
    return {
      x: (ndc.x * 0.5 + 0.5) * width,
      y: (-ndc.y * 0.5 + 0.5) * height,
      behind,
    }
  },
}
