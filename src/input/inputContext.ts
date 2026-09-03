import { useSyncExternalStore } from 'react'
import { characterStore } from '../state/characterStore'
import { droneStore } from '../state/droneStore'
import type { InputContextId } from './inputMap'

/**
 * 输入上下文（P1）：
 * - 目前只有 ROLE_HUD 与 DRONE_REMOTE 两种；
 * - 由 activeRoleId + droneStore.mode 派生，避免多份状态不同步。
 * 未来角色切换过渡、DRONE_PIP 等上下文在此扩展。
 */
export function getInputContext(): InputContextId {
  const role = characterStore.getState().activeRoleId
  const mode = droneStore.getState().mode
  if (role === 'A' && mode === 'remote') return 'droneRemote'
  return 'roleHud'
}

function subscribeContext(callback: () => void): () => void {
  const un1 = characterStore.subscribe(callback)
  const un2 = droneStore.subscribe(callback)
  return () => {
    un1()
    un2()
  }
}

export function useInputContext(): InputContextId {
  return useSyncExternalStore(subscribeContext, getInputContext)
}
