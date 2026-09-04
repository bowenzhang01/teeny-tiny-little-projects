import { useSyncExternalStore } from 'react'

export type RavenMode = 'stowed' | 'relay' | 'sweep' | 'strike' | 'stowing'
export type RavenWeapon = 'mg' | 'missile'
export type RavenAiState = 'STOWED' | 'RELAY' | 'SWEEP' | 'STRIKE' | 'LINK' | 'STOWING'

export interface CommsState {
  /** 主武器：AR-05 侦察突击步枪 */
  rifle: {
    mag: number
    magSize: number
    firing: boolean
    reloading: boolean
    reloadUntil: number
    reloadDuration: number
  }
  /** RAVEN-05 大型多用途无人机（侦察/中继/打击） */
  drone: {
    mode: RavenMode
    /** 链路视角（V）：观瞄 + 开火，本体不接管 */
    linkView: boolean
    /** 无人机当前武器（1/2 切换） */
    weapon: RavenWeapon
    mgHeat: number
    mgFiring: boolean
    missileLeft: number
    missileRight: number
    missileCapacity: number
    missileCooldownUntil: number
    /** 通信链路强度 % */
    link: number
    /** 机载电量 % */
    power: number
    /** 传感器标记的最近目标 */
    sensorMark: string | null
    aiState: RavenAiState
    /** 展开/收回过渡结束时间戳（performance.now 基准） */
    transitionUntil: number
  }
  /** TRI-05 三角定位信标 */
  beacon: {
    count: number
    capacity: number
    /** 库存补充完成时间戳（0 表示已满） */
    replenishAt: number
  }
  /** EMP-05 电磁干扰投掷物 */
  emp: {
    count: number
    capacity: number
    /** 库存补充完成时间戳（0 表示已满） */
    replenishAt: number
  }
  /** AR 命中后打上的“侦察标记”（放宽锁定） */
  rifleMark: string | null
  rifleMarkUntil: number
  /** 信标部署后标记的目标（放宽锁定） */
  beaconMark: string | null
  beaconMarkUntil: number
}

function makeInitial(): CommsState {
  return {
    rifle: {
      mag: 30,
      magSize: 30,
      firing: false,
      reloading: false,
      reloadUntil: 0,
      reloadDuration: 1100,
    },
    drone: {
      mode: 'stowed',
      linkView: false,
      weapon: 'mg',
      mgHeat: 0,
      mgFiring: false,
      missileLeft: 2,
      missileRight: 2,
      missileCapacity: 2,
      missileCooldownUntil: 0,
      link: 98.4,
      power: 100,
      sensorMark: null,
      aiState: 'STOWED',
      transitionUntil: 0,
    },
    beacon: {
      count: 3,
      capacity: 3,
      replenishAt: 0,
    },
    emp: {
      count: 2,
      capacity: 2,
      replenishAt: 0,
    },
    rifleMark: null,
    rifleMarkUntil: 0,
    beaconMark: null,
    beaconMarkUntil: 0,
  }
}

let state: CommsState = makeInitial()
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

/** E 通信兵专属运行时状态（与 assault/drone/engineer/medicStore 平行） */
export const commsStore = {
  getState: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  set(patch: Partial<CommsState>) {
    state = { ...state, ...patch }
    emit()
  },
  setRifle(patch: Partial<CommsState['rifle']>) {
    state = { ...state, rifle: { ...state.rifle, ...patch } }
    emit()
  },
  setDrone(patch: Partial<CommsState['drone']>) {
    state = { ...state, drone: { ...state.drone, ...patch } }
    emit()
  },
  setBeacon(patch: Partial<CommsState['beacon']>) {
    state = { ...state, beacon: { ...state.beacon, ...patch } }
    emit()
  },
  setEmp(patch: Partial<CommsState['emp']>) {
    state = { ...state, emp: { ...state.emp, ...patch } }
    emit()
  },
  /** RAVEN 工作模式循环：RELAY → SWEEP → STRIKE → RELAY */
  cycleRavenMode(): RavenMode {
    const cur = state.drone.mode
    const next: RavenMode =
      cur === 'relay' ? 'sweep' : cur === 'sweep' ? 'strike' : cur === 'strike' ? 'relay' : 'relay'
    state = { ...state, drone: { ...state.drone, mode: next, aiState: next.toUpperCase() as RavenAiState } }
    emit()
    return next
  },
  reset() {
    state = makeInitial()
    emit()
  },
}

export function useComms(): CommsState {
  return useSyncExternalStore(commsStore.subscribe, commsStore.getState)
}
