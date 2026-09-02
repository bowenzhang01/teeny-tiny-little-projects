import { useEffect, useState } from 'react'

const DEFAULT_DECO_POOL = [
  'CH-07 // LINK OK',
  'SAT 4/7',
  'NODE 12-B',
  '0x1F7C',
  'CAL OK',
  'FILTER 92%',
  'G-BUS 3.2',
  'HASH 4F9E',
  'PING 12ms',
  'CORE SYNC',
]

/** 装饰性滚动数据条（唬人但无害） */
export function DecoStrip({ pool }: { pool?: string[] }) {
  const data = pool ?? DEFAULT_DECO_POOL
  const [chips, setChips] = useState<string[]>(data.slice(0, 5))
  useEffect(() => {
    const timer = window.setInterval(() => {
      setChips((prev) => {
        const next = [...prev.slice(1)]
        next.push(data[Math.floor(Math.random() * data.length)])
        return next
      })
    }, 800)
    return () => window.clearInterval(timer)
  }, [data])

  return (
    <div className="deco-strip">
      {chips.map((c, i) => (
        <span key={i}>{c}</span>
      ))}
    </div>
  )
}
