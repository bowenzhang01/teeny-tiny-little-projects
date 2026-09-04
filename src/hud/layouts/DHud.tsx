import { useEffect, useReducer, useState, type CSSProperties } from 'react'
import { useRange } from '../../state/rangeStore'
import { useMedic, type DroneSupport, type MedicState } from '../../state/medicStore'
import { targetRegistry } from '../../combat/targetRegistry'
import { CompassStrip } from '../widgets/CompassStrip'
import { Radar } from '../widgets/Radar'
import { EnemyMarkers } from '../widgets/EnemyMarkers'
import { DecoStrip } from '../widgets/DecoStrip'
import { ScreenFlash } from '../widgets/ScreenFlash'
import { BioPanel } from '../widgets/BioPanel'
import { ExoPanel } from '../widgets/ExoPanel'
import { CommsPanel } from '../widgets/CommsPanel'
import { ControlHints } from '../widgets/ControlHints'
import { CONTROL_HINTS } from '../../input/inputMap'
import { useKeyBinding } from '../../input/useKeyBinding'

const D_DECO_POOL = [
  'D // MEND-04',
  'ECG NOMINAL',
  'DRONE LINK 4/4',
  'MED KIT READY',
  'NET 97%',
  'SAT 4/7',
]

const SUPPORT_MODES: DroneSupport[] = ['heal', 'enhance', 'cloak']

interface TriageRow {
  id: string
  role: string
  hr: number
  o2: number
  status: 'NOMINAL' | 'WOUNDED' | 'CRITICAL'
  combat: string
  color: string
}

/** 占位/模拟的队友医疗状态（未来接全员同场 + 真实生命值） */
const TRIAGE: TriageRow[] = [
  { id: 'A', role: 'ASSAULT', hr: 106, o2: 97.2, status: 'NOMINAL', combat: 'ENGAGE', color: '#f87171' },
  { id: 'B', role: 'BREACHER', hr: 114, o2: 96.1, status: 'NOMINAL', combat: 'SUP', color: '#41e3ff' },
  { id: 'C', role: 'ENGINEER', hr: 96, o2: 97.9, status: 'NOMINAL', combat: 'STBY', color: '#fbbf24' },
  { id: 'E', role: 'COMMS', hr: 88, o2: 98.3, status: 'NOMINAL', combat: 'LINK', color: '#c084fc' },
]

function triageLink(medic: MedicState): string {
  if (medic.drones.mode === 'stowed') return 'LINK'
  if (medic.drones.support === 'cloak') return 'CLOAK'
  if (medic.drones.support === 'heal') return 'HEAL'
  return 'ENH'
}

/** 队友三查面板（SQUAD TRIAGE） */
function DTriage({ medic }: { medic: MedicState }) {
  return (
    <section className="d-panel triage">
      <header className="d-panel-head">
        <h3>SQUAD TRIAGE // MED</h3>
        <em className="on">LIVE LINK 4/4</em>
      </header>
      <div className="d-triage-list">
        {TRIAGE.map((t) => (
          <div key={t.id} className="d-triage-row" style={{ '--sq-color': t.color } as CSSProperties}>
            <b className="d-triage-id">{t.id}</b>
            <span className="d-triage-role">{t.role}</span>
            <em className="d-triage-hr">{t.hr}<small>HR</small></em>
            <i className="d-triage-o2">{t.o2.toFixed(1)}%</i>
            <span className={`d-triage-status ${t.status.toLowerCase()}`}>{t.status}</span>
            <b className="d-triage-link">{triageLink(medic)}</b>
          </div>
        ))}
      </div>
      <div className="d-triage-note">VIRTUAL HOLO TEAM · A/B/C/E LINKS</div>
    </section>
  )
}

/** 目标列表：动态读取 targetRegistry */
function DTargetList({ lockedTargetId }: { lockedTargetId: string | null }) {
  const [list, setList] = useState<{ id: string; name: string; dist: number }[]>([])
  useEffect(() => {
    const timer = window.setInterval(() => {
      const cam = targetRegistry.getCamera()
      if (!cam) return
      setList(
        targetRegistry.all().map((t) => {
          const p = targetRegistry.aimWorld(t)
          return { id: t.id, name: t.name, dist: p.distanceTo(cam.position) }
        }),
      )
    }, 300)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <div className="d-target-list">
      {list.map((t) => (
        <div key={t.id} className={`d-target-line ${lockedTargetId === t.id ? 'active' : ''}`}>
          <span>{t.id}</span>
          <b>{t.dist < 10 ? t.dist.toFixed(1) : '--'}M</b>
          <em>{lockedTargetId === t.id ? 'LOCK' : 'SCAN'}</em>
        </div>
      ))}
      {list.length === 0 && (
        <div className="d-target-line dim">
          <span>--</span>
          <b>--</b>
          <em>NO TGT</em>
        </div>
      )}
    </div>
  )
}

/**
 * D 医疗兵专属 HUD：绿色医疗终端（全队最复杂）。
 * 专属内容：队友三查面板 / 无人机矩阵 / 支援模式状态 / SMG+DART+SMOKE 武器面板。
 */
export function DHud({ ready }: { ready: boolean }) {
  const { score, hits, shots, locked, message, messageId, lockedTargetId } = useRange()
  const m = useMedic()
  const [, tick] = useReducer((x: number) => x + 1, 0)
  const [nowMs, setNowMs] = useState(0)
  const [nv, setNv] = useState(false)

  useEffect(() => {
    const timer = window.setInterval(() => {
      tick()
      setNowMs(performance.now())
    }, 120)
    return () => window.clearInterval(timer)
  }, [])

  useKeyBinding('nightVision', {
    contexts: ['roleHud'],
    onDown: (e) => {
      if (e.repeat) return
      setNv((v) => !v)
    },
  })
  useEffect(() => {
    document.body.classList.toggle('nv', nv)
  }, [nv])

  const now = nowMs
  const smgReloadPct = m.smg.reloading
    ? Math.max(0, Math.min(100, 100 - (Math.max(0, m.smg.reloadUntil - now) / m.smg.reloadDuration) * 100))
    : 0
  const dartReloadPct = m.dart.reloading
    ? Math.max(0, Math.min(100, 100 - (Math.max(0, m.dart.reloadUntil - now) / m.dart.reloadDuration) * 100))
    : 0
  const dartCdSec = Math.max(0, m.dart.cooldownUntil - now) / 1000
  const smokeRefillSec = m.smoke.replenishAt > 0 ? Math.max(0, (m.smoke.replenishAt - now) / 1000) : 0
  const accuracy = shots > 0 ? Math.min(100, Math.round((hits / shots) * 100)) : 0
  const droneActive = m.drones.mode !== 'stowed'
  const support = m.drones.support.toUpperCase()
  const weaponLabel = m.weapon === 'smg' ? 'MEDIC SMG' : 'TRANQ DART'

  return (
    <div className="hud d-hud">
      <ScreenFlash />
      <div className="d-frame" aria-hidden />
      <div className="d-med-cross" aria-hidden>✚</div>

      {/* 顶栏 */}
      <header className="d-topbar">
        <div className="d-brand">
          <b>D // MEND-04</b>
          <span>SQUAD-D · MEDICAL OPS</span>
        </div>
        <CompassStrip />
        <div className="d-top-right">
          <span>ECG NOMINAL</span>
          <span>DRONE LINK {droneActive ? m.drones.mode.toUpperCase() : 'STBY'}</span>
          <span className={nv ? 'on' : ''}>NV {nv ? 'ON' : 'OFF'}</span>
        </div>
      </header>

      {/* 左列：生命体征 + 外骨骼 + 队友三查 */}
      <aside className="d-left">
        <BioPanel operator="D" shots={shots} />
        <ExoPanel label="EXO-SUIT // MK.IV-D" />
        <DTriage medic={m} />
      </aside>

      {/* 右列：武器 + 无人机矩阵 + 战术 */}
      <aside className="d-right">
        <section className="d-panel weapons">
          <header className="d-panel-head">
            <h3>WEAPONS // D</h3>
            <em className="on">{weaponLabel}</em>
          </header>
          <div className="d-weapon-slots">
            <div className={`d-weapon-slot ${m.weapon === 'smg' ? 'active' : ''}`}>
              <b>SMG</b>
              <span>{m.smg.mag}/{m.smg.magSize}</span>
            </div>
            <div className={`d-weapon-slot ${m.weapon === 'dart' ? 'active' : ''}`}>
              <b>DART</b>
              <span>{m.dart.ammo}/{m.dart.capacity}</span>
            </div>
          </div>

          {m.weapon === 'smg' ? (
            <div className="d-mag-block">
              <div className="d-mag">
                <b>{m.smg.mag}</b>
                <span>/ {m.smg.magSize}</span>
                <em>{m.smg.reloading ? 'RELOAD' : m.smg.mag <= 8 ? 'LOW' : 'READY'}</em>
              </div>
              {m.smg.reloading && (
                <div className="d-reload"><i style={{ width: `${smgReloadPct}%` }} /></div>
              )}
            </div>
          ) : (
            <div className="d-dart-block">
              <div className="d-dart-row">
                <span>COOLDOWN</span>
                <b>{dartCdSec > 0 ? `${dartCdSec.toFixed(1)}S` : 'READY'}</b>
                <em>{m.dart.reloading ? 'AUTO RELOAD' : m.dart.ammo <= 0 ? 'EMPTY' : 'ARMED'}</em>
              </div>
              {m.dart.reloading && (
                <div className="d-reload"><i style={{ width: `${dartReloadPct}%` }} /></div>
              )}
            </div>
          )}

          <div className="d-smoke-row">
            <span>SMOKE</span>
            <b>{m.smoke.count}/{m.smoke.capacity}</b>
            <em>{smokeRefillSec > 0 ? `REFILL ${smokeRefillSec.toFixed(1)}S` : 'READY'}</em>
          </div>
        </section>

        <section className="d-panel drones">
          <header className="d-panel-head">
            <h3>DRONE MATRIX // D1-D4</h3>
            <em className={droneActive ? 'on' : ''}>{m.drones.mode.toUpperCase()}</em>
          </header>
          <div className="d-drone-grid">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className={`d-drone-node ${droneActive ? 'on' : ''}`}>
                <b>D{n}</b>
                <span>{droneActive ? m.drones.mode.toUpperCase() : 'STOW'}</span>
                <em>{droneActive ? support : '--'}</em>
              </div>
            ))}
          </div>
          <div className="d-support-row">
            <span>T MODE</span>
            {SUPPORT_MODES.map((mode) => (
              <span key={mode} className={`d-support-pill ${m.drones.support === mode ? 'active' : ''}`}>
                {mode.toUpperCase()}
              </span>
            ))}
          </div>
          <div className="d-drone-sensor">
            SENSOR {m.drones.sensorTarget ?? '--'} · SCAN THROUGH SMOKE
          </div>
        </section>

        <section className="d-panel tactical">
          <header className="d-panel-head">
            <h3>TACTICAL // NET</h3>
            <em>LIVE FEED</em>
          </header>
          <div className="d-radar-row">
            <Radar />
            <DTargetList lockedTargetId={lockedTargetId} />
          </div>
        </section>

        <section className="d-panel status">
          <div className="d-pills">
            <span className={`d-pill ${locked ? 'on' : ''}`}>LIVE</span>
            <span className={`d-pill ${droneActive ? 'on' : ''}`}>DRONE</span>
            <span className={`d-pill ${droneActive ? 'on' : ''}`}>{support}</span>
            <span className={`d-pill ${m.smg.reloading || m.dart.reloading ? 'warn' : ''}`}>MED OK</span>
          </div>
          <div className="d-stat-row">
            <span>SCORE <b>{score}</b></span>
            <span>HITS <b>{hits}</b></span>
            <span>SHOTS <b>{shots}</b></span>
            <span>ACC <b>{accuracy}%</b></span>
          </div>
          <DecoStrip pool={D_DECO_POOL} />
        </section>
      </aside>

      {/* 左下：小队通信 */}
      <aside className="d-bottom-left">
        <CommsPanel squad="SQ-D" activeId="D" />
      </aside>

      {/* 右下：状态胶囊 */}
      <aside className="d-bottom-right">
        <div className="status-pills">
          <span className={`pill ${locked ? 'on' : ''}`}>D LIVE</span>
          <span className={`pill ${droneActive ? 'on' : ''}`}>DRONE {m.drones.mode.toUpperCase()}</span>
          <span className={`pill ${droneActive ? 'on' : ''}`}>SUPPORT {support}</span>
        </div>
      </aside>

      {/* 中央准星 + 支援模式 */}
      <div className="d-center">
        <div className="d-crosshair">
          <i className="ch" />
          <i className="cv" />
          <i className="cd" />
        </div>
        <div className={`d-lock-ring ${lockedTargetId ? 'on' : ''}`} />
        <div className="d-center-readout">
          <span className={`d-lock-state ${lockedTargetId ? 'on' : ''}`}>
            {lockedTargetId ? 'TARGET LOCK' : 'ACQUIRING'}
          </span>
          <span className="d-weapon">{weaponLabel}</span>
          <span className={`d-support-state ${droneActive ? 'on' : ''}`}>SUPPORT: {support}</span>
        </div>
        <div className="d-score">{score} PTS</div>
      </div>

      <EnemyMarkers />

      {messageId > 0 && (
        <div key={messageId} className={`hit-message ${message.startsWith('命中') || message.includes('+') ? 'hit' : 'miss'}`}>
          {message}
        </div>
      )}

      <ControlHints className="d-controls" items={CONTROL_HINTS.roleD} />

      {!ready && <div className="loader">LOADING MEDICAL LINK…</div>}
      {ready && (
        <footer className={`ready ${locked ? 'locked' : ''}`}>
          {locked ? `✓ LIVE · ${weaponLabel}` : '○ CLICK TO ENGAGE'}
        </footer>
      )}
    </div>
  )
}
