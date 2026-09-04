import type { CharacterConfig } from '../types'
import { DHud } from '../../hud/layouts/DHud'

export const D: CharacterConfig = {
  id: 'D',
  title: '医疗兵',
  role: 'MEDIC',
  theme: {
    primary: '#4ade80',
    secondary: '#86efac',
    label: 'SQUAD-D // MEND-04',
    desc: '医疗 · SMG / 针枪 / 烟雾 / 四无人机',
  },
  playable: true,
  weapons: ['medicSmg', 'dartGun', 'smokeKit', 'supportDrones'],
  hud: DHud,
}
