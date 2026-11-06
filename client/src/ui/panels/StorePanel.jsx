import { SHOP, TRAIN_ZONES } from '@shared/balance'

import { buy } from '../../net/shop'
import { useGame } from '../../store/game'
import Icon from '../Icon'
import PetIcon from '../PetIcon'
import StrokeText from '../StrokeText'
import { ChunkyButton, Price } from '../hud/parts'
import { GRADIENTS, u } from '../hud/style'
import Panel from './Panel'

const SECTIONS = [
  { title: 'Passes', items: ['fatX2', 'coinsX2', 'fatX3', 'coinsX3', 'vip'] },
  { title: 'Potions', items: ['potionsFat', 'potionsCoins'] },
  { title: 'Eggs', items: ['eggsSunset', 'eggsUnicorn', 'eggsDemon'] },
  { title: 'Food Courts', items: ['zoneVeryOp', 'zoneBest'] },
  { title: 'Auras', items: ['auraLightning', 'auraGalaxy', 'auraWater', 'auraFire', 'auraRainbow'] },
  { title: 'Specials', items: ['sphinx'] },
]

const ICONS = {
  fatX2: 'fat',
  coinsX2: 'coin',
  fatX3: 'fat',
  coinsX3: 'coin',
  vip: 'starGold',
  potionsFat: 'potionFat',
  potionsCoins: 'potionCoins',
  eggsSunset: 'egg:sunset',
  eggsUnicorn: 'egg:unicorn',
  eggsDemon: 'egg:demon',
  zoneVeryOp: 'food',
  zoneBest: 'food',
  auraLightning: 'aura:lightning',
  auraGalaxy: 'aura:galaxy',
  auraWater: 'aura:water',
  auraFire: 'aura:fire',
  auraRainbow: 'aura:rainbow',
}

/** What a Food Court pass unlocks, from the table it's for: "Unlocks the 30X Frosty Parlor". */
const zoneBlurb = (product) => {
  const zone = TRAIN_ZONES.find((z) => z.product === product)
  return zone ? `Unlocks the ${zone.mult}X ${zone.name}` : ''
}

const BLURBS = {
  fatX2: 'Double the Fat from every bite, forever',
  coinsX2: 'Double the Coins from every roll, forever',
  fatX3: 'Triple the Fat from every bite, forever',
  coinsX3: 'Triple the Coins from every roll, forever',
  vip: 'x1.5 Fat and x1.5 Coins, forever',
  potionsFat: 'Three x2 Fat potions, cheaper',
  potionsCoins: 'Three x2 Coins potions, cheaper',
  eggsSunset: 'Three Sunset Eggs to hatch',
  eggsUnicorn: 'Three Unicorn Eggs to hatch',
  eggsDemon: 'Three Demon Eggs to hatch',
  zoneVeryOp: zoneBlurb('zoneVeryOp'),
  zoneBest: zoneBlurb('zoneBest'),
  auraLightning: 'x1.25 Coins, and it crackles',
  auraGalaxy: 'x1.5 Coins, and it sparkles',
  auraWater: 'x2 Coins, and it splashes',
  auraFire: 'x3 Coins, and it blazes',
  auraRainbow: 'x5 Coins, in every colour',
  sphinx: 'Limited: x150 Fat pet',
}

/** Everything Coins can buy besides foods, eggs and Fat packs, grouped, with what it does. */
export function StorePanel() {
  const passes = useGame((s) => s.profile.passes)
  const coins = useGame((s) => s.profile.coins)
  return (
    <Panel title="STORE" width={1080}>
      <div className="flex flex-col" style={{ gap: u(18) }}>
        {SECTIONS.map((section) => (
          <div key={section.title}>
            <div style={{ fontSize: u(40), marginBottom: u(8) }}>
              <StrokeText stroke={u(8)} gradient={GRADIENTS.gold}>
                {section.title}
              </StrokeText>
            </div>
            <div className="grid" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${u(200)}, 1fr))`, gap: u(12) }}>
              {section.items.map((id) => {
                const product = SHOP[id]
                const owned = product.kind === 'pass' && passes[id]
                return (
                  <div
                    key={id}
                    className="flex flex-col items-center text-center"
                    style={{ padding: u(10), borderRadius: u(8), border: `${u(5)} solid #111`, background: owned ? GRADIENTS.greyButton : GRADIENTS.rewardCard }}
                  >
                    {id === 'sphinx' ? <PetIcon id="sphinx" size={u(96)} /> : <Icon name={ICONS[id]} size={u(96)} />}
                    <span style={{ fontSize: u(product.name.length > 12 ? 24 : 30), lineHeight: 1.1 }}>
                      <StrokeText stroke={u(6)} style={{ whiteSpace: 'normal' }}>
                        {product.name}
                      </StrokeText>
                    </span>
                    <span className="whitespace-normal" style={{ fontSize: u(18), minHeight: u(44), margin: `${u(4)} 0` }}>
                      <span style={{ color: '#5a3a10' }}>{BLURBS[id]}</span>
                    </span>
                    <ChunkyButton
                      gradient={owned ? GRADIENTS.greyButton : GRADIENTS.greenButton}
                      disabled={owned}
                      onClick={() => buy(id)}
                      className="w-full"
                      style={{ height: u(58) }}
                    >
                      {owned ? (
                        <span style={{ fontSize: u(30) }}>
                          <StrokeText stroke={u(6)}>Owned</StrokeText>
                        </span>
                      ) : (
                        <Price amount={product.price} size={32} afford={coins >= product.price} />
                      )}
                    </ChunkyButton>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  )
}

export default StorePanel
