import { Euler, Quaternion, Vector3 } from 'three'

import { BENCH_HALF, benchSeat, FOOD_COURTS, kitchenRect, SEAT_HEIGHT, seatYaw, ZONE_COUNT, ZONE_HEIGHT, zoneHalf } from '@shared/world'

import { toColor } from '../blocks'
import { addFoodToProps, foodGeometry, foodSize } from '../food'
import { STYLE } from '../materials'

/**
 * The Food Courts: seven little restaurants in a column down the west of the plaza, each
 * open to the plaza (east). From the plaza in: a low dining table, the long bench you
 * sit on (facing east, over the table), an aisle under a striped awning, the kitchen
 * line along the back - fridge, counter, stove and a speciality of the house - and
 * behind it the shop front: a wall in the court's colours with its sign board over the
 * awning (the zone label floats in front of it) and a giant food bobbing on the roof.
 *
 * Each restaurant is built in its own frame - x across, along its bench; z from its
 * front (-) to its back (+) - and turned into place to face the way its court faces
 * (FOOD_COURTS[i].facing), so the same builder serves a court facing any way.
 *
 * Only the kitchen band is solid (STATIC_COLLIDERS); the table, bench and posts are
 * walk-through, so you can walk straight onto the bench from the plaza.
 *
 * All boxes, in the world's one block set; the giant foods go in the world's one prop
 * mesh. `detail` (off on LOW) adds the small stuff: jars, knobs, cutlery, bulbs.
 */

/**
 * Per-court look, in Food Court order (TRAIN_ZONES in shared/balance.js). `text` is the
 * colour of its label's name (lobbyLabels.js).
 */
export const ZONE_THEMES = [
  // Snack Corner: a yellow-and-red snack bar.
  {
    text: '#ffe45c',
    wall: '#ffd23a',
    wallStyle: STYLE.STUDS,
    trim: '#ff3b30',
    awning: ['#ff3b30', '#fff6e0'],
    floor: '#f2e6c8',
    floorStyle: STYLE.TILES,
    rim: '#7a1d14',
    counter: '#ff3b30',
    seat: '#ff3b30',
    board: '#5a1410',
    food: 'fries',
    special: 'fryer',
  },
  // Dinky Diner: retro teal and pink, chrome and neon.
  {
    text: '#ff8ac0',
    wall: '#35c9c1',
    wallStyle: STYLE.STUDS,
    trim: '#ff5fa8',
    awning: ['#ff5fa8', '#ffffff'],
    floor: '#eef3f8',
    floorStyle: STYLE.TILES,
    rim: '#1d5f63',
    counter: '#ff5fa8',
    seat: '#ff4f9a',
    board: '#123c40',
    food: 'burger',
    special: 'shakes',
  },
  // Sizzle Grill: dark-red brick BBQ shack, smoke curling off the roof.
  {
    text: '#ffb070',
    wall: '#8a2318',
    wallStyle: STYLE.BLOCK,
    trim: '#ff9a2a',
    awning: ['#2b2b30', '#c0392b'],
    floor: '#6b4a36',
    floorStyle: STYLE.TILES,
    rim: '#2a1210',
    counter: '#3a3a40',
    seat: '#c0392b',
    board: '#1c0c0a',
    food: 'drumstick',
    special: 'bbq',
  },
  // Golden Bakery: cream and gold, loaves everywhere.
  {
    text: '#ffe45c',
    wall: '#fff1d6',
    wallStyle: STYLE.STUDS,
    trim: '#ffb703',
    awning: ['#ffb703', '#fffaf0'],
    floor: '#f6d08a',
    floorStyle: STYLE.PLATE,
    rim: '#6b4c0c',
    counter: '#c8873a',
    seat: '#ffb703',
    board: '#5a3a0c',
    food: 'cake',
    special: 'bread',
  },
  // Spicy Kitchen: orange and chili red over a floor of glowing coals.
  {
    text: '#ff9a3c',
    wall: '#ff6a1c',
    wallStyle: STYLE.STUDS,
    trim: '#ffd23a',
    awning: ['#e8322f', '#ffd23a'],
    floor: '#ff5a1c',
    floorStyle: STYLE.LAVA,
    rim: '#2a1712',
    counter: '#b8321a',
    seat: '#ffd23a',
    board: '#3a1208',
    food: 'taco',
    special: 'chili',
  },
  // Frosty Parlor: an icy-blue ice-cream parlour, icicles and snow on the roof.
  {
    text: '#c9f3ff',
    wall: '#bfefff',
    wallStyle: STYLE.STUDS,
    trim: '#7fe2ff',
    awning: ['#5cc8ff', '#ffffff'],
    floor: '#dff6ff',
    floorStyle: STYLE.TILES,
    rim: '#2b5f8f',
    counter: '#ff9ccf',
    seat: '#5cc8ff',
    board: '#1e4a7a',
    food: 'icecream',
    special: 'freezer',
  },
  // Galaxy Buffet: deep purple space, glowing stars.
  {
    text: '#d39bff',
    wall: '#2a1f6a',
    wallStyle: STYLE.GALAXY,
    trim: '#c35cff',
    awning: ['#7a2fd6', '#c35cff'],
    floor: '#2a1f6a',
    floorStyle: STYLE.GALAXY,
    rim: '#120d33',
    counter: '#4a2a9a',
    seat: '#c35cff',
    board: '#120d33',
    food: 'galaxyDonut',
    special: 'orbs',
  },
]

const STEEL = '#d9e0e8'
const DARK_STEEL = '#3a4150'
const WOOD = '#b0743c'
const WOOD_DARK = '#7a4a22'
const CHINA = '#f4f7fb'
const COUNTERTOP = '#ece6dc'
const CUSHION = '#262b35'

const darker = new Map()
/** `color`, a shade darker (cached: builders ask thousands of times). */
function shade(color, k = 0.78) {
  const key = `${color}:${k}`
  if (!darker.has(key)) darker.set(key, toColor(color).clone().multiplyScalar(k))
  return darker.get(key)
}

// --- A court's own frame ---------------------------------------------------------------

const _local = new Quaternion()
const _euler = new Euler()
const UP = new Vector3(0, 1, 0)

/**
 * Court `index`'s frame, for building it: `add`/`addOn` take BlockSet's arguments in the
 * court's own terms (x across its bench, z from front to back) and add the box turned
 * into place; `at(x, z)` is where a point of it is in the world, `local(x, z)` the other
 * way round, `turn` how far it's turned about y.
 */
function courtFrame(index, blocks = null) {
  const c = FOOD_COURTS[index]
  // Its front faces seatYaw: a court built facing -z (yaw PI) turned by the difference.
  const turn = seatYaw(index) - Math.PI
  const cos = Math.cos(turn)
  const sin = Math.sin(turn)
  const q = new Quaternion().setFromAxisAngle(UP, turn)
  const frame = {
    turn,
    at: (x, z) => [c.x + x * cos + z * sin, c.z - x * sin + z * cos],
    local: (wx, wz) => {
      const dx = wx - c.x
      const dz = wz - c.z
      return [dx * cos - dz * sin, dx * sin + dz * cos]
    },
    add(x, y, z, sx, sy, sz, color, style = STYLE.STUDS, rotY = 0, rotX = 0, rotZ = 0) {
      const [wx, wz] = frame.at(x, z)
      if (rotX === 0 && rotZ === 0) {
        blocks.add(wx, y, wz, sx, sy, sz, color, style, rotY + turn)
      } else {
        // Tipped as well as turned: the court's turn on top of the box's own rotation.
        _local.setFromEuler(_euler.set(rotX, rotY, rotZ, 'XYZ'))
        _euler.setFromQuaternion(_local.premultiply(q), 'XYZ')
        blocks.add(wx, y, wz, sx, sy, sz, color, style, _euler.y, _euler.x, _euler.z)
      }
      return frame
    },
    addOn(x, base, z, sx, sy, sz, color, style = STYLE.STUDS, rotY = 0) {
      return frame.add(x, base + sy / 2, z, sx, sy, sz, color, style, rotY)
    },
  }
  return frame
}

/** Half of every court's deck (they're all the same size): across, along its bench, and front to back. */
const HALF = (() => {
  const h = zoneHalf(0)
  const sideways = Math.abs(Math.sin(seatYaw(0))) > 0.5
  return sideways ? { across: h.z, depth: h.x } : { across: h.x, depth: h.z }
})()

// --- Where things are, front to back (in a court's own frame) ---------------------------

/** The deck's top. */
const H = ZONE_HEIGHT
/** The kitchen units' depth (front to back), centred on the kitchen band: inside its collider. */
const KITCHEN_DEPTH = 1.4
/** The back wall's front face, just behind the kitchen units, and its thickness. */
const WALL_FRONT = HALF.depth - 0.35
const WALL_DEPTH = 0.35
/** Height of the wall's top over the deck: where the awning meets it and the sign board starts. */
const WALL_TOP = 4.1
/** The sign board over the awning: its height. The zone label floats in front of it. */
const BOARD_H = 3.2
/** The awning: from the wall at WALL_TOP down to its front edge, this far in front of the wall. */
const AWNING_FRONT = 3.85
const AWNING_DROP = 1.05
/** How high the dining table's top is over the deck: elbow height sat on the bench. */
const TABLE_TOP = 0.62
const TABLE_DEPTH = 0.9
/** The table's middle, this far in front of the bench's seat line. */
const TABLE_FORWARD = 0.95
/** How big the giant food on each roof is, against the one in your hand. */
const ROOF_FOOD = 7.5

/**
 * Where Food Court `index`'s label floats: [x, y, z] level with the middle of its sign
 * board, out over the awning (towards the plaza) - far enough in front of the board
 * that the camera-facing label isn't cut into by it when seen from along the column.
 */
export function zoneSignPosition(index) {
  const [x, z] = courtFrame(index).at(0, WALL_FRONT - 2.2)
  return [x, H + WALL_TOP + BOARD_H / 2, z]
}

// --- The kitchen line -----------------------------------------------------------------

/** A tall fridge, its doors facing the diners (the front), magnets on. */
function fridge(blocks, x, z, accent, detail) {
  const front = z - KITCHEN_DEPTH / 2
  blocks.addOn(x, H, z, 1.2, 2.3, KITCHEN_DEPTH, '#eef3f8', STYLE.SMOOTH)
  blocks.add(x, H + 1.55, front - 0.01, 1.1, 0.05, 0.04, '#9aa4b0', STYLE.SMOOTH)
  blocks.add(x + 0.4, H + 1.95, front - 0.05, 0.06, 0.4, 0.06, STEEL, STYLE.SMOOTH)
  blocks.add(x + 0.4, H + 1.05, front - 0.05, 0.06, 0.7, 0.06, STEEL, STYLE.SMOOTH)
  if (detail) {
    blocks.add(x - 0.25, H + 1.2, front - 0.02, 0.14, 0.14, 0.03, accent, STYLE.SMOOTH)
    blocks.add(x - 0.05, H + 0.95, front - 0.02, 0.16, 0.12, 0.03, '#4fc3ff', STYLE.SMOOTH)
  }
}

/** A counter `w` wide in `color`, a cutting board, a bowl and a shelf of jars over it. */
function counter(blocks, x, z, w, color, detail) {
  const front = z - KITCHEN_DEPTH / 2
  blocks.addOn(x, H, z, w, 0.88, KITCHEN_DEPTH, color, STYLE.SMOOTH)
  blocks.addOn(x, H + 0.88, z, w + 0.1, 0.1, KITCHEN_DEPTH + 0.12, COUNTERTOP, STYLE.SMOOTH)
  for (const side of [-1, 1]) blocks.add(x + (side * w) / 4, H + 0.45, front - 0.01, w / 2 - 0.2, 0.62, 0.03, shade(color, 0.8), STYLE.SMOOTH)
  if (!detail) return
  const top = H + 0.98
  for (const side of [-1, 1]) blocks.add(x + side * 0.2, H + 0.62, front - 0.04, 0.07, 0.07, 0.05, STEEL, STYLE.SMOOTH)
  // A cutting board with a tomato and a lettuce, and a mixing bowl.
  blocks.addOn(x - w / 2 + 0.5, top, z - 0.1, 0.75, 0.04, 0.55, WOOD, STYLE.SMOOTH, 0.1)
  blocks.addOn(x - w / 2 + 0.35, top + 0.04, z - 0.15, 0.15, 0.15, 0.15, '#e8322f', STYLE.SMOOTH, 0.5)
  blocks.addOn(x - w / 2 + 0.68, top + 0.04, z - 0.05, 0.22, 0.18, 0.22, '#6fd24a', STYLE.SMOOTH, 0.3)
  for (const turn of [0, Math.PI / 4]) blocks.addOn(x + 0.3, top, z, 0.42, 0.22, 0.42, '#7fd3ff', STYLE.SMOOTH, turn)
  blocks.addOn(x + 0.3, top + 0.22, z, 0.32, 0.02, 0.32, '#fff1d0', STYLE.SMOOTH, Math.PI / 8)
  // A shelf on the wall, jars on it.
  const shelfZ = z + KITCHEN_DEPTH / 2 - 0.1
  blocks.add(x, H + 1.85, shelfZ, w - 0.2, 0.05, 0.3, WOOD, STYLE.SMOOTH)
  ;['#ff6fa8', '#ffd447', '#4fc3ff', '#7dff6a'].forEach((jar, i) => {
    blocks.addOn(x - w / 2 + 0.35 + i * ((w - 0.7) / 3), H + 1.875, shelfZ, 0.2, 0.26 + (i % 2) * 0.08, 0.2, jar, STYLE.SMOOTH)
  })
}

/** An oven with a glowing window under a cooktop, a pot of soup on, under a steel hood. */
function stove(blocks, x, z, w, detail) {
  const front = z - KITCHEN_DEPTH / 2
  blocks.addOn(x, H, z, w, 0.92, KITCHEN_DEPTH, DARK_STEEL, STYLE.SMOOTH)
  const top = H + 0.98
  blocks.addOn(x, H + 0.92, z, w + 0.06, 0.06, KITCHEN_DEPTH + 0.06, '#23272f', STYLE.SMOOTH)
  blocks.add(x, H + 0.42, front - 0.01, w * 0.55, 0.34, 0.03, '#ff8a2a', STYLE.GLOW)
  blocks.add(x, H + 0.72, front - 0.04, w * 0.6, 0.05, 0.05, STEEL, STYLE.SMOOTH)
  // Two glowing burners, a pot of soup on one.
  blocks.addOn(x - 0.45, top, z - 0.2, 0.32, 0.02, 0.32, '#ff3b1e', STYLE.GLOW)
  blocks.addOn(x + 0.45, top, z + 0.2, 0.32, 0.02, 0.32, '#ff3b1e', STYLE.GLOW)
  blocks.addOn(x - 0.45, top + 0.02, z - 0.2, 0.46, 0.36, 0.46, STEEL, STYLE.SMOOTH)
  blocks.addOn(x - 0.45, top + 0.38, z - 0.2, 0.38, 0.02, 0.38, '#ff9a3c', STYLE.SMOOTH)
  // The hood on the wall over it.
  blocks.add(x, H + 2.45, z + 0.2, w * 0.85, 0.3, KITCHEN_DEPTH - 0.4, STEEL, STYLE.SMOOTH)
  blocks.addOn(x, H + 2.6, z + 0.45, 0.45, 0.65, 0.45, STEEL, STYLE.SMOOTH)
  if (!detail) return
  for (let k = 0; k < 4; k += 1) blocks.add(x - 0.45 + k * 0.3, H + 0.84, front - 0.03, 0.07, 0.07, 0.04, STEEL, STYLE.SMOOTH)
  // A frying pan with an egg in it.
  blocks.addOn(x + 0.45, top + 0.02, z + 0.2, 0.46, 0.06, 0.46, '#2b2f38', STYLE.SMOOTH)
  blocks.addOn(x + 0.88, top + 0.05, z + 0.2, 0.42, 0.04, 0.07, '#2b2f38', STYLE.SMOOTH)
  blocks.addOn(x + 0.45, top + 0.08, z + 0.2, 0.26, 0.02, 0.24, CHINA, STYLE.SMOOTH, 0.3)
  blocks.addOn(x + 0.45, top + 0.1, z + 0.2, 0.1, 0.03, 0.1, '#ffb21e', STYLE.SMOOTH, 0.3)
}

/** Each court's speciality, at the right-hand end of its kitchen line: `w` wide, centred on x. */
const SPECIALS = {
  /** A deep fryer, two baskets of fries in the bubbling oil. */
  fryer(blocks, x, z, w, t) {
    blocks.addOn(x, H, z, w, 0.95, KITCHEN_DEPTH, STEEL, STYLE.SMOOTH)
    blocks.addOn(x, H + 0.95, z, w - 0.2, 0.03, KITCHEN_DEPTH - 0.3, '#ffb21e', STYLE.GLOW)
    for (const side of [-1, 1]) {
      blocks.addOn(x + side * 0.3, H + 0.9, z, 0.5, 0.3, 0.6, '#c9d1da', STYLE.SMOOTH)
      blocks.addOn(x + side * 0.3, H + 1.2, z, 0.4, 0.14, 0.5, '#ffd447', STYLE.SMOOTH)
    }
    blocks.add(x, H + 0.5, z - KITCHEN_DEPTH / 2 - 0.01, w - 0.3, 0.3, 0.03, t.trim, STYLE.SMOOTH)
  },
  /** A pink milkshake machine, three steel cups under it. */
  shakes(blocks, x, z, w, t) {
    blocks.addOn(x, H, z, w, 0.9, KITCHEN_DEPTH, '#eef3f8', STYLE.SMOOTH)
    blocks.addOn(x, H + 0.9, z + 0.2, w - 0.3, 1.1, 0.7, t.trim, STYLE.SMOOTH)
    blocks.add(x, H + 1.75, z - 0.16, w - 0.5, 0.18, 0.04, '#ffffff', STYLE.GLOW)
    for (const k of [-1, 0, 1]) {
      blocks.addOn(x + k * 0.4, H + 0.9, z - 0.35, 0.2, 0.36, 0.2, STEEL, STYLE.SMOOTH)
      blocks.addOn(x + k * 0.4, H + 1.26, z - 0.35, 0.16, 0.08, 0.16, ['#ff8ac0', '#fff1d0', '#8a5a2a'][k + 1], STYLE.SMOOTH)
    }
  },
  /** A charcoal grill: glowing coals under the grate, sausages and a rack of ribs on it. */
  bbq(blocks, x, z, w) {
    blocks.addOn(x, H, z, w, 0.85, KITCHEN_DEPTH, '#1d1f24', STYLE.SMOOTH)
    blocks.addOn(x, H + 0.85, z, w - 0.2, 0.06, KITCHEN_DEPTH - 0.25, '#ff6a1c', STYLE.LAVA)
    for (let k = -2; k <= 2; k += 1) blocks.addOn(x + k * 0.26, H + 0.92, z, 0.05, 0.04, KITCHEN_DEPTH - 0.3, '#5a5f68', STYLE.SMOOTH)
    for (const dz of [-0.3, 0, 0.3]) blocks.addOn(x - 0.2, H + 0.96, z + dz, 0.6, 0.12, 0.13, '#b04a24', STYLE.SMOOTH)
    blocks.addOn(x + 0.4, H + 0.96, z, 0.4, 0.1, 0.8, '#7a2f12', STYLE.SMOOTH)
  },
  /** A wooden bread shelf: loaves and baguettes. */
  bread(blocks, x, z, w) {
    blocks.addOn(x, H, z, w, 1.0, KITCHEN_DEPTH, WOOD, STYLE.SMOOTH)
    blocks.add(x, H + 0.5, z - KITCHEN_DEPTH / 2 - 0.01, w - 0.3, 0.7, 0.03, WOOD_DARK, STYLE.SMOOTH)
    for (const [dx, dz] of [
      [-0.35, -0.25],
      [0.35, -0.25],
      [0, 0.25],
    ]) {
      blocks.addOn(x + dx, H + 1.0, z + dz, 0.55, 0.26, 0.4, '#d08a3c', STYLE.SMOOTH, 0.2)
      blocks.addOn(x + dx, H + 1.26, z + dz, 0.42, 0.08, 0.3, '#e8a95a', STYLE.SMOOTH, 0.2)
    }
    for (const side of [-1, 1]) blocks.add(x + side * 0.2, H + 1.55, z + 0.5, 0.14, 1.1, 0.14, '#e0a050', STYLE.SMOOTH, 0, 0, side * 0.25)
  },
  /** A big pot of chili bubbling over open flames. */
  chili(blocks, x, z, w) {
    blocks.addOn(x, H, z, w, 0.6, KITCHEN_DEPTH, DARK_STEEL, STYLE.SMOOTH)
    for (const turn of [0, Math.PI / 4]) blocks.addOn(x, H + 0.6, z, 0.9, 0.12, 0.9, '#ff8a1c', STYLE.GLOW, turn)
    for (const turn of [0, Math.PI / 4]) blocks.addOn(x, H + 0.72, z, 1.0, 0.7, 1.0, '#2b2f38', STYLE.SMOOTH, turn)
    blocks.addOn(x, H + 1.42, z, 0.86, 0.04, 0.86, '#e8322f', STYLE.GLOW, Math.PI / 8)
  },
  /** An ice-cream freezer: a glass top over tubs of every flavour. */
  freezer(blocks, x, z, w) {
    blocks.addOn(x, H, z, w, 0.9, KITCHEN_DEPTH, '#ffffff', STYLE.SMOOTH)
    blocks.add(x, H + 0.5, z - KITCHEN_DEPTH / 2 - 0.01, w - 0.3, 0.3, 0.03, '#ff9ccf', STYLE.SMOOTH)
    ;['#ff8fb1', '#fff1d0', '#8ff0c0', '#8a5a2a'].forEach((tub, i) => {
      blocks.addOn(x + (i % 2 ? 0.3 : -0.3), H + 0.9, z + (i < 2 ? -0.28 : 0.28), 0.5, 0.06, 0.48, tub, STYLE.SMOOTH)
    })
    blocks.addOn(x, H + 0.96, z, w - 0.1, 0.04, KITCHEN_DEPTH - 0.1, '#bff4ff', STYLE.GLOW)
  },
  /** Glowing orbs of star stuff on a dark plinth. */
  orbs(blocks, x, z, w) {
    blocks.addOn(x, H, z, w, 0.9, KITCHEN_DEPTH, '#1a1440', STYLE.GALAXY)
    ;['#ff7ad9', '#7fe0ff', '#ffe14a'].forEach((orb, i) => {
      blocks.add(x - 0.4 + i * 0.4, H + 1.2 + (i % 2) * 0.2, z, 0.34, 0.34, 0.34, orb, STYLE.GLOW, 0.785, 0.6, 0)
    })
  },
}

// --- The dining table and the bench ---------------------------------------------------

/** Little blocky dishes, each sat on a plate whose top is at y. */
const DISHES = [
  // A burger.
  (blocks, x, y, z) => {
    blocks.addOn(x, y, z, 0.24, 0.06, 0.24, '#e3a04f', STYLE.SMOOTH)
    blocks.addOn(x, y + 0.06, z, 0.26, 0.05, 0.26, '#5a2e1a', STYLE.SMOOTH)
    blocks.addOn(x, y + 0.11, z, 0.25, 0.015, 0.25, '#ffc93c', STYLE.SMOOTH, Math.PI / 4)
    blocks.addOn(x, y + 0.125, z, 0.24, 0.08, 0.24, '#e8a650', STYLE.SMOOTH)
  },
  // A slice of cake with a cherry.
  (blocks, x, y, z) => {
    blocks.addOn(x, y, z, 0.24, 0.15, 0.18, '#ff9ccf', STYLE.SMOOTH, 0.4)
    blocks.addOn(x, y + 0.15, z, 0.25, 0.03, 0.19, '#fff4fa', STYLE.SMOOTH, 0.4)
    blocks.addOn(x, y + 0.18, z, 0.06, 0.06, 0.06, '#e01f3d', STYLE.SMOOTH)
  },
  // Fries in a carton.
  (blocks, x, y, z) => {
    blocks.addOn(x, y, z, 0.16, 0.15, 0.11, '#e8322f', STYLE.SMOOTH)
    for (let i = 0; i < 3; i += 1) blocks.add(x - 0.04 + i * 0.04, y + 0.2, z + (i % 2) * 0.03 - 0.015, 0.03, 0.16, 0.03, '#ffd447', STYLE.SMOOTH)
  },
  // A drumstick.
  (blocks, x, y, z) => {
    blocks.addOn(x - 0.03, y, z, 0.2, 0.12, 0.16, '#a4471e', STYLE.SMOOTH, 0.5)
    blocks.addOn(x + 0.1, y + 0.03, z + 0.06, 0.16, 0.05, 0.05, '#f7f0e1', STYLE.SMOOTH, 0.5)
  },
  // A pink-iced donut.
  (blocks, x, y, z) => {
    for (const turn of [0, Math.PI / 4]) blocks.addOn(x, y, z, 0.24, 0.06, 0.24, '#e0a35a', STYLE.SMOOTH, turn)
    blocks.addOn(x, y + 0.06, z, 0.21, 0.02, 0.21, '#ff7eb6', STYLE.SMOOTH, Math.PI / 8)
  },
]
const CUPS = ['#ff4a6a', '#4fc3ff', '#ffd447', '#7dff6a', '#ff8a5c']

/**
 * A court's long, low dining table, in front of its bench and as long as it:
 * low enough not to hide anyone sat at it, and not solid (you walk over it to sit down).
 * A runner in the court's colour down it, and at every seat a plate with a dish on, and
 * a drink. `index` varies the menu from court to court.
 */
function diningTable(blocks, cx, tz, t, index, detail) {
  const length = BENCH_HALF * 2 + 0.2
  const top = H + TABLE_TOP
  for (const k of [-1, 0, 1]) blocks.addOn(cx + k * (length / 2 - 0.35), H, tz, 0.12, TABLE_TOP - 0.08, TABLE_DEPTH - 0.25, WOOD_DARK, STYLE.SMOOTH)
  blocks.addOn(cx, top - 0.08, tz, length, 0.08, TABLE_DEPTH, WOOD, STYLE.SMOOTH)
  blocks.addOn(cx, top, tz - 0.2, length - 0.3, 0.015, 0.34, t.trim, STYLE.SMOOTH)
  for (let k = -2; k <= 2; k += 1) {
    const px = cx + k * 1.25
    const pz = tz + 0.15
    for (const turn of [0, Math.PI / 4]) blocks.addOn(px, top, pz, 0.44, 0.025, 0.44, CHINA, STYLE.SMOOTH, turn)
    DISHES[(k + 2 + index) % DISHES.length](blocks, px, top + 0.025, pz)
    // A drink, with a straw.
    const cupX = px + 0.45
    const cupZ = tz - 0.22
    blocks.addOn(cupX, top + 0.015, cupZ, 0.13, 0.2, 0.13, CUPS[(k + 2 + index * 2) % CUPS.length], STYLE.SMOOTH)
    if (detail) {
      blocks.addOn(cupX, top + 0.215, cupZ, 0.14, 0.02, 0.14, CHINA, STYLE.SMOOTH)
      blocks.add(cupX, top + 0.31, cupZ + 0.02, 0.025, 0.2, 0.025, CHINA, STYLE.SMOOTH, 0, 0.2)
    }
  }
  // Ketchup and mustard at the left-hand end.
  const bx = cx - length / 2 + 0.3
  blocks.addOn(bx - 0.08, top + 0.015, tz - 0.2, 0.08, 0.2, 0.08, '#e8322f', STYLE.SMOOTH)
  blocks.addOn(bx + 0.08, top + 0.015, tz - 0.2, 0.08, 0.2, 0.08, '#ffd21f', STYLE.SMOOTH)
}

/**
 * A court's long bench, facing out over its table and BENCH_HALF either way of its middle: a padded
 * seat in the court's colour (its top SEAT_HEIGHT over the deck) on wooden legs, with a
 * padded backrest the length of it. Walking into it sits you down at the table.
 */
function diningBench(blocks, cx, bz, color) {
  const top = H + SEAT_HEIGHT
  const length = BENCH_HALF * 2
  for (let i = 0; i <= 3; i += 1) {
    const lx = cx - BENCH_HALF + 0.25 + ((length - 0.5) * i) / 3
    blocks.addOn(lx, H, bz, 0.1, top - H - 0.12, 0.5, WOOD_DARK, STYLE.SMOOTH)
    blocks.addOn(lx, top - 0.12, bz + 0.4, 0.08, 0.5, 0.08, WOOD_DARK, STYLE.SMOOTH)
  }
  blocks.addOn(cx, top - 0.12, bz, length, 0.12, 0.72, color, STYLE.SMOOTH)
  blocks.addOn(cx, top - 0.02, bz - 0.02, length - 0.1, 0.04, 0.62, CUSHION, STYLE.SMOOTH)
  blocks.add(cx, top + 0.55, bz + 0.42, length - 0.04, 0.5, 0.12, color, STYLE.SMOOTH, 0, 0.12)
}

// --- The shop front -------------------------------------------------------------------

/**
 * The awning: stripes in the court's two colours running down from the wall to a
 * scalloped front edge, on two posts at the front corners.
 */
function awning(blocks, cx, cz, t) {
  const back = cz + WALL_FRONT
  const front = back - AWNING_FRONT
  const yBack = H + WALL_TOP
  const yFront = yBack - AWNING_DROP
  const length = Math.hypot(AWNING_FRONT, AWNING_DROP)
  const tilt = -Math.atan2(AWNING_DROP, AWNING_FRONT)
  const stripes = 8
  const width = (HALF.across * 2 + 0.4) / stripes
  for (let s = 0; s < stripes; s += 1) {
    const x = cx - HALF.across - 0.2 + width * (s + 0.5)
    blocks.add(x, (yBack + yFront) / 2, (back + front) / 2, width, 0.1, length, t.awning[s % 2], STYLE.SMOOTH, 0, tilt)
    // The scalloped edge hanging off the front, the other way round.
    blocks.add(x, yFront - 0.2, front - 0.04, width - 0.12, 0.4, 0.05, t.awning[(s + 1) % 2], STYLE.SMOOTH)
  }
  for (const side of [-1, 1]) {
    blocks.addOn(cx + side * (HALF.across + 0.05), H, front + 0.12, 0.2, yFront - H, 0.2, t.trim, STYLE.SMOOTH)
    // Short walls either side of the kitchen.
    const wallLen = AWNING_FRONT - 1.6
    blocks.addOn(cx + side * (HALF.across + 0.05), H, back - wallLen / 2, 0.25, WALL_TOP - 0.3, wallLen, t.wall, t.wallStyle)
  }
  return { front, yFront }
}

/** The back wall, kitchen tiles on it, and the sign board on top in a glowing frame. */
function shopFront(blocks, cx, cz, t, detail) {
  const z = cz + WALL_FRONT + WALL_DEPTH / 2
  const w = HALF.across * 2 + 0.6
  blocks.addOn(cx, H - 0.05, z, w, WALL_TOP + 0.05, WALL_DEPTH, t.wall, t.wallStyle)
  blocks.add(cx, H + 1.35, cz + WALL_FRONT - 0.02, HALF.across * 2 - 0.8, 2.7, 0.04, CHINA, STYLE.TILES)
  // The board, its frame and a cap.
  const y0 = H + WALL_TOP
  blocks.addOn(cx, y0, z, w - 0.2, BOARD_H, WALL_DEPTH - 0.05, t.board, STYLE.SMOOTH)
  for (const side of [-1, 1]) blocks.addOn(cx + side * (w / 2 - 0.2), y0, z - 0.05, 0.3, BOARD_H, WALL_DEPTH + 0.05, t.trim, STYLE.GLOW)
  blocks.addOn(cx, y0 + BOARD_H, z - 0.05, w + 0.1, 0.25, WALL_DEPTH + 0.15, t.trim, STYLE.GLOW)
  blocks.add(cx, y0 + 0.1, z - 0.05, w - 0.5, 0.2, WALL_DEPTH + 0.05, t.trim, STYLE.GLOW)
  if (detail) {
    for (let k = -3; k <= 3; k += 1) {
      blocks.add(cx + k * 1.15, y0 + BOARD_H + 0.36, z - 0.1, 0.18, 0.18, 0.18, k % 2 ? '#ffffff' : t.text, STYLE.GLOW, 0.785)
    }
  }
  return { top: y0 + BOARD_H + 0.25, z }
}

/** A lamp at each front corner of the deck, lit in the court's colour. */
function lamps(blocks, cx, cz, t) {
  for (const side of [-1, 1]) {
    const lx = cx + side * (HALF.across - 0.35)
    const lz = cz - HALF.depth + 0.35
    blocks.addOn(lx, H, lz, 0.18, 2.0, 0.18, DARK_STEEL, STYLE.SMOOTH)
    blocks.add(lx, H + 2.2, lz, 0.42, 0.42, 0.42, t.text, STYLE.GLOW)
    blocks.add(lx, H + 2.47, lz, 0.52, 0.1, 0.52, '#2b2f38', STYLE.SMOOTH)
  }
}

/** Each court's own touches round its shop front. */
const EXTRAS = {
  // Giant ketchup and mustard bottles on the roof's corners.
  fryer(blocks, cx, roof, t, detail) {
    for (const [side, color] of [
      [-1, '#e8322f'],
      [1, '#ffd21f'],
    ]) {
      const x = cx + side * 3.5
      blocks.addOn(x, roof.top, roof.z, 0.75, 1.5, 0.75, color, STYLE.SMOOTH)
      blocks.addOn(x, roof.top + 1.5, roof.z, 0.45, 0.25, 0.45, color, STYLE.SMOOTH)
      blocks.addOn(x, roof.top + 1.75, roof.z, 0.22, 0.4, 0.22, '#ffffff', STYLE.SMOOTH)
      if (detail) blocks.add(x, roof.top + 0.75, roof.z - 0.39, 0.5, 0.45, 0.03, '#ffffff', STYLE.SMOOTH)
    }
  },
  // A neon stripe along the wall's top, and a jukebox in the aisle's corner.
  shakes(blocks, cx, roof, t) {
    blocks.add(cx, roof.top + 0.2, roof.z - 0.05, HALF.across * 2 + 0.6, 0.12, WALL_DEPTH + 0.25, '#7ff6ff', STYLE.GLOW)
    const jx = cx + HALF.across - 0.6
    const jz = roof.z - AWNING_FRONT + 1.0
    blocks.addOn(jx, H, jz, 0.8, 1.3, 0.55, t.trim, STYLE.SMOOTH)
    blocks.addOn(jx, H + 1.3, jz, 0.8, 0.3, 0.55, '#ffd21f', STYLE.GLOW)
    blocks.add(jx, H + 0.8, jz - 0.29, 0.55, 0.5, 0.03, '#7ff6ff', STYLE.GLOW)
  },
  // A brick chimney with smoke puffing out of it.
  bbq(blocks, cx, roof) {
    const x = cx + 2.6
    const z = roof.z + 0.2
    blocks.addOn(x, roof.top - 1, z, 0.9, 2.2, 0.9, '#5a2a22', STYLE.BLOCK)
    const puffs = [
      [0, 0.6, 0.9, '#7d838c'],
      [0.25, 1.5, 1.1, '#9aa0a8'],
      [-0.1, 2.6, 1.35, '#b4b9c0'],
      [0.4, 3.8, 1.5, '#cdd2d8'],
    ]
    puffs.forEach(([dx, dy, s, color], i) => blocks.add(x + dx, roof.top + 1.2 + dy, z - dx * 0.5, s, s * 0.8, s, color, STYLE.SMOOTH, i * 0.5, 0.2, 0.15))
  },
  // Big loaves on the roof's corners, baguettes crossed between.
  bread(blocks, cx, roof) {
    for (const side of [-1, 1]) {
      const x = cx + side * 3.3
      blocks.addOn(x, roof.top, roof.z, 1.3, 0.75, 0.85, '#d08a3c', STYLE.SMOOTH)
      blocks.addOn(x, roof.top + 0.75, roof.z, 1.0, 0.25, 0.65, '#e8a95a', STYLE.SMOOTH)
      for (const k of [-1, 0, 1]) blocks.add(x + k * 0.35, roof.top + 0.98, roof.z - 0.2, 0.08, 0.06, 0.4, '#fff1d6', STYLE.SMOOTH, 0.3)
    }
  },
  // Strings of chili peppers hanging off the awning.
  chili(blocks, cx, roof, t, detail, edge) {
    for (let k = 0; k < 7; k += 1) {
      const x = cx - 3.3 + k * 1.1
      blocks.add(x, edge.yFront - 0.75, edge.front - 0.05, 0.2, 0.55, 0.2, '#e8221f', STYLE.SMOOTH, 0, 0, k % 2 ? 0.25 : -0.25)
      if (detail) blocks.add(x, edge.yFront - 0.44, edge.front - 0.05, 0.1, 0.12, 0.1, '#3fae3a', STYLE.SMOOTH)
    }
  },
  // Icicles off the awning, snow on the roof, ice crystals at its corners.
  freezer(blocks, cx, roof, t, detail, edge) {
    for (let k = 0; k < 9; k += 1) {
      const len = 0.35 + ((k * 7) % 4) * 0.12
      blocks.add(cx - 4 + k, edge.yFront - 0.4 - len / 2, edge.front - 0.05, 0.12, len, 0.12, '#e8faff', STYLE.GLOW)
    }
    blocks.addOn(cx, roof.top, roof.z, HALF.across * 2 + 0.7, 0.3, WALL_DEPTH + 0.35, '#ffffff', STYLE.SMOOTH)
    for (const side of [-1, 1]) {
      blocks.add(cx + side * 3.6, roof.top + 1.2, roof.z, 0.8, 2.4, 0.8, '#bff4ff', STYLE.GLOW, 0.4, 0, side * -0.25)
      blocks.add(cx + side * 3.0, roof.top + 0.7, roof.z + 0.1, 0.55, 1.4, 0.55, '#9fe8ff', STYLE.GLOW, 1.1, 0, side * 0.3)
    }
  },
  // Glowing stars round the sign, purple crystals on the roof.
  orbs(blocks, cx, roof) {
    const stars = [
      [-3.9, 1.6, 0.7],
      [3.9, 1.2, 0.6],
      [-2.4, 3.6, 0.5],
      [2.6, 3.4, 0.55],
      [0, 4.6, 0.45],
      [-4.5, -1.6, 0.4],
      [4.5, -1.9, 0.45],
    ]
    for (const [dx, dy, s] of stars) {
      for (const turn of [0, Math.PI / 4]) blocks.add(cx + dx, roof.top + dy, roof.z - 0.3, s, s, 0.12, '#fff3a8', STYLE.GLOW, 0, 0, turn)
    }
    for (const side of [-1, 1]) {
      blocks.add(cx + side * 3.4, roof.top + 0.9, roof.z, 0.7, 1.8, 0.7, '#c35cff', STYLE.GLOW, 0.4, 0, side * -0.2)
    }
  },
}

/**
 * A giant food on a glowing plinth on the roof, facing the plaza: added to `props` in
 * the world (the frame only places boxes), turned with the court.
 */
function roofFood(frame, props, roof, t, phase) {
  frame.addOn(0, roof.top, roof.z, 1.8, 0.3, 1.1, t.trim, STYLE.GLOW)
  // Its models are centred, so its lowest point is its bounding box's bottom, scaled.
  const drop = -foodGeometry(t.food).boundingBox.min.y * foodSize(t.food) * ROOF_FOOD
  const [x, z] = frame.at(0, roof.z)
  // Bobbing gently on the roof, each restaurant's in its own time.
  addFoodToProps(props, t.food, { position: [x, roof.top + 0.3 + drop, z], yaw: Math.PI + frame.turn, lean: 0.12, scale: ROOF_FOOD, anim: [phase, 0.28] })
}

/**
 * Between each pair of neighbouring restaurants, out on the street in front of the gap
 * between them: a lamp post, and a planter of flowers in the gap itself.
 */
function streetGaps(blocks, palette, detail) {
  // Neighbours along the column: the courts in order across their benches.
  const across = (i) => courtFrame(0).local(FOOD_COURTS[i].x, FOOD_COURTS[i].z)[0]
  const order = FOOD_COURTS.map((_, i) => i).sort((a, b) => across(a) - across(b))
  for (let k = 0; k < order.length - 1; k += 1) {
    const frame = courtFrame(order[k], blocks)
    const next = FOOD_COURTS[order[k + 1]]
    const x = frame.local(next.x, next.z)[0] / 2
    const z = -HALF.depth - 0.9
    const light = palette.lamps[k % palette.lamps.length]
    frame.addOn(x, 0, z, 0.45, 0.3, 0.45, palette.lampPost, STYLE.SMOOTH)
    frame.addOn(x, 0.3, z, 0.2, 3.3, 0.2, palette.lampPost, STYLE.SMOOTH)
    frame.add(x, 3.9, z, 0.5, 0.6, 0.5, light, STYLE.GLOW, 0.785)
    frame.add(x, 4.28, z, 0.72, 0.14, 0.72, '#2b2f38', STYLE.SMOOTH, 0.785)
    frame.addOn(x, 0, z + 1.5, 0.75, 0.5, 0.75, '#c8873a', STYLE.SMOOTH)
    frame.addOn(x, 0.5, z + 1.5, 0.62, 0.45, 0.62, palette.leaves[k % palette.leaves.length], STYLE.STUDS, 0.785)
    if (detail) {
      for (const [dx, dz, f] of [
        [-0.2, -0.16, 0],
        [0.2, -0.08, 1],
        [0, 0.2, 3],
      ]) {
        frame.add(x + dx, 1.02, z + 1.5 + dz, 0.22, 0.22, 0.22, palette.flowers[f], palette.flowerStyle, dx * 3, 0.4)
      }
    }
  }
}

/**
 * Builds every Food Court into the world's block set (and their giant foods into
 * `props`), with lamps and planters on the street between them, lit in `palette`'s
 * lamp colours.
 */
export function buildFoodCourts(blocks, props, { detail = true, palette, decor = null } = {}) {
  streetGaps(blocks, palette, detail)
  for (let i = 0; i < ZONE_COUNT; i += 1) {
    const t = ZONE_THEMES[i]
    const frame = courtFrame(i, blocks)
    // The deck: a dark rim, its floor in the court's colour (zoneDeckRect: 0.4 of rim).
    frame.addOn(0, -0.1, 0, HALF.across * 2 + 0.8, H + 0.1, HALF.depth * 2 + 0.8, t.rim, STYLE.SMOOTH)
    frame.addOn(0, H - 0.06, 0, HALF.across * 2 - 0.3, 0.1, HALF.depth * 2 - 0.3, t.floor, t.floorStyle)
    // A strip of light along its front edge, where you step up.
    frame.addOn(0, H - 0.06, -HALF.depth + 0.05, HALF.across * 2 - 0.3, 0.12, 0.2, t.trim, STYLE.GLOW)

    const roof = shopFront(frame, 0, 0, t, detail)
    const edge = awning(frame, 0, 0, t)
    lamps(frame, 0, 0, t)

    // The kitchen line along the back, left to right: fridge, counter, stove, the house
    // speciality - centred on the solid kitchen band.
    const k = kitchenRect(i)
    const kz = frame.local((k.minX + k.maxX) / 2, (k.minZ + k.maxZ) / 2)[1]
    const x0 = -(HALF.across - 0.6)
    fridge(frame, x0 + 0.6, kz, t.trim, detail)
    counter(frame, x0 + 2.3, kz, 2.2, t.counter, detail)
    stove(frame, x0 + 4.35, kz, 1.9, detail)
    SPECIALS[t.special](frame, x0 + 6.05, kz, 1.4, t)

    // The bench on the seat line, the table in front of it.
    const c = FOOD_COURTS[i]
    const seat = benchSeat(i, c.x, c.z)
    const bz = frame.local(seat.x, seat.z)[1]
    diningBench(frame, 0, bz, t.seat)
    diningTable(frame, 0, bz - TABLE_FORWARD, t, i, detail)

    EXTRAS[t.special](frame, 0, roof, t, detail, edge)
    // The giant roof food is decoration: queued for after the game's playable (decor).
    if (decor) decor.later((later) => roofFood(frame, later, roof, t, i * 1.9))
    else if (props) roofFood(frame, props, roof, t, i * 1.9)
  }
}
