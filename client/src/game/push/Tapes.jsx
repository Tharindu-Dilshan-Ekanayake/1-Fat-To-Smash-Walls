import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Color, Euler, Matrix4, Quaternion, Vector3 } from 'three'

import { TRACK_HALF_WIDTH } from '@shared/world'

import { getGame } from '../../store/game'
import { getQuality } from '../../store/quality'
import { createBoxInstances, disposeBlocks } from '../blocks'
import { sharedMaterials, STYLE } from '../materials'
import { MAX_STAGES, STAGES, TAPES } from './course'
import { tiltAt, trackPoint } from './path'
import { push, TAPE_STRETCH } from './pushControl'

/**
 * The tapes across the end of every slope: a tall wall of silver tape, strip over strip,
 * stretched between two traffic posts (the posts are the track's own, see track.js) -
 * gold on the last, and tinted red on any tape too strong for the Fat you have, so you
 * can see where a roll will stop. It sags a touch between its posts and flutters as you
 * roll. Each strip is a row of short segments, so the wall can bend: rolling into it, it
 * bulges round your belly - crackling with electric blue where you push - further and
 * further until it SNAPS (pushControl decides when); then each half of every strip swings
 * away off its post and drops, and lies on the track behind you for the rest of the roll.
 * Once your roll is over they're all whole again.
 *
 * Every segment of every tape near the camera is one instance of one InstancedMesh - a
 * single draw call - placed each frame from shared scratch objects (no allocation).
 */

/** Segments per strip, and the strip's size: across the track's floor. */
const SEGMENTS = 14
const SPAN = TRACK_HALF_WIDTH * 2 - 0.3
const HALF_SPAN = SPAN / 2
const SEG = SPAN / SEGMENTS
const BAND_H = 0.42
const BAND_T = 0.07
/**
 * The wall: this many strips, the lowest one's middle this high, each overlapping the one
 * below a little (STEP < BAND_H) - floor to just over three metres, taller than any belly.
 * Every other strip sits a hair further down the track (OVERLAP), so overlaps never flicker.
 */
const BANDS = 8
const BOTTOM = 0.26
const STEP = 0.4
const OVERLAP = 0.012
/** How tall the bulge round a belly is, as a share of how big the ball is. */
const BOW_HEIGHT = 1.6
/** How wide the bow round a belly is (m), as a share of how big the ball is. */
const BOW_WIDTH = 1.5
/** A snapped half swings down off its post like this: how fast, how bouncy. */
const SWING_RATE = 4
const SWING_BOUNCE = 8
/** Lying on the track: this far over it. */
const FLOOR = 0.05
/** Not rolling, the tapes are laid out only every this many frames. */
const IDLE_EVERY = 30

const MAX_INSTANCES = MAX_STAGES * BANDS * SEGMENTS

/**
 * The strips' shades, cycling up the wall (duct tape, strip over strip): silver; gold on
 * the last tape; red-tinted silver on a tape too strong for you; electric blue, flickering,
 * where a belly's pushing in.
 */
const shades = (list) => list.map((c) => new Color(c))
const PALETTE = [
  shades(['#eef1f4', '#dde2e7', '#e7ebef', '#d4dae0']),
  shades(['#ffe68f', '#f3cd52', '#ffde73', '#e9bd3c']),
  shades(['#e6aaaa', '#d69595', '#df9f9f', '#cc8a8a']),
  shades(['#c9f7ff', '#6fdcff', '#a8efff', '#3cbcff']),
]
const SILVER = 0
const GOLD = 1
const LOCKED = 2
const ELECTRIC = 3
/** How far a band sags in its middle, and how it flutters while you roll. */
const SAG = 0.09
const FLUTTER = 0.07

const _m = new Matrix4()
const _p = new Vector3()
const _q = new Quaternion()
const _s = new Vector3()
const _e = new Euler()

/** Colours instance `i`, strip `band`, as `look` (SILVER...ELECTRIC) - only when that changes. */
function paint(tapes, colours, i, band, look) {
  const shade = band % 4
  const key = 1 + shade + 4 * look
  if (colours[i] === key) return false
  colours[i] = key
  tapes.setColorAt(i, PALETTE[look][shade])
  return true
}

export default function Tapes() {
  const ref = useRef(null)
  const mesh = useMemo(() => createBoxInstances(MAX_INSTANCES, sharedMaterials().toy, STYLE.SMOOTH), [])
  /** What colour each instance was last given (0 none): repainted only when it changes. */
  const colours = useMemo(() => new Uint16Array(MAX_INSTANCES), [])
  /** Frames since the tapes were last laid out while nobody was rolling (they're still then). */
  const idle = useRef(0)

  useEffect(() => () => disposeBlocks(mesh), [mesh])

  useFrame((state) => {
    const tapes = ref.current
    if (!tapes) return
    const rolling = push.active
    // In the lobby the tapes stand still: re-lay them (for the view distance as the
    // camera moves) only every so often; rolling, every frame.
    if (!rolling) {
      idle.current += 1
      if (idle.current > 1 && idle.current % IDLE_EVERY !== 0) return
    } else idle.current = 0
    const far = getQuality().viewDistance
    const now = performance.now()
    const lastStage = STAGES.length - 1
    // Too strong for you: rolling, for the Fat behind the roll; in the lobby, for yours.
    const fat = rolling ? push.power : getGame().profile.fat
    const flutter = rolling ? state.clock.elapsedTime * 7 : 0
    let repainted = false
    let i = 0

    for (const tape of TAPES) {
      const brokenAt = rolling && push.tapesBroken.includes(tape.stage) ? push.tapeAt[tape.stage] : 0
      trackPoint(tape.meter, 0, 0, _p)
      if (_p.distanceTo(state.camera.position) > far) continue
      const age = brokenAt ? (now - brokenAt) / 1000 : 0
      const breakX = brokenAt ? push.tapeBreakX[tape.stage] : 0
      // A belly pressing in (only yours: you roll the tapes you see) bows the bands out,
      // round the ball, up to as far as they stretch.
      const press = rolling && !brokenAt && push.phase !== 'top' ? push.meter + push.radius - tape.meter : 0
      const bow = Math.min(TAPE_STRETCH, Math.max(0, press))
      const width = BOW_WIDTH * Math.max(0.6, push.radius)
      const tall = BOW_HEIGHT * Math.max(0.6, push.radius)
      // Snapped: how far each half has swung down off its post (radians), bouncing.
      const swing = brokenAt ? (Math.PI / 2) * (1 - Math.exp(-SWING_RATE * age) * Math.cos(SWING_BOUNCE * age)) : 0
      const tilt = tiltAt(tape.meter)
      const look = tape.stage === lastStage ? GOLD : tape.need > fat ? LOCKED : SILVER

      for (let band = 0; band < BANDS; band += 1) {
        const h = BOTTOM + band * STEP
        for (let seg = 0; seg < SEGMENTS; seg += 1) {
          if (i >= MAX_INSTANCES) break
          const x = -HALF_SPAN + (seg + 0.5) * SEG
          let meter = tape.meter + (band % 2) * OVERLAP
          let along = x
          let y = h
          let roll = 0
          let pitch = tilt
          let shown = look
          if (brokenAt) {
            // Each half hangs off its own post: swung down `swing` from level, and what
            // would go through the floor lies on it instead, billowing on down the track.
            const side = x < breakX ? -1 : 1
            const fromPost = Math.abs(side * HALF_SPAN - x)
            along = side * HALF_SPAN - side * fromPost * Math.cos(swing)
            y = h - fromPost * Math.sin(swing)
            meter = tape.meter + 0.5 * Math.sin(swing) * (fromPost / SPAN)
            roll = side * swing
            if (y < FLOOR) {
              along -= side * (FLOOR - y) * 0.35
              y = FLOOR
              roll = 0
              pitch = tilt + Math.PI / 2
            }
          } else {
            // A touch of sag between the posts, a flutter as you roll, and pushed out
            // round your belly - the ends staying tied on.
            const ends = 1 - (x / HALF_SPAN) ** 4
            y -= SAG * (1 - (x / HALF_SPAN) ** 2)
            if (flutter) meter += Math.sin(flutter + x * 1.4 + band * 0.9) * FLUTTER * ends
            if (bow > 0) {
              // Bulging round the ball: most round its middle, less up and down the wall.
              const off = (x - push.x) / width
              const up = (h - push.radius) / tall
              const bulge = Math.exp(-off * off - up * up)
              meter += bow * bulge * ends
              // Crackling electric blue where it's pushed in hardest.
              if (bulge > 0.45 && Math.sin(now * 0.045 + seg * 2.3 + band * 1.7) > 0.1) shown = ELECTRIC
            }
          }
          trackPoint(meter, along, y, _p)
          _e.set(pitch, 0, roll)
          _q.setFromEuler(_e)
          // Stretched, the strips thin a little (the wall opening up between them).
          _s.set(SEG * 1.12, BAND_H * (1 - 0.3 * (bow / TAPE_STRETCH)), BAND_T)
          tapes.setMatrixAt(i, _m.compose(_p, _q, _s))
          if (paint(tapes, colours, i, band, shown)) repainted = true
          i += 1
        }
      }
    }

    tapes.count = i
    tapes.instanceMatrix.needsUpdate = true
    if (repainted && tapes.instanceColor) tapes.instanceColor.needsUpdate = true
  })

  return <primitive ref={ref} object={mesh} />
}
