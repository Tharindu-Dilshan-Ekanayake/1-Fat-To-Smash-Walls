import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { BufferAttribute, BufferGeometry, Color, Points, PointsMaterial, Vector3 } from 'three'

import { formatNumber } from '@shared/format'
import { mulberry32 } from '@shared/rng'

import { getQuality, useQuality } from '../../store/quality'
import { disposeBlocks } from '../blocks'
import { LabelBatch } from '../labels/LabelBatch'
import { sharedMaterials } from '../materials'
import { FOG, SKY } from '../sceneStyle'
import { skyUniforms } from '../skyState'
import { STAGES, stageAt, stageStart, TAPES, TRACK_LENGTH, WORLD } from './course'
import { surfaceY, zAt } from './path'
import PushFX from './PushFX'
import { push } from './pushControl'
import { STAGE_THEMES, WORLD_SKIES } from './themes'
import { buildChunk, CHUNK, chunkCount, SUMMIT_LENGTH } from './track'
import Tapes from './Tapes'

/** Chunks kept behind the focus point, and how many may be built per builder pass. */
const BEHIND = 50
const MAX_BUILDS_PER_PASS = 2
/** How often the chunk builder runs (between frames, not inside them). */
const BUILD_INTERVAL_MS = 40
/** Chunks never thrown away: the stretch visible from the lobby. */
const PINNED_CHUNKS = 3
const CACHE_LIMIT = 12

const _p = new Vector3()
const _skyTop = new Color()
const _skyHorizon = new Color()

const DEFAULT_TOP = new Color(SKY.top)
const DEFAULT_HORIZON = new Color(SKY.horizon)
const DEFAULT_FOG = new Color(FOG.color)

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** Built chunks by index. Module-level: one track exists at a time. */
const chunkCache = new Map()
/** The chunk window the frame loop wants; the builder makes it so. */
const trackWindow = { first: 0, last: 0, density: 1, shadows: false }
/** Shows a built chunk only while it's in the window (a named function: no closure per frame). */
const showIfWanted = (mesh, i) => {
  mesh.visible = i >= trackWindow.first && i <= trackWindow.last
}

/**
 * Lazily loaded: the tape track down the valley of the world you're in, its tapes and
 * signs, and the sky changing stage by stage while you roll (and the lobby's, world by
 * world). While nobody is rolling it still streams the first stretch, which is the track
 * you see dropping away from the lobby. Mounted afresh for each world (see GameScene).
 */
export default function Push() {
  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)
  const gl = useThree((s) => s.gl)
  const rootRef = useRef(null)
  const groupRef = useRef(null)
  const labelsRef = useRef(null)
  const starsRef = useRef(null)
  const wasActive = useRef(false)
  /** Whether the lobby's sky has been put up since mounting. */
  const lobbySky = useRef(false)
  const particles = useQuality((s) => s.settings.particles)

  // This world's skies: each stage's, and the lobby's (World 1's is the scene's own).
  const skies = useMemo(() => {
    const lobby = WORLD_SKIES[WORLD]
    return {
      stages: STAGES.map((s) => STAGE_THEMES[s.id].sky.map((c) => new Color(c))),
      space: STAGES.map((s) => Boolean(STAGE_THEMES[s.id].stars)),
      top: lobby ? new Color(lobby.sky[0]) : DEFAULT_TOP,
      horizon: lobby ? new Color(lobby.sky[1]) : DEFAULT_HORIZON,
      fog: lobby ? new Color(lobby.sky[1]) : DEFAULT_FOG,
      stars: Boolean(lobby?.stars),
    }
  }, [])
  const skiesRef = useRef(skies)

  const assets = useMemo(() => {
    const rand = mulberry32(99)
    const starPositions = new Float32Array(500 * 3)
    for (let i = 0; i < 500; i += 1) {
      _p.set(rand() * 2 - 1, rand() * 1.2 - 0.1, rand() * 2 - 1).normalize().multiplyScalar(140)
      starPositions.set([_p.x, _p.y, _p.z], i * 3)
    }
    const starGeometry = new BufferGeometry()
    starGeometry.setAttribute('position', new BufferAttribute(starPositions, 3))
    const stars = new Points(starGeometry, new PointsMaterial({ color: '#ffffff', size: 2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }))
    stars.frustumCulled = false
    stars.visible = false
    return { stars }
  }, [])

  // This module loads after the lobby is on screen; compile its shaders in the
  // background before showing it, so the first roll doesn't stall on them.
  useEffect(() => {
    const root = rootRef.current
    // Skipped in dev, where StrictMode's remount disposes materials mid-compile (see
    // ShaderWarmup).
    if (!root || import.meta.env.DEV) return undefined
    let cancelled = false
    root.visible = false
    gl.compileAsync(root, camera, scene)
      .catch(() => null)
      .finally(() => {
        if (!cancelled) root.visible = true
      })
    return () => {
      cancelled = true
    }
  }, [gl, camera, scene])

  // Over every tape, what it takes and what it pays: its number, the Fat you need to get
  // there (from the start: every slope before it burns its share), and its Coins. And
  // the finish. Their own small label batch.
  useEffect(() => {
    const batch = new LabelBatch({ pageSize: Math.min(512, getQuality().maxTexture) })
    const gold = ['#fffaa8', '#ffd52a', '#ff9c00']
    for (const tape of TAPES) {
      const stage = STAGES[tape.stage]
      const last = tape.stage === STAGES.length - 1
      // The Fat it takes, big, with a drumstick - and what it pays.
      const lines = [
        { text: formatNumber(tape.need), size: 76, icon: 'fat', gradient: last ? gold : STAGE_THEMES[stage.id].name },
        { text: `+${formatNumber(tape.coins)}`, size: 40, icon: 'coin', fill: '#ffffff' },
      ]
      // Just short of the tape, floating over the wall: in view as you roll down at it.
      const z = zAt(tape.meter - 0.6)
      batch.add(`tape-${tape.stage}`, [0, surfaceY(z, 0) + 4.6, z], { lines, pxPerUnit: 60 }, { fade: 220 })
    }
    const top = zAt(TRACK_LENGTH + SUMMIT_LENGTH * 0.62)
    batch.add(
      'the-top',
      [0, surfaceY(top, 0) + 15, top],
      { lines: [{ text: 'THE END!', size: 80, gradient: gold }, { text: 'The BIGGEST belly of them all!', size: 40, rainbow: true }], pxPerUnit: 22 },
      { fade: 260 },
    )
    let cancelled = false
    batch.build().then((meshes) => {
      if (cancelled || !labelsRef.current) return
      for (const mesh of meshes) labelsRef.current.add(mesh)
    })
    return () => {
      cancelled = true
      batch.dispose()
    }
  }, [])

  // Streams track chunks in and out between frames: at most two builds per pass.
  useEffect(() => {
    const group = groupRef.current
    const id = setInterval(() => {
      if (!group) return
      const want = trackWindow
      let built = 0
      for (let i = want.first; i <= want.last && built < MAX_BUILDS_PER_PASS; i += 1) {
        if (chunkCache.has(i)) continue
        const mesh = buildChunk(i, { density: want.density }).build(sharedMaterials().blocks)
        mesh.receiveShadow = want.shadows
        chunkCache.set(i, mesh)
        group.add(mesh)
        built += 1
      }
      if (chunkCache.size <= CACHE_LIMIT) return
      for (const [i, mesh] of chunkCache) {
        const wanted = i >= want.first && i <= want.last
        if (!wanted && i >= PINNED_CHUNKS) {
          group.remove(mesh)
          disposeBlocks(mesh)
          chunkCache.delete(i)
        }
      }
    }, BUILD_INTERVAL_MS)
    return () => {
      clearInterval(id)
      for (const mesh of chunkCache.values()) disposeBlocks(mesh)
      chunkCache.clear()
      assets.stars.geometry.dispose()
      assets.stars.material.dispose()
      skyUniforms.topColor.value.copy(DEFAULT_TOP)
      skyUniforms.horizonColor.value.copy(DEFAULT_HORIZON)
      if (scene.fog) scene.fog.color.copy(DEFAULT_FOG)
    }
  }, [assets, scene])

  useFrame(() => {
    const settings = getQuality()
    const focus = push.active ? Math.max(0, push.meter) : 0

    // --- Track chunks -------------------------------------------------------------
    // Only decide what should exist; the builder above does the allocating, outside
    // the frame loop.
    const want = trackWindow
    want.first = Math.max(0, Math.floor((focus - BEHIND) / CHUNK))
    want.last = Math.min(chunkCount() - 1, Math.floor((focus + settings.viewDistance) / CHUNK))
    want.density = settings.decorDensity
    want.shadows = settings.shadows === 'realtime'
    chunkCache.forEach(showIfWanted)

    // --- Sky tint by stage --------------------------------------------------------
    const sky = skiesRef.current
    const stars = starsRef.current
    if (push.active) {
      const meter = Math.max(0, push.meter)
      const si = stageAt(meter)
      const blend = smoothstep(stageStart(si), stageStart(si) + 40, meter)
      const prev = sky.stages[Math.max(0, si - 1)]
      const cur = sky.stages[si]
      _skyTop.copy(prev[0]).lerp(cur[0], si === 0 ? 1 : blend)
      _skyHorizon.copy(prev[1]).lerp(cur[1], si === 0 ? 1 : blend)
      skyUniforms.topColor.value.copy(_skyTop)
      skyUniforms.horizonColor.value.copy(_skyHorizon)
      if (scene.fog) scene.fog.color.copy(_skyHorizon)

      if (stars && particles) {
        const space = sky.space[si] ? (si > 0 && sky.space[si - 1] ? 1 : blend) : 0
        stars.visible = space > 0.01
        stars.material.opacity = space
        stars.position.copy(camera.position)
      }
    } else if (wasActive.current || !lobbySky.current) {
      // In the lobby: this world's sky (and stars, for a world out in space).
      lobbySky.current = true
      skyUniforms.topColor.value.copy(sky.top)
      skyUniforms.horizonColor.value.copy(sky.horizon)
      if (scene.fog) scene.fog.color.copy(sky.fog)
      if (stars) {
        stars.visible = sky.stars && particles
        stars.material.opacity = 1
        stars.position.copy(camera.position)
      }
    }
    if (!push.active && stars?.visible) stars.position.copy(camera.position)
    wasActive.current = push.active
  })

  return (
    <group ref={rootRef}>
      <group ref={groupRef} />
      <group ref={labelsRef} />
      <primitive ref={starsRef} object={assets.stars} />
      <PushFX />
      <Tapes />
    </group>
  )
}
