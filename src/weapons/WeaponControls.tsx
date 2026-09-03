import { rangeStore } from '../state/rangeStore'
import { playDeploy } from '../audio/sfx'
import { useKeyBinding } from '../input/useKeyBinding'

/**
 * 背挂武器控制（P1：统一按键分发）：
 * - 1：收回全部，榴弹机枪回手
 * - 2：展开/收回 电磁轨道炮（背部左侧）
 * - 3：展开/收回 六管机枪（背部右侧）
 * 轨道炮与六管可同时展开；任一件展开时榴弹机枪自动隐藏。
 * 部署/收回期间进入 weaponBusyUntil 忙碌状态，屏蔽开火输入。
 */
export function WeaponControls() {
  useKeyBinding('stowBackWeapons', {
    onDown: () => {
      const s = rangeStore.getState()
      if (!s.locked) return
      if (performance.now() < s.weaponBusyUntil) return
      if (!s.railgunDeployed && !s.minigunDeployed) return
      rangeStore.set({
        railgunDeployed: false,
        minigunDeployed: false,
        minigunSpinning: false,
        minigunFiring: false,
        railgunCharging: false,
        weaponBusyUntil: performance.now() + 400,
        message: '背挂武器收回 · 榴弹机枪回手',
        messageId: s.messageId + 1,
      })
      playDeploy()
    },
  })

  useKeyBinding('toggleRailgun', {
    onDown: () => {
      const s = rangeStore.getState()
      if (!s.locked) return
      if (performance.now() < s.weaponBusyUntil) return
      const next = !s.railgunDeployed
      rangeStore.set({
        railgunDeployed: next,
        railgunCharging: false,
        weaponBusyUntil: performance.now() + 400,
        message: next ? '电磁轨道炮展开' : '电磁轨道炮收回',
        messageId: s.messageId + 1,
      })
      playDeploy()
    },
  })

  useKeyBinding('toggleMinigun', {
    onDown: () => {
      const s = rangeStore.getState()
      if (!s.locked) return
      if (performance.now() < s.weaponBusyUntil) return
      const next = !s.minigunDeployed
      rangeStore.set({
        minigunDeployed: next,
        minigunSpinning: false,
        minigunFiring: false,
        weaponBusyUntil: performance.now() + 400,
        message: next ? '六管机枪展开' : '六管机枪收回',
        messageId: s.messageId + 1,
      })
      playDeploy()
    },
  })

  return null
}
