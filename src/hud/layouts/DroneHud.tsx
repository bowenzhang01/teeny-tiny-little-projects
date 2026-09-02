import { useEffect, useReducer, useState } from 'react'
import { useDrone } from '../../state/droneStore'
import { useRange } from '../../state/rangeStore'
import { CompassStrip } from '../widgets/CompassStrip'
import { Radar } from '../widgets/Radar'
import { EnemyMarkers } from '../widgets/EnemyMarkers'
import { DecoStrip } from '../widgets/DecoStrip'
import { ScreenFlash } from '../widgets/ScreenFlash'

/**
 * 机器人手动遥控（REMOTE）全屏 HUD：
 * 机器人第一人称画面 + 机身/武器/传感器数据。
 * 与 A 本体 HUD 区分：橙红“无人链路”风格。
 */
export function DroneHud({ ready }: { ready: boolean }) {
  const d = useDrone()
  const { score, locked, lockedTargetId, message, messageId, hits } = useRange()
  const [, tick] = useReducer((x: number) => x + 1, 0)
  const [nowMs, setNowMs] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => {
      tick()
      setNowMs(performance.now())
    }, 120)
    return () => window.clearInterval(timer)
  }, [])

  if (d.mode !== 'remote') return null

  const mslCd = Math.max(0, d.missileCooldownUntil - nowMs)
  const heatPct = Math.round(d.mgHeat * 100)

  return (
    <div className="hud drone-hud">
      <ScreenFlash />
      <div className="drone-frame" aria-hidden />

      {/* 顶栏 */}
      <header className="drone-top">
        <div className="drone-brand">
          <b>DRONE LINK // Q-01</b>
          <span>REMOTE · A TEMPORARY TAKEOVER</span>
        </div>
        <CompassStrip />
        <div className="drone-top-right">
          <span>LINK {d.link.toFixed(1)}%</span>
          <span>POWER {d.battery.toFixed(0)}%</span>
          <span className={lockedTargetId ? 'on' : ''}>MARK {lockedTargetId ?? '--'}</span>
        </div>
      </header>

      {/* 左：机身 */}
      <aside className="drone-left">
        <section className="a-panel drone-stat">
          <header className="a-panel-head">
            <h3>QUAD // STATUS</h3>
            <em className="on">REMOTE</em>
          </header>
          <div className="drone-rows">
            <span><i>MODE</i><b>{d.mode.toUpperCase()}</b></span>
            <span><i>AI</i><b>{d.aiState}</b></span>
            <span><i>SPEED</i><b>{d.speed.toFixed(1)} M/S</b></span>
            <span><i>INTEG</i><b>{d.integrity.toFixed(0)}%</b></span>
          </div>
          <div className="drone-weapon-row">
            <span>MG</span>
            <div className="drone-mg-track"><i style={{ width: `${heatPct}%` }} /></div>
            <em>{heatPct}%</em>
          </div>
          <div className="drone-weapon-row">
            <span>MSL</span>
            <b>{d.missileLeft}/{d.missileRight}</b>
            <em>{mslCd > 0 ? `CD ${(mslCd / 1000).toFixed(1)}S` : 'READY'}</em>
          </div>
          <div className="drone-sensor">
            SENSOR MARK {d.sensorMark ?? '--'} · {d.mgFiring ? 'FIRING' : 'SCAN'}
          </div>
        </section>

        <section className="a-panel drone-radar-panel">
          <header className="a-panel-head">
            <h3>DRONE // RADAR</h3>
            <em>LOCAL FEED</em>
          </header>
          <Radar />
        </section>
      </aside>

      {/* 右：武器 + 战术 */}
      <aside className="drone-right">
        <section className="a-panel drone-arms">
          <header className="a-panel-head">
            <h3>ARMAMENT // DRONE</h3>
            <em>1 MG · 2 MSL</em>
          </header>
          <div className={`drone-wp-line ${d.weapon === 'mg' ? 'active' : ''}`}>
            <span>MG TURRET</span>
            <em>{d.weapon === 'mg' ? 'SELECTED' : heatPct > 70 ? 'HOT' : 'READY'}</em>
          </div>
          <div className={`drone-wp-line ${d.weapon === 'missile' ? 'active' : ''}`}>
            <span>MICRO MSL</span>
            <em>{d.weapon === 'missile' ? 'SELECTED' : mslCd > 0 ? `CD ${(mslCd / 1000).toFixed(1)}S` : 'READY'}</em>
          </div>
          <div className="drone-score-row">
            <span>SCORE <b>{score}</b></span>
            <span>HITS <b>{hits}</b></span>
          </div>
        </section>
      </aside>

      {/* 中央：机器人观瞄 */}
      <div className="drone-center">
        <div className="drone-crosshair">
          <i className="dh" />
          <i className="dv" />
          <i className="dd" />
        </div>
        <div className={`drone-lock-ring ${lockedTargetId ? 'on' : ''}`} />
        <div className="drone-center-readout">
          <span className={`drone-lock-state ${lockedTargetId ? 'on' : ''}`}>
            {lockedTargetId ? 'TARGET LOCK' : 'SCANNING'}
          </span>
          <span className="drone-weapon-label">{d.weapon === 'mg' ? 'MG TURRET' : 'MICRO MSL'}</span>
        </div>
      </div>

      <EnemyMarkers />

      {messageId > 0 && (
        <div key={messageId} className={`hit-message ${message.startsWith('命中') || message.includes('+') ? 'hit' : 'miss'}`}>
          {message}
        </div>
      )}

      {/* 底部：操作提示 + 装饰 */}
      <aside className="drone-controls">
        <span><b>WASD</b> MOVE</span>
        <span><b>SPACE</b> JUMP</span>
        <span><b>LMB</b> FIRE</span>
        <span><b>1/2</b> WEAPON</span>
        <span><b>F</b> RETURN AI</span>
        <span><b>Q</b> STOW</span>
      </aside>
      <aside className="drone-bottom-right">
        <div className="status-pills">
          <span className={`pill ${locked ? 'on' : ''}`}>REMOTE LINK</span>
          <span className={`pill ${d.mgFiring ? 'warn' : ''}`}>{d.mgFiring ? 'FIRING' : 'IDLE'}</span>
          <span className="pill">PWR {d.battery.toFixed(0)}%</span>
        </div>
        <DecoStrip pool={['DRONE // Q-01', 'REMOTE 98%', 'MG HEAT OK', 'MSL 4/4', 'LINK STABLE', 'A OPS']} />
      </aside>

      {!ready && <div className="loader">ESTABLISHING DRONE LINK…</div>}
      {ready && (
        <footer className={`ready ${locked ? 'locked' : ''}`}>
          {locked ? '✓ REMOTE LIVE · DRONE' : '○ CLICK TO RELOCK'}
        </footer>
      )}
    </div>
  )
}
