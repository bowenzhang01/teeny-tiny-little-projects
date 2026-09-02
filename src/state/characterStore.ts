import { useSyncExternalStore } from 'react'
import type { RoleId } from '../squad/types'

export interface CharacterState {
  /** 当前面板选中的小队成员 */
  activeRoleId: RoleId
}

let state: CharacterState = { activeRoleId: 'B' }
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

export const characterStore = {
  getState: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  setRole(role: RoleId) {
    if (role === state.activeRoleId) return
    state = { activeRoleId: role }
    emit()
  },
}

export function useActiveRole(): RoleId {
  return useSyncExternalStore(characterStore.subscribe, characterStore.getState).activeRoleId
}
