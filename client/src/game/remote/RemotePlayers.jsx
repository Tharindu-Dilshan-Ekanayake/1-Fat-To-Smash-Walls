import { useFrame, useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { Vector3 } from 'three'

import { remotePlayers } from '../../net/remotePlayers'
import { getQuality } from '../../store/quality'
import { stepRemotePushers } from '../push/remotePush'
import { runtime } from '../runtime'
import { hideNameplatesFrom, NAMEPLATE_POOL_SIZE, placeNameplate } from './nameplates'

/** Remote players are drawn this far in the past, so 10 Hz updates interpolate. */
const INTERP_DELAY_MS = 110
/** Pushers are drawn this much further away than people in the plaza. */
const PUSHER_DISTANCE_SCALE = 2

const _v = new Vector3()
const _target = new Vector3()
const _dir = new Vector3()
const _prev = new Vector3()

function lerpAngle(a, b, t) {
  let d = b - a
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return a + d * t
}

/** Interpolates a remote player to `renderTime`. */
function interpolate(r, renderTime) {
  const snaps = r.snaps
  if (snaps.length === 0) return
  let i = snaps.length - 1
  while (i > 0 && snaps[i - 1].t > renderTime) i -= 1
  const b = snaps[i]
  const a = snaps[Math.max(0, i - 1)]
  const span = b.t - a.t
  const t = span > 0 ? Math.min(1, Math.max(0, (renderTime - a.t) / span)) : 1
  _prev.copy(r.position)
  r.position.set(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t)
  r.yaw = lerpAngle(a.r, b.r, t)
  // Drop snapshots we've moved past, keeping one to interpolate from.
  while (snaps.length > 2 && snaps[1].t < renderTime) snaps.shift()
}

/** Puts a name tag over `at`, if it's on screen; returns the next free tag. */
function writeNameplate(plate, name, at, distance, maxDistance, camera, size) {
  if (plate >= NAMEPLATE_POOL_SIZE) return plate
  if (distance < maxDistance) {
    _v.copy(at).project(camera)
    if (_v.z < 1) {
      const fade = Math.min(1, (maxDistance - distance) / 6)
      placeNameplate(plate, name, (_v.x * 0.5 + 0.5) * size.width, (-_v.y * 0.5 + 0.5) * size.height, fade)
      return plate + 1
    }
  }
  placeNameplate(plate, '', null)
  return plate + 1
}

/**
 * Everyone else: where they are (interpolated from the server's 10 Hz updates), their
 * name tags, shadows and pets (handed to the shared pet renderer). Down the track
 * they're where the server says, rolling. Their bodies are their real avatars
 * (RemoteAvatars).
 */
export function RemotePlayers() {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)

  useEffect(() => () => hideNameplatesFrom(0), [])

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)
    const settings = getQuality()
    const now = performance.now()
    const renderTime = now - INTERP_DELAY_MS
    const t = state.clock.elapsedTime
    stepRemotePushers(remotePlayers, t, delta)

    let plate = 0
    runtime.remotePets.length = 0

    for (const r of remotePlayers.values()) {
      interpolate(r, renderTime)
      const moved = _prev.distanceTo(r.position)
      r.speed = r.speed * 0.8 + (moved / Math.max(delta, 1e-3)) * 0.2

      // --- Rolling down the track (stepRemotePushers placed them) --------------------
      if (r.pushing) {
        const distance = camera.position.distanceTo(r.shownAt)
        r.shadow.visible = distance < settings.remoteDrawDistance * PUSHER_DISTANCE_SCALE
        if (!r.shadow.visible) continue
        _v.copy(r.shownAt).y += (r.ballRadius ?? 1) + 0.9
        plate = writeNameplate(plate, r.name, _v, distance, settings.remoteNameDistance, camera, size)
        continue
      }

      // --- In the plaza -----------------------------------------------------------
      r.shownAt.copy(r.position)
      const distance = camera.position.distanceTo(r.position)
      // Someone mid-roll we never saw start (we joined late) isn't drawn at the top.
      const visible = distance < settings.remoteDrawDistance && r.anim !== 'push'
      r.shadow.visible = visible

      // Name tag, just above the head (players are 1.8 tall).
      if (visible) {
        _v.set(r.position.x, r.position.y + 2.05, r.position.z)
        plate = writeNameplate(plate, r.name, _v, distance, settings.remoteNameDistance, camera, size)
      }

      // Their pets: follow in formation, drawn by the shared pet renderer.
      if (visible) {
        const sin = Math.sin(r.yaw)
        const cos = Math.cos(r.yaw)
        for (let i = 0; i < r.petIds.length && i < r.pets.length; i += 1) {
          const pet = r.pets[i]
          pet.id = r.petIds[i]
          const sx = i === 0 ? -1.5 : i === 1 ? 1.5 : 0
          const sz = i === 2 ? -2.5 : -1.3
          _target.set(r.position.x - cos * sx + sin * sz, r.position.y, r.position.z + sin * sx + cos * sz)
          _dir.copy(pet.position)
          pet.position.lerp(_target, 1 - Math.exp(-6 * delta))
          const stepped = _dir.distanceTo(pet.position)
          if (stepped > 0.005) pet.yaw = Math.atan2(pet.position.x - _dir.x, pet.position.z - _dir.z)
          pet.hop = Math.abs(Math.sin(t * 7 + i)) * (stepped > 0.01 ? 0.35 : 0.08)
          runtime.remotePets.push(pet)
        }
      }
    }
    hideNameplatesFrom(plate)
  })

  return null
}

export default RemotePlayers
