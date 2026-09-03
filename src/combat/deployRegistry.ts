import * as THREE from 'three'

export interface DeployObstacle {
  id: string
  kind: 'mine' | 'barrier'
  position: THREE.Vector3
  /** 小碰撞体积半径（未来角色移动/机器人寻路用；当前不参与弹道） */
  radius: number
}

const obstacles = new Map<string, DeployObstacle>()

/** C 部署物的轻量碰撞/占位注册表（当前只登记，不参与弹道与锁定） */
export const deployRegistry = {
  register(o: DeployObstacle) {
    obstacles.set(o.id, o)
  },
  unregister(id: string) {
    obstacles.delete(id)
  },
  clear() {
    obstacles.clear()
  },
  all(): DeployObstacle[] {
    return [...obstacles.values()]
  },
}
