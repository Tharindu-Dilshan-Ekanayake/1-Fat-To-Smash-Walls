import { useEffect, useRef, useState } from 'react'

import { SHOP, TRAIN_ZONES, WORLD_PORTALS } from '@shared/balance'
import { formatNumber } from '@shared/format'
import { isZoneUnlocked, worldUnlocked } from '@shared/logic'

import { actions } from '../../net/actions'
import { buy } from '../../net/shop'
import { useGame } from '../../store/game'
import Icon from '../Icon'
import StrokeText from '../StrokeText'
import { GRADIENTS, u } from './style'

/**
 * What standing on the current spot lets you do, if anything, in a word or two:
 * { action, price?, run, hold? } - `price` in Coins, shown with a coin. One at a time.
 */
function usePrompt() {
  const atFoodShop = useGame((s) => s.zone.foodShop)
  const atFreeReward = useGame((s) => s.zone.freeReward)
  const freeTaken = useGame((s) => s.session.freeRewardTaken)
  const zoneNear = useGame((s) => s.zone.trainZoneNear)
  const zoneLocked = useGame((s) => s.zone.trainZoneNear >= 0 && !isZoneUnlocked(s.profile, s.zone.trainZoneNear))
  const atSphinx = useGame((s) => s.zone.sphinx)
  const atPortal = useGame((s) => s.zone.portal)
  const world = useGame((s) => s.profile.world)
  const canEnter = useGame((s) => (s.zone.portal ? worldUnlocked(s.profile, WORLD_PORTALS[s.zone.portal].world) : false))
  const atAuras = useGame((s) => s.zone.auras)
  const atPotions = useGame((s) => s.zone.potions)
  const openPanel = useGame((s) => s.openPanel)
  const atRollZone = useGame((s) => s.zone.pushZone)
  const hasFat = useGame((s) => s.profile.fat > 0)

  // On the ROLL ZONE: hold to curl up and roll down the track - on the Fat you've eaten.
  if (atRollZone) return hasFat ? { action: 'Roll!', run: () => actions.startPush(), hold: true } : { action: 'Eat food first!', run: null }

  // A world portal: walking in is what takes you.
  if (atPortal) {
    const portal = WORLD_PORTALS[atPortal]
    if (world === portal.world) return { action: 'Back to World 1', run: null }
    return canEnter ? { action: `Enter ${portal.name}`, run: null } : { action: 'Need', price: portal.coins, run: null }
  }

  if (atSphinx) return { action: 'Buy', price: SHOP.sphinx.price, run: () => buy('sphinx') }
  if (atAuras) return { action: 'Auras', run: () => openPanel('auras') }
  if (atPotions) return { action: 'Potions', run: () => openPanel('items') }

  if (zoneLocked) {
    const zone = TRAIN_ZONES[zoneNear]
    if (zone.product) return { action: 'Unlock', price: SHOP[zone.product].price, run: () => buy(zone.product) }
    return { action: `${zone.rebirths} ${zone.rebirths === 1 ? 'Rebirth' : 'Rebirths'} needed`, run: null }
  }

  if (atFreeReward) return freeTaken ? { action: 'Come back later', run: null } : { action: 'Claim', run: () => actions.claimFreeReward() }

  // At the Food Shop's counter (it opens by itself; this brings it back if closed).
  if (atFoodShop) return { action: 'Food Shop', run: () => openPanel('foods') }
  return null
}

/** Starting a roll: how long E (or a finger on ROLL!) is held while the ring fills. */
const HOLD_MS = 700

const touch = typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 0)

/** The ring that fills round a held button; when it's full, `onDone`. */
function HoldRing({ filling, inset, onDone }) {
  return (
    <svg viewBox="0 0 60 60" className="pointer-events-none absolute" style={{ inset, width: `calc(100% - 2 * ${inset})`, height: `calc(100% - 2 * ${inset})` }}>
      <circle
        // A fresh ring each hold, so it always fills from empty.
        key={filling ? 'fill' : 'empty'}
        cx="30"
        cy="30"
        r="27"
        fill="none"
        stroke="#ffd21f"
        strokeWidth="5"
        strokeLinecap="round"
        pathLength="100"
        strokeDasharray="100"
        strokeDashoffset="100"
        transform="rotate(-90 30 30)"
        className={filling ? 'pp-hold' : undefined}
        style={{ '--hold': `${HOLD_MS}ms` }}
        onAnimationEnd={onDone}
      />
    </svg>
  )
}

/**
 * Proximity prompt: a small pill in the middle of the screen, under your character - the
 * key to press and a word or two. E on keyboard; tap it on touch screens. The ROLL ZONE's
 * is held, not pressed: a ring fills round the key while you hold it, and when it's full
 * you curl up and roll. On a touch screen that's a big ROLL! button under your right
 * thumb instead (where EAT is, which steps aside for it).
 */
export function InteractPrompt() {
  const prompt = usePrompt()
  // Nothing to press mid-roll.
  const busy = useGame((s) => Boolean(s.panel || s.pushing))
  const run = !busy ? prompt?.run : null
  const hold = Boolean(prompt?.hold)
  const [holding, setHolding] = useState(false)
  // The finger (or mouse) holding the prompt: only its lifting lets go, not another
  // finger's - a thumb coming off the joystick mustn't cancel the roll.
  const holdPointer = useRef(null)

  useEffect(() => {
    if (!run) return undefined
    const letGo = () => {
      holdPointer.current = null
      setHolding(false)
    }
    const onDown = (e) => {
      if (e.code !== 'KeyE' || e.repeat) return
      if (hold) setHolding(true)
      else run()
    }
    const onUp = (e) => {
      if (e.code === 'KeyE') letGo()
    }
    const onPointerEnd = (e) => {
      if (e.pointerId === holdPointer.current) letGo()
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('pointerup', onPointerEnd)
    window.addEventListener('pointercancel', onPointerEnd)
    window.addEventListener('blur', letGo)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('pointerup', onPointerEnd)
      window.removeEventListener('pointercancel', onPointerEnd)
      window.removeEventListener('blur', letGo)
    }
  }, [run, hold])

  if (!prompt || busy) return null
  const filling = hold && holding && Boolean(run)
  const grab = (e) => {
    if (!hold || !run) return
    e.preventDefault()
    holdPointer.current = e.pointerId
    setHolding(true)
  }
  const letGo = () => {
    holdPointer.current = null
    setHolding(false)
  }
  const done = () => {
    letGo()
    run?.()
  }

  if (touch && hold) {
    return (
      <button
        type="button"
        aria-label="Roll"
        className="pp-btn pp-chunky pp-pulse pointer-events-auto absolute flex touch-none flex-col items-center justify-center rounded-full"
        style={{ width: 104, height: 104, background: GRADIENTS.greenButton, border: '4px solid #111', right: 96, bottom: 12 }}
        onPointerDown={grab}
        onPointerLeave={letGo}
        onContextMenu={(e) => e.preventDefault()}
      >
        <span className="pp-gloss" style={{ borderRadius: '52px 52px 30px 30px' }} />
        <Icon name="tape" size={54} />
        <span className="pp-stroke" style={{ fontSize: 18, marginTop: -4 }}>
          ROLL!
        </span>
        <HoldRing filling={filling} inset="-14px" onDone={done} />
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={() => !hold && prompt.run?.()}
      onPointerDown={grab}
      onPointerLeave={letGo}
      className="pp-btn pointer-events-auto absolute flex items-center"
      style={{
        left: '50%',
        top: '68%',
        transform: 'translateX(-50%)',
        gap: u(12),
        padding: `${u(8)} ${u(24)} ${u(8)} ${u(prompt.run ? 8 : 24)}`,
        borderRadius: u(999),
        background: 'rgba(16, 20, 30, 0.7)',
        boxShadow: `0 ${u(4)} ${u(14)} rgba(0, 0, 0, 0.3)`,
      }}
    >
      {prompt.run && (
        <span
          className="relative flex items-center justify-center rounded-full"
          style={{ width: u(52), height: u(52), border: `${u(3)} solid #fff`, background: 'rgba(255, 255, 255, 0.12)', fontSize: touch ? u(17) : u(28), color: '#fff' }}
        >
          {/* No E key on a phone: the pill itself is what you tap. */}
          {touch ? 'TAP' : 'E'}
          {hold && <HoldRing filling={filling} inset={u(-9)} onDone={done} />}
        </span>
      )}
      <span className="flex items-center whitespace-nowrap" style={{ fontSize: u(34), gap: u(8) }}>
        <StrokeText stroke={u(8)}>{prompt.action}</StrokeText>
        {prompt.price != null && (
          <>
            <Icon name="coin" size={u(38)} />
            <StrokeText stroke={u(8)} gradient={GRADIENTS.gold}>
              {formatNumber(prompt.price)}
            </StrokeText>
          </>
        )}
      </span>
    </button>
  )
}

export default InteractPrompt
