import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { clamp01, HEM_Y_MAX, HEM_Y_MIN, hoseStore } from '../state/hoseStore'

/**
 * 全局袜口高度控制器：
 * - 把「点击拖拽」映射成 0..1 的目标进度
 * - 让当前进度以平滑弹簧方式逼近目标
 * - 全局 pointerup 兜底，避免拖拽状态卡死
 */
export function HemController() {
  const controls = useThree((s) => s.controls) as unknown as { enabled: boolean } | null
  const controlsRef = useRef(controls)
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(1, 0, 0), 0), [])
  const hit = useMemo(() => new THREE.Vector3(), [])
  const current = useRef(hoseStore.current)

  useEffect(() => {
    controlsRef.current = controls
    const up = () => {
      hoseStore.dragging = false
      document.body.style.cursor = 'auto'
      const c = controlsRef.current
      if (c) c.enabled = true
    }
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointerup', up)
      const c = controlsRef.current
      if (c) c.enabled = true
    }
  }, [controls])

  useFrame((state, delta) => {
    if (hoseStore.dragging) {
      raycaster.setFromCamera(state.pointer, state.camera)
      if (raycaster.ray.intersectPlane(plane, hit)) {
        const raw = (hit.y - HEM_Y_MIN) / (HEM_Y_MAX - HEM_Y_MIN)
        hoseStore.target = clamp01(raw)
      }
    }
    const next =
      current.current + (hoseStore.target - current.current) * Math.min(1, delta * 5)
    current.current = clamp01(next)
    hoseStore.current = current.current
  })

  return null
}
