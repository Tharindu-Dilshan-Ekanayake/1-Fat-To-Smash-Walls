import { schema, t } from '@colyseus/schema'

/** `pushMeter` while not pushing. */
export const NOT_PUSHING = -1000

/**
 * Synced state, kept deliberately small: only what other players need to draw you.
 * Everything private (inventory, items, boosts...) goes to its owner alone as
 * 'profile' messages, never through the shared state.
 */
export const PlayerState = schema(
  {
    name: t.string(),
    /** Their Boxity account id, as Boxity verified it ('' for our own guests): what chat bubbles are matched by. */
    uid: t.string(),
    x: t.float32(),
    y: t.float32(),
    z: t.float32(),
    rotY: t.float32(),
    /** 'idle' | 'walk' | 'train' (eating at a Food Court) | 'jump' | 'push' (running the track) | 'dance' */
    anim: t.string(),
    /** The Boxity emote they're playing ('' = none), and when it started (ms since its own epoch, for its phase). */
    emote: t.string(),
    emoteAt: t.float64(),
    /** What their Bloxity avatar wears, as JSON `{ equipped, proportions }` ('' = base). */
    look: t.string(),
    foodId: t.string(),
    /** The aura they wear ('' = none). */
    aura: t.string(),
    /** Equipped pet species, at most 3. */
    petIds: t.array('string'),
    /**
     * On the tape track: where along it they are (NOT_PUSHING in the plaza), how far
     * across, and their run's phase ('run').
     */
    pushMeter: t.float32(),
    pushX: t.float32(),
    pushPhase: t.string(),
    fat: t.float64(),
    /** The world they're in (WORLDS index): others only see their run in the same one. */
    world: t.uint8(),
    coins: t.float64(),
    rebirths: t.uint16(),
    level: t.uint16(),
  },
  'PlayerState',
)

export const GameState = schema(
  {
    /** sessionId -> player */
    players: t.map(PlayerState),
    /** Short code for private lobbies ('' for public ones). */
    code: t.string(),
    isPrivate: t.boolean(),
  },
  'GameState',
)
