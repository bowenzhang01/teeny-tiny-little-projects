import * as THREE from 'three'

/**
 * 从相机中心射线求与地面（y≈0.05）的交点，并做距离范围限制。
 * C 的炮塔/地雷/屏障都使用同一套"准星落点"规则。
 */
export function crosshairGroundPoint(
  camera: THREE.Camera,
  minDist = 3,
  maxDist = 12,
): THREE.Vector3 | null {
  const dir = new THREE.Vector3()
  camera.getWorldDirection(dir)
  if (Math.abs(dir.y) < 0.01) return null
  const t = (0.05 - camera.position.y) / dir.y
  if (t < 0) return null
  const p = camera.position.clone().addScaledVector(dir, t)
  const dist = p.distanceTo(camera.position)
  if (dist < minDist || dist > maxDist) return null
  return p
}
