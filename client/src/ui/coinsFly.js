import { sfx } from '../audio/sfx'
import { getGame } from '../store/game'
import { iconUrl } from './icons'

/** At most this many coins fly for one payout. */
const MAX = 10
/** Each coin leaves this long after the one before. */
const STAGGER_MS = 100
/** How long the hop up off your character, and then the flight home, take. */
const HOP_MS = 280
const FLY_MS = 560
/** Coin size, in CSS pixels. */
const SIZE = 54

let layer = null
const pool = []

/** The flying coins' layer over everything: made the first time Coins fly, then reused. */
function coinSprites() {
  if (!layer) {
    layer = document.createElement('div')
    layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:45;overflow:hidden'
    for (let i = 0; i < MAX; i += 1) {
      const img = document.createElement('img')
      img.src = iconUrl('coin')
      img.alt = ''
      img.style.cssText = `position:absolute;left:0;top:0;width:${SIZE}px;height:${SIZE}px;opacity:0;will-change:transform,opacity`
      layer.append(img)
      pool.push(img)
    }
    document.body.append(layer)
  }
  return pool
}

const place = (el, x, y, scale) => {
  el.style.transform = `translate(${x - SIZE / 2}px, ${y - SIZE / 2}px) scale(${scale})`
}

/** The Coins counter gives a little jump as each coin lands in it. */
function bump(el) {
  el.classList.remove('pp-bump')
  void el.offsetWidth
  el.classList.add('pp-bump')
}

/**
 * Coins coming home: coins hop up off your character, then fly one after another into
 * the Coins counter, each landing with a chime a step higher than the last - and the
 * counter (held by holdCoins) counting up by its share. More Coins, more coins flying (up
 * to MAX). DOM and CSS transitions only: nothing in the frame loop.
 */
export function flyCoins(coins) {
  const game = getGame()
  const target = document.querySelector('[data-coins-target]')
  if (!target) {
    game.showCoins()
    return
  }
  const to = target.getBoundingClientRect()
  const tx = to.left + to.width / 2
  const ty = to.top + to.height / 2
  // Your character is about the middle of the screen, a little low.
  const sx = window.innerWidth / 2
  const sy = window.innerHeight * 0.56
  const count = Math.min(MAX, 4 + Math.floor(Math.log10(1 + Math.max(0, coins)) * 2))
  const els = coinSprites()
  for (let i = 0; i < count; i += 1) {
    const el = els[i]
    const hx = sx + (Math.random() - 0.5) * 220
    const hy = sy - 70 - Math.random() * 110
    el.style.transition = 'none'
    el.style.opacity = '0'
    place(el, sx, sy, 0.3)
    setTimeout(() => {
      el.style.transition = `transform ${HOP_MS}ms cubic-bezier(.2,.9,.3,1.5), opacity 120ms`
      el.style.opacity = '1'
      place(el, hx, hy, 1.15)
    }, i * STAGGER_MS)
    setTimeout(() => {
      el.style.transition = `transform ${FLY_MS}ms cubic-bezier(.6,0,.85,.45), opacity 140ms ${FLY_MS - 140}ms`
      el.style.opacity = '0'
      place(el, tx, ty, 0.55)
    }, i * STAGGER_MS + HOP_MS + 60)
    setTimeout(() => {
      sfx.trophy()
      bump(target)
      if (i === count - 1) game.showCoins()
      else game.landCoins(coins / count)
    }, i * STAGGER_MS + HOP_MS + 60 + FLY_MS)
  }
}
