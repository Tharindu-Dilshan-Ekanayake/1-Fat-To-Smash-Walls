import { isZoneUnlocked } from '@shared/logic'
import {
  AURA_STAND,
  eggStandNear,
  FREE_REWARD,
  inPushZone,
  atFoodCounter,
  portalAt,
  PORTALS,
  POTION_STAND,
  SPHINX_STAND,
  ZONE_COUNT,
  zoneAt,
  zoneDeckRect,
} from '@shared/world'

import { sfx } from '../audio/sfx'
import { actions } from '../net/actions'
import { getGame, useGame } from '../store/game'
import { portalLabelSpec, START_LABEL_ID, startLabelSpec, zoneLabelSpec } from './labels/lobbyLabels'
import { updateWorldLabel } from './labels/registry'
import { setWorld } from './push/course'
import { push } from './push/pushControl'
import { runtime } from './runtime'

const TICK_MS = 100

const ZONE_KEYS = ['trainZone', 'trainZoneNear', 'sphinx', 'pushZone', 'foodShop', 'egg', 'portal', 'freeReward', 'auras', 'potions', 'climbBoulder']
/** Down the track, none of the plaza's spots count (you're still standing on the ROLL ZONE there). */
const MOUNTAIN = { trainZone: -1, trainZoneNear: -1, sphinx: false, pushZone: false, foodShop: false, egg: null, portal: null, freeReward: false, auras: false, potions: false }
const sameZone = (a, b) => ZONE_KEYS.every((key) => a[key] === b[key])

/** Locked Food Courts become solid walls for the controller; their signs say what's open. */
function syncZones(profile) {
  const walls = []
  for (let i = 0; i < ZONE_COUNT; i += 1) {
    const unlocked = isZoneUnlocked(profile, i)
    if (!unlocked) walls.push(zoneDeckRect(i))
    updateWorldLabel(`zone-${i}`, zoneLabelSpec(i, unlocked))
  }
  runtime.dynamicColliders = walls
}

/** Rolls the track of the world you're in, and puts that world's signs up in the lobby. */
function syncWorld(world) {
  setWorld(world)
  updateWorldLabel(START_LABEL_ID, startLabelSpec(world))
  for (const portal of PORTALS) updateWorldLabel(`portal-${portal.id}`, portalLabelSpec(portal.id, world))
}

/** What syncZones depends on, so it only runs when that changes. */
const zoneKey = (profile) => `${profile.rebirths}:${profile.passes.zoneVeryOp ? 1 : 0}${profile.passes.zoneBest ? 1 : 0}`

const near = (stand, p) => Math.hypot(p.x - stand.x, p.z - stand.z) < stand.radius

/**
 * The 10 Hz bridge between the frame-rate world and the UI: works out which zone the
 * player stands in, tells the authority about Food Court changes, and keeps locked-zone
 * walls in step with the profile. This - not the render loop - is what writes zone
 * state into the store, and only when something actually changed.
 *
 * @returns {() => void} stop
 */
export function startGameTicker() {
  let lastZone = -1
  let lastKey = zoneKey(getGame().profile)

  syncZones(getGame().profile)
  syncWorld(getGame().profile.world)
  const unsubscribe = useGame.subscribe((state, prev) => {
    if (state.profile === prev.profile) return
    // Before React renders the new world: its mountain is built from this (GameScene).
    if (state.profile.world !== prev.profile.world) syncWorld(state.profile.world)
    const key = zoneKey(state.profile)
    if (key === lastKey) return
    lastKey = key
    syncZones(state.profile)
  })

  const tick = () => {
    const game = getGame()
    const p = runtime.player.position
    const egg = eggStandNear(p.x, p.z)
    const zone = push.active
      ? { ...MOUNTAIN, climbBoulder: -1 }
      : {
          // Eating at a Food Court is sitting on its bench.
          trainZone: runtime.player.bench,
          // Standing at a zone's edge (a locked one's wall stops you there).
          trainZoneNear: zoneAt(p.x, p.z, 1.6),
          sphinx: Math.hypot(p.x - SPHINX_STAND.x, p.z - SPHINX_STAND.z) < 5.5,
          pushZone: inPushZone(p.x, p.z),
          foodShop: atFoodCounter(p.x, p.z),
          egg: egg ? egg.eggId : null,
          portal: portalAt(p.x, p.z)?.id ?? null,
          freeReward: Math.hypot(p.x - FREE_REWARD.x, p.z - FREE_REWARD.z) < FREE_REWARD.radius,
          auras: near(AURA_STAND, p),
          potions: near(POTION_STAND, p),
          climbBoulder: -1,
        }
    if (!sameZone(zone, game.zone)) {
      if (zone.portal && zone.portal !== game.zone.portal) actions.portal()
      // Up to the Food Shop's counter: the shop opens; walk away and it closes.
      if (zone.foodShop && !game.zone.foodShop && !game.panel) game.openPanel('foods')
      if (!zone.foodShop && game.zone.foodShop && game.panel === 'foods') game.closePanel()
      game.setZone(zone)
    }

    if (zone.trainZone !== lastZone) {
      if (zone.trainZone >= 0 && isZoneUnlocked(game.profile, zone.trainZone)) {
        actions.enterZone(zone.trainZone)
        sfx.zoneEnter()
        sfx.tableStart()
      } else if (lastZone >= 0) {
        actions.leaveZone()
        sfx.tableStop()
      }
      lastZone = zone.trainZone
    }
  }

  const id = setInterval(tick, TICK_MS)
  return () => {
    clearInterval(id)
    unsubscribe()
  }
}
