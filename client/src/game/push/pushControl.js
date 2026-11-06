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
import { stageAt, TAPES, TRACK_LENGTH } from './course'
import { feetPoint, trackPoint } from './path'

/** Position reports to the authority while rolling, and at least this often regardless. */
const REPORT_MS = 200
const KEEPALIVE_MS = 5000
/** Sideways steering speed, m/s (a little less while still getting going). */
const STEER_SPEED = 6
/** Pushing off: how fast you get up to RUN_SPEED (m/s²). */
const ACCEL = 9
/** Rolling to a stop at the end of the track (m/s²). */
const DECEL = 6
/**
 * A tape too strong for you: it stretches round your belly, gripping harder and harder
 * (BLOCK_GRIP per second), and at full stretch - or as you're all but stopped - throws
 * you back (BOUNCE_SPEED m/s up the track, settling at BOUNCE_SETTLE per second).
 */
const BLOCK_GRIP = 9
const BOUNCE_SPEED = 7
const BOUNCE_SETTLE = 4
/**
 * A tape: your belly presses into it and it stretches, this far (m) before it snaps -
 * slowing you to a crawl as it strains (from STRETCH_START down to STRETCH_END m/s) -
 * then SNAP: a split second of slow motion (HIT_STOP_MS at HIT_STOP_SCALE speed) and
 * you shoot off it (SNAP_SPEED m/s, easing back to RUN_SPEED at BOOST_FADE m/s²).
 */
export const TAPE_STRETCH = 1.3
const STRETCH_START = 6
const STRETCH_END = 2.2
const STRETCH_GRIP = 12
const HIT_STOP_MS = 120
const HIT_STOP_SCALE = 0.2
const SNAP_SPEED = 15
const BOOST_FADE = 5
/** Thrown back by a tape too strong: how long you sit there, dizzy, before it's back to the lobby. */
const BLOCKED_HOLD_MS = 2200
/** At the end of the track: how long the celebration plays before you're home. */
const TOP_HOLD_MS = 3800
/** Back in the lobby: this long into the dance, the Coins start flying home. */
const FLY_HOME_MS = 550

/**
 * The roll in progress, read every frame by the player, the camera, the track, the tapes
 * and their effects (it's called `push` in the protocol: see shared/session.js).
 *
 * The authority tells us its power (`power`: your Fat when you set off) and where it's
 * stopped (`reach`: the first tape too strong for it, or the end). You curl up into a
 * ball at the ROLL ZONE and push off; downhill you roll on your own, steering left and
 * right. Every tape your Fat is enough for you smash through - faster and faster - until
 * the one that's too strong: it stretches round your belly and throws you back, dizzy,
 * and it's back to the Lobby. Or you roll on through the very last tape to the end. You
 * keep your Fat all the while.
 *
 * Your logical position stays on the ROLL ZONE in the plaza throughout (that's what the
 * server checks of it); only what's drawn goes down the track, and where that is we
 * report as we go.
 */
export const push = {
  active: false,
  /** 'roll' | 'blocked' (thrown back by a tape too strong) | 'top' (made it to the end!) */
  phase: 'roll',
  startedAt: 0,
  /** The Fat this roll set off with, and the furthest metre it gets you to. */
  power: 0,
  reach: 0,
  /** Where this roll started: just short of the start of the first slope. */
  start: PUSH_START,
  /** Where you are along the track (under the ball's middle), and across it. */
  meter: PUSH_START,
  x: 0,
  /** Metres a second down the track. */
  speed: 0,
  /** The stage you're rolling down. */
  stage: 0,
  /** How far round you've rolled (radians), and how big a ball you are (the player keeps it up to date). */
  roll: 0,
  radius: 0.9,
  /** 0-1: the camera's jolt from the last tape smashed (FollowCamera settles it). */
  shake: 0,
  /** 0-1: the last of your Fat running out. */
  strain: 0,
  /** Tapes smashed this roll, by stage, when (performance.now()) and where across they split, for their snap. */
  tapesBroken: [],
  tapeAt: [],
  tapeBreakX: [],
  /** 0-1: how far the tape you're pressing into is stretched (0 when you're not). */
  stretch: 0,
  /** Slow motion (the snap's hit-stop) until this performance.now(). */
  slowmoUntil: 0,
  /** The first tape too strong for this roll's Fat (null: none, you'll roll to the end). */
  wall: null,
  /** Coins this roll has made so far (the authority pays them; this is for show). */
  coins: 0,
  /** When the roll was decided: worn out, or the end reached. */
  endedAt: 0,
  /** Set once we've told the authority it's over, so its echo isn't handled twice. */
  ending: false,
  /** Your feet's spot on the track under the ball (for the camera, shadows and effects). */
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

/** How far across the track your ball may go: clear of the walls. */
const maxX = () => TRACK_HALF_WIDTH - push.radius - 0.35

/**
 * Tells the authority where we've got to, when that's changed - and every few seconds
 * regardless, so lying there worn out isn't taken for a dropped roll.
 */
function report() {
  if (!push.active) return
  const meter = Math.round(push.meter * 100) / 100
  const x = Math.round(push.x * 100) / 100
  const now = performance.now()
  if (meter === lastReport.meter && x === lastReport.x && now - lastReport.at < KEEPALIVE_MS) return
  lastReport = { meter, x, at: now }
  actions.pushAt(meter, x)
}

const place = () => feetPoint(push.meter, push.x, push.position)

/** Your Fat: rolling, what you set off with (it doesn't run down); else your Fat now. */
export function powerLeft() {
  return push.active ? push.power : getGame().profile.fat
}

/** The roll the authority gave us: curl up and push off down the track. */
export function beginPush({ reach, power, start, x }) {
  clearTimers()
  Object.assign(push, {
    active: true,
    phase: 'roll',
    startedAt: performance.now(),
    power,
    reach,
    start,
    meter: start,
    x: 0,
    speed: 0,
    stage: 0,
    roll: 0,
    shake: 0,
    strain: 0,
    stretch: 0,
    slowmoUntil: 0,
    coins: 0,
    endedAt: 0,
    ending: false,
  })
  push.x = Math.max(-maxX(), Math.min(maxX(), x))
  push.tapesBroken = []
  push.tapeAt = []
  push.tapeBreakX = []
  push.wall = TAPES.find((tape) => tape.need > power) ?? null
  place()
  runtime.player.frozen = true
  runtime.camera.mode = 'push'
  runtime.focus = push.position
  lastReport = { meter: NaN, x: NaN, at: 0 }
  const game = getGame()
  // The Coins counter holds where it is: what the roll makes flies home at the end.
  game.holdCoins(game.profile.coins)
  game.setPushing(true)
  game.setClimb('roll')
  reportTimer = setInterval(report, REPORT_MS)
  sfx.curl()
  sfx.rollStart()
}

const _at = new Vector3()
const COIN = iconUrl('coin')

/** Sparks crackle off a tape your belly's pushing into: a little burst every SPARK_MS. */
const SPARK_MS = 70
let lastSpark = 0
function zap(now, meter) {
  if (now - lastSpark < SPARK_MS) return
  lastSpark = now
  trackPoint(meter, push.x, push.radius, _at)
  burst({ x: _at.x, y: _at.y, z: _at.z, count: 6, palette: 'electric', speed: 6 })
}

/** What `coins` (before multipliers) pays you now. */
const paid = (coins) => Math.max(1, Math.round(coins * coinsMultiplier(getGame().profile, Date.now())))

/**
 * The tapes ahead: the next one you can afford, pressed into, stretches round your belly
 * (`push.stretch`, for the tapes and the sound) and holds you back; stretched as far as
 * it goes, it SNAPS - once a roll (the authority pays it, when our next report reaches
 * it): slow motion for a blink, a burst of ribbon shreds, confetti and gold, the Coins
 * popping off it, a jolt of the camera, and you shoot off down the track.
 */
function smashTapes(now) {
  push.stretch = 0
  for (const tape of TAPES) {
    if (push.tapesBroken.includes(tape.stage)) continue
    const press = push.meter + push.radius - tape.meter
    if (press <= 0) break
    if (tape.need > push.power + 1e-6) break
    if (press < TAPE_STRETCH) {
      push.stretch = press / TAPE_STRETCH
      sfx.tapeStretch(push.stretch)
      zap(now, tape.meter)
      break
    }
    push.tapesBroken.push(tape.stage)
    push.tapeAt[tape.stage] = now
    push.tapeBreakX[tape.stage] = push.x
    const coins = paid(tape.coins)
    push.coins += coins
    push.shake = 1
    push.slowmoUntil = now + HIT_STOP_MS
    push.speed = Math.max(push.speed, SNAP_SPEED)
    report()
    trackPoint(tape.meter, push.x, push.radius + 0.4, _at)
    burst({ x: _at.x, y: _at.y, z: _at.z, count: 40, palette: 'tape', speed: 10 })
    burst({ x: _at.x, y: _at.y, z: _at.z, count: 24, palette: 'electric', speed: 9 })
    burst({ x: _at.x, y: _at.y + 0.6, z: _at.z, count: 30, palette: 'confetti', speed: 8 })
    burst({ x: _at.x, y: _at.y + 0.5, z: _at.z, count: 18, palette: 'gold', speed: 6 })
    spawnPopup(`+${formatNumber(coins)}`, _at.setY(_at.y + push.radius + 0.6), { iconUrl: COIN, scale: 1.6, follow: push.position })
    sfx.tapeSnap()
    sfx.coins()
    showBanner({ kind: 'tape', stage: tape.stage, coins, streak: push.tapesBroken.length })
  }
}

/**
 * Rolls on by `delta` seconds, steering by `side` (-1..1). Called by the player's frame
 * loop while rolling.
 */
export function advancePush(rawDelta, { side }) {
  if (!push.active) return
  const now = performance.now()
  // A tape's snap: a blink of slow motion.
  const delta = now < push.slowmoUntil ? rawDelta * HIT_STOP_SCALE : rawDelta

  if (push.phase === 'blocked') {
    // Thrown back up the track by the tape, the bounce settling; the tape springs back.
    push.speed *= Math.exp(-BOUNCE_SETTLE * delta)
    push.meter += push.speed * delta
    push.roll += (push.speed * delta) / Math.max(0.3, push.radius)
    place()
    sfx.rollSet(0, 0)
    return
  }
  if (push.phase !== 'roll' || push.ending) {
    // Done: what's left of the speed bleeds away where you are.
    push.speed *= Math.exp(-8 * delta)
    sfx.rollSet(0, 0)
    return
  }

  // --- Speed: push off and roll, faster with every tape smashed (and a burst off each
  // one), strain through a stretching tape, slow to a stop at the end of the track -----
  const cruise = Math.min(TOP_SPEED, RUN_SPEED + SPEED_PER_TAPE * push.tapesBroken.length)
  if (push.speed < cruise) push.speed = Math.min(cruise, push.speed + ACCEL * delta)
  else push.speed = Math.max(cruise, push.speed - BOOST_FADE * delta)
  if (push.stretch > 0) {
    const crawl = STRETCH_START + (STRETCH_END - STRETCH_START) * push.stretch
    push.speed += (Math.min(push.speed, crawl) - push.speed) * (1 - Math.exp(-STRETCH_GRIP * delta))
  }
  // The tape too strong for you: once your belly's into it, it grips you harder and harder.
  const wall = push.wall
  const pressing = wall ? push.meter + push.radius - wall.meter : 0
  if (pressing > 0) {
    push.speed *= Math.exp(-BLOCK_GRIP * (0.4 + pressing / TAPE_STRETCH) * delta)
    sfx.tapeStretch(Math.min(1, pressing / TAPE_STRETCH))
    zap(now, wall.meter)
  }
  if (!wall) push.speed = Math.min(push.speed, Math.sqrt(2 * DECEL * Math.max(0, TRACK_LENGTH - push.meter)))
  let meter = push.meter + push.speed * delta
  if (wall) meter = Math.min(meter, wall.meter - push.radius + TAPE_STRETCH)
  if (!wall && meter >= TRACK_LENGTH - 0.02) meter = TRACK_LENGTH
  push.meter = meter
  push.stage = stageAt(Math.max(0, meter))
  const grip = Math.min(1, 0.35 + push.speed / 4)
  push.x = Math.max(-maxX(), Math.min(maxX(), push.x + side * STEER_SPEED * grip * delta))
  push.roll += (push.speed * delta) / Math.max(0.3, push.radius)
  place()
  smashTapes(now)

  // Straining into a tape too strong: the roll growls.
  push.strain = wall ? Math.min(1, Math.max(0, pressing / TAPE_STRETCH)) : 0
  sfx.rollSet(Math.min(1, push.speed / RUN_SPEED), push.strain * 0.6, 1 + push.radius)

  // --- The end of the track, or thrown back by a tape too strong ---------------------
  if (!wall && push.meter >= TRACK_LENGTH - 0.005) finished(now)
  else if (wall && pressing > 0 && (pressing >= TAPE_STRETCH * 0.92 || push.speed < 1.2)) thrownBack(now, wall)
}

/**
 * A tape too strong for you: stretched as far as it goes round your belly, it throws you
 * back up the track - BOING - and you sit there seeing stars. Then it's back to the Lobby.
 */
function thrownBack(now, wall) {
  push.phase = 'blocked'
  push.endedAt = now
  push.speed = -BOUNCE_SPEED
  push.shake = 0.8
  push.strain = 0
  report()
  sfx.rollStop()
  sfx.bounce()
  setTimeout(sfx.tired, 350)
  setTimeout(sfx.dizzy, 900)
  trackPoint(wall.meter, push.x, push.radius + 0.4, _at)
  burst({ x: _at.x, y: _at.y, z: _at.z, count: 18, palette: 'electric', speed: 5 })
  showBanner({ kind: 'blocked', need: wall.need, tapes: push.tapesBroken.length, coins: push.coins })
  holdTimer = setTimeout(() => endPush('blocked'), BLOCKED_HOLD_MS)
}

/** All the way down, through the very last tape: the celebration, then home. */
function finished(now) {
  push.phase = 'top'
  push.endedAt = now
  push.speed = 0
  report()
  sfx.rollStop()
  burst({ x: push.position.x, y: push.position.y + 2, z: push.position.z, count: 80, palette: 'gold', speed: 11 })
  showBanner({ kind: 'top', coins: push.coins })
  holdTimer = setTimeout(() => endPush('top'), TOP_HOLD_MS)
}

/**
 * Boxity's "Reset Character": straight back. Mid-roll, that's the lobby; in the lobby,
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

/** Ends the roll on our side: tells the authority, then fades back to the plaza. */
export function endPush(reason) {
  if (!push.active || push.ending) return
  push.ending = true
  report()
  actions.endPush(reason)
  const coins = push.coins
  fadeThrough(() => finishPush(PUSH_RETURN, coins > 0, coins))
}

/** The authority ended the roll (it timed out, say): finish it here too, unless we already are. */
export function pushEndedByServer() {
  if (!push.active || push.ending) return
  push.ending = true
  clearTimeout(holdTimer)
  const coins = push.coins
  fadeThrough(() => finishPush(PUSH_RETURN, coins > 0, coins))
}

/**
 * Back in the plaza: just short of the ROLL ZONE, camera behind you - turned to it and
 * dancing, with `dance`, after smashing tapes, while the `coins` made fly home to the HUD.
 */
export function finishPush(at = PUSH_RETURN, dance = false, coins = 0) {
  clearTimers()
  push.active = false
  push.ending = false
  push.shake = 0
  sfx.rollStop()
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
