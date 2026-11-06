/**
 * Player intents. The UI never changes game state itself: it calls one of these, the
 * authority (the Colyseus room, or the offline stand-in) validates it, and the result
 * comes back as an updated profile or an event.
 */

let transport = null

/** Installs the active connection: `{ send(type, payload) }`. */
export function setTransport(next) {
  transport = next
}

export function send(type, payload) {
  if (!transport) return
  transport.send(type, payload)
}

export const actions = {
  /** One click: a bite of your food. */
  eat: () => send('eat'),
  enterZone: (zone) => send('enterZone', { zone }),
  leaveZone: () => send('leaveZone'),
  /** Starts a roll down the track; only counts standing on the ROLL ZONE (walking onto it sends it). */
  startPush: () => send('startPush'),
  /** Where you've got to down the track (a few times a second while rolling). */
  pushAt: (meter, x) => send('pushAt', { meter, x }),
  /** The roll is over: 'blocked' (thrown back by a tape too strong), 'top' (the end of the track) or 'left'. */
  endPush: (reason) => send('endPush', { reason }),
  /** A Boxity emote started ('' when it stops), so the room sees it. */
  emote: (id) => send('emote', { id }),
  /** Back to the spawn point (Boxity's "Reset Character"). */
  respawn: () => send('respawn'),
  rebirth: () => send('rebirth'),
  skipRebirth: () => send('skipRebirth'),
  buyFood: (id) => send('buyFood', { id }),
  equipFood: (id) => send('equipFood', { id }),
  equipAura: (id) => send('equipAura', { id }),
  /** Buys Fat pack `index` (0-2) from under the level bar. */
  buyPack: (index) => send('buyPack', { index }),
  hatch: (eggId, count = 1) => send('hatch', { eggId, count }),
  openEggItem: (itemId) => send('openEggItem', { itemId }),
  equipPet: (uid) => send('equipPet', { uid }),
  unequipPet: (uid) => send('unequipPet', { uid }),
  equipBestPets: () => send('equipBest'),
  deletePet: (uid) => send('deletePet', { uid }),
  usePotion: (itemId) => send('usePotion', { itemId }),
  claimDaily: (day) => send('claimDaily', { day }),
  claimPlaytime: (index) => send('claimPlaytime', { index }),
  claimFreeReward: () => send('claimFreeReward'),
  setSetting: (key, value) => send('setting', { key, value }),
  portal: () => send('portal'),
  /** Buys a shop item with Coins; see shop.js. */
  purchase: (productId) => send('purchase', { productId }),
}
