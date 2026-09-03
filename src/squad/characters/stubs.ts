import type { CharacterConfig } from '../types'
import { PlaceholderHud } from '../../hud/layouts/PlaceholderHud'
import { AHud } from '../../hud/layouts/AHud'

/** 未实装角色：先提供配置文件与占位 HUD，后续逐个补武器&布局 */
export const A: CharacterConfig = {
  id: 'A',
  title: '突击兵',
  role: 'ASSAULT',
  theme: { primary: '#f87171', secondary: '#fca5a5', label: 'SQUAD-A // VANTA-01', desc: '突击手 · LMG / 手雷 / 激光反导' },
  playable: true,
  weapons: ['assaultLmg', 'grenadeKit', 'laserCiws', 'quadDrone'],
  hud: AHud,
}

export const D: CharacterConfig = {
  id: 'D',
  title: '医疗兵',
  role: 'MEDIC',
  theme: { primary: '#4ade80', secondary: '#86efac', label: 'SQUAD-D // MEND-04', desc: '医疗 · 生命体征' },
  playable: false,
  weapons: [],
  hud: PlaceholderHud,
}

export const E: CharacterConfig = {
  id: 'E',
  title: '通信兵',
  role: 'COMMS',
  theme: { primary: '#c084fc', secondary: '#d8b4fe', label: 'SQUAD-E // LINK-05', desc: '通信 · 小队定位' },
  playable: false,
  weapons: [],
  hud: PlaceholderHud,
}
