export function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v))
}

function initialFromUrl(): number {
  if (typeof window === 'undefined') return 0.3
  const raw = new URLSearchParams(window.location.search).get('hem')
  const n = raw === null ? NaN : Number(raw)
  return clamp01(Number.isFinite(n) ? n : 0.3)
}

/**
 * 全局可变的「袜口高度」状态。
 * 不使用 React state，是为了让每帧布料模拟都能直接读取，
 * 同时 HUD 按钮 / URL 参数 / 拖拽都能写入同一个目标值。
 */
export const hoseStore = {
  current: initialFromUrl(),
  target: initialFromUrl(),
  dragging: false,
  setTarget(v: number) {
    hoseStore.target = clamp01(v)
  },
  setMode(mode: 'on' | 'off') {
    hoseStore.target = mode === 'on' ? 1 : 0.3
  },
}

/** 0..1 的袜口进度 -> 腿部曲线参数（0=脚尖，1=髋部） */
export function hemToCurveT(p: number): number {
  return 0.08 + clamp01(p) * 0.92
}

/** 袜口当前所在的世界 Y 范围，用于把指针/平面交点换算成进度 */
export const HEM_Y_MIN = 0.06
export const HEM_Y_MAX = 0.94
