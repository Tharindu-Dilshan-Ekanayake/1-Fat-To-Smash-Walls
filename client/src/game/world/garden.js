import { CylinderGeometry } from 'three'

import { EGG_STANDS } from '@shared/world'

import { STYLE } from '../materials'
import { LAWNS } from './lawns'
import { flowerBed } from './structures'

/**
 * The plaza's greenery, set out in rows on the kerbed lawns (lawns.js) rather than
 * scattered: low flower clumps on the lawns beside the walkway near spawn and between it
 * and the food shop (nothing tall there: they'd hide the Food Courts and the shop from
 * spawn), in a row along the strips either side of the walk down to the egg plaza and
 * along the lawn in front of the leaderboards, a flower bed between each pair of egg
 * stands, a tree on each lawn further up the walkway, and trees on the lawns in the far
 * corners. None of it is solid, and none of it stands on a path. In
 * `palette`'s colours (palette.js).
 */

/** A round, bushy tree: a trunk and tiers of leaves turned an eighth apart. */
export function roundTree(blocks, x, z, s, k, palette) {
  const green = palette.leaves[k % palette.leaves.length]
  blocks.addOn(x, 0, z, 0.55 * s, 2.0 * s, 0.55 * s, palette.trunk, STYLE.STUDS)
  blocks.addOn(x, 1.7 * s, z, 2.8 * s, 1.9 * s, 2.8 * s, green, STYLE.STUDS, 0.785 * (k % 2))
  blocks.addOn(x, 3.3 * s, z, 2.0 * s, 1.3 * s, 2.0 * s, green, STYLE.STUDS, 0.785 * ((k + 1) % 2))
  blocks.addOn(x, 4.5 * s, z, 1.0 * s, 0.7 * s, 1.0 * s, green, STYLE.STUDS, 0.785 * (k % 2))
}

/** A leafy tuft with a few flowers round it. */
function flowerClump(blocks, x, z, k, palette, detail) {
  blocks.addOn(x, 0, z, 0.9, 0.35, 0.9, palette.leaves[k % palette.leaves.length], STYLE.STUDS, 0.785 * (k % 2))
  const count = detail ? 4 : 2
  for (let i = 0; i < count; i += 1) {
    const a = k * 1.7 + (i * Math.PI * 2) / count
    blocks.add(x + Math.cos(a) * 0.6, 0.3, z + Math.sin(a) * 0.6, 0.3, 0.3, 0.3, palette.flowers[(i + k) % palette.flowers.length], palette.flowerStyle, a, 0.4)
  }
}

/** Evenly along a lawn's long middle line, `count` points kept `margin` in from its ends. */
function along(lawn, count, margin = 1.5) {
  const x0 = lawn.minX + margin
  const x1 = lawn.maxX - margin
  const z = (lawn.minZ + lawn.maxZ) / 2
  return Array.from({ length: count }, (_, i) => [count === 1 ? (x0 + x1) / 2 : x0 + ((x1 - x0) * i) / (count - 1), z])
}

export function buildGarden(blocks, props, { detail = true, palette } = {}) {
  const round = { small: new CylinderGeometry(1, 1, 1, 16) }
  const [avenueW, avenueE, stripW, stripE, boards, corner, falls, upW, upE, shop, behindHut, behindStatue] = LAWNS

  // Flower clumps down the lawns either side of the avenue, framing the way up to the square.
  for (const [k, lawn] of [avenueW, avenueE].entries()) {
    const x = (lawn.minX + lawn.maxX) / 2
    for (const z of [lawn.minZ + 1.5, lawn.maxZ - 1.5]) flowerClump(blocks, x, z, k + (z > lawn.minZ + 2 ? 2 : 0), palette, detail)
  }

  // Flower clumps in rows along the strips beside the walk down to the egg plaza, and
  // along the lawn in front of the leaderboards (low: they hide nothing).
  along(stripW, 4).forEach(([x, z], k) => flowerClump(blocks, x, z, k, palette, detail))
  along(stripE, 2).forEach(([x, z], k) => flowerClump(blocks, x, z, k + 1, palette, detail))
  along(boards, 7).forEach(([x, z], k) => flowerClump(blocks, x, z, k + 2, palette, detail))
  along(shop, 3).forEach(([x, z], k) => flowerClump(blocks, x, z, k + 4, palette, detail))
  // A tree on each lawn further up the walkway, with a clump either side of it.
  for (const [k, lawn] of [upW, upE].entries()) {
    const [[x0, z], [x, zm], [x1]] = along(lawn, 3)
    roundTree(blocks, x, zm, 0.95, k + 1, palette)
    flowerClump(blocks, x0, z, k + 3, palette, detail)
    flowerClump(blocks, x1, z, k + 5, palette, detail)
  }

  // A flower bed between each pair of egg stands, on the band they stand on.
  const row = [...EGG_STANDS].sort((a, b) => a.x - b.x)
  for (let i = 0; i < row.length - 1; i += 1) {
    const a = row[i]
    const b = row[i + 1]
    // Clear of the big egg's wings.
    const x = b.big ? b.x - 5.6 : (a.x + b.x) / 2
    flowerBed(blocks, props, round, x, (a.z + b.z) / 2 - 0.3, 1.1, i + 1, detail, palette)
  }

  // Trees behind the food shop's hut and behind the champion's square, framing them.
  const [hx, hz0, hz1] = [(behindHut.minX + behindHut.maxX) / 2, behindHut.minZ + 2.5, behindHut.maxZ - 2.5]
  for (let k = 0; k < 3; k += 1) roundTree(blocks, hx + (k % 2 ? 1.2 : -1.2), hz0 + ((hz1 - hz0) * k) / 2, 1.05, k, palette)
  along(behindStatue, 2, 2.5).forEach(([x, z], k) => roundTree(blocks, x, z, 1.0, k + 1, palette))

  // Trees in a row on the lawns in the far corners: behind the Sphinx, and by the waterfall.
  along(corner, 3, 4).forEach(([x, z], k) => roundTree(blocks, x, z, 1, k, palette))
  along(falls, 1).forEach(([x, z]) => roundTree(blocks, x, z, 1.1, 2, palette))

  round.small.dispose()
}
