import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useState } from 'react'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import { useGame } from '../../store/game'
import { useQuality } from '../../store/quality'
import { asToyInstance, BlockSet, disposeBlocks, PropBuilder } from '../blocks'
import { glowTime } from '../glow'
import { createToyMaterial, sharedMaterials, toyTime } from '../materials'
import { useAfterPlayable } from '../useAfterPlayable'
import { buildNeonTrims, buildRunway, createGroundGeometry, createGroundMap } from './ground'
import { buildEggStands } from './eggs'
import { buildFoodCourts } from './foodCourts'
import { buildGarden } from './garden'
import { buildLawnCurbs } from './lawns'
import { lobbyPalette } from './palette'
import { buildPortalFrame } from './portalFrame'
import { buildPushZone } from './pushZone'
import { createPaintedSigns } from './signs'
import { buildFoodHut, buildStands, buildStatue, buildTownSquare } from './structures'
import { buildTerrain } from './terrain'
import { buildWaterfall } from './waterfall'

/** Merges `extra` into the props mesh's geometry (one mesh, one draw call), freeing both old ones. */
function addToProps(mesh, extra) {
  const before = mesh.geometry
  mesh.geometry = mergeGeometries([before, extra], false)
  mesh.geometry.computeBoundingSphere()
  mesh.computeBoundingSphere()
  before.dispose()
  extra.dispose()
}

/**
 * The static lobby, "Snack Town": ground plane, every box (mountains, trees, the Food
 * Courts' restaurants, the food shop's hut, the champion's square, stands, the statue,
 * lawns' kerbs, the runway's chevrons) in one InstancedMesh, and every non-box prop
 * (round plinths and flower beds, the egg stands' wings, the statue's body, the giant
 * foods on the roofs and the hut's counter...) merged into one mesh. Three draw calls
 * for the whole environment.
 *
 * The decoration - the giant foods on the roofs and the hut, the champion's body, the
 * painted signs - is left until the game's playable (useAfterPlayable) and merged into
 * the props mesh then: it was most of the lobby's build time, and nobody needs it to
 * start playing.
 *
 * Built once per world: World 1 is the bright day town, World 2 the same town by night
 * as a neon diner in space (palette.js). Stepping through the portal changes the world
 * behind a fade to black, and the lobby is rebuilt in the other palette then (the old
 * one disposed). Quality only decides tree density and detail at build time, and
 * whether the result casts/receives realtime shadows.
 */
export function World() {
  const shadows = useQuality((s) => s.settings.shadows === 'realtime')
  const world = useGame((s) => s.profile.world)
  const settled = useAfterPlayable()
  const [signs, setSigns] = useState([])

  // Drives every animated toy-material style (water...).
  useFrame((state) => {
    toyTime.value = state.clock.elapsedTime
    glowTime.value = state.clock.elapsedTime
  })

  useEffect(() => {
    if (!settled) return undefined
    let made = []
    let cancelled = false
    const dispose = (list) => {
      for (const sign of list) {
        sign.geometry.dispose()
        sign.material.dispose()
        sign.texture.dispose()
      }
    }
    createPaintedSigns(useQuality.getState().settings.maxTexture).then((list) => {
      if (cancelled) {
        dispose(list)
        return
      }
      made = list
      setSigns(list)
    })
    return () => {
      cancelled = true
      dispose(made)
    }
  }, [settled])

  const { blocks, ground, props, decorTasks } = useMemo(() => {
    performance.mark('pp:world-start')
    const { decorDensity, maxTexture } = useQuality.getState().settings
    const palette = lobbyPalette(world)
    const set = new BlockSet()
    buildTerrain(set, { treeDensity: decorDensity, palette })
    buildLawnCurbs(set, palette)
    buildRunway(set, palette)
    buildNeonTrims(set, palette)
    // LOW leaves out the small stuff: jars, knobs, cups' straws, bulbs, a few flowers.
    const detail = decorDensity >= 0.75
    const propBuilder = new PropBuilder()
    // Decoration queued for later (see the effect below): `later(builder => ...)`.
    const decorTasks = []
    const decor = { later: (task) => decorTasks.push(task) }
    buildFoodCourts(set, propBuilder, { detail, palette, decor })
    buildFoodHut(set, propBuilder, { detail, palette, decor })
    buildTownSquare(set, propBuilder, { detail, palette, decor })
    buildGarden(set, propBuilder, { detail, palette })
    buildPushZone(set, { world })
    buildStands(set)
    buildStatue(set, propBuilder, { palette, decor })
    buildPortalFrame(set)
    buildWaterfall(set, palette)
    buildEggStands(set, propBuilder)

    const map = createGroundMap(maxTexture, palette)
    const groundMaterial = createToyMaterial({ instanced: false, vertexColors: false, map, studScale: 2 })

    performance.mark('pp:world-end')
    return {
      blocks: set.build(sharedMaterials().blocks),
      props: asToyInstance(propBuilder.build(), sharedMaterials().toy),
      ground: { geometry: createGroundGeometry(), material: groundMaterial, map },
      decorTasks,
    }
  }, [world])

  // Once the game's playable, the decoration is built and merged into the props mesh -
  // still one draw call.
  useEffect(() => {
    if (!settled || decorTasks.length === 0) return
    const builder = new PropBuilder()
    for (const task of decorTasks.splice(0)) task(builder)
    const extra = builder.build()
    if (extra) addToProps(props, extra)
  }, [settled, decorTasks, props])

  // Frees the last world's lobby when it's rebuilt (and this one on unmount).
  useEffect(
    () => () => {
      disposeBlocks(blocks)
      props.geometry.dispose()
      props.dispose()
      ground.geometry.dispose()
      ground.material.dispose()
      ground.map.dispose()
    },
    [blocks, ground, props],
  )

  return (
    <>
      <mesh geometry={ground.geometry} material={ground.material} receiveShadow={shadows} />
      <primitive object={blocks} castShadow={shadows} receiveShadow={shadows} />
      <primitive object={props} castShadow={shadows} receiveShadow={shadows} />
      {signs.map((sign) => (
        <mesh key={sign.texture.uuid} geometry={sign.geometry} material={sign.material} position={sign.position} rotation={sign.rotation} renderOrder={1} />
      ))}
    </>
  )
}

export default World
