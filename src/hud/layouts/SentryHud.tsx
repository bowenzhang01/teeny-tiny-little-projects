import { useEffect, useState } from 'react'
import { useRange } from '../../state/rangeStore'
import { useEngineer } from '../../state/engineerStore'
import { CompassStrip } from '../widgets/CompassStrip'
import { Radar } from '../widgets/Radar'
import { EnemyMarkers } from '../widgets/EnemyMarkers'
import { DecoStrip } from '../widgets/DecoStrip'
import { ScreenFlash } from '../widgets/ScreenFlash'
import { BioPanel } from '../widgets/BioPanel'
import { CommsPanel } from '../widgets/CommsPanel'
import { ControlHints } from '../widgets/ControlHints'
import { CONTROL_HINTS } from '../../input/inputMap'
import { useKeyBinding } from '../../input/useKeyBinding'

const S_DECO = ['C // SENTRY LINK', 'TWIN CANNON ONLINE', 'AUTO ENGAGE STBY', 'LINK 98%', 'PWR 96%', 'SAT 4/7']

/** 哨戒炮塔手动遥控（SENTRY LINK）全屏 HUD：类似 A 机器人 REMOTE，但不移动 */
export function SentryHud({ ready }: { ready: boolean }) {
  const e = useEngineer()
  const { score, hits, locked, lockedTargetId, message, messageId } = useRange()
  const [nv, setNv] = useState(false)

  useEffect(() => {
    document.body.classList.toggle('nv', nv)
  }, [nv])

  useKeyBinding('nightVision', {
    contexts: ['turretRemote'],
    onDown: (ev) => {
      if (ev.repeat) return
      setNv((v) => !v)
    },
  })

  if (!e.turret.manual) return null

  return (
    <div className="hud c-hud sentry-hud">
      <ScreenFlash />
      <div className="c-frame" aria-hidden />
      <div className="c-hazard" aria-hidden />

      <header className="c-topbar">
        <div className="c-brand">
          <b>C // SENTRY LINK</b>
          <span>FORGE-03 · TWIN HEAVY AUTOCANNON</span>
        </div>
        <CompassStrip />
        <div className="c-top-right">
          <span>REMOTE</span>
          <span>LINK 98.2%</span>
          <span className={nv ? 'on' : ''}>NV {nv ? 'ON' : 'OFF'}</span>
        </div>
      </header>

      <aside className="c-left">
        <section className="c-panel">
          <header className="c-panel-head">
            <h3>TURRET // STATUS</h3>
            <em className="on">MANUAL</em>
          </header>
          <div className="c-stat-row">
            <span>MODE <b>REMOTE</b></span>
            <span>AI <b>{e.turret.manual ? 'MANUAL' : 'AUTO'}</b></span>
          </div>
          <div className="c-mini-row">
            <span>TWIN CANNON</span>
            <span className="on">ARMED</span>
          </div>
          <div className="c-stat-row">
            <span>SCORE <b>{score}</b></span>
            <span>HITS <b>{hits}</b></span>
          </div>
        </section>

        <section className="c-panel">
          <header className="c-panel-head">
            <h3>DRONE // RADAR</h3>
            <em>LOCAL FEED</em>
          </header>
          <Radar />
        </section>
      </aside>

      <aside className="c-right">
        <section className="c-panel">
          <header className="c-panel-head">
            <h3>TACTICAL // NET</h3>
            <em>LIVE FEED</em>
          </header>
          <div className="c-stat-row">
            <span>MARK <b>{lockedTargetId ?? '--'}</b></span>
            <span>{lockedTargetId ? 'LOCK' : 'SCAN'}</span>
          </div>
          <div className="c-mini-row">
            <span>STATIC MOUNT</span>
            <span>FIXED</span>
          </div>
          <DecoStrip pool={S_DECO} />
        </section>

        <BioPanel operator="C" shots={hits} />
        <CommsPanel squad="SQ-C" activeId="C" />
      </aside>

      <div className="c-center">
        <div className="c-crosshair">
          <i className="ch" />
          <i className="cv" />
          <i className="cd" />
        </div>
        <div className={`c-lock-ring ${lockedTargetId ? 'on' : ''}`} />
        <div className="c-center-readout">
          <span className={`c-lock-state ${lockedTargetId ? 'on' : ''}`}>
            {lockedTargetId ? 'TARGET LOCK' : 'SCANNING'}
          </span>
          <span className="c-weapon">TWIN HEAVY AUTOCANNON</span>
        </div>
      </div>

      <EnemyMarkers />

      {messageId > 0 && (
        <div key={messageId} className={`hit-message ${message.startsWith('命中') || message.includes('+') ? 'hit' : 'miss'}`}>
          {message}
        </div>
      )}

      <ControlHints className="c-controls" items={CONTROL_HINTS.turretRemote} />

      <aside className="c-bottom-right">
        <div className="status-pills">
          <span className={`pill ${locked ? 'on' : ''}`}>SENTRY LINK</span>
          <span className="pill">TWIN CANNON</span>
          <span className="pill">FIXED MOUNT</span>
        </div>
      </aside>

      {!ready && <div className="loader">ESTABLISHING SENTRY LINK…</div>}
      {ready && (
        <footer className={`ready ${locked ? 'locked' : ''}`}>
          {locked ? '✓ REMOTE LIVE · TURRET' : '○ CLICK TO RELOCK'}
        </footer>
      )}
    </div>
  )
}
