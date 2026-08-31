import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { hemToCurveT, hoseStore } from '../state/hoseStore'
import { buildLegProfile, createCloth, stepCloth } from './legMesh'

interface PantyhoseProps {
  side: 1 | -1
  iterations: number
  color: string
  opacity: number
  wireframe: boolean
}

/**
 * 单条腿上的连裤袜布料。
 * 每帧跑 Verlet 布料模拟：袜口固定在腿部曲线对应位置，
 * 中间布料在「腿部碰撞」和「拉伸约束」之间自组织成褶皱/缩拢。
 */
export function Pantyhose({ side, iterations, color, opacity, wireframe }: PantyhoseProps) {
  const profile = useMemo(() => buildLegProfile(side), [side])
  const cloth = useMemo(() => createCloth(profile, 64, 20), [profile])
  const dataRef = useRef(cloth)
  const baseColorRef = useRef(new THREE.Color(color))
  const controls = useThree((s) => s.controls) as unknown as { enabled: boolean } | null
  const controlsRef = useRef(controls)

  useEffect(() => {
    dataRef.current = cloth
  }, [cloth])

  useEffect(() => {
    controlsRef.current = controls
    return () => {
      if (controlsRef.current) controlsRef.current.enabled = true
    }
  }, [controls])

  useEffect(() => {
    baseColorRef.current = new THREE.Color(color)
  }, [color])

  useFrame((state) => {
    const data = dataRef.current
    if (!data) return
    stepCloth(data, profile, hemToCurveT(hoseStore.current), {
      baseColor: baseColorRef.current,
      compression: 0.9,
      wrinkle: 0.002 + iterations * 0.0035,
      time: state.clock.elapsedTime,
    })
    const geometry = data.geometry
    const posAttr = geometry.attributes.position as THREE.BufferAttribute
    const colorAttr = geometry.attributes.color as THREE.BufferAttribute
    posAttr.needsUpdate = true
    colorAttr.needsUpdate = true
    geometry.computeVertexNormals()
  })

  const stopDrag = (e?: ThreeEvent<PointerEvent>) => {
    hoseStore.dragging = false
    document.body.style.cursor = 'auto'
    const c = controlsRef.current
    if (c) c.enabled = true
    void e
  }

  return (
    <mesh
      geometry={cloth.geometry}
      onPointerOver={(e) => {
        e.stopPropagation()
        if (!hoseStore.dragging) document.body.style.cursor = 'grab'
      }}
      onPointerOut={() => {
        if (!hoseStore.dragging) document.body.style.cursor = 'auto'
      }}
      onPointerDown={(e) => {
        e.stopPropagation()
        hoseStore.dragging = true
        document.body.style.cursor = 'grabbing'
        const c = controlsRef.current
        if (c) c.enabled = false
      }}
      onPointerUp={stopDrag}
    >
      <meshStandardMaterial
        vertexColors
        transparent
        opacity={opacity}
        wireframe={wireframe}
        depthWrite={false}
        side={THREE.DoubleSide}
        roughness={0.38}
        metalness={0.08}
        color="#ffffff"
      />
    </mesh>
  )
}
