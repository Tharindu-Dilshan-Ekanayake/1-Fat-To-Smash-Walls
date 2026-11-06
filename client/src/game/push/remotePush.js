import { bulkFor, FAT_SCALE } from '../playerPose'
import { stageAt } from './course'
import { feetPoint } from './path'

let frameKey = -1

/**
 * Eases everyone running down the track towards where they last reported, and moves
 * their stride on by how fast they're going. Idempotent per frame (keyed on the
 * renderer's clock), so the figures, the avatars and the shadows all see exactly the
 * same state however many of them ask. Each remote's `shownAt` is where to draw their
 * feet, `drawnHeight` how tall they're drawn.
 */
export function stepRemotePushers(players, clockTime, delta) {
  if (frameKey === clockTime) return
  frameKey = clockTime
  const k = 1 - Math.exp(-6 * delta)
  for (const r of players.values()) {
    if (!r.pushing) continue
    const before = r.shownMeter
    const beforeX = r.shownX
    r.shownMeter += (r.pushMeter - r.shownMeter) * k
    r.shownX += (r.pushX - r.shownX) * k
    const along = r.shownMeter - before
    const across = r.shownX - beforeX
    r.pushStage = stageAt(r.shownMeter)
    r.pushSpeed = along / Math.max(delta, 1e-3)
    r.climbSpeed = Math.hypot(along, across) / Math.max(delta, 1e-3)
    // Down the track is north (-z).
    if (Math.abs(along) + Math.abs(across) > 1e-3) r.climbYaw = Math.atan2(across, -along)
    r.drawnHeight = 1.8 * (1 + FAT_SCALE * bulkFor(r.fat))
    feetPoint(r.shownMeter, r.shownX, r.shownAt)
  }
}
