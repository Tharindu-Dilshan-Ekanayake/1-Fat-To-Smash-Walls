import { create } from 'zustand'

import { SPHINX_STOCK_DEFAULT } from '@shared/balance'
import { createProfile, createSession } from '@shared/logic'

/**
 * Everything the UI renders from. Written by the network layer (profile, events) and
 * the 10 Hz game ticker (zones, timers) - never from a frame loop.
 *
 * Components must select narrowly (`useGame((s) => s.profile.coins)`), so a bite
 * re-renders the Fat label and nothing else.
 */

export const useGame = create((set) => ({
  /** Authoritative copy of the player's save, as last sent by the server. */
  profile: createProfile('local', 'Player'),
  /** Per-connection state: session start, claimed playtime rewards. */
  session: createSession(Date.now()),
  /** True once the first real profile has arrived. */
  profileLoaded: false,
  /** True once the game is on screen; non-essential start-up work waits for it. */
  playable: false,

  net: {
    /** 'connecting' | 'online' | 'offline' */
    mode: 'connecting',
    lobbyId: null,
    /** Short code friends join with, for private lobbies. */
    code: null,
    isPrivate: false,
    players: 1,
    maxPlayers: 8,
    message: null,
  },
  sphinxStock: SPHINX_STOCK_DEFAULT,
  leaderboards: null,

  /** Where the player is standing, from the ticker. */
  zone: {
    trainZone: -1,
    trainZoneNear: -1,
    pushZone: false,
    /** At the Food Shop's counter (the shop opens). */
    foodShop: false,
    egg: null,
    portal: null,
    freeReward: false,
    sphinx: false,
    auras: false,
    potions: false,
    /** Kept for the HUD's sake: always -1 (there's nothing to take mid-track any more). */
    climbBoulder: -1,
  },

  /** Which modal panel is open: 'rebirth' | 'daily' | 'pets' | 'items' | 'store' | ... */
  panel: null,
  /** Extra data for the open panel (e.g. which egg the hatch panel is for). */
  panelData: null,

  /** True while you're rolling down the track (the frame-rate state is push in pushControl). */
  pushing: false,
  /** True while Boxity shows an ad break: the game stands still. */
  paused: false,
  /** Down the track: 'roll'; null in the plaza. */
  climb: null,
  /** The big message of the moment down the track: { kind: 'tape' | 'blocked' | 'top', ..., id }. */
  pushBanner: null,
  /**
   * The Coins the counter shows while a roll's Coins fly home to it (it counts up as each
   * coin lands); null the rest of the time, when it shows your Coins.
   */
  coinsShown: null,
  /** Active hatch animation: { eggId, pets }. */
  hatch: null,
  /** Keep hatching the egg you're standing at (the T button). Client-side only. */
  autoHatch: false,

  // --- Actions -----------------------------------------------------------------

  setProfile: (profile, session) =>
    set((s) => ({ profile, session: session || s.session, profileLoaded: true })),
  patchProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),
  setNet: (patch) => set((s) => ({ net: { ...s.net, ...patch } })),
  setZone: (zone) => set({ zone }),
  setPlayable: () => set({ playable: true }),
  setSphinxStock: (sphinxStock) => set({ sphinxStock }),
  setLeaderboards: (leaderboards) => set({ leaderboards }),

  openPanel: (panel, panelData = null) => set({ panel, panelData }),
  closePanel: () => set({ panel: null, panelData: null }),
  togglePanel: (panel) => set((s) => (s.panel === panel ? { panel: null, panelData: null } : { panel, panelData: null })),

  setPaused: (paused) => set({ paused }),
  setPushing: (pushing) => set(pushing ? { pushing, panel: null, panelData: null } : { pushing, pushBanner: null }),
  setClimb: (climb) => set({ climb }),
  showPushBanner: (banner) => set({ pushBanner: banner ? { ...banner, id: performance.now() } : null }),
  /** Holds the Coins counter at `coins` (what you had before a payout), for the Coins on their way to it. */
  holdCoins: (coins) => set((s) => ({ coinsShown: s.coinsShown ?? Math.min(coins, s.profile.coins) })),
  /** Some of them have landed: the counter counts up (never past your real Coins). */
  landCoins: (amount) => set((s) => (s.coinsShown === null ? {} : { coinsShown: Math.min(s.profile.coins, Math.round(s.coinsShown + amount)) })),
  /** All home: the counter shows your Coins again. */
  showCoins: () => set({ coinsShown: null }),

  setHatch: (hatch) => set({ hatch }),
  setAutoHatch: (autoHatch) => set({ autoHatch }),
}))

/** Non-reactive snapshot for timers and non-React code. */
export const getGame = () => useGame.getState()
