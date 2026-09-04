import type { CharacterConfig, RoleId } from './types'
import { B } from './characters/b'
import { C } from './characters/c'
import { D } from './characters/d'
import { E } from './characters/e'
import { A } from './characters/stubs'

export const SQUAD: Record<RoleId, CharacterConfig> = { A, B, C, D, E }

export const ROLE_IDS: RoleId[] = ['A', 'B', 'C', 'D', 'E']
