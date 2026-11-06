import { useEffect, useRef } from 'react'

import { formatNumber } from '@shared/format'

import { isSlope, STAGES, stageAt, TRACK_LENGTH } from '../../game/push/course'
import { endPush, powerLeft, push } from '../../game/push/pushControl'
import { STAGE_THEMES } from '../../game/push/themes'
import { useBloxityStore } from '../../bloxity/store'
import { RUN_SPEED } from '@shared/balance'

import { useGame } from '../../store/game'
import { useQuality } from '../../store/quality'
import Icon from '../Icon'
import StrokeText from '../StrokeText'
import { ChunkyButton } from './parts'
import { GRADIENTS, u } from './style'

const stageGradient = (i) => {
  const [a, b, c] = STAGE_THEMES[STAGES[i].id].name
  return `linear-gradient(180deg, ${a} 0%, ${b} 45%, ${c} 100%)`
}
const SAFE_GRADIENT = 'linear-gradient(180deg, #ffffff 0%, #e6fbff 45%, #7fe2ff 100%)'
/** How often the frame-rate roll numbers are copied into the DOM. */
const UPDATE_MS = 1000 / 15

/**
 * Your Fat across the top - the power behind your roll - and beside it the Coins this
 * roll has made. Written from the frame-rate roll state by a timer, never by React.
 */
function FatCounter() {
  const ref = useRef(null)
  const coinsRef = useRef(null)
  useEffect(() => {
    let shown = null
    let shownCoins = null
    const id = setInterval(() => {
      const el = ref.current
      if (!el) return
      const left = Math.floor(powerLeft())
      const text = formatNumber(left)
      if (text !== shown) {
        shown = text
        for (const span of el.querySelectorAll('[data-power]')) span.textContent = text
      }
      const coins = `+${formatNumber(push.coins)}`
      if (coins !== shownCoins && coinsRef.current) {
        shownCoins = coins
        for (const span of coinsRef.current.querySelectorAll('[data-coins]')) span.textContent = coins
      }
    }, UPDATE_MS)
    return () => clearInterval(id)
  }, [])
  return (
    <div
      className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 items-center justify-center"
      style={{
        top: u(14),
        height: u(112),
        padding: `0 ${u(70)}`,
        gap: u(14),
        background: 'linear-gradient(90deg, transparent, rgba(220,240,255,0.35) 20%, rgba(220,240,255,0.35) 80%, transparent)',
      }}
    >
      <Icon name="fat" size={u(104)} />
      <span ref={ref} className="pp-text" style={{ fontSize: u(96) }}>
        <span data-power aria-hidden="true" className="pp-text-stroke" style={{ WebkitTextStrokeWidth: u(16) }} />
        <span data-power data-power-fill className="pp-text-fill" style={{ color: '#ffffff' }} />
      </span>
      <span style={{ width: u(30) }} />
      <Icon name="coin" size={u(70)} />
      <span ref={coinsRef} className="pp-text" style={{ fontSize: u(60) }}>
        <span data-coins aria-hidden="true" className="pp-text-stroke" style={{ WebkitTextStrokeWidth: u(12) }} />
        <span data-coins className="pp-text-fill" style={{ color: '#ffe14a' }} />
      </span>
    </div>
  )
}

/**
 * Where you are: the stage's name and how far you've rolled, under the counter. Moved
 * from the frame-rate roll state by a timer, never by React.
 */
function Where() {
  const stageRef = useRef(null)
  const meterRef = useRef(null)
  useEffect(() => {
    let shownStage = null
    let shownMeter = -1
    const id = setInterval(() => {
      const meter = Math.max(0, push.meter)
      // Down a slope, its stage's name; on the flat past a tape, CHECKPOINT.
      const si = stageAt(meter)
      const flat = meter > 0 && meter < TRACK_LENGTH && !isSlope(meter)
      const key = flat ? 'flat' : si
      if (key !== shownStage && stageRef.current) {
        shownStage = key
        for (const span of stageRef.current.querySelectorAll('[data-stage]')) span.textContent = flat ? 'CHECKPOINT' : STAGES[si].name
        const fill = stageRef.current.querySelector('[data-stage-fill]')
        if (fill) fill.style.backgroundImage = flat ? SAFE_GRADIENT : stageGradient(si)
      }
      const m = Math.floor(meter)
      if (m !== shownMeter && meterRef.current) {
        shownMeter = m
        for (const span of meterRef.current.querySelectorAll('[data-meter]')) span.textContent = `${m} m`
      }
    }, UPDATE_MS)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 items-baseline" style={{ top: u(120), gap: u(14) }}>
      <span ref={stageRef} className="pp-text" style={{ fontSize: u(38) }}>
        <span data-stage aria-hidden="true" className="pp-text-stroke" style={{ WebkitTextStrokeWidth: u(9) }} />
        <span data-stage data-stage-fill className="pp-text-fill" style={{ WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }} />
      </span>
      <span ref={meterRef} className="pp-text" style={{ fontSize: u(28) }}>
        <span data-meter aria-hidden="true" className="pp-text-stroke" style={{ WebkitTextStrokeWidth: u(7) }} />
        <span data-meter className="pp-text-fill" style={{ color: '#ffffff' }} />
      </span>
    </div>
  )
}

/**
 * Speed lines streaming in from the edges while you roll flat out - stronger in the burst
 * off a smashed tape. On presets with them only (a full-screen overlay costs a weak phone
 * more than it's worth). Faded by a timer from the frame-rate roll state, never by React.
 */
function SpeedLines() {
  const on = useQuality((s) => s.settings.speedLines)
  const ref = useRef(null)
  useEffect(() => {
    if (!on) return undefined
    let shown = -1
    const id = setInterval(() => {
      const el = ref.current
      if (!el) return
      const fast = push.active && push.phase === 'roll' ? Math.max(0, (push.speed - RUN_SPEED * 0.8) / (RUN_SPEED * 0.45)) : 0
      const opacity = Math.round(Math.min(1, fast) * 20) / 20
      if (opacity === shown) return
      shown = opacity
      el.style.opacity = String(opacity)
    }, UPDATE_MS)
    return () => clearInterval(id)
  }, [on])
  if (!on) return null
  return <div ref={ref} className="pp-speedlines pointer-events-none absolute inset-0" style={{ opacity: 0 }} />
}

/** The big message of the moment: a tape smashed, out of Fat, or the end of the track. */
function Banner() {
  const banner = useGame((s) => s.pushBanner)
  if (!banner) return null
  if (banner.kind === 'blocked') {
    return (
      <div key={banner.id} className="pp-banner pointer-events-none absolute left-1/2 top-[38%] flex flex-col items-center text-center">
        <span style={{ fontSize: u(104) }}>
          <StrokeText stroke={u(20)} gradient={GRADIENTS.priceShort}>
            TOO STRONG!
          </StrokeText>
        </span>
        <span className="flex items-center" style={{ fontSize: u(46), gap: u(8) }}>
          <StrokeText stroke={u(9)}>This tape needs</StrokeText>
          <Icon name="fat" size={u(58)} />
          <StrokeText stroke={u(9)} gradient={GRADIENTS.gold}>
            {`${formatNumber(banner.need)} Fat`}
          </StrokeText>
        </span>
        <span className="flex items-center" style={{ fontSize: u(50), gap: u(10) }}>
          <Icon name="tape" size={u(64)} />
          <StrokeText stroke={u(10)}>{`${banner.tapes} ${banner.tapes === 1 ? 'tape' : 'tapes'} smashed`}</StrokeText>
          <Icon name="coin" size={u(64)} />
          <StrokeText stroke={u(10)} gradient={GRADIENTS.gold}>
            {`+${formatNumber(banner.coins)}`}
          </StrokeText>
        </span>
        <span style={{ fontSize: u(36) }}>
          <StrokeText stroke={u(8)}>Eat more food to smash it!</StrokeText>
        </span>
      </div>
    )
  }
  const top = banner.kind === 'top'
  return (
    <div key={banner.id} className="pp-banner pointer-events-none absolute left-1/2 top-[40%] flex flex-col items-center text-center">
      <span style={{ fontSize: u(top ? 110 : 90) }}>
        <StrokeText stroke={u(18)} gradient={top ? GRADIENTS.rainbow : stageGradient(Math.min(STAGES.length - 1, banner.stage ?? 0))}>
          {top ? 'YOU ROLLED ALL THE WAY!' : banner.streak > 1 ? `TAPE SMASHED! x${banner.streak}` : 'TAPE SMASHED!'}
        </StrokeText>
      </span>
      <span className="flex items-center" style={{ fontSize: u(66), gap: u(10) }}>
        <Icon name="coin" size={u(86)} />
        <StrokeText stroke={u(14)} gradient={GRADIENTS.gold}>
          {`+${formatNumber(banner.coins)} Coins!`}
        </StrokeText>
      </span>
    </div>
  )
}

/** For a brand-new player's first rolls: how to steer. */
function SteerHint() {
  const guiding = useGame((s) => s.profile.tutorialStep <= 1)
  const touch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
  if (!guiding) return null
  return (
    <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-center" style={{ bottom: u(124), fontSize: u(touch ? 28 : 32), width: 'max-content', maxWidth: '64vw', lineHeight: 1.15 }}>
      <StrokeText stroke={u(7)} gradient={GRADIENTS.gold} className="pp-wrap">
        {touch ? 'Smash every tape your Fat is big enough for!' : 'Smash every tape your Fat is big enough for! (A / D to steer)'}
      </StrokeText>
    </div>
  )
}

/** Back to the plaza (Q on a keyboard, or Escape outside Boxity). */
function LobbyButton() {
  useEffect(() => {
    const onKey = (e) => {
      if (e.repeat) return
      // Escape opens Boxity's menu inside Boxity (see bloxity/platform).
      if (e.code === 'KeyQ' || (e.code === 'Escape' && !useBloxityStore.getState().embedded)) endPush('left')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return (
    // Bottom centre.
    <div className="absolute left-1/2 -translate-x-1/2" style={{ bottom: u(24) }}>
      <ChunkyButton
        gradient={GRADIENTS.slate}
        onClick={() => endPush('left')}
        title="Back to the lobby"
        radius={10}
        border={4}
        style={{ height: u(76), padding: `0 ${u(20)}`, gap: u(10) }}
      >
        <Icon name="home" size={u(56)} />
        <span style={{ fontSize: u(36) }}>
          <StrokeText stroke={u(8)}>Lobby</StrokeText>
        </span>
      </ChunkyButton>
    </div>
  )
}

/** Rolling down the track: your Fat and Coins, where you are, the banners, and the way back. */
export function PushHud() {
  const pushing = useGame((s) => s.pushing)
  if (!pushing) return null
  return (
    <>
      <SpeedLines />
      <FatCounter />
      <Where />
      <SteerHint />
      <Banner />
      <LobbyButton />
    </>
  )
}

export default PushHud
