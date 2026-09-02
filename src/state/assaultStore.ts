import { useSyncExternalStore } from 'react'

export type GrenadeKind = 'frag' | 'flash' | 'incendiary'

export interface GrenadeSlot {
  type: GrenadeKind
  label: string
  color: string
  count: number
}

export interface AssaultState {
  /** LMG 弹匣余弹 */
  mag: number
  /** LMG 弹匣容量 */
  magSize: number
  /** 枪管热度 0~1（越高散布越大） */
  heat: number
  /** 是否正在按住射击（HUD 状态用） */
  firing: boolean
  /** 是否正在换弹 */
  reloading: boolean
  /** 换弹结束时间戳（performance.now 基准） */
  reloadUntil: number
  /** 换弹耗时(ms) */
  reloadDuration: number
  /** 激光瞄具开关 */
  laserOn: boolean
  /** 稳定瞄准（右键按住：收束散布） */
  stabilize: boolean
  /** 手雷库存 */
  grenades: GrenadeSlot[]
  /** 当前选中的手雷 */
  grenadeIndex: number
  /** 双肩激光反导系统 */
  ciws: {
    /** 系统是否在线（角色挂载且已锁定） */
    online: boolean
    /** 当前激光标记追踪的目标 id */
    tracking: string | null
  }
}

function makeInitial(): AssaultState {
  return {
    mag: 120,
    magSize: 120,
    heat: 0,
    firing: false,
    reloading: false,
    reloadUntil: 0,
    reloadDuration: 1400,
    laserOn: true,
    stabilize: false,
    grenades: [
      { type: 'frag', label: 'FRAG', color: '#ff8a5c', count: 4 },
      { type: 'flash', label: 'FLASH', color: '#fde68a', count: 3 },
      { type: 'incendiary', label: 'INC', color: '#ff9f43', count: 3 },
    ],
    grenadeIndex: 0,
    ciws: { online: false, tracking: null },
  }
}

let state: AssaultState = makeInitial()
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

/**
 * A 突击兵专属武器运行时状态。
 * 与 rangeStore 分开：B 的轨道炮/六管字段和 A 的 LMG/手雷/CIWS 互不污染。
 */
export const assaultStore = {
  getState: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  set(patch: Partial<AssaultState>) {
    state = { ...state, ...patch }
    emit()
  },
  reset() {
    state = makeInitial()
    emit()
  },
  /** 当前选中手雷 */
  currentGrenade(): GrenadeSlot {
    return state.grenades[state.grenadeIndex]
  },
  /** 循环切换到下一枚有库存的手雷 */
  cycleGrenade() {
    const n = state.grenades.length
    for (let i = 1; i <= n; i++) {
      const idx = (state.grenadeIndex + i) % n
      if (state.grenades[idx].count > 0) {
        assaultStore.set({ grenadeIndex: idx })
        return
      }
    }
  },
}

export function useAssault(): AssaultState {
  return useSyncExternalStore(assaultStore.subscribe, assaultStore.getState)
}
