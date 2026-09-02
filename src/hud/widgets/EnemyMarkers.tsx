import { useEffect, useRef, useState } from 'react'
import { targetRegistry } from '../../combat/targetRegistry'

/** 屏幕投影敌人标记（相对准星的方位） */
export function EnemyMarkers() {
  const [ids, setIds] = useState<string[]>([])
  const refs = useRef<Record<string, HTMLDivElement | null>>({})
  const idsRef = useRef<string[]>([])

  useEffect(() => {
    let raf = 0
    const loop = () => {
      const targets = targetRegistry.all()
      const keys = targets.map((t) => t.id)
      if (keys.join(',') !== idsRef.current.join(',')) {
        idsRef.current = keys
        setIds(keys)
      }
      const cam = targetRegistry.getCamera()
      const w = window.innerWidth
      const h = window.innerHeight
      for (const t of targets) {
        const el = refs.current[t.id]
        if (!el || !cam) continue
        const p = targetRegistry.projectToScreen(targetRegistry.aimWorld(t), w, h)
        if (!p || p.behind) {
          el.style.display = 'none'
          continue
        }
        el.style.display = 'flex'
        el.style.transform = `translate(-50%, -50%) translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="enemy-layer">
      {ids.map((id) => (
        <div
          key={id}
          ref={(el) => {
            refs.current[id] = el
          }}
          className="enemy-marker"
          style={{ display: 'none' }}
        >
          <span className="em-frame">▣</span>
          <span className="em-name">{targetRegistry.get(id)?.name ?? id}</span>
        </div>
      ))}
    </div>
  )
}
