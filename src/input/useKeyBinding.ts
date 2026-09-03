import { useEffect, useRef } from 'react'
import { getInputContext } from './inputContext'
import { INPUT_KEYS, type InputAction, type InputContextId } from './inputMap'

export interface UseKeyBindingOptions {
  /** 允许触发的上下文；不传表示任意上下文 */
  contexts?: InputContextId[]
  onDown?: (event: KeyboardEvent) => void
  onUp?: (event: KeyboardEvent) => void
}

/**
 * 统一按键分发（P1）：
 * - 组件通过动作 id 注册 onDown/onUp，不再自己监听 window keydown/keyup；
 * - 键位取自 inputMap，上下文按 getInputContext() 过滤；
 * - 切换上下文 / 失焦等输入重置由各组件挂 useInputReset 处理。
 */
export function useKeyBinding(action: InputAction, options: UseKeyBindingOptions = {}): void {
  const optsRef = useRef(options)

  useEffect(() => {
    optsRef.current = options
  }, [options])

  useEffect(() => {
    const codes = INPUT_KEYS[action]

    const allowed = () => {
      const contexts = optsRef.current.contexts
      if (!contexts || contexts.length === 0) return true
      return contexts.includes(getInputContext())
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (!codes.includes(e.code)) return
      if (!allowed()) return
      optsRef.current.onDown?.(e)
    }

    const onKeyUp = (e: KeyboardEvent) => {
      if (!codes.includes(e.code)) return
      if (!allowed()) return
      optsRef.current.onUp?.(e)
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [action])
}
