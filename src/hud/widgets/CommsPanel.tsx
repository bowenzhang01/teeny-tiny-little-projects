import type { RoleId } from '../../squad/types'

const MEMBERS: { id: RoleId; role: string; pos: string }[] = [
  { id: 'A', role: 'ASSAULT', pos: 'LIVE 0.0M' },
  { id: 'B', role: 'BREACHER', pos: 'LIVE 1.4M' },
  { id: 'C', role: 'ENGINEER', pos: 'STBY' },
  { id: 'D', role: 'MEDIC', pos: 'STBY' },
  { id: 'E', role: 'COMMS', pos: 'STBY' },
]

const LINES: Record<RoleId, string[]> = {
  A: ['A: LMG ONLINE · GRENADE ARMED', 'B: HIVE POD STANDBY', 'C/D/E: NET 3/5', 'ENCRYPT AES-512'],
  B: ['B: HIVE POD ARMED', 'CH-07 // SYNC OK', 'A/E STANDBY · NET 3/5', 'ENCRYPT AES-512'],
  C: ['C: FORGE ONLINE', 'A/B STANDBY · NET 3/5', 'ENCRYPT AES-512'],
  D: ['D: MEDICAL READY', 'A/B STANDBY · NET 3/5', 'ENCRYPT AES-512'],
  E: ['E: LINK STABLE', 'A/B STANDBY · NET 3/5', 'ENCRYPT AES-512'],
}

/**
 * 通用小队通信面板：通信流 + 队友位置/状态。
 * 所有角色 HUD 共用；activeId 高亮当前操作者。
 */
export function CommsPanel({ squad, activeId }: { squad: string; activeId: RoleId }) {
  const lines = LINES[activeId]
  return (
    <section className="tac comms">
      <h3>COMMS LINK // {squad}</h3>
      <div className="comms-line live">▸ {lines[0]}</div>
      {lines.slice(1).map((l) => (
        <div key={l} className="comms-line">{`▸ ${l}`}</div>
      ))}
      <div className="squad-pos">
        {MEMBERS.map((m) => (
          <div key={m.id} className={`squad-pos-row ${m.id === activeId ? 'active' : ''}`}>
            <b>{m.id}</b>
            <span className="sq-role-placeholder">{m.role}</span>
            <em>{m.pos}</em>
          </div>
        ))}
      </div>
    </section>
  )
}
