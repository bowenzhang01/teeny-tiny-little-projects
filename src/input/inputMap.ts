/**
 * 统一键位表（P1）：
 * - 组件只声明"动作 id"（如 RELOAD / THROW_GRENADE），不写死按键。
 * - 键位集中在 inputMap.ts，HUD 提示（ControlHints）也从这里取值，
 *   避免文档 1.1 里的"HUD 写死提示与真实键位漂移"。
 */

export type InputContextId = 'roleHud' | 'droneRemote' | 'transition'

export type InputAction =
  | 'nightVision'
  | 'reload'
  | 'throwGrenade'
  | 'cycleGrenade'
  | 'stowBackWeapons'
  | 'toggleRailgun'
  | 'toggleMinigun'
  | 'chargeRailgun'
  | 'deployDrone'
  | 'toggleDroneMode'
  | 'droneWeaponMg'
  | 'droneWeaponMissile'
  | 'moveForward'
  | 'moveBackward'
  | 'moveLeft'
  | 'moveRight'
  | 'jump'
  | 'sprint'
  // C 工程兵
  | 'plasmaVent'
  | 'toggleArms'
  | 'deployTurret'
  | 'cycleBlueprint'
  | 'placeDeployable'
  | 'detonateMines'
  | 'recallAll'

/** 动作 id → 键盘 code（可多个，取任意一个即可触发） */
export const INPUT_KEYS: Record<InputAction, string[]> = {
  nightVision: ['KeyN'],
  reload: ['KeyR'],
  throwGrenade: ['KeyG'],
  cycleGrenade: ['KeyT'],
  stowBackWeapons: ['Digit1'],
  toggleRailgun: ['Digit2'],
  toggleMinigun: ['Digit3'],
  chargeRailgun: ['KeyQ'],
  deployDrone: ['KeyQ'],
  toggleDroneMode: ['KeyF'],
  droneWeaponMg: ['Digit1'],
  droneWeaponMissile: ['Digit2'],
  moveForward: ['KeyW'],
  moveBackward: ['KeyS'],
  moveLeft: ['KeyA'],
  moveRight: ['KeyD'],
  jump: ['Space'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  // C 工程兵
  plasmaVent: ['KeyR'],
  toggleArms: ['Digit2'],
  deployTurret: ['Digit3'],
  cycleBlueprint: ['Digit4'],
  placeDeployable: ['KeyG'],
  detonateMines: ['KeyT'],
  recallAll: ['Digit1'],
}

/** 鼠标动作 id → 鼠标按键（0=左键，2=右键） */
export type MouseAction = 'fire' | 'altFire'
export const MOUSE_KEYS: Record<MouseAction, number[]> = {
  fire: [0],
  altFire: [2],
}

export interface ControlHint {
  keys: string
  label: string
}

/** 各输入上下文的 HUD 操作提示（由 ControlHints 通用组件渲染） */
export const CONTROL_HINTS: Record<'roleB' | 'roleA' | 'roleC' | 'droneRemote' | 'transition', ControlHint[]> = {
  roleB: [
    { keys: 'LMB', label: 'FIRE' },
    { keys: 'RMB', label: 'HIVE (HOLD / ×2)' },
    { keys: '1', label: 'STOW BACK' },
    { keys: '2', label: 'RAILGUN' },
    { keys: '3', label: 'MINIGUN' },
    { keys: 'Q', label: 'RAIL CHARGE' },
    { keys: 'N', label: 'NV' },
  ],
  roleA: [
    { keys: 'LMB', label: 'FIRE' },
    { keys: 'RMB', label: 'STABILIZE' },
    { keys: 'R', label: 'RELOAD' },
    { keys: 'G', label: 'GRENADE' },
    { keys: 'T', label: 'CYCLE' },
    { keys: 'Q', label: 'DRONE' },
    { keys: 'F', label: 'MODE' },
    { keys: 'N', label: 'NV' },
  ],
  roleC: [
    { keys: 'LMB', label: 'PLASMA' },
    { keys: 'RMB', label: 'OVERCHARGE' },
    { keys: 'R', label: 'VENT' },
    { keys: '1', label: 'RECALL' },
    { keys: '2', label: 'ARMS' },
    { keys: '3', label: 'TURRET' },
    { keys: '4', label: 'BLUEPRINT' },
    { keys: 'G', label: 'DEPLOY' },
    { keys: 'T', label: 'DETONATE' },
    { keys: 'N', label: 'NV' },
  ],
  droneRemote: [
    { keys: 'WASD', label: 'MOVE' },
    { keys: 'SPACE', label: 'JUMP' },
    { keys: 'LMB', label: 'FIRE' },
    { keys: '1/2', label: 'WEAPON' },
    { keys: 'F', label: 'RETURN AI' },
    { keys: 'Q', label: 'STOW' },
  ],
  transition: [],
}
