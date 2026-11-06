import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { Vector3 } from 'three'

import { feetPoint } from './push/path'
import { push } from './push/pushControl'
import { runtime } from './runtime'

/** How high above the player's feet the camera aims. */
const LOOK_HEIGHT = 1.6

const MIN_DISTANCE = 4
const MAX_DISTANCE = 26

// Pitch limits, in radians. Stops the camera flipping over the top or sinking
// under the ground.
const MIN_PITCH = -0.05
const MAX_PITCH = 1.2

const DRAG_SENSITIVITY = 0.005
const TOUCH_SENSITIVITY = 0.007
const ZOOM_SENSITIVITY = 0.012

// Higher = snappier. Framerate-independent via the exp() smoothing below.
const POSITION_SMOOTHING = 10
const LOOK_SMOOTHING = 14

const _desired = new Vector3()
const _target = new Vector3()
/** A smashed tape's jolt this frame. */
const _shake = new Vector3()
/** Where the camera is looking, eased towards its target (one camera, so module-level). */
const _lookAt = new Vector3()

/** Down the track: how far behind (uphill of) and above the roller the chase camera rides. */
const CHASE_BEHIND = 8.5
const CHASE_HEIGHT = 4.4
/** It looks this far ahead of the roller, down the track. */
const CHASE_AHEAD = 7
const CHASE_LOOK_HEIGHT = 0.6
const CHASE_SMOOTHING = 6
/** How hard a smashed tape shakes the camera, and how fast that settles. */
const SHAKE_SIZE = 0.35
const SHAKE_DECAY = 5

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/**
 * Where the chase camera wants to be while rolling, and what it looks at: behind and
 * above you, looking down the track; drawn back and up when you roll to a stop, worn
 * out; swung out to your side at the end of the track, onto you cheering. A tape just
 * smashed shakes it.
 */
function chaseTarget(out, look) {
  const m = push.meter
  const x = push.x
  if (push.phase === 'top') {
    const k = smoothstep(0, 1.4, (performance.now() - push.endedAt) / 1000)
    feetPoint(m - CHASE_BEHIND * (1 - k) - 1.5 * k, x * 0.5 + 3 * k, out)
    out.y += CHASE_HEIGHT - 1.4 * k
    feetPoint(m + 3.5 * k, x, look)
    look.y += 1.8 + 0.8 * k
    return
  }
  const tired = push.phase === 'blocked' ? smoothstep(0, 0.9, (performance.now() - push.endedAt) / 1000) : 0
  feetPoint(m - CHASE_BEHIND - 2 * tired, x * 0.5 + 2 * tired, out)
  out.y += CHASE_HEIGHT + 2 * tired
  feetPoint(m + CHASE_AHEAD * (1 - tired), x * 0.7, look)
  look.y += CHASE_LOOK_HEIGHT + 0.6 * tired
}

/**
 * Third-person orbit camera around the player.
 *
 * Mouse: drag (either button) orbits, wheel zooms. Touch: one-finger drag orbits (the
 * joystick owns the left side of the screen as a separate element), pinch zooms.
 *
 * Orbit state lives in `runtime.camera`, so after a push the camera can be handed back
 * exactly where it was taken from. While rolling it's a chase camera down the track
 * instead.
 */
export function FollowCamera() {
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const initialised = useRef(false)

  useEffect(() => {
    const el = gl.domElement
    if (!el) return undefined

    /** pointerId -> last { x, y } */
    const pointers = new Map()
    let pinchDistance = 0

    const orbit = runtime.camera

    const onPointerDown = (e) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      el.setPointerCapture?.(e.pointerId)
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        pinchDistance = Math.hypot(a.x - b.x, a.y - b.y)
      }
    }

    const onPointerMove = (e) => {
      const last = pointers.get(e.pointerId)
      if (!last) return

      if (pointers.size >= 2) {
        last.x = e.clientX
        last.y = e.clientY
        const [a, b] = [...pointers.values()]
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        orbit.distance = Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, orbit.distance - (d - pinchDistance) * 0.04))
        pinchDistance = d
        return
      }

      const dx = e.clientX - last.x
      const dy = e.clientY - last.y
      last.x = e.clientX
      last.y = e.clientY
      const sensitivity = e.pointerType === 'touch' ? TOUCH_SENSITIVITY : DRAG_SENSITIVITY
      orbit.yaw -= dx * sensitivity
      orbit.pitch = Math.min(MAX_PITCH, Math.max(MIN_PITCH, orbit.pitch + dy * sensitivity))
    }

    const endDrag = (e) => {
      pointers.delete(e.pointerId)
      el.releasePointerCapture?.(e.pointerId)
    }

    const onWheel = (e) => {
      // Without this the page scrolls behind the canvas.
      e.preventDefault()
      orbit.distance = Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, orbit.distance + e.deltaY * ZOOM_SENSITIVITY))
    }

    // Right-dragging otherwise opens the browser context menu mid-orbit.
    const onContextMenu = (e) => e.preventDefault()

    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', endDrag)
    el.addEventListener('pointercancel', endDrag)
    el.addEventListener('contextmenu', onContextMenu)
    // passive:false is required for preventDefault() on wheel to take effect.
    el.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', endDrag)
      el.removeEventListener('pointercancel', endDrag)
      el.removeEventListener('contextmenu', onContextMenu)
      el.removeEventListener('wheel', onWheel)
    }
  }, [gl])

  useFrame((_state, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)
    if (runtime.camera.mode === 'push') {
      // Eased towards, so taking over from the orbit camera is a swoop, not a cut.
      chaseTarget(_desired, _target)
      const k = 1 - Math.exp(-CHASE_SMOOTHING * delta)
      camera.position.lerp(_desired, k)
      _lookAt.lerp(_target, k)
      // A tape just smashed: a jolt, settling fast (on top of the easing, so it's felt).
      if (push.shake > 0.001) {
        const t = performance.now() * 0.06
        camera.position.add(_shake.set(Math.sin(t * 1.7), Math.sin(t * 2.3), 0).multiplyScalar(push.shake * SHAKE_SIZE))
        push.shake *= Math.exp(-SHAKE_DECAY * delta)
      }
      camera.lookAt(_lookAt)
      return
    }
    // Whoever's being followed: you in the plaza, or up the mountain in a SAFEZONE.
    const p = runtime.focus ?? runtime.player.position
    // You grow as you fatten: the camera looks at your middle and stands back to fit you.
    const grown = runtime.focus ? 1 : (runtime.player.drawnSize ?? 1)
    _target.set(p.x, p.y + LOOK_HEIGHT * grown, p.z)

    // Spherical -> cartesian. yaw 0 puts the camera south of the player, looking north.
    const { yaw, pitch } = runtime.camera
    const distance = runtime.camera.distance * (0.75 + 0.25 * grown)
    const horizontal = Math.cos(pitch) * distance
    _desired.set(
      _target.x + Math.sin(yaw) * horizontal,
      Math.max(_target.y + Math.sin(pitch) * distance, 0.6),
      _target.z + Math.cos(yaw) * horizontal,
    )

    // After a roll the camera is far down the valley; jump back rather than swoop.
    if (runtime.camera.snap) {
      runtime.camera.snap = false
      initialised.current = false
    }

    if (!initialised.current) {
      // Avoid a long swoop in from wherever the default camera started.
      camera.position.copy(_desired)
      _lookAt.copy(_target)
      initialised.current = true
    }

    camera.position.lerp(_desired, 1 - Math.exp(-POSITION_SMOOTHING * delta))
    _lookAt.lerp(_target, 1 - Math.exp(-LOOK_SMOOTHING * delta))
    camera.lookAt(_lookAt)
  })

  return null
}

export default FollowCamera
