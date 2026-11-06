import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Euler, Matrix4, Quaternion, Vector3 } from 'three'

import { TRACK_HALF_WIDTH } from '@shared/world'

import { getGame } from '../../store/game'
import { getQuality } from '../../store/quality'
import { createBoxInstances, disposeBlocks } from '../blocks'
import { sharedMaterials, STYLE } from '../materials'
import { MAX_STAGES, STAGES, WALLS } from './course'
import { floorY, meterAtZ, zAt } from './path'
import { BLOCK_PRESS, push, pushTimeScale, WALL_FACE, wallDepth } from './pushControl'
import {
  BRICK_COUNT,
  BRICK_D,
  BRICK_GAP,
  BRICK_H,
  BRICKS,
  LOOK,
  MORTAR,
  SHADES,
  WALL_HEIGHT,
  WALL_SPAN,
  wallShade,
} from './wallLook'

/**
 * The brick walls across the end of every stage, and what's left of them once smashed.
 *
 * Standing, a wall is a mortar slab faced with bricks in running bond, in its stage's
 * colours - gold for the very last one, steel-dark for any too strong for the Fat you
 * have, so you can see from the lobby where a run will stop. Slam your belly into one
 * and it gives: the bricks round your belly cave in, shuddering and flashing, deeper and
 * deeper (pushControl decides how deep) until it BURSTS - every brick flies, the ones
 * your belly hit hardest blasted out ahead of you, spinning, the far ones toppling after,
 * bouncing down the track and coming to rest flat. A wall too strong just caves in a
 * little round your belly and stays cracked there while you sit dizzy.
 *
 * Bricks fly by a tiny fixed-pool simulation (gravity, bounces off the floor and the
 * cliffs, friction), in the same slow motion as the run. Only the last DEBRIS_SLOTS walls
 * smashed keep their rubble - the older ones are far behind you by then. Once your run is
 * over every wall stands whole again.
 *
 * Every brick and slab of every wall near the camera is one instance of one InstancedMesh
 * - a single draw call - placed each frame from shared scratch objects (no allocation).
 */

/** Walls whose rubble is kept (and simulated): the last few smashed. */
const DEBRIS_SLOTS = 3
/** Not running, the walls are laid out only every this many frames (they're still then). */
const IDLE_EVERY = 30
/** A wall too strong caves in this far round your belly, and stays cracked this far after. */
const CRACK_DEPTH = 0.22
/** Bricks fall a bit harder than life, for snap; bounce, scrape and stop like this. */
const GRAVITY = 24
const BOUNCE = 0.28
const SCRAPE = 7
const SETTLE_SPEED = 0.25
/** Bricks bounce off the cliffs either side this far in from the floor's edge. */
const SIDE = TRACK_HALF_WIDTH - 0.3

const MAX_INSTANCES = MAX_STAGES * (BRICK_COUNT + 1)

const _m = new Matrix4()
const _p = new Vector3()
const _q = new Quaternion()
const _s = new Vector3()
const _e = new Euler()
const _c = new Vector3()

/** The rubble: per slot, every brick's position, velocity, rotation, spin, and whether it's at rest. */
const N = DEBRIS_SLOTS * BRICK_COUNT
const pos = new Float32Array(N * 3)
const vel = new Float32Array(N * 3)
const rot = new Float32Array(N * 3)
const spin = new Float32Array(N * 3)
const rest = new Uint8Array(N)
/** Which wall (stage) each slot's rubble is, -1 none; and each stage's slot. */
const slotWall = new Int16Array(DEBRIS_SLOTS).fill(-1)

const rand = (i, k) => {
  // A fixed shuffle per brick: every smash of a wall breaks it its own way, steadily.
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453
  return x - Math.floor(x)
}
const nearestHalfTurn = (a) => Math.round(a / Math.PI) * Math.PI

/** How wide and tall the dent a belly drives into a wall is (m), for how far it sticks out. */
const dentWidth = () => 0.8 + push.radius * 0.9
const dentHeight = () => 0.9 + push.radius * 0.8
/** 0-1: how much brick `b` caves in, for a belly hitting `x` across and `y` up. */
function dentAt(b, x, y) {
  const ox = (BRICKS.x[b] - x) / dentWidth()
  const oy = (BRICKS.y[b] - y) / dentHeight()
  return Math.exp(-ox * ox - oy * oy)
}

/**
 * Blows wall `wall`'s bricks into slot `slot`: each flies from where it stood, harder the
 * nearer your belly it was - out ahead of you, away from the impact, up and spinning.
 */
function shatter(slot, wall) {
  slotWall[slot] = wall.stage
  const base = floorY(wall.meter)
  const z = zAt(wall.meter)
  const ix = push.wallBreakX[wall.stage] ?? 0
  const iy = push.wallBreakY[wall.stage] ?? 1
  const speed = push.wallBreakSpeed[wall.stage] ?? 10
  const reach = 1.1 + push.radius * 0.9
  // They fly from where they were caved in to as it burst.
  const cave = wallDepth(wall.stage)
  const seed = wall.stage * 31 + push.wallsBroken.length
  for (let b = 0; b < BRICK_COUNT; b += 1) {
    const k = slot * BRICK_COUNT + b
    const dx = BRICKS.x[b] - ix
    const dy = BRICKS.y[b] - iy
    const d = Math.hypot(dx, dy)
    const near = Math.exp(-(d * d) / (reach * reach))
    const r1 = rand(b, seed)
    const r2 = rand(b, seed + 1)
    const r3 = rand(b, seed + 2)
    pos[k * 3] = BRICKS.x[b]
    pos[k * 3 + 1] = base + BRICKS.y[b]
    pos[k * 3 + 2] = z - cave * dentAt(b, ix, iy)
    vel[k * 3] = (dx / (d + 0.3)) * (1.2 + 6.5 * near) * (0.6 + 0.8 * r1)
    vel[k * 3 + 1] = 0.8 + 5 * near * r2 + (dy / (d + 0.3)) * 2.4 * near + r3 * 1.2
    vel[k * 3 + 2] = -(speed * (0.2 + 0.85 * near) + r2 * 2.5)
    rot[k * 3] = 0
    rot[k * 3 + 1] = 0
    rot[k * 3 + 2] = 0
    spin[k * 3] = (r1 - 0.5) * (3 + 18 * near)
    spin[k * 3 + 1] = (r3 - 0.5) * (2 + 10 * near)
    spin[k * 3 + 2] = (r2 - 0.5) * (3 + 18 * near)
    rest[k] = 0
  }
}

/** Moves slot `slot`'s bricks on by `dt` seconds: flying, bouncing, scraping to a stop. */
function stepRubble(slot, dt) {
  for (let b = 0; b < BRICK_COUNT; b += 1) {
    const k = slot * BRICK_COUNT + b
    if (rest[k]) continue
    const i = k * 3
    vel[i + 1] -= GRAVITY * dt
    pos[i] += vel[i] * dt
    pos[i + 1] += vel[i + 1] * dt
    pos[i + 2] += vel[i + 2] * dt
    rot[i] += spin[i] * dt
    rot[i + 1] += spin[i + 1] * dt
    rot[i + 2] += spin[i + 2] * dt
    if (pos[i] > SIDE || pos[i] < -SIDE) {
      pos[i] = Math.sign(pos[i]) * SIDE
      vel[i] *= -0.4
    }
    const floor = floorY(meterAtZ(pos[i + 2])) + BRICK_H / 2
    if (pos[i + 1] > floor) continue
    pos[i + 1] = floor
    if (vel[i + 1] < -1.5) {
      // A bounce: up off the floor, losing most of it, the spin knocked out of it.
      vel[i + 1] *= -BOUNCE
      vel[i] *= 0.7
      vel[i + 2] *= 0.7
      spin[i] *= 0.5
      spin[i + 1] *= 0.6
      spin[i + 2] *= 0.5
    } else {
      // Scraping along: slowing, and tipping over to lie flat.
      vel[i + 1] = 0
      const scrape = Math.max(0, 1 - SCRAPE * dt)
      vel[i] *= scrape
      vel[i + 2] *= scrape
      spin[i] *= scrape * 0.5
      spin[i + 1] *= scrape
      spin[i + 2] *= scrape * 0.5
      const tip = Math.min(1, 12 * dt)
      rot[i] += (nearestHalfTurn(rot[i]) - rot[i]) * tip
      rot[i + 2] += (nearestHalfTurn(rot[i + 2]) - rot[i + 2]) * tip
      if (Math.abs(vel[i]) + Math.abs(vel[i + 2]) < SETTLE_SPEED && Math.abs(spin[i + 1]) < 0.3) {
        rest[k] = 1
        rot[i] = nearestHalfTurn(rot[i])
        rot[i + 2] = nearestHalfTurn(rot[i + 2])
      }
    }
  }
}

/** Colours instance `i` stage `si`'s `look`, `shade` - only when that changes. */
function paint(mesh, keys, i, si, stageId, look, shade) {
  const key = 1 + si * 32 + look * 8 + shade
  if (keys[i] === key) return false
  keys[i] = key
  mesh.setColorAt(i, wallShade(stageId, look, shade))
  return true
}

/** A brick's tint: a steady scatter of the four shades. */
const shadeOf = (stage, b) => Math.floor(rand(b, stage + 101) * SHADES)

export default function Walls() {
  const ref = useRef(null)
  const mesh = useMemo(() => createBoxInstances(MAX_INSTANCES, sharedMaterials().toy, STYLE.SMOOTH), [])
  /** What colour each instance was last given (0 none): repainted only when it changes. */
  const keys = useMemo(() => new Uint16Array(MAX_INSTANCES), [])
  /** Frames since the walls were last laid out while nobody was running (they're still then). */
  const idle = useRef(0)
  /** Walls smashed this run that have been shattered into rubble so far, and the run's start. */
  const shattered = useRef({ count: 0, run: 0 })

  useEffect(
    () => () => {
      slotWall.fill(-1)
      disposeBlocks(mesh)
    },
    [mesh],
  )

  useFrame((state, rawDelta) => {
    const walls = ref.current
    if (!walls) return
    const running = push.active
    // In the lobby the walls stand still: re-lay them (for the view distance as the
    // camera moves) only every so often; running, every frame.
    if (!running) {
      idle.current += 1
      if (idle.current > 1 && idle.current % IDLE_EVERY !== 0) return
    } else idle.current = 0
    const now = performance.now()
    const dt = Math.min(rawDelta, 0.05) * pushTimeScale(now)

    // --- Rubble: shatter walls as they're smashed, and keep the last few flying -------
    const seen = shattered.current
    if (!running || seen.run !== push.startedAt) {
      seen.run = running ? push.startedAt : 0
      seen.count = 0
      slotWall.fill(-1)
    }
    while (running && seen.count < push.wallsBroken.length) {
      const stage = push.wallsBroken[seen.count]
      shatter(seen.count % DEBRIS_SLOTS, WALLS[stage])
      seen.count += 1
    }
    for (let slot = 0; slot < DEBRIS_SLOTS; slot += 1) if (slotWall[slot] >= 0) stepRubble(slot, dt)

    // --- Lay out every wall in view ---------------------------------------------------
    const far = getQuality().viewDistance
    const lastStage = STAGES.length - 1
    // Too strong for you: running, for the Fat behind the run; in the lobby, for yours.
    const fat = running ? push.power : getGame().profile.fat
    let repainted = false
    let i = 0

    for (const wall of WALLS) {
      const stageId = STAGES[wall.stage].id
      const base = floorY(wall.meter)
      const z = zAt(wall.meter)
      _c.set(0, base + WALL_HEIGHT / 2, z)
      if (_c.distanceTo(state.camera.position) > far) continue
      const broken = running && push.wallAt[wall.stage] > 0

      if (broken) {
        // Rubble, if it's still kept; long gone behind you otherwise.
        let slot = -1
        for (let s = 0; s < DEBRIS_SLOTS; s += 1) if (slotWall[s] === wall.stage) slot = s
        if (slot < 0) continue
        const rubble = wall.stage === lastStage ? LOOK.GOLD : LOOK.NORMAL
        for (let b = 0; b < BRICK_COUNT && i < MAX_INSTANCES; b += 1) {
          const k = (slot * BRICK_COUNT + b) * 3
          _p.set(pos[k], pos[k + 1], pos[k + 2])
          _q.setFromEuler(_e.set(rot[k], rot[k + 1], rot[k + 2]))
          _s.set(BRICKS.len[b] * BRICK_GAP, BRICK_H * BRICK_GAP, BRICK_D)
          walls.setMatrixAt(i, _m.compose(_p, _q, _s))
          if (paint(walls, keys, i, wall.stage, stageId, rubble, shadeOf(wall.stage, b))) repainted = true
          i += 1
        }
        continue
      }

      const look = wall.stage === lastStage ? LOOK.GOLD : wall.need > fat ? LOOK.LOCKED : LOOK.NORMAL
      // Your belly in it: driving in a wall that's giving way, or straining against (or
      // bounced off, and cracked) the one too strong for you.
      let cave = 0
      let hitX = push.x
      let hitY = push.bellyY
      let shudder = 0
      if (running && push.pressWall === wall.stage) {
        cave = push.press * wallDepth(wall.stage)
        shudder = push.press
      } else if (running && push.blocker === wall) {
        if (push.phase === 'blocked') {
          cave = CRACK_DEPTH
          hitX = push.blockX
          hitY = push.blockY
        } else {
          const into = push.meter + push.radius - (wall.meter - WALL_FACE)
          cave = Math.min(CRACK_DEPTH, Math.max(0, (into / BLOCK_PRESS) * CRACK_DEPTH))
          shudder = cave / CRACK_DEPTH
        }
      }

      // The mortar behind the bricks.
      if (i < MAX_INSTANCES) {
        _p.set(0, base + WALL_HEIGHT / 2, z)
        _q.identity()
        _s.set(WALL_SPAN, WALL_HEIGHT - 0.02, BRICK_D * 0.8)
        walls.setMatrixAt(i, _m.compose(_p, _q, _s))
        if (paint(walls, keys, i, wall.stage, stageId, look, MORTAR)) repainted = true
        i += 1
      }
      for (let b = 0; b < BRICK_COUNT && i < MAX_INSTANCES; b += 1) {
        let dz = 0
        let shown = look
        _e.set(0, 0, 0)
        if (cave > 0) {
          // Caving in round the belly - most where it hits - tipping and shuddering.
          const dent = dentAt(b, hitX, hitY)
          const ox = (BRICKS.x[b] - hitX) / dentWidth()
          const oy = (BRICKS.y[b] - hitY) / dentHeight()
          dz = cave * dent
          const jolt = shudder * dent
          if (jolt > 0.05) {
            const wobble = Math.sin(now * 0.07 + b * 2.3)
            dz += wobble * 0.025 * jolt
            _e.set(-ox * 0.35 * dent * (cave / 0.5) + wobble * 0.05 * jolt, 0, oy * 0.2 * dent)
          }
          if (jolt > 0.4 && Math.sin(now * 0.05 + b * 1.7) > 0) shown = LOOK.HIT
        }
        _p.set(BRICKS.x[b], base + BRICKS.y[b], z - dz)
        _q.setFromEuler(_e)
        _s.set(BRICKS.len[b] * BRICK_GAP, BRICK_H * BRICK_GAP, BRICK_D)
        walls.setMatrixAt(i, _m.compose(_p, _q, _s))
        if (paint(walls, keys, i, wall.stage, stageId, shown, shadeOf(wall.stage, b))) repainted = true
        i += 1
      }
    }

    walls.count = i
    walls.instanceMatrix.needsUpdate = true
    if (repainted && walls.instanceColor) walls.instanceColor.needsUpdate = true
  })

  return <primitive ref={ref} object={mesh} />
}
