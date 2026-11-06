import { levelCap, rebirthMultiplier, TRAIN_ZONES, walkSpeed } from '@shared/balance'
import { formatMultiplier } from '@shared/format'
import { isMaxLevel, rebirthProgress, rebirthSkipPrice } from '@shared/logic'

import { sfx } from '../../audio/sfx'
import { actions } from '../../net/actions'
import { getGame, useGame } from '../../store/game'
import Icon from '../Icon'
import StrokeText from '../StrokeText'
import { ChunkyButton, Price } from '../hud/parts'
import { GRADIENTS, u } from '../hud/style'
import Panel from './Panel'

const BEFORE = 'linear-gradient(180deg, #ff9a8a 0%, #ff4a3b 100%)'
const AFTER = 'linear-gradient(180deg, #c6ff7a 0%, #4fdc2a 100%)'
const LEVEL_FILL = 'linear-gradient(180deg, #c6ff7a 0%, #6fe03a 50%, #26ad3c 100%)'
const PINK = 'linear-gradient(180deg, #ff9cf4 0%, #e83ad6 50%, #a81aa0 100%)'

/** One stat on a dark card: its icon, the value under it, and "Before"/"After" over it. */
function StatCard({ icon, text, after }) {
  return (
    <div
      className="relative flex flex-col items-center justify-end"
      style={{ height: u(150), borderRadius: u(8), background: 'rgba(20, 24, 34, 0.75)', border: `${u(4)} solid #0b0d12`, paddingBottom: u(6) }}
    >
      <span className="absolute" style={{ top: u(-4), fontSize: u(26) }}>
        <StrokeText stroke={u(6)} gradient={after ? AFTER : BEFORE}>
          {after ? 'After' : 'Before'}
        </StrokeText>
      </span>
      <Icon name={icon} size={u(84)} />
      <span style={{ fontSize: u(text.length > 13 ? 23 : text.length > 11 ? 26 : 32) }}>
        <StrokeText stroke={u(7)}>{text}</StrokeText>
      </span>
    </div>
  )
}

/** The best Food Court `rebirths` rebirths open (the ones bought with Coins aside). */
const bestZone = (rebirths) => TRAIN_ZONES.filter((z) => !z.product && z.rebirths <= rebirths).at(-1)

/** One rebirth's numbers: its max level, walking speed, Fat multiplier and best Food Court. */
function Column({ rebirths, after }) {
  return (
    <div className="flex flex-col items-center" style={{ gap: u(10) }}>
      <span style={{ fontSize: u(44) }}>
        <StrokeText stroke={u(9)}>Rebirth {rebirths}</StrokeText>
      </span>
      <div className="grid w-full grid-cols-2" style={{ gap: u(10) }}>
        <StatCard icon="starGold" text={`Level ${levelCap(rebirths)}`} after={after} />
        <StatCard icon="fastForward" text={`${walkSpeed(levelCap(rebirths), rebirths).toFixed(1)} Speed`} after={after} />
        <StatCard icon="fat" text={`${formatMultiplier(rebirthMultiplier(rebirths))} Fat`} after={after} />
        <StatCard icon="food" text={`${bestZone(rebirths).mult}X Food Court`} after={after} />
      </div>
    </div>
  )
}

/**
 * Rebirth, as in the reference: this rebirth's numbers against the next one's (max
 * level, speed, Fat multiplier, best Food Court), your progress to max level, and the
 * Rebirth button once you're there - or Skip, for Coins, before then. Rebirth resets your
 * Fat and level; Coins, food and pets stay.
 */
export function RebirthPanel() {
  const rebirths = useGame((s) => s.profile.rebirths)
  const level = useGame((s) => s.profile.level)
  const progress = useGame((s) => rebirthProgress(s.profile))
  const ready = useGame((s) => isMaxLevel(s.profile))
  const skipPrice = useGame((s) => rebirthSkipPrice(s.profile))
  const canSkip = useGame((s) => s.profile.coins >= skipPrice)
  const autoRebirth = useGame((s) => s.profile.settings.autoRebirth)
  const cap = levelCap(rebirths)

  const skip = () => {
    if (getGame().profile.coins < skipPrice) {
      sfx.error()
      return
    }
    actions.skipRebirth()
  }

  return (
    <Panel title="Rebirth" icon="rebirth" width={980}>
      <div className="grid items-center" style={{ gridTemplateColumns: '1fr auto 1fr', columnGap: u(16) }}>
        <Column rebirths={rebirths} />
        <Icon name="fastForward" size={u(80)} />
        <Column rebirths={rebirths + 1} after />
      </div>

      <div
        className="relative mx-auto overflow-hidden"
        style={{ width: '92%', marginTop: u(18), height: u(64), borderRadius: u(8), border: `${u(5)} solid #111`, background: 'rgba(0,0,0,0.45)' }}
      >
        <div className="absolute inset-y-0 left-0" style={{ width: `${progress * 100}%`, background: LEVEL_FILL }} />
        <div className="absolute inset-0 flex items-center justify-center" style={{ fontSize: u(44) }}>
          <StrokeText stroke={u(9)}>
            Level {level}/{cap}
          </StrokeText>
        </div>
      </div>

      <div className="flex justify-center" style={{ marginTop: u(18), gap: u(22) }}>
        <ChunkyButton
          disabled={!ready}
          onClick={() => actions.rebirth()}
          gradient={ready ? GRADIENTS.greenButton : GRADIENTS.greyButton}
          style={{ height: u(96), width: u(380) }}
          radius={8}
          border={5}
        >
          <span style={{ fontSize: u(54) }}>
            <StrokeText stroke={u(11)}>{ready ? 'REBIRTH' : `Need Level ${cap}`}</StrokeText>
          </span>
        </ChunkyButton>
        {!ready && (
          <ChunkyButton onClick={skip} gradient={PINK} className="flex-col" style={{ height: u(96), width: u(380), lineHeight: 1 }} radius={8} border={5}>
            <span style={{ fontSize: u(44) }}>
              <StrokeText stroke={u(9)}>SKIP REBIRTH</StrokeText>
            </span>
            <Price amount={skipPrice} size={30} afford={canSkip} />
          </ChunkyButton>
        )}
      </div>

      <p className="m-0 text-center" style={{ fontSize: u(46), marginTop: u(16) }}>
        <StrokeText stroke={u(9)} gradient={GRADIENTS.priceShort}>
          Rebirth resets your Fat and level!
        </StrokeText>
      </p>

      <label className="pointer-events-auto flex cursor-pointer items-center justify-center" style={{ marginTop: u(10), gap: u(12), fontSize: u(30) }}>
        <input
          type="checkbox"
          checked={autoRebirth}
          onChange={(e) => actions.setSetting('autoRebirth', e.target.checked)}
          style={{ width: u(32), height: u(32), accentColor: '#3fdc4a' }}
        />
        <StrokeText stroke={u(7)}>Auto Rebirth at max level</StrokeText>
      </label>
    </Panel>
  )
}

export default RebirthPanel
