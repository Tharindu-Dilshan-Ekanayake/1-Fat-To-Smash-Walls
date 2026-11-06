import { PLAYTIME_REWARDS } from '@shared/balance'
import { formatClock } from '@shared/format'
import { playtimeStatus } from '@shared/logic'

import { actions } from '../../net/actions'
import { useGame } from '../../store/game'
import Icon from '../Icon'
import RewardIcon from '../RewardIcon'
import StrokeText from '../StrokeText'
import useNow from '../useNow'
import { GRADIENTS, u } from './style'

/**
 * "FREE GIFT", top right as in the reference: the next playtime reward of this session,
 * peeking out of a gift box, counting down underneath and bouncing once it's ready to
 * claim. Only this ticks once a second; nothing else re-renders for it.
 */
export function GiftTimer() {
  const session = useGame((s) => s.session)
  const now = useNow(1000)
  const next = playtimeStatus(session, now).find((s) => s.state !== 'claimed')
  if (!next) return null
  const reward = PLAYTIME_REWARDS[next.index]
  const ready = next.state === 'ready'

  return (
    <button
      type="button"
      onClick={ready ? () => actions.claimPlaytime(next.index) : undefined}
      title={reward.label}
      className={`pp-btn pointer-events-auto relative flex flex-col items-center ${ready ? 'pp-bounce' : ''}`}
      style={{ width: u(220), cursor: ready ? 'pointer' : 'default' }}
    >
      <span className="relative" style={{ width: u(150), height: u(150) }}>
        <Icon name="gift" size={u(150)} className="absolute left-0 top-0" />
        <span className="absolute" style={{ right: u(-16), top: u(-18) }}>
          <RewardIcon icon={reward.icon} size={u(84)} />
        </span>
      </span>
      <span style={{ fontSize: u(46), marginTop: u(-18), transform: 'rotate(-4deg)' }}>
        <StrokeText stroke={u(10)}>{ready ? 'CLAIM!' : 'FREE GIFT'}</StrokeText>
      </span>
      <span style={{ fontSize: u(30) }}>
        <StrokeText stroke={u(7)} gradient={GRADIENTS.gold}>
          {ready ? reward.label : formatClock(next.unlocksIn)}
        </StrokeText>
      </span>
    </button>
  )
}

export default GiftTimer
