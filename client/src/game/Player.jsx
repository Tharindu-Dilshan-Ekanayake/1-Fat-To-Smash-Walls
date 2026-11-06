import { useFrame } from '@react-three/fiber'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Color, Matrix4, Quaternion, Vector3 } from 'three'

import { walkSpeed } from '@shared/balance'
import { isZoneUnlocked } from '@shared/logic'
import {
  benchAt,
  benchSeat,
  clampToWalkable,
  groundHeightAt,
  seatYaw,
  STATIC_COLLIDERS,
  ZONE_HEIGHT,
  zoneAt,
} from '@shared/world'

import { sfx } from '../audio/sfx'
import { prefetchLook } from '../bloxity/avatarLoader'
import { useBloxity } from '../bloxity/BloxityContext'
import { getGame } from '../store/game'
import ErrorBoundary from '../ui/ErrorBoundary'
import { createBoxInstances, disposeBlocks } from './blocks'
import { createHeldFood, disposeHeldFood } from './food'
import { sharedMaterials, STYLE } from './materials'
import FallbackAvatar from './FallbackAvatar'
import PlayerAvatar, { AvatarShaderWarmup } from './PlayerAvatar'
import { bulkFor, chewAt, FAT_SCALE, growBody, tableBiteAt } from './playerPose'
import { emoteMotion, stopEmote } from './emotes'
import { burst } from './fx/fxQueue'
import { ballRadius, trackPoint } from './push/path'
import { advancePush, push } from './push/pushControl'
import { runtime } from './runtime'
import useKeyboard from './useKeyboard'

export const PLAYER_HEIGHT = 1.8
const RADIUS = 0.45

const ACCELERATION = 16
const GRAVITY = 32
const JUMP_SPEED = 10.5
/** Ledges up to this high are walked straight onto (the shop's back stage). */
const STEP_UP = 1.05
/**
 * A click's bite takes this long: hands up, three chomps, a gulp, hands down. Clicking
 * again mid-bite keeps you chomping rather than starting over (BITE_HOLD: back to this
 * far through it, food still at your mouth).
 */
const CURL_MS = 640
const BITE_HOLD = 0.45
/** Where in a bite you swallow: GULP. */
const GULP_AT = 0.82
/** Facing down the track as you roll; at the end, turned to the camera at your side. */
const DOWNHILL_YAW = Math.PI
const CHEER_YAW = Math.PI / 2
/** At the end, the cheer comes in over this long; worn out, the dizzy heap over this. */
const CHEER_IN = 0.5
const TIRED_IN = 0.45
/** Curled up, the middle of the ball is this far above your feet's spot when standing (skinny -> fat). */
const BALL_MIDDLE = [0.95, 1.2]
/**
 * The belly's jelly wobble - a spring, kicked by every bite (when the food reaches your
 * mouth) and by every bit of growth, and by landing from a jump: squashes you down and
 * out, then bounces. Stiffness and damping per second, how hard a bite kicks, and how
 * far it squashes. Fatter bodies wobble more.
 */
const JIGGLE_STIFFNESS = 200
const JIGGLE_DAMPING = 7
const BITE_KICK = 6
const CHOMP_KICK = 3.5
const GULP_KICK = 9
const PUFF_KICK = 26
/**
 * Swallowing blows the belly up a moment - it balloons out past your size and springs
 * back (a kick to the growth spring); a size milestone, a much bigger BOING.
 */
const GULP_PUFF = 0.7
const MILESTONE_PUFF = 2.4
const JIGGLE_SIZE = 0.085
/** The food in your hand, squashed flat and wide by a chomp `chew` (0-1) into it. */
function squash(held, chew) {
  if (held) held.scale.set(1 + 0.14 * chew, 1 - 0.22 * chew, 1 + 0.14 * chew)
}
/** After a feed, standing about full: a belly pat, this long after the last bite, lasting this long. */
const PAT_AFTER_MS = 900
const PAT_MS = 1500
/** Growth kicks the wobble by this per unit of bulk gained. */
const GROW_KICK = 60
/** Standing about, the belly breathes in and out this much (more on a fat one). */
const BREATH = 0.014
/** A happy hop (a purchase, a level up) lasts this long; a rebirth spin this long, this many turns. */
const HAPPY_MS = 900
const SPIN_MS = 1100
const SPIN_TURNS = 2
/** Worn out at the end of a roll: stars going round your head. */
const STARS = 3
const STAR_ORBIT = 0.42
const _star = new Matrix4()
const _starPos = new Vector3()
const _starQuat = new Quaternion()
const _starScale = new Vector3()
const STAR_COLOR = new Color('#ffe14a')
/** The win dance lasts this long, unless you move off sooner. */
const DANCE_MS = 4500

// Scratch objects, reused each frame so the loop allocates nothing.
const _input = new Vector3()
const _move = new Vector3()
const _camForward = new Vector3()
const _camRight = new Vector3()
const _targetQuat = new Quaternion()
const _up = new Vector3(0, 1, 0)
const _clamped = { x: 0, z: 0 }
const _seatAt = { x: 0, z: 0 }
/** Steering, handed to the roll each frame. */
const pushInput = { side: 0 }
const TWO_PI = Math.PI * 2

/** Pushes a circle out of an axis-aligned rect. Returns true on contact. */
function pushOut(pos, rect) {
  const cx = Math.min(rect.maxX, Math.max(rect.minX, pos.x))
  const cz = Math.min(rect.maxZ, Math.max(rect.minZ, pos.z))
  const dx = pos.x - cx
  const dz = pos.z - cz
  const d2 = dx * dx + dz * dz
  if (d2 >= RADIUS * RADIUS) return false

  if (d2 > 1e-8) {
    const d = Math.sqrt(d2)
    const shove = (RADIUS - d) / d
    pos.x += dx * shove
    pos.z += dz * shove
    return true
  }

  // Centre inside the rect (spawned in, or a wall appeared on top of us): leave by the
  // nearest side.
  const left = pos.x - rect.minX
  const right = rect.maxX - pos.x
  const near = pos.z - rect.minZ
  const far = rect.maxZ - pos.z
  const m = Math.min(left, right, near, far)
  if (m === left) pos.x = rect.minX - RADIUS
  else if (m === right) pos.x = rect.maxX + RADIUS
  else if (m === near) pos.z = rect.minZ - RADIUS
  else pos.z = rect.maxZ + RADIUS
  return true
}

/**
 * The local player: a kinematic character controller.
 *
 * No physics engine: the plaza is flat ground, a few raised floors and a list of
 * rectangular walls, which a circle-vs-rect push-out handles exactly. That saves the
 * ~2 MB Rapier WASM download and keeps the active rigid body count at zero.
 *
 * In the plaza you walk, and take a bite of your food when you click. Step onto a Food
 * Court's deck and you walk yourself to its long bench, sit and eat on a loop, until you
 * move or jump (walking into the bench sits you too). The fatter you are, the rounder
 * (and a little bigger) you're drawn. On the ROLL ZONE you curl up into a ball and roll
 * down the track - sideways steers - shrinking as the roll burns your Fat. Your logical
 * position stays on the ROLL ZONE all the while (it's what the server checks); only the
 * drawn character goes down the track.
 *
 * Reads and writes `runtime.player`; never touches React state per frame.
 *
 * @param {{ onAvatarReady?: () => void }} props
 */
export function Player({ onAvatarReady }) {
  const { avatar } = useBloxity()
  // Your clothes start downloading now, not once the body has.
  useEffect(() => prefetchLook(avatar), [avatar])
  const [avatarIn, setAvatarIn] = useState(false)
  const handleAvatarReady = useCallback(() => {
    setAvatarIn(true)
    onAvatarReady?.()
  }, [onAvatarReady])
  const groupRef = useRef(null)
  const visualRef = useRef(null)
  /** Turns about the middle of the ball while rolling; `ballRef` holds the body off it. */
  const rollRef = useRef(null)
  const ballRef = useRef(null)
  /** The belly's wobble: value and speed, the last bite and growth it was kicked by. */
  const jiggle = useRef({ x: 0, v: 0, bite: 0, eaten: 0, bulk: -1, puff: 0 })
  /** The click bite in progress: when it (notionally) started, the last click, how hard it was chomping. */
  const biting = useRef({ start: -1e9, ate: 0, chew: 0, t: 1, end: 0, beat: 1 })
  /** The dizzy stars round your head when a roll wears you out. */
  const starsRef = useRef(null)
  const stars = useMemo(() => {
    const mesh = createBoxInstances(STARS, sharedMaterials().toy, STYLE.GLOW)
    for (let i = 0; i < STARS; i += 1) mesh.setColorAt(i, STAR_COLOR)
    mesh.count = STARS
    mesh.visible = false
    return mesh
  }, [])
  useEffect(() => () => disposeBlocks(stars), [stars])
  /** How curled up you're drawn (1 rolling, 0 standing), and how far round. */
  const curled = useRef(0)
  const shownRoll = useRef(0)
  const handRef = useRef(null)
  const heldRef = useRef(null)
  const keys = useKeyboard()
  const velocity = useRef(null)
  if (velocity.current === null) velocity.current = new Vector3()
  const vy = useRef(0)
  const wasPushing = useRef(false)
  const food = useMemo(() => createHeldFood(), [])

  /** Handed to the avatar so it can pose itself. A ref: written every frame. */
  const motionRef = useRef({
    time: 0,
    speed: 0,
    grounded: true,
    maxSpeed: walkSpeed(),
    vy: 0,
    stride: 0,
    rolling: false,
    tired: 0,
    cheer: 0,
    curl: 0,
    training: false,
    sitting: false,
    dance: 0,
    bulk: -1,
  })
  /** The Train Zone whose bench you're sat on, or -1, and where along it. */
  const seated = useRef(-1)
  const seat = useRef({ x: 0, z: 0 })
  /** The bench you just got up from: you don't sit back down until you've stepped off it. */
  const leftSeat = useRef(-1)
  /** Still holding the move you walked onto the bench with: that one doesn't get you up. */
  const sitHeld = useRef(false)
  /** The Train Zone whose pad you're on (-1 off them), and whose bench you're walking to. */
  const onPad = useRef(-1)
  const toBench = useRef(-1)
  /** Still holding the move you stepped onto the pad with: that one doesn't stop the walk. */
  const padHeld = useRef(false)

  // The blob shadow follows what's drawn, which is down the track while you roll.
  const shownAt = useMemo(() => new Vector3().copy(runtime.player.position), [])
  useEffect(() => {
    const caster = { position: shownAt, size: 1.1 }
    runtime.shadowCasters.add(caster)
    return () => runtime.shadowCasters.delete(caster)
  }, [shownAt])

  useEffect(() => () => disposeHeldFood(food), [food])

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)
    const player = runtime.player
    const pos = player.position
    const k = keys.current
    const joy = runtime.input
    const motion = motionRef.current
    const profile = getGame().profile
    motion.time += delta
    // As fat as you are - rolling or not (a roll doesn't burn it).
    growBody(motion, bulkFor(profile.fat), delta)

    const group = groupRef.current
    const visual = visualRef.current
    const held = heldRef.current
    held?.setFood?.(profile.equippedFood)

    // Fatter is a little bigger all over, as well as rounder - and it wobbles.
    const bulk = Math.min(1, motion.bulk)
    const size = 1 + FAT_SCALE * bulk
    player.drawnSize = size
    const j = jiggle.current
    const now = performance.now()
    // A bite taken at a table kicks it; so does a size milestone - a big funny PUFF.
    if (player.jiggleAt !== j.bite && now >= player.jiggleAt) {
      j.bite = player.jiggleAt
      j.v += BITE_KICK
    }
    if (player.puffAt !== j.puff) {
      j.puff = player.puffAt
      j.v += PUFF_KICK
      motion.bulkVel = (motion.bulkVel ?? 0) + MILESTONE_PUFF
    }

    // A click's bite: up to the mouth, chomp chomp chomp (the food squashing, a crunch and
    // a wobble on each), GULP (a big wobble), and down. Clicking again mid-bite keeps you
    // chomping.
    const b = biting.current
    if (player.ateAt !== b.ate) {
      b.ate = player.ateAt
      const into = (now - b.start) / CURL_MS
      b.start = into >= 0 && into < GULP_AT ? now - Math.min(into, BITE_HOLD) * CURL_MS : now
    }
    const biteT = (now - b.start) / CURL_MS
    const chew = biteT >= 0 && biteT < 1 ? chewAt(biteT) : 0
    if (chew > 0.9 && b.chew <= 0.9) {
      // CHOMP: a crunch, a wobble and crumbs flying off the mouth.
      sfx.chomp()
      j.v += CHOMP_KICK
      const p = player.position
      burst({ x: p.x + Math.sin(player.yaw) * 0.34 * size, y: p.y + 1.55 * size, z: p.z + Math.cos(player.yaw) * 0.34 * size, count: 5, speed: 2.4, palette: 'crumbs' })
    }
    if (biteT >= GULP_AT && b.t < GULP_AT) {
      sfx.gulp()
      j.v += GULP_KICK
      motion.bulkVel = (motion.bulkVel ?? 0) + GULP_PUFF
      b.end = now
    }
    b.chew = chew
    b.t = biteT
    squash(held, chew)
    // So does growing: the more you just put on, the bigger the bounce.
    if (j.bulk >= 0 && motion.bulk > j.bulk) j.v += (motion.bulk - j.bulk) * GROW_KICK
    j.bulk = motion.bulk
    j.v += (-JIGGLE_STIFFNESS * j.x - JIGGLE_DAMPING * j.v) * delta
    j.x += j.v * delta
    const wobble = Math.max(-1.2, Math.min(1.2, j.x)) * JIGGLE_SIZE * (0.35 + bulk)
    // And the belly breathes, in and out.
    const breath = push.active ? 0 : Math.sin(motion.time * 1.9) * BREATH * (0.3 + bulk)
    if (visual) visual.scale.set(size * (1 + wobble + breath), size * (1 - wobble * 0.9 - breath * 0.4), size * (1 + wobble + breath))

    // Dizzy stars round your head, worn out at the end of a roll.
    const starMesh = starsRef.current
    const dizzy = push.active && push.phase === 'blocked'
    if (starMesh) {
      starMesh.visible = dizzy
      if (dizzy) {
        const t = motion.time * 4
        for (let i = 0; i < STARS; i += 1) {
          const a = t + (i * Math.PI * 2) / STARS
          _starPos.set(Math.cos(a) * STAR_ORBIT * size, (1.3 + 0.08 * Math.sin(t * 2 + i)) * size, Math.sin(a) * STAR_ORBIT * size)
          _starQuat.setFromAxisAngle(_up, a * 2)
          _starScale.setScalar(0.13 * size)
          starMesh.setMatrixAt(i, _star.compose(_starPos, _starQuat, _starScale))
        }
        starMesh.instanceMatrix.needsUpdate = true
      }
    }

    // A happy hop (arms up) after a purchase or a level up; a double spin on a rebirth.
    const sinceHappy = now - player.happyAt
    motion.happy = player.happyAt && sinceHappy < HAPPY_MS ? Math.sin((Math.PI * sinceHappy) / HAPPY_MS) : 0
    const sinceSpin = now - player.spinAt

    // --- Rolling down the track ---------------------------------------------------
    if (push.active && group && visual) {
      pushInput.side = Math.max(-1, Math.min(1, (k.right ? 1 : 0) - (k.left ? 1 : 0) + joy.joyX))
      push.radius = ballRadius(motion.bulk) * size
      advancePush(delta, pushInput)
      if (!push.active) return
      if (!wasPushing.current) {
        wasPushing.current = true
        velocity.current.set(0, 0, 0)
        vy.current = 0
        curled.current = 0
        shownRoll.current = 0
        visual.quaternion.setFromAxisAngle(_up, DOWNHILL_YAW)
      }
      player.anim = 'push'
      player.speed = 0
      // Curled up while rolling; unrolling once it's over, the turn easing round to upright.
      const rolling = push.phase === 'roll'
      curled.current += ((rolling ? 1 : 0) - curled.current) * (1 - Math.exp(-(rolling ? 14 : 7) * delta))
      if (rolling) shownRoll.current = push.roll
      else {
        const upright = Math.ceil(shownRoll.current / TWO_PI) * TWO_PI
        shownRoll.current += (upright - shownRoll.current) * (1 - Math.exp(-9 * delta))
      }
      const c = curled.current
      trackPoint(push.meter, push.x, push.radius * c, group.position)
      if (rollRef.current) rollRef.current.rotation.x = shownRoll.current
      if (ballRef.current) ballRef.current.position.y = -c * (BALL_MIDDLE[0] + (BALL_MIDDLE[1] - BALL_MIDDLE[0]) * motion.bulk)
      _targetQuat.setFromAxisAngle(_up, push.phase === 'top' ? CHEER_YAW : DOWNHILL_YAW)
      visual.quaternion.slerp(_targetQuat, 1 - Math.pow(0.001, delta))
      shownAt.copy(push.position)
      if (held) held.visible = false
      motion.rolling = true
      motion.speed = push.speed
      motion.tired = push.phase === 'blocked' ? Math.min(1, motion.tired + delta / TIRED_IN) : 0
      motion.cheer = push.phase === 'top' ? Math.min(1, motion.cheer + delta / CHEER_IN) : 0
      motion.grounded = true
      motion.training = false
      motion.curl = 0
      if (player.emote) stopEmote()
      motion.emoteClip = null
      return
    }
    if (wasPushing.current && group && visual) {
      // Back in the plaza: stood up again.
      wasPushing.current = false
      velocity.current.set(0, 0, 0)
      vy.current = 0
      group.position.copy(pos)
      if (rollRef.current) rollRef.current.rotation.x = 0
      if (ballRef.current) ballRef.current.position.y = 0
      visual.quaternion.setFromAxisAngle(_up, player.yaw)
      motion.rolling = false
      motion.tired = 0
      motion.cheer = 0
    }
    if (held) held.visible = true

    // Walking about the plaza.
    const at = pos
    const locked = player.frozen
    const moving = (k.forward || k.backward || k.left || k.right || Math.hypot(joy.joyX, joy.joyY) > 0.02) && !locked

    // --- On a bench: sat still, training, until you move (a fresh press) or jump -------
    if (!moving) sitHeld.current = false
    const getUp = (moving && !sitHeld.current) || k.jump || joy.jump
    if (seated.current >= 0 && (getUp || !isZoneUnlocked(profile, seated.current))) {
      leftSeat.current = seated.current
      seated.current = -1
    }
    if (seated.current >= 0) {
      at.set(seat.current.x, ZONE_HEIGHT, seat.current.z)
      velocity.current.set(0, 0, 0)
      vy.current = 0
      player.grounded = true
      player.yaw = seatYaw(seated.current)
      if (visual) visual.quaternion.slerp(_targetQuat.setFromAxisAngle(_up, player.yaw), 1 - Math.pow(0.0005, delta))
      if (group) group.position.copy(at)
      shownAt.copy(at)
      player.bench = seated.current
      player.speed = 0
      player.anim = 'train'
      motion.speed = 0
      motion.grounded = true
      motion.vy = 0
      motion.sitting = true
      motion.training = true
      motion.curl = 0
      // The food squashes on each chomp at the table too.
      squash(held, chewAt(tableBiteAt(motion.time)))
      if (player.emote) stopEmote()
      motion.emoteClip = null
      return
    }
    player.bench = -1
    motion.sitting = false

    // --- Input, relative to the camera ----------------------------------------
    const maxSpeed = walkSpeed(profile.level, profile.rebirths)
    _input.set(0, 0, 0)
    if (!locked) {
      _input.set(
        (k.right ? 1 : 0) - (k.left ? 1 : 0) + joy.joyX,
        0,
        (k.backward ? 1 : 0) - (k.forward ? 1 : 0) - joy.joyY,
      )
    }
    const inputLength = Math.min(1, _input.length())

    // Just stepped onto an unlocked Food Court's deck: off to its bench, until a fresh
    // move or a jump takes over (or you leave the deck).
    const pad = locked ? -1 : zoneAt(at.x, at.z)
    if (pad !== onPad.current) {
      onPad.current = pad
      toBench.current = pad >= 0 && isZoneUnlocked(profile, pad) ? pad : -1
      padHeld.current = moving
    }
    if (!moving) padHeld.current = false
    if (toBench.current >= 0 && ((moving && !padHeld.current) || k.jump || joy.jump)) toBench.current = -1

    if (toBench.current >= 0) {
      benchSeat(toBench.current, at.x, at.z, _seatAt)
      _move.set(_seatAt.x - at.x, 0, _seatAt.z - at.z)
      if (_move.lengthSq() > 1e-4) _move.normalize().multiplyScalar(maxSpeed * 0.75)
    } else if (inputLength > 0.02) {
      _input.normalize()
      // Flatten the camera's forward onto the ground plane so "up" always means
      // "away from the camera".
      state.camera.getWorldDirection(_camForward)
      _camForward.y = 0
      _camForward.normalize()
      _camRight.crossVectors(_camForward, _up).normalize()
      _move
        .set(0, 0, 0)
        .addScaledVector(_camForward, -_input.z)
        .addScaledVector(_camRight, _input.x)
        .normalize()
        .multiplyScalar(maxSpeed * inputLength)
    } else {
      _move.set(0, 0, 0)
    }

    // Ease towards the target velocity: crisp, but no instant 0->max snaps.
    const blend = 1 - Math.exp(-ACCELERATION * delta)
    velocity.current.lerp(_move, blend)

    // --- Horizontal move + collision --------------------------------------------
    const prevX = at.x
    const prevZ = at.z
    at.x += velocity.current.x * delta
    at.z += velocity.current.z * delta

    for (const rect of STATIC_COLLIDERS) pushOut(at, rect)
    for (const rect of runtime.dynamicColliders) pushOut(at, rect)
    clampToWalkable(at.x, at.z, _clamped)
    at.x = _clamped.x
    at.z = _clamped.z

    // A ledge too tall to step onto acts as a wall.
    let floor = groundHeightAt(at.x, at.z)
    if (floor - at.y > STEP_UP) {
      at.x = prevX
      at.z = prevZ
      floor = groundHeightAt(at.x, at.z)
    }

    // --- Vertical ---------------------------------------------------------------
    const wantJump = !locked && (k.jump || joy.jump)
    if (wantJump && player.grounded) {
      vy.current = JUMP_SPEED
      player.grounded = false
      sfx.jump()
    }
    vy.current -= GRAVITY * delta
    at.y += vy.current * delta

    if (at.y <= floor) {
      // Coming down from a jump (not just stepping off a kerb) lands with a thump.
      if (!player.grounded && vy.current < -5) {
        sfx.jumpLand()
        jiggle.current.v += 4 + 6 * Math.min(1, motion.bulk)
      }
      at.y = floor
      vy.current = 0
      player.grounded = true
    } else if (at.y - floor > 0.05) {
      // Walked off a ledge, or still rising from a jump.
      player.grounded = false
    }

    // --- Facing -----------------------------------------------------------------
    const speed = Math.hypot(velocity.current.x, velocity.current.z)
    if (speed > 0.3) player.yaw = Math.atan2(velocity.current.x, velocity.current.z)
    if (visual) {
      _targetQuat.setFromAxisAngle(_up, player.yaw)
      if (player.spinAt && sinceSpin < SPIN_MS) {
        // Ease-out turns: fast at first, settling back to facing the way you were.
        const t = sinceSpin / SPIN_MS
        visual.quaternion.setFromAxisAngle(_up, player.yaw + (1 - (1 - t) ** 3) * SPIN_TURNS * Math.PI * 2)
      } else visual.quaternion.slerp(_targetQuat, 1 - Math.pow(0.0005, delta))
    }
    if (group) {
      // Step-ups ease in over a few frames on the visual only; the logical position
      // snaps so collision and triggers stay exact.
      const steppingUp = player.grounded && at.y > group.position.y
      const visualY = steppingUp
        ? group.position.y + (at.y - group.position.y) * Math.min(1, delta * 18)
        : at.y
      group.position.set(at.x, visualY, at.z)
    }
    shownAt.copy(at)

    // Walked into a bench at an unlocked Food Court: sit on it there (from next frame).
    // Off the bench you got up from (jumping off it doesn't count), you may sit again.
    const bench = locked ? -1 : benchAt(at.x, at.z)
    if (bench !== leftSeat.current) leftSeat.current = -1
    if (bench >= 0 && player.grounded && bench !== leftSeat.current && isZoneUnlocked(profile, bench)) {
      seated.current = bench
      benchSeat(bench, at.x, at.z, seat.current)
      sitHeld.current = moving
      toBench.current = -1
    }

    // Back from a win: dancing on the spot until it's over or you move off.
    if (player.danceAt && (moving || !player.grounded || performance.now() - player.danceAt > DANCE_MS)) player.danceAt = 0
    const dancing = player.danceAt > 0

    // --- Publish motion ---------------------------------------------------------
    player.speed = speed
    player.anim = !player.grounded ? 'jump' : dancing ? 'dance' : speed > 0.5 ? 'walk' : 'idle'

    motion.speed = speed
    motion.maxSpeed = maxSpeed
    motion.grounded = player.grounded
    motion.vy = vy.current
    motion.training = false
    motion.dance = dancing ? 1 : 0
    motion.curl = biteT >= 0 && biteT < 1 ? Math.max(1e-4, biteT) : 0
    // Full up after a feed, standing still: a pat of the belly (pat, pat, pat).
    const sincePat = now - b.end - PAT_AFTER_MS
    const patting = b.end > 0 && sincePat > 0 && sincePat < PAT_MS && speed < 0.4 && player.grounded && motion.curl === 0
    motion.pat = patting ? sincePat / PAT_MS : 0
    motion.patWeight = patting ? Math.sin((Math.PI * sincePat) / PAT_MS) ** 0.5 : 0
    // A thump each time a hand comes down on it (the pose's beat: one hand, then the other).
    const beat = Math.abs(Math.sin(motion.pat * Math.PI * 6))
    if (patting && beat < 0.2 && b.beat >= 0.2) {
      sfx.pat(Math.min(1, motion.bulk))
      j.v += 1.5
    }
    b.beat = patting ? beat : 1
    // Steps quicken with speed: the stride phase runs faster rather than jumping.
    const stepBefore = Math.floor(motion.stride / Math.PI)
    motion.stride += delta * (5 + 6 * Math.min(1, speed / maxSpeed))
    // A foot lands each half cycle: thud, heavier the fatter you are.
    if (player.grounded && speed > 1.5 && Math.floor(motion.stride / Math.PI) !== stepBefore) sfx.step(Math.min(1, motion.bulk))

    // A Boxity emote plays while you stand; moving, jumping or dancing stops it.
    const emote = player.emote
    if (emote && (moving || !player.grounded || dancing || !emoteMotion(motion, emote.id, emote.at))) stopEmote()
    if (!player.emote) motion.emoteClip = null
  })

  return (
    <group ref={groupRef}>
      <primitive ref={starsRef} object={stars} />
      <group ref={visualRef}>
        <group ref={rollRef}>
          <group ref={ballRef}>
            {/* The loading screen waits for your Bloxity avatar; only if it can't be had in
                time (or at all) does the blocky stand-in show in its place. */}
            {!avatarIn && <FallbackAvatar motionRef={motionRef} handRef={handRef} />}
            <AvatarShaderWarmup />
            <ErrorBoundary fallback={<FallbackAvatar motionRef={motionRef} handRef={handRef} onReady={handleAvatarReady} />}>
              <Suspense fallback={null}>
                <PlayerAvatar onReady={handleAvatarReady} targetHeight={PLAYER_HEIGHT} motionRef={motionRef} handRef={handRef} />
              </Suspense>
            </ErrorBoundary>
            <group ref={handRef}>
              <primitive ref={heldRef} object={food} />
            </group>
          </group>
        </group>
      </group>
    </group>
  )
}

export default Player
