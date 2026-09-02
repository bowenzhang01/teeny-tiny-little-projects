import { useEffect } from 'react'
import { useActiveRole } from '../../state/characterStore'
import { rangeStore } from '../../state/rangeStore'
import { assaultStore } from '../../state/assaultStore'
import { SQUAD } from '../../squad'
import { getWeaponComponent } from '../../weapons/registry'

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
    })
    // A 突击兵专属武器运行时也一并重置
    assaultStore.reset()
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
