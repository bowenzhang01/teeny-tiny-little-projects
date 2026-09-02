import type { ComponentType } from 'react'
import { GrenadeLauncher } from './GrenadeLauncher'
import { Railgun } from './Railgun'
import { Minigun } from './Minigun'
import { HiveSystem } from './HiveSystem'
import { WeaponControls } from './WeaponControls'
import { AssaultLmg } from './AssaultLmg'
import { GrenadeKit } from './GrenadeKit'
import { LaserCiws } from './LaserCiws'

export interface WeaponManifest {
  id: string
  name: string
  component: ComponentType
}

/**
 * 武器注册表：武器 id → 组件/元信息。
 * 角色配置只需要写 weapons: [id...]，CharacterRig 会自动挂载。
 */
export const WEAPON_REGISTRY: Record<string, WeaponManifest> = {
  grenadeLauncher: { id: 'grenadeLauncher', name: 'Grenade MG', component: GrenadeLauncher },
  hive: { id: 'hive', name: 'Hive Missiles', component: HiveSystem },
  railgun: { id: 'railgun', name: 'Railgun', component: Railgun },
  minigun: { id: 'minigun', name: 'Minigun', component: Minigun },
  weaponControls: { id: 'weaponControls', name: 'Weapon Controls', component: WeaponControls },
  assaultLmg: { id: 'assaultLmg', name: 'Assault LMG', component: AssaultLmg },
  grenadeKit: { id: 'grenadeKit', name: 'Grenade Kit', component: GrenadeKit },
  laserCiws: { id: 'laserCiws', name: 'Laser CIWS', component: LaserCiws },
}

export function getWeaponComponent(id: string): ComponentType | null {
  return WEAPON_REGISTRY[id]?.component ?? null
}
