import { Color } from 'three'

import { TRACK_HALF_WIDTH } from '@shared/world'

import { STAGE_THEMES } from './themes'

/**
 * The brick walls across the end of every stage: their size, their bricks, and their
 * colours. Pure data, worked out once at load, shared by the walls themselves (Walls.jsx),
 * the track's pillars either side of them (track.js) and the chips that fly off them
 * (pushControl). Nothing here allocates after load.
 */

/** Bricks across a whole row, and rows up the wall. */
export const WALL_COLS = 7
export const WALL_ROWS = 9
/** Wall size: across the floor between its pillars, up, and thick. */
export const WALL_SPAN = TRACK_HALF_WIDTH * 2 - 0.5
export const WALL_HALF_SPAN = WALL_SPAN / 2
export const BRICK_L = WALL_SPAN / WALL_COLS
export const BRICK_H = 0.42
export const BRICK_D = 0.5
/** Floor to top: taller than the fattest belly (a 1.8 m body drawn 1.6x at its fattest). */
export const WALL_HEIGHT = WALL_ROWS * BRICK_H
/** Each brick is drawn this much smaller than its cell, so the mortar shows between them. */
export const BRICK_GAP = 0.92

/**
 * Every brick of a wall, laid in running bond: whole bricks on even rows, and on odd
 * rows a half brick at each end with whole ones between. `x` across the middle of the
 * floor, `y` its middle above the floor, `len` its length. Built once.
 */
function layBricks() {
  const x = []
  const y = []
  const len = []
  for (let row = 0; row < WALL_ROWS; row += 1) {
    const mid = (row + 0.5) * BRICK_H
    if (row % 2 === 0) {
      for (let col = 0; col < WALL_COLS; col += 1) {
        x.push(-WALL_HALF_SPAN + (col + 0.5) * BRICK_L)
        y.push(mid)
        len.push(BRICK_L)
      }
    } else {
      x.push(-WALL_HALF_SPAN + BRICK_L / 4)
      y.push(mid)
      len.push(BRICK_L / 2)
      for (let col = 1; col < WALL_COLS; col += 1) {
        x.push(-WALL_HALF_SPAN + BRICK_L / 2 + (col - 0.5) * BRICK_L)
        y.push(mid)
        len.push(BRICK_L)
      }
      x.push(WALL_HALF_SPAN - BRICK_L / 4)
      y.push(mid)
      len.push(BRICK_L / 2)
    }
  }
  return { x: Float32Array.from(x), y: Float32Array.from(y), len: Float32Array.from(len) }
}

export const BRICKS = layBricks()
export const BRICK_COUNT = BRICKS.x.length

/**
 * A wall's looks: its own bricks (NORMAL); gold, the very last wall (GOLD); too strong
 * for the Fat you have, steel-reinforced dark (LOCKED); and the flash of the bricks a
 * belly's slamming into (HIT).
 */
export const LOOK = { NORMAL: 0, GOLD: 1, LOCKED: 2, HIT: 3 }
/** Shades per look: four brick tints, then the mortar between them. */
export const SHADES = 4
export const MORTAR = SHADES

const STEEL = new Color('#363b48')
const WHITE = new Color('#ffffff')
const BLACK = new Color('#000000')
const GOLD = new Color('#ffcf3a')

/** Four tints of `base` (a little lighter, as is, darker, warmer) and its mortar. */
function tints(base) {
  const warm = new Color(base).offsetHSL(0.015, 0.05, -0.04)
  return [
    new Color(base).lerp(WHITE, 0.12),
    new Color(base),
    new Color(base).lerp(BLACK, 0.16),
    warm,
    new Color(base).lerp(BLACK, 0.55).lerp(WHITE, 0.08),
  ]
}

/** By stage id: [look][shade] colours (shade MORTAR is the mortar). */
const SHADE_TABLE = new Map(
  Object.entries(STAGE_THEMES).map(([id, theme]) => {
    const base = new Color(theme.brick ?? '#d9583b')
    const normal = tints(base)
    const gold = tints(GOLD)
    const locked = normal.map((c) => c.clone().lerp(STEEL, 0.62))
    const hit = normal.map((c) => c.clone().lerp(WHITE, 0.45))
    return [id, [normal, gold, locked, hit]]
  }),
)
const FALLBACK = SHADE_TABLE.get('grass')

/** The colour of shade `shade` of look `look` for stage `stageId`'s wall. Shared: never modify. */
export const wallShade = (stageId, look, shade) => (SHADE_TABLE.get(stageId) ?? FALLBACK)[look][shade]

const CHIPS = new Map([...SHADE_TABLE].map(([id, looks]) => [id, looks[LOOK.NORMAL].slice(0, SHADES)]))
/** Stage `stageId`'s brick tints, for the chips flying off its wall. Shared: never modify. */
export const chipColors = (stageId) => CHIPS.get(stageId) ?? CHIPS.get('grass')

const PILLARS = new Map([...SHADE_TABLE].map(([id, looks]) => [id, `#${looks[LOOK.NORMAL][2].clone().lerp(STEEL, 0.35).getHexString()}`]))
/** The pillars either side of stage `stageId`'s wall: stone in a darker shade of its bricks. */
export const pillarColor = (stageId) => PILLARS.get(stageId) ?? PILLARS.get('grass')
