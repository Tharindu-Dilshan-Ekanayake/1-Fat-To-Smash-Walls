import { hash2, mulberry32 } from '@shared/rng'
import { PLAZA, TRACK_START_Z } from '@shared/world'

import { STYLE } from '../materials'

/**
 * SMASH CITY's skyline: the city blocks ringing the plaza where other games have hills.
 *
 * A grid of lots all round the plaza (none on it, none where the arena track's ledges run
 * out to the north): a row of low brick shopfronts right at the plaza's edge, awnings
 * and lit signs facing in; mid-rise blocks behind; and towers further out, taller the
 * further they are, some stepping back as they rise. Their windows light up warm in the
 * sunset (STYLE.LITWIN); brick buildings are brick (STYLE.BRICKS). On the roofs: water
 * tanks, air-con units, billboards turned to the plaza, aerials with blinking red lights.
 * Here and there a block's half knocked down - a broken top, rebar sticking out, rubble
 * at its foot - and three tower cranes stand among them (their jibs turn: CityLife.jsx).
 *
 * All boxes, in the world's one block set; seeded, so every client builds the same city.
 * `density` (the preset's decorDensity) thins the rooftop clutter on weak devices.
 */

const BOUNDS = { minX: -162, maxX: 162, minZ: -140, maxZ: 132 }
/** Lot pitch, and the street between buildings. */
const LOT = 13
const GAP = 2.4
/** North of the plaza the arena's ledges run out this far either side, near and further down. */
const TRACK_NEAR_X = 37
const TRACK_FAR_X = 102
const TRACK_NEAR_Z = TRACK_START_Z - 40

/**
 * The tower cranes: where each mast stands, how tall it is, how long its jib, where the
 * jib starts and how fast it turns (radians a second; CityLife.jsx turns it).
 */
export const CRANES = [
  { x: -60, z: 2, h: 44, jib: 26, yaw: 0.6, speed: 0.07 },
  { x: 64, z: -22, h: 50, jib: 30, yaw: 2.4, speed: -0.055 },
  { x: 20, z: 60, h: 40, jib: 24, yaw: -1.2, speed: 0.08 },
]
/** No building within this of a crane's mast. */
const CRANE_CLEAR = 9

function distanceOutside(rect, x, z) {
  const dx = Math.max(rect.minX - x, 0, x - rect.maxX)
  const dz = Math.max(rect.minZ - z, 0, z - rect.maxZ)
  return Math.hypot(dx, dz)
}

/** Whether a lot of half-size (hx, hz) at (x, z) may hold a building. */
function lotFree(x, z, hx, hz) {
  // Off the plaza, with a pavement's width to spare.
  if (x + hx > PLAZA.minX - 1.5 && x - hx < PLAZA.maxX + 1.5 && z + hz > PLAZA.minZ - 1.5 && z - hz < PLAZA.maxZ + 1.5) return false
  // Clear of the arena track and its ledges, north of the plaza.
  if (z - hz < TRACK_START_Z) {
    if (Math.abs(x) - hx < TRACK_NEAR_X) return false
    if (z - hz < TRACK_NEAR_Z && Math.abs(x) - hx < TRACK_FAR_X) return false
  }
  for (const crane of CRANES) if (Math.abs(crane.x - x) < hx + CRANE_CLEAR && Math.abs(crane.z - z) < hz + CRANE_CLEAR) return false
  return true
}

/** The unit direction (along x or z) from (x, z) to the nearest point of the plaza. */
function towardPlaza(x, z) {
  const px = Math.min(PLAZA.maxX, Math.max(PLAZA.minX, x))
  const pz = Math.min(PLAZA.maxZ, Math.max(PLAZA.minZ, z))
  const dx = px - x
  const dz = pz - z
  return Math.abs(dx) > Math.abs(dz) ? [Math.sign(dx), 0] : [0, Math.sign(dz) || 1]
}

const pick = (rand, list) => list[Math.floor(rand() * list.length)]

/** A water tank on legs (just the tank, on a plinth, without `detail`). */
function waterTank(b, x, y, z, s, detail) {
  if (detail) {
    for (const [ox, oz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) b.addOn(x + ox * s, y, z + oz * s, 0.22 * s, 1.6 * s, 0.22 * s, '#3b3f4a', STYLE.SMOOTH)
  } else {
    b.addOn(x, y, z, 1.8 * s, 1.6 * s, 1.8 * s, '#3b3f4a', STYLE.SMOOTH)
  }
  b.addOn(x, y + 1.6 * s, z, 2.3 * s, 2.4 * s, 2.3 * s, '#9a6a42', STYLE.STRIPES)
  b.addOn(x, y + 4 * s, z, 1.7 * s, 0.6 * s, 1.7 * s, '#6e4a2c', STYLE.SMOOTH, 0.785)
}

/** A billboard on two posts, its glowing face turned along `dir`. */
function billboard(b, x, y, z, w, dir, color, frame) {
  const yaw = dir[0] !== 0 ? Math.PI / 2 : 0
  for (const side of [-1, 1]) {
    const ox = dir[0] !== 0 ? 0 : side * w * 0.35
    const oz = dir[0] !== 0 ? side * w * 0.35 : 0
    b.addOn(x + ox, y, z + oz, 0.3, 3.2, 0.3, frame, STYLE.SMOOTH)
  }
  b.addOn(x, y + 3, z, w + 0.4, 3.4, 0.36, frame, STYLE.SMOOTH, yaw)
  b.addOn(x + dir[0] * 0.08, y + 3.2, z + dir[1] * 0.08, w, 3, 0.36, color, STYLE.GLOW, yaw)
  // A stripe of lights along its foot.
  b.addOn(x + dir[0] * 0.25, y + 3.05, z + dir[1] * 0.25, w, 0.18, 0.12, '#fff3b0', STYLE.CHASE, yaw)
}

/** An aerial: a thin mast with a blinking red light on top. */
function aerial(b, x, y, z, h) {
  b.addOn(x, y, z, 0.24, h, 0.24, '#2c303a', STYLE.SMOOTH)
  b.addOn(x, y + h * 0.55, z, 1.2, 0.12, 0.12, '#2c303a', STYLE.SMOOTH)
  b.add(x, y + h + 0.25, z, 0.5, 0.5, 0.5, '#ff3030', STYLE.BLINK)
}

/**
 * One building on a lot `w` by `d` at (x, z), `h` tall: its body in `facade` and
 * `style`, a parapet, maybe a setback upper tier, and clutter on its roof.
 */
function building(b, rand, x, z, w, d, h, { facade, style, palette, detail, density, near, broken }) {
  const dir = towardPlaza(x, z)
  if (broken) {
    // Half knocked down: a stump, and a jagged top - columns of different heights.
    const stump = h * 0.45
    b.addOn(x, -0.3, z, w, stump + 0.3, d, facade, style)
    const cols = 3
    for (let i = 0; i < cols; i += 1) {
      const ch = h * (0.1 + rand() * 0.45)
      const cw = w / cols
      b.addOn(x - w / 2 + cw * (i + 0.5), stump, z + (rand() - 0.5) * d * 0.3, cw * 0.96, ch, d * (0.6 + rand() * 0.4), facade, style)
      // Rebar sticking out of the broken top.
      b.add(x - w / 2 + cw * (i + 0.5) + (rand() - 0.5), stump + ch + 0.6, z, 0.08, 1.4, 0.08, '#5a3a2a', STYLE.SMOOTH, 0, rand() - 0.5, rand() - 0.5)
    }
    // Rubble at its foot, on the plaza side.
    for (let i = 0; i < (detail ? 6 : 3); i += 1) {
      const s = 0.6 + rand() * 1.1
      b.add(x + dir[0] * (w / 2 + 1 + rand() * 2) + (rand() - 0.5) * w * 0.8, s * 0.3, z + dir[1] * (d / 2 + 1 + rand() * 2) + (rand() - 0.5) * d * 0.8, s * 1.4, s * 0.6, s, facade, STYLE.BRICKS, rand() * 3, rand() * 0.4, rand() * 0.4)
    }
    return
  }
  b.addOn(x, -0.3, z, w, h + 0.3, d, facade, style)
  b.addOn(x, h, z, w + 0.35, 0.6, d + 0.35, palette.roof, STYLE.SMOOTH)
  let top = h + 0.6
  let rw = w
  let rd = d
  // A setback tier on the taller ones.
  if (h > 22 && rand() < 0.45) {
    rw = w * (0.55 + rand() * 0.2)
    rd = d * (0.55 + rand() * 0.2)
    const h2 = h * (0.2 + rand() * 0.25)
    b.addOn(x, top, z, rw, h2, rd, facade, style)
    b.addOn(x, top + h2, z, rw + 0.3, 0.5, rd + 0.3, palette.roof, STYLE.SMOOTH)
    top += h2 + 0.5
  }

  if (near) {
    // A shopfront facing the plaza: an awning along the ground floor and a lit sign over it.
    const fx = x + dir[0] * (w / 2)
    const fz = z + dir[1] * (d / 2)
    const along = dir[0] !== 0 ? d : w
    const yaw = dir[0] !== 0 ? Math.PI / 2 : 0
    const awning = pick(rand, palette.neonSigns)
    b.add(fx + dir[0] * 0.6, 3.1, fz + dir[1] * 0.6, along * 0.86, 0.2, 1.2, awning, STYLE.SMOOTH, yaw)
    b.add(fx + dir[0] * 1.2, 2.88, fz + dir[1] * 1.2, along * 0.86, 0.36, 0.08, palette.trim, STYLE.SMOOTH, yaw)
    b.add(fx + dir[0] * 0.14, 4.6, fz + dir[1] * 0.14, along * 0.5, 1.1, 0.24, pick(rand, palette.neonSigns), STYLE.GLOW, yaw)
  }

  // Roof clutter.
  if (rand() > density) return
  const r = rand()
  if (r < 0.22 && h < 34) waterTank(b, x + (rand() - 0.5) * rw * 0.4, top, z + (rand() - 0.5) * rd * 0.4, 0.9 + rand() * 0.3, detail)
  else if (r < 0.42 && !near && h < 40) billboard(b, x, top, z, Math.min(rw, rd, 8) * 0.9, dir, pick(rand, palette.neonSigns), palette.roof)
  else if (r < 0.7 && h > 26) aerial(b, x + (rand() - 0.5) * rw * 0.3, top, z + (rand() - 0.5) * rd * 0.3, 5 + rand() * 7)
  if (detail && rand() < 0.6) {
    for (let i = 0; i < 2; i += 1) b.addOn(x + (rand() - 0.5) * rw * 0.6, top, z + (rand() - 0.5) * rd * 0.6, 1.2, 0.8, 0.9, '#c9ced6', STYLE.PLATE)
  }
}

/** A tower crane's mast (its jib, cab and hook turn: CityLife.jsx). */
function craneMast(b, crane, palette) {
  const { x, z, h } = crane
  b.addOn(x, -0.3, z, 4, 1.3, 4, '#8d93a0', STYLE.SMOOTH)
  b.addOn(x, 1, z, 1.5, h - 1, 1.5, palette.crane, STYLE.HAZARD)
  for (let y = 6; y < h - 2; y += 6) b.addOn(x, y, z, 1.75, 0.35, 1.75, palette.craneDark, STYLE.SMOOTH)
}

/** Builds the skyline into `blocks`, in `palette`'s colours. */
export function buildSkyline(blocks, { density = 1, palette } = {}) {
  const detail = density >= 0.75
  const rand = mulberry32(2024)
  const cols = Math.ceil((BOUNDS.maxX - BOUNDS.minX) / LOT)
  const rows = Math.ceil((BOUNDS.maxZ - BOUNDS.minZ) / LOT)
  let count = 0
  for (let j = 0; j < rows; j += 1) {
    for (let i = 0; i < cols; i += 1) {
      const x = BOUNDS.minX + (i + 0.5) * LOT
      const z = BOUNDS.minZ + (j + 0.5) * LOT
      const jitter = hash2(i, j, 9)
      const w = LOT - GAP - jitter * 2.2
      const d = LOT - GAP - hash2(i, j, 13) * 2.2
      if (!lotFree(x, z, w / 2, d / 2)) continue
      const dist = distanceOutside(PLAZA, x, z)
      const near = dist < 13
      // Further out, now and then an empty lot (a car park), so the skyline breathes.
      if (!near && hash2(i, j, 21) < (dist > 60 ? 0.3 : 0.12)) continue
      const r = hash2(i, j, 33)
      const h = near ? 8 + r * 6 : dist < 45 ? 14 + 22 * r ** 1.3 : 24 + 46 * r ** 1.5
      const k = hash2(i, j, 47)
      const style = near ? (k < 0.6 ? STYLE.BRICKS : STYLE.LITWIN) : dist < 45 ? (k < 0.3 ? STYLE.BRICKS : k < 0.82 ? STYLE.LITWIN : STYLE.WINDOWS) : k < 0.75 ? STYLE.LITWIN : STYLE.WINDOWS
      const facade = palette.facades[Math.floor(hash2(i, j, 51) * palette.facades.length)]
      const broken = !near && dist < 60 && hash2(i, j, 63) < 0.09
      building(blocks, rand, x, z, w, d, h, { facade, style, palette, detail, density, near, broken })
      count += 1
    }
  }
  for (const crane of CRANES) craneMast(blocks, crane, palette)
  return { buildings: count }
}
