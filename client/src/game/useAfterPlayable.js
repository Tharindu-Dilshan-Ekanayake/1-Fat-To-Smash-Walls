import { useEffect, useState } from 'react'

import { useGame } from '../store/game'

/**
 * True from the first idle moment after the game is playable (the loading screen gone):
 * for start-up work nobody needs to start playing - decoration, signs, clouds - so it
 * never delays time-to-playable on a slow phone, and still lands a moment later.
 */
export function useAfterPlayable() {
  const playable = useGame((s) => s.playable)
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    if (!playable || settled) return undefined
    const settle = () => setSettled(true)
    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(settle, { timeout: 1500 })
      return () => cancelIdleCallback(id)
    }
    const id = setTimeout(settle, 300)
    return () => clearTimeout(id)
  }, [playable, settled])
  return settled
}

export default useAfterPlayable
