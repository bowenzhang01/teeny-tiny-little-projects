import type { ComponentType } from 'react'

export type RoleId = 'A' | 'B' | 'C' | 'D' | 'E'

export interface CharacterTheme {
  /** HUD 主色（灯光/描边/高亮） */
  primary: string
  /** 辅助色 */
  secondary: string
  /** 面板标题 */
  label: string
  /** 一句话描述（选人卡用） */
  desc: string
}

export interface CharacterConfig {
  id: RoleId
  /** 中文名/职称 */
  title: string
  /** 英文角色名 */
  role: string
  theme: CharacterTheme
  /** 是否已可玩（未实装角色显示 WIP） */
  playable: boolean
  /** 该角色装备的武器 id 列表（未来 CharacterRig 按此挂载） */
  weapons: string[]
  /** 该角色专属 HUD 布局组件 */
  hud: ComponentType<{ ready: boolean }>
}
