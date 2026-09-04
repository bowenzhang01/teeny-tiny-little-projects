import type { CharacterConfig } from '../types'
import { AHud } from '../../hud/layouts/AHud'

/** A 突击兵：完整配置（机器人 Q-01 附属于 A） */
export const A: CharacterConfig = {
  id: 'A',
  title: '突击兵',
  role: 'ASSAULT',
  theme: { primary: '#f87171', secondary: '#fca5a5', label: 'SQUAD-A // VANTA-01', desc: '突击手 · LMG / 手雷 / 激光反导' },
  playable: true,
  weapons: ['assaultLmg', 'grenadeKit', 'laserCiws', 'quadDrone'],
  hud: AHud,
}
