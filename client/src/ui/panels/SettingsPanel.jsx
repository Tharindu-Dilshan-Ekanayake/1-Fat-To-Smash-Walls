import { useEffect, useState } from 'react'

import { isMuted, onMutedChange, setMuted } from '../../audio/sfx'
import { QUALITY_LEVELS, useQuality } from '../../store/quality'
import StrokeText from '../StrokeText'
import { ChunkyButton } from '../hud/parts'
import { GRADIENTS, u } from '../hud/style'
import Panel from './Panel'

const QUALITY_NAMES = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High' }

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between" style={{ gap: u(20) }}>
      <span style={{ fontSize: u(44) }}>
        <StrokeText stroke={u(9)}>{label}</StrokeText>
      </span>
      <div className="flex" style={{ gap: u(12) }}>
        {children}
      </div>
    </div>
  )
}

/** Settings: graphics quality (picked by hand, it stays) and sound on or off. */
export function SettingsPanel() {
  const level = useQuality((s) => s.level)
  const manual = useQuality((s) => s.manual)
  const setLevel = useQuality((s) => s.setLevel)
  const [muted, setMutedState] = useState(isMuted)
  useEffect(() => onMutedChange(setMutedState), [])

  return (
    <Panel title="Settings" icon="gear" width={860}>
      <div className="flex flex-col" style={{ gap: u(24) }}>
        <Row label="Graphics">
          {QUALITY_LEVELS.map((q) => (
            <ChunkyButton
              key={q}
              gradient={q === level ? GRADIENTS.greenButton : GRADIENTS.greyButton}
              onClick={() => setLevel(q)}
              title={`${QUALITY_NAMES[q]} graphics`}
              radius={8}
              style={{ width: u(170), height: u(76) }}
            >
              <span style={{ fontSize: u(34) }}>
                <StrokeText stroke={u(7)}>{QUALITY_NAMES[q]}</StrokeText>
              </span>
            </ChunkyButton>
          ))}
        </Row>
        <p className="m-0 text-center" style={{ fontSize: u(26) }}>
          <StrokeText stroke={u(6)}>{manual ? 'Picked by you.' : 'Low to start with, for a smooth game - pick Medium or High for more.'}</StrokeText>
        </p>
        <Row label="Sound">
          {[false, true].map((off) => (
            <ChunkyButton
              key={String(off)}
              gradient={off === muted ? GRADIENTS.greenButton : GRADIENTS.greyButton}
              onClick={() => setMuted(off)}
              title={off ? 'Sound off' : 'Sound on'}
              radius={8}
              style={{ width: u(170), height: u(76) }}
            >
              <span style={{ fontSize: u(34) }}>
                <StrokeText stroke={u(7)}>{off ? 'Off' : 'On'}</StrokeText>
              </span>
            </ChunkyButton>
          ))}
        </Row>
      </div>
    </Panel>
  )
}

export default SettingsPanel
