import type { CharacterConfig, RoleId } from './types'
import { B } from './characters/b'
import { C } from './characters/c'
import { A, D, E } from './characters/stubs'

export const SQUAD: Record<RoleId, CharacterConfig> = { A, B, C, D, E }

export const ROLE_IDS: RoleId[] = ['A', 'B', 'C', 'D', 'E']
