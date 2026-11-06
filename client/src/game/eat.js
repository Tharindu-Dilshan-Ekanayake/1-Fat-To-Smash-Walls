import { actions } from '../net/actions'
import { push } from './push/pushControl'
import { runtime } from './runtime'

/**
 * One bite: up to the mouth, chomp chomp chomp, GULP (the Player plays it, crunches
 * and all), the "+N Fat" when the authority answers. Every click, tap, the EAT button
 * and Auto Eat come through here. Not mid-roll.
 */
export function eat() {
  if (push.active) return
  runtime.player.ateAt = performance.now()
  actions.eat()
}
