import { FOODS, EGGS, PETS, SHOP, TRAIN_ZONES, WORLD_PORTALS, WORLDS } from '@shared/balance'
import { formatNumber } from '@shared/format'
import { isZoneUnlocked, TRACKS } from '@shared/logic'
import {
  AURA_STAND,
  FOOD_COUNTER,
  FOOD_COURTS,
  FOOD_HUT,
  EGG_STANDS,
  FREE_REWARD,
  LEADERBOARDS,
  PORTALS,
  POTION_STAND,
  SPHINX_STAND,
  STATUE,
  TRACK_START_Z,
  zoneDeckRect,
} from '@shared/world'

import { WORLD } from '../push/course'
import { eggHeight } from '../world/eggs'
import { zoneSignPosition, ZONE_THEMES } from '../world/foodCourts'

/**
 * Text styles, as gradients top-to-bottom: chunky, candy-bright signage.
 */
export const TEXT = {
  gold: ['#fffaa8', '#ffd52a', '#ff9c00'],
  green: ['#e6ffb0', '#8dff4f', '#2fd12f'],
  price: ['#d9ff9a', '#7dff4a', '#2fd12f'],
  white: ['#ffffff', '#ffffff', '#dfe7f0'],
  red: ['#ffb0a8', '#ff4a3b', '#d4142a'],
  blue: ['#e0faff', '#7fe2ff', '#2fa8ff'],
  orange: ['#fff1c2', '#ffb03b', '#ff6a00'],
  purple: ['#f3d9ff', '#c27bff', '#7a2fd6'],
}

const tint = (hex) => ['#ffffff', hex, hex]

/** Zone labels' scale: sized to sit on their restaurant's sign board. */
const ZONE_PX = 56

/** A Food Court's name and how much more each bite there is worth: "Snack Corner / x1 FAT". */
const zoneHead = (zone, theme) => [
  { text: zone.name, size: 40, gradient: theme ? tint(theme.text) : undefined },
  { text: `x${zone.mult} FAT`, size: 56, icon: 'fat', gradient: theme ? TEXT.white : undefined },
]

/**
 * A Food Court's sign: its name and multiplier, then whether you can eat there:
 * "Snack Corner / x1 FAT / FREE", "Dinky Diner / x2 FAT / 1 Rebirth",
 * "Frosty Parlor / x30 FAT / VERY OP! / 3.3M Coins"...
 */
export function zoneLabelSpec(index, unlocked) {
  const zone = TRAIN_ZONES[index]
  const lines = zoneHead(zone, ZONE_THEMES[index])
  if (unlocked) {
    lines.push({ text: zone.rebirths === 0 && !zone.product ? 'FREE' : 'UNLOCKED', size: 44, gradient: TEXT.green })
  } else if (zone.product) {
    lines.push({ text: zone.tag, size: 44, rainbow: true })
    lines.push({ text: `${formatNumber(SHOP[zone.product].price)} Coins`, size: 40, icon: 'coin', gradient: TEXT.gold })
  } else {
    const word = zone.rebirths === 1 ? 'Rebirth' : 'Rebirths'
    lines.push({ text: `${zone.rebirths} ${word}`, size: 46, icon: 'rebirth', gradient: TEXT.green })
  }
  return { lines, pxPerUnit: ZONE_PX }
}

/** Largest a zone label can get, so its atlas slot fits every state. */
const zoneReserve = (index) => {
  const zone = TRAIN_ZONES[index]
  const lines = zoneHead(zone)
  if (zone.product) {
    lines.push({ text: zone.tag, size: 44 })
    lines.push({ text: `${formatNumber(SHOP[zone.product].price)} Coins`, size: 40, icon: 'coin' })
  } else {
    lines.push({ text: 'UNLOCKED', size: 46, icon: 'rebirth' })
  }
  return { lines }
}

export function zoneLabels(profile) {
  return TRAIN_ZONES.map((zone, i) => {
    // In front of the court's sign board, over its awning (towards the plaza); the
    // four-line ones a touch higher.
    const [x, y, z] = zoneSignPosition(i)
    return {
      id: `zone-${i}`,
      position: [x, y + (zone.product ? 0.35 : 0), z],
      spec: zoneLabelSpec(i, isZoneUnlocked(profile, i)),
      reserve: zoneReserve(i),
      fade: 150,
      near: 9,
    }
  })
}

/** Where food `index` stands for you in the shop: 'equipped' | 'owned' | 'buy' | 'locked'. */
export function padState(profile, index) {
  const food = FOODS[index]
  if (profile.equippedFood === food.id) return 'equipped'
  if (profile.ownedFoods.includes(food.id)) return 'owned'
  const previous = FOODS[index - 1]
  return !previous || profile.ownedFoods.includes(previous.id) ? 'buy' : 'locked'
}

export function eggLabels() {
  return EGG_STANDS.map((stand) => {
    const egg = EGGS[stand.eggId]
    const lines = stand.big
      ? [
          { text: 'Demon Egg', size: 54, gradient: TEXT.red },
          { text: `${formatNumber(egg.cost.coins)} Coins`, size: 46, icon: 'coin', gradient: TEXT.gold },
        ]
      : [
          { text: `${egg.name} Egg`, size: 50, fill: '#ffffff' },
          { text: `${formatNumber(egg.cost.coins)} Coins`, size: 44, icon: 'coin', gradient: TEXT.gold },
        ]
    // Over the egg, a little towards its front (the plaza).
    const out = stand.big ? 1.2 : 0.6
    return {
      id: `egg-${stand.eggId}`,
      position: [stand.x + Math.sin(stand.yaw) * out, eggHeight(stand) + (stand.big ? 4 : 2.5), stand.z + Math.cos(stand.yaw) * out],
      spec: { lines, pxPerUnit: 62 },
      fade: 100,
    }
  })
}

/** The limited Sphinx showcase: price, hype, and live stock. */
export function sphinxLabelSpec(stock) {
  const mult = PETS.sphinx.mult
  return {
    lines: [
      { text: `${formatNumber(SHOP.sphinx.price)} Coins`, size: 46, icon: 'coin', gradient: TEXT.gold },
      { text: 'BEST IN GAME', size: 56, gradient: TEXT.red },
      { text: 'Sphinx', size: 76, fill: '#ffffff' },
      { text: `${formatNumber(mult * 100 - 100)}% BETTER`, size: 54, rainbow: true },
      { text: `${formatNumber(stock)} Left`, size: 50, gradient: TEXT.green },
    ],
    pxPerUnit: 48,
  }
}

export function sphinxLabel(stock) {
  return {
    id: 'sphinx',
    position: [SPHINX_STAND.x, 11.5, SPHINX_STAND.z],
    spec: sphinxLabelSpec(stock),
    reserve: sphinxLabelSpec(88888),
    fade: 140,
  }
}

/** The ROLL ZONE sign's label id. */
export const START_LABEL_ID = 'start-roll'

/**
 * A big two-line sign over an area of the plaza: its name, and what it's for. The areas'
 * section signs are the biggest; a stand's (`px` higher) a size down.
 */
const title = (id, position, name, sub, gradient, fade = 120, px = 54) => ({
  id,
  position,
  spec: {
    lines: [
      { text: name, size: 72, gradient },
      { text: sub, size: 34, fill: '#ffffff' },
    ],
    pxPerUnit: px,
  },
  fade,
})

/**
 * Where each area's section sign floats, so it reads from spawn (facing north): the
 * Food Courts' and the Food Shop's either side of the walkway over the street that
 * crosses it to both (left to the courts, right to the hut, in front of its counter);
 * and for what's behind you, over the egg row and the leaderboards.
 */
const SECTION = (() => {
  const courts = FOOD_COURTS.map((_, i) => zoneDeckRect(i))
  const front = Math.max(...courts.map((r) => r.maxX))
  const eggs = EGG_STANDS.filter((s) => !s.big)
  const boards = LEADERBOARDS.reduce((a, b) => (Math.abs(b.x) < Math.abs(a.x) ? b : a))
  return {
    // Over the street to the courts, near where it meets their own street.
    courts: [front + 9.6, 5.6, FOOD_COUNTER.z],
    // Over the street to the food shop, in front of its welcome patch and counter.
    shop: [FOOD_COUNTER.x - FOOD_COUNTER.radius - 0.4, 5.8, FOOD_HUT.z],
    // Over the middle of the egg row, above the eggs' own signs.
    eggs: [eggs.reduce((s, e) => s + e.x, 0) / eggs.length, 8.9, eggs[0].z - 1],
    // Over the middle leaderboard.
    boards: [boards.x, 12.4, boards.z],
  }
})()

/** The section signs, the free reward, the portal, the statue's challenge and the ROLL ZONE's. */
function placeLabels() {
  const portal = PORTALS[0]
  return [
    title('title-zones', SECTION.courts, 'Food Courts', 'Sit at a table to eat for EXTRA FAT!', TEXT.orange, 150),
    title('title-foods', SECTION.shop, 'Food Shop', 'Buy and Equip FOOD!', TEXT.blue, 150),
    title('title-auras', [AURA_STAND.x, 7.4, AURA_STAND.z - 3.2], 'Auras', 'Buy and Equip Auras!', TEXT.purple, 70, 74),
    title('title-potions', [POTION_STAND.x + 1, 5.6, POTION_STAND.z], 'Potions', 'Use and Buy Potions Here!', TEXT.green, 70, 74),
    title('title-eggs', SECTION.eggs, 'Eggs', 'Hatch pets for more Fat!', TEXT.gold, 110),
    title('title-boards', SECTION.boards, 'Leaderboards', 'The fattest players of all!', TEXT.purple, 110),
    {
      id: 'free-reward',
      position: [FREE_REWARD.x, 4.6, FREE_REWARD.z],
      spec: { lines: [{ text: 'FREE REWARD', size: 50, gradient: ['#fff2b0', '#ffb347', '#ff6a1e'] }], pxPerUnit: 60 },
      fade: 90,
    },
    {
      id: `portal-${portal.id}`,
      position: [portal.x, portal.radius * 2 + 3.6, portal.z],
      spec: portalLabelSpec(portal.id, 0),
      reserve: portalLabelSpec(portal.id, 0),
      fade: 140,
    },
    {
      id: 'statue',
      position: [STATUE.x, 13.8, STATUE.z],
      spec: { lines: [{ text: 'HOW FAR CAN', size: 46, fill: '#ffffff' }, { text: 'YOU ROLL?', size: 62, gradient: TEXT.gold }], pxPerUnit: 40 },
      fade: 140,
    },
    {
      // (The id is older than the ROLL ZONE; the ticker relabels it by this name.)
      id: START_LABEL_ID,
      position: [0, 6.6, TRACK_START_Z + 0.5],
      spec: startLabelSpec(),
      // Room for the biggest first tape of any world.
      reserve: WORLDS.map((_, world) => startLabelSpec(world)).reduce((a, b) => (b.lines[1].text.length > a.lines[1].text.length ? b : a)),
      fade: 110,
    },
  ]
}

/**
 * The ROLL ZONE's sign, at the start of the track: what the first tape of the world
 * you're in (or `world`) takes. Tapes need every stage's Fat up to theirs, so the first
 * one's is the Fat it takes to smash any tape at all.
 */
export function startLabelSpec(world = WORLD) {
  const tape = (TRACKS[world] ?? TRACKS[0]).tapes[0]
  return {
    lines: [
      { text: 'ROLL ZONE', size: 54, gradient: TEXT.orange },
      { text: `First tape needs ${formatNumber(tape.need)} Fat`, size: 38, icon: 'fat', gradient: TEXT.gold },
    ],
    pxPerUnit: 46,
  }
}


/** "WORLD 2" for world index 1: worlds are numbered from 1 on their signs. */
const worldNumber = (world) => `WORLD ${world + 1}`

/**
 * World portal `id`'s sign, seen from world `world`: "WORLD 2" (and the world's own name,
 * if it has one besides), its stages and price - or, from inside, the way back to World 1.
 */
export function portalLabelSpec(id, world) {
  const portal = WORLD_PORTALS[id]
  if (world === portal.world) {
    return {
      lines: [
        { text: worldNumber(0), size: 60, gradient: TEXT.green },
        { text: 'Step in to go back!', size: 40, fill: '#ffffff' },
        { text: ' ', size: 40, fill: '#ffffff' },
      ],
      pxPerUnit: 52,
    }
  }
  const number = worldNumber(portal.world)
  const named = portal.name && portal.name.toUpperCase() !== number
  return {
    lines: [
      { text: number, size: 64, gradient: TEXT.blue },
      ...(named ? [{ text: portal.name, size: 40, gradient: TEXT.purple }] : []),
      { text: `${WORLDS[portal.world].stages.length} NEW STAGES!`, size: 40, fill: '#ffffff' },
      { text: `Need ${formatNumber(portal.coins)} Coins`, size: 40, icon: 'coin', gradient: TEXT.gold },
    ],
    pxPerUnit: 52,
  }
}

/** Every label in the lobby. */
export function lobbyLabels(profile, { sphinxStock = 0 } = {}) {
  return [...zoneLabels(profile), ...eggLabels(), sphinxLabel(sphinxStock), ...placeLabels()]
}
