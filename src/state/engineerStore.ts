import { useSyncExternalStore } from 'react'

export type ArmsMode = 'stowed' | 'operate' | 'busy'
export type DeployBlueprint = 'mine' | 'barrier'

export interface EngineerState {
  /** 等离子激光枪运行时状态 */
  plasma: {
    energy: number
    maxEnergy: number
    heat: number
    firing: boolean
    overcharge: boolean
    /** R 散热/能量核心快充中 */
    venting: boolean
    ventUntil: number
  }
  /** 四机械臂状态（C-3 实装展开/动画） */
  armsMode: ArmsMode
  /** 固定哨戒炮塔（C-4 实装部署/回收；手动遥控同 C-5 批次） */
  turret: {
    deployed: boolean
    x: number
    z: number
    /** 手动遥控（类似 A 机器人 REMOTE，但不移动） */
    manual: boolean
  }
  /** 部署包库存（C-5 实装放置/引爆） */
  deploy: {
    blueprint: DeployBlueprint
    mines: number
    mineCapacity: number
    barriers: number
    barrierCapacity: number
    /** 库存自动补充时间戳（performance.now 基准） */
    replenishAt: number
    /** 进行中的部署动作：四臂先伸手，然后操作部署物装配，最后收回 */
    pending: null | {
      id: string
      kind: 'turret' | 'mine' | 'barrier'
      x: number
      z: number
      commitAt: number
      operateUntil: number
    }
  }
}

function makeInitial(): EngineerState {
  return {
    plasma: {
      energy: 100,
      maxEnergy: 100,
      heat: 0,
      firing: false,
      overcharge: false,
      venting: false,
      ventUntil: 0,
    },
    armsMode: 'stowed',
    turret: { deployed: false, x: 0, z: 0, manual: false },
    deploy: {
      blueprint: 'mine',
      mines: 3,
      mineCapacity: 3,
      barriers: 3,
      barrierCapacity: 3,
      replenishAt: 0,
      pending: null,
    },
  }
}

let state: EngineerState = makeInitial()
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

/** C 工程兵专属运行时状态（与 rangeStore/assaultStore/droneStore 平行） */
export const engineerStore = {
  getState: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  set(patch: Partial<EngineerState>) {
    state = { ...state, ...patch }
    emit()
  },
  /** 修改 plasma 子状态（减少调用方展开整个对象） */
  setPlasma(patch: Partial<EngineerState['plasma']>) {
    state = { ...state, plasma: { ...state.plasma, ...patch } }
    emit()
  },
  /** 四臂进入 BUSY 部署动画一段时间后回到 OPERATE */
  runArmsBusy(ms = 850) {
    state = { ...state, armsMode: 'busy' }
    emit()
    window.setTimeout(() => {
      if (state.armsMode === 'busy') {
        state = { ...state, armsMode: 'operate' }
        emit()
      }
    }, ms)
  },
  /** 开始一次部署：四臂先伸手（commitAt），再对部署物操作（operateUntil） */
  beginDeploy(
    kind: 'turret' | 'mine' | 'barrier',
    x: number,
    z: number,
    commitDelay = 700,
    operateDuration = 1000,
  ): string {
    const id = `deploy-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const commitAt = performance.now() + commitDelay
    state = {
      ...state,
      armsMode: 'busy',
      deploy: {
        ...state.deploy,
        pending: { id, kind, x, z, commitAt, operateUntil: commitAt + operateDuration },
      },
    }
    emit()
    return id
  },
  /** 部署动作完成：清掉 pending，四臂稍作停留后回到 OPERATE */
  commitDeploy(id: string) {
    const pending = state.deploy.pending
    if (!pending || pending.id !== id) return
    state = { ...state, deploy: { ...state.deploy, pending: null } }
    emit()
    if (state.armsMode === 'busy') {
      window.setTimeout(() => {
        if (state.armsMode === 'busy') {
          state = { ...state, armsMode: 'operate' }
          emit()
        }
      }, 380)
    }
  },
  /** 取消进行中的部署（1 收回全部时使用）：清 pending 并收起四臂 */
  cancelPendingDeploy() {
    if (!state.deploy.pending) return
    state = { ...state, deploy: { ...state.deploy, pending: null }, armsMode: 'stowed' }
    emit()
  },
  reset() {
    state = makeInitial()
    emit()
  },
}

export function useEngineer(): EngineerState {
  return useSyncExternalStore(engineerStore.subscribe, engineerStore.getState)
}
