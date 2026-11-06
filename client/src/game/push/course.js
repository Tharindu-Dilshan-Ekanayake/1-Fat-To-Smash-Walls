import { WORLDS } from '@shared/balance'
import { TRACKS } from '@shared/logic'

/**
 * The track of the world you're in. You roll down one world at a time, so everything on
 * the track reads its stages and rules from these live bindings, and setWorld swaps them
 * all when you step through a portal (the scene then rebuilds the valley: see
 * GameScene). The authority keeps a track per player instead: shared/logic TRACKS.
 */
export let WORLD = 0
export let TRACK = TRACKS[0]
export let STAGES = TRACK.stages
export let TRACK_LENGTH = TRACK.length
/** The tapes, one across the end of every slope: { stage, meter, coins, need }. */
export let TAPES = TRACK.tapes
export let SLOPES_BELOW = TRACK.slopesBelow
export let stageStart = TRACK.stageStart
export let stageTop = TRACK.stageTop
export let safeStart = TRACK.safeStart
export let stageAt = TRACK.stageAt
export let isSlope = TRACK.isSlope
/** How many tapes `fat` smashes, and where a roll with `power` Fat is stopped. */
export let tapesFor = TRACK.tapesFor
export let reachOf = TRACK.reachOf

/** The most stages any world has: for pools sized once, whatever world you're in. */
export const MAX_STAGES = Math.max(...WORLDS.map((world) => world.stages.length))

/** Rolls world `world`'s track from now on. Returns whether that's a change. */
export function setWorld(world) {
  const track = TRACKS[world] ?? TRACKS[0]
  if (track === TRACK) return false
  WORLD = track.index
  TRACK = track
  STAGES = track.stages
  TRACK_LENGTH = track.length
  TAPES = track.tapes
  SLOPES_BELOW = track.slopesBelow
  stageStart = track.stageStart
  stageTop = track.stageTop
  safeStart = track.safeStart
  stageAt = track.stageAt
  isSlope = track.isSlope
  tapesFor = track.tapesFor
  reachOf = track.reachOf
  return true
}
