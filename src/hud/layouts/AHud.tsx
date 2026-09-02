import { useEffect, useReducer, useState, type CSSProperties } from 'react'
import { useRange } from '../../state/rangeStore'
import { assaultStore, useAssault, type GrenadeSlot } from '../../state/assaultStore'
import { targetRegistry } from '../../combat/targetRegistry'
import { CompassStrip } from '../widgets/CompassStrip'
import { Radar } from '../widgets/Radar'
import { EnemyMarkers } from '../widgets/EnemyMarkers'
import { DecoStrip } from '../widgets/DecoStrip'

const A_DECO_POOL = ['A // OPS LINK', 'LASER CAL 0.02', 'CIWS ARMED', 'MAG SENSOR OK', 'NET 98%', 'SAT 4/7']

/** A 专属热度条：红色渐变 + 过载闪烁 */
function HeatGauge({ heat }: { heat: number }) {
  const pct = Math.round(Math.min(1, heat) * 100)
  return (
    <div className={`a-heat ${heat >= 0.8 ? 'hot' : ''}`}>
      <span>HEAT</span>
      <div className="a-heat-track">
        <i style={{ width: `${pct}%` }} />
      </div>
      <b>{pct}%</b>
    </div>
  )
}

/** 手雷快捷栏：三种手雷 + 选中态 + 库存 */
function GrenadeSlots({ slots, index }: { slots: GrenadeSlot[]; index: number }) {
  return (
    <div className="a-grenades">
      {slots.map((g, i) => (
        <div
          key={g.type}
          className={`a-grenade ${i === index ? 'active' : ''} ${g.count <= 0 ? 'empty' : ''}`}
          style={{ '--g-color': g.color } as CSSProperties}
        >
          <span>{g.label}</span>
          <b>{g.count}</b>
        </div>
      ))}
    </div>
  )
}

/** 简洁目标列表：动态读取 targetRegistry 的距离 */
function TargetList({ lockedTargetId }: { lockedTargetId: string | null }) {
  const [list, setList] = useState<{ id: string; name: string; dist: number }[]>([])
  useEffect(() => {
    const timer = window.setInterval(() => {
      const cam = targetRegistry.getCamera()
      if (!cam) return
      setList(
        targetRegistry.all().map((t) => {
          const p = targetRegistry.aimWorld(t)
          return { id: t.id, name: t.name, dist: p.distanceTo(cam.position) }
        }),
      )
    }, 300)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <div className="a-target-list">
      {list.map((t) => (
        <div key={t.id} className={`a-target-line ${lockedTargetId === t.id ? 'active' : ''}`}>
          <span>{t.id}</span>
          <b>{t.dist < 10 ? t.dist.toFixed(1) : '--'}M</b>
          <em>{lockedTargetId === t.id ? 'LOCK' : 'SCAN'}</em>
        </div>
      ))}
      {list.length === 0 && <div className="a-target-line dim"><span>--</span><b>--</b><em>NO TGT</em></div>}
    </div>
  )
}

/**
 * A 突击兵专属 HUD：红色锐角战术终端。
 * 与 B 的“青蓝玻璃板”刻意区分：无整块玻璃底板、无 ECG 大面板，
 * 采用非对称斜切面板 + 武器/手雷/CIWS 三块核心状态 + 更聚焦的中置准星。
 */
export function AHud({ ready }: { ready: boolean }) {
  const { score, hits, shots, locked, message, messageId, lockedTargetId } = useRange()
  const a = useAssault()
  const [, tick] = useReducer((x: number) => x + 1, 0)
  const [reloadPct, setReloadPct] = useState(0)

  // 刷新冷却/换弹进度
  useEffect(() => {
    const timer = window.setInterval(() => {
      tick()
      const s = assaultStore.getState()
      if (s.reloading) {
        const left = Math.max(0, s.reloadUntil - performance.now())
        setReloadPct(Math.max(0, Math.min(100, 100 - (left / s.reloadDuration) * 100)))
      } else {
        setReloadPct(0)
      }
    }, 100)
    return () => window.clearInterval(timer)
  }, [])

  // 夜视（N）：A HUD 也支持
  const [nv, setNv] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyN') setNv((v) => !v)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  useEffect(() => {
    document.body.classList.toggle('nv', nv)
  }, [nv])

  const accuracy = shots > 0 ? Math.min(100, Math.round((hits / shots) * 100)) : 0
  const weaponLabel = 'ASSAULT LMG'

  return (
    <div className="hud a-hud">
      {/* 斜切红框架（无玻璃整板） */}
      <div className="a-frame" aria-hidden />

      {/* 顶栏 */}
      <header className="a-topbar">
        <div className="a-brand">
          <b>A // VANTA-01</b>
          <span>SQUAD-A · ASSAULT OPS</span>
        </div>
        <CompassStrip />
        <div className="a-top-right">
          <span>NET 98%</span>
          <span>SYNC 4/5</span>
          <span className={nv ? 'on' : ''}>NV {nv ? 'ON' : 'OFF'}</span>
        </div>
      </header>

      {/* 左列：核心武器系统（L形组件区） */}
      <aside className="a-left">
        <section className="a-panel weapon">
          <header className="a-panel-head">
            <h3>PRIMARY // LMG</h3>
            <em className={a.stabilize ? 'on' : ''}>STAB {a.stabilize ? 'ON' : 'OFF'}</em>
          </header>
          <div className="a-mag">
            <b>{a.mag}</b>
            <span>/ {a.magSize}</span>
          </div>
          <HeatGauge heat={a.heat} />
          <div className="a-mini-row">
            <span>LASER {a.laserOn ? 'ON' : 'OFF'}</span>
            <span className={a.reloading ? 'warn' : ''}>
              {a.reloading ? 'RELOADING' : a.mag === 0 ? 'EMPTY' : 'READY'}
            </span>
            <span>ACC {accuracy}%</span>
          </div>
          {a.reloading && (
            <div className="a-reload">
              <i style={{ width: `${reloadPct}%` }} />
            </div>
          )}
        </section>

        <section className="a-panel grenades">
          <header className="a-panel-head">
            <h3>GRENADE // SELECT</h3>
            <em>G THROW · T CYCLE</em>
          </header>
          <GrenadeSlots slots={a.grenades} index={a.grenadeIndex} />
        </section>

        <section className="a-panel ciws">
          <header className="a-panel-head">
            <h3>CIWS // SHOULDER</h3>
            <em className={a.ciws.online ? 'on' : ''}>{a.ciws.online ? 'ONLINE' : 'OFFLINE'}</em>
          </header>
          <div className="a-ciws-row">
            <span className={`a-ciws-node ${a.ciws.online ? 'on' : ''}`}>L</span>
            <span className={`a-ciws-node ${a.ciws.online ? 'on' : ''}`}>R</span>
            <b>{a.ciws.tracking ? `MARK ${a.ciws.tracking}` : a.ciws.online ? 'SCAN' : 'STANDBY'}</b>
          </div>
          <div className="a-ciws-note">LASER MARK WIDENS AUTO-LOCK</div>
        </section>
      </aside>

      {/* 右列：战术网 */}
      <aside className="a-right">
        <section className="a-panel tactical">
          <header className="a-panel-head">
            <h3>TACTICAL // NET</h3>
            <em>LIVE FEED</em>
          </header>
          <div className="a-radar-row">
            <Radar />
            <TargetList lockedTargetId={lockedTargetId} />
          </div>
        </section>

        <section className="a-panel status">
          <div className="a-pills">
            <span className={`a-pill ${locked ? 'on' : ''}`}>LIVE</span>
            <span className={`a-pill ${a.laserOn ? 'on' : ''}`}>LASER</span>
            <span className={`a-pill ${a.ciws.online ? 'on' : ''}`}>CIWS</span>
            <span className={`a-pill ${a.heat >= 0.8 ? 'warn' : ''}`}>HEAT {Math.round(a.heat * 100)}%</span>
          </div>
          <div className="a-stat-row">
            <span>SCORE <b>{score}</b></span>
            <span>HITS <b>{hits}</b></span>
            <span>SHOTS <b>{shots}</b></span>
          </div>
          <DecoStrip pool={A_DECO_POOL} />
        </section>
      </aside>

      {/* 左下：操作提示（A 专属键位） */}
      <aside className="a-controls">
        <span><b>LMB</b> FIRE</span>
        <span><b>RMB</b> STABILIZE</span>
        <span><b>R</b> RELOAD</span>
        <span><b>G</b> GRENADE</span>
        <span><b>T</b> CYCLE</span>
      </aside>

      {/* 中央：锐角准星 + 锁定 */}
      <div className="a-center">
        <div className="a-crosshair">
          <i className="ah" />
          <i className="av" />
          <i className="ad" />
        </div>
        <div className={`a-lock-ring ${lockedTargetId ? 'on' : ''}`} />
        <div className="a-center-readout">
          <span className={`a-lock-state ${lockedTargetId ? 'on' : ''}`}>
            {lockedTargetId ? 'TARGET LOCK' : 'ACQUIRING'}
          </span>
          <span className="a-weapon">{weaponLabel}{a.stabilize ? ' · STABILIZED' : ''}</span>
        </div>
        <div className="a-score">{score} PTS</div>
      </div>

      {/* 屏幕投影敌人标记 */}
      <EnemyMarkers />

      {/* 命中反馈 */}
      {messageId > 0 && (
        <div key={messageId} className={`hit-message ${message.startsWith('命中') || message.includes('+') ? 'hit' : 'miss'}`}>
          {message}
        </div>
      )}

      {/* 右下：状态胶囊 */}
      <aside className="a-bottom-right">
        <div className="status-pills">
          <span className={`pill ${locked ? 'on' : ''}`}>A LIVE</span>
          <span className={`pill ${a.ciws.online ? 'on' : ''}`}>CIWS</span>
          <span className={`pill ${a.reloading ? 'warn' : ''}`}>{a.reloading ? 'RELOAD' : a.mag <= 20 ? 'LOW' : 'OK'}</span>
        </div>
      </aside>

      {/* 加载/状态 */}
      {!ready && <div className="loader">LOADING ASSAULT LINK…</div>}
      {ready && (
        <footer className={`ready ${locked ? 'locked' : ''}`}>
          {locked ? `✓ LIVE · ${weaponLabel}` : '○ CLICK TO ENGAGE'}
        </footer>
      )}
    </div>
  )
}
