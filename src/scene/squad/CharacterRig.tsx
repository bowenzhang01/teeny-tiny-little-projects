import { useEffect } from 'react'
import { useActiveRole } from '../../state/characterStore'
import { rangeStore } from '../../state/rangeStore'
import { assaultStore } from '../../state/assaultStore'
import { droneStore } from '../../state/droneStore'
import { engineerStore } from '../../state/engineerStore'
import { medicStore } from '../../state/medicStore'
import { commsStore } from '../../state/commsStore'
import { SQUAD } from '../../squad'
import { getWeaponComponent } from '../../weapons/registry'
import { triggerInputReset } from '../../input/inputReset'

/**
 * 角色武器挂载点（配置驱动）：
 * - 读取当前角色 config.weapons 里的武器 id
 * - 从 WEAPON_REGISTRY 取对应组件并挂载
 * - 切换角色时清理上一角色的武器展开/射击状态
 * 未来新增角色 = 在 squad/characters 写配置，武器注册到 registry 即可。
 */
export function CharacterRig() {
  const role = useActiveRole()
  const config = SQUAD[role]

  useEffect(() => {
    // 换人时把旧角色的背挂武器/射击状态清空
    rangeStore.set({
      railgunDeployed: false,
      minigunDeployed: false,
      railgunCharging: false,
      minigunSpinning: false,
      minigunFiring: false,
      weaponBusyUntil: 0,
    })
    // A 突击兵专属武器运行时也一并重置
    assaultStore.reset()
    droneStore.reset()
    // C 工程兵专属运行时也一并重置
    engineerStore.reset()
    // D 医疗兵专属运行时也一并重置
    medicStore.reset()
    // E 通信兵专属运行时也一并重置
    commsStore.reset()
    // 清空所有按下中的键/鼠标状态，并把 locked 与真实指针锁定对齐
    triggerInputReset('role-switch')
    const locked = document.pointerLockElement !== null
    rangeStore.set({
      locked,
      lockedTargetId: locked ? rangeStore.getState().lockedTargetId : null,
    })
  }, [role])

  const weapons = config.weapons
    .map((id) => getWeaponComponent(id))
    .filter((c): c is NonNullable<typeof c> => c !== null)

  return (
    <>
      {weapons.map((Comp, i) => (
        <Comp key={`${role}-${i}`} />
      ))}
    </>
  )
}
