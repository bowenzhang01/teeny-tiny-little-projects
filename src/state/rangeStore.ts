import { useSyncExternalStore } from 'react'

export type WeaponMode = 'grenadeLauncher' | 'railgun' | 'minigun'

export interface HiveState {
  /** 左肩剩余导弹 */
  left: number
  /** 右肩剩余导弹 */
  right: number
  /** 每肩容量 */
  capacity: number
  /** 冷却结束时间戳（performance.now 基准，0 表示无冷却） */
  cooldownUntil: number
  /** 最近一次齐射触发的冷却(ms) */
  volleyCooldown: number
  /** 轮射触发的冷却(ms) */
  streamCooldown: number
}

export interface RangeState {
  /** 总得分 */
  score: number
  /** 命中次数 */
  hits: number
  /** 开枪次数 */
  shots: number
  /** 当前弹夹余弹（保留给老系统，HUD 已按武器系统展示） */
  ammo: number
  /** 弹夹容量 */
  maxAmmo: number
  /** 是否已进入鼠标锁定（射击模式） */
  locked: boolean
  /** 最近一条反馈（脱靶 / 命中部位 / 换弹提示） */
  message: string
  /** 消息自增 id，用于 HUD 触发动画 */
  messageId: number
  /** 标靶被命中的次数（用于触发倒下动画） */
  targetHits: number
  /** 自动锁定中的目标 id */
  lockedTargetId: string | null
  /** 蜂巢导弹状态 */
  hive: HiveState
  /** 小队通信记录（第一批为占位，后续接语音/状态） */
  comms: string[]

  /** 电磁轨道炮：是否已展开（背部左侧） */
  railgunDeployed: boolean
  /** 六管机枪：是否已展开（背部右侧） */
  minigunDeployed: boolean
  /** 轨道炮是否正在充能 */
  railgunCharging: boolean
  /** 轨道炮冷却结束时间戳 */
  railgunCooldownUntil: number
  /** 轨道炮冷却时长(ms) */
  railgunCooldownMax: number
  /** 六管机枪是否在预热（spin-up） */
  minigunSpinning: boolean
  /** 六管机枪是否正在持续射击 */
  minigunFiring: boolean
}

/** 榴弹机枪是否在手（任一件背挂武器展开时，自动隐藏） */
export function grenadeInHand(s: RangeState): boolean {
  return !s.railgunDeployed && !s.minigunDeployed
}

const initial: RangeState = {
  score: 0,
  hits: 0,
  shots: 0,
  ammo: 0,
  maxAmmo: 0,
  locked: false,
  message: '',
  messageId: 0,
  targetHits: 0,
  lockedTargetId: null,
  hive: {
    left: 60,
    right: 60,
    capacity: 60,
    cooldownUntil: 0,
    volleyCooldown: 8000,
    streamCooldown: 1500,
  },
  comms: ['通信通道建立 · B 待命'],
  railgunDeployed: false,
  minigunDeployed: false,
  railgunCharging: false,
  railgunCooldownUntil: 0,
  railgunCooldownMax: 1800,
  minigunSpinning: false,
  minigunFiring: false,
}

let state: RangeState = initial
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

/**
 * 全局极简状态：不用 zustand，保持和旧项目一样的轻量风格。
 * HUD 通过 useRange() 订阅；射击逻辑直接读写 rangeStore。
 */
export const rangeStore = {
  getState: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  set(patch: Partial<RangeState>) {
    state = { ...state, ...patch }
    emit()
  },
  reload() {
    const prev = state
    rangeStore.set({
      ammo: prev.maxAmmo,
      message: '换弹完成',
      messageId: prev.messageId + 1,
    })
  },
  reset() {
    state = { ...initial, locked: state.locked }
    emit()
  },
}

/** 每次开枪统一记账：计分 / 命中率 / 消息 */
export function registerShot({
  hit,
  zone,
  points,
}: {
  hit: boolean
  zone?: string
  points?: number
}) {
  const prev = state
  const score = prev.score + (hit ? points ?? 0 : 0)
  rangeStore.set({
    score,
    hits: prev.hits + (hit ? 1 : 0),
    shots: prev.shots + 1,
    ammo: Math.max(0, prev.ammo - 1),
    targetHits: prev.targetHits + (hit ? 1 : 0),
    message: hit ? (zone ? `命中 ${zone} +${points}` : '命中') : '脱靶',
    messageId: prev.messageId + 1,
  })
}

/**
 * 爆炸类武器（蜂巢导弹/榴弹/轨道炮/六管）的命中记账：
 * 每发命中累加得分与命中数，并按每次触发计入 shots。
 */
export function registerImpact({
  points,
  shots = 1,
}: {
  points: number
  shots?: number
}) {
  const prev = state
  rangeStore.set({
    score: prev.score + points,
    hits: prev.hits + 1,
    shots: prev.shots + shots,
    targetHits: prev.targetHits + 1,
  })
}

export function useRange(): RangeState {
  return useSyncExternalStore(rangeStore.subscribe, rangeStore.getState)
}
