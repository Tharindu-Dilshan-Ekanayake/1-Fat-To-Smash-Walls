import { AURAS, SHOP } from '@shared/balance'
import { formatMultiplier } from '@shared/format'

import { actions } from '../../net/actions'
import { buy } from '../../net/shop'
import { useGame } from '../../store/game'
import Icon from '../Icon'
import StrokeText from '../StrokeText'
import { ChunkyButton, Price } from '../hud/parts'
import { GRADIENTS, u } from '../hud/style'
import Panel from './Panel'

/** One aura's row, as in the reference: its icon, name and Coins multiplier, and buy or wear. */
function AuraRow({ id }) {
  const aura = AURAS[id]
  const product = SHOP[aura.product]
  const owned = useGame((s) => Boolean(s.profile.passes[aura.product]))
  const worn = useGame((s) => s.profile.equippedAura === id)
  const afford = useGame((s) => s.profile.coins >= product.price)

  let button
  if (worn) {
    button = (
      <ChunkyButton gradient={GRADIENTS.greyButton} onClick={() => actions.equipAura(null)} title="Take off" radius={8} style={{ width: u(240), height: u(80) }}>
        <span style={{ fontSize: u(36) }}>
          <StrokeText stroke={u(8)}>Equipped</StrokeText>
        </span>
      </ChunkyButton>
    )
  } else if (owned) {
    button = (
      <ChunkyButton gradient={GRADIENTS.blueButton} onClick={() => actions.equipAura(id)} title="Equip" radius={8} style={{ width: u(240), height: u(80) }}>
        <span style={{ fontSize: u(40) }}>
          <StrokeText stroke={u(8)}>Equip</StrokeText>
        </span>
      </ChunkyButton>
    )
  } else {
    button = (
      <ChunkyButton gradient={GRADIENTS.greenButton} onClick={() => buy(aura.product)} title={`Buy ${aura.name}`} radius={8} style={{ width: u(240), height: u(80) }}>
        <Price amount={product.price} size={40} afford={afford} />
      </ChunkyButton>
    )
  }

  return (
    <div
      className="flex items-center"
      style={{ gap: u(18), padding: u(12), borderRadius: u(8), border: `${u(4)} solid #0b0d12`, background: 'linear-gradient(90deg, rgba(40,48,70,0.9), rgba(24,28,40,0.9))' }}
    >
      <div className="flex items-center justify-center" style={{ width: u(130), height: u(130), borderRadius: u(8), background: 'rgba(0,0,0,0.35)' }}>
        <Icon name={`aura:${id}`} size={u(116)} />
      </div>
      <div className="flex flex-1 flex-col">
        <span style={{ fontSize: u(50) }}>
          <StrokeText stroke={u(10)}>{aura.name}</StrokeText>
        </span>
        <span className="flex items-center" style={{ fontSize: u(46), gap: u(6) }}>
          <Icon name="coin" size={u(52)} />
          <StrokeText stroke={u(9)} gradient={GRADIENTS.gold}>
            {formatMultiplier(aura.coins)}
          </StrokeText>
        </span>
      </div>
      {button}
    </div>
  )
}

/** The aura stand's panel: every aura, each multiplying the Coins your rolls earn. */
export function AurasPanel() {
  return (
    <Panel title="Auras" icon="aura:rainbow" width={940}>
      <div className="flex flex-col" style={{ gap: u(14) }}>
        {Object.keys(AURAS).map((id) => (
          <AuraRow key={id} id={id} />
        ))}
      </div>
    </Panel>
  )
}

export default AurasPanel
