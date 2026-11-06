import { create } from 'zustand'

/**
 * Graphics quality presets. Every visual feature reads its settings from here rather
 * than deciding for itself, so dropping a preset reliably sheds load everywhere.
 *
 * LOW is the mobile / weak-PC baseline: no realtime shadows, no particles, no
 * post-processing, short view distance and textures capped at 512px.
 */
export const QUALITY_LEVELS = ['LOW', 'MEDIUM', 'HIGH']

export const PRESETS = {
  LOW: {
    dpr: 1,
    antialias: false,
    /** 'blob' = fake contact shadows only; 'realtime' = shadow-mapped sun. */
    shadows: 'blob',
    shadowMapSize: 0,
    particles: false,
    speedLines: false,
    /** Motion blur down the sides at speed (post-processing): samples a pixel, 0 = off. */
    motionBlur: 0,
    viewDistance: 190,
    fogNear: 60,
    cloudCount: 8,
    /** Max side of any generated texture. */
    maxTexture: 512,
    /** Other players' shadows and pets show this far away. */
    remoteDrawDistance: 150,
    /** Other players' avatars are drawn (and posed) this far away; past it, hidden - the
     * biggest saving in a full room on a weak phone. */
    remoteAvatarDistance: 45,
    remoteNameDistance: 40,
    /** World labels fade out past this. */
    labelDistance: 70,
    /** How much of the canyon's scenery to spawn (0-1). */
    decorDensity: 0.45,
    /** Food, egg and aura halo size multiplier. */
    glow: 0.8,
  },
  MEDIUM: {
    dpr: 1.25,
    antialias: true,
    shadows: 'blob',
    shadowMapSize: 0,
    particles: true,
    speedLines: true,
    motionBlur: 8,
    viewDistance: 300,
    fogNear: 100,
    cloudCount: 14,
    maxTexture: 1024,
    remoteDrawDistance: 150,
    remoteAvatarDistance: 90,
    remoteNameDistance: 55,
    labelDistance: 110,
    decorDensity: 0.75,
    glow: 1,
  },
  HIGH: {
    dpr: 1.5,
    antialias: true,
    shadows: 'realtime',
    shadowMapSize: 1024,
    particles: true,
    speedLines: true,
    motionBlur: 12,
    viewDistance: 460,
    fogNear: 140,
    cloudCount: 18,
    maxTexture: 1024,
    remoteDrawDistance: 150,
    remoteAvatarDistance: 160,
    remoteNameDistance: 70,
    labelDistance: 150,
    decorDensity: 1,
    glow: 1,
  },
}

const STORAGE_KEY = 'pp.quality'

function isMobileDevice() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  if (/Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i.test(ua)) return true
  // iPadOS reports itself as a Mac; touch points give it away.
  return navigator.maxTouchPoints > 1 && /Macintosh/.test(ua)
}

/**
 * Everyone starts on LOW, whatever the hardware: the game opens fast and smooth
 * everywhere, and anyone who wants more picks MEDIUM or HIGH in Settings (which is
 * remembered). The monitor only ever drops a level, never raises one.
 */
export const DEFAULT_QUALITY = 'LOW'

function readSaved() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return QUALITY_LEVELS.includes(saved) ? saved : null
  } catch {
    return null
  }
}

const initialLevel = readSaved() || DEFAULT_QUALITY

export const useQuality = create((set, get) => ({
  level: initialLevel,
  /** True when the player picked the level by hand; auto-drop then stays out of it. */
  manual: readSaved() !== null,
  isMobile: isMobileDevice(),
  /** Set once at startup: antialiasing can't change without recreating the context. */
  antialias: PRESETS[initialLevel].antialias,
  settings: PRESETS[initialLevel],

  setLevel: (level, manual = true) => {
    if (!QUALITY_LEVELS.includes(level)) return
    if (manual) {
      try {
        localStorage.setItem(STORAGE_KEY, level)
      } catch {
        // Private mode: the choice just won't persist.
      }
    }
    set({ level, manual, settings: PRESETS[level] })
  },

  /** Called by the performance monitor when FPS stays under budget. */
  degrade: () => {
    const { level, manual } = get()
    if (manual) return
    const index = QUALITY_LEVELS.indexOf(level)
    if (index <= 0) return
    const next = QUALITY_LEVELS[index - 1]
    console.info(`[quality] FPS under budget, dropping ${level} -> ${next}`)
    set({ level: next, settings: PRESETS[next] })
  },
}))

/** Non-reactive read, safe inside useFrame. */
export const getQuality = () => useQuality.getState().settings
