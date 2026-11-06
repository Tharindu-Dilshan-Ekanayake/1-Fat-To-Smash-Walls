/**
 * Lobby layout - "Snack Town": every gameplay-relevant position and trigger area.
 *
 * Shared by the client (which renders it) and the server (which validates positions
 * against it), so the two can never disagree about where a Food Court or the track is.
 *
 * Units are roughly metres - the avatar is 1.8 tall. +X is east, -Z is north: the way
 * to the ROLL ZONE and down the tape track.
 *
 * From above, as you see it from spawn (facing north, the ROLL ZONE ahead):
 *
 *    [6]   aura stand          [ ROLL ZONE ]                 WORLD 2 portal
 *    [5]                              |
 *    [4]   FOOD COURTS                |  (a clear walk)        FOOD SHOP hut
 *    [3]   (left: sit and eat,        |
 *    [2]    1 to 7 in order)          |
 *    [1]   potions              SPAWN       free gift    the champion's statue
 *    [0]                eggs  eggs  eggs  eggs  DEMON EGG    sphinx
 *                       leaderboards (behind you)
 *
 * Rects are `{ minX, maxX, minZ, maxZ }` on the ground plane. Yaws are radians about +Y,
 * 0 facing +Z (south), PI facing north.
 */

/** Where you appear, and which way you face: north, at the ROLL ZONE. */
export const SPAWN = { x: 0, z: 6, yaw: Math.PI }

/** The flat, walkable plaza. Mountains surround it on every side but the track. */
export const PLAZA = { minX: -46, maxX: 46, minZ: -38, maxZ: 34 }

// --- The tape track -------------------------------------------------------------------

/**
 * The top of the hill: the plaza's north edge, where the track starts going down.
 * Track metre m is m metres down the slope from here.
 */
export const TRACK_START_Z = PLAZA.minZ
/**
 * How steeply the track's slopes go: negative, so it runs DOWNHILL from the plaza into
 * the valley - about 9 degrees, steep enough to roll down.
 */
export const SLOPE_ANGLE = -0.16
/** Half the width of the track's floor, between its walls. */
export const TRACK_HALF_WIDTH = 3.8

/** The ROLL ZONE at the top of the track: walking onto it with Fat on you starts a roll. */
export const PUSH_ZONE = { minX: -3.4, maxX: 3.4, minZ: TRACK_START_Z, maxZ: TRACK_START_Z + 5 }
/** Where you're put back after a roll: a little way short of the zone, facing it. */
export const PUSH_RETURN = { x: 0, z: TRACK_START_Z + 13 }
/** Walkable ground; the controller clamps the player into it. Nothing down the track. */
export const WALKABLE = [PLAZA]

// --- The Food Courts (left) ---------------------------------------------------------

/**
 * The Food Courts, in a column down the west (left) side of the plaza, in order: the
 * FREE one (0) at the back (south), by the eggs, and each one after it the next up the
 * column, better each time, to the two shop-pass ones (5, 6) up by the ROLL ZONE. Each
 * is a little restaurant on a raised deck: its kitchen along the back (west), and in
 * front a long bench facing east across its table, at the plaza. Sit on it to eat.
 */
export const ZONE_COUNT = 7
const COURT_X = -35
const COURT_SPACING = 9.6
const COURT_FIRST_Z = 28
export const FOOD_COURTS = Array.from({ length: ZONE_COUNT }, (_, i) => ({
  x: COURT_X,
  z: Math.round((COURT_FIRST_Z - i * COURT_SPACING) * 100) / 100,
  facing: 'east',
}))

/**
 * The ways a restaurant can face, as unit vectors on the ground: `forward` is the way its
 * diners look (out over the table), `across` runs along its bench.
 */
const FACINGS = {
  north: { forward: [0, -1], across: [1, 0] },
  south: { forward: [0, 1], across: [-1, 0] },
  east: { forward: [1, 0], across: [0, 1] },
  west: { forward: [-1, 0], across: [0, -1] },
}
const facingOf = (zone) => FACINGS[FOOD_COURTS[zone].facing] ?? FACINGS.north

/** Half the deck's size: front to back (DEPTH) and across, along its bench (WIDTH). */
const DECK_DEPTH = 6
const DECK_WIDTH = 4
/** The deck's top, a step up from the plaza. */
export const ZONE_HEIGHT = 0.4

/** Food Court `index`'s middle and the way it faces ('north' | 'south' | 'east' | 'west'). */
export const zoneCenter = (index) => FOOD_COURTS[index]

/** Half the size of Food Court `index`'s deck along x and z (it depends which way it faces). */
export function zoneHalf(index) {
  const [fx] = facingOf(index).forward
  return fx !== 0 ? { x: DECK_DEPTH, z: DECK_WIDTH } : { x: DECK_WIDTH, z: DECK_DEPTH }
}

/** The deck of Food Court `index`. */
export function zoneRect(index) {
  const { x, z } = FOOD_COURTS[index]
  const half = zoneHalf(index)
  return { minX: x - half.x, maxX: x + half.x, minZ: z - half.z, maxZ: z + half.z }
}

/** The deck and the dark rim round it: what a locked Food Court walls off. */
export function zoneDeckRect(index) {
  const r = zoneRect(index)
  return { minX: r.minX - 0.4, maxX: r.maxX + 0.4, minZ: r.minZ - 0.4, maxZ: r.maxZ + 0.4 }
}

/**
 * Each Food Court's long bench runs across its deck, a little in front of the middle,
 * facing out over its table: you eat sitting on it - anywhere along it, side by side
 * with others - and walking into it sits you down. Its seat runs BENCH_HALF either way
 * of the middle.
 */
export const BENCH_HALF = 3.2
/** How far in front of the deck's middle the bench's seat line is. */
const BENCH_FORWARD = 0.4
/** How high the seat's top is over the deck. */
export const SEAT_HEIGHT = 0.3
/** Within this of the seat's line, you're on it. */
export const SEAT_REACH = 0.6

/** The way you face sat at Food Court `zone`: out over its table (yaw 0 faces +Z). */
export function seatYaw(zone) {
  const [fx, fz] = facingOf(zone).forward
  return Math.atan2(fx, fz)
}

/** (x, z) in Food Court `zone`'s own terms: how far forward of its middle, how far across. */
function local(zone, x, z) {
  const { forward, across } = facingOf(zone)
  const c = FOOD_COURTS[zone]
  const dx = x - c.x
  const dz = z - c.z
  return { ahead: dx * forward[0] + dz * forward[1], side: dx * across[0] + dz * across[1] }
}

/** The Food Court whose bench is at (x, z) (with `slack` to spare all round), or -1. */
export function benchAt(x, z, slack = 0) {
  for (let i = 0; i < ZONE_COUNT; i += 1) {
    const { ahead, side } = local(i, x, z)
    if (Math.abs(ahead - BENCH_FORWARD) <= SEAT_REACH + slack && Math.abs(side) <= BENCH_HALF + slack) return i
  }
  return -1
}

/**
 * Where on Food Court `zone`'s bench you sit, getting on at (x, z): on the seat line, as
 * far along it as you were, not past its ends. Written into `out` ({ x, z }).
 */
export function benchSeat(zone, x, z, out = { x: 0, z: 0 }) {
  const { forward, across } = facingOf(zone)
  const c = FOOD_COURTS[zone]
  const side = Math.min(BENCH_HALF - 0.3, Math.max(-(BENCH_HALF - 0.3), local(zone, x, z).side))
  out.x = c.x + forward[0] * BENCH_FORWARD + across[0] * side
  out.z = c.z + forward[1] * BENCH_FORWARD + across[1] * side
  return out
}

/** The line of kitchen counters along the back of Food Court `zone`'s deck: a solid rect. */
export function kitchenRect(zone) {
  const { forward, across } = facingOf(zone)
  const c = FOOD_COURTS[zone]
  const back = DECK_DEPTH - 1.1
  const cx = c.x - forward[0] * back
  const cz = c.z - forward[1] * back
  // 0.8 deep (front to back), the deck's width less a bit across.
  const hx = Math.abs(forward[0]) * 0.8 + Math.abs(across[0]) * (DECK_WIDTH - 0.6)
  const hz = Math.abs(forward[1]) * 0.8 + Math.abs(across[1]) * (DECK_WIDTH - 0.6)
  return { minX: cx - hx, maxX: cx + hx, minZ: cz - hz, maxZ: cz + hz }
}

// --- The Food Shop (right) ------------------------------------------------------------

/**
 * The Food Shop: one hut on the east (right) side of the plaza, its counter facing the
 * plaza (west). Walk up to the counter and the shop opens - every food in one list, to
 * buy (in order) and pick what you eat. FOOD_HUT is the hut itself (solid, `half` its
 * size either way); FOOD_COUNTER the spot in front of it where the shop opens.
 */
export const FOOD_HUT = { x: 29, z: -12, half: 3.4 }
export const FOOD_COUNTER = { x: 23, z: -12, radius: 3.2 }

/** Whether (x, z) is at the Food Shop's counter (give or take `slack`). */
export const atFoodCounter = (x, z, slack = 0) => Math.hypot(x - FOOD_COUNTER.x, z - FOOD_COUNTER.z) <= FOOD_COUNTER.radius + slack

// --- Behind spawn: the eggs and the leaderboards; and everything else --------------------

/**
 * The egg stands, in a row behind spawn (south), facing north over the plaza: the four
 * everyday eggs, and the big Demon egg at the east end.
 */
const EGG_ROW_Z = 21
export const EGG_STANDS = [
  { eggId: 'basic', x: -14, z: EGG_ROW_Z, yaw: Math.PI },
  { eggId: 'meadow', x: -5, z: EGG_ROW_Z, yaw: Math.PI },
  { eggId: 'sunset', x: 4, z: EGG_ROW_Z, yaw: Math.PI },
  { eggId: 'unicorn', x: 13, z: EGG_ROW_Z, yaw: Math.PI },
  { eggId: 'demon', x: 23, z: EGG_ROW_Z + 1, yaw: Math.PI, big: true },
]
export const EGG_TRIGGER_RADIUS = 4.2

/** Limited premium pet on display, in the south-east corner. */
export const SPHINX_STAND = { x: 37, z: 23, yaw: -Math.PI * 0.8 }

/** The leaderboards, in a row behind the eggs, facing north over the plaza. */
export const LEADERBOARDS = [
  { id: 'rebirths', x: -12, z: 30.5, yaw: Math.PI },
  { id: 'fat', x: 0, z: 30.5, yaw: Math.PI },
  { id: 'height', x: 12, z: 30.5, yaw: Math.PI },
]

/** The WORLD 2 portal, north-east of the plaza. Name and Coins are WORLD_PORTALS in balance.js. */
export const PORTALS = [{ id: 'future', x: 30, z: -31, radius: 3.6 }]

/**
 * The aura stand (north-west, by the ROLL ZONE, its counter facing south) and the potion
 * stand (west of spawn, its counter facing east): walk up to them to open their panels.
 * The potion stand is a little north of the street from spawn to the FREE Food Court, so
 * walking (or following the tutorial's arrows) straight there neither bumps into it nor
 * opens its panel.
 */
export const AURA_STAND = { x: -17, z: -28, radius: 3.6 }
export const POTION_STAND = { x: -18, z: -2, radius: 3.6 }

/**
 * The champion eater's statue, on the right of the plaza level with spawn - well clear
 * of the ROLL ZONE's gate and of the straight walk up to it (WALKWAY), which nothing
 * stands in.
 */
export const STATUE = { x: 24, z: 6, radius: 2.6 }

/** The straight walk from spawn up to the ROLL ZONE: nothing stands in it. */
export const WALKWAY = { minX: -4.6, maxX: 4.6, minZ: PLAZA.minZ, maxZ: 6 }

export const FREE_REWARD = { x: 7, z: 12, radius: 3 }
export const WATERFALL = { x: 38, z: -38 }

// --- Collision ----------------------------------------------------------------------

const box = (x, z, halfX, halfZ) => ({
  minX: x - halfX,
  maxX: x + halfX,
  minZ: z - halfZ,
  maxZ: z + halfZ,
})

/** Solid, never-changing obstacles. Locked Food Courts add their own walls at runtime. */
export const STATIC_COLLIDERS = [
  // The Food Shop hut.
  box(FOOD_HUT.x, FOOD_HUT.z, FOOD_HUT.half, FOOD_HUT.half),
  // Egg pedestals.
  ...EGG_STANDS.map((s) => box(s.x, s.z, s.big ? 2.1 : 1.6, s.big ? 2.1 : 1.6)),
  box(SPHINX_STAND.x, SPHINX_STAND.z, 3, 3),
  ...LEADERBOARDS.map((b) => box(b.x, b.z, 4.6, 0.5)),
  box(FREE_REWARD.x, FREE_REWARD.z, 1.4, 1.4),
  // Each portal ring's base; the swirl itself is walk-through.
  ...PORTALS.flatMap((p) => [box(p.x - p.radius, p.z, 0.6, 0.8), box(p.x + p.radius, p.z, 0.6, 0.8)]),
  // The stands' counters.
  box(AURA_STAND.x, AURA_STAND.z - 1.2, 2.95, 0.8),
  box(AURA_STAND.x, AURA_STAND.z - 3.5, 4.4, 0.45),
  box(POTION_STAND.x - 1.2, POTION_STAND.z, 0.9, 2.6),
  // The statue's round plinth.
  box(STATUE.x, STATUE.z, STATUE.radius - 0.2, STATUE.radius - 0.2),
  // The cliffs either side of the top of the track.
  { minX: PLAZA.minX, maxX: -TRACK_HALF_WIDTH - 1, minZ: PLAZA.minZ - 1, maxZ: PLAZA.minZ + 0.6 },
  { minX: TRACK_HALF_WIDTH + 1, maxX: PLAZA.maxX, minZ: PLAZA.minZ - 1, maxZ: PLAZA.minZ + 0.6 },
  // Each Food Court's kitchen along its back.
  ...FOOD_COURTS.map((_, i) => kitchenRect(i)),
]

/** Raised floors the player stands on, as rects with a height: the Food Courts' decks. */
export const PLATFORMS = Array.from({ length: ZONE_COUNT }, (_, i) => ({ ...zoneDeckRect(i), height: ZONE_HEIGHT }))

// --- Helpers ------------------------------------------------------------------------

export const inRect = (r, x, z, margin = 0) =>
  x >= r.minX - margin && x <= r.maxX + margin && z >= r.minZ - margin && z <= r.maxZ + margin

/** Index of the Food Court whose deck is under (x, z), or -1. */
export function zoneAt(x, z, margin = 0) {
  for (let i = 0; i < ZONE_COUNT; i += 1) {
    if (inRect(zoneRect(i), x, z, margin)) return i
  }
  return -1
}

export const inPushZone = (x, z, margin = 0) => inRect(PUSH_ZONE, x, z, margin)

/** The portal whose swirl (x, z) is in, give or take `margin`, or null. */
export function portalAt(x, z, margin = 0) {
  for (const p of PORTALS) {
    if (Math.hypot(x - p.x, z - p.z) < p.radius + margin) return p
  }
  return null
}

/**
 * Whether a move from `from` to `to` is the trip back after a roll: off the ROLL ZONE
 * onto PUSH_RETURN. Faster than walking, so the server's speed check lets exactly this
 * one through.
 */
export const isPushReturn = (from, to) =>
  inPushZone(from.x, from.z, 2) && Math.hypot(to.x - PUSH_RETURN.x, to.z - PUSH_RETURN.z) < 2.5

/** The egg stand within reach of (x, z), or null. */
export function eggStandNear(x, z) {
  for (const stand of EGG_STANDS) {
    const reach = EGG_TRIGGER_RADIUS + (stand.big ? 1 : 0)
    if (Math.hypot(stand.x - x, stand.z - z) <= reach) return stand
  }
  return null
}

/** Height of the floor at (x, z): raised platforms, else the ground at 0. */
export function groundHeightAt(x, z) {
  let h = 0
  for (const p of PLATFORMS) {
    if (p.height > h && inRect(p, x, z)) h = p.height
  }
  return h
}

/** Clamps (x, z) into the walkable union, returning the nearest walkable point. */
export function clampToWalkable(x, z, out = { x: 0, z: 0 }) {
  let best = Infinity
  for (const r of WALKABLE) {
    const cx = Math.min(r.maxX, Math.max(r.minX, x))
    const cz = Math.min(r.maxZ, Math.max(r.minZ, z))
    const d = (cx - x) ** 2 + (cz - z) ** 2
    if (d < best) {
      best = d
      out.x = cx
      out.z = cz
      if (d === 0) break
    }
  }
  return out
}

/** Fastest a player can legitimately move, for the server's anti-teleport check. */
export const MAX_MOVE_SPEED = 14
