import { useEffect } from 'react'
import { rangeStore } from '../state/rangeStore'
import { playDeploy } from '../audio/sfx'

/**
 * 背挂武器控制：
 * - 1：收回全部，榴弹机枪回手
 * - 2：展开/收回 电磁轨道炮（背部左侧）
 * - 3：展开/收回 六管机枪（背部右侧）
 * 轨道炮与六管可同时展开；任一件展开时榴弹机枪自动隐藏。
 */
export function WeaponControls() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const s = rangeStore.getState()
      if (!s.locked) return

      if (e.code === 'Digit1') {
        if (!s.railgunDeployed && !s.minigunDeployed) return
        rangeStore.set({
          railgunDeployed: false,
          minigunDeployed: false,
          minigunSpinning: false,
          minigunFiring: false,
          railgunCharging: false,
          message: '背挂武器收回 · 榴弹机枪回手',
          messageId: s.messageId + 1,
        })
        playDeploy()
      } else if (e.code === 'Digit2') {
        const next = !s.railgunDeployed
        rangeStore.set({
          railgunDeployed: next,
          railgunCharging: false,
          message: next ? '电磁轨道炮展开' : '电磁轨道炮收回',
          messageId: s.messageId + 1,
        })
        playDeploy()
      } else if (e.code === 'Digit3') {
        const next = !s.minigunDeployed
        rangeStore.set({
          minigunDeployed: next,
          minigunSpinning: false,
          minigunFiring: false,
          message: next ? '六管机枪展开' : '六管机枪收回',
          messageId: s.messageId + 1,
        })
        playDeploy()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return null
}
