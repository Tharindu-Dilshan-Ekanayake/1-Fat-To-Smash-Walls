import { Vector3 } from 'three'

import { PUSH_START, RUN_SPEED, SPEED_PER_TAPE, TOP_SPEED } from '@shared/balance'
import { formatNumber } from '@shared/format'
import { coinsMultiplier } from '@shared/logic'
import { PUSH_RETURN, SPAWN, TRACK_HALF_WIDTH } from '@shared/world'

import { sfx } from '../../audio/sfx'
import { actions } from '../../net/actions'
import { getGame } from '../../store/game'
import { flyCoins } from '../../ui/coinsFly'
import { fadeThrough } from '../../ui/fade'
import { iconUrl } from '../../ui/icons'
import { burst } from '../fx/fxQueue'
import { spawnPopup } from '../fx/popups'
import { runtime } from '../runtime'
import { STAGES, stageAt, TRACK_LENGTH, WALLS } from './course'
import { feetPoint } from './path'
import { BRICK_D, chipColors } from './wallLook'

/** Position reports to the authority while running, and at least this often regardless. */
const REPORT_MS = 200
const KEEPALIVE_MS = 5000
/** Sideways steering speed, m/s (a little less while still getting going). */
const STEER_SPEED = 6
/** Sprinting off: how fast you get up to RUN_SPEED (m/s²). */
const ACCEL = 12
/**
 * Through the very last wall you run on over the finish this far (m) - slowing to a stop
 * at DECEL m/s² - so the last smash is at full tilt, not a crawl.
 */
export const FINISH_RUN = 12
const DECEL = 7
/**
 * A wall too strong for you: your belly slams into it and it gives a little (BLOCK_PRESS
 * m), gripping you harder and harder (BLOCK_GRIP per second), and as far as it gives - or
 * as you're all but stopped - it throws you back (BOUNCE_SPEED m/s back up the track,
 * settling at BOUNCE_SETTLE per second).
 */
export const BLOCK_PRESS = 0.35
const BLOCK_GRIP = 9
const BOUNCE_SPEED = 7
const BOUNCE_SETTLE = 4
/**
 * A wall you're fat enough for: your belly slams into it and drives it in, the bricks
 * bulging and cracking, as far as its press depth (PRESS_MIN to PRESS_MAX m: shallower
 * the more Fat you have to spare - a wall a sliver of your Fat bursts at the touch),
 * slowing you to a shove (PRESS_START down to PRESS_END m/s); then BOOM - a freeze-frame
 * (HIT_STOP_MS at HIT_STOP_SCALE speed), slow motion easing back up to full speed
 * (SLOWMO_MS from SLOWMO_SCALE; longer for a run's first smash), and you burst out the
 * far side at SMASH_SPEED m/s, easing back to cruising at BOOST_FADE m/s².
 */
const PRESS_MIN = 0.08
const PRESS_MAX = 0.7
/**
 * However weak the wall, it never gives further than this, plus PRESS_PER_BELLY of how far
 * your belly sticks out: your belly caves it in, it doesn't swallow you.
 */
const PRESS_CAP = 0.2
const PRESS_PER_BELLY = 0.6
/** A wall's near face is this far short of its metre (it's BRICK_D thick): where bellies meet it. */
export const WALL_FACE = BRICK_D / 2
const PRESS_START = 5
const PRESS_END = 1.6
const PRESS_GRIP = 14
const HIT_STOP_MS = 70
const HIT_STOP_SCALE = 0.05
const SLOWMO_FIRST_MS = 420
const SLOWMO_MS = 260
const SLOWMO_SCALE = 0.3
const SMASH_SPEED = 17
const BOOST_FADE = 5
/** Thrown back by a wall too strong: how long you sit there, dizzy, before it's back to the lobby. */
const BLOCKED_HOLD_MS = 2200
/** At the end of the track: how long the celebration plays before you're home. */
const TOP_HOLD_MS = 3800
/** Back in the lobby: this long into the dance, the Coins start flying home. */
const FLY_HOME_MS = 550

/**
 * The run in progress, read every frame by the player, the camera, the track, the walls
 * and their effects (it's called `push` in the protocol: see shared/session.js).
 *
 * The authority tells us its power (`power`: your Fat when you set off) and where it's
 * stopped (`reach`: the first wall too strong for it, or the end). You sprint off from
 * the SMASH ZONE and run on your own, steering left and right. Every brick wall your Fat
 * is enough for you smash through belly-first - faster and faster - until the one that's
 * too strong: you bounce off it, dizzy, and it's back to the Lobby. Or you burst through
 * the very last wall to the finish. You keep your Fat all the while.
 *
 * Your logical position stays on the SMASH ZONE in the plaza throughout (that's what the
 * server checks of it); only what's drawn goes down the track, and where that is we
 * report as we go.
 */
export const push = {
  active: false,
  /** 'run' | 'blocked' (bounced off a wall too strong) | 'top' (made it to the end!) */
  phase: 'run',
  startedAt: 0,
  /** The Fat this run set off with, and the furthest metre it gets you to. */
  power: 0,
  reach: 0,
  /** Where this run started: just short of the start of the first slope. */
  start: PUSH_START,
  /** Where your feet are along the track, and across it. */
  meter: PUSH_START,
  x: 0,
  /** Metres a second down the track. */
  speed: 0,
  /** The stage you're running down. */
  stage: 0,
  /**
   * How far your belly sticks out in front of your feet (m), and how high its middle is
   * over them: what hits the walls. The player keeps them up to date as you're drawn.
   */
  radius: 0.5,
  bellyY: 0.9,
  /** 0-1: the camera's jolt from the last wall smashed (FollowCamera settles it). */
  shake: 0,
  /** 0-1: the camera's widening rush off the last wall smashed (FollowCamera settles it). */
  punch: 0,
  /** 0-1: straining against a wall too strong. */
  strain: 0,
  /**
   * Walls smashed this run, by stage: when (performance.now()), where across and how high
   * your belly hit them, and how fast you were going - what their bricks fly off with.
   */
  wallsBroken: [],
  wallAt: [],
  wallBreakX: [],
  wallBreakY: [],
  wallBreakSpeed: [],
  /** How deep each wall gives before it bursts (m), by stage: see pressDepth. */
  pressDepth: [],
  /** When your belly first hit each wall, by stage (0 not yet). */
  wallHitAt: [],
  /** 0-1: how far into its press depth you're driving the wall you're up against, and which (-1 none). */
  press: 0,
  pressWall: -1,
  /** The last smash (performance.now()), and how long its slow motion lasts. */
  smashAt: -1e9,
  slowmoMs: SLOWMO_MS,
  /** The first wall too strong for this run's Fat (null: none, you'll run to the end). */
  blocker: null,
  /** Where across and how high your belly hit the wall that stopped you. */
  blockX: 0,
  blockY: 0,
  /** Coins this run has made so far (the authority pays them; this is for show). */
  coins: 0,
  /** When the run was decided: bounced off a wall, or the end reached. */
  endedAt: 0,
  /** Set once we've told the authority it's over, so its echo isn't handled twice. */
  ending: false,
  /** Your feet's spot on the track (for the camera, shadows and effects). */
  position: new Vector3(),
}

let reportTimer = null
let holdTimer = null
let lastReport = { meter: NaN, x: NaN, at: 0 }

function clearTimers() {
  clearInterval(reportTimer)
  clearTimeout(holdTimer)
  reportTimer = null
  holdTimer = null
}

/**
 * Shows a banner. Deferred to a timer: these are reached from the frame loop, which must
 * never update React state itself.
 */
const showBanner = (banner) => setTimeout(() => getGame().showPushBanner(banner), 0)

/** How far across the track you may go: clear of the cliffs. */
const maxX = () => TRACK_HALF_WIDTH - 0.9

/**
 * How fast time runs for the run at `now`: a freeze-frame as a wall bursts, then slow
 * motion easing back up to full speed. 1 the rest of the time. Allocation-free: the
 * player, the walls' bricks and the effects all slow down by it together.
 */
export function pushTimeScale(now = performance.now()) {
  if (!push.active) return 1
  const since = now - push.smashAt
  if (since < 0 || since >= HIT_STOP_MS + push.slowmoMs) return 1
  if (since < HIT_STOP_MS) return HIT_STOP_SCALE
  const t = (since - HIT_STOP_MS) / push.slowmoMs
  return SLOWMO_SCALE + (1 - SLOWMO_SCALE) * t * t
}

/** Metres from your belly to the face of the next wall still standing ahead (Infinity: none). */
export function nextWallAhead() {
  for (const wall of WALLS) {
    if (push.wallsBroken.includes(wall.stage)) continue
    return wall.meter - WALL_FACE - (push.meter + push.radius)
  }
  return Infinity
}

/** How far your belly drives wall `stage` in before it bursts (m), for the belly you have now. */
export const wallDepth = (stage) => Math.min(push.pressDepth[stage] ?? PRESS_MAX, PRESS_CAP + PRESS_PER_BELLY * push.radius)

/** How far your belly is into wall `wall` (m past its near face; <= 0 not touching). */
const intoWall = (wall) => push.meter + push.radius - (wall.meter - WALL_FACE)

/**
 * Tells the authority where we've got to, when that's changed - and every few seconds
 * regardless, so sitting there dizzy isn't taken for a dropped run. Never past the end of
 * the track (the run on over the finish is just for show).
 */
function report() {
  if (!push.active) return
  const meter = Math.round(Math.min(push.meter, TRACK_LENGTH) * 100) / 100
  const x = Math.round(push.x * 100) / 100
  const now = performance.now()
  if (meter === lastReport.meter && x === lastReport.x && now - lastReport.at < KEEPALIVE_MS) return
  lastReport = { meter, x, at: now }
  actions.pushAt(meter, x)
}

const place = () => feetPoint(push.meter, push.x, push.position)

/** Your Fat: running, what you set off with (it doesn't run down); else your Fat now. */
export function powerLeft() {
  return push.active ? push.power : getGame().profile.fat
}

/** How deep a wall needing `need` gives under a belly of `power` Fat before it bursts. */
const pressDepthFor = (need, power) => PRESS_MIN + (PRESS_MAX - PRESS_MIN) * Math.min(1, need / Math.max(1e-9, power)) ** 0.6

/** The run the authority gave us: sprint off down the track. */
export function beginPush({ reach, power, start, x }) {
  clearTimers()
  Object.assign(push, {
    active: true,
    phase: 'run',
    startedAt: performance.now(),
    power,
    reach,
    start,
    meter: start,
    x: 0,
    speed: 0,
    stage: 0,
    shake: 0,
    punch: 0,
    strain: 0,
    press: 0,
    pressWall: -1,
    smashAt: -1e9,
    slowmoMs: SLOWMO_MS,
    coins: 0,
    endedAt: 0,
    ending: false,
  })
  push.x = Math.max(-maxX(), Math.min(maxX(), x))
  push.wallsBroken = []
  push.wallAt = []
  push.wallBreakX = []
  push.wallBreakY = []
  push.wallBreakSpeed = []
  push.wallHitAt = []
  push.pressDepth = WALLS.map((wall) => pressDepthFor(wall.need, power))
  push.blocker = WALLS.find((wall) => wall.need > power) ?? null
  place()
  runtime.player.frozen = true
  runtime.camera.mode = 'push'
  runtime.focus = push.position
  lastReport = { meter: NaN, x: NaN, at: 0 }
  const game = getGame()
  // The Coins counter holds where it is: what the run makes flies home at the end.
  game.holdCoins(game.profile.coins)
  game.setPushing(true)
  game.setClimb('run')
  reportTimer = setInterval(report, REPORT_MS)
  sfx.dash()
  sfx.runStart()
}

const _at = new Vector3()
const COIN = iconUrl('coin')

/** Where your belly meets a wall at metre `meter`: written into `_at`. */
function bellyOn(meter) {
  feetPoint(meter, push.x, _at)
  _at.y += push.bellyY
  return _at
}

/** Grit and chips crumble off a wall your belly's driving into: a little burst every CRUMBLE_MS. */
const CRUMBLE_MS = 70
let lastCrumble = 0
function crumble(now, wall) {
  if (now - lastCrumble < CRUMBLE_MS) return
  lastCrumble = now
  bellyOn(wall.meter)
  burst({ x: _at.x, y: _at.y, z: _at.z, count: 5, palette: 'dust', speed: 4 })
  burst({ x: _at.x, y: _at.y, z: _at.z, count: 3, colors: chipColors(STAGES[wall.stage].id), speed: 5 })
}

/** Your belly's first touch on a wall: a THUMP, a jolt, and the wall flashing where it's hit. */
function slam(now, wall) {
  push.wallHitAt[wall.stage] = now
  push.shake = Math.max(push.shake, 0.35)
  sfx.wallThump(push.radius)
}

/** What `coins` (before multipliers) pays you now. */
const paid = (coins) => Math.max(1, Math.round(coins * coinsMultiplier(getGame().profile, Date.now())))

/**
 * The walls ahead: the next one you can smash, slammed into, gives under your belly
 * (`push.press`, for its bricks and the sound) and holds you back; driven in as far as it
 * goes, it BURSTS - once a run (the authority pays it, when our next report reaches it):
 * a freeze-frame into slow motion, its bricks flying (Walls.jsx), chips, dust and gold,
 * the Coins popping off it, a jolt of the camera, and you burst out the far side.
 */
function smashWalls(now) {
  push.press = 0
  push.pressWall = -1
  for (const wall of WALLS) {
    if (push.wallsBroken.includes(wall.stage)) continue
    const into = intoWall(wall)
    if (into <= 0) break
    if (wall.need > push.power + 1e-6) break
    if (!push.wallHitAt[wall.stage]) slam(now, wall)
    const depth = wallDepth(wall.stage)
    if (into < depth) {
      push.press = into / depth
      push.pressWall = wall.stage
      sfx.wallCrack(push.press)
      crumble(now, wall)
      break
    }
    push.wallsBroken.push(wall.stage)
    push.wallAt[wall.stage] = now
    push.wallBreakX[wall.stage] = push.x
    push.wallBreakY[wall.stage] = push.bellyY
    push.wallBreakSpeed[wall.stage] = Math.max(push.speed, PRESS_START)
    const coins = paid(wall.coins)
    push.coins += coins
    push.shake = 1
    push.punch = 1
    push.smashAt = now
    push.slowmoMs = push.wallsBroken.length === 1 ? SLOWMO_FIRST_MS : SLOWMO_MS
    push.speed = Math.max(push.speed, SMASH_SPEED)
    report()
    bellyOn(wall.meter)
    // The very last wall is gold, and so are its chips.
    const chips = wall.stage === STAGES.length - 1 ? null : chipColors(STAGES[wall.stage].id)
    burst({ x: _at.x, y: _at.y, z: _at.z, count: 36, palette: 'gold', colors: chips, speed: 11 })
    burst({ x: _at.x, y: _at.y - 0.3, z: _at.z, count: 30, palette: 'dust', speed: 7 })
    burst({ x: _at.x, y: _at.y + 0.5, z: _at.z, count: 18, palette: 'gold', speed: 7 })
    spawnPopup(`+${formatNumber(coins)}`, _at.setY(_at.y + push.bellyY + 0.8), { iconUrl: COIN, scale: 1.6, follow: push.position })
    sfx.wallSmash(push.radius)
    sfx.coins()
    showBanner({ kind: 'wall', stage: wall.stage, coins, streak: push.wallsBroken.length })
  }
}

/**
 * Runs on by `rawDelta` seconds, steering by `side` (-1..1). Called by the player's frame
 * loop while running.
 */
export function advancePush(rawDelta, { side }) {
  if (!push.active) return
  const now = performance.now()
  // A wall bursting: a freeze-frame, then slow motion.
  const delta = rawDelta * pushTimeScale(now)

  if (push.phase === 'blocked') {
    // Thrown back up the track by the wall, the bounce settling.
    push.speed *= Math.exp(-BOUNCE_SETTLE * delta)
    push.meter += push.speed * delta
    place()
    sfx.runSet(0, 0)
    return
  }
  if (push.phase !== 'run' || push.ending) {
    // Done: what's left of the speed bleeds away where you are.
    push.speed *= Math.exp(-8 * delta)
    sfx.runSet(0, 0)
    return
  }

  // --- Speed: sprint off and run, faster with every wall smashed (and a burst off each
  // one), shove through a wall giving way, slow to a stop past the finish ------------
  const cruise = Math.min(TOP_SPEED, RUN_SPEED + SPEED_PER_TAPE * push.wallsBroken.length)
  if (push.speed < cruise) push.speed = Math.min(cruise, push.speed + ACCEL * delta)
  else push.speed = Math.max(cruise, push.speed - BOOST_FADE * delta)
  if (push.press > 0) {
    const shove = PRESS_START + (PRESS_END - PRESS_START) * push.press
    push.speed += (Math.min(push.speed, shove) - push.speed) * (1 - Math.exp(-PRESS_GRIP * delta))
  }
  // The wall too strong for you: once your belly's into it, it grips you harder and harder.
  const blocker = push.blocker
  const pressing = blocker ? intoWall(blocker) : 0
  if (pressing > 0) {
    if (!push.wallHitAt[blocker.stage]) slam(now, blocker)
    push.speed *= Math.exp(-BLOCK_GRIP * (0.4 + pressing / BLOCK_PRESS) * delta)
    sfx.wallCrack(Math.min(1, pressing / BLOCK_PRESS))
    crumble(now, blocker)
  }
  const end = TRACK_LENGTH + FINISH_RUN
  if (!blocker) push.speed = Math.min(push.speed, Math.sqrt(2 * DECEL * Math.max(0, end - push.meter)))
  let meter = push.meter + push.speed * delta
  if (blocker) meter = Math.min(meter, blocker.meter - WALL_FACE - push.radius + BLOCK_PRESS)
  if (!blocker && meter >= end - 0.02) meter = end
  push.meter = meter
  push.stage = stageAt(Math.max(0, Math.min(meter, TRACK_LENGTH)))
  const grip = Math.min(1, 0.35 + push.speed / 4)
  push.x = Math.max(-maxX(), Math.min(maxX(), push.x + side * STEER_SPEED * grip * delta))
  place()
  smashWalls(now)

  // Straining against a wall too strong: a growl under the run.
  push.strain = blocker ? Math.min(1, Math.max(0, pressing / BLOCK_PRESS)) : 0
  sfx.runSet(Math.min(1, push.speed / RUN_SPEED), push.strain * 0.6)

  // --- The finish, or thrown back by a wall too strong -------------------------------
  if (!blocker && push.meter >= end - 0.005) finished(now)
  else if (blocker && pressing > 0 && (pressing >= BLOCK_PRESS * 0.92 || push.speed < 1.2)) thrownBack(now, blocker)
}

/**
 * A wall too strong for you: it gives as far as it goes and throws you back up the track
 * - BOING - and you sit there seeing stars, its bricks cracked where you hit. Then it's
 * back to the Lobby.
 */
function thrownBack(now, wall) {
  push.phase = 'blocked'
  push.endedAt = now
  push.speed = -BOUNCE_SPEED
  push.shake = 0.8
  push.strain = 0
  push.blockX = push.x
  push.blockY = push.bellyY
  report()
  sfx.runStop()
  sfx.wallThump(push.radius)
  sfx.bounce()
  setTimeout(sfx.tired, 350)
  setTimeout(sfx.dizzy, 900)
  bellyOn(wall.meter)
  burst({ x: _at.x, y: _at.y, z: _at.z, count: 18, palette: 'dust', speed: 5 })
  burst({ x: _at.x, y: _at.y, z: _at.z, count: 8, colors: chipColors(STAGES[wall.stage].id), speed: 6 })
  showBanner({ kind: 'blocked', need: wall.need, walls: push.wallsBroken.length, coins: push.coins })
  holdTimer = setTimeout(() => endPush('blocked'), BLOCKED_HOLD_MS)
}

/** All the way down, through the very last wall: the celebration, then home. */
function finished(now) {
  push.phase = 'top'
  push.endedAt = now
  push.speed = 0
  report()
  sfx.runStop()
  burst({ x: push.position.x, y: push.position.y + 2, z: push.position.z, count: 80, palette: 'gold', speed: 11 })
  showBanner({ kind: 'top', coins: push.coins })
  holdTimer = setTimeout(() => endPush('top'), TOP_HOLD_MS)
}

/**
 * Boxity's "Reset Character": straight back. Mid-run, that's the lobby; in the lobby,
 * the spawn point.
 */
export function resetCharacter() {
  if (push.active) {
    endPush('left')
    return
  }
  actions.respawn()
  runtime.player.position.set(SPAWN.x, 0, SPAWN.z)
  runtime.player.yaw = SPAWN.yaw
}

/** Ends the run on our side: tells the authority, then fades back to the plaza. */
export function endPush(reason) {
  if (!push.active || push.ending) return
  push.ending = true
  report()
  actions.endPush(reason)
  const coins = push.coins
  fadeThrough(() => finishPush(PUSH_RETURN, coins > 0, coins))
}

/** The authority ended the run (it timed out, say): finish it here too, unless we already are. */
export function pushEndedByServer() {
  if (!push.active || push.ending) return
  push.ending = true
  clearTimeout(holdTimer)
  const coins = push.coins
  fadeThrough(() => finishPush(PUSH_RETURN, coins > 0, coins))
}

/**
 * Back in the plaza: just short of the SMASH ZONE, camera behind you - turned to it and
 * dancing, with `dance`, after smashing walls, while the `coins` made fly home to the HUD.
 */
export function finishPush(at = PUSH_RETURN, dance = false, coins = 0) {
  clearTimers()
  push.active = false
  push.ending = false
  push.shake = 0
  push.punch = 0
  sfx.runStop()
  runtime.focus = null
  const player = runtime.player
  player.position.set(at.x, 0, at.z)
  player.yaw = dance ? 0 : Math.PI
  player.danceAt = dance ? performance.now() : 0
  if (dance) {
    // Home in style: a shower of confetti, and what you made over your head.
    burst({ x: at.x, y: 1.4, z: at.z, count: 60, palette: 'confetti', speed: 8 })
    if (coins > 0) spawnPopup(`+${formatNumber(coins)} COINS!`, _at.set(at.x, 2.6, at.z), { iconUrl: COIN, scale: 1.6, life: 2200 })
  }
  const game = getGame()
  if (coins > 0) setTimeout(() => flyCoins(coins), FLY_HOME_MS)
  else game.showCoins()
  // Whatever happens to the flight, the counter shows your real Coins again in the end.
  setTimeout(() => getGame().showCoins(), 12000)
  player.frozen = false
  runtime.camera.mode = 'follow'
  runtime.camera.yaw = 0
  runtime.camera.snap = true
  game.setClimb(null)
  game.setPushing(false)
}
