export function Hud({ ready }: { ready: boolean }) {
  return (
    <div className="hud">
      <header>
        <h1>3D Playground</h1>
        <p className="badge">Vite · React · Three.js · R3F · Postprocessing</p>
      </header>

      <aside className="controls">
        <p><strong>左键拖动</strong> · 旋转视角</p>
        <p><strong>滚轮</strong> · 缩放</p>
        <p><strong>右键拖动</strong> · 平移</p>
        <p><strong>左上角面板</strong> · 实时调参</p>
      </aside>

      {!ready && <div className="loader">正在初始化 WebGL 场景…</div>}
      {ready && <footer className="ready">✓ 场景就绪</footer>}
    </div>
  )
}
