import { useEffect } from 'react'
import { rangeStore } from '../state/rangeStore'
import { triggerInputReset } from './inputReset'

/**
 * 全局输入卫生（放在 App 根组件调用一次）：
 * - pointerlockchange：统一把 rangeStore.locked 与 document.pointerLockElement 对齐，
 *   丢失锁定时清空所有按下状态（解决文档 2.1 的"指针锁定状态不同步"）。
 * - blur / 页面隐藏：清空所有按下状态（解决"窗口失焦/最小化后恢复卡键"）。
 */
export function useInputHygiene(): void {
  useEffect(() => {
    const syncLock = () => {
      const locked = document.pointerLockElement !== null
      rangeStore.set({
        locked,
        lockedTargetId: locked ? rangeStore.getState().lockedTargetId : null,
      })
      if (!locked) triggerInputReset('lock-loss')
    }

    const onBlur = () => triggerInputReset('blur')
    const onVisibilityChange = () => {
      if (document.hidden) triggerInputReset('blur')
    }

    document.addEventListener('pointerlockchange', syncLock)
    window.addEventListener('blur', onBlur)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      document.removeEventListener('pointerlockchange', syncLock)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])
}
