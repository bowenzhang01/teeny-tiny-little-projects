import { useActiveRole } from '../../state/characterStore'
import { SQUAD } from '../../squad'

/** 未实装角色的占位 HUD：证明“每个角色 HUD 独立”的框架可切换 */
export function PlaceholderHud({ ready }: { ready: boolean }) {
  const role = useActiveRole()
  const cfg = SQUAD[role]
  void ready

  return (
    <div className="hud placeholder-hud">
      <div className="placeholder-center">
        <span className="ph-code">{role}</span>
        <h1>{cfg.title}</h1>
        <p className="ph-en">{cfg.role} // UNDER CONSTRUCTION</p>
        <p className="ph-note">HUD 与武器装备尚未实装 · 先保持靶场练习</p>
      </div>
      <footer className="ready">○ CLICK TO ENGAGE</footer>
    </div>
  )
}
