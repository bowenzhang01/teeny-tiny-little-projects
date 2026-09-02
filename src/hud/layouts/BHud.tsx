import { useEffect, useReducer, useState } from 'react'
import { useRange } from '../../state/rangeStore'
import { Bar } from '../widgets/Bar'
import { CompassStrip } from '../widgets/CompassStrip'
import { Radar } from '../widgets/Radar'
import { EnemyMarkers } from '../widgets/EnemyMarkers'
import { DecoStrip } from '../widgets/DecoStrip'
import { ScreenFlash } from '../widgets/ScreenFlash'
import { BioPanel } from '../widgets/BioPanel'
import { ExoPanel } from '../widgets/ExoPanel'
import { CommsPanel } from '../widgets/CommsPanel'

/* ---------------------------- 主 HUD ---------------------------- */

export function BHud({ ready }: { ready: boolean }) {
  const {
    score,
    hits,
    shots,
    locked,
    message,
    messageId,
    lockedTargetId,
    hive,
    railgunDeployed,
    minigunDeployed,
    railgunCharging,
    railgunCooldownUntil,
    minigunSpinning,
    minigunFiring,
  } = useRange()

  // 冷却/闪烁定时器
  const [, tick] = useReducer((x: number) => x + 1, 0)
  const [nowMs, setNowMs] = useState(0)
  useEffect(() => {
    const timer = window.setInterval(() => {
      tick()
      setNowMs(performance.now())
    }, 120)
    return () => window.clearInterval(timer)
  }, [])

  // 武器磨损模拟数据（低帧率即可）
  const [wear, setWear] = useState(18)
  useEffect(() => {
    const timer = window.setInterval(() => {
      setWear(Math.min(96, 16 + shots * 0.42 + Math.random() * 2))
    }, 900)
    return () => window.clearInterval(timer)
  }, [shots])

  // 夜视：N 键切换绿色滤镜
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

  const now = nowMs
  const hiveCd = Math.max(0, hive.cooldownUntil - now)
  const railgunCd = Math.max(0, railgunCooldownUntil - now)
  const hand = !railgunDeployed && !minigunDeployed
  const weaponLabel = hand
    ? 'GRENADE MG'
    : [railgunDeployed ? 'RAILGUN' : null, minigunDeployed ? 'MINIGUN' : null].filter(Boolean).join(' + ')
  const accuracy = shots > 0 ? Math.min(100, Math.round((hits / shots) * 100)) : 0

  return (
    <div className="hud">
      {/* 通用屏幕闪光（闪光弹/爆炸白闪） */}
      <ScreenFlash />
      {/* 玻璃底板 + 扫描线 + 角标 */}
      <div className="glass-plate" aria-hidden />
      <div className="scanline overlay" aria-hidden />
      <div className="corner tl" aria-hidden />
      <div className="corner tr" aria-hidden />
      <div className="corner bl" aria-hidden />
      <div className="corner br" aria-hidden />

      {/* 顶栏：品牌 + 罗盘 + 坐标 */}
      <header className="hud-top">
        <div className="brand">
          <span className="brand-code">B // SURGE-07</span>
          <span className="brand-sub">SQUAD-B · FIRING RANGE VR · OPS LINK</span>
        </div>
        <CompassStrip />
        <div className="top-coords">
          <span>COORD 24.18N / 118.02E</span>
          <span>ALT 4.2M</span>
          <span className={nv ? 'nv-on' : ''}>NV {nv ? 'ON' : 'OFF'}</span>
        </div>
      </header>

      {/* 左：通用生理 + 外骨骼 */}
      <aside className="hud-left">
        <BioPanel operator="B" shots={shots} />
        <ExoPanel />
      </aside>

      {/* 右：武器 + 战术雷达 */}
      <aside className="hud-right">
        <section className="tac weapons">
          <h3>ARMAMENT</h3>
          <div className={`wp-line ${hand ? 'active' : ''}`}>
            <span>GRENADE MG</span>
            <em>{hand ? 'IN HAND' : 'STOWED'}</em>
          </div>
          <div className={`wp-line ${railgunDeployed ? 'active' : ''}`}>
            <span>RAILGUN</span>
            <em>
              {!railgunDeployed
                ? 'BACK'
                : railgunCharging
                  ? 'CHARGING'
                  : railgunCd > 0
                    ? `CD ${(railgunCd / 1000).toFixed(1)}S`
                    : 'DEPLOYED'}
            </em>
          </div>
          <div className={`wp-line ${minigunDeployed ? 'active' : ''}`}>
            <span>MINIGUN</span>
            <em>
              {!minigunDeployed
                ? 'BACK'
                : minigunFiring
                  ? 'FIRING'
                  : minigunSpinning
                    ? 'SPIN-UP'
                    : 'DEPLOYED'}
            </em>
          </div>
          <div className="wp-sub">
            <span>HIVE</span>
            <b>{hive.left}/{hive.right}</b>
            <em>{hiveCd > 0 ? `CD ${(hiveCd / 1000).toFixed(1)}S` : 'READY'}</em>
          </div>
          <div className="wp-sub">
            <span>WEAR</span>
            <b>{wear.toFixed(0)}%</b>
            <em>{wear > 75 ? 'MAINT!' : 'OK'}</em>
          </div>
          <Bar label="WPN INTEG" value={100 - wear} />
          <div className="weapon-foot">
            <span>AMMO ∞</span>
            <span>ACC {accuracy}%</span>
            <span>HITS {hits}</span>
          </div>
        </section>

        <section className="tac targets">
          <h3>TACTICAL // TARGETS</h3>
          <div className="radar-row">
            <Radar />
            <div className="target-list">
              <div className="target-line active">
                <span>T-01</span>
                <b>9.0M</b>
                <em>{lockedTargetId ? 'LOCK' : 'SCAN'}</em>
              </div>
              <div className="target-line dim">
                <span>T-02</span>
                <b>--</b>
                <em>UNK</em>
              </div>
              <div className="target-line dim">
                <span>T-03</span>
                <b>--</b>
                <em>UNK</em>
              </div>
            </div>
          </div>
        </section>
      </aside>

      {/* 左下：通用小队通信 + 环境 */}
      <aside className="hud-bottom-left">
        <CommsPanel squad="SQ-B" activeId="B" />
        <section className="tac env">
          <h3>ENV SENSORS</h3>
          <div className="env-grid">
            <span><i>WIND</i><b>2.1 M/S</b></span>
            <span><i>HUM</i><b>38%</b></span>
            <span><i>PRESS</i><b>1.01 ATM</b></span>
            <span><i>UV</i><b>0.4</b></span>
          </div>
        </section>
      </aside>

      {/* 右下：状态胶囊 + 装饰条 */}
      <aside className="hud-bottom-right">
        <div className="status-pills">
          <span className={`pill ${nv ? 'on' : ''}`}>NV {nv ? 'ON' : 'OFF'}</span>
          <span className={`pill ${lockedTargetId ? 'on' : ''}`}>LOCK ○/●</span>
          <span className="pill">EXO LINK</span>
          <span className={`pill ${wear > 75 ? 'warn' : ''}`}>MAINT {wear > 75 ? 'HIGH' : 'OK'}</span>
        </div>
        <DecoStrip />
      </aside>

      {/* 中央：准星 + 锁定 + 辅助 */}
      <div className="hud-center">
        <div className="crosshair">
          <span className="ch-h" />
          <span className="ch-v" />
          <span className="ch-dot" />
        </div>
        <div className={`lock-ring ${lockedTargetId ? 'on' : ''}`} />
        <div className="center-readout">
          <span className={`lock-state ${lockedTargetId ? 'on' : ''}`}>
            {lockedTargetId ? 'LOCK ACQUIRED' : 'SEARCHING'}
          </span>
          <span className="center-utils">AIM ASSIST {lockedTargetId ? 'ON' : 'STANDBY'} · {weaponLabel}</span>
        </div>
        <div className="center-score">{score} PTS</div>
      </div>

      {/* 屏幕投影敌人标记 */}
      <EnemyMarkers />

      {/* 命中反馈 */}
      {messageId > 0 && (
        <div key={messageId} className={`hit-message ${message.startsWith('命中') || message.includes('+') ? 'hit' : 'miss'}`}>
          {message}
        </div>
      )}

      {/* 加载/状态 */}
      {!ready && <div className="loader">LOADING FIRING RANGE…</div>}
      {ready && (
        <footer className={`ready ${locked ? 'locked' : ''}`}>
          {locked ? `✓ LIVE · ${weaponLabel}` : '○ CLICK TO ENGAGE'}
        </footer>
      )}
    </div>
  )
}
