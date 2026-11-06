import { useEffect, useState } from 'react'

import { isMuted, onMutedChange, setMuted } from '../../audio/sfx'
import { useClearTop } from '../../bloxity/reserved'
import { useBloxityStore } from '../../bloxity/store'
import { useGame } from '../../store/game'
import AuthHUD from '../AuthHUD'
import Icon from '../Icon'
import { AlertBadge, ChunkyButton } from './parts'
import { GRADIENTS, u } from './style'

function RoundButton({ icon, label, onClick, alert, iconSize = 38 }) {
  return (
    <ChunkyButton gradient={GRADIENTS.slate} onClick={onClick} title={label} radius={32} style={{ width: u(64), height: u(64) }}>
      <Icon name={icon} size={u(iconSize)} />
      {alert && <AlertBadge size={26} style={{ top: u(-8), right: u(-8) }} />}
    </ChunkyButton>
  )
}

/** Turns the music and sound effects on and off (remembered on this device). */
function SoundButton() {
  const [muted, setMutedState] = useState(isMuted)
  useEffect(() => onMutedChange(setMutedState), [])
  return <RoundButton icon={muted ? 'soundOff' : 'sound'} label={muted ? 'Sound: off' : 'Sound: on'} onClick={() => setMuted(!muted)} iconSize={36} />
}

/**
 * The top-right corner: sound, leaderboards and your name tag. (Daily rewards are the
 * Gifts tile on the left.)
 */
export function TopBar() {
  const openPanel = useGame((s) => s.openPanel)
  // Inside Boxity its trophy button has the leaderboards; on a phone its toolbar spans
  // the top, so this sits below it.
  const embedded = useBloxityStore((s) => s.embedded)
  const clear = useClearTop(0.55, 1)

  return (
    <div className="pointer-events-none absolute flex items-center" style={{ right: u(16), top: `calc(${u(14)} + ${clear}px)`, gap: u(12) }}>
      <SoundButton />
      {!embedded && <RoundButton icon="star" label="Leaderboards" onClick={() => openPanel('leaderboards')} iconSize={34} />}
      <AuthHUD />
    </div>
  )
}

export default TopBar
