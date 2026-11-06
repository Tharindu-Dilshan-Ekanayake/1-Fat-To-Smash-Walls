import { CylinderGeometry } from 'three'

import { EGG_STANDS, FREE_REWARD, SPHINX_STAND } from '@shared/world'

import { STYLE } from '../materials'
import { turned } from './structures'

/**
 * Egg stands: a blue-and-white pedestal ringed in light, plus the big Demon Egg's dark
 * plinth (with its horns and wings) and the Sphinx showcase. Each faces its `yaw` (out
 * over the plaza): a glowing step on the front, the Demon's wings spread either
 * side. Blocks and merged props, riding along in the world's existing draw calls; the
 * eggs themselves float above in EggDisplays.
 */

/** Each stand's light ring, in its egg's colour. */
const RING = { basic: '#7fe2ff', meadow: '#5cff6a', sunset: '#ffb347', unicorn: '#ff9cf4' }

/** Height of an egg's centre above the ground. */
export const eggHeight = (stand) => (stand.big ? 3.4 : 2.6)

export function buildEggStands(blocks, props) {
  for (const stand of EGG_STANDS) {
    const { x, z, yaw } = stand
    const at = turned(x, z, yaw)
    if (stand.big) {
      // Demon Egg: dark stepped plinth with a glowing rim, horns and bat wings.
      blocks.addOn(x, 0, z, 4.2, 0.7, 4.2, '#24141f', STYLE.STUDS, yaw)
      blocks.addOn(x, 0.7, z, 3.6, 0.35, 3.6, '#ff3b1e', STYLE.LAVA, yaw)
      blocks.addOn(x, 1.05, z, 3.2, 0.3, 3.2, '#3a1a2a', STYLE.STUDS, yaw)
      const [sx, sz] = at(0, 2.35)
      blocks.addOn(sx, 0, sz, 2.6, 0.35, 0.5, '#ff3b1e', STYLE.GLOW, yaw)
      const y = eggHeight(stand)
      for (const side of [-1, 1]) {
        const [hx, hz] = at(side * 0.7, 0)
        props.box(hx, y + 1.95, hz, 0.35, 1.1, 0.35, '#1d1d24', STYLE.SMOOTH, [0, yaw, side * -0.45])
        const [wx, wz] = at(side * 1.85, -0.3)
        props.box(wx, y + 0.5, wz, 1.6, 0.9, 0.12, '#a8162a', STYLE.STUDS, [0, yaw + side * 0.3, side * 0.45])
        const [tx, tz] = at(side * 2.45, -0.45)
        props.box(tx, y + 1.05, tz, 1.0, 0.6, 0.12, '#7a0f1f', STYLE.STUDS, [0, yaw + side * 0.3, side * 0.8])
      }
      continue
    }
    // An octagonal pedestal (two squares turned an eighth apart): a blue base, a band of
    // light in the egg's colour, a white plinth, and a glowing cushion the egg floats
    // over; a glowing step at its front.
    const ring = RING[stand.eggId] || RING.basic
    for (const turn of [0, Math.PI / 4]) {
      blocks.addOn(x, 0, z, 3.4, 0.42, 3.4, '#2f7fe6', STYLE.STUDS, yaw + turn)
      blocks.addOn(x, 0.42, z, 3.1, 0.12, 3.1, ring, STYLE.GLOW, yaw + turn)
      blocks.addOn(x, 0.54, z, 2.8, 0.34, 2.8, '#f4f7fb', STYLE.SMOOTH, yaw + turn)
    }
    blocks.addOn(x, 0.88, z, 1.3, 0.1, 1.3, ring, STYLE.GLOW, yaw + Math.PI / 4)
    const [sx, sz] = at(0, 2.05)
    blocks.addOn(sx, 0, sz, 1.8, 0.22, 0.55, ring, STYLE.GLOW, yaw)
    // Gold posts with glowing tips at four of its corners.
    for (const su of [-1, 1]) {
      for (const sw of [-1, 1]) {
        const [px, pz] = at(su * 1.2, sw * 1.2)
        blocks.addOn(px, 0.42, pz, 0.22, 0.9, 0.22, '#ffd21f', STYLE.SMOOTH, yaw)
        blocks.add(px, 1.42, pz, 0.3, 0.3, 0.3, ring, STYLE.GLOW, yaw + 0.785, 0.6, 0)
      }
    }
  }

  // Free Reward stand by spawn; its crab is drawn by RewardCrab.
  blocks.addOn(FREE_REWARD.x, 0, FREE_REWARD.z, 3, 0.6, 3, '#6a1420')
  blocks.addOn(FREE_REWARD.x, 0.6, FREE_REWARD.z, 2.6, 0.3, 2.6, '#ff3b3b', STYLE.GLOW)
  blocks.addOn(FREE_REWARD.x, 0.9, FREE_REWARD.z, 2.2, 0.2, 2.2, '#f4f7fb')

  // Sphinx showcase plinth: round, gold-trimmed and taller, a glowing step at its front
  // (towards the plaza). The pet itself is added by SphinxShowcase.
  const { x, z, yaw } = SPHINX_STAND
  const drum = new CylinderGeometry(1, 1, 1, 24)
  props.add(drum, { position: [x, 0.4, z], scale: [3, 0.8, 3], color: '#2f6fe0', style: STYLE.STUDS })
  props.add(drum, { position: [x, 1.05, z], scale: [2.75, 0.5, 2.75], color: '#ffcf3a', style: STYLE.GLOW })
  props.add(drum, { position: [x, 1.5, z], scale: [2.45, 0.4, 2.45], color: '#f4f7fb' })
  drum.dispose()
  const [sx, sz] = turned(x, z, yaw)(0, 3.25)
  blocks.addOn(sx, 0, sz, 3, 0.35, 0.7, '#ffcf3a', STYLE.GLOW, yaw)
}
