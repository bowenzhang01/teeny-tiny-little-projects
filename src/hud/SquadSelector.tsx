import type { CSSProperties } from 'react'
import { characterStore, useActiveRole } from '../state/characterStore'
import { SQUAD, ROLE_IDS } from '../squad'

/** 小队选人栏：A–E 五张卡片，点击切换当前角色 */
export function SquadSelector() {
  const active = useActiveRole()

  return (
    <div className="squad-selector">
      {ROLE_IDS.map((id) => {
        const c = SQUAD[id]
        const on = id === active
        return (
          <button
            key={id}
            className={`squad-card ${on ? 'active' : ''} ${c.playable ? '' : 'wip'}`}
            style={{ '--sq-color': c.theme.primary } as CSSProperties}
            onClick={() => characterStore.setRole(id)}
            title={c.theme.desc}
          >
            <span className="sq-code">{id}</span>
            <span className="sq-role">{c.role}</span>
            <em>{c.playable ? 'READY' : 'WIP'}</em>
          </button>
        )
      })}
    </div>
  )
}
