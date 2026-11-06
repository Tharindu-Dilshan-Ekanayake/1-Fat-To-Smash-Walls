import {
  AURAS,
  BADGES,
  BASE_GAIN,
  DAILY_INTERVAL_MS,
  DAILY_REWARDS,
  FOODS,
  EGGS,
  FREE_REWARD,
  ITEMS,
  levelCap,
  MAX_EQUIPPED_PETS,
  MAX_PET_INVENTORY,
  fatForLevel,
  FAT_PACKS,
  OFFLINE_MAX_MS,
  OFFLINE_MIN_MS,
  OFFLINE_RATE,
  PETS,
  PLAYTIME_REWARDS,
  RARITIES,
  REBIRTH_SKIP_RUNS,
  rebirthMultiplier,
  SAFE_LENGTH,
  SHOP,
  TRAIN_INTERVAL,
  TRAIN_ZONES,
  TUTORIAL,
  WORLDS,
} from './balance.js'

/**
 * Game rules as pure functions over a plain profile object.
 *
 * The server runs these authoritatively; the client runs the very same functions for
 * offline play and for display (costs, multipliers, what a button would do). Mutating
 * functions change the profile in place and return a small result describing what
 * happened, which is what gets sent to the client as an event.
 *
 * `session` is the per-connection state that is never saved: when this session
 * started, which playtime rewards were claimed, the free-reward flag.
 */

export const PROFILE_VERSION = 1

export function createProfile(id, name) {
  return {
    v: PROFILE_VERSION,
    id,
    name,
    /** The Fat you carry now: your belly's size, and the fuel for your next run. */
    fat: 0,
    /** Every bit of Fat eaten since your last rebirth (a run doesn't take it back): your level. */
    eaten: 0,
    coins: 0,
    rebirths: 0,
    level: 1,
    equippedFood: 'cookie',
    ownedFoods: ['cookie'],
    equippedAura: null,
    pets: [],
    equippedPets: [],
    nextPetUid: 1,
    items: {},
    boosts: { fat: 0, coins: 0 },
    passes: {},
    daily: { start: 0, claimed: [] },
    freeRewardClaimed: false,
    tutorialStep: 0,
    badges: [],
    /** The world you're in: an index into WORLDS. */
    world: 0,
    stats: { runs: 0, bites: 0, tapes: 0, bestMeter: 0, playtime: 0, bestFat: 0, tops: 0 },
    lastZone: -1,
    lastSeen: 0,
    settings: { autoRebirth: false },
  }
}

/** Fills in anything missing from an older or partial save. Never throws. */
export function normalizeProfile(raw, id, name) {
  const base = createProfile(id, name)
  if (!raw || typeof raw !== 'object') return base
  const p = { ...base, ...raw, id, name: name || raw.name || base.name }
  p.boosts = { ...base.boosts, ...(raw.boosts || {}) }
  p.stats = { ...base.stats, ...(raw.stats || {}) }
  p.settings = { ...base.settings, ...(raw.settings || {}) }
  p.daily = { ...base.daily, ...(raw.daily || {}) }
  p.items = Object.fromEntries(Object.entries(raw.items || {}).filter(([itemId]) => ITEMS[itemId]))
  p.passes = { ...(raw.passes || {}) }
  p.fat = Number.isFinite(raw.fat) ? Math.max(0, raw.fat) : 0
  p.eaten = Number.isFinite(raw.eaten) ? Math.max(p.fat, raw.eaten) : p.fat
  p.coins = Number.isFinite(raw.coins) ? Math.max(0, raw.coins) : 0
  p.pets = Array.isArray(raw.pets) ? raw.pets.filter((pet) => PETS[pet?.id]) : []
  p.equippedPets = Array.isArray(raw.equippedPets)
    ? raw.equippedPets.filter((uid) => p.pets.some((pet) => pet.uid === uid)).slice(0, MAX_EQUIPPED_PETS)
    : []
  const owned = Array.isArray(raw.ownedFoods) ? raw.ownedFoods.filter((foodId) => foodIndex(foodId) >= 0) : []
  p.ownedFoods = owned.length ? owned : ['cookie']
  if (!p.ownedFoods.includes(p.equippedFood)) p.equippedFood = p.ownedFoods[0]
  if (p.equippedAura && !ownsAura(p, p.equippedAura)) p.equippedAura = null
  // A world you're not (or no longer) allowed in is World 1.
  if (!Number.isInteger(p.world) || !worldUnlocked(p, p.world)) p.world = 0
  // Levels follow from the Fat eaten; recompute rather than trust a stored one.
  p.level = levelFor(p.eaten, p.rebirths)
  // The tutorial is for brand-new players only: anyone who has rebirthed is past it.
  if (p.rebirths > 0) p.tutorialStep = TUTORIAL.length
  p.v = PROFILE_VERSION
  return p
}

export function createSession(now) {
  return { start: now, playtimeClaimed: [], freeRewardTaken: false }
}

// --- Lookups ------------------------------------------------------------------------

export const foodIndex = (id) => FOODS.findIndex((d) => d.id === id)
export const foodById = (id) => FOODS.find((d) => d.id === id) || FOODS[0]

export function isZoneUnlocked(profile, index) {
  const zone = TRAIN_ZONES[index]
  if (!zone) return false
  if (zone.product) return Boolean(profile.passes[zone.product])
  return profile.rebirths >= zone.rebirths
}

export const ownsAura = (profile, id) => Boolean(AURAS[id] && profile.passes[AURAS[id].product])

/**
 * Fat values are kept to a tenth below a million (the HUD shows "+1.5") and whole
 * above, so repeated small gains don't pile up float dust.
 */
export const tidy = (value) => (value < 1e6 ? Math.round(value * 10) / 10 : Math.round(value))

/** "Nice" price or amount: two significant figures (692 -> 690, 1934 -> 1900). */
export function niceRound(n) {
  if (n < 100) return Math.max(1, Math.round(n))
  const step = 10 ** (Math.floor(Math.log10(n)) - 1)
  return Math.round(n / step) * step
}

// --- Levels -------------------------------------------------------------------------

/** The level `eaten` Fat reaches, never above the cap for `rebirths`. */
export function levelFor(eaten, rebirths) {
  const cap = levelCap(rebirths)
  let level = 1
  while (level < cap && eaten >= fatForLevel(level + 1)) level += 1
  return level
}

export const isMaxLevel = (profile) => profile.level >= levelCap(profile.rebirths)

/** Fat eaten into the current level and what the level takes: the bar's "25/36". */
export function levelXp(profile) {
  const from = fatForLevel(profile.level)
  const to = fatForLevel(profile.level + 1)
  return { have: Math.max(0, profile.eaten - from), need: to - from }
}

/** 0..1 through the current level: what the level bar fills to. */
export function levelProgress(profile) {
  if (isMaxLevel(profile)) return 1
  const { have, need } = levelXp(profile)
  return Math.max(0, Math.min(1, have / Math.max(1e-9, need)))
}

/** 0..1 progress towards being able to rebirth, by levels. */
export function rebirthProgress(profile) {
  const cap = levelCap(profile.rebirths)
  if (profile.level >= cap) return 1
  return Math.max(0, Math.min(1, (profile.level - 1 + levelProgress(profile)) / Math.max(1, cap - 1)))
}

// --- Multipliers --------------------------------------------------------------------

/** Equipped pets stack additively: x3 and x2 together make x4, not x6. */
export function petMultiplier(profile) {
  let total = 1
  for (const uid of profile.equippedPets) {
    const pet = profile.pets.find((p) => p.uid === uid)
    if (pet && PETS[pet.id]) total += PETS[pet.id].mult - 1
  }
  return total
}

export const isBoostActive = (profile, kind, now) => (profile.boosts[kind] || 0) > now

/** The x2 Fat pass and potion; they stack. */
export function fatBoostMultiplier(profile, now) {
  const passes = profile.passes
  return (passes.fatX2 ? 2 : 1) * (passes.fatX3 ? 3 : 1) * (passes.vip ? 1.5 : 1) * (isBoostActive(profile, 'fat', now) ? 2 : 1)
}

/** The aura you wear multiplies your Coins. */
export const auraMultiplier = (profile) => AURAS[profile.equippedAura]?.coins ?? 1

/** The x2 and x3 Coins passes, VIP, the Coins potion and your aura; they all stack. */
export function coinsMultiplier(profile, now) {
  const passes = profile.passes
  return (passes.coinsX2 ? 2 : 1) * (passes.coinsX3 ? 3 : 1) * (passes.vip ? 1.5 : 1) * (isBoostActive(profile, 'coins', now) ? 2 : 1) * auraMultiplier(profile)
}

/** Everything that multiplies a Fat gain except the food and where you earn it. */
export function gainMultiplier(profile, now) {
  return rebirthMultiplier(profile.rebirths) * petMultiplier(profile) * fatBoostMultiplier(profile, now)
}

export const foodPower = (profile) => foodById(profile.equippedFood).power

/** Fat from one bite of your food, sat at Food Court `zone` (-1 = none). */
export function biteGain(profile, zone, now) {
  const zoneMult = zone >= 0 && TRAIN_ZONES[zone] ? TRAIN_ZONES[zone].mult : 1
  return tidy(BASE_GAIN * foodPower(profile) * zoneMult * gainMultiplier(profile, now))
}

// --- Eating, levels, rebirth --------------------------------------------------------

/**
 * Banks a Fat gain - on your belly, and towards your level. Fat keeps piling on at max
 * level (it's your fuel for the run); only the level stops, at the rebirth cap.
 */
function addFat(profile, gain) {
  const cap = levelCap(profile.rebirths)
  const added = tidy(Math.max(0, gain))
  profile.fat = tidy(profile.fat + added)
  profile.eaten = tidy(profile.eaten + added)
  profile.stats.bestFat = Math.max(profile.stats.bestFat, profile.fat)
  const before = profile.level
  profile.level = levelFor(profile.eaten, profile.rebirths)
  return { gain: added, leveledUp: profile.level > before, maxed: profile.level >= cap }
}

/** One bite (a click), at Food Court `zone` or -1. */
export function applyBite(profile, zone, now) {
  profile.stats.bites += 1
  return { ok: true, ...addFat(profile, biteGain(profile, zone, now)) }
}

/** One automatic bite sat at Food Court `index`. */
export function applyTrain(profile, index, now) {
  if (!isZoneUnlocked(profile, index)) return { ok: false, error: 'Food Court locked' }
  profile.lastZone = index
  return { ok: true, ...addFat(profile, biteGain(profile, index, now)) }
}


/** Rebirth: +1 rebirth; Fat, what you've eaten and levels reset (Coins, foods and pets stay). */
export function applyRebirth(profile) {
  if (!isMaxLevel(profile)) return { ok: false, error: `Reach level ${levelCap(profile.rebirths)} first!` }
  profile.rebirths += 1
  profile.tutorialStep = TUTORIAL.length
  profile.fat = 0
  profile.eaten = 0
  profile.level = 1
  return { ok: true, rebirths: profile.rebirths }
}

// --- The tape tracks ------------------------------------------------------------------

/**
 * World `index`'s track: its stages from the start down, each a slope with a TAPE across
 * its end and a flat checkpoint past it (all but the last, whose tape is THE END). Track
 * metre m is measured along it, down the slopes and across the flats alike, from the
 * start of the first slope.
 *
 * Stage i's tape takes its `need` Fat to smash: a roll with `power` Fat smashes every
 * tape from the first up to the last it's enough for (`tapesFor`), and is stopped dead
 * at the next (`reachOf`: that tape's metre), or rolls on to the end.
 */
export function makeTrack(world, index) {
  const stages = world.stages
  const last = stages.length - 1
  /** Metre where each stage's slope starts: past the slopes and checkpoints below it. */
  const starts = stages.map((_, i) => stages.slice(0, i).reduce((sum, stage) => sum + stage.length + SAFE_LENGTH, 0))
  const stageStart = (i) => starts[i]
  const stageTop = (i) => starts[i] + stages[i].length
  const length = stageTop(last)
  const stageAt = (meter) => {
    for (let i = 0; i < last; i += 1) if (meter < stageTop(i)) return i
    return last
  }
  /** How many tapes `fat` smashes on a run, one after the other from the first. */
  const tapesFor = (fat) => {
    let n = 0
    while (n < stages.length && fat >= stages[n].need) n += 1
    return n
  }
  /** Where a roll with `power` Fat is stopped: at the first tape too strong for it, or the end. */
  const reachOf = (power) => {
    const n = tapesFor(power)
    return n < stages.length ? stageTop(n) : length
  }
  // The tapes, one across the end of every slope, each taking its stage's need to smash
  // and paying its Coins.
  const tapes = stages.map((stage, i) => ({ stage: i, meter: stageTop(i), coins: stage.coins, need: stage.need }))
  return {
    index,
    world,
    stages,
    /** From the foot of the first slope to the top of the last (THE TOP). */
    length,
    /** Metres of slope below each stage's: the slopes of every stage before it. */
    slopesBelow: stages.map((_, i) => stages.slice(0, i).reduce((sum, stage) => sum + stage.length, 0)),
    stageStart,
    /** Metre at the top of stage `i`'s slope, where its tape is (THE TOP, for the last). */
    stageTop,
    /** Metre where the flat checkpoint below stage `i` (i >= 1) starts: its tape's. */
    safeStart: (i) => stageTop(i - 1),
    /** Index of the stage metre `meter` is in. A checkpoint counts as the stage it leads up to. */
    stageAt,
    /** Whether metre `meter` is on a slope (not the plaza, a checkpoint or the end). */
    isSlope: (meter) => meter > 0 && meter < length && meter > stageStart(stageAt(meter)),
    reachOf,
    tapesFor,
    tapes,
    /** Coins (before multipliers) the tapes of a run with `fat` pay. */
    runCoins: (fat) => tapes.slice(0, tapesFor(fat)).reduce((sum, tape) => sum + tape.coins, 0),
  }
}

/** Every world's track, by world index. */
export const TRACKS = WORLDS.map(makeTrack)

/** The track of the world you're in. */
export const trackOf = (profile) => TRACKS[profile.world] ?? TRACKS[0]

/** Whether you may go to world `world`: World 1 always; past it, once you've the Coins (or have been). */
export const worldUnlocked = (profile, world) =>
  world === 0 || (WORLDS[world] && (profile.badges.includes(WORLDS[world].id) || profile.coins >= WORLDS[world].coins))

/** Coins (before multipliers) of a run on your max level's Fat, in your world: what packs and skips cost in. */
export const maxRunCoins = (profile) => trackOf(profile).runCoins(fatForLevel(levelCap(profile.rebirths)))

/**
 * The three Fat packs as they stand for you now: `[{ amount, price }]`. Both follow
 * the Fat your next level needs, and the Coins a run on that much Fat pays.
 */
export function fatPacks(profile) {
  const next = fatForLevel(profile.level + 1)
  const coins = trackOf(profile).runCoins(next)
  return FAT_PACKS.map((pack) => ({
    amount: niceRound(Math.max(10, next * pack.share)),
    price: niceRound(Math.max(5, coins * pack.runs)),
  }))
}

/** Buys Fat pack `index` with Coins. */
export function buyFatPack(profile, index) {
  const pack = fatPacks(profile)[index]
  if (!pack) return { ok: false, error: 'Unknown pack' }
  if (profile.coins < pack.price) return { ok: false, error: 'Not enough Coins!' }
  profile.coins -= pack.price
  addFat(profile, pack.amount)
  return { ok: true, amount: pack.amount }
}

/** Coins to rebirth now without reaching max level first. */
export const rebirthSkipPrice = (profile) => niceRound(Math.max(50, maxRunCoins(profile) * REBIRTH_SKIP_RUNS))

export function skipRebirth(profile) {
  if (isMaxLevel(profile)) return applyRebirth(profile)
  const price = rebirthSkipPrice(profile)
  if (profile.coins < price) return { ok: false, error: 'Not enough Coins!' }
  profile.coins -= price
  profile.level = levelCap(profile.rebirths)
  return applyRebirth(profile)
}

// --- Foods ----------------------------------------------------------------------

export function buyFood(profile, foodId) {
  const food = FOODS.find((d) => d.id === foodId)
  if (!food) return { ok: false, error: 'Unknown food' }
  if (profile.ownedFoods.includes(foodId)) return equipFood(profile, foodId)
  const previous = FOODS[foodIndex(foodId) - 1]
  if (previous && !profile.ownedFoods.includes(previous.id)) {
    return { ok: false, error: `Buy the ${previous.name} first!` }
  }
  if (profile.coins < food.cost) return { ok: false, error: 'Not enough Coins!' }
  profile.coins -= food.cost
  profile.ownedFoods.push(foodId)
  profile.equippedFood = foodId
  return { ok: true, bought: true, foodId }
}

export function equipFood(profile, foodId) {
  if (!profile.ownedFoods.includes(foodId)) return { ok: false, error: 'You don’t own that food' }
  profile.equippedFood = foodId
  return { ok: true, equipped: true, foodId }
}

/** The next food in the shop you don't have yet, or null. */
export function nextFood(profile) {
  return FOODS.find((d) => !profile.ownedFoods.includes(d.id)) || null
}

// --- Auras --------------------------------------------------------------------------

/** Wears aura `id` (one you own), or none with null. */
export function equipAura(profile, id) {
  if (id !== null && !ownsAura(profile, id)) return { ok: false, error: 'You don’t own that aura' }
  profile.equippedAura = id
  return { ok: true }
}

// --- Pets --------------------------------------------------------------------------

function rollPet(eggId, rand) {
  const egg = EGGS[eggId]
  const total = egg.pets.reduce((sum, [, w]) => sum + w, 0)
  let r = rand() * total
  for (const [petId, weight] of egg.pets) {
    r -= weight
    if (r < 0) return petId
  }
  return egg.pets[egg.pets.length - 1][0]
}

export function addPet(profile, petId) {
  const pet = { uid: profile.nextPetUid++, id: petId }
  profile.pets.push(pet)
  // Auto-equip into a free slot, so a first pet does something straight away.
  if (profile.equippedPets.length < MAX_EQUIPPED_PETS) profile.equippedPets.push(pet.uid)
  return pet
}

/**
 * Hatches `count` eggs. `paid` says how: 'coins' charges the egg's Coins price, 'item'
 * consumes an egg item, 'free' is for reward grants already paid for.
 */
export function hatchEgg(profile, eggId, count = 1, { paid = 'coins', rand = Math.random } = {}) {
  const egg = EGGS[eggId]
  if (!egg) return { ok: false, error: 'Unknown egg' }
  if (profile.pets.length + count > MAX_PET_INVENTORY) return { ok: false, error: 'Pet inventory full!' }
  if (paid === 'coins') {
    if (!egg.cost.coins) return { ok: false, error: 'This egg is premium only' }
    const price = egg.cost.coins * count
    if (profile.coins < price) return { ok: false, error: 'Not enough Coins!' }
    profile.coins -= price
  } else if (paid === 'item') {
    const itemId = Object.keys(ITEMS).find((k) => ITEMS[k].kind === 'egg' && ITEMS[k].egg === eggId)
    if (!itemId || (profile.items[itemId] || 0) < count) return { ok: false, error: 'No eggs left' }
    profile.items[itemId] -= count
  }
  const pets = []
  for (let i = 0; i < count; i += 1) pets.push(addPet(profile, rollPet(eggId, rand)))
  return { ok: true, eggId, pets }
}

export function equipPet(profile, uid) {
  if (!profile.pets.some((p) => p.uid === uid)) return { ok: false, error: 'Unknown pet' }
  if (profile.equippedPets.includes(uid)) return { ok: true }
  if (profile.equippedPets.length >= MAX_EQUIPPED_PETS) return { ok: false, error: `Max ${MAX_EQUIPPED_PETS} pets equipped` }
  profile.equippedPets.push(uid)
  return { ok: true }
}

export function unequipPet(profile, uid) {
  profile.equippedPets = profile.equippedPets.filter((u) => u !== uid)
  return { ok: true }
}

const petScore = (pet) => PETS[pet.id]?.mult ?? 0

export function equipBestPets(profile) {
  const best = [...profile.pets].sort((a, b) => petScore(b) - petScore(a)).slice(0, MAX_EQUIPPED_PETS)
  profile.equippedPets = best.map((p) => p.uid)
  return { ok: true }
}

export function deletePet(profile, uid) {
  const before = profile.pets.length
  profile.pets = profile.pets.filter((p) => p.uid !== uid)
  profile.equippedPets = profile.equippedPets.filter((u) => u !== uid)
  return { ok: profile.pets.length < before }
}

/** Sort key for inventory display: equipped first, then rarity, then multiplier. */
export function petSortKey(profile, pet) {
  const info = PETS[pet.id]
  const equipped = profile.equippedPets.includes(pet.uid) ? 1 : 0
  return equipped * 1e6 + (RARITIES[info.rarity]?.order ?? 0) * 1e4 + info.mult
}

// --- Items & boosts ---------------------------------------------------------------

export function addItem(profile, itemId, amount = 1) {
  profile.items[itemId] = (profile.items[itemId] || 0) + amount
}

export function usePotion(profile, itemId, now) {
  const item = ITEMS[itemId]
  if (!item || item.kind !== 'potion') return { ok: false, error: 'Not a potion' }
  if ((profile.items[itemId] || 0) <= 0) return { ok: false, error: 'None left' }
  profile.items[itemId] -= 1
  // Stacks: a second potion extends the timer instead of wasting it.
  profile.boosts[item.boost] = Math.max(profile.boosts[item.boost] || 0, now) + item.durationMs
  return { ok: true, boost: item.boost, endsAt: profile.boosts[item.boost] }
}

/** Applies a reward grant: { coins } | { fat } | { item } | { pet } | { hatch }. */
export function applyGrant(profile, grant, { rand = Math.random } = {}) {
  const result = { ok: true }
  if (grant.coins) profile.coins += grant.coins
  if (grant.fat) addFat(profile, grant.fat)
  if (grant.item) addItem(profile, grant.item, grant.amount || 1)
  if (grant.pet) result.pets = [addPet(profile, grant.pet)]
  if (grant.hatch) {
    const hatched = hatchEgg(profile, grant.hatch, 1, { paid: 'free', rand })
    if (!hatched.ok) return hatched
    result.pets = hatched.pets
    result.eggId = grant.hatch
  }
  return result
}

// --- Daily & playtime rewards -------------------------------------------------------

/**
 * State of each daily reward: 'claimed' | 'ready' | 'next' (with `unlocksIn` ms) |
 * 'locked'. A new 7-day cycle starts on first claim after the last one finishes.
 */
export function dailyStatus(profile, now) {
  const { start, claimed } = profile.daily
  const fresh = !start || claimed.length >= DAILY_REWARDS.length
  const cycleStart = fresh ? now : start
  let nextShown = false
  return DAILY_REWARDS.map((reward, day) => {
    if (!fresh && claimed.includes(day)) return { day, state: 'claimed' }
    const unlockAt = cycleStart + day * DAILY_INTERVAL_MS
    if (now >= unlockAt) return { day, state: 'ready' }
    if (!nextShown) {
      nextShown = true
      return { day, state: 'next', unlocksIn: unlockAt - now }
    }
    return { day, state: 'locked' }
  })
}

export function claimDaily(profile, day, now, opts) {
  const status = dailyStatus(profile, now)[day]
  if (!status || status.state !== 'ready') return { ok: false, error: 'Not ready yet' }
  if (!profile.daily.start || profile.daily.claimed.length >= DAILY_REWARDS.length) {
    profile.daily = { start: now, claimed: [] }
  }
  profile.daily.claimed.push(day)
  const result = applyGrant(profile, DAILY_REWARDS[day].grant, opts)
  return { ...result, day, label: DAILY_REWARDS[day].label }
}

export function playtimeStatus(session, now) {
  const minutes = (now - session.start) / 60000
  return PLAYTIME_REWARDS.map((reward, index) => {
    if (session.playtimeClaimed.includes(index)) return { index, state: 'claimed' }
    if (minutes >= reward.minutes) return { index, state: 'ready' }
    return { index, state: 'locked', unlocksIn: (reward.minutes - minutes) * 60000 }
  })
}

export function claimPlaytime(profile, session, index, now, opts) {
  const status = playtimeStatus(session, now)[index]
  if (!status || status.state !== 'ready') return { ok: false, error: 'Not ready yet' }
  session.playtimeClaimed.push(index)
  const result = applyGrant(profile, PLAYTIME_REWARDS[index].grant, opts)
  return { ...result, index, label: PLAYTIME_REWARDS[index].label }
}

export function claimFreeReward(profile, session, opts) {
  if (session.freeRewardTaken) return { ok: false, error: 'Already claimed this session' }
  session.freeRewardTaken = true
  const grant = profile.freeRewardClaimed ? FREE_REWARD.repeat : FREE_REWARD.firstTime
  profile.freeRewardClaimed = true
  return { ...applyGrant(profile, grant, opts), grant }
}

// --- Shop ---------------------------------------------------------------------------

/** Buys a SHOP item with Coins. An aura is worn as soon as it's bought. */
export function buyShopItem(profile, productId, opts = {}) {
  const item = SHOP[productId]
  if (!item) return { ok: false, error: 'Unknown item' }
  if (item.kind === 'pass' && profile.passes[productId]) return { ok: false, error: 'Already owned' }
  if (profile.coins < item.price) return { ok: false, error: 'Not enough Coins!' }
  if (item.kind === 'pass') {
    profile.coins -= item.price
    profile.passes[productId] = true
    if (item.aura) profile.equippedAura = item.aura
    return { ok: true, productId, pass: true }
  }
  const result = applyGrant(profile, item.grant || {}, opts)
  if (result.ok) profile.coins -= item.price
  return { ...result, productId }
}

// --- Offline progress -------------------------------------------------------------

/** Fat eaten while away, if the player logged off sat at a Food Court. */
export function applyOfflineProgress(profile, now) {
  const away = Math.min(OFFLINE_MAX_MS, now - (profile.lastSeen || now))
  if (profile.lastZone < 0 || away < OFFLINE_MIN_MS) return null
  if (!isZoneUnlocked(profile, profile.lastZone)) return null
  const steps = Math.floor(away / 1000 / TRAIN_INTERVAL)
  // Potions don't run while you're away.
  const gain = biteGain(profile, profile.lastZone, 0)
  const result = addFat(profile, Math.floor(steps * gain * OFFLINE_RATE))
  if (result.gain <= 0) return null
  return { fat: result.gain, ms: away }
}

// --- Tutorial & badges ------------------------------------------------------------

/** Advances the tutorial if `event` completes the current step. */
export function advanceTutorial(profile, event) {
  // The current step, or a later one done first (ran without eating at a table, say): the
  // guide never asks for something you've already done.
  for (let i = profile.tutorialStep; i < TUTORIAL.length; i += 1) {
    const step = TUTORIAL[i]
    if (step.event === event && profile.fat >= (step.fat || 0)) {
      profile.tutorialStep = i + 1
      return true
    }
  }
  return false
}

/** Awards a badge once. Returns the badge if newly awarded. */
export function awardBadge(profile, id) {
  if (!BADGES[id] || profile.badges.includes(id)) return null
  profile.badges.push(id)
  return { id, ...BADGES[id] }
}
