import { PointerLockControls } from '@react-three/drei'
import { useControls } from 'leva'
import { Vignette, EffectComposer } from '@react-three/postprocessing'
import { Room, RoomLights } from './Room'
import { Target } from './Target'
import { LockSystem, LockMarker } from '../combat/LockSystem'
import { Projectiles } from '../combat/Projectiles'
import { CharacterRig } from './squad/CharacterRig'
import { rangeStore } from '../state/rangeStore'
import { useDrone } from '../state/droneStore'
import { useEngineer } from '../state/engineerStore'

export function Scene() {
  const { targetDistance, sensitivity } = useControls('靶场', {
    targetDistance: { value: 9, min: 5, max: 14, step: 0.5, label: '靶距 (m)' },
    sensitivity: { value: 0.7, min: 0.1, max: 2, step: 0.05, label: '鼠标灵敏度' },
  })
  const drone = useDrone()
  const engineer = useEngineer()
  const remote = drone.mode === 'remote' || engineer.turret.manual

  return (
    <>
      <color attach="background" args={['#0a0c10']} />
      <fog attach="fog" args={['#0a0c10', 16, 30]} />

      <RoomLights />
      <Room />
      <Target distance={targetDistance} />

      {/* 当前角色武器挂载（按 activeRoleId 切换） */}
      <CharacterRig />
      <Projectiles />
      <LockSystem />
      <LockMarker />

      {/* 固定第一人称：相机不移动，只通过鼠标锁定的相对移动转视角
          机器人遥控时移除默认控制，由 QuadDrone 接管相机 */}
      {!remote && (
        <PointerLockControls
          makeDefault
          pointerSpeed={sensitivity}
          onLock={() => rangeStore.set({ locked: true })}
          onUnlock={() => rangeStore.set({ locked: false, lockedTargetId: null })}
        />
      )}

      <EffectComposer>
        <Vignette eskil={false} offset={0.24} darkness={0.55} />
      </EffectComposer>
    </>
  )
}
