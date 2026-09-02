export function Bar({ label, value, suffix = '%' }: { label: string; value: number; suffix?: string }) {
  const v = Math.max(0, Math.min(100, value))
  const color = v > 70 ? '#7dd3fc' : v > 40 ? '#fbbf24' : '#f87171'
  return (
    <div className="tac-bar">
      <span className="tb-label">{label}</span>
      <div className="tb-track">
        <div className="tb-fill" style={{ width: `${v}%`, background: color, boxShadow: `0 0 8px ${color}` }} />
      </div>
      <span className="tb-value">{v.toFixed(0)}{suffix}</span>
    </div>
  )
}
