/**
 * 统一键位表（P1）：
 * - 组件只声明"动作 id"（如 RELOAD / THROW_GRENADE），不写死按键。
 * - 键位集中在 inputMap.ts，HUD 提示（ControlHints）也从这里取值，
 *   避免文档 1.1 里的"HUD 写死提示与真实键位漂移"。
 */

export type InputContextId = 'roleHud' | 'droneRemote' | 'turretRemote' | 'linkRemote' | 'transition'

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
  | 'toggleTurretManual'
  | 'cycleBlueprint'
  | 'placeDeployable'
  | 'detonateMines'
  | 'recallAll'
  // D 医疗兵
  | 'medicWeaponSmg'
  | 'medicWeaponDart'
  | 'smokeThrow'
  | 'medicDroneToggle'
  | 'medicDroneMove'
  | 'medicDroneMode'
  // E 通信兵
  | 'beaconThrow'
  | 'empThrow'
  | 'commsDroneToggle'
  | 'commsDroneMode'
  | 'commsLinkView'
  | 'commsDroneMg'
  | 'commsDroneMissile'
  | 'droneUp'
  | 'droneDown'

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
  toggleTurretManual: ['KeyF'],
  cycleBlueprint: ['Digit4'],
  placeDeployable: ['KeyG'],
  detonateMines: ['KeyT'],
  recallAll: ['Digit1'],
  // D 医疗兵
  medicWeaponSmg: ['Digit1'],
  medicWeaponDart: ['Digit2'],
  smokeThrow: ['KeyG'],
  medicDroneToggle: ['KeyQ'],
  medicDroneMove: ['KeyF'],
  medicDroneMode: ['KeyT'],
  // E 通信兵
  beaconThrow: ['KeyG'],
  empThrow: ['KeyT'],
  commsDroneToggle: ['KeyQ'],
  commsDroneMode: ['KeyF'],
  commsLinkView: ['KeyV'],
  commsDroneMg: ['Digit1'],
  commsDroneMissile: ['Digit2'],
  droneUp: ['Space'],
  droneDown: ['ControlLeft', 'ControlRight'],
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
export const CONTROL_HINTS: Record<
  'roleB' | 'roleA' | 'roleC' | 'roleD' | 'roleE' | 'droneRemote' | 'turretRemote' | 'linkRemote' | 'transition',
  ControlHint[]
> = {
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
    { keys: 'F', label: 'SENTRY LINK' },
    { keys: '4', label: 'BLUEPRINT' },
    { keys: 'G', label: 'DEPLOY' },
    { keys: 'T', label: 'DETONATE' },
    { keys: 'N', label: 'NV' },
  ],
  roleD: [
    { keys: 'LMB', label: 'FIRE' },
    { keys: '1/2', label: 'SMG / DART' },
    { keys: 'R', label: 'RELOAD' },
    { keys: 'G', label: 'SMOKE' },
    { keys: 'T', label: 'MODE' },
    { keys: 'Q', label: 'DRONES' },
    { keys: 'F', label: 'ASSIST' },
    { keys: 'N', label: 'NV' },
  ],
  roleE: [
    { keys: 'LMB', label: 'FIRE' },
    { keys: 'R', label: 'RELOAD' },
    { keys: 'G', label: 'BEACON' },
    { keys: 'T', label: 'EMP' },
    { keys: 'Q', label: 'RAVEN' },
    { keys: 'F', label: 'MODE' },
    { keys: 'V', label: 'LINK VIEW' },
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
  turretRemote: [
    { keys: 'LMB', label: 'FIRE' },
    { keys: 'F', label: 'RETURN AUTO' },
    { keys: '3', label: 'RECALL' },
    { keys: 'N', label: 'NV' },
  ],
  linkRemote: [
    { keys: 'WASD', label: 'FLY' },
    { keys: 'SPACE', label: 'UP' },
    { keys: 'CTRL', label: 'DOWN' },
    { keys: 'LMB', label: 'FIRE' },
    { keys: '1/2', label: 'MG / MSL' },
    { keys: 'F', label: 'MODE' },
    { keys: 'V', label: 'EXIT LINK' },
    { keys: 'Q', label: 'STOW' },
    { keys: 'N', label: 'NV' },
  ],
  transition: [],
}
