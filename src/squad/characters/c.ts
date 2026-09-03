import type { CharacterConfig } from '../types'
import { CHud } from '../../hud/layouts/CHud'

export const C: CharacterConfig = {
  id: 'C',
  title: '工程兵',
  role: 'ENGINEER',
  theme: {
    primary: '#fbbf24',
    secondary: '#fde68a',
    label: 'SQUAD-C // FORGE-03',
    desc: '工程 · 等离子激光 / 四臂 / 哨戒炮塔 / 部署包',
  },
  playable: true,
  weapons: ['plasmaLaser', 'quadArms', 'sentryTurret', 'deployKit'],
  hud: CHud,
}
