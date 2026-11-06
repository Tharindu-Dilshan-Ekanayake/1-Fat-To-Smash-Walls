import { useBloxityStore } from './bloxity/store'
import { emoteClip, playEmote } from './game/emotes'
import { runtime } from './game/runtime'
import { push, resetCharacter } from './game/push/pushControl'
import { showChatBubble } from './game/speechBubbles'
import { actions } from './net/actions'
import { remotePlayers, upsertRemotePlayer } from './net/remotePlayers'
import { useGame } from './store/game'
import { useQuality } from './store/quality'

/**
 * `?debug` in the URL exposes game internals on `window.__pp` for the automated
 * perf/screenshot checks and console poking. Off by default; changes nothing else.
 */
export function installDebugHooks() {
  if (typeof window === 'undefined') return
  if (!new URLSearchParams(window.location.search).has('debug')) return
  window.__pp = {
    runtime,
    useGame,
    useQuality,
    actions,
    remotePlayers,
    upsertRemotePlayer,
    push,
    bloxity: useBloxityStore,
    // What Boxity's own events would do: an emote picked, a chat line, "Reset Character".
    playEmote,
    emoteClip,
    showChatBubble,
    resetCharacter,
  }
}
