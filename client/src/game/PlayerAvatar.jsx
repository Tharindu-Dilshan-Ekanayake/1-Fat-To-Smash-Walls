import { useFrame } from '@react-three/fiber'
import { forwardRef, useEffect, useMemo, useRef, useState } from 'react'
import { Bone, Box3, BufferAttribute, BufferGeometry, DataTexture, MeshLambertMaterial, Skeleton, SkinnedMesh, Vector3 } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'

import { baseBodyUrl, isRealId } from '../bloxity/avatarAssets'
import { loadLook } from '../bloxity/avatarLoader'
import { useBloxity } from '../bloxity/BloxityContext'
import { getSDK } from '../bloxity/sdk'
import { shareLook } from '../net/connection'
import { attachAccessory, detachAccessory, restInverses, updateFollowers } from './avatarItems'
import {
  animateRig,
  applyEmote,
  applyPart,
  applyProportions,
  applySkin,
  collectRig,
  disposeMergedBody,
  mergeBody,
  placeHand,
  prepareFatParts,
  resetPose,
} from './avatarRig'

/**
 * Keeps the avatar breathing when it is rendered outside the game (a menu preview,
 * say) with no physics body feeding it motion.
 */
const _idleMotion = { time: 0, speed: 0, grounded: true, maxSpeed: 6 }
function fallbackMotion(delta) {
  _idleMotion.time += delta
  return _idleMotion
}

/**
 * A Bloxity avatar wearing `equipped` with `proportions`, assembled at runtime: yours,
 * or another player's from what the server tells us they wear.
 *
 * `player.glb` is the base humanoid rig: six skinned meshes (head, torso, two arms,
 * two legs) sharing one skeleton. Assembly means, per equipped slot:
 *   - body parts  -> swap the matching mesh's geometry
 *   - hat / back  -> attach an OBJ to the Neck1 / Spine2 bone
 *   - skin        -> set one texture as the map on every skinned mesh
 * then the six parts are merged into one skinned mesh, so a whole character is a
 * single draw call (plus one per hat or back item).
 *
 * Any slot that is unequipped or 404s leaves the base body's own part in place. The
 * whole thing re-assembles when `equipped` changes. Nothing shows until it's dressed:
 * never a bare base body.
 *
 * Far away (`motion.poseEvery` > 1), it's posed only every that many frames: a few
 * pixels tall, nobody sees the difference, and it saves the bone work.
 *
 * @param {{ equipped?: object, proportions?: object, onReady?: () => void,
 *   onStep?: (text: string) => void, targetHeight?: number, motionRef?: object,
 *   handRef?: object }} props
 *   `targetHeight` is the world-space height to fit the avatar into, in the game's
 *   own units: Bloxity authors the rig ~6.4 units tall with the feet at y=0, far bigger
 *   than the game's metric scale, so the model is measured and rescaled. `handRef` is
 *   an object beside the avatar that gets moved onto the right palm every frame, for
 *   anything held. `onStep` reports loading progress.
 */
export const BloxityAvatar = forwardRef(function BloxityAvatar(props, ref) {
  const baseScene = useBaseBody()
  // A custom character, if one is worn: undefined while it's looked up, null for none.
  const character = useCustomCharacter(props.equipped)
  if (!baseScene || character === undefined) return null
  if (character) return <CharacterAvatar ref={ref} baseScene={baseScene} character={character} {...props} />
  return <DressedAvatar ref={ref} baseScene={baseScene} {...props} />
})

/**
 * player.glb, the base body every avatar is built from: fetched and parsed as soon as
 * the game starts, and handed straight to whoever's waiting - not through Suspense,
 * whose retry React leaves until the scene's start-up work is done (seconds later on a
 * slow phone). three's own GLTFLoader (the one the cosmetics use too), not drei's
 * useGLTF, which would bundle a second loader plus Draco/Meshopt/KTX2 decoders this GLB
 * never needs.
 */
let baseBody = null
let baseBodyError = null
// Its own texture is never used (every avatar gets its skin), so it isn't even decoded:
// that kept the parse waiting for the start-up work to finish.
const baseLoader = new GLTFLoader().register(() => ({ name: 'pp_skip_textures', loadTexture: () => Promise.resolve(null) }))
const BASE_URL = baseBodyUrl()
const baseBodyLoad = fetch(BASE_URL, { priority: 'high' })
  .then((res) => res.arrayBuffer())
  .then((data) => baseLoader.parseAsync(data, BASE_URL.replace(/[^/]*$/, '')))
  .then((gltf) => (baseBody = gltf.scene))
  .catch((err) => {
    baseBodyError = err
    throw err
  })

/** The base body's scene once it's in (null until then); a failed load throws, for the ErrorBoundary. */
function useBaseBody() {
  const [scene, setScene] = useState(baseBody)
  const [error, setError] = useState(baseBodyError)
  useEffect(() => {
    if (scene) return undefined
    let live = true
    baseBodyLoad.then(
      (loaded) => live && setScene(loaded),
      (err) => live && setError(err),
    )
    return () => {
      live = false
    }
  }, [scene])
  if (error) throw error
  return scene
}

const DressedAvatar = forwardRef(function DressedAvatar(
  { baseScene, equipped, proportions, onReady, onStep, targetHeight = 1.8, motionRef, handRef, ...props },
  ref,
) {
  const [assembled, setAssembled] = useState(false)
  /** The merged body currently shown; replaced on every re-assembly. */
  const bodyRef = useRef(null)

  // The GLTF cache hands back one shared scene. Clone via SkeletonUtils so this
  // instance gets an independent, still-working skeleton.
  const character = useMemo(() => cloneSkeleton(baseScene), [baseScene])

  // Rig lookup tables (bones, part meshes, pristine geometries) built once per clone.
  const rig = useMemo(() => {
    const collected = collectRig(character)

    // The base body ships with an empty texture; give every skinned mesh its own
    // material instance so a skin swap here can't leak into another avatar.
    for (const mesh of collected.skinnedMeshes) {
      // Lambert: these settings made Standard look matte anyway, and Lambert is far
      // cheaper to compile and to shade.
      mesh.material = new MeshLambertMaterial({ color: 0xffffff })
    }

    if (!collected.skeleton) {
      console.warn('[bloxity] player.glb has no skeleton - avatar will not deform')
    }
    return collected
  }, [character])

  // The rounded body's parts, built bit by bit while the rest of the avatar loads.
  useEffect(() => prepareFatParts(rig), [rig])

  // Measured once, from the bind pose, before proportions touch the root scale.
  const fit = useMemo(() => {
    const box = new Box3().setFromObject(character)
    const size = box.getSize(new Vector3())
    if (!Number.isFinite(size.y) || size.y <= 0) return { scale: 1, footOffset: 0 }
    const scale = targetHeight / size.y
    // The rig's feet sit at its bbox minimum; drop the group so they land on y=0
    // of the parent (which Player positions at the bottom of the capsule).
    return { scale, footOffset: -box.min.y * scale }
  }, [character, targetHeight])

  // --- Assemble equipped cosmetics --------------------------------------------
  useEffect(() => {
    let cancelled = false
    const holder = bodyRef
    // Accessories are re-attached on every rebuild; track them so the previous
    // hat/back can be removed rather than stacking up.
    const attached = []

    onStep?.('Loading avatar…')

    loadLook(equipped)
      .then((results) => {
        if (cancelled) return

        for (const result of results) {
          // One bad slot must not take the rest of the character down.
          try {
            if (result.kind === 'skin') {
              applySkin(rig, result.texture)
            } else if (result.kind === 'part') {
              applyPart(rig, result.slot, result.scene)
            } else if (result.kind === 'accessory' && result.object) {
              if (result.texture) {
                result.object.traverse((child) => {
                  if (child.isMesh) {
                    child.material = new MeshLambertMaterial({ map: result.texture })
                  }
                })
              }
              attached.push(...attachAccessory(rig, result.accessory, result.object))
            }
          } catch (err) {
            console.warn(`[bloxity] failed to apply ${result.kind}`, err)
          }
        }

        // One draw call for the body: merge the assembled parts.
        try {
          disposeMergedBody(holder.current)
          holder.current = mergeBody(rig)
        } catch (err) {
          console.warn('[bloxity] could not merge the body; drawing its parts', err)
          for (const mesh of rig.skinnedMeshes) mesh.visible = true
        }
        setAssembled(true)
      })
      .catch((err) => {
        console.warn('[bloxity] avatar assembly failed; showing base body', err)
        if (!cancelled) setAssembled(true)
      })

    return () => {
      cancelled = true
      for (const object of attached) {
        detachAccessory(rig, object)
        object.traverse((child) => {
          child.geometry?.dispose()
          if (child.isMesh) child.material?.dispose()
        })
      }
    }
  }, [rig, equipped, onStep])

  // Frees what this avatar made when it goes (other players come and go). Loaded
  // part scenes and textures are shared through the loader cache, so they stay.
  useEffect(() => {
    const holder = bodyRef
    return () => {
      disposeMergedBody(holder.current)
      holder.current = null
      for (const mesh of rig.skinnedMeshes) mesh.material.dispose()
      for (const geometry of Object.values(rig.originalGeometries)) geometry.dispose()
    }
  }, [rig])

  // --- Proportions and pose -----------------------------------------------------
  // Applied per frame rather than in an effect: every bone is reset to its rest pose
  // and re-scaled each pass, which keeps it idempotent and survives anything else
  // that touches the skeleton.
  const proportionsRef = useRef(proportions)
  useEffect(() => {
    proportionsRef.current = proportions
  }, [proportions])
  const frame = useRef(0)

  useFrame((_state, delta) => {
    if (!assembled) return
    const every = motionRef?.current?.poseEvery ?? 1
    frame.current += 1
    if (every > 1 && frame.current % every !== 0) return
    try {
      // Order matters: proportions reset every bone to its rest pose, and the
      // animation then rotates on top of that clean base.
      const motion = motionRef?.current ?? fallbackMotion(delta)
      applyProportions(rig, proportionsRef.current, motion.bulk)
      animateRig(rig, motion, 1 / fit.scale)
      applyEmote(rig, motion.emoteClip, motion.emoteTime, motion.emoteWeight)
      if (handRef?.current) placeHand(rig, handRef.current)
      updateFollowers(rig)
    } catch {
      // A malformed payload must not kill the render loop.
    }
  })

  // Signal readiness only once the model is actually standing there.
  useEffect(() => {
    if (assembled) onReady?.()
  }, [assembled, onReady])

  return (
    <group ref={ref} {...props}>
      {/* Fit scale lives on this wrapper, not on `character` - applyProportions
          overwrites the character's own scale every frame. */}
      <group scale={fit.scale} position={[0, fit.footOffset, 0]} visible={assembled}>
        <primitive object={character} />
      </group>
    </group>
  )
})

/**
 * An invisible stand-in with just what a dressed body asks of its shader - a skinned,
 * morphing, textured Lambert mesh - in the scene from the start, so the start-up shader
 * warm-up (which compiles hidden things too) builds that program with the rest. Your
 * avatar, dressed only once the SDK has said in what (after the warm-up), then draws
 * without a compile of its own. Kept for good: its material keeps the program alive.
 */
export function AvatarShaderWarmup() {
  const mesh = useMemo(() => {
    const geometry = new BufferGeometry()
    const vec = (size) => new BufferAttribute(new Float32Array(3 * size), size)
    for (const [name, size] of [['position', 3], ['normal', 3], ['uv', 2], ['skinIndex', 4], ['skinWeight', 4]]) geometry.setAttribute(name, vec(size))
    geometry.morphAttributes.position = [vec(3)]
    geometry.morphAttributes.normal = [vec(3)]
    geometry.morphTargetsRelative = true
    const map = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1)
    const body = new SkinnedMesh(geometry, new MeshLambertMaterial({ map }))
    const bone = new Bone()
    body.add(bone)
    body.bind(new Skeleton([bone]))
    body.visible = false
    body.frustumCulled = false
    return body
  }, [])
  useEffect(
    () => () => {
      mesh.geometry.dispose()
      mesh.material.map.dispose()
      mesh.material.dispose()
      mesh.skeleton.dispose()
    },
    [mesh],
  )
  return <primitive object={mesh} />
}

// --- Custom characters ------------------------------------------------------------------

/** A character's GLB, loaded once per URL (its texture is in it) and cloned per player. */
const characterScenes = new Map()
const characterLoader = new GLTFLoader()
function loadCharacterScene(url) {
  if (!characterScenes.has(url)) {
    characterScenes.set(
      url,
      characterLoader.loadAsync(url).then(
        (gltf) => gltf.scene,
        () => null,
      ),
    )
  }
  return characterScenes.get(url)
}

/** How long a character may take to look up and load before the regular avatar shows. */
const CHARACTER_WAIT_MS = 8000

/**
 * The custom character `equipped` wears (its `characterId`), as `{ info, scene }`: null
 * when none is worn, it's been taken down, the feature is off or its GLB won't load (the
 * regular avatar then shows - never nobody); undefined while that's being found out.
 */
function useCustomCharacter(equipped) {
  const id = isRealId(equipped?.characterId) ? String(equipped.characterId) : null
  const [found, setFound] = useState({ id: null, value: null })
  useEffect(() => {
    if (!id) return undefined
    let live = true
    const settle = (value) => live && setFound({ id, value })
    const timer = setTimeout(() => settle(null), CHARACTER_WAIT_MS)
    Promise.resolve(getSDK()?.avatar?.getCharacterFor?.(equipped))
      .then(async (info) => {
        const scene = info?.glbUrl ? await loadCharacterScene(info.glbUrl) : null
        clearTimeout(timer)
        settle(scene ? { info, scene } : null)
      })
      .catch(() => {
        clearTimeout(timer)
        settle(null)
      })
    return () => {
      live = false
      clearTimeout(timer)
    }
    // Re-resolved only when a different character is worn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])
  if (!id) return null
  return found.id === id ? found.value : undefined
}

/** player.glb's rest transforms, which hand and shoe items keep on a character too. */
const baseRest = new WeakMap()
const baseRestOf = (scene) => {
  if (!baseRest.has(scene)) baseRest.set(scene, restInverses(cloneSkeleton(scene)))
  return baseRest.get(scene)
}

/**
 * A player wearing their own uploaded character: its GLB instead of player.glb - the
 * same 22 bones, so every pose and emote plays on it - at player.glb's scale, with no
 * skin, clothes, body parts, proportions or build. Their items are fitted to it with
 * Boxity's characterAccessoryMatrix (head and torso) and its rig's anchors (hands and
 * shoes).
 */
const CharacterAvatar = forwardRef(function CharacterAvatar(
  { baseScene, character, equipped, onReady, targetHeight = 1.8, motionRef, handRef, ...props },
  ref,
) {
  const model = useMemo(() => cloneSkeleton(character.scene), [character])
  const rig = useMemo(() => collectRig(model), [model])
  const [ready, setReady] = useState(false)

  // player.glb's size sets the scale, so a short or tall character stays so.
  const fit = useMemo(() => {
    const size = new Box3().setFromObject(baseScene).getSize(new Vector3())
    const scale = size.y > 0 ? targetHeight / size.y : 1
    return { scale, footOffset: -new Box3().setFromObject(model).min.y * scale }
  }, [baseScene, model, targetHeight])

  useEffect(() => {
    let cancelled = false
    const attached = []
    const sdk = getSDK()
    const placement = {
      character: character.info,
      matrixFor: (bone) => sdk?.avatar?.characterAccessoryMatrix?.(character.info, bone) ?? null,
      playerRestInverse: baseRestOf(baseScene),
    }
    loadLook(equipped)
      .then((results) => {
        if (cancelled) return
        for (const result of results) {
          if (result.kind !== 'accessory' || !result.object) continue
          try {
            if (result.texture) {
              result.object.traverse((child) => {
                if (child.isMesh) child.material = new MeshLambertMaterial({ map: result.texture })
              })
            }
            attached.push(...attachAccessory(rig, result.accessory, result.object, placement))
          } catch (err) {
            console.warn('[bloxity] could not fit an item to a character', err)
          }
        }
      })
      .catch(() => {})
      .finally(() => !cancelled && setReady(true))
    return () => {
      cancelled = true
      for (const object of attached) {
        detachAccessory(rig, object)
        object.traverse((child) => {
          child.geometry?.dispose()
          if (child.isMesh) child.material?.dispose()
        })
      }
    }
  }, [rig, equipped, character, baseScene])

  useFrame((_state, delta) => {
    if (!ready) return
    try {
      const motion = motionRef?.current ?? fallbackMotion(delta)
      resetPose(rig)
      animateRig(rig, motion, 1 / fit.scale)
      applyEmote(rig, motion.emoteClip, motion.emoteTime, motion.emoteWeight)
      if (handRef?.current) placeHand(rig, handRef.current)
      updateFollowers(rig)
    } catch {
      // A malformed character must not kill the render loop.
    }
  })

  useEffect(() => {
    if (ready) onReady?.()
  }, [ready, onReady])

  return (
    <group ref={ref} {...props}>
      <group scale={fit.scale} position={[0, fit.footOffset, 0]} visible={ready}>
        <primitive object={model} />
      </group>
    </group>
  )
})

/**
 * Your own avatar: whatever your Bloxity account (or guest) is wearing. Also tells the
 * other players, so they see you dressed the same.
 */
export const PlayerAvatar = forwardRef(function PlayerAvatar(props, ref) {
  const { avatar, proportions, game, status } = useBloxity()
  useEffect(() => shareLook(avatar, proportions), [avatar, proportions])
  // The same outfit again (the SDK hands over a fresh object on every sign-in check)
  // isn't a change: only a different one re-dresses you.
  const lookKey = JSON.stringify(avatar ?? null)
  const look = useMemo(() => JSON.parse(lookKey), [lookKey])
  // Dressed once, in what you're really wearing: not until the SDK has said what that
  // is (or failed to), rather than in nothing first.
  if (status === 'idle' || status === 'loading') return null
  return <BloxityAvatar ref={ref} {...props} equipped={look} proportions={proportions} onStep={game.loadingStep} />
})


export default PlayerAvatar
