import { useRange } from '../../state/rangeStore'

/**
 * 屏幕闪光（闪光弹/爆炸白闪共用）：
 * 监听 rangeStore.screenFlashUntil，用一次短暂白屏动画表达强烈爆闪。
 * key 变化时会重新触发 CSS 动画；动画结束后保持透明，无定时器状态。
 */
export function ScreenFlash() {
  const { screenFlashUntil } = useRange()

  if (screenFlashUntil <= 0) return null
  return <div key={screenFlashUntil} className="screen-flash" aria-hidden />
}
