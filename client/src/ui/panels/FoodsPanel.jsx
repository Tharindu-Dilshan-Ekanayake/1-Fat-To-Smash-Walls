import { useMemo, useState } from 'react'

import { FOODS } from '@shared/balance'
import { formatNumber } from '@shared/format'

import { actions } from '../../net/actions'
import { useGame } from '../../store/game'
import FoodIcon from '../FoodIcon'
import Icon from '../Icon'
import StrokeText from '../StrokeText'
import { ChunkyButton } from '../hud/parts'
import { GRADIENTS, u } from '../hud/style'
import Panel from './Panel'

/** Card backgrounds by state: what you eat, what you have, the next to buy, the rest. */
const CARD = {
  equipped: 'radial-gradient(circle at 50% 38%, #c9ffb0, #5fdc4c 58%, #2e8a2a)',
  owned: 'radial-gradient(circle at 50% 38%, #e8f4ff, #9fd3ff 58%, #4a86c4)',
  next: 'radial-gradient(circle at 50% 38%, #fff6c4, #ffcf4a 58%, #e08a12)',
  locked: 'radial-gradient(circle at 50% 38%, #8a8f99, #5a5f68 58%, #33363c)',
}

/**
 * Where food `index` stands for you: 'equipped', 'owned', 'next' (the next to buy - they
 * go in order) or 'locked' (buy the ones before it first).
 */
function foodState(owned, equipped, index) {
  const food = FOODS[index]
  if (equipped === food.id) return 'equipped'
  if (owned.includes(food.id)) return 'owned'
  const previous = FOODS[index - 1]
  return !previous || owned.includes(previous.id) ? 'next' : 'locked'
}

function FoodCard({ index, state, selected, onClick }) {
  const food = FOODS[index]
  return (
    <button
      type="button"
      onClick={onClick}
      className="pp-btn relative flex flex-col items-center justify-end"
      style={{
        height: u(176),
        borderRadius: u(12),
        border: `${u(5)} solid ${selected ? '#ffffff' : '#111'}`,
        background: CARD[state],
        boxShadow: selected ? `0 0 0 ${u(3)} #111, 0 0 ${u(16)} rgba(255,255,255,0.6)` : 'none',
        paddingBottom: u(6),
        overflow: 'hidden',
      }}
    >
      <FoodIcon id={food.id} size={u(118)} className="absolute" style={{ top: u(6), filter: state === 'locked' ? 'grayscale(0.85) brightness(0.7)' : 'none' }} />
      <span className="relative w-full text-center" style={{ fontSize: u(19), lineHeight: 1.05, overflowWrap: 'break-word' }}>
        <StrokeText stroke={u(5)} className="pp-wrap">
          {food.name}
        </StrokeText>
      </span>
      {state === 'equipped' && <Icon name="check" size={u(44)} className="absolute" style={{ top: u(4), right: u(4) }} />}
      {state === 'locked' && (
        <span className="absolute flex items-center justify-center" style={{ inset: 0, paddingBottom: u(30) }}>
          <Icon name="lock" size={u(64)} />
        </span>
      )}
      {state === 'next' && (
        <span className="absolute flex items-center" style={{ top: u(6), left: u(6), gap: u(2), fontSize: u(22) }}>
          <Icon name="coin" size={u(28)} />
          <StrokeText stroke={u(5)} gradient={GRADIENTS.gold}>
            {formatNumber(food.cost)}
          </StrokeText>
        </span>
      )}
    </button>
  )
}

/**
 * The Food Shop: every food in one place - opened by walking up to the hut's counter.
 * Pick one to see how much Fat a bite gives, then buy it (they go in order, each
 * better than the last) or eat it. What you buy you eat straight away.
 */
export function FoodsPanel() {
  const ownedKey = useGame((s) => s.profile.ownedFoods.join(','))
  const owned = useMemo(() => ownedKey.split(','), [ownedKey])
  const equipped = useGame((s) => s.profile.equippedFood)
  const coins = useGame((s) => s.profile.coins)
  // Start on the next food to buy (or what you're eating, when you have them all).
  const firstPick = useMemo(() => {
    const next = FOODS.findIndex((_, i) => foodState(owned, equipped, i) === 'next')
    return next >= 0 ? next : Math.max(0, FOODS.findIndex((f) => f.id === equipped))
    // Only where it opens: buying moves the selection on by hand.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [picked, setPicked] = useState(firstPick)

  const food = FOODS[picked]
  const state = foodState(owned, equipped, picked)
  const short = state === 'next' && coins < food.cost

  let button
  if (state === 'equipped') button = { label: 'Eating it!', gradient: GRADIENTS.greenButton, disabled: true }
  else if (state === 'owned') button = { label: 'Eat this', gradient: GRADIENTS.blueButton, run: () => actions.equipFood(food.id) }
  else if (state === 'locked') button = { label: `Buy ${FOODS[picked - 1].name} first`, gradient: GRADIENTS.greyButton, disabled: true }
  else if (short) button = { label: `Need ${formatNumber(food.cost - coins)} more`, gradient: GRADIENTS.greyButton, disabled: true, price: food.cost }
  else
    button = {
      label: 'Buy',
      gradient: GRADIENTS.goldButton,
      price: food.cost,
      run: () => {
        actions.buyFood(food.id)
        // On to the next one, ready for when you can afford it.
        if (picked < FOODS.length - 1) setPicked(picked + 1)
      },
    }

  return (
    <Panel title="FOOD SHOP" icon="food" width={1180}>
      <div className="flex" style={{ gap: u(18) }}>
        {/* Every food, in order. */}
        <div className="grid flex-1 content-start overflow-y-auto" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: u(12), maxHeight: '62vh', paddingRight: u(6) }}>
          {FOODS.map((f, i) => (
            <FoodCard key={f.id} index={i} state={foodState(owned, equipped, i)} selected={i === picked} onClick={() => setPicked(i)} />
          ))}
        </div>

        {/* The one you picked. */}
        <div
          className="flex flex-col items-center"
          style={{
            width: u(360),
            flexShrink: 0,
            borderRadius: u(14),
            border: `${u(5)} solid #111`,
            background: 'linear-gradient(180deg, #7fd3ff 0%, #3aa6f0 100%)',
            padding: u(16),
            gap: u(10),
          }}
        >
          <span className="text-center" style={{ fontSize: u(40), lineHeight: 1.05 }}>
            <StrokeText stroke={u(8)}>{food.name}</StrokeText>
          </span>
          {food.tag && (
            <span style={{ fontSize: u(30) }}>
              <StrokeText stroke={u(6)} gradient={GRADIENTS.rainbow}>
                {food.tag}
              </StrokeText>
            </span>
          )}
          <div
            className="flex items-center justify-center"
            style={{ width: u(280), height: u(250), borderRadius: u(16), border: `${u(4)} solid #111`, background: 'radial-gradient(circle at 50% 42%, #ffffff, #d6e9f7 70%)' }}
          >
            <FoodIcon id={food.id} size={u(230)} style={{ filter: state === 'locked' ? 'grayscale(0.85) brightness(0.7)' : 'none' }} />
          </div>
          <div className="flex items-center" style={{ gap: u(8), fontSize: u(38) }}>
            <Icon name="fat" size={u(58)} />
            <StrokeText stroke={u(8)} gradient={GRADIENTS.gold}>
              {`+${formatNumber(food.power)} Fat`}
            </StrokeText>
            <span style={{ fontSize: u(24) }}>
              <StrokeText stroke={u(5)}>a bite</StrokeText>
            </span>
          </div>
          {state !== 'owned' && state !== 'equipped' && (
            <div className="flex items-center" style={{ gap: u(8), fontSize: u(36) }}>
              <Icon name="coin" size={u(52)} />
              <StrokeText stroke={u(8)} gradient={short || state === 'locked' ? GRADIENTS.priceShort : GRADIENTS.gold}>
                {food.cost > 0 ? formatNumber(food.cost) : 'FREE'}
              </StrokeText>
            </div>
          )}
          <ChunkyButton
            gradient={button.gradient}
            disabled={button.disabled}
            onClick={button.run}
            radius={12}
            style={{ width: '100%', minHeight: u(92), marginTop: 'auto', padding: `${u(8)} ${u(10)}`, opacity: button.disabled && state !== 'equipped' ? 0.85 : 1 }}
          >
            <span className="text-center" style={{ fontSize: u(button.label.length > 14 ? 28 : 46), lineHeight: 1.05 }}>
              <StrokeText stroke={u(8)}>{button.label}</StrokeText>
            </span>
          </ChunkyButton>
        </div>
      </div>
    </Panel>
  )
}

export default FoodsPanel
