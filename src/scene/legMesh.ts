import * as THREE from 'three'

export interface LegSample {
  pos: THREE.Vector3
  tangent: THREE.Vector3
  b1: THREE.Vector3
  b2: THREE.Vector3
  radius: number
}

export interface LegProfile {
  side: 1 | -1
  curve: THREE.CatmullRomCurve3
  radiusCurve: THREE.CatmullRomCurve3
  length: number
  samples: LegSample[]
  /** 每个采样点的累计弧长（从脚尖开始） */
  cumulative: Float32Array
}

export interface ClothData {
  geometry: THREE.BufferGeometry
  pos: Float32Array
  colors: Float32Array
  rows: number
  cols: number
}

const SAMPLE_COUNT = 160
export const CLOTH_OFFSET = 0.013
/** 布料总长相对腿长的额外松弛量（决定“缩拢”时的褶皱量） */
export const TOTAL_SLACK = 0.18

/* ------------------------------------------------------------------ */
/* 腿部曲线                                                            */
/* ------------------------------------------------------------------ */

function makeCurves(side: 1 | -1) {
  const points = [
    new THREE.Vector3(side * 0.17, 0.055, 0.3), // 脚尖
    new THREE.Vector3(side * 0.17, 0.042, 0.2), // 脚掌
    new THREE.Vector3(side * 0.17, 0.055, 0.1), // 脚背
    new THREE.Vector3(side * 0.17, 0.1, 0.03), // 脚踝
    new THREE.Vector3(side * 0.17, 0.18, 0.0), // 小腿下
    new THREE.Vector3(side * 0.18, 0.35, 0.01), // 小腿
    new THREE.Vector3(side * 0.18, 0.53, 0.02), // 膝盖
    new THREE.Vector3(side * 0.19, 0.72, 0.04), // 大腿
    new THREE.Vector3(side * 0.2, 0.95, 0.045), // 髋部
  ]
  const radii = [0.034, 0.04, 0.046, 0.054, 0.061, 0.083, 0.071, 0.094, 0.104]
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5)
  const radiusCurve = new THREE.CatmullRomCurve3(
    radii.map((r) => new THREE.Vector3(r, 0, 0)),
    false,
    'catmullrom',
    0.5,
  )
  return { curve, radiusCurve }
}

export function buildLegProfile(side: 1 | -1): LegProfile {
  const { curve, radiusCurve } = makeCurves(side)
  const samples: LegSample[] = []
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const t = i / (SAMPLE_COUNT - 1)
    const pos = curve.getPoint(t)
    const tangent = curve.getTangent(t).normalize()
    const ref =
      Math.abs(tangent.z) > 0.92 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1)
    const b1 = new THREE.Vector3().crossVectors(tangent, ref).normalize()
    const b2 = new THREE.Vector3().crossVectors(tangent, b1).normalize()
    const radius = radiusCurve.getPoint(t).x
    samples.push({ pos, tangent, b1, b2, radius })
  }
  const cumulative = new Float32Array(SAMPLE_COUNT)
  for (let i = 1; i < SAMPLE_COUNT; i++) {
    cumulative[i] = cumulative[i - 1] + samples[i].pos.distanceTo(samples[i - 1].pos)
  }
  return {
    side,
    curve,
    radiusCurve,
    length: cumulative[SAMPLE_COUNT - 1],
    samples,
    cumulative,
  }
}

export function sampleAtT(profile: LegProfile, t: number): LegSample {
  const n = profile.samples.length
  const f = Math.min(1, Math.max(0, t)) * (n - 1)
  const i0 = Math.min(n - 2, Math.floor(f))
  const a = f - i0
  const s0 = profile.samples[i0]
  const s1 = profile.samples[i0 + 1]
  const out: LegSample = {
    pos: new THREE.Vector3(),
    tangent: new THREE.Vector3(),
    b1: new THREE.Vector3(),
    b2: new THREE.Vector3(),
    radius: 0,
  }
  out.pos.lerpVectors(s0.pos, s1.pos, a)
  out.tangent.lerpVectors(s0.tangent, s1.tangent, a).normalize()
  out.b1.lerpVectors(s0.b1, s1.b1, a).normalize()
  out.b2.lerpVectors(s0.b2, s1.b2, a).normalize()
  out.radius = s0.radius + (s1.radius - s0.radius) * a
  return out
}

/** 把弧长 s 转成曲线参数 t（二分查表） */
export function arcLengthToT(profile: LegProfile, s: number): number {
  const cum = profile.cumulative
  const n = cum.length
  if (s <= 0) return 0
  if (s >= cum[n - 1]) return 1
  let lo = 0
  let hi = n - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (cum[mid] < s) lo = mid + 1
    else hi = mid
  }
  const i0 = Math.max(0, lo - 1)
  const i1 = lo
  const c0 = cum[i0]
  const c1 = cum[i1]
  const a = c1 > c0 ? (s - c0) / (c1 - c0) : 0
  return (i0 + a) / (n - 1)
}

/* ------------------------------------------------------------------ */
/* 工具：围绕腿部曲线的圆环点                                         */
/* ------------------------------------------------------------------ */

export function ringPoints(
  profile: LegProfile,
  t: number,
  offset: number,
  cols: number,
  out?: Float32Array,
): Float32Array {
  const s = sampleAtT(profile, t)
  const result = out ?? new Float32Array(cols * 3)
  const r = s.radius + offset
  for (let j = 0; j < cols; j++) {
    const a = (j / cols) * Math.PI * 2
    const ca = Math.cos(a)
    const sa = Math.sin(a)
    const o = j * 3
    result[o] = s.pos.x + (ca * s.b1.x + sa * s.b2.x) * r
    result[o + 1] = s.pos.y + (ca * s.b1.y + sa * s.b2.y) * r
    result[o + 2] = s.pos.z + (ca * s.b1.z + sa * s.b2.z) * r
  }
  return result
}

/* ------------------------------------------------------------------ */
/* 腿部（皮肤）网格                                                    */
/* ------------------------------------------------------------------ */

export function buildLegGeometry(profile: LegProfile, radial = 28): THREE.BufferGeometry {
  const { samples } = profile
  const rows = samples.length
  const positions = new Float32Array((rows * radial + 2) * 3)

  for (let i = 0; i < rows; i++) {
    const s = samples[i]
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * Math.PI * 2
      const ca = Math.cos(a)
      const sa = Math.sin(a)
      const o = (i * radial + j) * 3
      positions[o] = s.pos.x + (ca * s.b1.x + sa * s.b2.x) * s.radius
      positions[o + 1] = s.pos.y + (ca * s.b1.y + sa * s.b2.y) * s.radius
      positions[o + 2] = s.pos.z + (ca * s.b1.z + sa * s.b2.z) * s.radius
    }
  }

  const indices: number[] = []
  for (let i = 0; i < rows - 1; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * radial + j
      const b = i * radial + ((j + 1) % radial)
      const c = (i + 1) * radial + j
      const d = (i + 1) * radial + ((j + 1) % radial)
      indices.push(a, c, b, b, c, d)
    }
  }

  // 脚趾 / 髋部封口
  const capStart = rows * radial
  positions.set(
    [samples[0].pos.x, samples[0].pos.y, samples[0].pos.z],
    capStart * 3,
  )
  positions.set(
    [samples[rows - 1].pos.x, samples[rows - 1].pos.y, samples[rows - 1].pos.z],
    (capStart + 1) * 3,
  )
  for (let j = 0; j < radial; j++) {
    const b = (j + 1) % radial
    indices.push(capStart, b, j)
    const last = (rows - 1) * radial
    indices.push(capStart + 1, last + j, last + b)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

/* ------------------------------------------------------------------ */
/* 连裤袜布料（按“长度守恒”缩拢 + 程序化褶皱）                        */
/* ------------------------------------------------------------------ */

function makeClothIndices(rows: number, cols: number, capIndex: number): number[] {
  const indices: number[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = r * cols + c
      const b = r * cols + ((c + 1) % cols)
      const cc = (r + 1) * cols + c
      const d = (r + 1) * cols + ((c + 1) % cols)
      indices.push(a, cc, b, b, cc, d)
    }
  }
  for (let c = 0; c < cols; c++) {
    const b = (c + 1) % cols
    indices.push(capIndex, b, c)
  }
  return indices
}

export function createCloth(profile: LegProfile, rows = 64, cols = 20): ClothData {
  const vertexCount = (rows + 1) * cols + 1
  const capIndex = (rows + 1) * cols
  const pos = new Float32Array(vertexCount * 3)
  const colors = new Float32Array(vertexCount * 3)

  // 初始状态（首帧前使用）：完全贴合腿部
  for (let r = 0; r <= rows; r++) {
    const pts = ringPoints(profile, r / rows, CLOTH_OFFSET + 0.002, cols)
    for (let j = 0; j < cols; j++) {
      const o = (r * cols + j) * 3
      pos[o] = pts[j * 3]
      pos[o + 1] = pts[j * 3 + 1]
      pos[o + 2] = pts[j * 3 + 2]
    }
  }
  const toe = sampleAtT(profile, 0.002)
  pos[capIndex * 3] = toe.pos.x
  pos[capIndex * 3 + 1] = toe.pos.y
  pos[capIndex * 3 + 2] = toe.pos.z

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.setIndex(makeClothIndices(rows, cols, capIndex))
  geometry.computeVertexNormals()

  return { geometry, pos, colors, rows, cols }
}

export interface StepOptions {
  baseColor: THREE.Color
  compression: number
  /** 褶皱幅度（世界单位） */
  wrinkle: number
  time: number
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/**
 * 核心布料求解：
 * 布料长度守恒，根据当前袜口高度把“贴腿部分”吸到腿表面，
 * 剩余松弛量以多层手风琴环的形式堆叠在袜口下方，形成真实的缩拢效果。
 */
export function stepCloth(
  data: ClothData,
  profile: LegProfile,
  hemT: number,
  opts: StepOptions,
): void {
  const { pos, colors, rows, cols } = data
  const totalMatLen = profile.length * (1 + TOTAL_SLACK)
  const hemIdx = Math.round(Math.min(1, Math.max(0, hemT)) * (SAMPLE_COUNT - 1))
  const sCovered = profile.cumulative[hemIdx]
  const slackLen = Math.max(0, totalMatLen - sCovered)
  // “缩拢带”的弧长范围：松弛量越大，堆叠带越宽（但不会超过腿长的一小部分）
  const band = Math.min(0.14, Math.max(0.02, slackLen * 0.16))
  const ring = new Float32Array(cols * 3)

  for (let r = 0; r <= rows; r++) {
    const sMat = (r / rows) * totalMatLen
    const isSlack = sMat > sCovered
    let t: number
    let slackFrac = 0
    if (isSlack) {
      slackFrac = (sMat - sCovered) / Math.max(1e-6, slackLen)
      // 松弛部分往回堆叠：越靠后的布料越靠近袜口下方外侧
      const sBunch = Math.max(0, sCovered - slackFrac * band)
      t = arcLengthToT(profile, sBunch)
    } else {
      t = arcLengthToT(profile, sMat)
    }

    const s = sampleAtT(profile, t)
    const offset =
      CLOTH_OFFSET + (isSlack ? 0.006 + slackFrac * 0.014 : 0.001)
    ringPoints(profile, t, offset, cols, ring)

    // 接近髋部时，把环向身体中线收拢（连裤袜顶部应贴着臀部/腰，而不是绕在单条大腿外侧）
    const rLeg = s.radius + offset
    const hipBlend = smoothstep(0.78, 0.95, t)
    if (hipBlend > 0) {
      const radiusNew = rLeg * (1 - hipBlend) + 0.115 * hipBlend
      const scale = radiusNew / rLeg
      for (let j = 0; j < cols; j++) {
        const o = j * 3
        ring[o] = s.pos.x * (1 - hipBlend) + (ring[o] - s.pos.x) * scale
        ring[o + 2] = s.pos.z * (1 - hipBlend) + (ring[o + 2] - s.pos.z) * scale
      }
    }

    for (let j = 0; j < cols; j++) {
      const o = (r * cols + j) * 3
      const px = ring[j * 3]
      const py = ring[j * 3 + 1]
      const pz = ring[j * 3 + 2]
      // 程序化褶皱：以腿部为中心做径向起伏
      let rx = px - s.pos.x
      let ry = py - s.pos.y
      let rz = pz - s.pos.z
      const rd2 = rx * rx + ry * ry + rz * rz
      if (rd2 > 1e-8) {
        const rd = Math.sqrt(rd2)
        const angle = (j / cols) * Math.PI * 2
        const wave = Math.sin(angle * 3 + r * 0.9 + opts.time * 1.2)
        const amp =
          (0.004 + opts.wrinkle) * (isSlack ? 0.55 + slackFrac * 0.8 : 0.22)
        const k = (amp * wave) / rd
        rx *= k
        ry *= k
        rz *= k
        pos[o] = px + rx
        pos[o + 1] = py + ry
        pos[o + 2] = pz + rz
      } else {
        pos[o] = px
        pos[o + 1] = py
        pos[o + 2] = pz
      }
    }

    // 顶点颜色：松弛越多越深（堆叠的“密实感”）；袜口两行是深色弹性边
    const shade0 = 1 - slackFrac * opts.compression
    const shade = r >= rows - 2 ? shade0 * 0.38 : shade0
    for (let j = 0; j < cols; j++) {
      const o = (r * cols + j) * 3
      colors[o] = opts.baseColor.r * shade
      colors[o + 1] = opts.baseColor.g * shade
      colors[o + 2] = opts.baseColor.b * shade
    }
  }

  // 封口点取第一行颜色
  const capIndex = (rows + 1) * cols
  colors[capIndex * 3] = colors[0]
  colors[capIndex * 3 + 1] = colors[1]
  colors[capIndex * 3 + 2] = colors[2]
}
