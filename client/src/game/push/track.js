import { mulberry32 } from '@shared/rng'
import { TRACK_HALF_WIDTH } from '@shared/world'

import { BlockSet, toColor } from '../blocks'
import { STYLE } from '../materials'
import { addTree } from '../world/terrain'
import { isSlope, safeStart, STAGES, stageAt, stageStart, TRACK, TRACK_LENGTH } from './course'
import { RIM_X, slopeBoxPlacement, surfaceY, zAt } from './path'
import { SAFE_THEME, STAGE_THEMES } from './themes'

/**
 * The tape track down the valley, generated in 40 m chunks on demand. Each chunk is a
 * BlockSet (one draw call); content is seeded by chunk index, so every client builds an
 * identical valley and a chunk can be thrown away and rebuilt at will.
 *
 * Cross-section: a narrow tiled floor between tall stepped cliffs of big square studs -
 * a low step, a higher one and the rim - with a ledge running out beyond the rim and
 * scenery on the steps and the ledge. Along it, each stage's slope with glowing chevrons
 * down the middle, then the striped posts its tapes are strung between (the tapes are
 * Tapes.jsx's), then a flat light-blue checkpoint, then the next stage's slope.
 * Everything structural lies along the track (tipped on the slopes, level on the flats);
 * trees and props stand upright.
 */

export const CHUNK = 40
const HALF = TRACK_HALF_WIDTH
/** The walls' steps, from the floor's edge out: [inner x, outer x, height above the floor]. */
const STEPS = [
  [HALF, 9, 6],
  [9, 15, 12],
  [15, RIM_X, 18],
]
const RIM_H = STEPS[STEPS.length - 1][2]
/** How far the ledge beyond the rim runs: short beside the lobby, wide after. */
const LEDGE_NEAR = RIM_X + 10
const LEDGE_FAR = 95
/** The finish: a flat stretch past the last tape, then a wall. */
export const SUMMIT_LENGTH = 34
export const trackEnd = () => TRACK_LENGTH + SUMMIT_LENGTH
/** No scenery on the first chunk, where the lobby's mountains stand beside the track. */
const DECOR_START = 40

/** Where the track bends: the end and the start of every slope after the first, and the finish. */
let bendsOf = null
let bendsList = []
function bends() {
  if (bendsOf !== TRACK) {
    bendsOf = TRACK
    bendsList = [...STAGES.slice(1).flatMap((_, k) => [safeStart(k + 1), stageStart(k + 1)]), TRACK_LENGTH]
  }
  return bendsList
}
/**
 * Past a bend from slope to flat, a flat's walls run this far back over the top of the
 * slope, filling the notch the bend would leave; and they stand a few centimetres
 * proud of the slope's, so the two never flicker where they overlap.
 */
const BACKFILL = 3.2
const PROUD = 0.05
/** Chevrons down the middle of a slope, this far apart; lanterns down its sides, and arches over it. */
const CHEVRON_EVERY = 6
const LANTERN_EVERY = 12
const ARCH_EVERY = 48

/** A colour a little lighter (`by` > 0) or darker (< 0) than `color`, made once. */
const shades = new Map()
function shade(color, by) {
  const key = `${color}${by}`
  if (!shades.has(key)) shades.set(key, toColor(color).clone().lerp(toColor(by > 0 ? '#ffffff' : '#000000'), Math.abs(by)))
  return shades.get(key)
}

const pick = (rand, list) => list[Math.floor(rand() * list.length)]

/** A box lying on the slope: centred x across, h off the floor, metre m, lean about its length. */
function slab(b, m, x, h, sx, sy, sz, color, style = STYLE.STUDS, lean = 0) {
  const [px, py, pz, rotX] = slopeBoxPlacement(m, x, h)
  b.add(px, py, pz, sx, sy, sz, color, style, 0, rotX, lean)
}

/** Height of a step's top (or the ledge, at RIM_H) under world z, for standing props on it. */
const topY = (z, h) => surfaceY(z, h + 0.5)

// --- The track -----------------------------------------------------------------------

/** Stepped cliffs on both sides, of `look`, for metres [m0, m0 + len) about `mid`. */
function cliffs(b, mid, len, look, proud) {
  const style = look.wallStyle ?? STYLE.BLOCK
  for (const side of [-1, 1]) {
    for (const [stepInner, outer, h] of STEPS) {
      const inner = stepInner - proud
      const x = (side * (inner + outer)) / 2
      slab(b, mid, x, h / 2 - 2, outer - inner, h + 4, len, look.wall, style)
      if (look.cap) slab(b, mid, x, h + 0.25, outer - inner + 0.1, 0.5, len, look.cap, look.capStyle ?? STYLE.BLOCK)
    }
  }
}

/**
 * Floor, stepped cliffs, the ledge beyond and, down a slope, chevrons down the middle,
 * for metres [a, c). `kind` is 'slope', 'safe' (a checkpoint: light blue, whatever the
 * stage) or 'summit' (the finish).
 */
function walls(b, a, c, theme, wide, kind) {
  const len = c - a
  const mid = (a + c) / 2
  const flat = kind !== 'slope'
  const back = flat && bends().includes(a) ? BACKFILL : 0
  const wallLen = len + back
  const wallMid = mid - back / 2
  const look = kind === 'safe' ? SAFE_THEME : theme
  const floorStyle = look.floorStyle ?? STYLE.TILES
  slab(b, mid, 0, -0.5, HALF * 2 + 2, 1, len, look.floor, floorStyle)
  cliffs(b, wallMid, wallLen, look, flat ? PROUD : 0)
  for (const side of [-1, 1]) {
    // A darker kerb down each side of the floor, framing the path.
    slab(b, mid, side * (HALF - 0.4), 0.03, 0.8, 0.06, len, shade(look.floor, -0.18), floorStyle)
    // A lighter trim along the lip of every step (grassy cliffs have their grass instead).
    if ((look.wallStyle ?? STYLE.BLOCK) !== STYLE.BLOCK_GRASS) {
      const proud = flat ? PROUD : 0
      for (const [inner, , h] of STEPS) slab(b, wallMid, side * (inner - proud - 0.06), h - 0.16, 0.3, 0.32, wallLen, shade(look.wall, 0.3), STYLE.SMOOTH)
    }
  }
  // The ledge beyond the rim, as solid ground down to below the floor: the stage's own,
  // even beside a checkpoint.
  const style = theme.wallStyle ?? STYLE.BLOCK
  const far = wide ? LEDGE_FAR : LEDGE_NEAR
  const width = far - RIM_X
  for (const side of [-1, 1]) {
    const x = side * (RIM_X + width / 2)
    slab(b, wallMid, x, RIM_H / 2 - 4, width, RIM_H + 8, wallLen, theme.wall, style)
    if (theme.cap) slab(b, wallMid, x, RIM_H + 0.25, width, 0.5, wallLen, theme.cap, theme.capStyle ?? STYLE.BLOCK)
  }
  if (kind !== 'slope') return
  // Lanterns down both sides in the stage's colour, on dark posts.
  for (let m = Math.ceil(a / LANTERN_EVERY) * LANTERN_EVERY + 6; m < c - 1; m += LANTERN_EVERY) {
    for (const side of [-1, 1]) {
      const [px, py, pz] = slopeBoxPlacement(m, side * (HALF - 0.35), 0)
      b.addOn(px, py - 0.1, pz, 0.18, 1.7, 0.18, '#2c313c', STYLE.SMOOTH)
      b.add(px, py + 1.85, pz, 0.46, 0.46, 0.46, theme.gate, STYLE.GLOW)
      b.add(px, py + 2.13, pz, 0.56, 0.1, 0.56, '#2c313c', STYLE.SMOOTH)
    }
  }
  // Now and then an arch over the track: stone pillars and a beam with a glowing band.
  for (let m = Math.ceil(a / ARCH_EVERY) * ARCH_EVERY + ARCH_EVERY / 2; m < c - 2; m += ARCH_EVERY) {
    const [, py, pz] = slopeBoxPlacement(m, 0, 0)
    for (const side of [-1, 1]) b.addOn(side * (HALF - 0.3), py - 0.6, pz, 0.7, 7.6, 0.7, shade(theme.wall, 0.15), STYLE.BLOCK)
    b.addOn(0, py + 6.7, pz, HALF * 2 + 0.4, 0.8, 0.8, shade(theme.wall, 0.15), STYLE.BLOCK)
    b.addOn(0, py + 6.55, pz + 0.04, HALF * 2 - 0.8, 0.2, 0.86, theme.gate, STYLE.GLOW)
  }
  // Soft glowing chevrons down the middle, pointing the way.
  for (let m = Math.ceil(a / CHEVRON_EVERY) * CHEVRON_EVERY + 3; m < c - 1; m += CHEVRON_EVERY) {
    const [px, py, pz, rotX] = slopeBoxPlacement(m, 0, 0.04)
    for (const side of [-1, 1]) {
      b.add(px + side * 0.95, py, pz, 2.4, 0.08, 0.5, '#f3fff0', STYLE.GLOW, -side * 0.6, rotX, 0)
    }
  }
}

/**
 * The posts tape `stage`'s wall of tape is stretched between, at metre `m`: a big orange
 * and white striped traffic post either side of the floor, on a dark foot, with a cap and
 * a light in the stage's colour on top.
 */
function tapeGate(b, m, theme) {
  const [, py, pz] = slopeBoxPlacement(m, 0, 0)
  for (const side of [-1, 1]) {
    const x = side * (HALF - 0.12)
    b.addOn(x, py - 0.3, pz, 1.0, 0.45, 1.0, '#2c313c', STYLE.SMOOTH)
    b.addOn(x, py + 0.1, pz, 0.78, 3.6, 0.78, '#ff6a1a', STYLE.STRIPES)
    b.addOn(x, py + 3.7, pz, 0.9, 0.28, 0.9, '#ff6a1a', STYLE.SMOOTH)
    b.addOn(x, py + 3.98, pz, 0.42, 0.3, 0.42, theme.gate, STYLE.GLOW)
  }
}

/**
 * The checkpoint below stage `i` (its look is walls'): the posts of the tape it starts
 * with, a glowing line across just past them, and a line in the next stage's colour
 * where the next slope starts.
 */
function safezone(b, i) {
  const a = safeStart(i)
  const line = (m, color) => {
    const [x, y, z] = slopeBoxPlacement(m, 0, 0.05)
    b.add(x, y, z, HALF * 2 - 0.2, 0.1, 0.5, color, STYLE.GLOW)
  }
  tapeGate(b, a, STAGE_THEMES[STAGES[i - 1].id])
  line(a + 0.8, '#e8f7ff')
  line(stageStart(i) - 0.4, STAGE_THEMES[STAGES[i].id].gate)
}

/** The finish: the last tape's posts, a golden platform, a giant trophy on a plinth, and the valley's end wall. */
function summit(b, theme) {
  tapeGate(b, TRACK_LENGTH, theme)
  const m = TRACK_LENGTH + SUMMIT_LENGTH * 0.62
  const [px, py, pz, rotX] = slopeBoxPlacement(TRACK_LENGTH + SUMMIT_LENGTH / 2, 0, 0.06)
  b.add(px, py, pz, HALF * 2 - 0.4, 0.12, SUMMIT_LENGTH - 1, '#ffd21f', STYLE.PLATE, 0, rotX)
  const z = zAt(m)
  const base = surfaceY(z, 0)
  const gold = '#ffc61a'
  b.addOn(0, base - 0.5, z, 6, 2, 6, '#f4f7fb')
  b.addOn(0, base + 1.5, z, 5, 0.5, 5, gold, STYLE.GLOW)
  // The cup: a stem, a bowl stepping out, and two handles.
  b.addOn(0, base + 2, z, 1.2, 2.6, 1.2, gold, STYLE.GLOW)
  for (let i = 0; i < 5; i += 1) b.addOn(0, base + 4.6 + i * 0.9, z, 2.2 + i * 0.7, 0.9, 2.2 + i * 0.7, gold, STYLE.GLOW)
  for (const side of [-1, 1]) {
    b.add(side * 3.6, base + 7.4, z, 0.6, 3, 0.6, gold, STYLE.GLOW, 0, 0, side * 0.35)
    b.add(side * 3.1, base + 8.9, z, 1.4, 0.6, 0.6, gold, STYLE.GLOW)
  }
  b.add(0, base + 10.2, z, 1.4, 1.4, 1.4, '#ffffff', STYLE.GLOW, 0.785, 0.6, 0)
  // The end wall, closing the track off.
  const wz = zAt(trackEnd())
  b.addOn(0, surfaceY(wz, 0) - 1, wz - 2, RIM_X * 2, RIM_H + 6, 4, theme.wall, theme.wallStyle ?? STYLE.BLOCK)
}

// --- Props -------------------------------------------------------------------------

function rock(b, x, y, z, s, color) {
  b.addOn(x, y - 0.3, z, 2.4 * s, 1.6 * s, 2 * s, color, STYLE.STUDS, s * 0.7)
  b.addOn(x + 0.5 * s, y + 0.9 * s, z, 1.3 * s, 0.9 * s, 1.2 * s, color, STYLE.STUDS, s * 1.3)
}

function bush(b, x, y, z, s, color) {
  b.addOn(x, y - 0.2, z, 2.2 * s, 1.3 * s, 2.2 * s, color)
  b.addOn(x + 0.3 * s, y + 0.8 * s, z - 0.2 * s, 1.4 * s, 0.9 * s, 1.4 * s, color)
}

function snowPine(b, x, y, z, s, rand) {
  b.addOn(x, y - 0.3, z, 0.8 * s, 2.7 * s, 0.8 * s, '#6b3f22')
  const green = pick(rand, ['#2d7a45', '#24683a'])
  let top = y + 1.8 * s
  for (const w of [5, 4, 3, 2]) {
    b.addOn(x, top, z, w * s, 1.5 * s, w * s, green)
    b.addOn(x, top + 1.5 * s, z, (w - 0.6) * s, 0.25 * s, (w - 0.6) * s, '#ffffff')
    top += 1.4 * s
  }
}

function snowman(b, x, y, z) {
  b.addOn(x, y - 0.2, z, 2.2, 2.2, 2.2, '#ffffff')
  b.addOn(x, y + 2, z, 1.6, 1.5, 1.6, '#ffffff')
  b.addOn(x, y + 3.5, z, 1.1, 1.1, 1.1, '#ffffff')
  b.addOn(x, y + 3.95, z + 0.75, 0.25, 0.25, 0.6, '#ff8a1e', STYLE.SMOOTH)
  b.addOn(x, y + 4.6, z, 1.3, 0.2, 1.3, '#1d1f24', STYLE.SMOOTH)
  b.addOn(x, y + 4.8, z, 0.8, 0.8, 0.8, '#1d1f24', STYLE.SMOOTH)
}

function iceCrystal(b, x, y, z, s) {
  b.add(x, y + 1.4 * s, z, 1 * s, 3.4 * s, 1 * s, '#9fdcff', STYLE.GLOW, 0.4, 0, 0.25)
  b.add(x + 0.8 * s, y + 0.9 * s, z, 0.7 * s, 2.2 * s, 0.7 * s, '#c9eeff', STYLE.GLOW, 1.1, 0, -0.35)
}

function cactus(b, x, y, z, h, rand) {
  b.addOn(x, y - 0.3, z, 0.9, h + 0.3, 0.9, '#3fa34d')
  const armY = y + h * (0.4 + rand() * 0.2)
  b.addOn(x + 0.9, armY, z, 1, 0.6, 0.6, '#3fa34d')
  b.addOn(x + 1.2, armY, z, 0.6, 1.8, 0.6, '#3fa34d')
  if (rand() < 0.6) {
    b.addOn(x - 0.9, armY + 0.8, z, 1, 0.6, 0.6, '#3fa34d')
    b.addOn(x - 1.2, armY + 0.8, z, 0.6, 1.4, 0.6, '#3fa34d')
  }
  if (rand() < 0.4) b.addOn(x, y + h, z, 0.5, 0.35, 0.5, '#ff6fa8')
}

function pyramid(b, x, y, z, size) {
  for (let i = 0; i < 6; i += 1) {
    const w = size * (1 - i / 6)
    b.addOn(x, y - 1 + i * size * 0.14, z, w, size * 0.14, w, i % 2 ? '#e6be72' : '#dcb162')
  }
}

function volcano(b, x, y, z, size) {
  for (let i = 0; i < 6; i += 1) {
    const w = size * (1 - i / 7.5)
    b.addOn(x, y - 1 + i * size * 0.12, z, w, size * 0.12, w, i % 2 ? '#2f2a2d' : '#3a3337')
  }
  b.addOn(x, y - 1 + size * 0.72, z, size * 0.22, 0.4, size * 0.22, '#ff6a14', STYLE.LAVA)
}

function lavaPool(b, x, y, z, s) {
  b.addOn(x, y - 0.4, z, 5 * s, 0.5, 3.5 * s, '#ff6a14', STYLE.LAVA)
}

function lollipop(b, x, y, z, s, rand) {
  b.addOn(x, y - 0.3, z, 0.3 * s, 4.3 * s, 0.3 * s, '#ffffff', STYLE.SMOOTH)
  const c = pick(rand, ['#ff4f9a', '#4fd2ff', '#ffd23f', '#7dff6a', '#b86bff'])
  b.add(x, y + 4.6 * s, z, 2.6 * s, 2.6 * s, 0.5 * s, c, STYLE.SMOOTH, rand() * 3)
  b.add(x, y + 4.6 * s, z, 1.6 * s, 1.6 * s, 0.6 * s, '#ffffff', STYLE.SMOOTH, rand() * 3)
}

function candyCane(b, x, y, z, s) {
  b.addOn(x, y - 0.3, z, 0.6 * s, 5.3 * s, 0.6 * s, '#ff3b5c', STYLE.STRIPES)
  b.addOn(x + 0.7 * s, y + 5 * s, z, 2 * s, 0.6 * s, 0.6 * s, '#ff3b5c', STYLE.STRIPES)
  b.addOn(x + 1.4 * s, y + 4 * s, z, 0.6 * s, 1.2 * s, 0.6 * s, '#ff3b5c', STYLE.STRIPES)
}

function gumdrop(b, x, y, z, s, rand) {
  const c = pick(rand, ['#7dff9a', '#ff8fd0', '#8fd8ff', '#ffe066'])
  b.addOn(x, y - 0.2, z, 2.4 * s, 1 * s, 2.4 * s, c, STYLE.SMOOTH)
  b.addOn(x, y + 0.8 * s, z, 1.7 * s, 0.8 * s, 1.7 * s, c, STYLE.SMOOTH)
  b.addOn(x, y + 1.6 * s, z, 0.9 * s, 0.5 * s, 0.9 * s, c, STYLE.SMOOTH)
}

function crystal(b, x, y, z, s, rand) {
  const c = pick(rand, ['#c08bff', '#7fe2ff', '#ff7ad9', '#9b6bff'])
  b.add(x, y + 1.8 * s, z, 1.2 * s, 4.2 * s, 1.2 * s, c, STYLE.GLOW, rand() * 3, 0, 0.2)
  b.add(x + 1 * s, y + 1 * s, z + 0.4 * s, 0.8 * s, 2.6 * s, 0.8 * s, c, STYLE.GLOW, rand() * 3, 0, -0.4)
  b.add(x - 0.9 * s, y + 0.8 * s, z - 0.3 * s, 0.7 * s, 2 * s, 0.7 * s, c, STYLE.GLOW, rand() * 3, 0.3, 0.3)
}

/** A moon crater: a low ring of rock round a darker floor. */
function crater(b, x, y, z, s) {
  for (const side of [-1, 1]) {
    b.addOn(x + side * 1.6 * s, y - 0.3, z, 0.8 * s, 0.7 * s, 3.6 * s, '#8a8f99')
    b.addOn(x, y - 0.3, z + side * 1.6 * s, 2.4 * s, 0.7 * s, 0.8 * s, '#8a8f99')
  }
  b.addOn(x, y - 0.35, z, 2.4 * s, 0.4, 2.4 * s, '#5d626b', STYLE.SMOOTH)
}

function planet(b, x, y, z, r, color, ring) {
  b.add(x, y, z, r * 2, r * 1.4, r * 1.4, color, STYLE.GLOW)
  b.add(x, y, z, r * 1.4, r * 2, r * 1.4, color, STYLE.GLOW)
  b.add(x, y, z, r * 1.4, r * 1.4, r * 2, color, STYLE.GLOW)
  if (ring) b.add(x, y, z, r * 3.6, 0.3, r * 3.6, ring, STYLE.GLOW, 0.3, 0.2, 0)
}

/** A jungle tree: a tall trunk under layered dark canopy, vines hanging off it. */
function jungleTree(b, x, y, z, s, rand) {
  b.addOn(x, y - 0.3, z, 0.9 * s, 6 * s, 0.9 * s, '#5a3a22')
  const green = pick(rand, ['#2f7a2a', '#3a8f30', '#25652a'])
  b.addOn(x, y + 5 * s, z, 5.5 * s, 1.6 * s, 5.5 * s, green)
  b.addOn(x + 0.4 * s, y + 6.4 * s, z, 3.6 * s, 1.4 * s, 3.6 * s, green)
  for (const side of [-1, 1]) b.addOn(x + side * 2.2 * s, y + 2.6 * s, z, 0.15, 2.5 * s, 0.15, '#4caa3c')
}

/** A broken stone column of the ruins, moss on its top. */
function ruinPillar(b, x, y, z, h) {
  b.addOn(x, y - 0.3, z, 1.6, 0.5, 1.6, '#8a8470')
  b.addOn(x, y + 0.2, z, 1.2, h, 1.2, '#9a947c')
  b.addOn(x, y + 0.2 + h, z, 1.3, 0.3, 1.3, '#4caa3c')
}

/** A palm tree: a leaning, ringed trunk under a crown of long leaves. */
function palm(b, x, y, z, s, rand) {
  const lean = (rand() - 0.5) * 0.5
  for (let i = 0; i < 6; i += 1) b.addOn(x + lean * i * 0.5 * s, y - 0.3 + i * 0.9 * s, z, 0.6 * s, 0.95 * s, 0.6 * s, i % 2 ? '#a8783e' : '#8f6532')
  const top = y + 5.2 * s
  const tx = x + lean * 3 * s
  for (let k = 0; k < 5; k += 1) b.add(tx, top, z, 3.6 * s, 0.25, 0.9 * s, '#3fbf3a', STYLE.SMOOTH, (k / 5) * Math.PI, 0, 0.35)
  b.add(tx, top - 0.3, z, 0.6 * s, 0.6 * s, 0.6 * s, '#7a4a22', STYLE.SMOOTH)
}

function beachBall(b, x, y, z, s, rand) {
  const c = pick(rand, ['#ff4a4a', '#3fa8ff', '#ffd23f'])
  b.addOn(x, y - 0.2, z, 1.2 * s, 1.2 * s, 1.2 * s, c, STYLE.STRIPES)
}

/** A dead tree: a bare dark trunk with crooked branches. */
function deadTree(b, x, y, z, s, rand) {
  b.addOn(x, y - 0.3, z, 0.7 * s, 5 * s, 0.7 * s, '#2a2230')
  for (let k = 0; k < 3; k += 1) {
    const side = rand() < 0.5 ? -1 : 1
    b.add(x + side * 0.9 * s, y + (2.2 + k * 1.1) * s, z, 1.8 * s, 0.3 * s, 0.3 * s, '#2a2230', STYLE.SMOOTH, rand() * 3, 0, side * 0.5)
  }
}

function pumpkin(b, x, y, z, s) {
  b.addOn(x, y - 0.2, z, 1.6 * s, 1.1 * s, 1.6 * s, '#ff8a1e', STYLE.GLOW)
  b.addOn(x, y + 0.9 * s, z, 0.2 * s, 0.35 * s, 0.2 * s, '#3a6a2a')
}

function gravestone(b, x, y, z, s) {
  b.addOn(x, y - 0.3, z, 1.2 * s, 1.8 * s, 0.35 * s, '#8a8698')
  b.addOn(x, y + 1.5 * s, z, 0.9 * s, 0.3 * s, 0.35 * s, '#8a8698')
}

/** A neon skyscraper: lit windows, neon strips up its corners and round its top. */
function tower(b, x, y, z, s, rand) {
  const h = (14 + rand() * 18) * s
  const w = (4 + rand() * 3) * s
  const neon = pick(rand, ['#ff3fd0', '#2fe8ff', '#b06bff', '#ffe14a'])
  b.addOn(x, y - 1, z, w, h, w, pick(rand, ['#2a2d52', '#22264a', '#30285a']), STYLE.WINDOWS)
  b.addOn(x, y - 1 + h, z, w + 0.3, 0.4, w + 0.3, neon, STYLE.GLOW)
  b.addOn(x - w / 2, y - 1, z - w / 2, 0.25, h, 0.25, neon, STYLE.GLOW)
  b.addOn(x + w / 2, y - 1, z + w / 2, 0.25, h, 0.25, neon, STYLE.GLOW)
}

/** A light pylon by the highway: a dark post with a glowing bar. */
function pylon(b, x, y, z, s, rand) {
  const c = pick(rand, ['#2fe8ff', '#ff3fd0'])
  b.addOn(x, y - 0.3, z, 0.5 * s, 6 * s, 0.5 * s, '#1c2a3e', STYLE.SMOOTH)
  b.addOn(x, y + 5.5 * s, z, 2.4 * s, 0.4 * s, 0.4 * s, c, STYLE.GLOW)
}

/** A floating hologram cube, turned. */
function holo(b, x, y, z, s, rand) {
  const c = pick(rand, ['#2fe8ff', '#ff3fd0', '#7dff9a'])
  b.add(x, y + 4 * s, z, 2 * s, 2 * s, 2 * s, c, STYLE.GLOW, rand() * 3, 0.6, 0.4)
}

/** A factory machine: a block with a chimney, pipes and a conveyor belt beside it. */
function machine(b, x, y, z, s, rand) {
  b.addOn(x, y - 0.3, z, 4 * s, 3 * s, 3 * s, pick(rand, ['#5a606c', '#4a505c']), STYLE.PLATE)
  b.addOn(x + 1.2 * s, y + 2.7 * s, z, 0.9 * s, 3 * s, 0.9 * s, '#3d434e', STYLE.STRIPES)
  b.addOn(x - 2.6 * s, y - 0.3, z, 1.4 * s, 1 * s, 3 * s, '#2a2e36', STYLE.BELT)
  b.addOn(x, y + 2.7 * s, z - 1 * s, 3 * s, 0.5 * s, 0.5 * s, '#ffcc1a', STYLE.GLOW)
}

function crate(b, x, y, z, s) {
  b.addOn(x, y - 0.3, z, 1.4 * s, 1.4 * s, 1.4 * s, '#c9a23a', STYLE.STRIPES)
}

/** A space station module: a white drum with blue solar wings and an antenna. */
function stationModule(b, x, y, z, s) {
  b.addOn(x, y - 0.3, z, 3 * s, 2.4 * s, 3 * s, '#e6ebf2', STYLE.PLATE)
  for (const side of [-1, 1]) b.addOn(x + side * 3.4 * s, y + 0.7 * s, z, 3.4 * s, 0.15 * s, 1.8 * s, '#2f6ad8', STYLE.WINDOWS)
  b.addOn(x, y + 2.1 * s, z, 0.2 * s, 2.4 * s, 0.2 * s, '#cdd3dd', STYLE.SMOOTH)
  b.addOn(x, y + 4.5 * s, z, 0.5 * s, 0.5 * s, 0.5 * s, '#ff4a4a', STYLE.GLOW)
}

/** A Mars habitat dome: a white drum with a glass top. */
function habitat(b, x, y, z, s) {
  b.addOn(x, y - 0.3, z, 4 * s, 1.6 * s, 4 * s, '#eef2f6', STYLE.PLATE)
  b.addOn(x, y + 1.3 * s, z, 3 * s, 1.2 * s, 3 * s, '#9fdcff', STYLE.GLOW)
}

/** An asteroid floating over the ledge. */
function asteroid(b, x, y, z, s, rand) {
  const c = pick(rand, ['#5a5652', '#4a4642', '#6a625a'])
  b.add(x, y + (5 + rand() * 8) * s, z, 3 * s, 2.4 * s, 2.6 * s, c, STYLE.STUDS, rand() * 3, rand(), rand())
  b.add(x + 1.6 * s, y + 3 * s, z, 1.2 * s, 1 * s, 1.1 * s, c, STYLE.STUDS, rand() * 3, rand(), rand())
}

/** A giant toadstool: a pale stem under a wide red cap with white spots. */
function toadstool(b, x, y, z, s, rand) {
  const h = (3.2 + rand() * 2.4) * s
  const cap = pick(rand, ['#ff4f5e', '#ff4f5e', '#ff9a3c', '#b86bff'])
  b.addOn(x, y - 0.3, z, 1 * s, h, 1 * s, '#fff1dc', STYLE.SMOOTH)
  b.addOn(x, y - 0.3 + h, z, 4.4 * s, 0.9 * s, 4.4 * s, cap, STYLE.SMOOTH)
  b.addOn(x, y + 0.6 * s + h, z, 3 * s, 0.6 * s, 3 * s, cap, STYLE.SMOOTH)
  for (const [dx, dz] of [[-1.2, 0.6], [0.9, -0.9], [0.4, 1.3]]) {
    b.addOn(x + dx * s, y + 0.55 * s + h, z + dz * s, 0.7 * s, 0.12 * s, 0.7 * s, '#ffffff', STYLE.SMOOTH)
  }
}

/** A little glowing mushroom by the track. */
function glowShroom(b, x, y, z, s, rand) {
  const c = pick(rand, ['#7fe2ff', '#ff7ad9', '#b6ff6a'])
  b.addOn(x, y - 0.2, z, 0.3 * s, 0.9 * s, 0.3 * s, '#f4f7fb', STYLE.SMOOTH)
  b.addOn(x, y + 0.6 * s, z, 1.1 * s, 0.4 * s, 1.1 * s, c, STYLE.GLOW)
}

/** A rusty barrel leaking glowing green slime. */
function toxicBarrel(b, x, y, z, s) {
  b.addOn(x, y - 0.2, z, 1.2 * s, 1.6 * s, 1.2 * s, '#6a6f3a', STYLE.STRIPES)
  b.addOn(x, y + 1.35 * s, z, 1 * s, 0.12 * s, 1 * s, '#8aff3a', STYLE.GLOW)
  b.addOn(x + 0.9 * s, y - 0.35, z, 1.6 * s, 0.2, 1.2 * s, '#8aff3a', STYLE.GLOW)
}

/** A pool of bubbling slime on the ledge. */
function slimePool(b, x, y, z, s) {
  b.addOn(x, y - 0.4, z, 5 * s, 0.5, 3.5 * s, '#8aff3a', STYLE.WATER)
}

/** A fluffy cloud: three white lumps, turned a little. */
function cloudPuff(b, x, y, z, s, rand) {
  const turn = rand() * 3
  b.add(x, y, z, 5 * s, 1.6 * s, 3 * s, '#ffffff', STYLE.SMOOTH, turn)
  b.add(x + 1.2 * s, y + 0.8 * s, z, 3 * s, 1.6 * s, 2.4 * s, '#ffffff', STYLE.SMOOTH, turn)
  b.add(x - 1.4 * s, y + 0.5 * s, z, 2.4 * s, 1.3 * s, 2 * s, '#f2f7ff', STYLE.SMOOTH, turn)
}

/** A white column with gold at its foot and top, holding up a glowing orb. */
function goldColumn(b, x, y, z, h) {
  b.addOn(x, y - 0.3, z, 1.8, 0.5, 1.8, '#ffd23f', STYLE.SMOOTH)
  b.addOn(x, y + 0.2, z, 1.2, h, 1.2, '#f4f7fb', STYLE.SMOOTH)
  b.addOn(x, y + 0.2 + h, z, 1.7, 0.4, 1.7, '#ffd23f', STYLE.SMOOTH)
  b.add(x, y + 1.1 + h, z, 0.9, 0.9, 0.9, '#fff3a0', STYLE.GLOW, 0.785, 0.6, 0)
}

// --- Scenery -----------------------------------------------------------------------

/**
 * Calls `place(m, side)` along metres [m0, m1) about every `spacing` metres, on one or
 * both sides.
 */
function along(m0, m1, spacing, rand, density, place) {
  for (let m = m0 + spacing * rand(); m < m1; m += spacing * (0.8 + rand() * 0.6)) {
    if (m < DECOR_START || rand() > density) continue
    for (const side of [-1, 1]) if (rand() < 0.85) place(m, side)
  }
}

/** A spot `out` metres beyond the rim at metre m, on the ledge. */
const ledge = (m, side, out) => {
  const z = zAt(m)
  return [side * (RIM_X + out), topY(z, RIM_H), z]
}
/** A spot on the middle step's top at metre m, seen from the track below. */
const step = (m, side) => {
  const z = zAt(m)
  return [(side * (STEPS[1][0] + STEPS[1][1])) / 2, topY(z, STEPS[1][2]), z]
}

const DECOR = {
  grass(b, m0, m1, rand, density) {
    along(m0, m1, 8, rand, density, (m, side) => {
      const [x, y, z] = ledge(m, side, 3 + rand() * 40)
      addTree(b, x, y - 0.3, z, 0.9 + rand() * 0.6, rand)
    })
    along(m0, m1, 16, rand, density, (m, side) => {
      const [x, y, z] = step(m, side)
      if (rand() < 0.5) addTree(b, x, y - 0.3, z, 0.7 + rand() * 0.3, rand)
      else bush(b, x, y, z, 0.8 + rand() * 0.5, '#3fbf3a')
    })
  },
  ice(b, m0, m1, rand, density) {
    along(m0, m1, 7, rand, density, (m, side) => {
      const [x, y, z] = ledge(m, side, 3 + rand() * 40)
      snowPine(b, x, y, z, 0.8 + rand() * 0.6, rand)
    })
    along(m0, m1, 22, rand, density, (m, side) => {
      const [x, y, z] = step(m, side)
      if (rand() < 0.5) snowman(b, x, y, z)
      else iceCrystal(b, x, y, z, 0.8 + rand() * 0.6)
    })
  },
  sand(b, m0, m1, rand, density) {
    along(m0, m1, 8, rand, density, (m, side) => {
      const [x, y, z] = ledge(m, side, 2 + rand() * 30)
      cactus(b, x, y, z, 3 + rand() * 3, rand)
    })
    along(m0, m1, 18, rand, density, (m, side) => {
      const [x, y, z] = step(m, side)
      cactus(b, x, y, z, 2 + rand() * 2, rand)
    })
    along(m0, m1, 60, rand, density, (m, side) => {
      const [x, y, z] = ledge(m, side, 35 + rand() * 25)
      pyramid(b, x, y, z, 16 + rand() * 12)
    })
  },
  volcano(b, m0, m1, rand, density) {
    along(m0, m1, 12, rand, density, (m, side) => {
      const [x, y, z] = ledge(m, side, 2 + rand() * 30)
      rock(b, x, y, z, 0.8 + rand() * 0.8, '#2a2427')
    })
    along(m0, m1, 18, rand, density, (m, side) => {
      const [x, y, z] = ledge(m, side, 4 + rand() * 20)
      lavaPool(b, x, y, z, 0.8 + rand() * 0.6)
    })
    along(m0, m1, 60, rand, density, (m, side) => {
      const [x, y, z] = ledge(m, side, 40 + rand() * 25)
      volcano(b, x, y, z, 20 + rand() * 12)
    })
  },
  candy(b, m0, m1, rand, density) {
    along(m0, m1, 9, rand, density, (m, side) => {
      const [x, y, z] = ledge(m, side, 3 + rand() * 35)
      lollipop(b, x, y, z, 0.9 + rand() * 0.6, rand)
    })
    along(m0, m1, 14, rand, density, (m, side) => {
      const [x, y, z] = step(m, side)
      if (rand() < 0.5) candyCane(b, x, y, z, 0.8 + rand() * 0.3)
      else gumdrop(b, x, y, z, 0.8 + rand() * 0.6, rand)
    })
  },
  crystal(b, m0, m1, rand, density) {
    along(m0, m1, 8, rand, density, (m, side) => {
      const [x, y, z] = ledge(m, side, 2 + rand() * 35)
      crystal(b, x, y, z, 0.8 + rand() * 0.8, rand)
    })
    along(m0, m1, 16, rand, density, (m, side) => {
      const [x, y, z] = step(m, side)
      crystal(b, x, y, z, 0.6 + rand() * 0.4, rand)
    })
  },
  jungle(b, m0, m1, rand, density) {
    along(m0, m1, 7, rand, density, (m, side) => {
      const [x, y, z] = ledge(m, side, 3 + rand() * 40)
      jungleTree(b, x, y, z, 0.9 + rand() * 0.6, rand)
    })
    along(m0, m1, 16, rand, density, (m, side) => {
      const [x, y, z] = step(m, side)
      if (rand() < 0.5) ruinPillar(b, x, y, z, 2 + rand() * 3)
      else bush(b, x, y, z, 0.8 + rand() * 0.5, '#2f7a2a')
    })
  },
  beach(b, m0, m1, rand, density) {
    along(m0, m1, 9, rand, density, (m, side) => {
      const [x, y, z] = ledge(m, side, 2 + rand() * 30)
      palm(b, x, y, z, 0.9 + rand() * 0.5, rand)
    })
    along(m0, m1, 18, rand, density, (m, side) => {
      const [x, y, z] = step(m, side)
      beachBall(b, x, y, z, 0.8 + rand() * 0.6, rand)
    })
  },
  spooky(b, m0, m1, rand, density) {
    along(m0, m1, 9, rand, density, (m, side) => {
      const [x, y, z] = ledge(m, side, 2 + rand() * 30)
      deadTree(b, x, y, z, 0.9 + rand() * 0.6, rand)
    })
    along(m0, m1, 12, rand, density, (m, side) => {
      const [x, y, z] = step(m, side)
      if (rand() < 0.5) pumpkin(b, x, y, z, 0.8 + rand() * 0.6)
      else gravestone(b, x, y, z, 0.8 + rand() * 0.4)
    })
  },
  mushroom(b, m0, m1, rand, density) {
    along(m0, m1, 8, rand, density, (m, side) => {
      const [x, y, z] = ledge(m, side, 3 + rand() * 35)
      toadstool(b, x, y, z, 0.9 + rand() * 0.6, rand)
    })
    along(m0, m1, 10, rand, density, (m, side) => {
      const [x, y, z] = step(m, side)
      glowShroom(b, x, y, z, 0.8 + rand() * 0.5, rand)
    })
  },
  swamp(b, m0, m1, rand, density) {
    along(m0, m1, 9, rand, density, (m, side) => {
      const [x, y, z] = ledge(m, side, 2 + rand() * 30)
      deadTree(b, x, y, z, 0.9 + rand() * 0.6, rand)
    })
    along(m0, m1, 16, rand, density, (m, side) => {
      const [x, y, z] = ledge(m, side, 4 + rand() * 20)
      slimePool(b, x, y, z, 0.8 + rand() * 0.6)
    })
    along(m0, m1, 14, rand, density, (m, side) => {
      const [x, y, z] = step(m, side)
      toxicBarrel(b, x, y, z, 0.8 + rand() * 0.3)
    })
  },
  cloud(b, m0, m1, rand, density) {
    along(m0, m1, 8, rand, density, (m, side) => {
      const [x, y, z] = ledge(m, side, 4 + rand() * 40)
      cloudPuff(b, x, y + 1 + rand() * 6, z, 0.9 + rand() * 0.8, rand)
    })
    along(m0, m1, 16, rand, density, (m, side) => {
      const [x, y, z] = step(m, side)
      goldColumn(b, x, y, z, 2.5 + rand() * 1.5)
    })
  },
  neon(b, m0, m1, rand, density) {
    along(m0, m1, 12, rand, density, (m, side) => {
      const [x, y, z] = ledge(m, side, 6 + rand() * 40)
      tower(b, x, y, z, 0.8 + rand() * 0.6, rand)
    })
  },
  cyber(b, m0, m1, rand, density) {
    along(m0, m1, 10, rand, density, (m, side) => {
      const [x, y, z] = ledge(m, side, 2 + rand() * 20)
      pylon(b, x, y, z, 0.9 + rand() * 0.4, rand)
    })
    along(m0, m1, 16, rand, density, (m, side) => {
      const [x, y, z] = ledge(m, side, 10 + rand() * 30)
      holo(b, x, y, z, 0.8 + rand() * 0.8, rand)
    })
  },
  factory(b, m0, m1, rand, density) {
    along(m0, m1, 12, rand, density, (m, side) => {
      const [x, y, z] = ledge(m, side, 4 + rand() * 30)
      machine(b, x, y, z, 0.8 + rand() * 0.5, rand)
    })
    along(m0, m1, 14, rand, density, (m, side) => {
      const [x, y, z] = step(m, side)
      crate(b, x, y, z, 0.8 + rand() * 0.5)
    })
  },
  station(b, m0, m1, rand, density) {
    along(m0, m1, 14, rand, density, (m, side) => {
      const [x, y, z] = ledge(m, side, 5 + rand() * 35)
      stationModule(b, x, y, z, 0.8 + rand() * 0.5)
    })
  },
  mars(b, m0, m1, rand, density) {
    along(m0, m1, 10, rand, density, (m, side) => {
      const [x, y, z] = ledge(m, side, 2 + rand() * 30)
      rock(b, x, y, z, 0.8 + rand() * 0.8, '#9a4a2a')
    })
    along(m0, m1, 30, rand, density, (m, side) => {
      const [x, y, z] = ledge(m, side, 12 + rand() * 25)
      habitat(b, x, y, z, 0.8 + rand() * 0.5)
    })
  },
  asteroid(b, m0, m1, rand, density) {
    along(m0, m1, 9, rand, density, (m, side) => {
      const [x, y, z] = ledge(m, side, 3 + rand() * 40)
      asteroid(b, x, y, z, 0.8 + rand() * 0.8, rand)
    })
    along(m0, m1, 16, rand, density, (m, side) => {
      const [x, y, z] = step(m, side)
      crater(b, x, y, z, 0.5 + rand() * 0.3)
    })
  },
  galaxy(b, m0, m1, rand, density) {
    along(m0, m1, 9, rand, density, (m, side) => {
      const [x, y, z] = ledge(m, side, 2 + rand() * 35)
      crystal(b, x, y, z, 0.8 + rand() * 0.8, rand)
    })
    if (rand() < 0.7 * density) {
      const m = m0 + rand() * CHUNK
      const z = zAt(m)
      const color = pick(rand, ['#ff7ad9', '#7fe2ff', '#ffb14a', '#9b6bff'])
      planet(b, (rand() < 0.5 ? -1 : 1) * (60 + rand() * 40), topY(z, RIM_H) + 20 + rand() * 30, z, 6 + rand() * 8, color, '#ffe45c')
    }
  },
  moon(b, m0, m1, rand, density) {
    along(m0, m1, 10, rand, density, (m, side) => {
      const [x, y, z] = ledge(m, side, 3 + rand() * 40)
      crater(b, x, y, z, 0.8 + rand() * 0.8)
    })
    along(m0, m1, 16, rand, density, (m, side) => {
      const [x, y, z] = step(m, side)
      rock(b, x, y, z, 0.6 + rand() * 0.4, '#8a8f99')
    })
    if (rand() < 0.5 * density) {
      const m = m0 + rand() * CHUNK
      const z = zAt(m)
      const color = pick(rand, ['#ff7ad9', '#7fe2ff', '#ffb14a', '#9b6bff'])
      planet(b, (rand() < 0.5 ? -1 : 1) * (70 + rand() * 40), topY(z, RIM_H) + 25 + rand() * 30, z, 6 + rand() * 6, color, rand() < 0.5 ? '#ffe45c' : null)
    }
  },
}

/**
 * Builds chunk `index` (metres [index*CHUNK, (index+1)*CHUNK)).
 * @param {{ density?: number }} options 0-1 scenery density (quality)
 */
export function buildChunk(index, { density = 1 } = {}) {
  const b = new BlockSet()
  const rand = mulberry32(index * 7919 + 13)
  const m0 = index * CHUNK
  const m1 = Math.min(m0 + CHUNK, trackEnd())
  if (m0 >= trackEnd()) return b
  // The first chunk stands beside the lobby's mountains; past it the ledges run out wide.
  const wide = index > 0

  // Split the chunk at the bends, so each part is all slope or all flat, in its own colours.
  const cuts = [m0, ...bends().filter((m) => m > m0 && m < m1), m1]

  for (let i = 0; i < cuts.length - 1; i += 1) {
    const a = cuts[i]
    const c = cuts[i + 1]
    const mid = (a + c) / 2
    const kind = mid > TRACK_LENGTH ? 'summit' : isSlope(mid) ? 'slope' : 'safe'
    // A checkpoint looks like the stage whose tape it is past; a slope like its own.
    const stage = STAGES[kind === 'safe' ? stageAt(mid) - 1 : stageAt(mid)]
    walls(b, a, c, STAGE_THEMES[stage.id], wide, kind)
    DECOR[stage.id](b, a, c, rand, density)
  }

  for (let i = 1; i < STAGES.length; i += 1) {
    if (safeStart(i) >= m0 && safeStart(i) < m1) safezone(b, i)
  }
  if (TRACK_LENGTH >= m0 && TRACK_LENGTH < m1) summit(b, STAGE_THEMES[STAGES[STAGES.length - 1].id])
  return b
}

/** Every chunk there is. */
export const chunkCount = () => Math.ceil(trackEnd() / CHUNK)
