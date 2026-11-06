import { Matrix4, Quaternion, Vector3 } from 'three'

/**
 * Where each Boxity item is worn - the placements Boxity's own renderer uses, so an
 * item sits in the game as it does on the player's profile.
 *
 * - Hats, hair and masks on Neck1, 0.8 above it; back items on Spine2. Under the bone,
 *   so they follow it and the body's proportions.
 * - Neck, chest and waist items on Spine2 / Spine2 / Spine1, at a model-space origin:
 *   local = restInverse(bone) * translate(origin), restInverse being the bone's rest
 *   transform in model space, inverted - captured right after player.glb loads.
 *   (Not skeleton.boneInverses: the leaf bones' are 90 degrees off their rest pose.)
 * - Hand and shoe items worn as a pair, on ArmL2_leaf / LegL2_leaf and mirrored on the
 *   R bones. These follow the bone's position and rotation only, never its scale (the
 *   arm-length proportion would stretch them): they hang off the model root, and every
 *   frame (updateFollowers) are placed at compose(bone position, bone rotation, 1) * local.
 *
 * A custom character (see CharacterAvatar) wears them fitted to its own body, with
 * Boxity's characterAccessoryMatrix for head and torso items and its rig's anchors for
 * hands and shoes.
 */

const ON_BONE = {
  hat: { bone: 'Neck1', offset: [0, 0.8, 0], model: [0, 5.6, 0] },
  hair: { bone: 'Neck1', offset: [0, 0.8, 0], model: [0, 5.6, 0] },
  mask: { bone: 'Neck1', offset: [0, 0.8, 0], model: [0, 5.6, 0] },
  back: { bone: 'Spine2', offset: [0, 0, 0], model: [0, 4.2, 0] },
}
const AT_ORIGIN = {
  neck: { bone: 'Spine2', origin: [0, 4.8, 0] },
  chest: { bone: 'Spine2', origin: [0, 3.6, 0] },
  waist: { bone: 'Spine1', origin: [0, 2.4, 0] },
}
const PAIRS = {
  hand: { left: 'ArmL2_leaf', right: 'ArmR2_leaf', origin: [0, 0, 0] },
  shoes: { left: 'LegL2_leaf', right: 'LegR2_leaf', origin: [0, 0, 0] },
}

const _m = new Matrix4()
const _t = new Matrix4()
const _inv = new Matrix4()
const _p = new Vector3()
const _q = new Quaternion()
const _s = new Vector3()
const ONE = new Vector3(1, 1, 1)
const MIRROR = new Matrix4().makeScale(-1, 1, 1)

/**
 * Every bone's rest transform in model space, inverted: inverse(inverse(model) * bone).
 * Call on a freshly loaded (unposed) model.
 */
export function restInverses(root) {
  root.updateMatrixWorld(true)
  const modelInv = new Matrix4().copy(root.matrixWorld).invert()
  const out = {}
  root.traverse((node) => {
    if (node.isBone) out[node.name] = new Matrix4().multiplyMatrices(modelInv, node.matrixWorld).invert()
  })
  return out
}

const translate = (xyz) => new Matrix4().makeTranslation(xyz[0], xyz[1], xyz[2])

/** Sets `object`'s transform to `matrix` and puts it under `parent`. */
function place(object, matrix, parent) {
  matrix.decompose(object.position, object.quaternion, object.scale)
  parent.add(object)
  return object
}

function castShadows(object) {
  object.traverse((child) => {
    if (child.isMesh) child.castShadow = true
  })
}

/** A uniform or per-axis scale matrix from a character's anchor (a number or [x, y, z]). */
function anchorScale(anchor) {
  if (Array.isArray(anchor)) return new Matrix4().makeScale(anchor[0] ?? 1, anchor[1] ?? 1, anchor[2] ?? 1)
  return new Matrix4().makeScale(anchor ?? 1, anchor ?? 1, anchor ?? 1)
}

/**
 * Wears item `object` of `kind` ('hat', 'hair', 'mask', 'back', 'neck', 'chest', 'waist',
 * 'hand' or 'shoes') on `rig` (avatarRig.collectRig, with `restInverse`). A custom
 * character also passes `fit`: `{ character, matrixFor(bone) -> 16 numbers | null,
 * playerRestInverse }` (see CharacterAvatar). Returns the objects added, for taking off.
 */
export function attachAccessory(rig, kind, object, fit = null) {
  if (!object || !rig?.skeleton) return []
  castShadows(object)
  const bones = rig.boneByName
  const anchors = fit?.character?.rig?.anchors ?? {}

  if (ON_BONE[kind] || AT_ORIGIN[kind]) {
    const spec = ON_BONE[kind] ?? AT_ORIGIN[kind]
    const bone = bones[spec.bone]
    if (!bone) return []
    let local
    if (fit) {
      // Fitted to the character's own head or torso; model-space placement as on player.glb.
      const modelPlacement = translate(spec.model ?? spec.origin)
      const fitted = fit.matrixFor(spec.bone)
      local = fitted ? new Matrix4().fromArray(fitted).multiply(modelPlacement) : null
      if (!local) {
        const standard = ON_BONE[kind] ? translate(spec.offset) : (fit.playerRestInverse[spec.bone] ?? new Matrix4()).clone().multiply(translate(spec.origin))
        local = anchorScale(anchors[spec.bone]).multiply(standard)
      }
    } else {
      local = ON_BONE[kind] ? translate(spec.offset) : (rig.restInverse[spec.bone] ?? new Matrix4()).clone().multiply(translate(spec.origin))
    }
    return [place(object, local, bone)]
  }

  const pair = PAIRS[kind]
  if (!pair) return []
  const out = []
  for (const [side, item] of [
    [pair.left, object],
    [pair.right, object.clone(true)],
  ]) {
    const bone = bones[side]
    if (!bone) continue
    const restInverse = (fit ? fit.playerRestInverse : rig.restInverse)[side] ?? new Matrix4()
    const local = (fit ? anchorScale(anchors[side]) : new Matrix4()).multiply(restInverse)
    if (side === pair.right) local.multiply(MIRROR)
    local.multiply(translate(pair.origin))
    item.matrixAutoUpdate = false
    rig.root.add(item)
    rig.followers.push({ object: item, bone, local })
    out.push(item)
  }
  return out
}

/** Takes a worn item off again (and out of the followers). */
export function detachAccessory(rig, object) {
  object.parent?.remove(object)
  const i = rig.followers.findIndex((f) => f.object === object)
  if (i >= 0) rig.followers.splice(i, 1)
}

/**
 * Puts the hand and shoe items where their bones are now - position and rotation, not
 * scale. Run every frame after the rig is posed.
 */
export function updateFollowers(rig) {
  if (!rig.followers.length) return
  const root = rig.root
  root.updateWorldMatrix(true, true)
  _inv.copy(root.matrixWorld).invert()
  for (const { object, bone, local } of rig.followers) {
    _m.multiplyMatrices(_inv, bone.matrixWorld).decompose(_p, _q, _s)
    object.matrix.multiplyMatrices(_t.compose(_p, _q, ONE), local)
    object.matrixWorldNeedsUpdate = true
  }
}
