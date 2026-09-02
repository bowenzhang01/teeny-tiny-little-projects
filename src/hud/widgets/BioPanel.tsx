import { useEffect, useState } from 'react'
import { EcgWave } from '../EcgWave'

/**
 * 通用生理面板：心率 + ECG + 基础生命体征。
 * 所有角色 HUD 共用；主题色由外层 .theme-* 注入。
 */
export function BioPanel({ operator, shots }: { operator: string; shots: number }) {
  const [hr, setHr] = useState(97)
  const [o2, setO2] = useState(97.4)
  const [temp, setTemp] = useState(36.8)
  const [adr, setAdr] = useState(0.58)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setHr((v) => Math.round(Math.max(72, Math.min(132, v + (Math.random() - 0.5) * 6 + (shots > 0 ? 0.4 : 0)))))
      setO2((v) => Math.max(94, Math.min(99.5, v + (Math.random() - 0.5) * 0.3)))
      setTemp((v) => Math.max(36.2, Math.min(37.8, v + (Math.random() - 0.5) * 0.12)))
      setAdr((v) => Math.max(0.2, Math.min(0.92, v + (Math.random() - 0.5) * 0.07)))
    }, 900)
    return () => window.clearInterval(timer)
  }, [shots])

  return (
    <section className="tac bio">
      <h3>OPERATOR // {operator}</h3>
      <div className="bio-head">
        <div>
          <span className="read-label">HEART RATE</span>
          <span className="read-big">{hr}<em> BPM</em></span>
        </div>
        <span className="read-chip">COMBAT-1</span>
      </div>
      <EcgWave rate={hr} arousal={Math.min(0.95, 0.55 + adr * 0.4)} />
      <div className="bio-grid">
        <span><i>O2</i><b>{o2.toFixed(1)}%</b></span>
        <span><i>BP</i><b>128/84</b></span>
        <span><i>TEMP</i><b>{temp.toFixed(1)}°</b></span>
        <span><i>ADR</i><b>{adr.toFixed(2)}</b></span>
      </div>
    </section>
  )
}
