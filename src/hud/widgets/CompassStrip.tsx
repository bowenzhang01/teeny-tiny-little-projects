import { useEffect, useState } from 'react'
import * as THREE from 'three'
import { targetRegistry } from '../../combat/targetRegistry'

/** 罗盘条 + 方位角/俯仰角 */
export function CompassStrip() {
  const [hdg, setHdg] = useState({ yaw: 0, pitch: 0 })
  useEffect(() => {
    const timer = window.setInterval(() => {
      const cam = targetRegistry.getCamera()
      if (!cam) return
      const v = new THREE.Vector3()
      cam.getWorldDirection(v)
      const yaw = (Math.atan2(v.x, -v.z) * 180) / Math.PI
      const pitch = (Math.asin(Math.max(-1, Math.min(1, v.y))) * 180) / Math.PI
      setHdg({ yaw: (yaw + 360) % 360, pitch })
    }, 50)
    return () => window.clearInterval(timer)
  }, [])

  // 多周期刻度（-360° ~ 720°），保证横向滚动到任意航向都有内容
  const ticks: number[] = []
  for (let d = -360; d <= 720; d += 10) ticks.push(d)
  const stepPx = 4 // 1° = 4px（刻度宽 28px + 间距 12px，每 10° = 40px）
  return (
    <div className="compass-strip">
      <div className="compass-ruler" style={{ transform: `translateX(${-hdg.yaw * stepPx}px)` }}>
        {ticks.map((d) => {
          const norm = ((d % 360) + 360) % 360
          const label =
            norm % 90 === 0
              ? ['N', 'E', 'S', 'W'][(norm / 90) % 4]
              : `${norm < 100 ? '0' : ''}${norm}`
          return (
            <span key={d} className={norm % 90 === 0 ? 'tick-major' : 'tick'}>
              {label}
            </span>
          )
        })}
      </div>
      <div className="compass-center" />
      <div className="compass-readout">
        AZ {hdg.yaw.toFixed(1)}° · EL {hdg.pitch >= 0 ? '+' : ''}{hdg.pitch.toFixed(1)}°
      </div>
    </div>
  )
}
