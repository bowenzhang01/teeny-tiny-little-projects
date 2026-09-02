import { useEffect, useState } from 'react'
import { targetRegistry } from '../../combat/targetRegistry'

/** 小型雷达：把目标按相对方位/距离投到扇区里 */
export function Radar() {
  const [blips, setBlips] = useState<Record<string, { x: number; y: number; dist: number }>>({})
  useEffect(() => {
    const timer = window.setInterval(() => {
      const cam = targetRegistry.getCamera()
      if (!cam) return
      const inv = cam.matrixWorldInverse
      const next: Record<string, { x: number; y: number; dist: number }> = {}
      for (const t of targetRegistry.all()) {
        const p = targetRegistry.aimWorld(t)
        const v = p.clone().applyMatrix4(inv)
        const bearing = Math.atan2(v.x, -v.z)
        const dist = Math.hypot(v.x, v.y, v.z)
        const r = Math.min(1, dist / 16)
        next[t.id] = { x: 50 + Math.sin(bearing) * 44 * r, y: 50 - Math.cos(bearing) * 44 * r, dist }
      }
      setBlips(next)
    }, 200)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <div className="radar">
      <div className="radar-ring r1" />
      <div className="radar-ring r2" />
      <div className="radar-cross" />
      {Object.entries(blips).map(([id, b]) => (
        <span key={id} className={`radar-blip ${id}`} style={{ left: `${b.x}%`, top: `${b.y}%` }}>
          <i />
          <em>{b.dist < 10 ? b.dist.toFixed(1) : '--'}m</em>
        </span>
      ))}
      <span className="radar-self">◇</span>
    </div>
  )
}
