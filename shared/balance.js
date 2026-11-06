/**
 * Every tunable number in the game. Rules live in logic.js; this file is only data,
 * so balancing never means touching code.
 *
 * Shared by client (display) and server (authority): both always agree on costs and
 * multipliers because they read the same table.
 *
 * The loop: eat food to get FAT (your belly grows with every bite), then curl up and
 * roll down the tape track like a ball. Every tape across it takes so much Fat to smash:
 * you burst through every one your Fat is enough for, each paying Coins, until you slam
 * into the first that's too strong and bounce off it. You keep your Fat - you come back
 * as big as you went - so buy better food with the Coins, eat more, and roll further.
 */

// --- Fat and levels ----------------------------------------------------------------

/** Fat one bite (click) is worth before any multiplier: the "+1". */
export const BASE_GAIN = 1
/** Bites the server accepts per second, and how many can be banked for a burst. */
export const MAX_BITES_PER_SECOND = 9
export const BITE_BURST = 12
/** Seconds between the bites you take automatically sat at a Food Court table. */
export const TRAIN_INTERVAL = 0.8

/**
 * Your level comes from the Fat you've eaten since your last rebirth. Level L needs
 * LEVEL_FIRST * LEVEL_GROWTH^(L-1) more than the one before (15, 19, 23, 29, 36 ...), so
 * reaching level L takes fatForLevel(L) eaten in all.
 */
export const LEVEL_FIRST = 15
export const LEVEL_GROWTH = 1.25
export const fatForLevel = (level) =>
  level <= 1 ? 0 : Math.round((LEVEL_FIRST * (LEVEL_GROWTH ** (level - 1) - 1)) / (LEVEL_GROWTH - 1))

// --- Rebirth ----------------------------------------------------------------------

/** The level you must reach to rebirth: R0 = 5, R1 = 10, R2 = 20, R3 = 30, then +10 per rebirth. */
export const levelCap = (rebirths) => (rebirths <= 0 ? 5 : 10 * rebirths)

/** Fat multiplier from rebirths: R0 = x1, R1 = x1.5, R2 = x2 ... */
export const rebirthMultiplier = (rebirths) => 1 + 0.5 * Math.max(0, rebirths)

/**
 * Walking speed (m/s): a little quicker with every level you've ever reached - a rebirth
 * puts your level back to 1 but keeps the levels behind it, so you never slow down - up
 * to a top speed safely under the server's MAX_MOVE_SPEED (world.js).
 */
export function walkSpeed(level = 1, rebirths = 0) {
  let levels = Math.max(0, level - 1)
  for (let k = 0; k < rebirths && levels < 40; k += 1) levels += levelCap(k)
  return Math.min(13.5, 10 + 0.1 * levels)
}

/** Skipping straight to a rebirth costs this many max-level runs' worth of Coins. */
export const REBIRTH_SKIP_RUNS = 8

// --- Food Courts ------------------------------------------------------------------

/**
 * The Food Courts along the west side, south to north in world.js order: a long table
 * on a raised deck. Sat at one you take a bite automatically every TRAIN_INTERVAL, and
 * every bite there (clicks too) is worth `mult` times more. `rebirths` = rebirths
 * needed; `product` = the SHOP pass that unlocks it instead.
 */
export const TRAIN_ZONES = [
  { id: 'snack', name: 'Snack Corner', mult: 1, rebirths: 0 },
  { id: 'diner', name: 'Dinky Diner', mult: 2, rebirths: 1 },
  { id: 'grill', name: 'Sizzle Grill', mult: 5, rebirths: 3 },
  { id: 'bakery', name: 'Golden Bakery', mult: 8, rebirths: 5 },
  { id: 'spicy', name: 'Spicy Kitchen', mult: 15, rebirths: 8 },
  { id: 'frost', name: 'Frosty Parlor', mult: 30, product: 'zoneVeryOp', tag: 'VERY OP!' },
  { id: 'galaxy', name: 'Galaxy Buffet', mult: 60, product: 'zoneBest', tag: 'BEST OVERALL!' },
]

// --- Foods ------------------------------------------------------------------------

/**
 * What you eat. `power` is the Fat each bite gives before multipliers; `cost` is in
 * Coins. Bought in order from the food market.
 *
 * Prices go with the tapes (World 1's thirteen, then Future World's seven): from the
 * Taco on, each food costs two or three runs to the tape it goes with, paid in the Coins
 * those tapes give with the boosts a player has by then - so every new tape pays for
 * about one new food.
 */
export const FOODS = [
  { id: 'cookie', name: 'Choco Cookie', power: 1, cost: 0 },
  // Cheap enough for the Coins from your very first run.
  { id: 'fries', name: 'Crispy Fries', power: 2, cost: 3 },
  { id: 'donut', name: 'Sprinkle Donut', power: 3, cost: 20 },
  { id: 'hotdog', name: 'Hot Dog', power: 5, cost: 60 },
  { id: 'pizza', name: 'Pizza Slice', power: 8, cost: 150 },
  { id: 'taco', name: 'Crunchy Taco', power: 12, cost: 1300 },
  { id: 'burger', name: 'Double Burger', power: 18, cost: 2800 },
  { id: 'sushi', name: 'Sushi Roll', power: 27, cost: 8700 },
  { id: 'icecream', name: 'Triple Scoop', power: 40, cost: 23000 },
  { id: 'cupcake', name: 'Cherry Cupcake', power: 60, cost: 48000 },
  { id: 'pancakes', name: 'Pancake Tower', power: 90, cost: 220000 },
  { id: 'drumstick', name: 'BBQ Drumstick', power: 135, cost: 470000 },
  { id: 'ramen', name: 'Ramen Bowl', power: 200, cost: 1200000 },
  { id: 'cake', name: 'Party Cake', power: 300, cost: 2800000 },
  { id: 'watermelon', name: 'Mega Melon', power: 450, cost: 9000000 },
  { id: 'turkey', name: 'Roast Turkey', power: 700, cost: 230000000 },
  { id: 'galaxyDonut', name: 'Galaxy Donut', power: 1000, cost: 2500000000 },
  { id: 'neonSundae', name: 'Neon Sundae', power: 1500, cost: 75000000000 },
  { id: 'diamondCupcake', name: 'Diamond Cupcake', power: 2300, cost: 1100000000000 },
  { id: 'dragonSteak', name: 'DRAGON STEAK', power: 3500, cost: 15000000000000, tag: 'OP' },
]

// --- The tape track ---------------------------------------------------------------

/**
 * The worlds, each with its own track down the valley: World 1, and Future World
 * through the portal (WORLD_PORTALS), which takes `coins` Coins to step into the first
 * time.
 *
 * A world's stages run from the lobby down: each a slope `length` metres long with a
 * TAPE stretched across its end, and between one stage and the next a short flat
 * checkpoint SAFE_LENGTH metres long. (In code a stage's "top" is its far end, where
 * its tape is: the track's metres count from the start, whichever way it slopes.)
 *
 * Smashing stage i's tape takes `need` Fat: roll into it with at least that much and
 * you burst through - it pays its `coins` at once - and on you roll, faster each time;
 * with less, it stretches round your belly and throws you back, and the roll is over.
 * You keep your Fat either way. A stage's `coins` go with how hard it is: half its
 * `need`.
 */
export const WORLDS = [
  {
    id: 'earth',
    name: 'World 1',
    stages: [
      { id: 'grass', name: 'Grassy Hill', need: 20, length: 24, coins: 10 },
      { id: 'sand', name: 'Sandy Path', need: 200, length: 36, coins: 100 },
      { id: 'ice', name: 'Frozen Peak', need: 500, length: 44, coins: 250 },
      { id: 'jungle', name: 'Jungle Ruins', need: 1000, length: 50, coins: 500 },
      { id: 'volcano', name: 'Lava Volcano', need: 2000, length: 56, coins: 1000 },
      { id: 'beach', name: 'Sunny Beach', need: 5000, length: 60, coins: 2500 },
      { id: 'mushroom', name: 'Mushroom Forest', need: 10000, length: 60, coins: 5000 },
      { id: 'candy', name: 'Candy Land', need: 20000, length: 64, coins: 10000 },
      { id: 'spooky', name: 'Spooky Hollow', need: 50000, length: 64, coins: 25000 },
      { id: 'swamp', name: 'Toxic Swamp', need: 100000, length: 68, coins: 50000 },
      { id: 'crystal', name: 'Crystal Caves', need: 200000, length: 68, coins: 100000 },
      { id: 'cloud', name: 'Cloud Kingdom', need: 500000, length: 72, coins: 250000 },
      { id: 'moon', name: 'Moon Peak', need: 2000000, length: 72, coins: 1000000 },
    ],
  },
  {
    id: 'future',
    name: 'World 2',
    coins: 1400000,
    stages: [
      { id: 'neon', name: 'Neon City', need: 5000000, length: 70, coins: 2500000 },
      { id: 'cyber', name: 'Cyber Highway', need: 50000000, length: 70, coins: 25000000 },
      { id: 'factory', name: 'Robot Factory', need: 500000000, length: 70, coins: 250000000 },
      { id: 'station', name: 'Space Station', need: 5000000000, length: 70, coins: 2500000000 },
      { id: 'mars', name: 'Mars Canyon', need: 50000000000, length: 70, coins: 25000000000 },
      { id: 'asteroid', name: 'Asteroid Belt', need: 500000000000, length: 70, coins: 250000000000 },
      { id: 'galaxy', name: 'Galaxy Core', need: 5000000000000, length: 70, coins: 2500000000000 },
    ],
  },
]
/** The flat checkpoint past each tape, before the next slope. */
export const SAFE_LENGTH = 8
/** Where you stand when a run starts: this far before the foot of the first slope. */
export const PUSH_START = -2.5
/**
 * How fast you roll (m/s): RUN_SPEED to start with, SPEED_PER_TAPE faster for every tape
 * smashed (downhill, gathering speed), up to TOP_SPEED.
 */
export const RUN_SPEED = 12
export const SPEED_PER_TAPE = 1.2
export const TOP_SPEED = 24
/** The server's allowance for roll speed, a little over TOP_SPEED for lag. */
export const RUN_SPEED_MAX = 27
/** A run with no progress report for this long is ended by the server. */
export const PUSH_TIMEOUT_MS = 30000

// --- Pets & eggs ------------------------------------------------------------------

export const RARITIES = {
  common: { name: 'Common', color: '#b9c3cf', order: 0 },
  uncommon: { name: 'Uncommon', color: '#4ade80', order: 1 },
  rare: { name: 'Rare', color: '#38bdf8', order: 2 },
  epic: { name: 'Epic', color: '#b15cff', order: 3 },
  legendary: { name: 'Legendary', color: '#ffc41f', order: 4 },
  mythic: { name: 'Mythic', color: '#ff3b6b', order: 5 },
  secret: { name: 'Secret', color: '#ff5bd8', order: 6 },
}

/** `mult` multiplies Fat gains. Equipped pets stack additively (see logic.js). */
export const PETS = {
  cat: { name: 'Cat', rarity: 'common', mult: 1.2 },
  dog: { name: 'Dog', rarity: 'common', mult: 1.3 },
  bunny: { name: 'Bunny', rarity: 'uncommon', mult: 1.5 },
  bear: { name: 'Bear', rarity: 'rare', mult: 2 },
  cow: { name: 'Cow', rarity: 'uncommon', mult: 2.5 },
  parrot: { name: 'Parrot', rarity: 'rare', mult: 3 },
  fox: { name: 'Fox', rarity: 'epic', mult: 4 },
  tiger: { name: 'Tiger', rarity: 'legendary', mult: 6 },
  flamingo: { name: 'Flamingo', rarity: 'uncommon', mult: 8 },
  turtle: { name: 'Turtle', rarity: 'rare', mult: 10 },
  owl: { name: 'Owl', rarity: 'epic', mult: 14 },
  phoenix: { name: 'Phoenix', rarity: 'legendary', mult: 25 },
  pony: { name: 'Pony', rarity: 'rare', mult: 10 },
  unicorn: { name: 'Unicorn', rarity: 'epic', mult: 18 },
  pegasus: { name: 'Pegasus', rarity: 'legendary', mult: 30 },
  imp: { name: 'Imp', rarity: 'rare', mult: 20 },
  bat: { name: 'Bat', rarity: 'epic', mult: 30 },
  demon: { name: 'Demon', rarity: 'legendary', mult: 50 },
  hellhound: { name: 'Hellhound', rarity: 'mythic', mult: 80 },
  dragon: { name: 'Dragon', rarity: 'epic', mult: 6 },
  crab: { name: 'Lucky Crab', rarity: 'uncommon', mult: 1.5 },
  sphinx: { name: 'Sphinx', rarity: 'secret', mult: 150 },
}

/**
 * Eggs, bought with Coins. `pets` are [petId, weight] - weights are percentages and
 * sum to 100.
 */
export const EGGS = {
  basic: { name: 'Basic', cost: { coins: 50 }, pets: [['cat', 45], ['dog', 30], ['bunny', 20], ['bear', 5]] },
  meadow: { name: 'Grass', cost: { coins: 930 }, pets: [['cow', 45], ['parrot', 30], ['fox', 20], ['tiger', 5]] },
  sunset: { name: 'Sunset', cost: { coins: 12000 }, pets: [['flamingo', 45], ['turtle', 30], ['owl', 20], ['phoenix', 5]] },
  unicorn: { name: 'Unicorn', cost: { coins: 560000 }, pets: [['pony', 50], ['unicorn', 35], ['pegasus', 15]] },
  demon: { name: 'Demon', cost: { coins: 12000000000 }, pets: [['imp', 50], ['bat', 30], ['demon', 15], ['hellhound', 5]] },
}

export const MAX_EQUIPPED_PETS = 3
export const MAX_PET_INVENTORY = 60
/** Multi-hatch opens this many at once, for that many times the cost. */
export const MULTI_HATCH = 3

// --- Items, boosts, rewards -------------------------------------------------------

export const POTION_DURATION_MS = 5 * 60 * 1000

export const ITEMS = {
  potionFat: { name: 'x2 Fat Potion', kind: 'potion', boost: 'fat', durationMs: POTION_DURATION_MS },
  potionCoins: { name: 'x2 Coins Potion', kind: 'potion', boost: 'coins', durationMs: POTION_DURATION_MS },
  eggMeadow: { name: 'Grass Egg', kind: 'egg', egg: 'meadow' },
  eggSunset: { name: 'Sunset Egg', kind: 'egg', egg: 'sunset' },
  eggUnicorn: { name: 'Unicorn Egg', kind: 'egg', egg: 'unicorn' },
  eggDemon: { name: 'Demon Egg', kind: 'egg', egg: 'demon' },
}

/** 7-day cycle; day N unlocks N x 24h after the cycle started. */
export const DAILY_INTERVAL_MS = 24 * 60 * 60 * 1000
export const DAILY_REWARDS = [
  { label: 'x2 Coins', icon: 'potionCoins', sub: '5m', grant: { item: 'potionCoins' } },
  { label: 'Dragon', icon: 'pet:dragon', sub: 'x1', grant: { pet: 'dragon' } },
  { label: 'x2 Fat', icon: 'potionFat', sub: '5m', grant: { item: 'potionFat' } },
  { label: 'Unicorn Egg', icon: 'egg:unicorn', sub: 'x1', grant: { item: 'eggUnicorn' } },
  { label: 'x2 Fat', icon: 'potionFat', sub: '5m', grant: { item: 'potionFat' } },
  { label: 'x2 Coins', icon: 'potionCoins', sub: '5m', grant: { item: 'potionCoins' } },
  { label: 'Demon Egg', icon: 'egg:demon', sub: 'x1', grant: { item: 'eggDemon' } },
]

/** Claimable once each per session, after this many minutes played. */
export const PLAYTIME_REWARDS = [
  { minutes: 5, label: '+50 Coins', icon: 'coin', grant: { coins: 50 } },
  { minutes: 10, label: 'x2 Fat', icon: 'potionFat', grant: { item: 'potionFat' } },
  { minutes: 15, label: 'Grass Egg', icon: 'egg:meadow', grant: { item: 'eggMeadow' } },
  { minutes: 30, label: 'x2 Coins', icon: 'potionCoins', grant: { item: 'potionCoins' } },
  { minutes: 45, label: '+1K Coins', icon: 'coin', grant: { coins: 1000 } },
  { minutes: 60, label: 'Sunset Egg', icon: 'egg:sunset', grant: { item: 'eggSunset' } },
]

/** The stand by spawn: a pet the first time, a potion on later sessions. */
export const FREE_REWARD = { firstTime: { pet: 'crab' }, repeat: { item: 'potionFat' } }

/** Offline snacking: a quarter of your Food Court's rate, for up to 8 hours away. */
export const OFFLINE_RATE = 0.25
export const OFFLINE_MAX_MS = 8 * 60 * 60 * 1000
export const OFFLINE_MIN_MS = 60 * 1000

/**
 * The world portals (placed by PORTALS in world.js): the world each takes you to (and
 * back from), its name, and the Coins needed to step through the first time. Stepping
 * through earns the badge of the same id.
 */
export const WORLD_PORTALS = {
  future: { world: 1, name: WORLDS[1].name, coins: WORLDS[1].coins },
}

// --- Auras ------------------------------------------------------------------------

/**
 * Auras: a glow round your character that multiplies the Coins you earn. Bought from
 * the SHOP (`product`); the one you bought last is worn.
 */
export const AURAS = {
  lightning: { name: 'Lightning Aura', coins: 1.25, color: '#7fe0ff', product: 'auraLightning' },
  galaxy: { name: 'Galaxy Aura', coins: 1.5, color: '#b66bff', product: 'auraGalaxy' },
  water: { name: 'Water Aura', coins: 2, color: '#2fb4ff', product: 'auraWater' },
  fire: { name: 'Fire Aura', coins: 3, color: '#ff6a1e', product: 'auraFire' },
  rainbow: { name: 'Rainbow Aura', coins: 5, color: '#ff7ad9', product: 'auraRainbow' },
}

// --- Shop -------------------------------------------------------------------------

/**
 * The shop. Coins are the game's only currency: everything here, like foods and eggs,
 * is bought with them. `pass` = permanent unlock; `consumable` = grants every time.
 * Priced like the foods: a few runs to the tape each belongs to.
 */
export const SHOP = {
  fatX2: { name: 'x2 Fat', price: 3700, kind: 'pass' },
  coinsX2: { name: 'x2 Coins', price: 73000, kind: 'pass' },
  fatX3: { name: 'x3 Fat', price: 230000000, kind: 'pass' },
  coinsX3: { name: 'x3 Coins', price: 2500000000, kind: 'pass' },
  vip: { name: 'VIP', price: 75000000000, kind: 'pass' },
  zoneVeryOp: { name: 'VERY OP! Food Court', price: 3300000, kind: 'pass' },
  zoneBest: { name: 'BEST OVERALL! Food Court', price: 2500000000, kind: 'pass' },
  auraLightning: { name: 'Lightning Aura', price: 6500, kind: 'pass', aura: 'lightning' },
  auraGalaxy: { name: 'Galaxy Aura', price: 7200000, kind: 'pass', aura: 'galaxy' },
  auraWater: { name: 'Water Aura', price: 1100000000000, kind: 'pass', aura: 'water' },
  auraFire: { name: 'Fire Aura', price: 20000000000000, kind: 'pass', aura: 'fire' },
  auraRainbow: { name: 'Rainbow Aura', price: 750000000000000, kind: 'pass', aura: 'rainbow' },
  potionsFat: { name: '3 Fat Potions', price: 4400, kind: 'consumable', grant: { item: 'potionFat', amount: 3 } },
  potionsCoins: { name: '3 Coins Potions', price: 12000, kind: 'consumable', grant: { item: 'potionCoins', amount: 3 } },
  eggsSunset: { name: '3 Sunset Eggs', price: 30000, kind: 'consumable', grant: { item: 'eggSunset', amount: 3 } },
  eggsUnicorn: { name: '3 Unicorn Eggs', price: 1400000, kind: 'consumable', grant: { item: 'eggUnicorn', amount: 3 } },
  eggsDemon: { name: '3 Demon Eggs', price: 30000000000, kind: 'consumable', grant: { item: 'eggDemon', amount: 3 } },
  sphinx: { name: 'Sphinx', price: 20000000000000, kind: 'consumable', grant: { pet: 'sphinx' }, stock: 1000 },
}

/** Sphinx stock shown before the server reports the live count. */
export const SPHINX_STOCK_DEFAULT = 954

/**
 * The three Fat packs under the level bar (green, orange, pink). They grow with you:
 * each gives `share` of the Fat your next level needs, for `runs` max runs' worth of
 * Coins at that Fat.
 */
export const FAT_PACKS = [
  { share: 1, runs: 0.6 },
  { share: 6, runs: 3 },
  { share: 25, runs: 10 },
]

// --- Tutorial & badges ------------------------------------------------------------

/**
 * The guide for brand-new players - all of it: eat until you're fat enough for the first
 * tape (tap, or sit at the FREE Food Court's table), roll down and smash it, and spend
 * the Coins on better food. After that, no more guides. Each step completes when its
 * event fires (with at least `fat` Fat on you, where given: what the first tape needs).
 */
export const TUTORIAL = [
  { text: 'Eat food to get FAT! Tap, or sit at the FREE table!', event: 'eat', target: 'zone0', fat: 20 },
  { text: 'Roll down the hill and smash through the tape!', event: 'tape', target: 'push' },
  { text: 'Buy the Crispy Fries with your Coins!', event: 'buyFood', target: 'foods' },
]

/**
 * The game's Boxity leaderboards, shown on its Boxity page and behind the trophy button
 * in the game. Ids and settings are permanent once Boxity has seen them (later changes
 * are made in the Boxity dashboard). The client declares them; the server reports the
 * scores, from its own state.
 */
export const BOXITY_BOARDS = [
  { id: 'fat', label: 'Fattest', order: 'desc', mode: 'best', format: 'compact', reset: 'none' },
  { id: 'rebirths', label: 'Most Rebirths', order: 'desc', mode: 'best', format: 'number', reset: 'weekly' },
  { id: 'coins', label: 'Most Coins', order: 'desc', mode: 'sum', format: 'compact', reset: 'weekly' },
]

export const BADGES = {
  firstRun: { name: 'First Run' },
  firstTape: { name: 'Tape Buster' },
  firstRebirth: { name: 'First Rebirth' },
  firstPet: { name: 'Pet Owner' },
  top: { name: 'Finished the Track' },
  future: { name: 'Time Traveller' },
}
