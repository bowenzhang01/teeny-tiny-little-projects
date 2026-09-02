import { useSyncExternalStore } from 'react'

export type DroneMode = 'stowed' | 'auto' | 'remote'
export type DroneWeapon = 'mg' | 'missile'
export type DroneAiState = 'PATROL' | 'SCAN' | 'MOVE_TO' | 'ENGAGE' | 'HOLD' | 'REMOTE'

export interface DroneState {
  /** 机器人状态：收起 / 自动巡逻 / 手动遥控 */
  mode: DroneMode
  battery: number
  link: number
  /** 当前速度（m/s，HUD 用） */
  speed: number
  /** 当前武器（手动模式切换） */
  weapon: DroneWeapon
  /** 机枪塔热量 0~1 */
  mgHeat: number
  mgFiring: boolean
  /** 导弹舱余弹（左右各 n 发） */
  missileLeft: number
  missileRight: number
  missileCapacity: number
  /** 导弹冷却结束时间戳（performance.now 基准） */
  missileCooldownUntil: number
  /** 传感器当前标记的目标 id */
  sensorMark: string | null
  /** 机身完整度 0~100 */
  integrity: number
  /** AI 当前行为（HUD 显示用） */
  aiState: DroneAiState
}

function makeInitial(): DroneState {
  return {
    mode: 'stowed',
    battery: 100,
    link: 98.4,
    speed: 0,
    weapon: 'mg',
    mgHeat: 0,
    mgFiring: false,
    missileLeft: 4,
    missileRight: 4,
    missileCapacity: 4,
    missileCooldownUntil: 0,
    sensorMark: null,
    integrity: 100,
    aiState: 'HOLD',
  }
}

let state: DroneState = makeInitial()
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

/**
 * 四足机器人运行时状态（独立于 assaultStore）。
 * 运动学/航点/遥控相机等高频数据放在 QuadDrone 的 ref 里，
 * 这里只存 HUD 需要且低频更新的状态。
 */
export const droneStore = {
  getState: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  set(patch: Partial<DroneState>) {
    state = { ...state, ...patch }
    emit()
  },
  reset() {
    state = makeInitial()
    emit()
  },
}

export function useDrone(): DroneState {
  return useSyncExternalStore(droneStore.subscribe, droneStore.getState)
}
