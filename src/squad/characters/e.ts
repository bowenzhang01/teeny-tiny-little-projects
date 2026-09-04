import type { CharacterConfig } from '../types'
import { EHud } from '../../hud/layouts/EHud'

export const E: CharacterConfig = {
  id: 'E',
  title: '通信兵',
  role: 'COMMS',
  theme: {
    primary: '#c084fc',
    secondary: '#d8b4fe',
    label: 'SQUAD-E // LINK-05',
    desc: '通信侦察 · AR / RAVEN / 信标 / EMP',
  },
  playable: true,
  weapons: ['commsRifle', 'ravenDrone', 'beaconKit', 'empKit'],
  hud: EHud,
}
