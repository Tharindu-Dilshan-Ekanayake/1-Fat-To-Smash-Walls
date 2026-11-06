import { STYLE } from '../materials'
import { LAWNS } from './lawns'

/**
 * The demolition yards either side of the SMASH LANE, a way up it from spawn: on each, a
 * little brick wall and a wrecking ball hanging from a steel gantry behind it. The ball
 * swings in and the wall bursts towards the lane, then the bricks fly back together and
 * it goes again (CityLife.jsx animates it all; the gantry is static, in the world's block
 * set: buildDemoYards).
 *
 * Each wall stands across its yard (along x), facing the lane's side of the plaza
 * (south, towards spawn); the ball comes from behind it (north).
 */

const [, , , , , , , YARD_W, YARD_E] = LAWNS

/** Bricks across and rows up, and a brick's size. */
export const DEMO_COLS = 6
export const DEMO_ROWS = 6
export const DEMO_BRICK = { l: 0.8, h: 0.4, d: 0.45 }
export const DEMO_WIDTH = DEMO_COLS * DEMO_BRICK.l
/** The ball's size (it's three crossed cubes this big), cable length, and gantry height. */
export const BALL = 1.25
export const BALL_REACH = 0.85
export const CABLE = 5.2
export const GANTRY_H = 7.3

const yard = (lawn, color, phase) => {
  const x = (lawn.minX + lawn.maxX) / 2
  const z = lawn.maxZ - 1.2
  // Hanging straight down, the ball just touches the wall's back.
  const pivotZ = z - DEMO_BRICK.d / 2 - BALL_REACH
  return { x, z, pivotZ, color, phase }
}

/** The two yards: west and east of the lane, the east one half a beat behind. */
export const DEMO_WALLS = [yard(YARD_W, '#d9583b', 0), yard(YARD_E, '#e0a25e', 3.5)]

/**
 * Every brick of a demo wall in running bond: across from its middle, and its middle's
 * height. Built once.
 */
export const DEMO_BRICKS = (() => {
  const list = []
  for (let row = 0; row < DEMO_ROWS; row += 1) {
    const y = (row + 0.5) * DEMO_BRICK.h
    const half = DEMO_WIDTH / 2
    if (row % 2 === 0) {
      for (let c = 0; c < DEMO_COLS; c += 1) list.push({ x: -half + (c + 0.5) * DEMO_BRICK.l, y, l: DEMO_BRICK.l })
    } else {
      list.push({ x: -half + DEMO_BRICK.l / 4, y, l: DEMO_BRICK.l / 2 })
      for (let c = 1; c < DEMO_COLS; c += 1) list.push({ x: -half + c * DEMO_BRICK.l, y, l: DEMO_BRICK.l })
      list.push({ x: half - DEMO_BRICK.l / 4, y, l: DEMO_BRICK.l / 2 })
    }
  }
  return list
})()

/** A traffic cone: orange, a white band, on a dark foot. */
export function cone(blocks, x, z) {
  blocks.addOn(x, 0, z, 0.62, 0.08, 0.62, '#2c303a', STYLE.SMOOTH)
  blocks.addOn(x, 0.08, z, 0.42, 0.34, 0.42, '#ff6a1a', STYLE.SMOOTH, 0.785)
  blocks.addOn(x, 0.42, z, 0.32, 0.14, 0.32, '#ffffff', STYLE.SMOOTH, 0.785)
  blocks.addOn(x, 0.56, z, 0.22, 0.3, 0.22, '#ff6a1a', STYLE.SMOOTH, 0.785)
}

/** The yards' gantries, plinths and cones, in `palette`'s crane colours. */
export function buildDemoYards(blocks, palette) {
  for (const wall of DEMO_WALLS) {
    const { x, z, pivotZ } = wall
    // The wall's plinth.
    blocks.addOn(x, 0, z, DEMO_WIDTH + 0.6, 0.12, DEMO_BRICK.d + 0.6, '#8d93a0', STYLE.SMOOTH)
    // The gantry: hazard-striped legs, a beam across the top, feet on the ground.
    for (const side of [-1, 1]) {
      const px = x + side * (DEMO_WIDTH / 2 + 0.9)
      blocks.addOn(px, 0, pivotZ, 0.9, 0.2, 1.6, palette.craneDark, STYLE.SMOOTH)
      blocks.addOn(px, 0.2, pivotZ, 0.42, GANTRY_H - 0.2, 0.42, palette.crane, STYLE.HAZARD)
      // A brace leaning in from behind.
      blocks.add(px, GANTRY_H / 2, pivotZ - 1.2, 0.26, GANTRY_H * 0.96, 0.26, palette.crane, STYLE.SMOOTH, 0, 0.33)
    }
    blocks.addOn(x, GANTRY_H, pivotZ, DEMO_WIDTH + 2.4, 0.5, 0.55, palette.crane, STYLE.SMOOTH)
    blocks.add(x, GANTRY_H + 0.25, pivotZ, DEMO_WIDTH + 1.6, 0.12, 0.6, '#fff3b0', STYLE.CHASE)
    // Cones round the yard.
    for (const side of [-1, 1]) {
      cone(blocks, x + side * (DEMO_WIDTH / 2 + 2.1), z + 0.9)
      cone(blocks, x + side * (DEMO_WIDTH / 2 + 2.1), pivotZ - 1.2)
    }
  }
}
