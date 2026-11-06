import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'

import { formatGain } from '@shared/format'

import { sfx } from '../../audio/sfx'
import { iconUrl } from '../../ui/icons'
import { push } from '../push/pushControl'
import { runtime } from '../runtime'
import { burst, drainTrainFx } from './fxQueue'
import { spawnPopup, spawnScattered, updatePopups } from './popups'

const _at = new Vector3()
/** Bites since the last burp; past BURP_AFTER, each bite has BURP_CHANCE of one. */
let bitesSinceBurp = 0
const BURP_AFTER = 18
const BURP_CHANCE = 0.1
const FAT_ICON = iconUrl('fat')
const LEVEL_GRADIENT = 'linear-gradient(180deg, #e0faff 0%, #7fe2ff 45%, #2fa8ff 100%)'
/** A bite's "+1" (a click): big, bouncing, landing somewhere on screen. */
const BITE_GAIN = { iconUrl: FAT_ICON, scale: 1.6 }
const ROLL_GAIN = { iconUrl: FAT_ICON }
const NEAR_GAIN = { iconUrl: FAT_ICON }

/**
 * How big you've got: a shout over your head (and a burst of confetti, and a fanfare)
 * the moment your Fat passes each of these.
 */
const MILESTONES = [
  { fat: 50, text: 'CHUBBY!', gradient: 'linear-gradient(180deg, #fff6c4 0%, #ffd36a 50%, #ff9a3c 100%)' },
  { fat: 500, text: 'ROUND!', gradient: 'linear-gradient(180deg, #ffe0f2 0%, #ff8fd0 50%, #ff4fa3 100%)' },
  { fat: 5000, text: 'BIG BELLY!', gradient: 'linear-gradient(180deg, #e0fff0 0%, #6cf0a8 50%, #1fbf6a 100%)' },
  { fat: 50000, text: 'HUGE!', gradient: 'linear-gradient(180deg, #e0f4ff 0%, #7fd0ff 50%, #2f8fff 100%)' },
  { fat: 500000, text: 'MEGA CHONK!', gradient: 'linear-gradient(180deg, #f2e6ff 0%, #c48bff 50%, #8a3cff 100%)' },
  { fat: 5000000, text: 'PLANET SIZED!', gradient: 'linear-gradient(180deg, #fffbe0 0%, #ffe14a 40%, #ff6a1e 100%)' },
]

/** Where your mouth is: over your feet, a little in front, by how big you're drawn. */
function mouth(out) {
  const p = runtime.player.position
  const yaw = runtime.player.yaw
  const size = runtime.player.drawnSize ?? 1
  return out.set(p.x + Math.sin(yaw) * 0.32 * size, p.y + 1.55 * size, p.z + Math.cos(yaw) * 0.32 * size)
}

/**
 * One gain's popup (the session's 'train' event: `source` 'bite' for a click, 'zone' for
 * a bite taken sat at a Food Court table): bites over the screen, table bites by you.
 */
function showGain(event) {
  const rolling = push.active
  const at = rolling ? push.position : runtime.player.position
  const follow = rolling ? push.position : null
  if (event.source === 'bite') {
    spawnScattered(`+${formatGain(event.gain)}`, BITE_GAIN)
  } else if (rolling) {
    spawnScattered(`+${formatGain(event.gain)}`, ROLL_GAIN)
  } else {
    _at.set(at.x + (Math.random() - 0.5) * 3, at.y + 0.8 + Math.random() * 1.2, at.z + (Math.random() - 0.5) * 1.5)
    spawnPopup(`+${formatGain(event.gain)}`, _at, NEAR_GAIN)
  }
  sfx.gain(event.source !== 'bite')
  bitesSinceBurp += 1
  if (!rolling && bitesSinceBurp > BURP_AFTER && Math.random() < BURP_CHANCE) {
    bitesSinceBurp = 0
    setTimeout(sfx.burp, 250)
    runtime.player.jiggleAt = performance.now() + 250
  }
  if (!rolling) {
    // A table bite: crumbs off it (particle presets only) and a wobble of the belly. A
    // click's bite throws its crumbs on each chomp (the Player).
    if (event.source === 'zone') {
      mouth(_at)
      burst({ x: _at.x, y: _at.y, z: _at.z, count: 7, speed: 2.6, palette: 'crumbs' })
      runtime.player.jiggleAt = performance.now()
    }
  }
  // Grown past a milestone with this bite: say so.
  const before = (event.fat ?? 0) - event.gain
  const passed = MILESTONES.findLast((m) => before < m.fat && event.fat >= m.fat)
  if (passed && !rolling) {
    _at.set(at.x, at.y + 3.4, at.z)
    spawnPopup(passed.text, _at, { gradient: passed.gradient, scale: 2.1, life: 2000, follow })
    burst({ x: at.x, y: at.y + 2.2, z: at.z, count: 50, speed: 8, palette: 'confetti' })
    sfx.chonk()
    runtime.player.puffAt = performance.now()
  }
  if (event.leveledUp) {
    if (!rolling) runtime.player.happyAt = performance.now()
    _at.set(at.x, at.y + 2.8, at.z)
    spawnPopup(event.maxed ? 'MAX LEVEL!' : 'LEVEL UP!', _at, { gradient: LEVEL_GRADIENT, scale: 1.5, life: 1600, follow })
  }
}

/**
 * Fat-gain feedback: a "+1" (with the Fat icon) for every bite - each click, and each
 * bite taken sat at a Food Court table - with crumbs flying off it, a shout when you
 * grow past a milestone (CHUBBY! ... PLANET SIZED!), and LEVEL UP! when one lands.
 * Also moves every live popup each frame.
 */
export function GainFX() {
  const size = useThree((s) => s.size)

  useFrame((state) => {
    drainTrainFx(showGain)
    updatePopups(state.camera, size.width, size.height)
  })

  return null
}

export default GainFX
