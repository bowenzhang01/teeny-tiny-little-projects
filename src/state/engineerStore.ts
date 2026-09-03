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
  /** 固定哨戒炮塔（C-4 实装部署/回收） */
  turret: {
    deployed: boolean
  }
  /** 部署包库存（C-5 实装放置/引爆） */
  deploy: {
    blueprint: DeployBlueprint
    mines: number
    mineCapacity: number
    barriers: number
    barrierCapacity: number
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
    turret: { deployed: false },
    deploy: {
      blueprint: 'mine',
      mines: 3,
      mineCapacity: 3,
      barriers: 3,
      barrierCapacity: 3,
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
  reset() {
    state = makeInitial()
    emit()
  },
}

export function useEngineer(): EngineerState {
  return useSyncExternalStore(engineerStore.subscribe, engineerStore.getState)
}
