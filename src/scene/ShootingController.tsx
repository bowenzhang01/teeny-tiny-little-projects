import { useEffect, useRef, useState } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { rangeStore, registerShot } from '../state/rangeStore'
import { gunFx } from '../state/gunFx'
import { playDry, playHit, playReload, playShot } from '../audio/sfx'

interface ImpactPoint {
  id: number
  position: [number, number, number]
  hit: boolean
}

function Impact({ point }: { point: ImpactPoint }) {
  const mesh = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    const m = mesh.current
    if (!m) return
    if (m.userData.born === undefined) m.userData.born = state.clock.elapsedTime
    const age = state.clock.elapsedTime - (m.userData.born as number)
    const life = 0.55
    const k = Math.max(0, 1 - age / life)
    m.scale.setScalar(0.35 + k * 1.4)
    const mat = m.material as THREE.MeshBasicMaterial
    mat.opacity = k
    if (k <= 0) m.visible = false
  })

  return (
    <mesh ref={mesh} position={point.position}>
      <sphereGeometry args={[0.05, 12, 12]} />
      <meshBasicMaterial
        color={point.hit ? '#ffd166' : '#e2e8f0'}
        transparent
        opacity={1}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  )
}

/**
 * 射击控制器：
 * - 鼠标锁定时左键开火
 * - 从屏幕中心发 Ray，命中标靶按部位计分并触发倒下；
 *   命中房间则只留下弹孔闪光
 * - R 换弹
 */
export function ShootingController() {
  const { camera, scene } = useThree()
  const [impacts, setImpacts] = useState<ImpactPoint[]>([])

  useEffect(() => {
    const raycaster = new THREE.Raycaster()
    const center = new THREE.Vector2(0, 0)

    const fire = () => {
      const s = rangeStore.getState()
      if (!s.locked) return
      if (s.ammo <= 0) {
        playDry()
        rangeStore.set({ message: '弹夹已空 · 按 R 换弹', messageId: s.messageId + 1 })
        return
      }

      gunFx.trigger()
      playShot()

      raycaster.setFromCamera(center, camera)
      const hits = raycaster.intersectObjects(scene.children, true)
      const hit = hits.find((h) => {
        const kind = (h.object.userData as { kind?: string }).kind
        return kind === 'target' || kind === 'solid'
      })

      const impactId = Date.now() + Math.random()
      if (hit && hit.object.userData.kind === 'target') {
        const zone = hit.object.userData.zone as string
        const points = hit.object.userData.points as number
        registerShot({ hit: true, zone, points })
        playHit()
      } else {
        registerShot({ hit: false })
      }

      if (hit) {
        setImpacts((prev) => [
          ...prev,
          {
            id: impactId,
            position: hit.point.toArray() as [number, number, number],
            hit: hit.object.userData.kind === 'target',
          },
        ])
        window.setTimeout(() => {
          setImpacts((prev) => prev.filter((p) => p.id !== impactId))
        }, 700)
      }
    }

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) fire()
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyR') {
        rangeStore.reload()
        playReload()
      }
    }

    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [camera, scene])

  return (
    <group>
      {impacts.map((p) => (
        <Impact key={p.id} point={p} />
      ))}
    </group>
  )
}
