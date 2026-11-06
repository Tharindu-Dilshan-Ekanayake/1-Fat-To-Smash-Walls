/**
 * Hand-off from network events to the frame loop. Events arrive on timers and sockets;
 * the effects they trigger need the renderer's clock and camera, so they are queued
 * here and drained by the effect systems inside useFrame. Plain arrays, never state.
 */

const MAX_QUEUED = 12
const trainQueue = []

export function queueTrainFx(event) {
  trainQueue.push(event)
  if (trainQueue.length > MAX_QUEUED) trainQueue.shift()
}

export function drainTrainFx(handle) {
  while (trainQueue.length) handle(trainQueue.shift())
}

const MAX_BURSTS = 8
const bursts = []

/**
 * Queues a confetti burst at (x, y, z). Dropped by the particle system on presets
 * without particles.
 *
 * @param {{ x: number, y: number, z: number, count?: number, speed?: number,
 *           palette?: 'confetti' | 'gold' | 'power' | 'crumbs' | 'ribbon' | 'dust',
 *           colors?: import('three').Color[] }} burst
 *   `colors`, when given, are used instead of `palette`: a shared array, never copied
 *   (a wall's own brick tints, say).
 */
export function burst({ x, y, z, count = 30, speed = 7, palette = 'confetti', colors = null }) {
  bursts.push({ x, y, z, count, speed, palette, colors })
  if (bursts.length > MAX_BURSTS) bursts.shift()
}

export function drainBursts(handle) {
  while (bursts.length) handle(bursts.shift())
}
