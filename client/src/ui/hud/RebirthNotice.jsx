import { isMaxLevel } from '@shared/logic'

import { useClearTop } from '../../bloxity/reserved'
import { useGame } from '../../store/game'
import Icon from '../Icon'
import StrokeText from '../StrokeText'
import { GRADIENTS, u } from './style'

/**
 * At max level, a big pulsing call to rebirth at the top of the screen, for as long as
 * it lasts: tap it for the Rebirth panel. (Fat keeps growing at max level, but your
 * level doesn't, so it's the moment to rebirth.)
 */
export function RebirthNotice() {
  const maxed = useGame((s) => isMaxLevel(s.profile))
  const togglePanel = useGame((s) => s.togglePanel)
  // Below Boxity's toolbar, where it spans the top (a phone).
  const clear = useClearTop(0.3, 0.7)
  if (!maxed) return null
  return (
    // Centred by the wrapper, so the button's own press and pulse can move it freely.
    <div className="absolute left-1/2 -translate-x-1/2" style={{ top: `calc(${u(22)} + ${clear}px + var(--notice-drop))` }}>
      <button
        type="button"
        onClick={() => togglePanel('rebirth')}
        className="pp-btn pp-chunky pp-pulse pointer-events-auto relative flex items-center"
        style={{
          gap: u(12),
          padding: `${u(8)} ${u(34)} ${u(8)} ${u(14)}`,
          borderRadius: u(999),
          background: GRADIENTS.purpleButton,
          border: `${u(5)} solid #111`,
        }}
      >
        <span className="pp-gloss" style={{ borderRadius: u(999) }} />
        <Icon name="rebirth" size={u(76)} />
        <span className="flex flex-col items-start" style={{ lineHeight: 1.05 }}>
          <span style={{ fontSize: u(46) }}>
            <StrokeText stroke={u(10)}>MAX LEVEL!</StrokeText>
          </span>
          <span style={{ fontSize: u(30) }}>
            <StrokeText stroke={u(7)} gradient={GRADIENTS.gold}>
              Rebirth now!
            </StrokeText>
          </span>
        </span>
      </button>
    </div>
  )
}

export default RebirthNotice
