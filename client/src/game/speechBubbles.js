import { Vector3 } from 'three'

import { remotePlayers } from '../net/remotePlayers'
import { push } from './push/pushControl'
import { runtime } from './runtime'

/**
 * Boxity chat over heads. Boxity draws the chat itself (button, bar, feed); a game only
 * shows each player's latest message above their character - for Boxity's bubbleSeconds,
 * a newer one replacing it. `showChatBubble` takes them from the platform module and
 * `placeBubbles` (ChatBubbles, every frame) puts them over the heads, from a small fixed
 * pool of DOM bubbles that never block input.
 */

const POOL = 9
/** Above the head (and the name tag over other players). */
const HEAD = 2.75

/** key ('local' or a Boxity account id) -> { text, until } */
const bubbles = new Map()
let layer = null
const elements = []

function ensureLayer() {
  if (layer) return
  layer = document.createElement('div')
  layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:15;overflow:hidden'
  for (let i = 0; i < POOL; i += 1) {
    const el = document.createElement('div')
    el.style.cssText =
      'position:absolute;left:0;top:0;max-width:200px;padding:5px 10px;border-radius:12px;background:#fff;color:#1d2230;' +
      'font:600 14px/1.25 "Fredoka One",system-ui,sans-serif;text-align:center;white-space:pre-line;overflow:hidden;' +
      'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;box-shadow:0 2px 6px rgba(0,0,0,.25);' +
      'transform:translate(-50%,-100%);opacity:0;will-change:transform'
    layer.append(el)
    elements.push(el)
  }
  document.body.append(layer)
}

/** Shows `text` over `key`'s head ('local' for you) for `seconds`, replacing their last. */
export function showChatBubble(key, text, seconds = 4) {
  try {
    if (!key || !text) return
    ensureLayer()
    bubbles.delete(key)
    bubbles.set(key, { text: String(text), until: performance.now() + Math.max(1, seconds) * 1000 })
    // Oldest out when there are more talkers than bubbles.
    while (bubbles.size > POOL) bubbles.delete(bubbles.keys().next().value)
  } catch {
    // Cosmetic: never let it break anything.
  }
}

const _v = new Vector3()

/** Where `key`'s head is now, into `out`; false if they're not here. */
function headOf(key, out) {
  if (key === 'local') {
    out.copy(push.active ? push.position : runtime.player.position)
    out.y += HEAD
    return true
  }
  for (const r of remotePlayers.values()) {
    if (r.uid !== key) continue
    out.copy(r.shownAt)
    out.y += HEAD
    return true
  }
  return false
}

/** Puts the live bubbles over their heads, seen through `camera` on a `width` x `height` screen. */
export function placeBubbles(camera, width, height) {
  if (!layer) return
  const now = performance.now()
  let i = 0
  for (const [key, bubble] of bubbles) {
    if (now > bubble.until || i >= POOL) {
      bubbles.delete(key)
      continue
    }
    if (!headOf(key, _v)) continue
    _v.project(camera)
    if (_v.z > 1) continue
    const el = elements[i]
    if (el.textContent !== bubble.text) el.textContent = bubble.text
    el.style.transform = `translate(${(_v.x * 0.5 + 0.5) * width}px, ${(-_v.y * 0.5 + 0.5) * height}px) translate(-50%, -100%)`
    // Fades out over its last half second.
    el.style.opacity = String(Math.min(1, (bubble.until - now) / 500))
    i += 1
  }
  for (; i < POOL; i += 1) if (elements[i].style.opacity !== '0') elements[i].style.opacity = '0'
}

/** Hides every bubble (the scene's going). */
export function hideBubbles() {
  for (const el of elements) el.style.opacity = '0'
}
