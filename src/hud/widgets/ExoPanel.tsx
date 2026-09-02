import { useEffect, useState } from 'react'
import { Bar } from './Bar'

/**
 * 通用外骨骼状态面板：能量/装甲/液压/完整度/伺服。
 * 所有角色 HUD 共用，主题色由外层 .theme-* 注入。
 */
export function ExoPanel({ label = 'EXO-SUIT // MK.IV' }: { label?: string }) {
  const [power, setPower] = useState(96)
  const [armor, setArmor] = useState(94)
  const [hyd, setHyd] = useState(87)
  const [integ, setInteg] = useState(99)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPower((v) => Math.max(60, Math.min(100, v - 0.08 + (Math.random() - 0.5) * 0.4)))
      setArmor((v) => Math.max(70, Math.min(99, v + (Math.random() - 0.5) * 0.25)))
      setHyd((v) => Math.max(55, Math.min(99, v + (Math.random() - 0.5) * 0.8)))
      setInteg((v) => Math.max(88, Math.min(100, v + (Math.random() - 0.5) * 0.2)))
    }, 900)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <section className="tac exo">
      <h3>{label}</h3>
      <Bar label="PWR" value={power} />
      <Bar label="ARMOR" value={armor} />
      <Bar label="HYD" value={hyd} />
      <Bar label="INTEG" value={integ} />
      <div className="exo-foot">
        <span>SERVO 6/6</span>
        <span>JOINT OK</span>
        <span>BAL 98%</span>
      </div>
    </section>
  )
}
