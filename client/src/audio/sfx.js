import { createMusic } from './music'

/**
 * Sound effects and the background music, synthesised with WebAudio: no audio files
 * to download.
 *
 * Browsers only allow audio after a user gesture, so the AudioContext is created on
 * the first tap/click/key (which also starts the music) and every sound before that is
 * silently skipped.
 */

const MUTE_KEY = 'mb.muted'

let ctx = null
let master = null
/** Input of the echo the chimes ring out into (see createEcho). */
let echo = null
let noiseBuffer = null
let music = null
let muted = readMuted()
/** Boxity's volume settings, 0-1: everything, and the music on its own. */
let allVolume = 1
let musicVolume = 1
/** True while Boxity shows an ad break: silent until it's over. */
let adBreak = false
/** Where the master gain sits now. */
const masterLevel = () => (muted || adBreak ? 0 : 0.5 * allVolume)
const lastPlayed = new Map()
const muteListeners = new Set()

function readMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

function unlock() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume()
    return
  }
  const Ctor = window.AudioContext || window.webkitAudioContext
  if (!Ctor) return
  ctx = new Ctor()
  master = ctx.createGain()
  master.gain.value = masterLevel()
  master.connect(ctx.destination)
  echo = createEcho()
  // One second of white noise, reused by every whoosh and crack.
  noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const data = noiseBuffer.getChannelData(0)
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1
  music = createMusic(ctx, master, noiseBuffer)
  music.setVolume(musicVolume)
  music.start()
}

/**
 * A short, darkening echo for the chimes to ring out into, so they sparkle instead of
 * clicking off. Built once; every sound sent to it shares it.
 */
function createEcho() {
  const input = ctx.createGain()
  input.gain.value = 0.25
  const delay = ctx.createDelay(1)
  delay.delayTime.value = 0.13
  const damp = ctx.createBiquadFilter()
  damp.type = 'lowpass'
  damp.frequency.value = 3200
  const feedback = ctx.createGain()
  feedback.gain.value = 0.32
  input.connect(delay)
  delay.connect(damp).connect(feedback).connect(delay)
  damp.connect(master)
  return input
}

/** Installs the first-gesture unlock. Call once at startup. */
export function installAudioUnlock() {
  const events = ['pointerdown', 'keydown', 'touchend']
  const handler = () => {
    unlock()
    for (const e of events) window.removeEventListener(e, handler, true)
  }
  for (const e of events) window.addEventListener(e, handler, true)
  // Mobile browsers suspend audio in the background; resume on return.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && ctx?.state === 'suspended') ctx.resume()
  })
}

export function isMuted() {
  return muted
}

export function setMuted(value) {
  muted = value
  try {
    localStorage.setItem(MUTE_KEY, value ? '1' : '0')
  } catch {
    // Not persisted; fine.
  }
  if (master) master.gain.value = masterLevel()
  for (const listener of muteListeners) listener(muted)
}

const clamp01 = (v) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 1))

/** Boxity's volume settings (0-1): `all` for everything, `music` for the music alone. */
export function setVolumes({ all = allVolume, music: musicLevel = musicVolume } = {}) {
  allVolume = clamp01(all)
  musicVolume = clamp01(musicLevel)
  if (master) master.gain.value = masterLevel()
  music?.setVolume(musicVolume)
}

/** Boxity's ad breaks: every sound off for the break, back as it was after. */
export function setAdBreak(on) {
  adBreak = Boolean(on)
  if (master) master.gain.value = masterLevel()
}

/** Calls `listener(muted)` on every change; returns the unsubscribe. */
export function onMutedChange(listener) {
  muteListeners.add(listener)
  return () => muteListeners.delete(listener)
}

// --- The roll: the sound of you, curled into a ball, rolling down the hill --------------

let roll = null
let rollSetAt = 0
/** Deep brown noise (like far-off thunder) and gravel crackle, made the first time you roll. */
let brownBuffer = null
let gravelBuffer = null

function rollBuffers() {
  if (brownBuffer) return
  const n = ctx.sampleRate * 2
  brownBuffer = ctx.createBuffer(1, n, ctx.sampleRate)
  const brown = brownBuffer.getChannelData(0)
  let last = 0
  for (let i = 0; i < n; i += 1) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02
    brown[i] = last * 3.5
  }
  // Tilted so it ends where it starts: no click each time round the loop.
  const drift = brown[n - 1] - brown[0]
  for (let i = 0; i < n; i += 1) brown[i] -= (drift * i) / (n - 1)
  // Gravel: silence scattered with tiny clicks of every size, some 600 a second.
  gravelBuffer = ctx.createBuffer(1, n, ctx.sampleRate)
  const gravel = gravelBuffer.getChannelData(0)
  for (let i = 0; i < n - 24; i += 1) {
    if (Math.random() >= 600 / ctx.sampleRate) continue
    const a = Math.random() ** 2 * (Math.random() < 0.5 ? -1 : 1)
    for (let k = 0; k < 24; k += 1) gravel[i + k] += a * Math.exp(-k / 5) * (k % 2 ? -1 : 1)
  }
}

/** A looping buffer through a filter and a gain (starting silent) into the mix. */
function rollLayer(buffer, type, frequency, q) {
  const src = ctx.createBufferSource()
  src.buffer = buffer
  src.loop = true
  const filter = ctx.createBiquadFilter()
  filter.type = type
  filter.frequency.value = frequency
  filter.Q.value = q
  const gain = ctx.createGain()
  gain.gain.value = 0.0001
  src.connect(filter).connect(gain).connect(master)
  src.start()
  return { src, filter, gain }
}

/**
 * A big round body rolling, in three layers: a deep rumble of its weight on the ground; a
 * soft thump each time it comes round (see rollThuds); and grit crunching under it,
 * crackling faster the faster it goes. And a low growl that swells as the last of your
 * Fat runs out. The music ducks under it until `rollStop`.
 */
function rollStart() {
  if (!ctx || roll || ctx.state !== 'running') return
  rollBuffers()
  const rumble = rollLayer(brownBuffer, 'lowpass', 120, 0.9)
  const gravel = rollLayer(gravelBuffer, 'bandpass', 2400, 0.7)
  // Wind rushing past, only once you're going fast.
  const wind = rollLayer(noiseBuffer, 'bandpass', 900, 0.6)
  // The growl: a low buzz through a lowpass, for straining.
  const growl = ctx.createOscillator()
  growl.type = 'sawtooth'
  growl.frequency.value = 70
  const growlFilter = ctx.createBiquadFilter()
  growlFilter.type = 'lowpass'
  growlFilter.frequency.value = 260
  const growlGain = ctx.createGain()
  growlGain.gain.value = 0.0001
  growl.connect(growlFilter).connect(growlGain).connect(master)
  growl.start()
  roll = { rumble, gravel, wind, growl, growlGain, nextThud: ctx.currentTime }
  music?.duck(true)
}

/** You coming round onto the ground at `t`: a low, soft knock that drops in pitch, and a puff of grit. */
function thud(t, volume, pitch) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.frequency.setValueAtTime(pitch * 1.5, t)
  osc.frequency.exponentialRampToValueAtTime(pitch, t + 0.06)
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.006)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22)
  osc.connect(gain).connect(master)
  osc.start(t)
  osc.stop(t + 0.25)
  const grit = ctx.createBufferSource()
  grit.buffer = brownBuffer
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 520
  const gritGain = ctx.createGain()
  gritGain.gain.setValueAtTime(volume * 0.9, t)
  gritGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12)
  grit.connect(filter).connect(gritGain).connect(master)
  grit.start(t, Math.random() * 1.5, 0.14)
}

/**
 * Schedules the thumps a little ahead: about one a turn - quicker the faster you roll,
 * slower and deeper the bigger (fatter) you are - each a little uneven.
 */
function rollThuds(level, size) {
  const t = ctx.currentTime
  if (level < 0.05) {
    roll.nextThud = t + 0.08
    return
  }
  const rate = (0.9 + level * 3.6) * (1.6 / size)
  const pitch = 64 * Math.sqrt(1.5 / size)
  roll.nextThud = Math.max(roll.nextThud, t + 0.02)
  while (roll.nextThud < t + 0.25) {
    thud(roll.nextThud, (0.07 + level * 0.16) * (0.6 + Math.random() * 0.6), pitch * (0.9 + Math.random() * 0.2))
    roll.nextThud += (0.75 + Math.random() * 0.5) / rate
  }
}

/**
 * `level` 0..1 from how fast you roll; `strain` 0..1 how close your Fat is to running
 * out; `size` your ball's radius. Positional, not an object: it's called every frame.
 */
function rollSet(level, strain = 0, size = 1.5) {
  if (!roll) return
  // Ten updates a second is plenty for a smooth swell.
  const now = performance.now()
  if (now - rollSetAt < 100) return
  rollSetAt = now
  const t = ctx.currentTime
  const l = Math.min(1, Math.max(0, level))
  roll.rumble.gain.gain.setTargetAtTime(0.03 + l * 0.24, t, 0.12)
  roll.rumble.filter.frequency.setTargetAtTime(90 + l * 130, t, 0.2)
  roll.gravel.gain.gain.setTargetAtTime(0.0001 + l * 0.12, t, 0.1)
  roll.gravel.src.playbackRate.setTargetAtTime(0.55 + l * 0.9, t, 0.15)
  roll.growlGain.gain.setTargetAtTime(0.0001 + strain * 0.06, t, 0.08)
  const gust = Math.max(0, l - 0.55) / 0.45
  roll.wind.gain.gain.setTargetAtTime(0.0001 + gust * 0.09, t, 0.15)
  roll.wind.filter.frequency.setTargetAtTime(700 + gust * 1300, t, 0.2)
  roll.growl.frequency.setTargetAtTime(62 + strain * 30, t, 0.2)
  rollThuds(l, size)
}

function rollStop() {
  if (!roll) return
  const { rumble, gravel, wind, growl, growlGain } = roll
  roll = null
  const t = ctx.currentTime
  rumble.gain.gain.setTargetAtTime(0.0001, t, 0.3)
  gravel.gain.gain.setTargetAtTime(0.0001, t, 0.2)
  wind.gain.gain.setTargetAtTime(0.0001, t, 0.25)
  wind.src.stop(t + 1.5)
  growlGain.gain.setTargetAtTime(0.0001, t, 0.1)
  rumble.src.stop(t + 1.5)
  gravel.src.stop(t + 1.5)
  growl.stop(t + 1.5)
  music?.duck(false)
}

// --- Sat at a Food Court table: the kitchen sizzling behind you ---------------------------

let sizzle = null

/** Starts the kitchen's sizzle (a soft crackle, rising and falling) under the music. */
function tableStart() {
  if (!ctx || sizzle || ctx.state !== 'running') return
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer
  src.loop = true
  const filter = ctx.createBiquadFilter()
  filter.type = 'highpass'
  filter.frequency.value = 3200
  const gain = ctx.createGain()
  gain.gain.value = 0.0001
  // A slow wobble in its loudness, so it crackles like frying rather than hissing.
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 3.3
  const depth = ctx.createGain()
  depth.gain.value = 0.008
  lfo.connect(depth).connect(gain.gain)
  src.connect(filter).connect(gain).connect(master)
  src.start()
  lfo.start()
  gain.gain.setTargetAtTime(0.016, ctx.currentTime, 0.4)
  sizzle = { src, lfo, gain }
}

function tableStop() {
  if (!sizzle) return
  const { src, lfo, gain } = sizzle
  sizzle = null
  const t = ctx.currentTime
  gain.gain.setTargetAtTime(0.0001, t, 0.25)
  src.stop(t + 1.2)
  lfo.stop(t + 1.2)
}

function ready(name, minGapMs = 0) {
  if (!ctx || muted || ctx.state !== 'running') return false
  const now = performance.now()
  if (minGapMs && now - (lastPlayed.get(name) || 0) < minGapMs) return false
  lastPlayed.set(name, now)
  return true
}

/** A short enveloped oscillator note; `echo` also sends it into the echo. */
function tone(freq, { type = 'sine', at = 0, duration = 0.12, volume = 0.3, slideTo = null, attack = 0.01, echo: wet = false } = {}) {
  const t = ctx.currentTime + at
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + duration)
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(volume, t + attack)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration)
  osc.connect(gain).connect(master)
  if (wet) gain.connect(echo)
  osc.start(t)
  osc.stop(t + duration + 0.02)
}

/** A struck bell: the note, a quieter octave and a glassy strike, ringing into the echo. */
function bell(freq, { at = 0, volume = 0.1, decay = 0.4 } = {}) {
  tone(freq, { at, duration: decay, volume, echo: true })
  tone(freq * 2, { at, duration: decay * 0.6, volume: volume * 0.35, echo: true })
  tone(freq * 3.01, { type: 'triangle', at, duration: 0.05, volume: volume * 0.3 })
}

/** Trophy chimes climb and fall this scale while they keep coming (C major pentatonic). */
const TROPHY_SCALE = [1047, 1175, 1319, 1568, 1760, 2093, 2349, 2637]
/** A trophy within this long of the last carries the run on; otherwise it starts again. */
const TROPHY_RUN_MS = 700
let trophyRun = 0
let trophyAt = 0

/** Filtered noise: whooshes and cracks. */
function noise({ at = 0, duration = 0.3, volume = 0.25, from = 400, to = 2400, q = 1.2 } = {}) {
  const t = ctx.currentTime + at
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.Q.value = q
  filter.frequency.setValueAtTime(from, t)
  filter.frequency.exponentialRampToValueAtTime(to, t + duration)
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(volume, t + duration * 0.3)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration)
  src.connect(filter).connect(gain).connect(master)
  // Looped, so a long one from a random spot never runs off the end of the second.
  src.loop = true
  src.start(t, Math.random() * 0.5)
  src.stop(t + duration + 0.02)
}

export const sfx = {
  click() {
    if (ready('click', 40)) tone(660, { type: 'triangle', duration: 0.05, volume: 0.15 })
  },
  /** A Fat gain: a bright tick, softer for the ones that trickle in on their own. */
  gain(passive = false) {
    if (ready('gain', 110)) tone(880 + Math.random() * 120, { type: 'triangle', duration: 0.07, volume: passive ? 0.05 : 0.07, slideTo: 1400 })
  },
  /** A bite: a crunch, and a happy little "nom". */
  chomp() {
    if (!ready('chomp', 60)) return
    noise({ duration: 0.07, volume: 0.16, from: 2600 + Math.random() * 800, to: 1200, q: 1.4 })
    noise({ at: 0.06, duration: 0.05, volume: 0.1, from: 2000, to: 900, q: 1.4 })
    tone(330 + Math.random() * 60, { type: 'sine', at: 0.08, duration: 0.11, volume: 0.07, slideTo: 250 })
  },
  levelUp() {
    if (!ready('levelUp')) return
    ;[523, 659, 784, 1047].forEach((f, i) => tone(f, { type: 'square', at: i * 0.07, duration: 0.14, volume: 0.09 }))
  },
  /** Curling up into a ball and pushing off: a whoosh and a springy rising boing. */
  curl() {
    if (!ready('curl')) return
    noise({ duration: 0.4, volume: 0.13, from: 300, to: 2200, q: 0.8 })
    tone(200, { type: 'triangle', duration: 0.28, volume: 0.1, slideTo: 520 })
    tone(90, { at: 0.18, duration: 0.25, volume: 0.15, slideTo: 60 })
  },
  /** A tape stretched across your belly and snapping: a rising twang, then the crack. */
  tapeSnap() {
    if (!ready('tapeSnap', 120)) return
    tone(160, { type: 'sawtooth', duration: 0.12, volume: 0.06, slideTo: 520 })
    noise({ at: 0.1, duration: 0.14, volume: 0.32, from: 4200, to: 900, q: 0.9 })
    tone(900, { type: 'square', at: 0.1, duration: 0.06, volume: 0.05, slideTo: 300 })
  },
  /**
   * A tape stretching round your belly, `level` 0-1 how far: a rubbery creak, rising as
   * it strains. Positional and throttled: it's called every frame while you press in.
   */
  tapeStretch(level) {
    if (!ready('tapeStretch', 90)) return
    const l = Math.min(1, Math.max(0, level))
    tone(120 + l * 260, { type: 'sawtooth', duration: 0.1, volume: 0.025 + l * 0.04, slideTo: 140 + l * 320 })
  },
  /**
   * A footstep, `weight` 0-1 how fat you are: a soft pat skinny, a deep THUD as round as
   * can be (the ground shakes a little under a big belly).
   */
  step(weight = 0) {
    if (!ready('step', 110)) return
    const w = Math.min(1, Math.max(0, weight))
    tone(150 - 85 * w + Math.random() * 15, { duration: 0.09 + 0.08 * w, volume: 0.035 + 0.075 * w, slideTo: 55 })
    noise({ duration: 0.05 + 0.04 * w, volume: 0.02 + 0.03 * w, from: 700, to: 250, q: 0.8 })
  },
  /** Swallowing a big bite: a deep, wet GULP sliding down. */
  gulp() {
    if (!ready('gulp', 150)) return
    tone(260, { type: 'sine', duration: 0.16, volume: 0.13, slideTo: 90, attack: 0.02 })
    tone(140, { type: 'triangle', at: 0.05, duration: 0.12, volume: 0.06, slideTo: 60 })
    noise({ at: 0.02, duration: 0.08, volume: 0.04, from: 600, to: 200, q: 2 })
  },
  /** A pat on a full belly, `weight` 0-1 how fat: a soft, round thump - deeper the bigger. */
  pat(weight = 0) {
    if (!ready('pat', 120)) return
    const w = Math.min(1, Math.max(0, weight))
    tone(210 - 90 * w, { type: 'sine', duration: 0.09, volume: 0.07 + 0.05 * w, slideTo: 120 - 50 * w })
  },
  /** A big, rude, happy BURP - every so often after a lot of eating. */
  burp() {
    if (!ready('burp', 4000)) return
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(95, t)
    osc.frequency.linearRampToValueAtTime(120, t + 0.12)
    osc.frequency.linearRampToValueAtTime(70, t + 0.5)
    // A wobble in the pitch: the gurgle of it.
    const wobble = ctx.createOscillator()
    wobble.frequency.value = 23
    const wobbleDepth = ctx.createGain()
    wobbleDepth.gain.value = 9
    wobble.connect(wobbleDepth).connect(osc.frequency)
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(700, t)
    filter.frequency.linearRampToValueAtTime(380, t + 0.5)
    filter.Q.value = 6
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.16, t + 0.04)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.55)
    osc.connect(filter).connect(gain).connect(master)
    osc.start(t)
    wobble.start(t)
    osc.stop(t + 0.6)
    wobble.stop(t + 0.6)
    noise({ duration: 0.4, volume: 0.05, from: 500, to: 250, q: 3 })
  },
  /** A food bought: the cash register's KA-CHING. */
  cashRegister() {
    if (!ready('cashRegister', 200)) return
    noise({ duration: 0.06, volume: 0.18, from: 2500, to: 1200, q: 2 })
    tone(180, { type: 'square', at: 0.02, duration: 0.05, volume: 0.06, slideTo: 120 })
    bell(1568, { at: 0.09, volume: 0.1, decay: 0.5 })
    bell(2093, { at: 0.13, volume: 0.09, decay: 0.7 })
  },
  /** A food picked to eat: a happy "mmm!" and a pop. */
  equip() {
    if (!ready('equip', 200)) return
    tone(330, { type: 'sine', duration: 0.22, volume: 0.09, slideTo: 520, attack: 0.03 })
    tone(660, { type: 'triangle', at: 0.2, duration: 0.08, volume: 0.06, slideTo: 990 })
  },
  /** A panel opening: a soft swoosh up and a pop. */
  panelOpen() {
    if (!ready('panelOpen', 120)) return
    noise({ duration: 0.16, volume: 0.05, from: 600, to: 2600, q: 0.9 })
    tone(520, { type: 'sine', at: 0.08, duration: 0.07, volume: 0.05, slideTo: 780 })
  },
  /** A panel closing: the swoosh down. */
  panelClose() {
    if (!ready('panelClose', 120)) return
    noise({ duration: 0.14, volume: 0.04, from: 2200, to: 500, q: 0.9 })
  },
  /** Seeing stars, worn out at the end of a roll: little birds tweeting round your head. */
  dizzy() {
    if (!ready('dizzy', 1500)) return
    for (let i = 0; i < 4; i += 1) {
      const f = 2400 + Math.random() * 700
      tone(f, { type: 'sine', at: i * 0.17, duration: 0.07, volume: 0.035, slideTo: f * 1.3 })
      tone(f * 1.2, { type: 'sine', at: i * 0.17 + 0.07, duration: 0.06, volume: 0.03, slideTo: f })
    }
  },
  /** An egg wobbling on its stand before it hatches: a hollow rattle. */
  rattle() {
    if (!ready('rattle', 150)) return
    for (let i = 0; i < 3; i += 1) tone(420 + Math.random() * 80, { type: 'triangle', at: i * 0.05, duration: 0.04, volume: 0.05, slideTo: 300 })
  },
  /** Through a portal: a swirling whoosh, down and back up. */
  portal() {
    if (!ready('portal', 500)) return
    noise({ duration: 0.9, volume: 0.14, from: 300, to: 3000, q: 1.6 })
    tone(220, { type: 'sine', duration: 0.9, volume: 0.08, slideTo: 880 })
    tone(330, { type: 'sine', at: 0.15, duration: 0.75, volume: 0.05, slideTo: 1320 })
  },
  tableStart,
  tableStop,
  /** Grown past a size milestone (CHUBBY! ... ): two big boings and a happy chord. */
  chonk() {
    if (!ready('chonk', 400)) return
    tone(140, { type: 'sine', duration: 0.22, volume: 0.16, slideTo: 300 })
    tone(170, { type: 'sine', at: 0.2, duration: 0.26, volume: 0.16, slideTo: 380 })
    ;[523, 659, 784, 1047].forEach((f, i) => tone(f, { type: 'triangle', at: 0.42 + i * 0.05, duration: 0.3, volume: 0.07, echo: true }))
  },
  /** Thrown back by a tape too strong: a big rubbery BOING. */
  bounce() {
    if (!ready('bounce', 300)) return
    tone(520, { type: 'sine', duration: 0.45, volume: 0.16, slideTo: 110 })
    tone(260, { type: 'triangle', at: 0.02, duration: 0.4, volume: 0.08, slideTo: 70 })
    noise({ duration: 0.12, volume: 0.1, from: 1500, to: 400, q: 1 })
  },
  /** Thrown back by a tape too strong: a puff and a sad, deflating wah-wah. */
  tired() {
    if (!ready('tired')) return
    noise({ duration: 0.35, volume: 0.12, from: 900, to: 200, q: 0.6 })
    ;[392, 370, 349, 294].forEach((f, i) => tone(f, { type: 'triangle', at: 0.15 + i * 0.2, duration: i === 3 ? 0.5 : 0.18, volume: 0.07, slideTo: i === 3 ? 220 : null }))
  },
  /**
   * A coin bubble rolled through: a bell that climbs the scale and back down while they
   * keep coming, so a run of them plays a little tune.
   */
  trophy() {
    if (!ready('trophy', 90)) return
    const now = performance.now()
    trophyRun = now - trophyAt < TROPHY_RUN_MS ? trophyRun + 1 : 0
    trophyAt = now
    const n = TROPHY_SCALE.length
    const k = trophyRun % (2 * n - 2)
    bell(TROPHY_SCALE[k < n ? k : 2 * n - 2 - k], { volume: 0.085, decay: 0.32 })
  },
  /** Coins paid out (a tape smashed, a badge): a fanfare, a shimmering chord and a shower of coins. */
  coins() {
    if (!ready('coins')) return
    ;[784, 988, 1175, 1568].forEach((f, i) => tone(f, { type: 'triangle', at: i * 0.07, duration: 0.2, volume: 0.1, echo: true }))
    // G major, held, each voice doubled a hair apart so it shimmers.
    for (const f of [784, 988, 1175]) {
      tone(f * 1.003, { at: 0.28, duration: 0.9, volume: 0.045, attack: 0.05, echo: true })
      tone(f * 0.997, { at: 0.28, duration: 0.9, volume: 0.045, attack: 0.05 })
    }
    for (let i = 0; i < 6; i += 1) bell(2093 + Math.random() * 1200, { at: 0.3 + i * 0.07 + Math.random() * 0.03, volume: 0.035, decay: 0.2 })
  },
  crack() {
    if (!ready('crack', 150)) return
    noise({ duration: 0.12, volume: 0.35, from: 1800, to: 600, q: 0.8 })
    tone(220, { type: 'square', duration: 0.08, volume: 0.08, slideTo: 90 })
  },
  reveal() {
    if (!ready('reveal')) return
    ;[392, 523, 659, 784, 1047].forEach((f, i) => tone(f, { type: 'triangle', at: i * 0.06, duration: 0.22, volume: 0.12 }))
  },
  buy() {
    if (!ready('buy')) return
    tone(1047, { type: 'square', duration: 0.07, volume: 0.08 })
    tone(1568, { type: 'square', at: 0.08, duration: 0.16, volume: 0.08 })
  },
  error() {
    if (ready('error', 200)) tone(160, { type: 'sawtooth', duration: 0.18, volume: 0.07, slideTo: 110 })
  },
  rebirth() {
    if (!ready('rebirth')) return
    noise({ duration: 0.8, volume: 0.15, from: 200, to: 4000, q: 0.6 })
    ;[262, 330, 392, 523, 659, 784].forEach((f, i) => tone(f, { type: 'sawtooth', at: 0.1 + i * 0.07, duration: 0.25, volume: 0.06 }))
  },
  /** Sitting down at an unlocked Food Court: a soft rising chime. */
  zoneEnter() {
    if (!ready('zoneEnter', 400)) return
    ;[523, 784, 1047].forEach((f, i) => tone(f, { type: 'sine', at: i * 0.05, duration: 0.28, volume: 0.07 }))
  },
  /** A jump: a springy little boing. */
  jump() {
    if (ready('jump', 120)) tone(260, { type: 'triangle', duration: 0.18, volume: 0.1, slideTo: 620 })
  },
  /** Landing from a jump: a soft thump. */
  jumpLand() {
    if (!ready('jumpLand', 150)) return
    tone(140, { type: 'sine', duration: 0.12, volume: 0.12, slideTo: 70 })
    noise({ duration: 0.08, volume: 0.06, from: 900, to: 300, q: 0.7 })
  },
  rollStart,
  rollSet,
  rollStop,
}
