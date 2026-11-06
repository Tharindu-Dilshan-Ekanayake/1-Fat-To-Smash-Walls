/**
 * The player's body language, shared by the Bloxity avatar and the blocky stand-in so
 * both move the same way.
 *
 * `computePose` turns the motion state into joint angles; each avatar applies them to
 * its own limbs. Angles are radians in character space (the character faces +Z, its
 * left side is +X), about each joint's pivot:
 *   swing - about X: negative swings a limb forward (arm up in front, knee up)
 *   sway  - about Z: positive moves a limb towards +X
 *   twist - about Y: positive turns the right shoulder forward
 * `lift` raises (or, to keep bent legs on the ground, lowers) the body, in metres.
 */


export const POSED_BONES = [
  'Spine1',
  'Neck1',
  'ArmL1',
  'ArmL2',
  'ArmR1',
  'ArmR2',
  'LegL1',
  'LegL2',
  'LegR1',
  'LegR2',
]

/** The Fat at which a body is as round as it gets. */
const FULL_FAT = 200000

/**
 * How fat someone looks for the Fat they carry, 0 (skinny: nothing eaten since the last
 * roll) to 1 (as round as a ball, at FULL_FAT): on a log scale, eased so the first few
 * bites already show - a dozen cookies give you a tummy, a few hundred Fat a proper
 * belly - and it keeps growing a little with every bite. A roll burns the Fat off, so
 * you shrink all the way down the track, and come back skinny.
 */
export function bulkFor(fat = 0) {
  const t = Math.log(1 + Math.max(0, fat) / 6) / Math.log(1 + FULL_FAT / 6)
  return Math.min(1, Math.pow(Math.max(0, t), 0.72))
}

/**
 * How much bigger all over a fat body is drawn, on top of its rounder shape (1 + this,
 * as fat as can be). Shared by your character and everyone else's.
 */
export const FAT_SCALE = 0.6

/**
 * A body grows into its size on a spring, not an ease: a bite's worth of Fat lands and
 * the belly pops out a touch past it, then settles - it bounces bigger. Stiffness and
 * damping (per second): a quick pop with one soft overshoot.
 */
const GROW_STIFFNESS = 70
const GROW_DAMPING = 10

/** Springs `motion.bulk` towards `target`; a body with no size yet (-1) takes it at once. */
export function growBody(motion, target, delta) {
  if (!(motion.bulk >= 0)) {
    motion.bulk = target
    motion.bulkVel = 0
    return
  }
  const vel = (motion.bulkVel ?? 0) + ((target - motion.bulk) * GROW_STIFFNESS - (motion.bulkVel ?? 0) * GROW_DAMPING) * delta
  motion.bulkVel = vel
  motion.bulk = Math.max(0, motion.bulk + vel * delta)
}

/**
 * How a blocky stand-in's parts are built against its own, skinny (bulk 0) and fat (1):
 * the torso's width and depth, the arms' and the legs' width and depth. (The real
 * avatar's body is fatBody's.)
 */
const SKINNY = { chestX: 0.6, torsoZ: 0.7, armX: 0.5, armZ: 0.6, legX: 0.66, legZ: 0.72 }
const FAT = { chestX: 2.3, torsoZ: 3.2, armX: 1.5, armZ: 1.4, legX: 1.35, legZ: 1.3 }
const BUILD_KEYS = Object.keys(SKINNY)
const build = { ...SKINNY }

/** The build (see SKINNY) of a body of `bulk`: one shared result, to use at once. */
export function bodyBuild(bulk = 0.5) {
  const t = Math.min(1, Math.max(0, bulk))
  for (const key of BUILD_KEYS) build[key] = SKINNY[key] + (FAT[key] - SKINNY[key]) * t
  return build
}

/**
 * A classic blocky figure's part of `kind` ('torso', 'arm' or 'leg'; anything else is
 * left be), on `side` (+1 left, -1 right), built as `b`: writes its width and depth
 * multipliers and its middle's x, in studs, into `out` as (x, y, z). Arms and legs stay
 * at the body's sides however round it gets.
 */
export function blockyPart(kind, side, b, out) {
  if (kind === 'torso') return out.set(b.chestX, b.torsoZ, 0)
  if (kind === 'arm') return out.set(b.armX, b.armZ, side * (b.chestX + 0.5 * b.armX))
  if (kind === 'leg') return out.set(b.legX, b.legZ, side * 0.5 * b.legX)
  return out.set(1, 1, 0)
}

/** Written by `computePose` every frame; one shared result, never reallocated. */
export const pose = {
  lift: 0,
  bones: Object.fromEntries(POSED_BONES.map((name) => [name, { swing: 0, sway: 0, twist: 0 }])),
}

/** Sway sign that moves a limb away from the body, per side. */
const OUT_L = 1
const OUT_R = -1

const clamp01 = (x) => Math.min(1, Math.max(0, x))
const lerp = (a, b, t) => a + (b - a) * t
const smooth = (edge0, edge1, x) => {
  const t = clamp01((x - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

/** Adds to a joint, scaled by weight `w`. */
function add(name, swing, sway, twist, w) {
  const b = pose.bones[name]
  b.swing += swing * w
  b.sway += sway * w
  b.twist += twist * w
}

/** Relaxed stance: arms hanging a little out from the sides, knees soft, breathing. */
function stance(w, time) {
  const breath = Math.sin(time * 1.8)
  add('LegL1', -0.04, 0.06 * OUT_L, 0, w)
  add('LegL2', 0.08, 0, 0, w)
  add('LegR1', 0.04, 0.06 * OUT_R, 0, w)
  add('LegR2', 0.08, 0, 0, w)
  add('Spine1', -0.03 + breath * 0.015, 0, 0, w)
  add('ArmL1', -0.08 + breath * 0.03, 0.14 * OUT_L, 0, w)
  add('ArmL2', -0.25, 0, 0, w)
  add('ArmR1', -0.08 + breath * 0.03, 0.14 * OUT_R, 0, w)
  add('ArmR2', -0.25, 0, 0, w)
  pose.lift += (-0.01 + breath * 0.006) * w
}

/**
 * Standing about: a little dance to yourself - a bounce in the knees on the beat, a
 * sway, the arms swinging along.
 */
function grooving(time, w) {
  const beat = time * 4.2
  const bob = Math.sin(beat)
  const sway = Math.sin(beat * 0.5)
  add('LegL1', -0.08 * Math.max(0, bob), 0, 0, w)
  add('LegR1', -0.08 * Math.max(0, -bob), 0, 0, w)
  add('LegL2', 0.18 * Math.max(0, bob), 0, 0, w)
  add('LegR2', 0.18 * Math.max(0, -bob), 0, 0, w)
  add('Spine1', 0, sway * 0.07, sway * 0.12, w)
  add('Neck1', 0, -sway * 0.08, 0, w)
  add('ArmL1', -0.22 - 0.22 * Math.max(0, bob), 0, 0, w)
  add('ArmR1', -0.22 - 0.22 * Math.max(0, -bob), 0, 0, w)
  add('ArmL2', -0.45, 0, 0, w)
  add('ArmR2', -0.45, 0, 0, w)
  pose.lift -= Math.abs(bob) * 0.03 * w
}

/**
 * Walk to sprint: arms and legs swing against each other, the body leans in and bobs
 * once per step. `phase` advances faster with speed, so the steps quicken.
 */
function stride(phase, ratio, bulk = 0) {
  const cycle = Math.sin(phase)
  // Fat legs swing less far, the arms barely (they're resting on the belly), and the
  // whole body rocks from foot to foot: a waddle.
  const leg = (0.85 - 0.35 * bulk) * ratio
  const arm = (0.75 - 0.45 * bulk) * ratio
  add('Spine1', 0, cycle * 0.16 * bulk * ratio, 0, 1)
  add('Neck1', 0, -cycle * 0.1 * bulk * ratio, 0, 1)
  add('LegL1', 0, 0.1 * OUT_L * bulk * ratio, 0, 1)
  add('LegR1', 0, 0.1 * OUT_R * bulk * ratio, 0, 1)
  add('LegL1', cycle * leg, 0, 0, 1)
  add('LegR1', -cycle * leg, 0, 0, 1)
  // Knees fold on the back swing only.
  add('LegL2', Math.max(0, -cycle) * 1.1 * ratio, 0, 0, 1)
  add('LegR2', Math.max(0, cycle) * 1.1 * ratio, 0, 0, 1)
  add('ArmL1', -cycle * arm, 0.08 * OUT_L * ratio, 0, 1)
  add('ArmR1', cycle * arm, 0.08 * OUT_R * ratio, 0, 1)
  add('ArmL2', -(0.35 + Math.max(0, -cycle) * 0.5) * ratio, 0, 0, 1)
  add('ArmR2', -(0.35 + Math.max(0, cycle) * 0.5) * ratio, 0, 0, 1)
  add('Spine1', -(0.08 + 0.14 * ratio) * ratio, 0, cycle * 0.12 * ratio, 1)
  pose.lift += (Math.abs(Math.cos(phase)) * 0.05 - 0.015) * ratio
}

/**
 * In the air: one knee up and the arms out on the way up; falling, the legs straighten
 * and reach down for the ground.
 */
function airborne(vy) {
  const f = smooth(0, 1, clamp01((2 - vy) / 9))
  add('LegL1', lerp(-1.3, -0.35, f), 0.08 * OUT_L, 0, 1)
  add('LegL2', lerp(1.6, 0.25, f), 0, 0, 1)
  add('LegR1', lerp(0.25, -0.1, f), 0.08 * OUT_R, 0, 1)
  add('LegR2', lerp(0.5, 0.2, f), 0, 0, 1)
  add('ArmL1', lerp(-0.35, -0.6, f), lerp(1.15, 1.45, f) * OUT_L, 0, 1)
  add('ArmL2', -0.35, 0, 0, 1)
  add('ArmR1', lerp(-0.25, -0.5, f), lerp(1.05, 1.35, f) * OUT_R, 0, 1)
  add('ArmR2', -0.4, 0, 0, 1)
  add('Spine1', lerp(-0.15, 0.06, f), 0, 0, 1)
}

/**
 * Curled up into a ball to roll: knees hugged to the chest, chin tucked, back rounded -
 * the whole body then turns about its middle (see Player). `w` blends it in.
 */
function tucked(w) {
  add('Spine1', -0.55, 0, 0, w)
  add('Neck1', 0.45, 0, 0, w)
  add('LegL1', -2.2, 0.12 * OUT_L, 0, w)
  add('LegR1', -2.2, 0.12 * OUT_R, 0, w)
  add('LegL2', 2.3, 0, 0, w)
  add('LegR2', 2.3, 0, 0, w)
  add('ArmL1', -1.25, -0.1 * OUT_L, 0, w)
  add('ArmR1', -1.25, -0.1 * OUT_R, 0, w)
  add('ArmL2', -1.5, 0, 0, w)
  add('ArmR2', -1.5, 0, 0, w)
}

/** How far sitting on the ground lowers the body: hips from standing height to the floor. */
const FLOOR_DROP = 0.72

/**
 * Out of Fat at the end of a roll: sat in a heap on the track, legs out, leaning back
 * on your hands, your head going round and round. `w` blends it in.
 */
function dizzy(time, w) {
  const spin = time * 7
  add('LegL1', -1.45, 0.25 * OUT_L, 0, w)
  add('LegR1', -1.45, 0.25 * OUT_R, 0, w)
  add('LegL2', 0.15, 0, 0, w)
  add('LegR2', 0.15, 0, 0, w)
  add('Spine1', 0.3 + Math.sin(spin) * 0.06, Math.cos(spin) * 0.08, 0, w)
  add('Neck1', Math.sin(spin) * 0.22, Math.cos(spin) * 0.22, 0, w)
  add('ArmL1', 0.55, 0.35 * OUT_L, 0, w)
  add('ArmR1', 0.55, 0.35 * OUT_R, 0, w)
  add('ArmL2', -0.2, 0, 0, w)
  add('ArmR2', -0.2, 0, 0, w)
  pose.lift -= FLOOR_DROP * w
}

/** A bite's parts, as shares of it: hands up to the mouth, the chomping, hands down. */
const BITE_UP = 0.22
const BITE_DOWN = 0.8
const CHOMPS = 3

/**
 * How hard you're chomping `t` (0-1) through a bite: 0, then three bumps up to 1 - one
 * a chomp - while the food's at your mouth, then 0 again. The player squashes the food
 * and crunches on each.
 */
export function chewAt(t) {
  if (!(t > BITE_UP && t < BITE_DOWN)) return 0
  return Math.max(0, Math.sin(((t - BITE_UP) / (BITE_DOWN - BITE_UP)) * Math.PI * CHOMPS))
}

/**
 * A bite, `t` 0-1 through it, for a body `bulk` (0-1) fat: both hands bring the food up
 * in front of your face (elbows out, hands turned in to hold it between them), three big
 * chomps - the head diving into it, the shoulders hunching, a little bounce on each -
 * and down again. A very fat body's arms can't reach round to the middle any more, so
 * the head leans over and chomps it from the side.
 */
function eating(t, w = 1, bulk = 0) {
  const x = clamp01(t)
  const up = x < BITE_UP ? smooth(0, BITE_UP, x) : x > BITE_DOWN ? 1 - smooth(BITE_DOWN, 1, x) : 1
  const chew = chewAt(x)
  const reach = -0.6 - 0.2 * bulk
  const inward = 0.8 + 0.5 * bulk
  const turn = 1 + 0.15 * bulk
  const bend = -1.9 + 0.1 * bulk
  add('ArmR1', reach * up, -inward * OUT_R * up, turn * up, w)
  add('ArmR2', bend * up, 0, 0, w)
  add('ArmL1', reach * up, -inward * OUT_L * up, -turn * up, w)
  add('ArmL2', bend * up, 0, 0, w)
  // The head: forward into the food, nodding on each chomp; leaning over to the food
  // hand's side when the arms are too short to bring it round.
  const lean = smooth(0.55, 1, bulk) * up
  add('Neck1', 0.12 * up + 0.24 * chew, 0.35 * OUT_R * lean, 0.45 * lean, w)
  add('Spine1', -0.05 * up - 0.06 * chew, 0, 0, w)
  pose.lift += 0.035 * chew * w
}

/**
 * Full up after a feed: both hands on the belly, leaning back to stick it out, patting
 * it - one hand then the other, pat, pat, pat. `t` 0-1 through it; `w` blends it in.
 */
function patting(t, w) {
  const beat = clamp01(t) * Math.PI * 6
  const left = Math.max(0, Math.sin(beat))
  const right = Math.max(0, -Math.sin(beat))
  add('ArmL1', -0.3 - 0.18 * left, -1 * OUT_L, -1, w)
  add('ArmR1', -0.3 - 0.18 * right, -1 * OUT_R, 1, w)
  add('ArmL2', -1 - 0.3 * left, 0, 0, w)
  add('ArmR2', -1 - 0.3 * right, 0, 0, w)
  add('Spine1', 0.08, 0, 0, w)
  add('Neck1', -0.14, 0, 0, w)
}

/**
 * Fat arms don't hang straight down: they rest out on the belly, and the legs stand a
 * little apart. Added on top of whatever else the body's doing, by how fat it is.
 */
function chubby(bulk, w = 1) {
  add('ArmL1', 0, 0.3 * OUT_L * bulk, 0, w)
  add('ArmR1', 0, 0.3 * OUT_R * bulk, 0, w)
  add('LegL1', 0, 0.06 * OUT_L * bulk, 0, w)
  add('LegR1', 0, 0.06 * OUT_R * bulk, 0, w)
}

/** How far sitting lowers the body: from standing hips down to just over a bench seat. */
const SIT_DROP = 0.26

/**
 * Sat on a bench at a Food Court table: thighs out level in front, shins straight down
 * to the floor, sitting up, the left hand resting on its knee (the right one eats).
 */
function seated(time) {
  const breath = Math.sin(time * 1.8)
  add('LegL1', -1.5, 0.14 * OUT_L, 0, 1)
  add('LegR1', -1.5, 0.14 * OUT_R, 0, 1)
  add('LegL2', 1.5, 0, 0, 1)
  add('LegR2', 1.5, 0, 0, 1)
  add('Spine1', 0.04 + breath * 0.015, 0, 0, 1)
  add('ArmL1', -0.45, 0.12 * OUT_L, 0, 1)
  add('ArmL2', -0.7, 0, 0, 1)
  add('ArmR1', -0.1, 0.12 * OUT_R, 0, 1)
  add('ArmR2', -0.3, 0, 0, 1)
  pose.lift -= SIT_DROP
}

/** Arms up and waving, bouncing on the spot: the celebration at the end of the track. */
function cheering(time, w) {
  const wave = Math.sin(time * 10) * 0.28
  add('ArmL1', -2.7 + wave, 0.38 * OUT_L, 0, w)
  add('ArmR1', -2.7 - wave, 0.38 * OUT_R, 0, w)
  add('ArmL2', -0.25, 0, 0, w)
  add('ArmR2', -0.25, 0, 0, w)
  add('LegL1', -0.12, 0.06 * OUT_L, 0, w)
  add('LegR1', -0.12, 0.06 * OUT_R, 0, w)
  add('LegL2', 0.22, 0, 0, w)
  add('LegR2', 0.22, 0, 0, w)
  add('Spine1', 0.1, 0, 0, w)
  add('Neck1', -0.15, 0, 0, w)
  pose.lift += Math.abs(Math.sin(time * 7)) * 0.16 * w
}

/** The win dance: fists punching the air in turn, hips swinging, bouncing to the beat. */
function dancing(time, w) {
  const beat = time * 7
  const a = Math.sin(beat)
  const sway = Math.sin(beat * 0.5)
  add('ArmL1', -2.5 + a * 0.55, 0.32 * OUT_L, 0, w)
  add('ArmR1', -2.5 - a * 0.55, 0.32 * OUT_R, 0, w)
  add('ArmL2', -0.35 - Math.max(0, a) * 0.9, 0, 0, w)
  add('ArmR2', -0.35 - Math.max(0, -a) * 0.9, 0, 0, w)
  add('Spine1', 0.06, sway * 0.16, sway * 0.3, w)
  add('Neck1', -0.1, -sway * 0.12, 0, w)
  add('LegL1', -0.35 * Math.max(0, a), 0.1 * OUT_L, 0, w)
  add('LegR1', -0.35 * Math.max(0, -a), 0.1 * OUT_R, 0, w)
  add('LegL2', 0.6 * Math.max(0, a), 0, 0, w)
  add('LegR2', 0.6 * Math.max(0, -a), 0, 0, w)
  pose.lift += Math.abs(a) * 0.14 * w
}

/** Seconds per automatic bite at a Food Court (TRAIN_INTERVAL in balance.js). */
const TRAIN_PERIOD = 0.8

/** How far (0-1) through a table bite you are at `time` (seconds): the Food Court loop. */
export const tableBiteAt = (time) => (time / TRAIN_PERIOD) % 1

/**
 * @param {{ time?: number, speed?: number, maxSpeed?: number, grounded?: boolean,
 *   vy?: number, stride?: number, rolling?: boolean, tired?: number, cheer?: number,
 *   curl?: number, training?: boolean, sitting?: boolean, dance?: number, bulk?: number }} motion
 *   `rolling` curls you up into a ball for the roll down the track (the player turns
 *   the ball), `tired` (0-1) sits you down in a dizzy heap when the Fat runs out and
 *   `cheer` (0-1) is the celebration at the end. Otherwise `curl` (0-1) is a bite in
 *   progress (0 = none), `sitting` sits you on a bench and `training` eats on a loop, at
 *   a Food Court's table, and `dance` (0-1) is the win dance. `bulk` (0-1, how fat you
 *   are) rests your arms out on your belly.
 */
export function computePose(motion) {
  const {
    time = 0,
    speed = 0,
    maxSpeed = 6,
    grounded = true,
    vy = 0,
    stride: phase = time * 5,
    rolling = false,
    tired = 0,
    cheer = 0,
    curl = 0,
    training = false,
    sitting = false,
    dance = 0,
  } = motion
  const bulk = Math.min(1, Math.max(0, motion.bulk ?? 0))
  /** 0-1: a happy little hop, arms up (a purchase, a level up, a rebirth). */
  const happy = Math.min(1, Math.max(0, motion.happy ?? 0))
  /** 0-1 through a full-belly pat after a feed (0: not patting), and how much of it shows. */
  const pat = motion.pat ?? 0
  const patWeight = motion.patWeight ?? 0
  for (const name of POSED_BONES) {
    const b = pose.bones[name]
    b.swing = 0
    b.sway = 0
    b.twist = 0
  }
  pose.lift = 0

  if (rolling) {
    if (cheer > 0) {
      tucked(1 - cheer)
      stance(cheer, time)
      cheering(time, cheer)
      chubby(bulk, cheer)
    } else if (tired > 0) {
      tucked(1 - tired)
      dizzy(time, tired)
    } else tucked(1)
    return pose
  }
  if (sitting) {
    seated(time)
  } else if (grounded) {
    const ratio = clamp01(speed / Math.max(maxSpeed, 0.001))
    const still = (1 - smooth(0.05, 0.4, ratio)) * (1 - dance) * (1 - happy)
    stance(still, time)
    if (still > 0.01) grooving(time, still)
    if (ratio > 0.02) stride(phase, ratio, bulk)
    if (dance > 0) dancing(time, dance)
    if (happy > 0) cheering(time, happy)
    if (patWeight > 0 && curl === 0) patting(pat, patWeight)
  } else {
    airborne(vy)
  }
  chubby(bulk)
  if (training) eating(tableBiteAt(time), 1, bulk)
  else if (curl > 0) eating(curl, 1, bulk)
  return pose
}
