import { CylinderGeometry, Euler, Matrix4, Quaternion, SphereGeometry, Vector3 } from 'three'

import { AURAS } from '@shared/balance'
import { AURA_STAND, FOOD_HUT, POTION_STAND, STATUE, WALKWAY } from '@shared/world'

import { flexingBodybuilder } from '../fatBody'
import { addFoodToProps, foodGeometry, foodSize } from '../food'
import { STYLE, toyBreathe } from '../materials'
import { PALETTE } from '../sceneStyle'

/**
 * Static lobby structures, added as plain boxes to the world's shared BlockSet so they
 * render in the same single draw call as the mountains (and a few merged props, in the
 * world's one prop mesh): the food shop's hut, the champion's square round the statue,
 * the aura and potion stands, and the statue itself. (The Food Courts are in
 * foodCourts.js, the trees and flower beds round the plaza in garden.js.)
 */

const STONE_TOP = '#b9c2cc'
const SLATE = '#3b4658'
const GOLD = '#ffd21f'
const LAMP_POST = '#3a4150'

/** Round things for the prop mesh, made per build and disposed after. */
function roundParts() {
  return {
    /** A 24-sided drum: radius 1, 1 tall, centred. */
    drum: new CylinderGeometry(1, 1, 1, 24),
    /** A 16-sided drum, for smaller round things. */
    small: new CylinderGeometry(1, 1, 1, 16),
    ball: new SphereGeometry(1, 10, 8),
    dispose() {
      this.drum.dispose()
      this.small.dispose()
      this.ball.dispose()
    },
  }
}

/** Places a part of something turned `yaw` about (x, z): local (u across, w forward) -> world [x, z]. */
export const turned = (x, z, yaw) => (u, w) => [x + u * Math.cos(yaw) + w * Math.sin(yaw), z - u * Math.sin(yaw) + w * Math.cos(yaw)]

const _q = new Quaternion()
const _qTilt = new Quaternion()
const _euler = new Euler()
const _x = new Vector3(1, 0, 0)
const _y = new Vector3(0, 1, 0)

/**
 * Adds a box turned `yaw` about y and then tipped `tilt` about its own across axis (an
 * awning sloping down to its front): BlockSet takes rotations in X, Y, Z order, so the
 * pair is turned into that order here. Build time only.
 */
export function addTipped(blocks, x, y, z, sx, sy, sz, color, style, yaw, tilt) {
  _q.setFromAxisAngle(_y, yaw).multiply(_qTilt.setFromAxisAngle(_x, tilt))
  _euler.setFromQuaternion(_q, 'XYZ')
  blocks.add(x, y, z, sx, sy, sz, color, style, _euler.y, _euler.x, _euler.z)
}

// --- The food shop hut ----------------------------------------------------------------

const AWNING_RED = '#e8322f'
const AWNING_WHITE = '#fff6ec'
const HUT_WALL = '#ffd27a'
const HUT_TRIM = '#fff6ec'
const HUT_WOOD = '#8a5a2e'
const HUT_ROOF = '#e8322f'

/** Which way the hut's counter faces: the plaza, west (yaw, 0 = +z). */
const HUT_YAW = -Math.PI / 2
/** A spot of the hut in its own terms - `u` across its front, `w` out in front of its middle - in the world: [x, z]. */
const onHut = turned(FOOD_HUT.x, FOOD_HUT.z, HUT_YAW)
/** Heights: the floor's top, the walls' top (where the roof sits), the roof's top. */
const HUT_FLOOR = 0.3
const HUT_WALL_TOP = 3.6
const HUT_ROOF_TOP = 3.95

/**
 * The FOOD SHOP sign on the hut's roof, facing the plaza: its board's face middle, its
 * size and the way it faces (yaw, 0 = +z). signs.js paints the words on it.
 */
export const SHOP_SIGN = (() => {
  const [x, z] = onHut(0, FOOD_HUT.half - 0.2)
  return { x, y: HUT_ROOF_TOP + 1.15, z, width: 6.2, height: 1.9, yaw: HUT_YAW }
})()

/** The foods on show on the counter, left to right as you face it. */
const COUNTER_FOODS = ['cookie', 'fries', 'donut', 'cake']

/**
 * A string of bunting from (x0, y0, z0) to (x1, y1, z1), sagging `sag` in the middle:
 * a few straight lengths of cord, and little diamond flags in turn of colours hung
 * along it, every `every` units.
 */
function bunting(blocks, [x0, y0, z0], [x1, y1, z1], sag, every, k) {
  const dx = x1 - x0
  const dz = z1 - z0
  const run = Math.hypot(dx, dz)
  const yaw = Math.atan2(dx, dz)
  const at = (t) => [x0 + dx * t, y0 + (y1 - y0) * t - sag * 4 * t * (1 - t), z0 + dz * t]
  const pieces = 4
  for (let p = 0; p < pieces; p += 1) {
    const [ax, ay, az] = at(p / pieces)
    const [bx, by, bz] = at((p + 1) / pieces)
    const len = Math.hypot(bx - ax, by - ay, bz - az)
    // The cord: a thin box along it, its slope a tip about its across axis.
    addTipped(blocks, (ax + bx) / 2, (ay + by) / 2, (az + bz) / 2, 0.04, 0.04, len + 0.02, '#f4f7fb', STYLE.SMOOTH, yaw, -Math.atan2(by - ay, Math.hypot(bx - ax, bz - az)))
  }
  const flags = Math.max(2, Math.round(run / every))
  for (let f = 1; f < flags; f += 1) {
    const [fx, fy, fz] = at(f / flags)
    // A diamond hanging off the cord, in the cord's own upright plane.
    blocks.add(fx, fy - 0.2, fz, 0.3, 0.3, 0.03, BUNTING[(f + k) % BUNTING.length], STYLE.SMOOTH, yaw + Math.PI / 2, 0, Math.PI / 4)
  }
}

const BUNTING = ['#e8322f', '#ffd21f', '#2f7fe6', '#3ad646', '#ff5fa8', '#ffffff']

/** A lantern on a wooden post: a warm glowing box under a little red roof. */
function lantern(blocks, x, z, light) {
  blocks.addOn(x, 0, z, 0.38, 0.25, 0.38, '#5a3418', STYLE.SMOOTH)
  blocks.addOn(x, 0.25, z, 0.16, 3.55, 0.16, HUT_WOOD, STYLE.SMOOTH)
  blocks.add(x, 3.6, z, 0.48, 0.58, 0.48, light, STYLE.GLOW)
  blocks.add(x, 3.98, z, 0.68, 0.16, 0.68, AWNING_RED, STYLE.SMOOTH, Math.PI / 4)
}

/** A wooden planter of flowers, turned `yaw`. */
function planter(blocks, x, z, yaw, palette, k, detail) {
  blocks.addOn(x, 0, z, 1.0, 0.55, 1.0, '#b0743c', STYLE.SMOOTH, yaw)
  blocks.addOn(x, 0.55, z, 0.86, 0.4, 0.86, palette.leaves[k % palette.leaves.length], STYLE.STUDS, yaw + 0.785)
  for (let i = 0; i < (detail ? 4 : 2); i += 1) {
    const a = yaw + k + (i * Math.PI) / 2
    blocks.add(x + Math.cos(a) * 0.3, 1.02, z + Math.sin(a) * 0.3, 0.24, 0.24, 0.24, palette.flowers[(i + k) % palette.flowers.length], palette.flowerStyle, a, 0.4)
  }
}

/**
 * The food shop: one cheerful hut on the right of the plaza, its serving counter open to
 * the plaza (west) - sunny walls with white corner posts on a wooden deck, a striped
 * awning over the counter on two posts, the counter's front in pink and white stripes,
 * foods on show on plates along its top, shelves and a menu board inside; on the roof a
 * big glowing FOOD SHOP board facing the plaza and a giant burger bobbing behind it;
 * planters either side of the counter, a lantern either side of the welcome mat in
 * front, bunting from the roof out to the lanterns, crates round the side. Only the hut itself is solid (FOOD_HUT); walking up to the counter
 * (FOOD_COUNTER) opens the shop. Lantern light in `palette`'s lamp colours.
 */
export function buildFoodHut(blocks, props, { detail = true, palette, decor = null } = {}) {
  const h = FOOD_HUT.half
  const yaw = HUT_YAW
  const box = (u, base, w, su, sy, sw, color, style = STYLE.SMOOTH, turn = 0) => {
    const [x, z] = onHut(u, w)
    blocks.addOn(x, base, z, su, sy, sw, color, style, yaw + turn)
  }
  const round = roundParts()

  // The deck and the floor.
  box(0, 0, 0, h * 2 + 0.6, HUT_FLOOR, h * 2 + 0.6, HUT_WOOD, STYLE.SMOOTH)
  box(0, HUT_FLOOR - 0.04, 0, h * 2 - 0.2, 0.06, h * 2 - 0.2, '#f6ead2', STYLE.TILES)
  // The walls: the back and both sides, and the lintel over the counter's opening.
  const wallH = HUT_WALL_TOP - HUT_FLOOR
  box(0, HUT_FLOOR, -h + 0.15, h * 2 - 0.3, wallH, 0.3, HUT_WALL, STYLE.STUDS)
  for (const side of [-1, 1]) box(side * (h - 0.15), HUT_FLOOR, 0, 0.3, wallH, h * 2 - 0.3, HUT_WALL, STYLE.STUDS)
  box(0, HUT_WALL_TOP - 0.7, h - 0.15, h * 2 - 0.3, 0.7, 0.3, HUT_WALL, STYLE.STUDS)
  // White corner posts and a white band along the walls' top.
  for (const su of [-1, 1]) for (const sw of [-1, 1]) box(su * (h - 0.1), 0, sw * (h - 0.1), 0.45, HUT_WALL_TOP + 0.05, 0.45, HUT_TRIM, STYLE.SMOOTH)
  box(0, HUT_WALL_TOP - 0.2, h - 0.02, h * 2 + 0.1, 0.18, 0.12, HUT_TRIM)
  // A round window in each side wall (a glowing pane in a white frame).
  for (const side of [-1, 1]) {
    box(side * (h + 0.02), 1.7, -0.3, 0.1, 1.2, 1.2, HUT_TRIM)
    box(side * (h + 0.06), 1.8, -0.3, 0.08, 1.0, 1.0, '#9fe8ff', STYLE.GLOW)
  }

  // The roof: a red slab overhanging all round, white along its edge, a scalloped valance.
  box(0, HUT_WALL_TOP, 0, h * 2 + 1.0, HUT_ROOF_TOP - HUT_WALL_TOP, h * 2 + 1.0, HUT_ROOF, STYLE.STUDS)
  box(0, HUT_ROOF_TOP, 0, h * 2 + 1.1, 0.08, h * 2 + 1.1, HUT_TRIM)
  // (Round the back and sides: the awning hangs off the front.)
  const scallops = 8
  const len = (h * 2 + 0.8) / scallops - 0.1
  for (let s = 0; s < scallops; s += 1) {
    const t = -h - 0.4 + ((h * 2 + 0.8) * (s + 0.5)) / scallops
    const color = s % 2 ? AWNING_WHITE : AWNING_RED
    box(t, HUT_WALL_TOP - 0.25, -h - 0.52, len, 0.28, 0.05, color)
    for (const side of [-1, 1]) box(side * (h + 0.52), HUT_WALL_TOP - 0.25, t, 0.05, 0.28, len, color)
  }

  // The serving counter across the open front: striped front, a light top.
  const cw = h - 0.75
  box(0, HUT_FLOOR, cw, h * 2 - 0.9, 1.05, 0.8, '#ffffff')
  const stripes = 6
  for (let s = 0; s < stripes; s += 1) {
    const u = -h + 0.45 + ((h * 2 - 0.9) * (s + 0.5)) / stripes
    box(u, HUT_FLOOR + 0.05, cw + 0.42, (h * 2 - 0.9) / stripes - 0.02, 0.95, 0.04, s % 2 ? '#fff6ec' : '#ff5fa8')
  }
  const top = HUT_FLOOR + 1.05
  box(0, top, cw, h * 2 - 0.7, 0.12, 1.0, '#f4ead8')
  // The foods on show on their plates, a little turned this way and that, gently bobbing.
  COUNTER_FOODS.forEach((id, i) => {
    const u = -2.25 + i * 1.5
    const [px, pz] = onHut(u, cw)
    for (const turn of [0, Math.PI / 4]) blocks.addOn(px, top + 0.12, pz, 1.0, 0.05, 1.0, i % 2 ? '#ffd21f' : '#ff9ccf', STYLE.GLOW, turn)
    const scale = 3.1
    const drop = -foodGeometry(id).boundingBox.min.y * foodSize(id) * scale
    later(decor, props, (p) => addFoodToProps(p, id, { position: [px, top + 0.2 + drop, pz], yaw: yaw + (i - 1.5) * 0.25, lean: 0.15, scale, anim: [i * 1.3, 0.05] }))
  })
  // Inside: shelves of jars along the back wall, and a menu board over them.
  box(0, 1.6, -h + 0.5, h * 2 - 1.2, 0.08, 0.5, HUT_WOOD)
  box(0, 0.9 + HUT_FLOOR, -h + 0.5, h * 2 - 1.2, 0.08, 0.5, HUT_WOOD)
  if (detail) {
    ;['#ff6fa8', '#ffd447', '#4fc3ff', '#7dff6a', '#ff8a5c', '#c27bff'].forEach((jar, i) => {
      const u = -h + 1.1 + i * ((h * 2 - 2.2) / 5)
      box(u, 1.68, -h + 0.5, 0.32, 0.4 + (i % 2) * 0.12, 0.32, jar)
      box(u + 0.3, 0.98 + HUT_FLOOR, -h + 0.5, 0.4, 0.3, 0.3, BUNTING[(i + 2) % BUNTING.length])
    })
  }
  box(0, 2.2, -h + 0.32, 3.6, 1.1, 0.06, '#2b3140')
  for (let k = 0; k < 3; k += 1) box(-0.4 + (k % 2) * 0.2, 2.45 + k * 0.28, -h + 0.36, 2.4 - k * 0.4, 0.1, 0.04, ['#ffd21f', '#7fe2ff', '#ff8ac0'][k], STYLE.GLOW)

  // The awning over the counter: red and white stripes from the lintel down and out, a
  // scalloped edge, on two posts.
  const awningOut = 2.0
  const yBack = HUT_WALL_TOP - 0.1
  const yFront = yBack - 0.6
  const tilt = Math.atan2(yBack - yFront, awningOut)
  const length = Math.hypot(awningOut, yBack - yFront) + 0.1
  const awningStripes = 8
  const aw = (h * 2 + 0.6) / awningStripes
  for (let s = 0; s < awningStripes; s += 1) {
    const u = -h - 0.3 + aw * (s + 0.5)
    const [ax, az] = onHut(u, h + awningOut / 2)
    addTipped(blocks, ax, (yBack + yFront) / 2, az, aw, 0.08, length, s % 2 ? AWNING_WHITE : AWNING_RED, STYLE.SMOOTH, yaw, tilt)
    box(u, yFront - 0.36, h + awningOut + 0.02, aw - 0.1, 0.34, 0.05, s % 2 ? AWNING_RED : AWNING_WHITE)
  }
  for (const side of [-1, 1]) box(side * (h + 0.2), 0, h + awningOut - 0.1, 0.16, yFront - 0.05, 0.16, HUT_TRIM)

  // The sign board on the roof's front, in a glowing gold frame, bulbs along its top; and
  // the giant burger on its stand behind it.
  const { y: sy, width: sw, height: shh } = SHOP_SIGN
  const signW = h - 0.2
  for (const side of [-1, 1]) box(side * (sw / 2 - 0.4), HUT_ROOF_TOP, signW - 0.25, 0.22, sy - shh / 2 - HUT_ROOF_TOP + 0.2, 0.22, HUT_TRIM)
  {
    const [bx, bz] = onHut(0, signW - 0.18)
    blocks.add(bx, sy, bz, sw + 0.36, shh + 0.36, 0.22, '#ffd21f', STYLE.GLOW, yaw)
    const [fx, fz] = onHut(0, signW - 0.1)
    blocks.add(fx, sy, fz, sw, shh, 0.2, '#3b2a5a', STYLE.SMOOTH, yaw)
  }
  if (detail) {
    for (let k = -3; k <= 3; k += 1) {
      const [lx, lz] = onHut(k * 0.95, signW - 0.12)
      blocks.add(lx, sy + shh / 2 + 0.3, lz, 0.2, 0.2, 0.2, k % 2 ? '#ffffff' : AWNING_RED, STYLE.GLOW, yaw + 0.785, 0.6, 0)
    }
  }
  const [gx, gz] = onHut(0, -0.9)
  // Its stand holds it clear over the sign: a white pole, a glowing gold plate.
  const plate = SHOP_SIGN.y + SHOP_SIGN.height / 2 + 0.1
  props.add(round.drum, { position: [gx, (HUT_ROOF_TOP + plate) / 2, gz], scale: [0.35, plate - HUT_ROOF_TOP, 0.35], color: HUT_TRIM })
  props.add(round.drum, { position: [gx, plate, gz], scale: [1.15, 0.14, 1.15], color: '#ffd21f', style: STYLE.GLOW })
  const scale = 9
  const drop = -foodGeometry('burger').boundingBox.min.y * foodSize('burger') * scale
  later(decor, props, (p) => addFoodToProps(p, 'burger', { position: [gx, plate + 0.1 + drop, gz], yaw, lean: 0.12, scale, anim: [0.6, 0.3] }))

  // Planters either side of the counter, lanterns either side of the welcome mat, a rug
  // on the mat, and bunting from the roof's front corners out to the lanterns.
  for (const side of [-1, 1]) planter(blocks, ...onHut(side * (h + 0.95), h + 0.3), yaw, palette, side > 0 ? 1 : 2, detail)
  const light = palette.night ? palette.lamps : ['#ffcf6a', '#ffcf6a']
  const mat = h + awningOut + 1.6
  const lanterns = [-1, 1].map((side) => onHut(side * (h + 1.3), mat + 0.6))
  lanterns.forEach(([lx, lz], k) => lantern(blocks, lx, lz, light[k % 2]))
  box(0, 0, h + 1.1, 2.6, 0.03, 1.3, AWNING_RED)
  box(0, 0, h + 1.1, 2.2, 0.04, 0.9, '#ffd27a', STYLE.STUDS)
  ;[-1, 1].forEach((side, k) => {
    const [rx, rz] = onHut(side * (h + 0.5), h + 0.5)
    const [lx, lz] = lanterns[k]
    bunting(blocks, [rx, HUT_ROOF_TOP - 0.1, rz], [lx, 3.85, lz], 0.45, detail ? 0.6 : 1.0, k)
  })

  // Crates of produce along its south side.
  if (detail) {
    ;['#ff4a3b', '#ffb03b', '#7dff6a'].forEach((fruit, i) => {
      const [cx, cz] = onHut(h + 0.75, 1.6 - i * 1.3)
      blocks.addOn(cx, 0, cz, 0.9, 0.55, 0.75, '#b0743c', STYLE.SMOOTH, yaw + 0.15 * i)
      blocks.addOn(cx, 0.55, cz, 0.78, 0.14, 0.62, fruit, STYLE.STUDS, yaw + 0.15 * i)
    })
  }
  round.dispose()
}

// --- The champion's square --------------------------------------------------------------

/**
 * The champion's square round the statue: how far its round paving reaches (ground.js
 * paints it).
 */
export const SQUARE_RADIUS = 6.5
/** Which way the statue faces: west, down the cross street to spawn (yaw, 0 = +z). */
const STATUE_YAW = -Math.PI / 2
/** The statue's plinth: its tiers' tops, bottom up, and the top tier's radius. */
const PLINTH = { step: 0.25, drum: 1.05, band: 1.19, top: 1.54, cap: 1.66 }
/**
 * The CHAMPION EATER name plate on the front of the plinth: its face middle, size and
 * the way it faces. signs.js paints the words on it.
 */
export const STATUE_PLATE = (() => {
  const [x, z] = turned(STATUE.x, STATUE.z, STATUE_YAW)(0, STATUE.radius + 0.17)
  return { x, y: (PLINTH.step + PLINTH.drum) / 2, z, width: 3.0, height: 0.62, yaw: STATUE_YAW }
})()
/** The giant foods on pedestals flanking the walkway, a way up it: how far either side of its middle, and where. */
const GIANT_FOODS = { x: WALKWAY.maxX + 2.9, z: -19 }

/** A park bench facing `yaw`: wooden slats on dark legs, a backrest behind. */
function parkBench(blocks, x, z, yaw, color, legs = LAMP_POST) {
  const at = turned(x, z, yaw)
  for (const u of [-0.95, 0.95]) {
    const [lx, lz] = at(u, 0)
    blocks.addOn(lx, 0, lz, 0.14, 0.42, 0.6, legs, STYLE.SMOOTH, yaw)
    const [bx, bz] = at(u, -0.3)
    blocks.addOn(bx, 0.42, bz, 0.12, 0.55, 0.1, legs, STYLE.SMOOTH, yaw)
  }
  const [sx, sz] = at(0, 0)
  blocks.addOn(sx, 0.42, sz, 2.3, 0.1, 0.62, color, STYLE.SMOOTH, yaw)
  const [rx, rz] = at(0, -0.31)
  blocks.addOn(rx, 0.72, rz, 2.3, 0.36, 0.08, color, STYLE.SMOOTH, yaw)
}

/** The day palette's flower-bed colours, for callers that don't pass a palette. */
const DAY_BED = {
  bed: '#d9e2ec',
  lawn: PALETTE.lawn,
  leaves: PALETTE.leaves,
  flowers: ['#ff5a7a', '#ffe14a', '#ff9a3c', '#c27bff', '#ffffff', '#4fc3ff'],
  flowerStyle: STYLE.SMOOTH,
}

/**
 * A round flower bed in `palette`'s colours (palette.js): a stone kerb, a mound of
 * grass, a bush in the middle and flowers round it. Kerb and mound go in the prop mesh,
 * the rest in blocks.
 */
export function flowerBed(blocks, props, round, x, z, radius, k, detail, palette = DAY_BED) {
  props.add(round.small, { position: [x, 0.15, z], scale: [radius, 0.3, radius], color: palette.bed })
  props.add(round.small, { position: [x, 0.18, z], scale: [radius - 0.18, 0.36, radius - 0.18], color: palette.lawn })
  blocks.addOn(x, 0.36, z, radius * 0.75, radius * 0.55, radius * 0.75, palette.leaves[k % 3], STYLE.STUDS, 0.785 * k)
  const count = detail ? 7 : 4
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * Math.PI * 2 + k
    const r = radius * 0.68
    blocks.add(x + Math.cos(a) * r, 0.5, z + Math.sin(a) * r, 0.3, 0.3, 0.3, palette.flowers[(i + k) % palette.flowers.length], palette.flowerStyle, a, 0.4)
  }
}

/** A street lamp: a dark post on a base, a glowing lantern, a little roof. */
export function streetLamp(blocks, x, z, light = '#fff3b0', post = LAMP_POST) {
  blocks.addOn(x, 0, z, 0.5, 0.3, 0.5, post, STYLE.SMOOTH)
  blocks.addOn(x, 0.3, z, 0.2, 3.1, 0.2, post, STYLE.SMOOTH)
  blocks.add(x, 3.7, z, 0.5, 0.6, 0.5, light, STYLE.GLOW, 0.785)
  blocks.add(x, 4.08, z, 0.72, 0.14, 0.72, '#2b2f38', STYLE.SMOOTH, 0.785)
}

/**
 * Decoration that can wait: with `decor` (World's queue), `fn(builder)` runs later, after
 * the game's playable, adding to the builder then; without it, now, into `props`.
 */
function later(decor, props, fn) {
  if (decor) decor.later(fn)
  else fn(props)
}

/** A giant food on a round pedestal, facing `yaw`: decoration on the lawns. */
function giantFood(blocks, props, round, x, z, id, yaw, color, decor = null) {
  props.add(round.small, { position: [x, 0.5, z], scale: [1.3, 1.0, 1.3], color: '#f4f7fb' })
  props.add(round.small, { position: [x, 1.08, z], scale: [1.45, 0.16, 1.45], color, style: STYLE.GLOW })
  const scale = 8
  const drop = -foodGeometry(id).boundingBox.min.y * foodSize(id) * scale
  later(decor, props, (p) => addFoodToProps(p, id, { position: [x, 1.16 + drop, z], yaw, lean: 0.1, scale, anim: [x, 0.35] }))
}

/**
 * The champion's square, beside spawn on the right at the end of the cross street: a
 * lamp at each diagonal, two benches behind the statue facing it, a ring of flowers
 * round the plinth (open at its front, where the name plate is). And the giant donut
 * and cupcake on pedestals either side of the walkway, a way up it, turned to it.
 * Nothing here stands on the walkway, and nothing is solid but the statue's plinth.
 * In `palette`'s colours (palette.js).
 */
export function buildTownSquare(blocks, props, { detail = true, palette, decor = null } = {}) {
  const { x, z } = STATUE
  const round = roundParts()
  const front = turned(x, z, STATUE_YAW)
  for (let k = 0; k < 4; k += 1) {
    const a = Math.PI / 4 + (k * Math.PI) / 2
    streetLamp(blocks, x + Math.cos(a) * (SQUARE_RADIUS - 0.9), z + Math.sin(a) * (SQUARE_RADIUS - 0.9), palette.lamps[k % 2], palette.lampPost)
  }
  // Benches behind the statue, facing it.
  for (const side of [-1, 1]) {
    const [bx, bz] = front(side * 2.6, -4.3)
    parkBench(blocks, bx, bz, STATUE_YAW + Math.PI - side * 0.55, side > 0 ? '#ff6a3d' : '#2f7fe6', palette.lampPost)
  }
  // Flowers round the plinth, leaving its front (the name plate) clear.
  const ring = STATUE.radius + 1.1
  for (let k = 0; k < 10; k += 1) {
    const a = (k + 0.5) * ((Math.PI * 2) / 10)
    const [fx, fz] = front(Math.sin(a) * ring, Math.cos(a) * ring)
    if (Math.cos(a) > 0.55) continue
    blocks.addOn(fx, 0, fz, 0.7, 0.32, 0.7, palette.leaves[k % palette.leaves.length], STYLE.STUDS, a)
    for (let i = 0; i < (detail ? 2 : 1); i += 1) {
      const b = a + (i ? 0.25 : -0.25)
      const [px, pz] = front(Math.sin(b) * (ring + 0.1), Math.cos(b) * (ring + 0.1))
      blocks.add(px, 0.42, pz, 0.26, 0.26, 0.26, palette.flowers[(k + i) % palette.flowers.length], palette.flowerStyle, b, 0.4)
    }
  }
  // The giant foods flanking the walkway, turned to it and a little towards spawn.
  giantFood(blocks, props, round, -GIANT_FOODS.x, GIANT_FOODS.z, 'donut', Math.PI / 2 - 0.35, '#ff7eb6', decor)
  giantFood(blocks, props, round, GIANT_FOODS.x, GIANT_FOODS.z, 'cupcake', -Math.PI / 2 + 0.35, '#ff6fa8', decor)
  round.dispose()
}


/** An aura on show: a white pedestal, a glowing plate on it, and the aura's orb with a bright core. */
function auraOrb(blocks, x, base, z, color) {
  blocks.addOn(x, base, z, 0.66, 0.95, 0.66, '#f4f7fb', STYLE.SMOOTH)
  blocks.addOn(x, base + 0.95, z, 0.86, 0.12, 0.86, '#c79bff', STYLE.GLOW)
  blocks.add(x, base + 1.65, z, 0.78, 0.78, 0.78, color, STYLE.GLOW, 0.785, 0.6, 0)
  blocks.add(x, base + 1.65, z, 0.5, 0.5, 0.5, '#ffffff', STYLE.GLOW, 0, 0.785, 0.6)
}

const AURA_PURPLE = '#5b2fb0'
const AURA_TRIM = '#c79bff'

/**
 * The aura store, a booth: a glowing-edged octagonal floor; a purple backdrop with a
 * lit trim and a great crystal on it, between two pillars topped with gold; every aura
 * on show on its own pedestal in front of it; and the counter you buy at. And the
 * potion stand: two tall glowing tubes, yellow and pink, in white frames.
 */
export function buildStands(blocks) {
  {
    const { x, z } = AURA_STAND
    const floor = 0.22
    // The floor: two squares turned an eighth apart, edged with light.
    for (const turn of [0, Math.PI / 4]) {
      blocks.addOn(x, 0, z, 7.9, 0.14, 7.9, AURA_TRIM, STYLE.GLOW, turn)
      blocks.addOn(x, 0, z, 7.6, floor, 7.6, '#3b2a74', STYLE.STUDS, turn)
    }
    // The backdrop and its pillars.
    const back = z - 3.5
    blocks.addOn(x, floor, back, 7.4, 4.4, 0.5, AURA_PURPLE, STYLE.STUDS)
    blocks.addOn(x, floor + 4.4, back, 7.6, 0.25, 0.7, AURA_TRIM, STYLE.GLOW)
    blocks.add(x, floor + 3, back + 0.3, 1.3, 1.3, 0.2, '#e8d8ff', STYLE.GLOW, 0, 0, Math.PI / 4)
    for (const side of [-1, 1]) {
      blocks.addOn(x + side * 3.95, 0, back, 0.9, floor + 5, 0.9, '#7a4ad8', STYLE.STUDS)
      blocks.add(x + side * 3.95, floor + 5.5, back, 0.8, 0.8, 0.8, '#ffd21f', STYLE.GLOW, 0.785, 0.6, 0)
    }
    // Every aura on show, in a row before the backdrop.
    const auras = Object.values(AURAS)
    auras.forEach((aura, i) => auraOrb(blocks, x + (i - (auras.length - 1) / 2) * 1.3, floor, z - 2.4, aura.color))
    // The counter.
    blocks.addOn(x, floor, z - 1.2, 5.6, 0.85, 1.3, AURA_PURPLE, STYLE.STUDS)
    blocks.addOn(x, floor + 0.85, z - 1.2, 5.9, 0.16, 1.6, AURA_TRIM, STYLE.GLOW)
  }
  {
    const { x, z } = POTION_STAND
    const tx = x - 1.2
    blocks.addOn(tx, 0, z, 2.2, 0.5, 5.4, '#e6edf5', STYLE.STUDS)
    for (const [dz, color] of [
      [-1.25, '#ffe14a'],
      [1.25, '#ff8fe0'],
    ]) {
      blocks.addOn(tx, 0.5, z + dz, 1.5, 0.35, 1.5, '#9aa4b0', STYLE.SMOOTH)
      blocks.addOn(tx, 0.85, z + dz, 1.2, 3.4, 1.2, color, STYLE.GLOW)
      blocks.addOn(tx, 4.25, z + dz, 1.5, 0.35, 1.5, '#9aa4b0', STYLE.SMOOTH)
      // A bottle standing inside, and the white frame round the tube.
      blocks.addOn(tx, 1.6, z + dz, 0.5, 0.9, 0.5, '#ffffff', STYLE.GLOW)
      for (const corner of [-1, 1]) blocks.addOn(tx + corner * 0.68, 0.85, z + dz + 0.68, 0.12, 3.4, 0.12, '#ffffff', STYLE.SMOOTH)
    }
    // Pipes joining them overhead.
    blocks.addOn(tx, 4.6, z, 0.3, 0.3, 3, '#ffd21f', STYLE.GLOW)
  }
}

const SKIN = '#f3e7dc'
const SHIRT = '#ff6a3d'
const SHORTS = '#2f7fe6'
const BELT = '#5a3a1e'
const CHEF_WHITE = '#ffffff'
const RIBBON = '#e8322f'
const HAIR = '#a8541f'
const CHEEK = '#ff9aa8'
const SHOE = '#f4f7fb'

/** The statue's size against the avatar it's modelled on (6.4 units tall). */
const STATUE_SCALE = 1.1

/**
 * The sideways and front-back reach of `geometry`'s vertices between heights y0 and y1
 * (avatar units), or null if none are there. Measured, not assumed, so the belt and shoes
 * fit whatever shape the body has.
 */
function sliceExtent(geometry, y0, y1) {
  const pos = geometry.getAttribute('position')
  let found = false
  const r = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity }
  for (let i = 0; i < pos.count; i += 1) {
    const y = pos.getY(i)
    if (y < y0 || y > y1) continue
    found = true
    r.minX = Math.min(r.minX, pos.getX(i))
    r.maxX = Math.max(r.maxX, pos.getX(i))
    r.minZ = Math.min(r.minZ, pos.getZ(i))
    r.maxZ = Math.max(r.maxZ, pos.getZ(i))
  }
  return found ? r : null
}

/**
 * The front of `geometry` down its middle (|x| < halfWidth), from y0 up to y1 in `bands`
 * steps: [y, z] of the frontmost vertex in each band that has one, bottom up.
 */
function frontLine(geometry, y0, y1, bands, halfWidth) {
  const pos = geometry.getAttribute('position')
  const best = Array.from({ length: bands }, () => null)
  for (let i = 0; i < pos.count; i += 1) {
    const y = pos.getY(i)
    if (y < y0 || y > y1 || Math.abs(pos.getX(i)) > halfWidth) continue
    const band = Math.min(bands - 1, Math.floor(((y - y0) / (y1 - y0)) * bands))
    if (!best[band] || pos.getZ(i) > best[band][1]) best[band] = [y, pos.getZ(i)]
  }
  return best.filter(Boolean)
}

/**
 * Where a frontLine is at height y: its z there, and `tilt`, the X rotation that lays
 * something flat along it (its up following the surface). Null if y is off the line.
 */
function frontAt(line, y) {
  for (let i = 0; i < line.length - 1; i += 1) {
    const [y0, z0] = line[i]
    const [y1, z1] = line[i + 1]
    if (y < y0 || y > y1 || y1 - y0 < 1e-6) continue
    return { z: z0 + ((y - y0) / (y1 - y0)) * (z1 - z0), tilt: Math.atan2(z1 - z0, y1 - y0) }
  }
  return null
}

/**
 * The champion eater's statue, flexing both arms: the players' own rounded body at its
 * biggest (fatBody) - an orange tee with a gold medal on the chest, a belt round the
 * belly, blue shorts, white shoes and a chef's hat - breathing in and out, on a tiered
 * round plinth: a broad step on a ring of light, a marble drum with a gold-framed
 * CHAMPION EATER plaque on its front (signs.js paints the words), a glowing gold band, a
 * stone top tier and a gold cap. Faces west, down the cross street to spawn. Its body
 * and plinth go in `props` (merged, one draw call); the blocky head in `blocks`.
 */
export function buildStatue(blocks, props, { palette, decor = null } = {}) {
  const { x, z, radius } = STATUE
  const p = PLINTH
  // The plinth, tier on tier, round: the same seen from anywhere, so it needs no turning.
  const drum = new CylinderGeometry(1, 1, 1, 28)
  const tier = (r, y0, y1, color, style = STYLE.SMOOTH) => props.add(drum, { position: [x, (y0 + y1) / 2, z], scale: [r, y1 - y0, r], color, style })
  tier(radius + 0.95, 0, 0.06, palette?.night ? palette.neon[0] : '#ffe27a', STYLE.GLOW)
  tier(radius + 0.6, 0, p.step, '#d9e2ec')
  tier(radius, p.step, p.drum, '#eef2f7')
  tier(radius + 0.12, p.drum, p.band, GOLD, STYLE.GLOW)
  tier(radius - 0.3, p.band, p.top, STONE_TOP)
  tier(radius - 0.15, p.top, p.cap, GOLD)
  drum.dispose()
  // The name plaque on the drum's front: a gold frame set into it, a dark plate proud of that.
  const front = turned(x, z, STATUE_YAW)
  const [fx, fz] = front(0, radius - 0.18)
  blocks.add(fx, (p.step + p.drum) / 2, fz, STATUE_PLATE.width + 0.3, p.drum - p.step, 0.6, GOLD, STYLE.GLOW, STATUE_YAW)
  const [px, pz] = front(0, radius + 0.12)
  blocks.add(px, STATUE_PLATE.y, pz, STATUE_PLATE.width, STATUE_PLATE.height, 0.1, SLATE, STYLE.SMOOTH, STATUE_YAW)

  const base = p.cap
  const k = STATUE_SCALE
  // The body is built facing +z, then turned (props) or placed turned (blocks) to face STATUE_YAW.
  const at = (u, v, w) => [x + u * k, base + v * k, z + w * k]
  const turn = new Matrix4().makeTranslation(x, 0, z).multiply(new Matrix4().makeRotationY(STATUE_YAW)).multiply(new Matrix4().makeTranslation(-x, 0, -z))
  const head = {
    add: (bx, by, bz, sx, sy, sz, color, style, rotY = 0) => {
      const [wx, wz] = front(bx - x, bz - z)
      blocks.add(wx, by, wz, sx, sy, sz, color, style, rotY + STATUE_YAW)
    },
    addOn: (bx, base0, bz, sx, sy, sz, color, style, rotY = 0) => head.add(bx, base0 + sy / 2, bz, sx, sy, sz, color, style, rotY),
  }

  // The champion breathes: the belly swelling out and back, round the statue's middle.
  toyBreathe.value.set(x, z)
  // The body - fat-body geometry, the costliest thing in the lobby to build - and what's
  // fitted to it are decoration: queued for after the game's playable (decor).
  later(decor, props, (p) => {
    p.transform = turn
    const body = flexingBodybuilder()
    const colorOf = (slot) => (slot.startsWith('arm') ? SKIN : slot.startsWith('leg') ? SHORTS : SHIRT)
    const breath = (slot) => (slot === 'torso' ? -0.07 : -0.025)
    for (const [slot, part] of Object.entries(body)) p.add(part, { position: at(0, 0, 0), scale: k, color: colorOf(slot), anim: [0, breath(slot)] })

    const ring = new CylinderGeometry(1, 1, 1, 20)
    const torso = body.torso
    if (torso) {
      // A champion's medal on the chest: a red ribbon from the collar and a gold disc, each
      // laid flat against the chest where it sits.
      const line = frontLine(torso, 3.7, 4.8, 8, 0.15)
      const ribbon = frontAt(line, 4.55)
      const medal = frontAt(line, 4.24)
      if (ribbon && medal) {
        for (const side of [-1, 1]) {
          p.box(...at(side * 0.1, 4.55, ribbon.z + 0.04), 0.14 * k, 0.5 * k, 0.06 * k, RIBBON, STYLE.SMOOTH, [ribbon.tilt, 0, -side * 0.35])
        }
        p.add(ring, { position: at(0, 4.24, medal.z + 0.05), rotation: [Math.PI / 2 + medal.tilt, 0, 0], scale: [0.27 * k, 0.08 * k, 0.27 * k], color: GOLD, style: STYLE.GLOW })
      }
      // The belt, sized to the belly round the waist, with a gold buckle at the front.
      const waist = sliceExtent(torso, 2.45, 2.75)
      if (waist) {
        const cx = (waist.minX + waist.maxX) / 2
        const cz = (waist.minZ + waist.maxZ) / 2
        p.add(ring, {
          position: at(cx, 2.6, cz),
          scale: [((waist.maxX - waist.minX) / 2 + 0.05) * k, 0.3 * k, ((waist.maxZ - waist.minZ) / 2 + 0.05) * k],
          color: BELT,
        })
        p.box(...at(cx, 2.6, waist.maxZ + 0.06), 0.42 * k, 0.32 * k, 0.06 * k, GOLD, STYLE.GLOW)
      }
    }
    // White shoes, each round the bottom of its leg.
    for (const [slot, side] of [
      ['leg_L', 1],
      ['leg_R', -1],
    ]) {
      const foot = body[slot] && sliceExtent(body[slot], -1, 0.35)
      const fx = foot ? (foot.minX + foot.maxX) / 2 : side * 0.75
      const fz = foot ? (foot.minZ + foot.maxZ) / 2 : 0
      const hx = foot ? (foot.maxX - foot.minX) / 2 + 0.08 : 0.62
      const hz = foot ? (foot.maxZ - foot.minZ) / 2 + 0.12 : 0.76
      p.add(ring, { position: at(fx, 0.15, fz + 0.1), scale: [hx * k, 0.3 * k, hz * k], color: SHOE })
    }
    ring.dispose()
    for (const part of Object.values(body)) part.dispose()
    p.transform = null
  })

  // The head, as blocky as the players': hair at the back, eyes, rosy cheeks and a grin,
  // under a tall chef's hat.
  head.addOn(...at(0, 4.85, 0), 1.6 * k, 1.6 * k, 1.6 * k, SKIN, STYLE.SMOOTH)
  head.addOn(...at(0, 5.3, -0.76), 1.72 * k, 1.1 * k, 0.3 * k, HAIR, STYLE.SMOOTH)
  for (const side of [-1, 1]) {
    head.add(...at(side * 0.32, 5.75, 0.81), 0.16 * k, 0.26 * k, 0.05, '#1b1f2b', STYLE.SMOOTH)
    head.add(...at(side * 0.55, 5.35, 0.81), 0.28 * k, 0.16 * k, 0.04, CHEEK, STYLE.SMOOTH)
  }
  head.add(...at(0, 5.3, 0.81), 0.6 * k, 0.1 * k, 0.05, '#1b1f2b', STYLE.SMOOTH)
  head.addOn(...at(0, 6.35, 0), 1.76 * k, 0.45 * k, 1.76 * k, CHEF_WHITE, STYLE.SMOOTH)
  for (const turn of [0, Math.PI / 4]) head.addOn(...at(0, 6.8, 0), 2 * k, 0.95 * k, 2 * k, CHEF_WHITE, STYLE.SMOOTH, turn)
}
