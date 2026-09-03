import { useEffect, useRef } from 'react'
import { getInputContext } from './inputContext'
import { MOUSE_KEYS, type MouseAction, type InputContextId } from './inputMap'

export interface UseMouseBindingOptions {
  /** 允许触发的上下文；不传表示任意上下文 */
  contexts?: InputContextId[]
  onDown?: (event: MouseEvent) => void
  onUp?: (event: MouseEvent) => void
}

/**
 * 统一鼠标按键分发（P1）：
 * - 组件按动作 id（fire / altFire）注册，鼠标键位集中在 inputMap；
 * - 与 useKeyBinding 一样支持输入上下文过滤。
 */
export function useMouseBinding(action: MouseAction, options: UseMouseBindingOptions = {}): void {
  const optsRef = useRef(options)

  useEffect(() => {
    optsRef.current = options
  }, [options])

  useEffect(() => {
    const buttons = MOUSE_KEYS[action]

    const allowed = () => {
      const contexts = optsRef.current.contexts
      if (!contexts || contexts.length === 0) return true
      return contexts.includes(getInputContext())
    }

    const onMouseDown = (e: MouseEvent) => {
      if (!buttons.includes(e.button)) return
      if (!allowed()) return
      optsRef.current.onDown?.(e)
    }

    const onMouseUp = (e: MouseEvent) => {
      if (!buttons.includes(e.button)) return
      if (!allowed()) return
      optsRef.current.onUp?.(e)
    }

    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp)

    return () => {
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [action])
}
