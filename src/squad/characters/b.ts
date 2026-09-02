import type { CharacterConfig } from '../types'
import { BHud } from '../../hud/layouts/BHud'

export const B: CharacterConfig = {
  id: 'B',
  title: '爆破兵',
  role: 'BREACHER',
  theme: {
    primary: '#41e3ff',
    secondary: '#7dd3fc',
    label: 'SQUAD-B // SURGE-07',
    desc: '火力平台 · 蜂巢 / 轨道炮 / 六管',
  },
  playable: true,
  weapons: ['grenadeLauncher', 'hive', 'railgun', 'minigun', 'weaponControls'],
  hud: BHud,
}
