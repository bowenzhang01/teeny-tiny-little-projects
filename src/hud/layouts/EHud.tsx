import { useEffect, useReducer, useState } from 'react'
import { useRange } from '../../state/rangeStore'
import { useComms } from '../../state/commsStore'
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
import { RavenHud } from './RavenHud'

const E_DECO_POOL = [
  'E // LINK-05',
  'SQUAD NET 4/5',
  'RAVEN RELAY',
  'TRI MARK OK',
  'EMP ARMED',
  'SAT 4/7',
]

/** 目标列表：动态读取 targetRegistry */
function ETargetList({ lockedTargetId }: { lockedTargetId: string | null }) {
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
    <div className="e-target-list">
      {list.map((t) => (
        <div key={t.id} className={`e-target-line ${lockedTargetId === t.id ? 'active' : ''}`}>
          <span>{t.id}</span>
          <b>{t.dist < 10 ? t.dist.toFixed(1) : '--'}M</b>
          <em>{lockedTargetId === t.id ? 'LOCK' : 'SCAN'}</em>
        </div>
      ))}
      {list.length === 0 && (
        <div className="e-target-line dim">
          <span>--</span>
          <b>--</b>
          <em>NO TGT</em>
        </div>
      )}
    </div>
  )
}

/**
 * E 通信兵专属 HUD：紫色网络终端（信息传递中枢，类似 D 的复杂度）。
 * 专属内容：RAVEN 面板 / TRI+EMP 状态 / SQUAD NET 链路矩阵 / AR 武器面板。
 */
export function EHud({ ready }: { ready: boolean }) {
  const { score, hits, shots, locked, message, messageId, lockedTargetId } = useRange()
  const c = useComms()
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
    contexts: ['roleHud', 'linkRemote'],
    onDown: (e) => {
      if (e.repeat) return
      setNv((v) => !v)
    },
  })
  useEffect(() => {
    document.body.classList.toggle('nv', nv)
  }, [nv])

  if (c.drone.linkView) return <RavenHud ready={ready} nv={nv} />

  const now = nowMs
  const reloadPct = c.rifle.reloading
    ? Math.max(0, Math.min(100, 100 - (Math.max(0, c.rifle.reloadUntil - now) / c.rifle.reloadDuration) * 100))
    : 0
  const beaconRefillSec = c.beacon.replenishAt > 0 ? Math.max(0, (c.beacon.replenishAt - now) / 1000) : 0
  const empRefillSec = c.emp.replenishAt > 0 ? Math.max(0, (c.emp.replenishAt - now) / 1000) : 0
  const mslCdSec = Math.max(0, c.drone.missileCooldownUntil - now) / 1000
  const mgHeatPct = Math.round(c.drone.mgHeat * 100)
  const droneActive = c.drone.mode !== 'stowed'
  const markActive =
    c.rifleMark !== null && now < c.rifleMarkUntil
      ? `AR ${c.rifleMark}`
      : c.beaconMark !== null && now < c.beaconMarkUntil
        ? `TRI ${c.beaconMark}`
        : c.drone.sensorMark
          ? `RVN ${c.drone.sensorMark}`
          : '--'
  const accuracy = shots > 0 ? Math.min(100, Math.round((hits / shots) * 100)) : 0

  return (
    <div className="hud e-hud">
      <ScreenFlash />
      <div className="e-frame" aria-hidden />
      <div className="e-wave" aria-hidden />

      <header className="e-topbar">
        <div className="e-brand">
          <b>E // LINK-05</b>
          <span>SQUAD-E · COMMS &amp; RECON OPS</span>
        </div>
        <CompassStrip />
        <div className="e-top-right">
          <span>SQUAD NET 4/5</span>
          <span>RAVEN {droneActive ? c.drone.mode.toUpperCase() : 'STBY'}</span>
          <span className={nv ? 'on' : ''}>NV {nv ? 'ON' : 'OFF'}</span>
        </div>
      </header>

      <aside className="e-left">
        <section className="e-panel weapon">
          <header className="e-panel-head">
            <h3>PRIMARY // AR-05</h3>
            <em className={c.rifle.firing ? 'on' : ''}>{c.rifle.firing ? 'FIRING' : 'READY'}</em>
          </header>
          <div className="e-mag">
            <b>{c.rifle.mag}</b>
            <span>/ {c.rifle.magSize}</span>
            <em>{c.rifle.reloading ? 'RELOAD' : c.rifle.mag <= 6 ? 'LOW' : 'READY'}</em>
          </div>
          {c.rifle.reloading && (
            <div className="e-reload"><i style={{ width: `${reloadPct}%` }} /></div>
          )}
          <div className="e-mini-row">
            <span>MARK {markActive}</span>
            <span>ACC {accuracy}%</span>
          </div>
        </section>

        <BioPanel operator="E" shots={shots} />
        <ExoPanel label="EXO-SUIT // MK.IV-E" />
      </aside>

      <aside className="e-right">
        <section className="e-panel raven">
          <header className="e-panel-head">
            <h3>RAVEN-05 // LINK</h3>
            <em className={droneActive ? 'on' : ''}>{c.drone.mode.toUpperCase()}</em>
          </header>
          <div className="e-mode-row">
            {(['relay', 'sweep', 'strike'] as const).map((mode) => (
              <span key={mode} className={`e-mode-pill ${c.drone.mode === mode ? 'active' : ''}`}>
                {mode.toUpperCase()}
              </span>
            ))}
          </div>
          <div className="e-status-grid">
            <span><i>LINK</i><b>{c.drone.link.toFixed(1)}%</b></span>
            <span><i>PWR</i><b>{c.drone.power.toFixed(0)}%</b></span>
            <span><i>SENSOR</i><b>{c.drone.sensorMark ?? '--'}</b></span>
          </div>
          <div className="e-arms-row">
            <span>MG</span>
            <div className="e-mg-track"><i style={{ width: `${mgHeatPct}%` }} /></div>
            <em>{mgHeatPct}%</em>
          </div>
          <div className="e-arms-row">
            <span>MSL</span>
            <b>{c.drone.missileLeft}/{c.drone.missileRight}</b>
            <em>{mslCdSec > 0 ? `CD ${mslCdSec.toFixed(1)}S` : 'READY'}</em>
          </div>
          <div className="e-drone-note">F MODE · V LINK VIEW · 1/2 WEAPON</div>
        </section>

        <section className="e-panel deploy">
          <header className="e-panel-head">
            <h3>RECON // LOADOUT</h3>
            <em>G TRI · T EMP</em>
          </header>
          <div className="e-deploy-slots">
            <div className="e-slot">
              <span>TRI BEACON</span>
              <b>{c.beacon.count}/{c.beacon.capacity}</b>
              <em>{beaconRefillSec > 0 ? `REFILL ${beaconRefillSec.toFixed(1)}S` : 'READY'}</em>
            </div>
            <div className="e-slot">
              <span>EMP-05</span>
              <b>{c.emp.count}/{c.emp.capacity}</b>
              <em>{empRefillSec > 0 ? `REFILL ${empRefillSec.toFixed(1)}S` : 'READY'}</em>
            </div>
          </div>
        </section>

        <section className="e-panel net">
          <header className="e-panel-head">
            <h3>SQUAD NET // MATRIX</h3>
            <em className="on">LIVE 4/5</em>
          </header>
          <div className="e-net-rows">
            <span className="on">A · ASSAULT</span>
            <span className="on">B · BREACHER</span>
            <span className="on">C · ENGINEER</span>
            <span className="on">D · MEDIC</span>
            <span className="self">E · COMMS (LINK-05)</span>
          </div>
          <div className="e-net-note">RAVEN RELAY EXTENDS TEAM RANGE · 占位信号网</div>
        </section>

        <section className="e-panel tactical">
          <header className="e-panel-head">
            <h3>TACTICAL // NET</h3>
            <em>LIVE FEED</em>
          </header>
          <div className="e-radar-row">
            <Radar />
            <ETargetList lockedTargetId={lockedTargetId} />
          </div>
        </section>

        <section className="e-panel status">
          <div className="e-pills">
            <span className={`e-pill ${locked ? 'on' : ''}`}>LIVE</span>
            <span className={`e-pill ${droneActive ? 'on' : ''}`}>RAVEN</span>
            <span className={`e-pill ${markActive !== '--' ? 'on' : ''}`}>MARK</span>
            <span className={`e-pill ${c.emp.count > 0 ? 'on' : ''}`}>EMP</span>
          </div>
          <div className="e-stat-row">
            <span>SCORE <b>{score}</b></span>
            <span>HITS <b>{hits}</b></span>
            <span>SHOTS <b>{shots}</b></span>
            <span>ACC <b>{accuracy}%</b></span>
          </div>
          <DecoStrip pool={E_DECO_POOL} />
        </section>
      </aside>

      <aside className="e-bottom-left">
        <CommsPanel squad="SQ-E" activeId="E" />
      </aside>

      <aside className="e-bottom-right">
        <div className="status-pills">
          <span className={`pill ${locked ? 'on' : ''}`}>E LIVE</span>
          <span className={`pill ${droneActive ? 'on' : ''}`}>RAVEN {c.drone.mode.toUpperCase()}</span>
          <span className={`pill ${markActive !== '--' ? 'on' : ''}`}>MARK {markActive}</span>
        </div>
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
            {lockedTargetId ? 'TARGET LOCK' : 'ACQUIRING'}
          </span>
          <span className="e-weapon">AR-05 RECON RIFLE</span>
          <span className={`e-drone-state ${droneActive ? 'on' : ''}`}>RAVEN: {c.drone.mode.toUpperCase()}</span>
        </div>
        <div className="e-score">{score} PTS</div>
      </div>

      <EnemyMarkers />

      {messageId > 0 && (
        <div key={messageId} className={`hit-message ${message.startsWith('命中') || message.includes('+') ? 'hit' : 'miss'}`}>
          {message}
        </div>
      )}

      <ControlHints className="e-controls" items={CONTROL_HINTS.roleE} />

      {!ready && <div className="loader">LOADING COMMS LINK…</div>}
      {ready && (
        <footer className={`ready ${locked ? 'locked' : ''}`}>
          {locked ? `✓ LIVE · AR-05 · ${c.drone.mode.toUpperCase()}` : '○ CLICK TO ENGAGE'}
        </footer>
      )}
    </div>
  )
}
