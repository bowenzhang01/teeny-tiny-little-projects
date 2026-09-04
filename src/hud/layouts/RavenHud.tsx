import { useEffect, useState } from 'react'
import { useComms } from '../../state/commsStore'
import { useRange } from '../../state/rangeStore'
import { CompassStrip } from '../widgets/CompassStrip'
import { Radar } from '../widgets/Radar'
import { EnemyMarkers } from '../widgets/EnemyMarkers'
import { DecoStrip } from '../widgets/DecoStrip'
import { ScreenFlash } from '../widgets/ScreenFlash'
import { ControlHints } from '../widgets/ControlHints'
import { CONTROL_HINTS } from '../../input/inputMap'

const R_DECO = ['RAVEN // LINK-05', 'RELAY SAT 4/7', 'MG HEAT OK', 'MSL 2/2', 'LINK STABLE', 'E OPS']

/** RAVEN-05 链路视角（V）全屏 HUD：无人机观瞄 + 机身状态 + 武器 */
export function RavenHud({ ready, nv }: { ready: boolean; nv: boolean }) {
  const c = useComms()
  const { score, hits, locked, lockedTargetId, message, messageId } = useRange()
  const [, tick] = useState(0)
  useEffect(() => {
    const timer = window.setInterval(() => tick((v) => v + 1), 120)
    return () => window.clearInterval(timer)
  }, [])
  void tick

  if (!c.drone.linkView) return null

  const mslCd = Math.max(0, c.drone.missileCooldownUntil - performance.now())
  const heatPct = Math.round(c.drone.mgHeat * 100)

  return (
    <div className="hud e-hud raven-hud">
      <ScreenFlash />
      <div className="e-frame" aria-hidden />
      <div className="e-wave" aria-hidden />

      <header className="e-topbar">
        <div className="e-brand">
          <b>RAVEN LINK // E</b>
          <span>LINK-05 · LARGE RECON PLATFORM</span>
        </div>
        <CompassStrip />
        <div className="e-top-right">
          <span>LINK {c.drone.link.toFixed(1)}%</span>
          <span>POWER {c.drone.power.toFixed(0)}%</span>
          <span className={lockedTargetId ? 'on' : ''}>MARK {lockedTargetId ?? '--'}</span>
          <span className={nv ? 'on' : ''}>NV {nv ? 'ON' : 'OFF'}</span>
        </div>
      </header>

      <aside className="e-left">
        <section className="e-panel">
          <header className="e-panel-head">
            <h3>RAVEN // STATUS</h3>
            <em className="on">LINK VIEW</em>
          </header>
          <div className="e-status-grid">
            <span><i>MODE</i><b>{c.drone.mode.toUpperCase()}</b></span>
            <span><i>AI</i><b>{c.drone.aiState}</b></span>
            <span><i>LINK</i><b>{c.drone.link.toFixed(1)}%</b></span>
            <span><i>PWR</i><b>{c.drone.power.toFixed(0)}%</b></span>
          </div>
          <div className="e-arms-row">
            <span>MG</span>
            <div className="e-mg-track"><i style={{ width: `${heatPct}%` }} /></div>
            <em>{heatPct}%</em>
          </div>
          <div className="e-arms-row">
            <span>MSL</span>
            <b>{c.drone.missileLeft}/{c.drone.missileRight}</b>
            <em>{mslCd > 0 ? `CD ${(mslCd / 1000).toFixed(1)}S` : 'READY'}</em>
          </div>
          <div className="e-sensor">SENSOR MARK {c.drone.sensorMark ?? '--'}</div>
        </section>

        <section className="e-panel">
          <header className="e-panel-head">
            <h3>RAVEN // RADAR</h3>
            <em>LOCAL FEED</em>
          </header>
          <Radar />
        </section>
      </aside>

      <aside className="e-right">
        <section className="e-panel">
          <header className="e-panel-head">
            <h3>ARMAMENT // RAVEN</h3>
            <em>1 MG · 2 MSL</em>
          </header>
          <div className={`e-wp-line ${c.drone.weapon === 'mg' ? 'active' : ''}`}>
            <span>TWIN MG</span>
            <em>{c.drone.weapon === 'mg' ? 'SELECTED' : heatPct > 70 ? 'HOT' : 'READY'}</em>
          </div>
          <div className={`e-wp-line ${c.drone.weapon === 'missile' ? 'active' : ''}`}>
            <span>MICRO MSL</span>
            <em>{c.drone.weapon === 'missile' ? 'SELECTED' : mslCd > 0 ? `CD ${(mslCd / 1000).toFixed(1)}S` : 'READY'}</em>
          </div>
          <div className="e-stat-row">
            <span>SCORE <b>{score}</b></span>
            <span>HITS <b>{hits}</b></span>
          </div>
        </section>

        <section className="e-panel">
          <header className="e-panel-head">
            <h3>COMMS // RELAY</h3>
            <em className="on">BOOST</em>
          </header>
          <div className="e-net-rows">
            <span>A · ASSAULT <b>ONLINE</b></span>
            <span>B · BREACHER <b>ONLINE</b></span>
            <span>C · ENGINEER <b>ONLINE</b></span>
            <span>D · MEDIC <b>ONLINE</b></span>
          </div>
        </section>
      </aside>

      <div className="e-center">
        <div className="e-crosshair">
          <i className="eh" />
          <i className="ev" />
          <i className="ed" />
        </div>
        <div className={`e-lock-ring ${lockedTargetId ? 'on' : ''}`} />
        <div className="e-center-readout">
          <span className={`e-lock-state ${lockedTargetId ? 'on' : ''}`}>
            {lockedTargetId ? 'TARGET LOCK' : 'SCANNING'}
          </span>
          <span className="e-weapon">{c.drone.weapon === 'mg' ? 'TWIN MG' : 'MICRO MSL'}</span>
        </div>
      </div>

      <EnemyMarkers />

      {messageId > 0 && (
        <div key={messageId} className={`hit-message ${message.startsWith('命中') || message.includes('+') ? 'hit' : 'miss'}`}>
          {message}
        </div>
      )}

      <ControlHints className="e-controls" items={CONTROL_HINTS.linkRemote} />
      <aside className="e-bottom-right">
        <div className="status-pills">
          <span className={`pill ${locked ? 'on' : ''}`}>RAVEN LINK</span>
          <span className={`pill ${c.drone.mgFiring ? 'warn' : ''}`}>{c.drone.mgFiring ? 'FIRING' : 'IDLE'}</span>
          <span className="pill">PWR {c.drone.power.toFixed(0)}%</span>
        </div>
        <DecoStrip pool={R_DECO} />
      </aside>

      {!ready && <div className="loader">ESTABLISHING RAVEN LINK…</div>}
      {ready && (
        <footer className={`ready ${locked ? 'locked' : ''}`}>
          {locked ? '✓ LIVE · RAVEN' : '○ CLICK TO RELOCK'}
        </footer>
      )}
    </div>
  )
}
