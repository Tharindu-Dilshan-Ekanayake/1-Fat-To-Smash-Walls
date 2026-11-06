import { Vector3 } from 'three'

import { SAFE_LENGTH } from '@shared/balance'
import { SLOPE_ANGLE, TRACK_START_Z } from '@shared/world'

import { isSlope, SLOPES_BELOW, STAGES, stageAt, stageStart, TRACK_LENGTH } from './course'

/**
 * Geometry of the tape track of the world you're in (see course.js): it runs north from
 * the plaza's edge and down into the valley (SLOPE_ANGLE is negative), each stage a
 * straight slope with a tape across its end, a flat checkpoint between one stage and
 * the next, and a flat finish at the end.
 *
 * Track metre `m` is measured along the track from the start line (the plaza's north
 * edge): down the slopes and across the flats alike. Before the start (m < 0) the
 * ground is the flat plaza. Everything here is pure maths and allocation-free, so the
 * frame loop can call it freely. (Names like `climbed` and "top" are from when it went
 * uphill; the maths is the same either way.)
 */

export const SIN = Math.sin(SLOPE_ANGLE)
export const COS = Math.cos(SLOPE_ANGLE)

/**
 * The track's cross-section: its floor between two stepped walls, whose top (the rim)
 * ends RIM_X either side of the middle. The lobby's mountains leave that much room.
 */
export const RIM_X = 26

/** Metres of slope climbed by metre m: every slope below it, and as much of its own as it's up. */
function climbed(m) {
  if (m <= 0) return 0
  const i = stageAt(m)
  return SLOPES_BELOW[i] + Math.min(STAGES[i].length, Math.max(0, m - stageStart(i)))
}

/** Height of the floor at track metre m. */
export const floorY = (m) => climbed(m) * SIN
/** World z of track metre m. */
export const zAt = (m) => (m <= 0 ? TRACK_START_Z - m : TRACK_START_Z - climbed(m) * COS - (m - climbed(m)))

/** Metres a world z is along the track (negative in the plaza): the inverse of zAt. */
export function meterAtZ(z) {
  const along = TRACK_START_Z - z
  if (along <= 0) return along
  let base = 0
  for (let i = 0; i < STAGES.length; i += 1) {
    const slope = STAGES[i].length * COS
    if (along < base + slope) return stageStart(i) + (along - base) / COS
    base += slope
    const flat = i < STAGES.length - 1 ? SAFE_LENGTH : Infinity
    if (along < base + flat) return stageStart(i) + STAGES[i].length + (along - base)
    base += flat
  }
  return TRACK_LENGTH
}

/** How a piece of track at metre m is tipped: down to the north on a slope, level on a flat. */
export const sectionTilt = (m) => (isSlope(m) ? SLOPE_ANGLE : 0)

/** Over this many metres either side of a bend, things riding the track tip gradually. */
const BEND = 1.5
const clamp01 = (x) => Math.min(1, Math.max(0, x))
/** How much stage j's slope tips something at metre m: 1 on it, 0 off it, eased over the bends. */
function slopeWeight(m, j) {
  const s = stageStart(j)
  return clamp01((m - s + BEND) / (2 * BEND)) * clamp01((s + STAGES[j].length - m + BEND) / (2 * BEND))
}

/** The tilt something riding the track at metre m takes, eased round the bends so a roller never jumps. */
export function tiltAt(m) {
  if (m <= -BEND) return 0
  const i = stageAt(m)
  return SLOPE_ANGLE * Math.max(slopeWeight(m, i), i > 0 ? slopeWeight(m, i - 1) : 0)
}

/** Height of the floor under world z. */
export const groundYAtZ = (z) => floorY(meterAtZ(z))
/** Height of a surface parallel to the floor, `h` metres off it, under world z. */
export function surfaceY(z, h) {
  const m = meterAtZ(z)
  return floorY(m) + h / Math.cos(sectionTilt(m))
}

/**
 * World point at track metre m, `x` to the side and `h` off the floor along its normal
 * (so a ball sits on it, square to the slope).
 */
export function trackPoint(m, x, h, out) {
  const t = tiltAt(m)
  return out.set(x, floorY(m) + h * Math.cos(t), zAt(m) + h * Math.sin(t))
}

/** Feet of someone standing upright on the floor at metre m, `x` across. */
export const feetPoint = (m, x, out) => out.set(x, floorY(m), zAt(m))

const _p = new Vector3()

/**
 * A box lying on the track, as BlockSet.add arguments: [x, y, z, rotX]. Centred `x`
 * across, `h` off the floor (to its centre) and at metre `m`, tipped like the piece of
 * track it's on, which it must not cross the end of.
 */
export function slopeBoxPlacement(m, x, h) {
  const t = sectionTilt(m)
  _p.set(x, floorY(m) + h * Math.cos(t), zAt(m) + h * Math.sin(t))
  return [_p.x, _p.y, _p.z, t]
}

// --- The ball you roll as -------------------------------------------------------------

/**
 * Curled up for a roll, a body of `bulk` (0 skinny - 1 as fat as can be, see
 * playerPose.bulkFor) is a ball about this many metres across its middle: what it rolls
 * on, so how fast it turns, and how close a coin bubble must come to be taken.
 */
export const ballRadius = (bulk = 0) => 0.46 + 0.3 * Math.min(1, Math.max(0, bulk))
