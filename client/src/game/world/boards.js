import { formatNumber } from '@shared/format'

/** The three leaderboards: titles, colours and value formatting. */
export const BOARD_INFO = {
  rebirths: { title: 'Most Rebirths', color: '#ff5c8a', format: (v) => formatNumber(v) },
  fat: { title: 'Fattest', color: '#ffb21e', format: (v) => formatNumber(v) },
  height: { title: 'Furthest Roll', color: '#4fc3ff', format: (v) => `${formatNumber(v)} m` },
}

/** Rows for a board: the server's top 10, or just you when offline. */
export function boardRows(leaderboards, profile, id) {
  if (leaderboards?.[id]?.length) return leaderboards[id]
  const value = id === 'rebirths' ? profile.rebirths : id === 'fat' ? profile.stats.bestFat : profile.stats.bestMeter
  return [{ name: profile.name, value }]
}
