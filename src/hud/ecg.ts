/** 心电图数学模型（参考 anima-digitalis 的 ecg.ts）
 *  P-Q-R-S-T 高斯模板（时间域）+ HRV 引擎（RSA / Mayer 波 / OU 随机游走）
 *  纯前端合成、帧率无关；由心率 / arousal 驱动波形形态。
 */

/** 采样率（次/秒）。QRS 约 22ms 宽，250Hz 足够还原尖峰。 */
export const SPS = 250;

const TPL_SIZE = 2048;
const REF_RR = 1000; // 参考 RR 间期（ms）
const WIN_START = 0.1; // P 波起始相位（参考 RR=1000ms 时）

function gaussian(t: number, amp: number, center: number, width: number): number {
  return amp * Math.exp(-((t - center) ** 2) / (2 * width * width));
}

/** [振幅, 中心相位, 宽度] */
type WaveSpec = [number, number, number];

function buildTemplate(waves: WaveSpec[]): Float32Array {
  const tpl = new Float32Array(TPL_SIZE + 1);
  for (let i = 0; i <= TPL_SIZE; i++) {
    const p = i / TPL_SIZE;
    let v = 0;
    for (const [amp, center, width] of waves) v += gaussian(p, amp, center, width);
    tpl[i] = v;
  }
  return tpl;
}

const TPL_PQS = buildTemplate([
  [0.13, 0.15, 0.02], // P 波：小而圆
  [-0.09, 0.24, 0.007], // Q 波：小负向偏转
  [-0.22, 0.325, 0.011], // S 波：R 波后的负向偏转
]);
const TPL_R = buildTemplate([[1.0, 0.285, 0.011]]); // R 波：高尖峰
const TPL_T = buildTemplate([[0.28, 0.52, 0.045]]); // T 波：宽而圆
const TPL_U = buildTemplate([[0.02, 0.72, 0.03]]); // U 波：微弱

export interface EcgTarget {
  bpm: number;
  arousal: number;
  sleeping: boolean;
}

export class EcgEngine {
  private bpm = 65;
  private arousal = 0.3;
  private sleeping = false;
  private beatStart: number;
  private rr = REF_RR;
  private rsaPhase = 0;
  private mayerPhase = 0;
  private ou = 0;

  constructor(now: number) {
    this.beatStart = now - this.rr * 0.4;
  }

  reset(now: number): void {
    this.beatStart = now - this.rr * 0.3;
  }

  update(target: EcgTarget, dtMs: number): void {
    const t = Math.min(1, dtMs / 1000);
    const targetBpm = target.bpm > 0 ? Math.max(40, Math.min(160, target.bpm)) : 65;
    this.bpm += (targetBpm - this.bpm) * (1 - Math.exp(-t * 1.6));
    const a = Math.max(0, Math.min(1, target.arousal));
    this.arousal += (a - this.arousal) * (1 - Math.exp(-t * 1.2));
    this.sleeping = target.sleeping;
    this.rsaPhase = (this.rsaPhase + t * Math.PI * 2 * 0.22) % (Math.PI * 2);
    this.mayerPhase = (this.mayerPhase + t * Math.PI * 2 * 0.1) % (Math.PI * 2);
  }

  private nextRR(): number {
    const base = 60000 / this.bpm;
    const hrv = (1 - 0.45 * this.arousal) * (this.sleeping ? 0.3 : 1);
    this.ou = this.ou * 0.86 + (Math.random() - 0.5) * 0.03;
    const jitter = (Math.random() - 0.5) * 0.02;
    const rr =
      base *
      (1 +
        hrv *
          (0.05 * Math.sin(this.rsaPhase) +
            0.02 * Math.sin(this.mayerPhase) +
            this.ou) +
        hrv * jitter);
    return Math.max(380, Math.min(1800, rr));
  }

  sample(now: number): number {
    let t = now - this.beatStart;
    if (t >= this.rr) {
      this.beatStart = now - (t % this.rr);
      t = now - this.beatStart;
      this.rr = this.nextRR();
    }
    const phase = t / this.rr;
    const k = Math.sqrt(this.rr / REF_RR);
    const remap = (p: number): number => {
      const q = p >= WIN_START ? WIN_START + (p - WIN_START) * k : p;
      return Math.min(1, q);
    };
    const lookup = (tpl: Float32Array, p: number): number => {
      const idx = p * TPL_SIZE;
      const i = Math.min(TPL_SIZE - 1, idx | 0);
      const f = idx - i;
      return tpl[i] * (1 - f) + tpl[i + 1] * f;
    };

    const rAmp = 1 + 0.05 * Math.sin(this.rsaPhase - Math.PI / 2);
    const tAmp = Math.max(0.5, 1 - 0.42 * this.arousal);
    let v =
      lookup(TPL_PQS, remap(phase)) +
      lookup(TPL_R, remap(phase)) * rAmp +
      lookup(TPL_T, remap(phase)) * tAmp +
      lookup(TPL_U, phase);
    v +=
      (this.sleeping ? 0.07 : 0.045) * Math.sin(this.rsaPhase) +
      0.012 * Math.sin(this.mayerPhase * 2);
    v += (Math.random() - 0.5) * (0.008 + 0.016 * this.arousal) * (this.sleeping ? 0.35 : 1);
    return this.sleeping ? v * 0.55 : v;
  }
}

/** 每像素采样数（与 DPR 挂钩，保证不同屏宽下滚动速度一致 ~40 css px/s） */
export function samplesPerPx(dpr: number): number {
  return 3.1 * (dpr / 2);
}
