import { Vector3 } from 'three'

import { WORLD } from '../game/push/course'
import { runtime } from '../game/runtime'

/**
 * Other players, as the network last described them. Network callbacks write here;
 * the renderer reads it each frame and interpolates between snapshots, drawing
 * everyone ~110 ms in the past so 10 Hz updates still move smoothly.
 */

/** sessionId -> remote player */
export const remotePlayers = new Map()

const MAX_SNAPSHOTS = 24
/** The synced `pushMeter` of someone who isn't pushing (see the server's schema). */
const NOT_PUSHING = -999

export function upsertRemotePlayer(sessionId, state) {
  let r = remotePlayers.get(sessionId)
  if (!r) {
    r = {
      sessionId,
      name: '',
      snaps: [],
      position: new Vector3(state.x, state.y, state.z),
      yaw: state.rotY,
      speed: 0,
      anim: 'idle',
      foodId: 'wood',
      aura: '',
      /** Their avatar's outfit, parsed from `look`; `lookKey` is the raw string. */
      look: null,
      lookKey: '',
      petIds: [],
      /** Follow state per equipped pet, grown as needed and reused. */
      pets: [],
      walkPhase: 0,
      /**
       * Up the mountain: whether they're there, pushing a boulder ('push') or walking a
       * SAFEZONE ('free'), where they've reported, and where they're drawn (eased towards
       * it), across too; `pushStage` is the stage they're on.
       */
      pushing: false,
      pushPhase: '',
      pushMeter: 0,
      pushX: 0,
      shownMeter: 0,
      shownX: 0,
      roll: 0,
      /** Walking a SAFEZONE: which way they face, and how fast they go. */
      climbYaw: Math.PI,
      climbSpeed: 0,
      /** Their Fat, and when it last went up (they're lifting: curl). */
      fat: state.fat || 0,
      ateAt: 0,
      /** Where they're drawn: up the track while pushing, else in the plaza. */
      shownAt: new Vector3(state.x, state.y, state.z),
    }
    r.shadow = { position: r.shownAt, size: 1.1, visible: true }
    runtime.shadowCasters.add(r.shadow)
    remotePlayers.set(sessionId, r)
  }
  r.name = state.name
  /** Their Boxity account id ('' for a guest of ours): what chat bubbles find them by. */
  r.uid = state.uid || ''
  r.anim = state.anim
  // A Boxity emote: played from when we heard of it.
  if ((state.emote || '') !== (r.emote || '')) {
    r.emote = state.emote || ''
    r.emoteStart = performance.now()
  }
  r.foodId = state.foodId || 'wood'
  r.aura = state.aura || ''
  if (state.fat > r.fat) r.ateAt = performance.now()
  r.fat = state.fat
  r.world = state.world || 0
  // Climbing in another world: not on this mountain (and not in the plaza either).
  const pushing = state.pushMeter > NOT_PUSHING && r.world === WORLD
  if (pushing && !r.pushing) {
    // Just started: drawn from where they are, no easing in from elsewhere.
    r.shownMeter = state.pushMeter
    r.shownX = state.pushX
  }
  r.pushing = pushing
  r.pushPhase = state.pushPhase || ''
  r.pushMeter = state.pushMeter
  r.pushX = state.pushX
  if (state.look !== r.lookKey) {
    r.lookKey = state.look
    try {
      r.look = state.look ? JSON.parse(state.look) : null
    } catch {
      r.look = null
    }
  }
  r.petIds = [...state.petIds]
  while (r.pets.length < r.petIds.length) {
    r.pets.push({ id: '', position: r.position.clone(), yaw: 0, hop: 0 })
  }
  const last = r.snaps[r.snaps.length - 1]
  if (!last || last.x !== state.x || last.y !== state.y || last.z !== state.z || last.r !== state.rotY) {
    r.snaps.push({ t: performance.now(), x: state.x, y: state.y, z: state.z, r: state.rotY })
    if (r.snaps.length > MAX_SNAPSHOTS) r.snaps.shift()
  }
}

export function removeRemotePlayer(sessionId) {
  const r = remotePlayers.get(sessionId)
  if (!r) return
  runtime.shadowCasters.delete(r.shadow)
  remotePlayers.delete(sessionId)
}

export function clearRemotePlayers() {
  for (const id of [...remotePlayers.keys()]) removeRemotePlayer(id)
  runtime.remotePets.length = 0
}
