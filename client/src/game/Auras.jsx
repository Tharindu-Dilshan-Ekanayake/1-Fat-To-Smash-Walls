import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Color, Matrix4, Quaternion, Vector3 } from 'three'

import { AURAS } from '@shared/balance'

import { remotePlayers } from '../net/remotePlayers'
import { getGame } from '../store/game'
import { getQuality } from '../store/quality'
import { createGlowInstances, disposeGlow } from './glow'
import { push } from './push/pushControl'
import { runtime } from './runtime'

/** You and up to eight others; a soft body glow and four sparks circling each. */
const MAX_WEARERS = 9
const SPARKS = 4
const PER_WEARER = 1 + SPARKS

const COLORS = Object.fromEntries(Object.entries(AURAS).map(([id, a]) => [id, new Color(a.color)]))
const WHITE = new Color('#ffffff')

const _m = new Matrix4()
const _q = new Quaternion()
const _p = new Vector3()
const _s = new Vector3()

/**
 * Draws aura `aura` round someone standing at `at` into `mesh` from instance `i`: the
 * body glow and the sparks. Returns the next free instance.
 */
function wear(mesh, i, aura, at, phase, t, particles, glow) {
  const color = COLORS[aura]
  if (!color || i + PER_WEARER > MAX_WEARERS * PER_WEARER) return i
  _p.copy(at).y += 1.05
  mesh.setMatrixAt(i, _m.compose(_p, _q, _s.setScalar(4 * glow * (1 + Math.sin(t * 3 + phase) * 0.08))))
  mesh.setColorAt(i, color)
  let next = i + 1
  for (let k = 0; k < SPARKS; k += 1) {
    const a = t * 2.4 + phase + (k / SPARKS) * Math.PI * 2
    _p.set(at.x + Math.cos(a) * 1.1, at.y + 0.5 + ((t * 0.9 + k / SPARKS) % 1) * 1.6, at.z + Math.sin(a) * 1.1)
    mesh.setMatrixAt(next, _m.compose(_p, _q, _s.setScalar(particles ? 1.1 * glow : 0)))
    mesh.setColorAt(next, color)
    next += 1
  }
  return next
}

/**
 * Auras: a soft glow round the body of everyone wearing one, in its colour, with four
 * sparks spiralling up round them. Halos only (camera-facing quads, additive), all of them one
 * draw call. Sparks only on presets with particles.
 */
export function Auras() {
  const ref = useRef(null)
  const glows = useMemo(() => {
    const mesh = createGlowInstances(MAX_WEARERS * PER_WEARER, 0.85)
    for (let i = 0; i < MAX_WEARERS * PER_WEARER; i += 1) mesh.setColorAt(i, WHITE)
    return mesh
  }, [])

  useEffect(() => () => disposeGlow(glows), [glows])

  useFrame((state) => {
    const mesh = ref.current
    if (!mesh) return
    const t = state.clock.elapsedTime
    const { particles, glow } = getQuality()
    let i = 0
    const mine = getGame().profile.equippedAura
    if (mine) i = wear(mesh, i, mine, push.active ? push.position : runtime.player.position, 0, t, particles, glow)
    let n = 1
    for (const r of remotePlayers.values()) {
      if (r.aura && (r.pushing || r.anim !== 'push')) i = wear(mesh, i, r.aura, r.shownAt, n * 1.7, t, particles, glow)
      n += 1
    }
    mesh.count = i
    if (i > 0) {
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }
  })

  return <primitive ref={ref} object={glows} />
}

export default Auras
