import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'

import { useGame } from '../store/game'
import { eat } from './eat'

/** A press that moves less than this (px) and lets go this soon (ms) is a click, not a drag. */
const CLICK_SLOP = 8
const CLICK_MS = 400

/**
 * "Every click gives you Fat": a click or tap on the 3D view (not a drag to turn the
 * camera) lifts your food. Non-visual.
 */
export function EatInput() {
  const gl = useThree((s) => s.gl)

  useEffect(() => {
    const el = gl.domElement
    const presses = new Map()
    const onDown = (e) => {
      if (e.button !== 0) return
      presses.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now() })
    }
    const onUp = (e) => {
      const press = presses.get(e.pointerId)
      presses.delete(e.pointerId)
      if (!press || useGame.getState().panel) return
      const moved = Math.hypot(e.clientX - press.x, e.clientY - press.y)
      if (moved < CLICK_SLOP && performance.now() - press.t < CLICK_MS) eat()
    }
    const onCancel = (e) => presses.delete(e.pointerId)
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onCancel)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onCancel)
    }
  }, [gl])

  return null
}

export default EatInput
