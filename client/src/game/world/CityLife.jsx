import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Color, Euler, Matrix4, Quaternion, Vector3 } from 'three'

import { PUSH_ZONE } from '@shared/world'

import { sfx } from '../../audio/sfx'
import { getQuality } from '../../store/quality'
import { BlockSet, disposeBlocks } from '../blocks'
import { burst } from '../fx/fxQueue'
import { sharedMaterials, STYLE } from '../materials'
import { push } from '../push/pushControl'
import { runtime } from '../runtime'
import { BALL, BALL_REACH, CABLE, DEMO_BRICK, DEMO_BRICKS, DEMO_WALLS, GANTRY_H } from './demoWalls'
import { lobbyPalette } from './palette'
import { CRANES } from './skyline'

/**
 * What moves in SMASH CITY, all one InstancedMesh (one draw call), placed each frame from
 * scratch objects (no allocation):
 *
 * - The tower cranes' jibs turning slowly over the skyline, their trolleys running in and
 *   out along them and their hooks going up and down.
 * - The demo walls either side of the SMASH LANE (demoWalls.js): the wrecking ball is
 *   hauled back, swings in and bursts the wall towards the lane - dust, chips and a
 *   distant boom if you're near - the bricks bounce down and lie there, then fly back up
 *   together into a wall again, and round it goes. Worked out from the clock alone, so
 *   it never drifts and costs nothing to skip.
 * - Fireworks over the SMASH ZONE now and then, on presets with particles.
 *
 * Not while you're down the track (the lobby's out of sight then).
 */

/** One swing of a demo wall, seconds, and its beats within it. */
const CYCLE = 7
const HAUL = 1.8
const HANG = 2.3
const HIT = 2.9
const REBOUND = 3.5
const REBUILD = 5.2
const REBUILT = 6.2
/** How far back (radians) the ball is hauled, and how far it bounces back off the wall. */
const WIND = 1.1
const REST = 0.12
const BOUNCE = 0.28
/** Bricks fall like this, and lie this high (half a brick) on the ground. */
const GRAVITY = 20
const LIE = DEMO_BRICK.h / 2
/** Within this of a demo wall you hear it go (softly). */
const HEAR = 30
/** Seconds between fireworks over the SMASH ZONE. */
const FIREWORK_EVERY = 3.2

const BRICKS = DEMO_BRICKS.length

const _m = new Matrix4()
const _p = new Vector3()
const _q = new Quaternion()
const _s = new Vector3()
const _e = new Euler()

const smooth = (t) => {
  const x = Math.min(1, Math.max(0, t))
  return x * x * (3 - 2 * x)
}
const nearestHalfTurn = (a) => Math.round(a / Math.PI) * Math.PI
const hash = (i, k) => {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453
  return x - Math.floor(x)
}

/** How far back (radians) a demo wall's ball is swung at `t` seconds into its cycle. */
function swingAt(t) {
  if (t < HAUL) return REST + (WIND - REST) * smooth(t / HAUL)
  if (t < HANG) return WIND
  if (t < HIT) return WIND * Math.cos(((t - HANG) / (HIT - HANG)) * (Math.PI / 2))
  if (t < REBOUND) return BOUNCE * Math.sin(((t - HIT) / (REBOUND - HIT)) * Math.PI)
  return REST * smooth((t - REBOUND) / (CYCLE - REBOUND))
}

/**
 * Each brick's flight when its wall bursts, worked out once: how fast it leaves (away from
 * the ball, hardest where it hit), how it spins, and when it lands.
 */
const FLIGHTS = DEMO_BRICKS.map((brick, b) => {
  const dx = brick.x
  const dy = brick.y - (GANTRY_H - CABLE)
  const near = Math.exp(-(dx * dx + dy * dy) / 2.2)
  const vx = (dx / (Math.abs(dx) + 0.4)) * (1 + 4 * near) * (0.6 + 0.8 * hash(b, 1))
  const vy = 1.5 + 4.5 * near * hash(b, 2) + hash(b, 3) * 1.5
  const vz = 2 + 9 * near + hash(b, 4) * 2.5
  const land = (vy + Math.sqrt(vy * vy + 2 * GRAVITY * Math.max(0, brick.y - LIE))) / GRAVITY
  return {
    vx,
    vy,
    vz,
    land,
    spinX: (hash(b, 5) - 0.5) * (4 + 14 * near),
    spinY: (hash(b, 6) - 0.5) * (3 + 8 * near),
    spinZ: (hash(b, 7) - 0.5) * (4 + 14 * near),
  }
})

/** Where brick `b` of a wall at `wall` is `dt` seconds after the burst: into `_p`, its turn into `_e`. */
function flying(wall, b, dt) {
  const brick = DEMO_BRICKS[b]
  const f = FLIGHTS[b]
  const t = Math.min(dt, f.land)
  // Sliding a little after landing, the spin dying.
  const slide = dt > f.land ? 0.25 * (1 - Math.exp(-(dt - f.land) * 6)) : 0
  _p.set(wall.x + brick.x + f.vx * (t + slide), brick.y + f.vy * t - 0.5 * GRAVITY * t * t, wall.z + f.vz * (t + slide))
  if (dt >= f.land) _p.y = LIE
  const rx = f.spinX * t
  const rz = f.spinZ * t
  const flat = smooth((dt - f.land) / 0.25)
  _e.set(rx + (nearestHalfTurn(rx) - rx) * flat, f.spinY * t, rz + (nearestHalfTurn(rz) - rz) * flat)
}

/**
 * Builds the mesh: every slot's box, in its colour and style; placed each frame. Per
 * crane: cab, mast top, jib, counter-jib, counterweight, trolley, cable, hook. Per demo
 * wall: its bricks, then the ball (three crossed cubes), its cable and shackle.
 */
function buildMesh(palette) {
  const set = new BlockSet()
  for (let c = 0; c < CRANES.length; c += 1) {
    set.add(0, 0, 0, 1, 1, 1, '#f4f7fb', STYLE.SMOOTH)
    set.add(0, 0, 0, 1, 1, 1, palette.crane, STYLE.HAZARD)
    set.add(0, 0, 0, 1, 1, 1, palette.crane, STYLE.HAZARD)
    set.add(0, 0, 0, 1, 1, 1, palette.crane, STYLE.SMOOTH)
    set.add(0, 0, 0, 1, 1, 1, '#8d93a0', STYLE.SMOOTH)
    set.add(0, 0, 0, 1, 1, 1, palette.craneDark, STYLE.SMOOTH)
    set.add(0, 0, 0, 1, 1, 1, palette.craneDark, STYLE.SMOOTH)
    set.add(0, 0, 0, 1, 1, 1, palette.crane, STYLE.HAZARD)
  }
  for (const wall of DEMO_WALLS) {
    // Each brick a shade lighter or darker than the next.
    for (let b = 0; b < BRICKS; b += 1) set.add(0, 0, 0, 1, 1, 1, new Color(wall.color).multiplyScalar(0.86 + 0.24 * hash(b, 9)), STYLE.SMOOTH)
    for (let k = 0; k < 3; k += 1) set.add(0, 0, 0, 1, 1, 1, '#3a3f4b', STYLE.PLATE)
    set.add(0, 0, 0, 1, 1, 1, '#22252c', STYLE.SMOOTH)
    set.add(0, 0, 0, 1, 1, 1, palette.crane, STYLE.SMOOTH)
  }
  const mesh = set.build(sharedMaterials().blocks)
  mesh.matrixAutoUpdate = true
  mesh.frustumCulled = false
  return mesh
}

/** Places instance `i` at (x, y, z), turned by `_e`, sized (sx, sy, sz). */
function put(mesh, i, x, y, z, sx, sy, sz) {
  _p.set(x, y, z)
  _q.setFromEuler(_e)
  _s.set(sx, sy, sz)
  mesh.setMatrixAt(i, _m.compose(_p, _q, _s))
}

export default function CityLife({ world }) {
  const ref = useRef(null)
  const mesh = useMemo(() => buildMesh(lobbyPalette(world)), [world])
  /** Per demo wall, the last cycle its burst was shown (dust and boom only once a swing). */
  const burstSeen = useRef(DEMO_WALLS.map(() => -1))
  const nextFirework = useRef(0)

  useEffect(() => () => disposeBlocks(mesh), [mesh])

  useFrame((state) => {
    const city = ref.current
    if (!city) return
    city.visible = !push.active
    if (push.active) return
    const time = state.clock.elapsedTime
    let i = 0

    // --- The cranes ------------------------------------------------------------------
    for (let c = 0; c < CRANES.length; c += 1) {
      const { x, z, h, jib, yaw, speed } = CRANES[c]
      const turn = yaw + speed * time
      const fx = Math.sin(turn)
      const fz = Math.cos(turn)
      _e.set(0, turn, 0)
      put(city, i++, x, h + 1, z, 2.4, 2, 2.4)
      put(city, i++, x, h + 4.2, z, 0.9, 4.4, 0.9)
      put(city, i++, x + fx * (jib / 2 + 1), h + 2.4, z + fz * (jib / 2 + 1), 1, 1, jib)
      put(city, i++, x - fx * 5, h + 2.4, z - fz * 5, 1, 0.8, 8)
      put(city, i++, x - fx * 8.2, h + 1.4, z - fz * 8.2, 2.6, 2.2, 1.8)
      const run = jib * (0.5 + 0.35 * Math.sin(time * 0.23 + c * 2))
      const drop = 10 + 6 * Math.sin(time * 0.31 + c)
      put(city, i++, x + fx * run, h + 1.7, z + fz * run, 1.2, 0.5, 1.4)
      _e.set(0, 0, 0)
      put(city, i++, x + fx * run, h + 1.5 - drop / 2, z + fz * run, 0.08, drop, 0.08)
      put(city, i++, x + fx * run, h + 1.1 - drop, z + fz * run, 0.9, 0.8, 0.9)
    }

    // --- The demo walls -------------------------------------------------------------
    const me = runtime.player.position
    const particles = getQuality().particles
    for (let w = 0; w < DEMO_WALLS.length; w += 1) {
      const wall = DEMO_WALLS[w]
      const clock = time + wall.phase
      const cycle = Math.floor(clock / CYCLE)
      const t = clock - cycle * CYCLE
      const burstAt = HIT

      for (let b = 0; b < BRICKS; b += 1) {
        const brick = DEMO_BRICKS[b]
        if (t < burstAt || t >= REBUILT) {
          _e.set(0, 0, 0)
          _p.set(wall.x + brick.x, brick.y, wall.z)
        } else if (t < REBUILD) {
          flying(wall, b, t - burstAt)
        } else {
          // Flying back together: from where it lay, up in an arc, into its place.
          flying(wall, b, REBUILD - burstAt)
          const u = smooth((t - REBUILD) / (REBUILT - REBUILD))
          _p.x += (wall.x + brick.x - _p.x) * u
          _p.z += (wall.z - _p.z) * u
          _p.y += (brick.y - _p.y) * u + Math.sin(Math.PI * u) * 1.4
          _e.set(_e.x * (1 - u), _e.y * (1 - u) + u * Math.PI * 2, _e.z * (1 - u))
        }
        _q.setFromEuler(_e)
        _s.set(brick.l * 0.94, DEMO_BRICK.h * 0.92, DEMO_BRICK.d)
        city.setMatrixAt(i++, _m.compose(_p, _q, _s))
      }

      // The ball on its cable, swinging in from behind.
      const swing = swingAt(t)
      const by = GANTRY_H - CABLE * Math.cos(swing)
      const bz = wall.pivotZ - CABLE * Math.sin(swing)
      const spin = time * 0.6
      _e.set(swing, spin, 0)
      put(city, i++, wall.x, by, bz, BALL, BALL, BALL)
      _e.set(swing + 0.785, spin, 0)
      put(city, i++, wall.x, by, bz, BALL * 0.98, BALL * 0.98, BALL * 0.98)
      _e.set(swing, spin + 0.785, 0.785)
      put(city, i++, wall.x, by, bz, BALL * 0.96, BALL * 0.96, BALL * 0.96)
      _e.set(swing, 0, 0)
      put(city, i++, wall.x, GANTRY_H - (CABLE - BALL_REACH) / 2 * Math.cos(swing), wall.pivotZ - ((CABLE - BALL_REACH) / 2) * Math.sin(swing), 0.1, CABLE - BALL_REACH, 0.1)
      put(city, i++, wall.x, GANTRY_H - 0.15, wall.pivotZ, 0.5, 0.4, 0.5)

      // The burst: once a swing, dust and chips flying, and a boom if you're near.
      if (t >= burstAt && t < burstAt + 0.3 && burstSeen.current[w] !== cycle) {
        burstSeen.current[w] = cycle
        const far = Math.hypot(me.x - wall.x, me.z - wall.z)
        if (particles && far < 90) {
          burst({ x: wall.x, y: 1.6, z: wall.z + 0.4, count: 18, palette: 'dust', speed: 6 })
          burst({ x: wall.x, y: 1.6, z: wall.z + 0.4, count: 10, palette: 'gold', speed: 5 })
        }
        if (far < HEAR) sfx.demoSmash(1 - far / HEAR)
      }
    }

    // --- Fireworks over the SMASH ZONE ---------------------------------------------
    if (particles && time > nextFirework.current) {
      nextFirework.current = time + FIREWORK_EVERY
      const side = Math.floor(time / FIREWORK_EVERY) % 2 ? 1 : -1
      burst({ x: side * 4.6, y: 9, z: (PUSH_ZONE.minZ + PUSH_ZONE.maxZ) / 2, count: 26, palette: 'confetti', speed: 7 })
    }

    city.instanceMatrix.needsUpdate = true
  })

  return <primitive ref={ref} object={mesh} />
}
