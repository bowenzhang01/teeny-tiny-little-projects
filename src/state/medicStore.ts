import { useSyncExternalStore } from 'react'

export type MedicWeapon = 'smg' | 'dart'
export type DroneMode = 'stowed' | 'hover' | 'assist'
export type DroneSupport = 'heal' | 'enhance' | 'cloak'

export interface MedicState {
  /** 当前手中武器：1=SMG，2=镇定剂针枪 */
  weapon: MedicWeapon
  /** 轻型冲锋枪（D-1） */
  smg: {
    mag: number
    magSize: number
    firing: boolean
    reloading: boolean
    reloadUntil: number
    reloadDuration: number
  }
  /** 镇定剂针枪（D-2） */
  dart: {
    ammo: number
    capacity: number
    cooldownUntil: number
    cooldownMs: number
    reloading: boolean
    reloadUntil: number
    reloadDuration: number
  }
  /** 烟雾弹（D-3） */
  smoke: {
    count: number
    capacity: number
    /** 库存补充完成时间戳（performance.now 基准，0 表示已满） */
    replenishAt: number
  }
  /** 四台支援无人机 D1–D4（D-4，三种支援模式现场切换） */
  drones: {
    mode: DroneMode
    support: DroneSupport
    /** 无人机传感器当前标记的最近目标（放宽锁定阈值） */
    sensorTarget: string | null
    /** 展开/收回过渡结束时间戳（performance.now 基准） */
    transitionUntil: number
  }
}

function makeInitial(): MedicState {
  return {
    weapon: 'smg',
    smg: {
      mag: 40,
      magSize: 40,
      firing: false,
      reloading: false,
      reloadUntil: 0,
      reloadDuration: 1200,
    },
    dart: {
      ammo: 6,
      capacity: 6,
      cooldownUntil: 0,
      cooldownMs: 650,
      reloading: false,
      reloadUntil: 0,
      reloadDuration: 1800,
    },
    smoke: {
      count: 3,
      capacity: 3,
      replenishAt: 0,
    },
    drones: {
      mode: 'stowed',
      support: 'heal',
      sensorTarget: null,
      transitionUntil: 0,
    },
  }
}

let state: MedicState = makeInitial()
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

/** D 医疗兵专属运行时状态（与 rangeStore/assaultStore/droneStore/engineerStore 平行） */
export const medicStore = {
  getState: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  set(patch: Partial<MedicState>) {
    state = { ...state, ...patch }
    emit()
  },
  setSmg(patch: Partial<MedicState['smg']>) {
    state = { ...state, smg: { ...state.smg, ...patch } }
    emit()
  },
  setDart(patch: Partial<MedicState['dart']>) {
    state = { ...state, dart: { ...state.dart, ...patch } }
    emit()
  },
  setSmoke(patch: Partial<MedicState['smoke']>) {
    state = { ...state, smoke: { ...state.smoke, ...patch } }
    emit()
  },
  setDrones(patch: Partial<MedicState['drones']>) {
    state = { ...state, drones: { ...state.drones, ...patch } }
    emit()
  },
  /** T：HEAL → ENHANCE → CLOAK 循环 */
  cycleSupport() {
    const next: DroneSupport =
      state.drones.support === 'heal' ? 'enhance' : state.drones.support === 'enhance' ? 'cloak' : 'heal'
    state = { ...state, drones: { ...state.drones, support: next } }
    emit()
  },
  reset() {
    state = makeInitial()
    emit()
  },
}

export function useMedic(): MedicState {
  return useSyncExternalStore(medicStore.subscribe, medicStore.getState)
}
