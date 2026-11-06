import { useFrame } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Vector3 } from 'three'

import { walkSpeed } from '@shared/balance'

import { remotePlayers } from '../../net/remotePlayers'
import { getQuality } from '../../store/quality'
import { createHeldFood, disposeHeldFood } from '../food'
import { BloxityAvatar } from '../PlayerAvatar'
import { emoteMotion } from '../emotes'
import { bulkFor, FAT_SCALE, growBody } from '../playerPose'
import { stepRemotePushers } from '../push/remotePush'

/** How often the set of players is checked for comings, goings and outfit changes. */
const PICK_MS = 500
/** The most other players drawn (a room holds 8). */
const MAX_SHOWN = 12
/** Past these distances a player is posed every 2nd, then every 4th frame. */
const POSE_HALF = 30
const POSE_QUARTER = 60
/** Top walking speed: full stride amplitude, as for your own character. */
const MAX_SPEED = walkSpeed()
/** Facing down the track, rolling. */
const DOWNHILL_YAW = Math.PI
/** Curled up, the middle of the ball above the feet's standing spot (skinny -> fat), as for yours. */
const BALL_MIDDLE = [0.95, 1.2]
/** A bite (up to the mouth, three chomps, down) takes this long, as for your own character. */
const CURL_MS = 640

const _up = new Vector3(0, 1, 0)

/**
 * One other player as their real Bloxity avatar, dressed as they are, as fat as they
 * are, holding their food and posed by the same playerPose as yours, from what the
 * network says they're doing: walking pace, eating at a Food Court or after a click,
 * jumping - and rolling down the track, curled up in a ball.
 */
function RemoteAvatar({ sessionId, look }) {
  const groupRef = useRef(null)
  const handRef = useRef(null)
  const heldRef = useRef(null)
  const rollRef = useRef(null)
  const ballRef = useRef(null)
  const lastY = useRef(null)
  const food = useMemo(() => createHeldFood(), [])
  const motionRef = useRef({ time: 0, speed: 0, grounded: true, maxSpeed: MAX_SPEED, vy: 0, stride: 0, rolling: false, curl: 0, training: false, bulk: -1 })

  useEffect(() => () => disposeHeldFood(food), [food])

  useFrame((state, rawDelta) => {
    const group = groupRef.current
    const r = remotePlayers.get(sessionId)
    if (!group || !r) return
    const delta = Math.min(rawDelta, 0.05)
    stepRemotePushers(remotePlayers, state.clock.elapsedTime, delta)
    const m = motionRef.current
    const far = state.camera.position.distanceTo(group.position)
    // Past the preset's avatar distance: not drawn, and hardly posed (it's still placed,
    // so it pops back in the right spot and pose).
    const hidden = far > getQuality().remoteAvatarDistance
    m.poseEvery = hidden ? 16 : far > POSE_QUARTER ? 4 : far > POSE_HALF ? 2 : 1
    m.time += delta
    growBody(m, bulkFor(r.fat), delta)
    const held = heldRef.current
    held?.setFood?.(r.foodId)
    group.scale.setScalar(1 + FAT_SCALE * Math.min(1, m.bulk))

    // Rolling down the track, curled up in a ball.
    if (r.pushing) {
      group.visible = !hidden
      group.position.copy(r.shownAt)
      group.quaternion.setFromAxisAngle(_up, DOWNHILL_YAW)
      if (rollRef.current) rollRef.current.rotation.x = r.roll
      if (ballRef.current) ballRef.current.position.y = -(BALL_MIDDLE[0] + (BALL_MIDDLE[1] - BALL_MIDDLE[0]) * m.bulk)
      if (held) held.visible = false
      m.rolling = true
      m.speed = r.pushSpeed
      m.grounded = true
      m.training = false
      m.curl = 0
      m.emoteClip = null
      lastY.current = null
      return
    }
    m.rolling = false
    if (rollRef.current) rollRef.current.rotation.x = 0
    if (ballRef.current) ballRef.current.position.y = 0
    if (held) held.visible = true

    // Mid-roll but we never saw it start (we joined late): not drawn at the top.
    group.visible = !hidden && r.anim !== 'push'
    group.position.copy(r.position)
    group.quaternion.setFromAxisAngle(_up, r.yaw)

    m.speed = r.speed
    m.maxSpeed = MAX_SPEED
    m.grounded = r.anim !== 'jump'
    m.training = r.anim === 'train'
    m.sitting = m.training
    m.dance = r.anim === 'dance' ? 1 : 0
    const sinceBite = performance.now() - r.ateAt
    m.curl = sinceBite < CURL_MS ? sinceBite / CURL_MS : 0
    // Vertical speed from the interpolated height, smoothed: rising vs falling.
    const y = r.position.y
    if (lastY.current !== null) m.vy += ((y - lastY.current) / Math.max(delta, 1e-3) - m.vy) * 0.3
    lastY.current = y
    m.stride += delta * (5 + 6 * Math.min(1, r.speed / MAX_SPEED))
    // Their Boxity emote, while they stand still.
    if (!r.emote || r.speed > 0.6 || !m.grounded || m.training || !emoteMotion(m, r.emote, r.emoteStart)) m.emoteClip = null
  })

  return (
    <group ref={groupRef}>
      <group ref={rollRef}>
        <group ref={ballRef}>
          <BloxityAvatar equipped={look?.equipped} proportions={look?.proportions} motionRef={motionRef} handRef={handRef} targetHeight={1.8} />
          <group ref={handRef}>
            <primitive ref={heldRef} object={food} />
          </group>
        </group>
      </group>
    </group>
  )
}

/**
 * Every other player as their real Bloxity avatar, dressed as they are - standing,
 * walking, eating or rolling, however far away (the far ones just posed less often).
 * Each shows once it's dressed; until then, nothing - never a stand-in. Checked twice a
 * second, never per frame, so React only re-renders when the set of players (or an
 * outfit) actually changes.
 */
export function RemoteAvatars() {
  const [shown, setShown] = useState([])

  useEffect(() => {
    const pick = () => {
      const next = [...remotePlayers.values()].sort((a, b) => (a.sessionId < b.sessionId ? -1 : 1)).slice(0, MAX_SHOWN)
      setShown((prev) => {
        const same = prev.length === next.length && prev.every((p, i) => p.sessionId === next[i].sessionId && p.lookKey === next[i].lookKey)
        return same ? prev : next.map((r) => ({ sessionId: r.sessionId, look: r.look, lookKey: r.lookKey }))
      })
    }
    pick()
    const id = setInterval(pick, PICK_MS)
    return () => clearInterval(id)
  }, [])

  return shown.map((s) => (
    <Suspense key={`${s.sessionId}:${s.lookKey}`} fallback={null}>
      <RemoteAvatar sessionId={s.sessionId} look={s.look} />
    </Suspense>
  ))
}

export default RemoteAvatars
