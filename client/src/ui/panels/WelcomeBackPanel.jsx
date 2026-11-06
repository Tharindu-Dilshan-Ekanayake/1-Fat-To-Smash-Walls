import { formatDuration, formatNumber } from '@shared/format'

import { useGame } from '../../store/game'
import Icon from '../Icon'
import StrokeText from '../StrokeText'
import { ChunkyButton } from '../hud/parts'
import { GRADIENTS, u } from '../hud/style'
import Panel from './Panel'

/** "Keep eating while you're offline!": the Fat your Food Court fed you while you were away. */
export function WelcomeBackPanel() {
  const data = useGame((s) => s.panelData)
  const closePanel = useGame((s) => s.closePanel)
  if (!data) return null
  return (
    <Panel title="WELCOME BACK!" width={760}>
      <div className="flex flex-col items-center text-center" style={{ gap: u(12) }}>
        <span style={{ fontSize: u(34) }}>
          <StrokeText stroke={u(7)}>You kept snacking at the Food Court for {formatDuration(data.ms)} while away!</StrokeText>
        </span>
        <div className="flex items-center" style={{ gap: u(10), fontSize: u(84) }}>
          <Icon name="fat" size={u(96)} />
          <StrokeText stroke={u(15)} gradient={GRADIENTS.gold}>
            +{formatNumber(data.fat)} Fat
          </StrokeText>
        </div>
        <ChunkyButton gradient={GRADIENTS.greenButton} onClick={closePanel} style={{ height: u(90), width: u(320) }}>
          <span style={{ fontSize: u(50) }}>
            <StrokeText stroke={u(10)}>Yum!</StrokeText>
          </span>
        </ChunkyButton>
      </div>
    </Panel>
  )
}

export default WelcomeBackPanel
