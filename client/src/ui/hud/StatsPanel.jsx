
import { formatClock, formatNumber } from '@shared/format'

import { useGame } from '../../store/game'
import useNow from '../useNow'
import Icon from '../Icon'
import StrokeText from '../StrokeText'
import { GRADIENTS, u } from './style'

/** Rebirths' colours: the pink and ice-blue of their arrows. */
const REBIRTH_GRADIENT = 'linear-gradient(180deg, #ffe0f6 0%, #ff7ad9 50%, #7fd8ff 100%)'

/** One stat: its icon and number. `small` for the row under the big two. */
function StatRow({ icon, value, gradient, flyTarget = false, small = false }) {
  const k = small ? 0.78 : 1
  return (
    <div className="relative flex items-center" style={{ height: u(78 * k), transformOrigin: 'left center' }} data-coins-target={flyTarget || undefined}>
      <Icon name={icon} size={u(86 * k)} className="relative" />
      {/* Keyed by the value: a new number pops in (pp-bump). */}
      <span key={value} className="pp-bump relative inline-block" style={{ fontSize: u(66 * k), marginLeft: u(6), transformOrigin: 'left center' }}>
        <StrokeText stroke={u(13 * k)} gradient={gradient}>
          {value}
        </StrokeText>
      </span>
    </div>
  )
}

/** Active potion timers, shown over the stats while a boost runs. */
function Boosts() {
  const fatEnd = useGame((s) => s.profile.boosts.fat || 0)
  const coinsEnd = useGame((s) => s.profile.boosts.coins || 0)
  const now = useNow(1000)
  const active = [
    ['potionFat', fatEnd],
    ['potionCoins', coinsEnd],
  ].filter(([, end]) => end > now)
  if (active.length === 0) return null
  return (
    <div className="flex" style={{ gap: u(10), marginBottom: u(4) }}>
      {active.map(([icon, end]) => (
        <div key={icon} className="flex items-center" style={{ fontSize: u(28) }}>
          <Icon name={icon} size={u(54)} />
          <StrokeText stroke={u(6)}>{formatClock(end - now)}</StrokeText>
        </div>
      ))}
    </div>
  )
}

/**
 * Bottom-left, as in the reference: Coins, then Fat, then (a little smaller) your
 * rebirths, with any running potions over them. Your Fat is the power behind a roll -
 * and you keep it all.
 */
export function StatsPanel() {
  // While a roll's Coins fly home, the counter counts up as they land.
  const coins = useGame((s) => s.coinsShown ?? s.profile.coins)
  const fat = useGame((s) => s.profile.fat)
  const rebirths = useGame((s) => s.profile.rebirths)

  return (
    <div className="pointer-events-none absolute flex flex-col" style={{ left: u(20), bottom: 'var(--stats-bottom)' }}>
      <Boosts />
      <StatRow icon="coin" value={formatNumber(coins)} gradient={GRADIENTS.gold} flyTarget />
      <StatRow icon="fat" value={formatNumber(fat)} />
      <StatRow icon="rebirth" value={formatNumber(rebirths)} gradient={REBIRTH_GRADIENT} small />
    </div>
  )
}

export default StatsPanel
