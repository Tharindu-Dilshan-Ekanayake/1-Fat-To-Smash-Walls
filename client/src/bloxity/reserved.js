import { useMemo } from 'react'

import { useBloxityStore } from './store'

/**
 * How far down Boxity's own controls reach over the band from `from` to `to` (fractions
 * of the screen's width), in CSS pixels: the toolbar in the top-left (most of the top
 * edge on a phone) and the chat feed below it, as the portal reports them. 0 outside
 * Boxity. HUD anchored to the top sits below it, so nothing of ours hides under them.
 */
export function useClearTop(from, to) {
  const reserved = useBloxityStore((s) => s.reserved)
  return useMemo(() => {
    if (!reserved?.length || typeof window === 'undefined') return 0
    const width = window.innerWidth
    let bottom = 0
    for (const area of reserved) {
      const left = Number(area?.left) || 0
      const right = left + (Number(area?.width) || 0)
      if (left < to * width && right > from * width) bottom = Math.max(bottom, (Number(area?.top) || 0) + (Number(area?.height) || 0))
    }
    return Math.ceil(bottom)
  }, [reserved, from, to])
}
