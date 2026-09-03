import type { ControlHint } from '../../input/inputMap'

/**
 * 通用操作提示组件（P1）：
 * - 从 inputMap 的 CONTROL_HINTS 取数据渲染，替换 B/A/Drone 三处写死的提示条；
 * - 键位与真实绑定同源，后续改键只需改 inputMap。
 */
export function ControlHints({ items, className }: { items: ControlHint[]; className: string }) {
  return (
    <aside className={className}>
      {items.map((h, i) => (
        <span key={`${h.keys}-${h.label}-${i}`}>
          <b>{h.keys}</b> {h.label}
        </span>
      ))}
    </aside>
  )
}
