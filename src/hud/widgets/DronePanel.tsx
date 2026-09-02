import { useEffect, useReducer, useState } from 'react'
import { useDrone } from '../../state/droneStore'

/** AUTO 模式下嵌在 A HUD 里的四足机器人数据面板 */
export function DronePanel() {
  const d = useDrone()
  const [, tick] = useReducer((x: number) => x + 1, 0)
  const [nowMs, setNowMs] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => {
      tick()
      setNowMs(performance.now())
    }, 120)
    return () => window.clearInterval(timer)
  }, [])

  if (d.mode === 'stowed') return null

  const mslCd = Math.max(0, d.missileCooldownUntil - nowMs)
  const heatPct = Math.round(d.mgHeat * 100)

  return (
    <section className="a-panel drone-panel">
      <header className="a-panel-head">
        <h3>DRONE // Q-01</h3>
        <em className="on">{d.mode === 'remote' ? 'REMOTE' : 'AUTO'}</em>
      </header>
      <div className="drone-rows">
        <span><i>LINK</i><b>{d.link.toFixed(1)}%</b></span>
        <span><i>POWER</i><b>{d.battery.toFixed(0)}%</b></span>
        <span><i>SPEED</i><b>{d.speed.toFixed(1)} M/S</b></span>
        <span><i>AI</i><b>{d.aiState}</b></span>
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
  )
}
