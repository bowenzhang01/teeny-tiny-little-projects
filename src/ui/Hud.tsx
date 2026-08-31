import { hoseStore } from '../state/hoseStore'

export function Hud({ ready }: { ready: boolean }) {
  return (
    <div className="hud">
      <header>
        <h1>Pantyhose Sim</h1>
        <p className="badge">Three.js · R3F · Cloth Sim</p>
      </header>

      <aside className="controls">
        <p><strong>按住连裤袜拖动</strong> · 向上拉 / 向下放</p>
        <p><strong>左键空白处拖动</strong> · 旋转视角</p>
        <p><strong>滚轮</strong> · 缩放</p>
        <p><strong>左上角面板</strong> · 实时调参</p>
      </aside>

      <div className="action-bar">
        <button onClick={() => hoseStore.setMode('on')}>一键穿上</button>
        <button onClick={() => hoseStore.setMode('off')}>拉下来</button>
      </div>

      {!ready && <div className="loader">正在初始化布料模拟…</div>}
      {ready && <footer className="ready">✓ 布料模拟就绪</footer>}
    </div>
  )
}
