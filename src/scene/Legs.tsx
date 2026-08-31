import { useMemo } from 'react'
import * as THREE from 'three'
import { buildLegGeometry, buildLegProfile } from './legMesh'

function buildSkirtGeometry(): THREE.BufferGeometry {
  const points = [
    new THREE.Vector2(0.24, 1.02),
    new THREE.Vector2(0.27, 0.96),
    new THREE.Vector2(0.3, 0.88),
    new THREE.Vector2(0.33, 0.8),
    new THREE.Vector2(0.36, 0.72),
  ]
  const lathe = new THREE.LatheGeometry(points, 64)

  // 上下封口，避免从裙内看到身体（CircleGeometry 默认在 XY 平面，转成水平面）
  const capBottom = new THREE.CircleGeometry(0.36, 64)
  capBottom.rotateX(-Math.PI / 2)
  const capTop = new THREE.CircleGeometry(0.24, 64)
  capTop.rotateX(-Math.PI / 2)

  const merged = new THREE.BufferGeometry()
  const positions: number[] = []
  const normals: number[] = []
  const first = lathe.attributes.position as THREE.BufferAttribute
  const firstNormal = lathe.attributes.normal as THREE.BufferAttribute
  for (let i = 0; i < first.count; i++) {
    positions.push(first.getX(i), first.getY(i), first.getZ(i))
    normals.push(firstNormal.getX(i), firstNormal.getY(i), firstNormal.getZ(i))
  }
  const bottomOffset = positions.length / 3
  const capBAttr = capBottom.attributes.position as THREE.BufferAttribute
  const capBNormal = capBottom.attributes.normal as THREE.BufferAttribute
  for (let i = 0; i < capBAttr.count; i++) {
    positions.push(capBAttr.getX(i), capBAttr.getY(i) + 0.72, capBAttr.getZ(i))
    normals.push(capBNormal.getX(i), capBNormal.getY(i), capBNormal.getZ(i))
  }
  const topOffset = positions.length / 3
  const capTAttr = capTop.attributes.position as THREE.BufferAttribute
  const capTNormal = capTop.attributes.normal as THREE.BufferAttribute
  for (let i = 0; i < capTAttr.count; i++) {
    positions.push(capTAttr.getX(i), capTAttr.getY(i) + 1.02, capTAttr.getZ(i))
    normals.push(capTNormal.getX(i), capTNormal.getY(i), capTNormal.getZ(i))
  }
  const latheIndices = lathe.index
  const capBIndices = capBottom.index
  const capTIndices = capTop.index
  const mergedIndices: number[] = []
  if (latheIndices) {
    for (let i = 0; i < latheIndices.count; i++) mergedIndices.push(latheIndices.getX(i))
  }
  if (capBIndices) {
    for (let i = 0; i < capBIndices.count; i++) mergedIndices.push(capBIndices.getX(i) + bottomOffset)
  }
  if (capTIndices) {
    for (let i = 0; i < capTIndices.count; i++) mergedIndices.push(capTIndices.getX(i) + topOffset)
  }
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  merged.setIndex(mergedIndices)
  return merged
}

export function Legs() {
  const leftGeometry = useMemo(() => buildLegGeometry(buildLegProfile(-1)), [])
  const rightGeometry = useMemo(() => buildLegGeometry(buildLegProfile(1)), [])
  const skirt = useMemo(() => buildSkirtGeometry(), [])

  const skin = (
    <meshPhysicalMaterial
      color="#d9a68b"
      roughness={0.62}
      metalness={0}
      sheen={0.55}
      sheenRoughness={0.7}
      sheenColor="#ffd9c4"
    />
  )

  return (
    <group>
      <mesh geometry={leftGeometry} castShadow receiveShadow>
        {skin}
      </mesh>
      <mesh geometry={rightGeometry} castShadow receiveShadow>
        {skin}
      </mesh>

      {/* 裙子 */}
      <mesh geometry={skirt} castShadow receiveShadow>
        <meshStandardMaterial
          color="#3b3345"
          roughness={0.82}
          metalness={0.02}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}
