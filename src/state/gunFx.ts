/**
 * 枪口特效的简单共享状态（每帧由 Gun 组件衰减，开枪时由射击逻辑触发）。
 */
export const gunFx = {
  recoil: 0,
  flash: 0,
  trigger() {
    this.recoil = 1
    this.flash = 1
  },
  reset() {
    this.recoil = 0
    this.flash = 0
  },
}
