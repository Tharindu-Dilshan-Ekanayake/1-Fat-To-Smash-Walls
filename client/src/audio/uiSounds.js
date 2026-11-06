import { useGame } from '../store/game'
import { sfx } from './sfx'

/**
 * Sounds the UI makes on its own, from the store rather than from each component: a
 * swoosh as a panel opens (or switches) and as it closes. Call once at start-up.
 *
 * @returns {() => void} uninstall
 */
export function installUiSounds() {
  return useGame.subscribe((state, prev) => {
    if (state.panel === prev.panel) return
    if (state.panel) sfx.panelOpen()
    else sfx.panelClose()
  })
}
