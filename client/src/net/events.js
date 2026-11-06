import { WORLDS } from '@shared/balance'

import { sfx } from '../audio/sfx'
import { burst, queueTrainFx } from '../game/fx/fxQueue'
import { spawnPopup } from '../game/fx/popups'
import { beginPush, push, pushEndedByServer } from '../game/push/pushControl'
import { runtime } from '../game/runtime'
import { getGame } from '../store/game'
import { fadeThrough } from '../ui/fade'

/** A new world's name, big in the middle of the screen. */
const WORLD_POPUP = { screen: true, u: 0, v: 0.25, scale: 3, gradient: 'linear-gradient(180deg, #e0faff 0%, #7fe2ff 45%, #2fa8ff 100%)', life: 2600 }

/** A point above wherever you're drawn: the plaza, or down the track mid-roll. */
const atPlayer = (dy = 1.2) => {
  const p = push.active ? push.position : runtime.player.position
  return { x: p.x, y: p.y + dy, z: p.z }
}

/**
 * Applies one authority event to the client: updates the store and kicks off any
 * visual effect. The same handler serves the Colyseus connection and offline mode.
 */
export function handleServerEvent(type, payload) {
  const game = getGame()
  switch (type) {
    case 'profile': {
      const before = game.profile
      game.setProfile(payload.profile, payload.session)
      // Celebrate the big moments, whatever caused them.
      if (game.profileLoaded && payload.profile.rebirths > before.rebirths) {
        sfx.rebirth()
        burst({ ...atPlayer(), count: 60, speed: 9 })
        // A double spin and a happy hop: skinny again, and stronger for it.
        runtime.player.spinAt = performance.now()
        runtime.player.happyAt = performance.now()
      } else if (game.profileLoaded && payload.profile.ownedFoods.length > before.ownedFoods.length) {
        sfx.cashRegister()
        runtime.player.happyAt = performance.now()
        burst({ ...atPlayer(2.5), count: 30, palette: 'gold' })
      } else if (game.profileLoaded && payload.profile.equippedFood !== before.equippedFood) {
        // Picked an owned food to eat.
        sfx.equip()
      } else if (game.profileLoaded && payload.profile.equippedAura && payload.profile.equippedAura !== before.equippedAura) {
        sfx.reveal()
        burst({ ...atPlayer(1.5), count: 40, palette: 'power', speed: 7 })
      }
      break
    }

    case 'train':
      game.patchProfile({
        fat: payload.fat,
        eaten: payload.eaten,
        level: payload.level,
        // Clicks and walking aren't Food Court eating.
        ...(payload.source === 'zone' ? { lastZone: payload.zone } : {}),
      })
      queueTrainFx(payload)
      if (payload.leveledUp) {
        sfx.levelUp()
        burst({ ...atPlayer(1.8), count: 24, palette: 'power', speed: 6 })
      }
      break

    case 'push':
      beginPush(payload)
      break

    case 'tape':
      // We smash tapes the moment our own ball reaches them (pushControl), before the
      // authority hears; this is it paying for one - nothing more to show.
      break

    case 'pushEnd':
      pushEndedByServer(payload)
      break

    case 'pack':
      sfx.buy()
      burst({ ...atPlayer(2), count: 30, palette: 'power', speed: 7 })
      break

    case 'hatch':
      game.setHatch({ eggId: payload.eggId, pets: payload.pets, id: Date.now() })
      if (payload.eggId) {
        // The egg wobbles on its stand (HatchOverlay's shake), then cracks open.
        setTimeout(sfx.rattle, 250)
        setTimeout(sfx.rattle, 600)
        setTimeout(sfx.rattle, 900)
        setTimeout(sfx.crack, 1100)
        setTimeout(sfx.reveal, 1250)
      } else {
        sfx.reveal()
      }
      break

    case 'offline':
      game.openPanel('offline', payload)
      break

    case 'badge':
      sfx.coins()
      break

    // Through a world portal: a flash to black and the new world's name.
    case 'world': {
      const name = WORLDS[payload.world]?.name ?? 'World 1'
      fadeThrough(() => null)
      sfx.portal()
      setTimeout(() => spawnPopup(`${name.toUpperCase()}!`, runtime.player.position, WORLD_POPUP), 300)
      break
    }

    default:
      break
  }
}
