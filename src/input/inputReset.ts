/**
 * 输入重置总线（P0）：
 * - 窗口失焦 / 指针锁定丢失 / 上下文（角色/遥控）切换 / 换人 / 卸载时，
 *   所有仍持有"按下状态"的输入模块都注册到这里，统一被清空。
 * - 解决文档 2.1 的"卡键"问题：keyup 丢失时不会再残留 WASD/Space/鼠标状态。
 */

export type InputResetReason =
  | 'blur'
  | 'lock-loss'
  | 'context'
  | 'role-switch'
  | 'unmount'
  | 'stow'

type ResetHandler = (reason: InputResetReason) => void

const handlers = new Set<ResetHandler>()

export function subscribeInputReset(handler: ResetHandler): () => void {
  handlers.add(handler)
  return () => handlers.delete(handler)
}

export function triggerInputReset(reason: InputResetReason): void {
  for (const handler of handlers) handler(reason)
}
