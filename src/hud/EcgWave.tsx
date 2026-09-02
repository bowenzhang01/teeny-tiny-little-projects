import { useEffect, useRef } from 'react'
import { EcgEngine, SPS, samplesPerPx, type EcgTarget } from './ecg'

/**
 * 实时合成心电图波形（Canvas 滚动迹线 + 荧光余辉）。
 * 波形形态由心率 / arousal 驱动，参考 anima-digitalis HeartWave。
 */
export function EcgWave({ rate, arousal = 0.62 }: { rate: number; arousal?: number }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const targetRef = useRef<EcgTarget>({ bpm: rate, arousal, sleeping: false })
  targetRef.current.bpm = rate
  targetRef.current.arousal = arousal

  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const engine = new EcgEngine(performance.now())
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const color = '#7dd3fc'

    let buf = new Float32Array(0)
    let dpr = 1
    let w = 0
    let h = 0
    let spp = 1
    let visible = 0

    const targetRef2 = { current: { bpm: rate, arousal, sleeping: false } }
    targetRef2.current = { bpm: rate, arousal, sleeping: false }

    const yAt = (i: number): number => h / 2 - buf[i] * h * 0.36

    const tracePath = (a: number, b: number) => {
      ctx.beginPath()
      for (let i = a; i < b; i++) {
        const x = i / spp
        if (i === a) ctx.moveTo(x, yAt(i))
        else ctx.lineTo(x, yAt(i))
      }
      ctx.stroke()
    }

    const fillSamples = (n: number, now: number) => {
      const stepMs = 1000 / SPS
      for (let j = 0; j < n; j++) {
        buf[visible - n + j] = engine.sample(now - (n - 1 - j) * stepMs)
      }
    }

    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1)
      const cssW = wrap.clientWidth
      const cssH = wrap.clientHeight
      if (cssW < 4 || cssH < 4) return
      w = Math.max(2, Math.round(cssW * dpr))
      h = Math.max(2, Math.round(cssH * dpr))
      if (canvas.width === w && canvas.height === h && buf.length > 0) return
      canvas.width = w
      canvas.height = h
      spp = samplesPerPx(dpr)
      visible = Math.max(10, Math.floor(w * spp))
      buf = new Float32Array(visible)
      fillSamples(visible, performance.now())
    }

    const draw = () => {
      ctx.clearRect(0, 0, w, h)
      ctx.strokeStyle = color
      ctx.lineWidth = 1
      const gx = Math.max(12, Math.round(SPS / spp))
      ctx.globalAlpha = 0.05
      for (let x = gx; x < w; x += gx) {
        ctx.beginPath()
        ctx.moveTo(x + 0.5, 0)
        ctx.lineTo(x + 0.5, h)
        ctx.stroke()
      }
      ctx.globalAlpha = 0.045
      for (let y = 0.25 * h; y < h; y += 0.25 * h) {
        ctx.beginPath()
        ctx.moveTo(0, Math.round(y) + 0.5)
        ctx.lineTo(w, Math.round(y) + 0.5)
        ctx.stroke()
      }
      ctx.globalAlpha = 0.09
      ctx.beginPath()
      ctx.moveTo(0, Math.round(h / 2) + 0.5)
      ctx.lineTo(w, Math.round(h / 2) + 0.5)
      ctx.stroke()

      ctx.globalAlpha = 0.14
      ctx.lineWidth = Math.max(2, dpr * 1.6)
      tracePath(0, visible)
      const segA = Math.floor(visible * 0.25)
      const segB = Math.floor(visible * 0.7)
      ctx.lineWidth = Math.max(1, dpr * 0.75)
      ctx.globalAlpha = 0.25
      tracePath(0, segA)
      ctx.globalAlpha = 0.55
      tracePath(segA, segB)
      ctx.globalAlpha = 0.9
      tracePath(segB, visible)

      ctx.globalAlpha = 1
      ctx.fillStyle = color
      const s = Math.max(1, Math.round(dpr * 0.9))
      ctx.fillRect(w - 2 * s, Math.round(yAt(visible - 1)) - s, 2 * s, 2 * s)
      ctx.globalAlpha = 1
    }

    let raf = 0
    let last = performance.now()
    let acc = 0

    const loop = (now: number) => {
      const dt = Math.min(50, now - last)
      last = now
      engine.update(targetRef2.current, dt)
      acc += (dt / 1000) * SPS
      const n = Math.floor(acc)
      acc -= n
      if (n > 0) {
        if (n >= visible) fillSamples(visible, now)
        else {
          buf.copyWithin(0, n)
          fillSamples(n, now)
        }
      }
      draw()
      raf = requestAnimationFrame(loop)
    }

    resize()
    if (reduced) draw()
    else raf = requestAnimationFrame(loop)

    const ro = new ResizeObserver(() => resize())
    ro.observe(wrap)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  return (
    <div ref={wrapRef} className="ecg-wrap" aria-hidden>
      <canvas ref={canvasRef} className="ecg-canvas" />
    </div>
  )
}
