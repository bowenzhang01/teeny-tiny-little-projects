import { useEffect, useReducer, useState } from 'react'
import { useRange } from '../../state/rangeStore'
import { useEngineer } from '../../state/engineerStore'
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

const C_DECO_POOL = ['C // FORGE-03', 'PLASMA CAL 0.04', 'ARMS STANDBY', 'NET 97%', 'DEPLOY LINK OK', 'SAT 4/7']

/** 目标列表：动态读取 targetRegistry */
function CTargetList({ lockedTargetId }: { lockedTargetId: string | null }) {
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
    <div className="c-target-list">
      {list.map((t) => (
        <div key={t.id} className={`c-target-line ${lockedTargetId === t.id ? 'active' : ''}`}>
          <span>{t.id}</span>
          <b>{t.dist < 10 ? t.dist.toFixed(1) : '--'}M</b>
          <em>{lockedTargetId === t.id ? 'LOCK' : 'SCAN'}</em>
        </div>
      ))}
      {list.length === 0 && (
        <div className="c-target-line dim">
          <span>--</span>
          <b>--</b>
          <em>NO TGT</em>
        </div>
      )}
    </div>
  )
}

/**
 * C 工程兵专属 HUD：琥珀工业风。
 * 与 B 青蓝玻璃、A 红锐角区分：六边形感斜切面板 + 黄黑警示条 + 工程数据。
 */
export function CHud({ ready }: { ready: boolean }) {
  const { score, hits, shots, locked, message, messageId, lockedTargetId } = useRange()
  const e = useEngineer()
  const [, tick] = useReducer((x: number) => x + 1, 0)
  const [nv, setNv] = useState(false)

  useEffect(() => {
    const timer = window.setInterval(() => tick(), 120)
    return () => window.clearInterval(timer)
  }, [])

  // 夜视（N）：C 也支持
  useKeyBinding('nightVision', {
    contexts: ['roleHud'],
    onDown: (ev) => {
      if (ev.repeat) return
      setNv((v) => !v)
    },
  })
  useEffect(() => {
    document.body.classList.toggle('nv', nv)
  }, [nv])

  const energyPct = Math.round(e.plasma.energy)
  const heatPct = Math.round(e.plasma.heat * 100)
  const accuracy = shots > 0 ? Math.min(100, Math.round((hits / shots) * 100)) : 0
  const weaponLabel = 'PLASMA LASER'

  return (
    <div className="hud c-hud">
      <ScreenFlash />
      <div className="c-frame" aria-hidden />
      <div className="c-hazard" aria-hidden />

      {/* 顶栏 */}
      <header className="c-topbar">
        <div className="c-brand">
          <b>C // FORGE-03</b>
          <span>SQUAD-C · ENGINEERING OPS</span>
        </div>
        <CompassStrip />
        <div className="c-top-right">
          <span>NET 97%</span>
          <span>DEPLOY LINK OK</span>
          <span className={nv ? 'on' : ''}>NV {nv ? 'ON' : 'OFF'}</span>
        </div>
      </header>

      {/* 左列：核心武器 */}
      <aside className="c-left">
        <section className="c-panel primary">
          <header className="c-panel-head">
            <h3>PRIMARY // PLASMA LASER</h3>
            <em className={e.plasma.firing ? 'on' : ''}>{e.plasma.firing ? 'FIRING' : 'READY'}</em>
          </header>
          <div className="c-energy">
            <span>ENERGY</span>
            <div className="c-energy-track">
              <i style={{ width: `${energyPct}%` }} />
            </div>
            <b>{energyPct}%</b>
          </div>
          <div className="c-heat">
            <span>HEAT</span>
            <div className={`c-heat-track ${heatPct >= 80 ? 'hot' : ''}`}>
              <i style={{ width: `${heatPct}%` }} />
            </div>
            <b>{heatPct}%</b>
          </div>
          <div className="c-mini-row">
            <span>OVER {e.plasma.overcharge ? 'ON' : 'OFF'}</span>
            <span className={e.plasma.venting ? 'warn' : ''}>
              {e.plasma.venting ? 'VENTING' : e.plasma.energy <= 0 ? 'EMPTY' : 'READY'}
            </span>
            <span>ACC {accuracy}%</span>
          </div>
        </section>

        <section className="c-panel arms">
          <header className="c-panel-head">
            <h3>ARMS // QUAD MANIP.</h3>
            <em className={e.armsMode !== 'stowed' ? 'on' : ''}>{e.armsMode.toUpperCase()}</em>
          </header>
          <div className="c-arms-row">
            <span className={`c-arms-node ${e.armsMode !== 'stowed' ? 'on' : ''}`}>L-L</span>
            <span className={`c-arms-node ${e.armsMode !== 'stowed' ? 'on' : ''}`}>L-R</span>
            <span className={`c-arms-node ${e.armsMode !== 'stowed' ? 'on' : ''}`}>R-L</span>
            <span className={`c-arms-node ${e.armsMode !== 'stowed' ? 'on' : ''}`}>R-R</span>
          </div>
          <div className="c-arms-note">NO DIRECT FIRE · DEPLOY &amp; OPERATE</div>
        </section>

        <section className="c-panel deploy">
          <header className="c-panel-head">
            <h3>DEPLOY // BLUEPRINT</h3>
            <em>4 CYCLE · G PLACE · 3-12M</em>
          </header>
          <div className="c-deploy-slots">
            <div className={`c-slot ${e.deploy.blueprint === 'mine' ? 'active' : ''}`}>
              <span>MINE</span>
              <b>{e.deploy.mines}/{e.deploy.mineCapacity}</b>
            </div>
            <div className={`c-slot ${e.deploy.blueprint === 'barrier' ? 'active' : ''}`}>
              <span>BARRIER</span>
              <b>{e.deploy.barriers}/{e.deploy.barrierCapacity}</b>
            </div>
            <div className={`c-slot ${e.turret.deployed ? 'active' : ''}`}>
              <span>TURRET</span>
              <b>{e.turret.deployed ? '1/1' : '0/1'}</b>
            </div>
          </div>
        </section>
      </aside>

      {/* 右列：战术网 + 生命体征 */}
      <aside className="c-right">
        <section className="c-panel tactical">
          <header className="c-panel-head">
            <h3>TACTICAL // NET</h3>
            <em>LIVE FEED</em>
          </header>
          <div className="c-radar-row">
            <Radar />
            <CTargetList lockedTargetId={lockedTargetId} />
          </div>
        </section>

        <BioPanel operator="C" shots={shots} />

        <section className="c-panel status">
          <div className="c-pills">
            <span className={`c-pill ${locked ? 'on' : ''}`}>LIVE</span>
            <span className={`c-pill ${e.plasma.firing ? 'on' : ''}`}>PLASMA</span>
            <span className={`c-pill ${heatPct >= 80 ? 'warn' : ''}`}>HEAT {heatPct}%</span>
          </div>
          <div className="c-stat-row">
            <span>SCORE <b>{score}</b></span>
            <span>HITS <b>{hits}</b></span>
            <span>SHOTS <b>{shots}</b></span>
          </div>
          <DecoStrip pool={C_DECO_POOL} />
        </section>
      </aside>

      {/* 左下：外骨骼 + 小队通信 */}
      <aside className="c-bottom-left">
        <ExoPanel label="EXO-SUIT // MK.IV-C" />
        <CommsPanel squad="SQ-C" activeId="C" />
      </aside>

      {/* 右下：状态胶囊 */}
      <aside className="c-bottom-right">
        <div className="status-pills">
          <span className={`pill ${locked ? 'on' : ''}`}>C LIVE</span>
          <span className={`pill ${e.plasma.venting ? 'warn' : ''}`}>{e.plasma.venting ? 'VENT' : 'EXO OK'}</span>
          <span className={`pill ${e.turret.deployed ? 'on' : ''}`}>TURRET {e.turret.deployed ? 'DEPLOYED' : 'STOWED'}</span>
        </div>
      </aside>

      {/* 中央准星 */}
      <div className="c-center">
        <div className="c-crosshair">
          <i className="ch" />
          <i className="cv" />
          <i className="cd" />
        </div>
        <div className={`c-lock-ring ${lockedTargetId ? 'on' : ''}`} />
        <div className="c-center-readout">
          <span className={`c-lock-state ${lockedTargetId ? 'on' : ''}`}>
            {lockedTargetId ? 'TARGET LOCK' : 'ACQUIRING'}
          </span>
          <span className="c-weapon">{weaponLabel}{e.plasma.overcharge ? ' · OVERCHARGE' : ''}</span>
        </div>
        <div className="c-score">{score} PTS</div>
      </div>

      <EnemyMarkers />

      {messageId > 0 && (
        <div key={messageId} className={`hit-message ${message.startsWith('命中') || message.includes('+') ? 'hit' : 'miss'}`}>
          {message}
        </div>
      )}

      <ControlHints className="c-controls" items={CONTROL_HINTS.roleC} />

      {!ready && <div className="loader">LOADING ENGINEERING LINK…</div>}
      {ready && (
        <footer className={`ready ${locked ? 'locked' : ''}`}>
          {locked ? `✓ LIVE · ${weaponLabel}` : '○ CLICK TO ENGAGE'}
        </footer>
      )}
    </div>
  )
}
