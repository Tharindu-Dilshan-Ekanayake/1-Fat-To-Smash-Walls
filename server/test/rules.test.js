import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  AURAS,
  FOODS,
  EGGS,
  levelCap,
  fatForLevel,
  PUSH_START,
  rebirthMultiplier,
  RUN_SPEED,
  SAFE_LENGTH,
  SHOP,
  TUTORIAL,
  walkSpeed,
  WORLD_PORTALS,
  WORLDS,
} from '../../shared/balance.js'
import { formatNumber } from '../../shared/format.js'
import {
  applyBite,
  applyRebirth,
  applyTrain,
  buyFood,
  buyFatPack,
  buyShopItem,
  createProfile,
  dailyStatus,
  hatchEgg,
  levelFor,
  levelXp,
  fatPacks,
  normalizeProfile,
  skipRebirth,
  TRACKS,
  coinsMultiplier,
} from '../../shared/logic.js'
import { PlayerSession } from '../../shared/session.js'
import { BENCH_HALF, benchAt, benchSeat, EGG_STANDS, FOOD_COUNTER, FOOD_HUT, isPushReturn, LEADERBOARDS, PORTALS, PUSH_RETURN, PUSH_ZONE, SPAWN, STATIC_COLLIDERS, STATUE, WALKWAY, zoneCenter, ZONE_COUNT, zoneDeckRect } from '../../shared/world.js'

/** World 1's track, which most of these tests roll down. */
const {
  stages: STAGES,
  length: TRACK_LENGTH,
  tapes: TAPES,
  isSlope,
  reachOf,
  runCoins,
  tapesFor,
  safeStart,
  stageAt,
  stageStart,
  stageTop,
} = TRACKS[0]

/** Sat on Food Court `i`'s middle bench. */
const onBench = (i) => ({ ...benchSeat(i, zoneCenter(i).x, zoneCenter(i).z), y: 0.4 })
const inPushZone = () => ({ x: 0, y: 0, z: (PUSH_ZONE.minZ + PUSH_ZONE.maxZ) / 2 })
const rounded = (m) => Math.round(m * 100) / 100

/** A session for `profile` with its events collected, standing at `pos`. */
function sessionAt(pos, profile = createProfile('a', 'A')) {
  const events = []
  const s = new PlayerSession(profile, { now: 0, emit: (type, payload) => events.push({ type, payload }), getPosition: () => pos })
  return { s, events, p: profile, of: (type) => events.filter((e) => e.type === type) }
}

/** Reports a run's progress every quarter second at RUN_SPEED, from time `t0` until it gets to `meter`. Returns the time. */
function runTo(s, meter, t0 = 0, x = 0) {
  let t = t0
  let m = s.push?.meter ?? PUSH_START
  while (m < meter) {
    m = Math.min(meter, m + RUN_SPEED * 0.25)
    t += 250
    s.handle('pushAt', { meter: m, x }, t)
  }
  return t
}

test('numbers format like the HUD', () => {
  assert.deepEqual(
    [0, 999, 1000, 1234, 7300, 14000, 2.5e6, 9999].map(formatNumber),
    ['0', '999', '1K', '1.2K', '7.3K', '14K', '2.5M', '9.9K'],
  )
})

test('levels come from the Fat eaten: 15, 19, 23, 29, 36... each', () => {
  assert.deepEqual([2, 3, 4, 5].map(fatForLevel), [15, 34, 57, 86])
  const p = createProfile('a', 'A')
  p.eaten = fatForLevel(4) + 25
  p.fat = 3
  p.level = levelFor(p.eaten, 0)
  assert.equal(p.level, 4, 'what you ate, not what you carry')
  assert.deepEqual(levelXp(p), { have: 25, need: fatForLevel(5) - fatForLevel(4) })
})

test('rebirth is at level 5, then 10, 20, 30, with +0.5x per rebirth', () => {
  assert.deepEqual([0, 1, 2, 3, 4].map(levelCap), [5, 10, 20, 30, 40])
  assert.deepEqual([0, 1, 2, 3].map(rebirthMultiplier), [1, 1.5, 2, 2.5])
  assert.equal(levelFor(1e9, 0), 5, 'never past the cap')
})

test('Fat keeps piling on at max level; only the level stops', () => {
  const p = createProfile('a', 'A')
  for (let i = 0; i < 1000; i += 1) applyBite(p, -1, 0)
  assert.equal(p.fat, 1000)
  assert.equal(p.eaten, 1000)
  assert.equal(p.level, levelCap(0))
  assert.equal(p.stats.bestFat, 1000)
})

test('foods, Food Courts and rebirths multiply bites', () => {
  const p = createProfile('a', 'A')
  applyBite(p, -1, 0)
  assert.equal(p.fat, 1)
  p.ownedFoods.push('fries', 'donut')
  p.equippedFood = 'donut'
  applyBite(p, -1, 0)
  assert.equal(p.fat, 1 + 3)
  p.rebirths = 1
  applyTrain(p, 1, 0)
  assert.equal(p.fat, 1 + 3 + 3 * 2 * 1.5)
})

test('locked Food Courts give nothing', () => {
  const p = createProfile('a', 'A')
  assert.equal(applyTrain(p, 1, 0).ok, false)
  assert.equal(p.fat, 0)
})

test('rebirth needs max level, resets Fat and what you ate, keeps Coins and foods', () => {
  const p = createProfile('a', 'A')
  assert.equal(applyRebirth(p).ok, false)
  p.ownedFoods.push('fries')
  for (let i = 0; i < 400; i += 1) applyBite(p, -1, 0)
  p.coins = 50
  assert.equal(applyRebirth(p).ok, true)
  assert.equal(p.rebirths, 1)
  assert.equal(p.fat, 0)
  assert.equal(p.eaten, 0)
  assert.equal(p.level, 1)
  assert.equal(p.coins, 50)
  assert.deepEqual(p.ownedFoods, ['cookie', 'fries'])
})

test('skipping to a rebirth costs Coins', () => {
  const p = createProfile('a', 'A')
  assert.equal(skipRebirth(p).ok, false)
  p.coins = 1e9
  assert.equal(skipRebirth(p).ok, true)
  assert.equal(p.rebirths, 1)
  assert.ok(p.coins < 1e9)
})

test('each tape takes its own Fat to smash: a roll smashes every one it can, and the next stops it', () => {
  assert.deepEqual(TAPES.slice(0, 4).map((tape) => tape.need), [20, 200, 500, 1000])
  assert.equal(tapesFor(19), 0)
  assert.equal(tapesFor(20), 1)
  assert.equal(tapesFor(3000), 5, '20, 200, 500, 1000 and 2000 - not 5000')
  // Stopped dead at the first tape too strong; enough for all of them, all the way down.
  assert.equal(reachOf(10), stageTop(0))
  assert.equal(reachOf(3000), stageTop(5))
  assert.equal(reachOf(1e15), TRACK_LENGTH)
  assert.equal(stageTop(STAGES.length - 1), TRACK_LENGTH)
})

test('tapes sit at the end of every slope, with a flat checkpoint past each', () => {
  assert.equal(TRACK_LENGTH, STAGES.reduce((sum, st) => sum + st.length, 0) + (STAGES.length - 1) * SAFE_LENGTH)
  assert.equal(safeStart(1), STAGES[0].length)
  assert.equal(stageStart(1), STAGES[0].length + SAFE_LENGTH)
  assert.equal(isSlope(5), true)
  assert.equal(isSlope(safeStart(1) + 3), false)
  assert.equal(isSlope(stageStart(1) + 5), true)
  assert.equal(stageAt(safeStart(1) + 1), 1)
  assert.equal(TAPES.length, STAGES.length)
  TAPES.forEach((tape, i) => assert.equal(tape.meter, stageTop(i)))
  // A run pays every tape it bursts: with 300 Fat, the first two.
  assert.equal(runCoins(19), 0)
  assert.equal(runCoins(20), 10)
  assert.equal(tapesFor(300), 2)
  assert.equal(runCoins(300), 10 + 100)
})

test('the first run pays enough for the first food, as the guide asks', () => {
  assert.ok(runCoins(TUTORIAL[0].fat) >= FOODS[1].cost)
  assert.deepEqual(
    TUTORIAL.map((step) => step.event),
    ['eat', 'tape', 'buyFood'],
    'eat, burst the first tape, buy a food - and that is all',
  )
})

test('the guide: eat at the table, burst the first tape, buy a food, done', () => {
  const p = createProfile('a', 'A')
  const pos = onBench(0)
  const { s } = sessionAt(pos, p)
  s.handle('enterZone', { zone: 0 }, 0)
  for (let t = 0; s.profile.fat < TUTORIAL[0].fat && t < 200; t += 1) s.tick(1, t * 1000)
  assert.equal(p.tutorialStep, 1, 'fat enough for the first tape')
  Object.assign(pos, inPushZone())
  s.handle('leaveZone', {}, 0)
  s.handle('startPush', {}, 300000)
  const t = runTo(s, stageTop(0), 300000)
  assert.equal(p.tutorialStep, 2, 'burst through the tape')
  s.handle('endPush', { reason: 'tired' }, t + 1000)
  Object.assign(pos, { x: FOOD_COUNTER.x, y: 0, z: FOOD_COUNTER.z })
  s.handle('buyFood', { id: FOODS[1].id }, t + 2000)
  assert.equal(p.tutorialStep, TUTORIAL.length, 'and the guide is over')
})

test('the guide skips a step already done out of order', () => {
  const p = createProfile('a', 'A')
  p.fat = 25
  const { s } = sessionAt(inPushZone(), p)
  s.handle('startPush', {}, 0)
  runTo(s, stageTop(0))
  assert.equal(p.tutorialStep, 2, 'ran without eating at a table: on to buying')
})

test('foods are bought in order with Coins', () => {
  const p = createProfile('a', 'A')
  p.coins = 1000
  assert.equal(buyFood(p, FOODS[3].id).ok, false)
  assert.equal(buyFood(p, FOODS[1].id).ok, true)
  assert.equal(p.coins, 1000 - FOODS[1].cost)
  assert.equal(p.equippedFood, FOODS[1].id)
})

test('Fat packs scale with your level', () => {
  const p = createProfile('a', 'A')
  const early = fatPacks(p)
  assert.equal(early.length, 3)
  p.fat = 300
  p.eaten = 300
  p.level = levelFor(p.eaten, 0)
  const later = fatPacks(p)
  assert.ok(later[0].amount > early[0].amount)
  p.coins = later[2].price
  assert.equal(buyFatPack(p, 2).ok, true)
  assert.equal(p.fat, 300 + later[2].amount)
  assert.equal(p.coins, 0)
})

test('egg odds add up to 100% and hatching charges coins', () => {
  for (const [id, egg] of Object.entries(EGGS)) {
    assert.equal(egg.pets.reduce((s, [, w]) => s + w, 0), 100, id)
  }
  const p = createProfile('a', 'A')
  p.coins = EGGS.basic.cost.coins
  const r = hatchEgg(p, 'basic', 1, { rand: () => 0 })
  assert.equal(r.ok, true)
  assert.equal(p.coins, 0)
  assert.equal(p.pets[0].id, 'cat')
  assert.deepEqual(p.equippedPets, [p.pets[0].uid])
})

test('daily rewards unlock one per day', () => {
  const p = createProfile('a', 'A')
  const states = dailyStatus(p, 0).map((d) => d.state)
  assert.deepEqual(states.slice(0, 3), ['ready', 'next', 'locked'])
})

test('corrupt or old saves load safely', () => {
  const p = normalizeProfile({ pets: [{ uid: 1, id: 'nope' }], equippedPets: [1], ownedFoods: ['nope'], fat: 'x', equippedAura: 'water' }, 'x', 'X')
  assert.deepEqual(p.pets, [])
  assert.deepEqual(p.equippedPets, [])
  assert.deepEqual(p.ownedFoods, ['cookie'])
  assert.equal(p.fat, 0)
  assert.equal(p.eaten, 0)
  assert.equal(p.equippedAura, null, 'an aura you never bought')
  // A save without `eaten` counts the Fat it carries as eaten.
  assert.equal(normalizeProfile({ fat: 40 }, 'y', 'Y').eaten, 40)
})

test('the session only feeds you sat at a table where the player really is', () => {
  const pos = { x: 0, y: 0, z: 0 }
  const { s } = sessionAt(pos)
  s.handle('enterZone', { zone: 0 }, 0)
  s.tick(2, 0)
  assert.equal(s.profile.fat, 0, 'claimed a Food Court from spawn')
  // Standing on the deck, off its bench, gives nothing.
  Object.assign(pos, { x: zoneCenter(0).x + 4.5, y: 0.4, z: zoneCenter(0).z + 3.5 })
  s.tick(2, 0)
  assert.equal(s.profile.fat, 0, 'on the deck but not on the bench')
  Object.assign(pos, onBench(0))
  s.tick(2, 0)
  assert.ok(s.profile.fat > 0)
  // Anywhere along the long bench counts, side by side with others.
  let before = s.profile.fat
  Object.assign(pos, { ...onBench(0), z: zoneCenter(0).z + BENCH_HALF - 0.4 })
  s.tick(2, 0)
  assert.ok(s.profile.fat > before, 'near the end of the bench')
  // Another Food Court's bench isn't this one's.
  Object.assign(pos, onBench(1))
  before = s.profile.fat
  s.tick(2, 0)
  assert.equal(s.profile.fat, before)
})

test('bites are limited to a human clicking rate', () => {
  const { s, p } = sessionAt({ x: 0, y: 0, z: 0 })
  // 200 clicks in the same instant: only the banked burst counts.
  for (let i = 0; i < 200; i += 1) s.handle('eat', {}, 1000)
  assert.ok(p.fat <= 12, `got ${p.fat}`)
  // A second later the bucket has refilled by about nine.
  for (let i = 0; i < 200; i += 1) s.handle('eat', {}, 2000)
  assert.ok(p.fat <= 22, `got ${p.fat}`)
})

test('bites at a Food Court are multiplied by it', () => {
  const pos = onBench(1)
  const p = createProfile('a', 'A')
  p.rebirths = 1
  const { s } = sessionAt(pos, p)
  s.handle('enterZone', { zone: 1 }, 0)
  s.handle('eat', {}, 0)
  assert.equal(p.fat, 1 * 2 * 1.5)
})

test('a run starts only from the run zone, only with Fat, and only one at a time', () => {
  const pos = inPushZone()
  const p = createProfile('a', 'A')
  const { s, of } = sessionAt(pos, p)
  s.handle('startPush', {}, 1000)
  assert.equal(of('push').length, 0, 'no Fat, no run')
  p.fat = 50
  Object.assign(pos, { x: 0, z: 14 })
  s.handle('startPush', {}, 1000)
  assert.equal(of('push').length, 0, 'not from the plaza')
  Object.assign(pos, inPushZone())
  s.handle('startPush', {}, 1000)
  assert.equal(of('push').length, 1)
  s.handle('startPush', {}, 1500)
  assert.equal(of('push').length, 1, 'no second run while running')
  s.handle('eat', {}, 1600)
  assert.equal(p.fat, 50, 'no eating mid-run')
})

test('a roll: every tape its Fat smashes pays once, the next stops it, and you keep your Fat', () => {
  const p = createProfile('a', 'A')
  p.fat = 300
  const { s, of } = sessionAt(inPushZone(), p)
  s.handle('startPush', {}, 0)
  assert.deepEqual(of('push')[0].payload, { reach: stageTop(2), power: 300, start: PUSH_START, x: 0 })
  // Claiming the far end at once: only as far as rolling flat out could take you.
  s.handle('pushAt', { meter: 500, x: 0 }, 300)
  assert.ok(s.push.meter < stageTop(0), `got ${s.push.meter}`)
  assert.equal(p.coins, 0)
  // Going back up is ignored.
  const before = s.push.meter
  s.handle('pushAt', { meter: 0, x: 0 }, 400)
  assert.equal(s.push.meter, before)
  // Down to the first tape: it pays, once.
  const t = runTo(s, stageTop(0) + 1, 400)
  assert.equal(p.coins, TAPES[0].coins)
  assert.deepEqual(of('tape')[0].payload, { stage: 0, coins: TAPES[0].coins, top: false })
  s.handle('pushAt', { meter: stageTop(0) + 1, x: 0 }, t + 100)
  assert.equal(p.coins, TAPES[0].coins)
  // On through the second; never past the third (500 Fat), however far you report.
  runTo(s, TRACK_LENGTH, t)
  assert.equal(s.push.meter, stageTop(2))
  assert.equal(p.coins, TAPES[0].coins + TAPES[1].coins)
  assert.equal(p.stats.tapes, 2)
  // Bounced off it: back to the lobby - as fat as you went.
  s.handle('endPush', { reason: 'blocked' }, 600000)
  assert.equal(s.push, null)
  assert.deepEqual(of('pushEnd')[0].payload, { reason: 'blocked', coins: TAPES[0].coins + TAPES[1].coins, tapes: 2 })
  assert.equal(p.fat, 300)
})

test('however a roll ends, you keep your Fat', () => {
  const p = createProfile('a', 'A')
  p.fat = 300
  p.eaten = 300
  const { s, of } = sessionAt(inPushZone(), p)
  s.handle('startPush', {}, 0)
  const t = runTo(s, stageTop(0) / 2)
  s.handle('endPush', { reason: 'left' }, t + 100)
  assert.equal(of('pushEnd')[0].payload.reason, 'left')
  assert.equal(p.fat, 300)
  assert.equal(p.eaten, 300)
})

test('a run nobody reports on ends by itself', () => {
  const p = createProfile('a', 'A')
  p.fat = 10
  const { s, of } = sessionAt(inPushZone(), p)
  s.handle('startPush', {}, 0)
  s.tick(0.1, 31000)
  assert.equal(s.push, null)
  assert.equal(of('pushEnd')[0].payload.reason, 'timeout')
})

test('the Future World portal badges you only from its swirl, with its Coins', () => {
  const pos = { x: 0, y: 0, z: 0 }
  const { s } = sessionAt(pos)
  const portal = PORTALS[0]
  s.profile.coins = WORLD_PORTALS[portal.id].coins - 1
  s.handle('portal', {}, 0)
  assert.deepEqual(s.profile.badges, [], 'not from spawn')
  Object.assign(pos, { x: portal.x, z: portal.z })
  s.handle('portal', {}, 0)
  assert.deepEqual(s.profile.badges, [], 'one Coin short')
  s.profile.coins += 1
  s.handle('portal', {}, 0)
  assert.deepEqual(s.profile.badges, [portal.id])
  assert.equal(s.profile.world, 1, 'into Future World')
  // Back through to World 1, and - having been - in again without the Coins.
  s.handle('portal', {}, 0)
  assert.equal(s.profile.world, 0)
  s.profile.coins = 0
  s.handle('portal', {}, 0)
  assert.equal(s.profile.world, 1)
})

test('World 1 has 13 tapes and Future World 7, each paying Coins for how hard it is', () => {
  assert.equal(WORLDS[0].stages.length, 13)
  assert.equal(WORLDS[1].stages.length, 7)
  assert.deepEqual(
    WORLDS[0].stages.map((st) => st.need),
    [20, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000, 2000000],
  )
  // Every tape pays half its slope's need.
  for (const world of WORLDS) for (const st of world.stages) assert.equal(st.coins, st.need / 2, st.id)
  assert.equal(TRACKS[0].runCoins(1e15), WORLDS[0].stages.reduce((sum, st) => sum + st.coins, 0))
  // Every stage of every world needs more than the one before it.
  for (const world of WORLDS) world.stages.forEach((st, i) => i && assert.ok(st.need > world.stages[i - 1].need, st.id))
})

test('a roll in World 2 is on its track', () => {
  assert.equal(WORLDS[1].name, 'World 2')
  const p = createProfile('a', 'A')
  p.world = 1
  p.fat = 5000000
  const { s, of } = sessionAt(inPushZone(), p)
  const track = TRACKS[1]
  s.handle('startPush', {}, 0)
  assert.equal(of('push')[0].payload.reach, track.stageTop(1), 'its first tape takes 5M, its second 50M')
  runTo(s, track.stageTop(0))
  assert.equal(p.coins, track.tapes[0].coins)
})

test('only the trip back from the run zone skips the speed check', () => {
  assert.equal(isPushReturn(inPushZone(), PUSH_RETURN), true)
  assert.equal(isPushReturn(SPAWN, PUSH_RETURN), false, 'not from elsewhere in the lobby')
  assert.equal(isPushReturn(inPushZone(), SPAWN), false, 'not to anywhere else')
})

test('walking speed grows with every level ever reached, and never drops on rebirth', () => {
  assert.equal(walkSpeed(1, 0), 10)
  assert.ok(walkSpeed(5, 0) > walkSpeed(1, 0))
  assert.ok(walkSpeed(1, 1) >= walkSpeed(5, 0), 'a rebirth keeps you as quick')
  assert.ok(walkSpeed(30, 5) <= 13.5)
})

test('walking earns no Fat: only eating does', () => {
  const pos = { x: 0, y: 0, z: 10 }
  const { s, p } = sessionAt(pos)
  s.tick(0.1, 0)
  // Walk 41 m round the lobby at 8.2 m/s.
  for (let i = 1; i <= 50; i += 1) {
    pos.x += 0.82
    s.tick(0.1, i * 100)
  }
  assert.equal(p.fat, 0)
})

test('foods can only be bought at the Food Shop counter', () => {
  const pos = { x: 0, y: 0, z: 0 }
  const p = createProfile('a', 'A')
  p.coins = 100
  const { s } = sessionAt(pos, p)
  s.handle('buyFood', { id: 'fries' }, 0)
  assert.equal(p.ownedFoods.length, 1, 'not from the middle of the plaza')
  Object.assign(pos, { x: FOOD_COUNTER.x, z: FOOD_COUNTER.z })
  s.handle('buyFood', { id: 'fries' }, 0)
  assert.equal(p.ownedFoods.length, 2)
  // Picking which owned food to eat works anywhere.
  Object.assign(pos, { x: 0, z: 0 })
  s.handle('equipFood', { id: 'cookie' }, 0)
  assert.equal(p.equippedFood, 'cookie')
})

test('only brand-new players get the tutorial', () => {
  const fresh = normalizeProfile({ rebirths: 0, tutorialStep: 1 }, 'a', 'A')
  assert.equal(fresh.tutorialStep, 1)
  const reborn = normalizeProfile({ rebirths: 1, tutorialStep: 1 }, 'b', 'B')
  assert.equal(reborn.tutorialStep, TUTORIAL.length)
})

test('the shop sells for Coins only', () => {
  const p = createProfile('a', 'A')
  const { s } = sessionAt({ x: 0, z: 0 }, p)
  s.handle('purchase', { productId: 'fatX2' }, 0)
  assert.equal(p.passes.fatX2, undefined)
  p.coins = SHOP.fatX2.price + 7
  s.handle('purchase', { productId: 'fatX2' }, 0)
  assert.equal(p.passes.fatX2, true)
  assert.equal(p.coins, 7)
  applyBite(p, -1, 0)
  assert.equal(p.fat, 2, 'x2 Fat doubles gains')
})

test('the store: x3 and VIP passes stack, and bundles give three of a thing', () => {
  const p = createProfile('a', 'A')
  p.coins = SHOP.coinsX3.price + SHOP.vip.price + SHOP.potionsFat.price + SHOP.eggsUnicorn.price
  assert.equal(coinsMultiplier(p, 0), 1)
  assert.equal(buyShopItem(p, 'coinsX3').ok, true)
  assert.equal(buyShopItem(p, 'vip').ok, true)
  assert.equal(coinsMultiplier(p, 0), 4.5)
  assert.equal(buyShopItem(p, 'potionsFat').ok, true)
  assert.equal(p.items.potionFat, 3)
  assert.equal(buyShopItem(p, 'eggsUnicorn').ok, true)
  assert.equal(p.items.eggUnicorn, 3)
  assert.equal(buyShopItem(p, 'vip').ok, false, 'a pass is bought once')
})

test('auras are worn when bought and multiply Coins', () => {
  const p = createProfile('a', 'A')
  const { s } = sessionAt({ x: 0, z: 0 }, p)
  p.coins = SHOP.auraLightning.price
  s.handle('purchase', { productId: 'auraLightning' }, 0)
  assert.equal(p.equippedAura, 'lightning')
  assert.equal(coinsMultiplier(p, 0), AURAS.lightning.coins)
  s.handle('equipAura', { id: null }, 0)
  assert.equal(coinsMultiplier(p, 0), 1)
  s.handle('equipAura', { id: 'water' }, 0)
  assert.equal(p.equippedAura, null, 'not one you never bought')
})

test('Snack Town: Food Courts in order on the left, the Food Shop on the right, eggs and boards behind, the walk to the track clear', () => {
  // Facing north from spawn: the Food Courts down the left, in order from the back; the
  // Food Shop hut on the right; the eggs and leaderboards behind; the statue off to the side.
  for (let i = 0; i < ZONE_COUNT; i += 1) {
    assert.ok(zoneCenter(i).x < SPAWN.x - 20, `court ${i} on the left`)
    if (i > 0) assert.ok(zoneCenter(i).z < zoneCenter(i - 1).z, `court ${i} after court ${i - 1}, on up the column`)
  }
  assert.ok(FOOD_HUT.x > SPAWN.x + 20 && FOOD_COUNTER.x > SPAWN.x + 15, 'the Food Shop on the right')
  for (const egg of EGG_STANDS) assert.ok(egg.z > SPAWN.z, `${egg.eggId} egg behind`)
  for (const board of LEADERBOARDS) assert.ok(board.z > SPAWN.z, `${board.id} board behind`)
  assert.ok(Math.abs(STATUE.x) > 15, 'the statue well clear of the gate')
  // Every bench is reachable: off every wall, and nobody spawns on one.
  assert.equal(benchAt(SPAWN.x, SPAWN.z), -1)
  for (let i = 0; i < ZONE_COUNT; i += 1) {
    const seat = onBench(i)
    assert.equal(benchAt(seat.x, seat.z), i)
    for (const wall of STATIC_COLLIDERS) assert.ok(!(seat.x > wall.minX && seat.x < wall.maxX && seat.z > wall.minZ && seat.z < wall.maxZ), `bench ${i} inside a wall`)
  }
  // The counter is reachable, not inside the hut.
  for (const wall of STATIC_COLLIDERS) assert.ok(!(FOOD_COUNTER.x > wall.minX && FOOD_COUNTER.x < wall.maxX && FOOD_COUNTER.z > wall.minZ && FOOD_COUNTER.z < wall.maxZ), 'counter inside a wall')
  // The straight walk from spawn up to the ROLL ZONE is clear: nothing solid in it.
  const overlaps = (a, b) => a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ
  assert.ok(WALKWAY.minX <= SPAWN.x && WALKWAY.maxX >= SPAWN.x && WALKWAY.minZ <= PUSH_ZONE.minZ)
  for (const wall of STATIC_COLLIDERS) assert.ok(!overlaps(wall, WALKWAY), `something solid on the walkway: ${JSON.stringify(wall)}`)
  for (let i = 0; i < ZONE_COUNT; i += 1) assert.ok(!overlaps(zoneDeckRect(i), WALKWAY), `court ${i} on the walkway`)
})
