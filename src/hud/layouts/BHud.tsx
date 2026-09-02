import { useEffect, useReducer, useState } from 'react'
import { useRange } from '../../state/rangeStore'
import { EcgWave } from '../EcgWave'
import { Bar } from '../widgets/Bar'
import { CompassStrip } from '../widgets/CompassStrip'
import { Radar } from '../widgets/Radar'
import { EnemyMarkers } from '../widgets/EnemyMarkers'
import { DecoStrip } from '../widgets/DecoStrip'

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

  // 生理/外骨骼模拟数据（低帧率即可）
  const [hr, setHr] = useState(97)
  const [o2, setO2] = useState(97.4)
  const [temp, setTemp] = useState(36.8)
  const [adr, setAdr] = useState(0.58)
  const [exoPower, setExoPower] = useState(96)
  const [exoArmor, setExoArmor] = useState(94)
  const [exoHyd, setExoHyd] = useState(87)
  const [exoInt, setExoInt] = useState(99)
  const [wear, setWear] = useState(18)
  useEffect(() => {
    const timer = window.setInterval(() => {
      setHr((v) => Math.round(Math.max(72, Math.min(132, v + (Math.random() - 0.5) * 6 + (shots > 0 ? 0.4 : 0)))))
      setO2((v) => Math.max(94, Math.min(99.5, v + (Math.random() - 0.5) * 0.3)))
      setTemp((v) => Math.max(36.2, Math.min(37.8, v + (Math.random() - 0.5) * 0.12)))
      setAdr((v) => Math.max(0.2, Math.min(0.92, v + (Math.random() - 0.5) * 0.07)))
      setExoPower((v) => Math.max(60, Math.min(100, v - 0.08 + (Math.random() - 0.5) * 0.4)))
      setExoArmor((v) => Math.max(70, Math.min(99, v + (Math.random() - 0.5) * 0.25)))
      setExoHyd((v) => Math.max(55, Math.min(99, v + (Math.random() - 0.5) * 0.8)))
      setExoInt((v) => Math.max(88, Math.min(100, v + (Math.random() - 0.5) * 0.2)))
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

      {/* 左：生理 + 外骨骼 */}
      <aside className="hud-left">
        <section className="tac bio">
          <h3>OPERATOR // B</h3>
          <div className="bio-head">
            <div>
              <span className="read-label">HEART RATE</span>
              <span className="read-big">{hr}<em> BPM</em></span>
            </div>
            <span className="read-chip">COMBAT-1</span>
          </div>
          <EcgWave rate={hr} arousal={Math.min(0.95, 0.55 + adr * 0.4)} />
          <div className="bio-grid">
            <span><i>O2</i><b>{o2.toFixed(1)}%</b></span>
            <span><i>BP</i><b>128/84</b></span>
            <span><i>TEMP</i><b>{temp.toFixed(1)}°</b></span>
            <span><i>ADR</i><b>{adr.toFixed(2)}</b></span>
          </div>
        </section>

        <section className="tac exo">
          <h3>EXO-SUIT // MK.IV</h3>
          <Bar label="PWR" value={exoPower} />
          <Bar label="ARMOR" value={exoArmor} />
          <Bar label="HYD" value={exoHyd} />
          <Bar label="INTEG" value={exoInt} />
          <div className="exo-foot">
            <span>SERVO 6/6</span>
            <span>JOINT OK</span>
            <span>BAL 98%</span>
          </div>
        </section>
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

      {/* 左下：通信 + 环境 */}
      <aside className="hud-bottom-left">
        <section className="tac comms">
          <h3>COMMS LINK // SQ-B</h3>
          <div className="comms-line live">▸ B: HIVE POD ARMED</div>
          <div className="comms-line">▸ CH-07 // SYNC OK</div>
          <div className="comms-line dim">▸ A/E STANDBY · NET 3/5</div>
          <div className="comms-line dim">▸ ENCRYPT AES-512</div>
        </section>
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
          <span className="pill">EXO {Math.round(exoPower)}%</span>
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
