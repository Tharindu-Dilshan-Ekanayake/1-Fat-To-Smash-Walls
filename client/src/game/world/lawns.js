import { mulberry32 } from '@shared/rng'

import { STYLE } from '../materials'

/**
 * The kerbed lawns, laid out in the blocks the paths leave (see ground.js), framing them
 * in pairs rather than dotted about: either side of the walkway just north of spawn and
 * again further up between the streets (kerbs and all clear of WALKWAY), a strip each
 * side of the walk from spawn to the egg plaza, one between the walkway and the food
 * shop, one behind the egg stands in front of the leaderboards, one behind the Sphinx,
 * one by the waterfall, and ones behind the food shop and the champion's square. The ground map paints the grass (and a dirt patch on the bigger ones);
 * the kerbs are blocks in the world's one block set. All rects are on whole units, so
 * their edges fall on the ground map's texels.
 */
export const LAWNS = [
  // Either side of the walkway, just north of spawn.
  { minX: -9, maxX: -6, minZ: -5, maxZ: 1 },
  { minX: 6, maxX: 9, minZ: -5, maxZ: 1 },
  // Between the cross street and the egg plaza, west and east of the walk.
  { minX: -21, maxX: -5, minZ: 11, maxZ: 13 },
  { minX: 11, maxX: 16, minZ: 11, maxZ: 13 },
  // Behind the egg stands, in front of the leaderboards.
  { minX: -18, maxX: 18, minZ: 25, maxZ: 28 },
  // Behind the Sphinx, in the south-east corner.
  { minX: 21, maxX: 44, minZ: 29, maxZ: 33 },
  // By the waterfall, east of the portal.
  { minX: 38, maxX: 44, minZ: -32, maxZ: -25 },
  // Either side of the walkway between the two streets crossing it further up.
  { minX: -21, maxX: -10, minZ: -21, maxZ: -17 },
  { minX: 10, maxX: 21, minZ: -21, maxZ: -17 },
  // Between the walkway and the food shop, south of the street to its counter.
  { minX: 11, maxX: 19, minZ: -7, maxZ: -2 },
  // Behind the food shop's hut, and behind the champion's square: trees as a backdrop.
  { minX: 36, maxX: 44, minZ: -21, maxZ: -4 },
  { minX: 33, maxX: 44, minZ: 1, maxZ: 11 },
]

/** Kerb height and width: low enough to step over. */
const CURB_H = 0.16
const CURB_W = 0.7

/**
 * A dirt patch or so inside each of the bigger lawns, the same everywhere (seeded):
 * rects in world units, kept a little in from the edges.
 */
export const DIRT_PATCHES = LAWNS.flatMap((lawn, i) => {
  const rand = mulberry32(31 + i * 17)
  const w = lawn.maxX - lawn.minX
  const d = lawn.maxZ - lawn.minZ
  const count = Math.round((w * d) / 90)
  return Array.from({ length: count }, () => {
    const pw = Math.min(w - 2, 2 + Math.floor(rand() * 4))
    const pd = Math.max(1, Math.min(d - 2, 2 + Math.floor(rand() * 3)))
    const x = Math.floor(lawn.minX + 1 + rand() * Math.max(0, w - pw - 2))
    const z = Math.floor(lawn.minZ + 1 + rand() * Math.max(0, d - pd - 2))
    return { minX: x, maxX: x + pw, minZ: z, maxZ: z + pd }
  })
})

/** The kerbs round every lawn, in `palette`'s kerb colour. */
export function buildLawnCurbs(blocks, palette) {
  for (const l of LAWNS) {
    const w = l.maxX - l.minX
    const d = l.maxZ - l.minZ
    const cx = (l.minX + l.maxX) / 2
    const cz = (l.minZ + l.maxZ) / 2
    for (const side of [-1, 1]) {
      blocks.addOn(cx, 0, cz + side * (d / 2 + CURB_W / 2), w + CURB_W * 2, CURB_H, CURB_W, palette.curb, STYLE.STUDS)
      blocks.addOn(cx + side * (w / 2 + CURB_W / 2), 0, cz, CURB_W, CURB_H, d, palette.curb, STYLE.STUDS)
    }
  }
}
