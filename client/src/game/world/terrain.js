import { PALETTE } from '../sceneStyle'

/**
 * A tall blocky pine: the scenery down the arena track's grassy stages plants these
 * (the lobby itself is a city now: skyline.js).
 */

/**
 * Adds a tall blocky pine standing on `base`: a trunk and five stacked tiers narrowing to
 * a point, as in the reference.
 *
 * @param {import('../blocks').BlockSet} blocks
 * @param {() => number} rand
 * @param {{ leaves: string[], trunk: string }} [colors] defaults to the day palette's
 */
export function addTree(blocks, x, base, z, scale = 1, rand = Math.random, colors = PALETTE) {
  const s = scale
  const trunk = 2.6 * s
  blocks.addOn(x, base, z, 0.9 * s, trunk, 0.9 * s, colors.trunk)

  const greens = colors.leaves
  const green = greens[Math.floor(rand() * greens.length)]
  const tiers = [5.2, 4.3, 3.4, 2.5, 1.6]
  let y = base + trunk - 0.4 * s
  for (const width of tiers) {
    const w = width * s
    blocks.addOn(x, y, z, w, 1.6 * s, w, green)
    y += 1.35 * s
  }
  blocks.addOn(x, y, z, 0.8 * s, 1.1 * s, 0.8 * s, green)
}

