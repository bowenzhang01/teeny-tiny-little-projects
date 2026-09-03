import { useEffect, useRef } from 'react'
import { subscribeInputReset, type InputResetReason } from './inputReset'

/**
 * 在组件里订阅全局输入重置：窗口失焦 / 指针锁定丢失 / 上下文切换等
 * 发生时回调，用于清空组件内部的 ref 按下状态。
 */
export function useInputReset(handler: (reason: InputResetReason) => void): void {
  const ref = useRef(handler)

  useEffect(() => {
    ref.current = handler
  }, [handler])

  useEffect(() => {
    const unsubscribe = subscribeInputReset((reason) => ref.current(reason))
    return unsubscribe
  }, [])
}
