import { formatNumber } from '@shared/format'
import { isMaxLevel, levelProgress, levelXp, fatPacks } from '@shared/logic'

import { sfx } from '../../audio/sfx'
import { actions } from '../../net/actions'
import { getGame, useGame } from '../../store/game'
import Icon from '../Icon'
import StrokeText from '../StrokeText'
import { ChunkyButton, Price } from './parts'
import { u } from './style'

/** Width of the bar, in reference pixels; the packs line up under it. */
const WIDTH = 836

const PACK_GRADIENTS = [
  'linear-gradient(180deg, #c6ff6a 0%, #6fe03a 50%, #2fae2a 100%)',
  'linear-gradient(180deg, #ffe25a 0%, #ffb21e 55%, #f07a0a 100%)',
  'linear-gradient(180deg, #ff9cf4 0%, #ff4fb4 50%, #e01a7a 100%)',
]

const BAR_FILL = 'linear-gradient(180deg, #c6ff7a 0%, #6fe03a 50%, #2fae2a 100%)'
/** The bar's empty part: a dark, studded strip, as in the reference. */
const BAR_EMPTY = `radial-gradient(circle at 50% 45%, rgba(255,255,255,0.14) 0 28%, transparent 30%) 0 0 / ${u(22)} ${u(22)}, rgba(18, 24, 36, 0.62)`

/**
 * "Level 5 ... 25/36": your level, and the Fat you've eaten into it against what it
 * takes. At max
 * level it reads "Max" and opens the rebirth panel.
 */
function Bar() {
  const level = useGame((s) => s.profile.level)
  const have = useGame((s) => levelXp(s.profile).have)
  const need = useGame((s) => levelXp(s.profile).need)
  const maxed = useGame((s) => isMaxLevel(s.profile))
  const fill = useGame((s) => levelProgress(s.profile))
  const openPanel = useGame((s) => s.openPanel)

  return (
    <button
      type="button"
      onClick={maxed ? () => openPanel('rebirth') : undefined}
      className={`relative w-full overflow-hidden text-left ${maxed ? 'pp-btn pointer-events-auto' : 'pointer-events-none'}`}
      style={{ height: u(68), borderRadius: u(8), border: `${u(5)} solid #0d1220`, background: BAR_EMPTY }}
    >
      <div
        className="absolute inset-y-0 left-0 transition-[width] duration-300 ease-out"
        style={{ width: `${(maxed ? 0 : fill) * 100}%`, background: BAR_FILL }}
      />
      <div className="absolute inset-0 flex items-center justify-between" style={{ padding: `0 ${u(22)}`, fontSize: u(46) }}>
        <StrokeText stroke={u(10)}>Level {level}</StrokeText>
        <StrokeText stroke={u(10)}>{maxed ? 'Max' : `${formatNumber(have)}/${formatNumber(need)}`}</StrokeText>
      </div>
    </button>
  )
}

/** A Fat pack: "+140" by a drumstick on the button, its price in Coins under the corner. */
function PackButton({ index, amount, price, afford }) {
  const buy = () => {
    if (getGame().profile.coins < price) {
      sfx.error()
      return
    }
    actions.buyPack(index)
  }
  return (
    <ChunkyButton gradient={PACK_GRADIENTS[index]} onClick={buy} title={`+${formatNumber(amount)} Fat`} radius={6} border={5} style={{ width: u(204), height: u(60) }}>
      <Icon name="fat" size={u(82)} className="absolute" style={{ left: u(-26), top: u(-22) }} />
      <span className="relative" style={{ fontSize: u(44), marginLeft: u(28) }}>
        <StrokeText stroke={u(10)}>+{formatNumber(amount)}</StrokeText>
      </span>
      <span className="absolute" style={{ bottom: u(-30), left: u(18) }}>
        <Price amount={price} size={28} afford={afford} />
      </span>
    </ChunkyButton>
  )
}

/** Bottom centre: the level bar, and the three Fat packs under it. */
export function LevelBar() {
  const rebirths = useGame((s) => s.profile.rebirths)
  const level = useGame((s) => s.profile.level)
  const world = useGame((s) => s.profile.world)
  const coins = useGame((s) => s.profile.coins)
  const packs = fatPacks({ level, rebirths, world })

  return (
    <div className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 flex-col items-center" style={{ bottom: 'var(--levelbar-bottom)', width: u(WIDTH), maxWidth: '96vw', gap: u(14) }}>
      <Bar />
      <div className="flex justify-center" style={{ gap: u(26) }}>
        {packs.map((pack, i) => (
          <PackButton key={i} index={i} amount={pack.amount} price={pack.price} afford={coins >= pack.price} />
        ))}
      </div>
    </div>
  )
}

export default LevelBar
