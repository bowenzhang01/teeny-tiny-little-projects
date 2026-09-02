import type { CSSProperties } from 'react'
import { useActiveRole } from '../state/characterStore'
import { SQUAD } from '../squad'
import { SquadSelector } from './SquadSelector'

/**
 * HUD 外壳：
 * - 负责按当前角色加载对应 HUD Layout
 * - 注入该角色的主题色（--hud-primary / --hud-secondary）
 * - 顶部挂小队选人卡片栏
 */
export function Hud({ ready }: { ready: boolean }) {
  const role = useActiveRole()
  const config = SQUAD[role]
  const Layout = config.hud

  return (
    <div
      className={`hud-shell theme-${role.toLowerCase()}`}
      style={
        {
          '--hud-primary': config.theme.primary,
          '--hud-secondary': config.theme.secondary,
        } as CSSProperties
      }
    >
      <SquadSelector />
      <Layout ready={ready} />
    </div>
  )
}
