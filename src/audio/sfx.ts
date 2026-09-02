/**
 * 极简合成音效：不依赖任何音频文件。
 * AudioContext 在第一次开枪（用户手势）时惰性创建。
 */

let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  try {
    if (!ctx) {
      ctx = new AudioContext()
    }
    if (ctx.state === 'suspended') {
      void ctx.resume()
    }
    return ctx
  } catch {
    return null
  }
}

/** 短促噪声 + 低频冲击 -> 枪声 */
export function playShot() {
  const ac = getCtx()
  if (!ac) return
  const now = ac.currentTime
  const duration = 0.18

  // 噪声部分（弹道“啪”）
  const buffer = ac.createBuffer(1, Math.floor(ac.sampleRate * duration), ac.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) {
    const t = i / data.length
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.4)
  }
  const noise = ac.createBufferSource()
  noise.buffer = buffer
  const noiseGain = ac.createGain()
  noiseGain.gain.setValueAtTime(0.7, now)
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration)
  const filter = ac.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(3200, now)
  filter.frequency.exponentialRampToValueAtTime(320, now + duration)
  noise.connect(filter).connect(noiseGain).connect(ac.destination)
  noise.start(now)
  noise.stop(now + duration)

  // 低频“砰”
  const osc = ac.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(150, now)
  osc.frequency.exponentialRampToValueAtTime(45, now + 0.14)
  const oscGain = ac.createGain()
  oscGain.gain.setValueAtTime(0.5, now)
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16)
  osc.connect(oscGain).connect(ac.destination)
  osc.start(now)
  osc.stop(now + 0.18)
}

/** 命中标靶的清脆“叮” */
export function playHit() {
  const ac = getCtx()
  if (!ac) return
  const now = ac.currentTime
  const osc = ac.createOscillator()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(880, now)
  osc.frequency.exponentialRampToValueAtTime(1320, now + 0.05)
  const gain = ac.createGain()
  gain.gain.setValueAtTime(0.28, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22)
  osc.connect(gain).connect(ac.destination)
  osc.start(now)
  osc.stop(now + 0.24)
}

/** 空仓击锤声 */
export function playDry() {
  const ac = getCtx()
  if (!ac) return
  const now = ac.currentTime
  const osc = ac.createOscillator()
  osc.type = 'square'
  osc.frequency.setValueAtTime(2200, now)
  const gain = ac.createGain()
  gain.gain.setValueAtTime(0.06, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04)
  osc.connect(gain).connect(ac.destination)
  osc.start(now)
  osc.stop(now + 0.05)
}

/** 换弹的机械声：两下短click */
export function playReload() {
  const ac = getCtx()
  if (!ac) return
  const now = ac.currentTime
  for (const [offset, freq] of [
    [0, 900],
    [0.12, 1400],
  ] as const) {
    const osc = ac.createOscillator()
    osc.type = 'square'
    osc.frequency.setValueAtTime(freq, now + offset)
    const gain = ac.createGain()
    gain.gain.setValueAtTime(0.08, now + offset)
    gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.05)
    osc.connect(gain).connect(ac.destination)
    osc.start(now + offset)
    osc.stop(now + offset + 0.06)
  }
}

/** 背挂武器液压展开/收回 */
export function playDeploy() {
  const ac = getCtx()
  if (!ac) return
  const now = ac.currentTime
  // 两下机械卡扣
  for (const offset of [0, 0.16]) {
    const osc = ac.createOscillator()
    osc.type = 'square'
    osc.frequency.setValueAtTime(520 + offset * 1200, now + offset)
    const gain = ac.createGain()
    gain.gain.setValueAtTime(0.07, now + offset)
    gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.06)
    osc.connect(gain).connect(ac.destination)
    osc.start(now + offset)
    osc.stop(now + offset + 0.07)
  }
  // 液压气流
  const buffer = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.4), ac.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) {
    const t = i / data.length
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.2) * 0.25
  }
  const noise = ac.createBufferSource()
  noise.buffer = buffer
  const filter = ac.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.setValueAtTime(900, now)
  filter.frequency.exponentialRampToValueAtTime(2200, now + 0.35)
  const gain = ac.createGain()
  gain.gain.setValueAtTime(0.18, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4)
  noise.connect(filter).connect(gain).connect(ac.destination)
  noise.start(now)
  noise.stop(now + 0.4)
}

/** 轨道炮充能上升音 */
export function playRailCharge() {
  const ac = getCtx()
  if (!ac) return
  const now = ac.currentTime
  const osc = ac.createOscillator()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(180, now)
  osc.frequency.exponentialRampToValueAtTime(1400, now + 0.5)
  const gain = ac.createGain()
  gain.gain.setValueAtTime(0.05, now)
  gain.gain.exponentialRampToValueAtTime(0.12, now + 0.45)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55)
  const filter = ac.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(1200, now)
  filter.frequency.exponentialRampToValueAtTime(3600, now + 0.5)
  osc.connect(filter).connect(gain).connect(ac.destination)
  osc.start(now)
  osc.stop(now + 0.55)
}

/** 轨道炮开火：电击 + 低频冲击 */
export function playRailShot() {
  const ac = getCtx()
  if (!ac) return
  const now = ac.currentTime
  const duration = 0.35
  const buffer = ac.createBuffer(1, Math.floor(ac.sampleRate * duration), ac.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) {
    const t = i / data.length
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 1.6)
  }
  const noise = ac.createBufferSource()
  noise.buffer = buffer
  const filter = ac.createBiquadFilter()
  filter.type = 'highpass'
  filter.frequency.setValueAtTime(1400, now)
  filter.frequency.exponentialRampToValueAtTime(400, now + duration)
  const noiseGain = ac.createGain()
  noiseGain.gain.setValueAtTime(0.4, now)
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration)
  noise.connect(filter).connect(noiseGain).connect(ac.destination)
  noise.start(now)
  noise.stop(now + duration)

  const osc = ac.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(90, now)
  osc.frequency.exponentialRampToValueAtTime(35, now + 0.22)
  const oscGain = ac.createGain()
  oscGain.gain.setValueAtTime(0.5, now)
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.26)
  osc.connect(oscGain).connect(ac.destination)
  osc.start(now)
  osc.stop(now + 0.28)
}

/** 六管机枪预热（spin-up） */
export function playMinigunSpin() {
  const ac = getCtx()
  if (!ac) return
  const now = ac.currentTime
  const osc = ac.createOscillator()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(60, now)
  osc.frequency.exponentialRampToValueAtTime(240, now + 0.55)
  const gain = ac.createGain()
  gain.gain.setValueAtTime(0.05, now)
  gain.gain.exponentialRampToValueAtTime(0.16, now + 0.5)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6)
  osc.connect(gain).connect(ac.destination)
  osc.start(now)
  osc.stop(now + 0.6)
}

/** 六管机枪单发短促打击 */
export function playMinigunShot() {
  const ac = getCtx()
  if (!ac) return
  const now = ac.currentTime
  const duration = 0.07
  const buffer = ac.createBuffer(1, Math.floor(ac.sampleRate * duration), ac.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) {
    const t = i / data.length
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2)
  }
  const noise = ac.createBufferSource()
  noise.buffer = buffer
  const filter = ac.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(2600, now)
  const gain = ac.createGain()
  gain.gain.setValueAtTime(0.22, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration)
  noise.connect(filter).connect(gain).connect(ac.destination)
  noise.start(now)
  noise.stop(now + duration)
}
