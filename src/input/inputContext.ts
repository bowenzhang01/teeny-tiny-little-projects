import { useSyncExternalStore } from 'react'
import { characterStore } from '../state/characterStore'
import { droneStore } from '../state/droneStore'
import { engineerStore } from '../state/engineerStore'
import type { InputContextId } from './inputMap'

/**
 * 输入上下文（P1）：
 * - ROLE_HUD / DRONE_REMOTE / TURRET_REMOTE；
 * - 由 activeRoleId + drone/turret 状态派生，避免多份状态不同步。
 */
export function getInputContext(): InputContextId {
  const role = characterStore.getState().activeRoleId
  const mode = droneStore.getState().mode
  if (role === 'A' && mode === 'remote') return 'droneRemote'
  if (role === 'C' && engineerStore.getState().turret.manual) return 'turretRemote'
  return 'roleHud'
}

function subscribeContext(callback: () => void): () => void {
  const un1 = characterStore.subscribe(callback)
  const un2 = droneStore.subscribe(callback)
  const un3 = engineerStore.subscribe(callback)
  return () => {
    un1()
    un2()
    un3()
  }
}

export function useInputContext(): InputContextId {
  return useSyncExternalStore(subscribeContext, getInputContext)
}
