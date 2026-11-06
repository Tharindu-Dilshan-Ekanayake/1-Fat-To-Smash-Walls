import { hash2, mulberry32 } from '@shared/rng'
import { PLAZA, TRACK_START_Z } from '@shared/world'

import { STYLE } from '../materials'
import { RIM_X } from '../push/path'
import { PALETTE } from '../sceneStyle'

/**
 * The mountains ringing the plaza: tall, jagged grey voxel peaks, turning into
 * terracotta cliffs with grass on top either side of the tape track, plus blocky
 * pines on the terraces.
 *
 * Heights come from a smooth value-noise field quantised into terraces, sampled on a
 * coarse grid and greedy-merged into as few boxes as possible: a few hundred instances
 * for the whole ring rather than thousands of columns.
 */

const CELL = 4
const BOUNDS = { minX: -176, maxX: 156, minZ: -150, maxZ: 136 }
/** The track runs north out of the plaza through this gap (its own walls fill it). */
const CORRIDOR = { minX: -RIM_X, maxX: RIM_X, minZ: -10000, maxZ: TRACK_START_Z }
/** Terrain this close to the track is terracotta cliff; further out, grey rock. */
const CLIFF_REACH = 30
const STEP = 3

function smooth(t) {
  return t * t * (3 - 2 * t)
}

function valueNoise(x, z, scale, seed) {
  const fx = x / scale
  const fz = z / scale
  const ix = Math.floor(fx)
  const iz = Math.floor(fz)
  const tx = smooth(fx - ix)
  const tz = smooth(fz - iz)
  const a = hash2(ix, iz, seed)
  const b = hash2(ix + 1, iz, seed)
  const c = hash2(ix, iz + 1, seed)
  const d = hash2(ix + 1, iz + 1, seed)
  return a + (b - a) * tx + (c - a) * tz + (a - b - c + d) * tx * tz
}

function distanceOutside(rect, x, z) {
  const dx = Math.max(rect.minX - x, 0, x - rect.maxX)
  const dz = Math.max(rect.minZ - z, 0, z - rect.maxZ)
  return Math.hypot(dx, dz)
}

/** Terrain height at a cell centre, or 0 where the ground is open. */
export function terrainHeight(x, z) {
  if (distanceOutside(PLAZA, x, z) === 0) return 0
  if (distanceOutside(CORRIDOR, x, z) === 0) return 0
  const d = Math.min(distanceOutside(PLAZA, x, z), distanceOutside(CORRIDOR, x, z))
  // A low first terrace right at the plaza edge, then big jagged steps up.
  const base = d < 6 ? 6 : 9 + Math.floor(d / 11) * 7
  // Sharp peaks: a ridged noise added on top of the rolling one.
  const ridge = 1 - Math.abs(valueNoise(x, z, 22, 41) * 2 - 1)
  const n = valueNoise(x, z, 30, 11) * 8 + valueNoise(x, z, 9, 23) * 4 + ridge * ridge * 14 * Math.min(1, d / 20)
  const h = Math.round((base + n) / STEP) * STEP
  return Math.min(66, Math.max(6, h))
}

/** Whether the terrain at (x, z) is terracotta cliff rather than grey rock. */
const isCliff = (x, z) => distanceOutside(CORRIDOR, x, z) < CLIFF_REACH && z < PLAZA.minZ + 18

/** Half the widest canopy tier of a scale-1 tree. */
const TREE_HALF_WIDTH = 2.6

/**
 * Adds a tall blocky pine standing on `base`: a trunk and five stacked tiers narrowing to
 * a point, as in the reference.
 *
 * @param {import('../blocks').BlockSet} blocks
 * @param {() => number} rand
 * @param {{ leaves: string[], trunk: string }} [colors] defaults to the day palette's
 */
export function addTree(blocks, x, base, z, scale = 1, rand = Math.random, colors = PALETTE) {
  const s = scale
  const trunk = 2.6 * s
  blocks.addOn(x, base, z, 0.9 * s, trunk, 0.9 * s, colors.trunk)

  const greens = colors.leaves
  const green = greens[Math.floor(rand() * greens.length)]
  const tiers = [5.2, 4.3, 3.4, 2.5, 1.6]
  let y = base + trunk - 0.4 * s
  for (const width of tiers) {
    const w = width * s
    blocks.addOn(x, y, z, w, 1.6 * s, w, green)
    y += 1.35 * s
  }
  blocks.addOn(x, y, z, 0.8 * s, 1.1 * s, 0.8 * s, green)
}

/**
 * Builds the mountain ring into `blocks`, in `palette`'s rock, cliff and leaf colours
 * (see palette.js), and returns how many trees it planted.
 */
export function buildTerrain(blocks, { treeDensity = 1, palette = PALETTE } = {}) {
  const cliff = palette.cliff
  const cliffStyle = palette.cliffStyle ?? STYLE.TERRAIN
  const cols = Math.ceil((BOUNDS.maxX - BOUNDS.minX) / CELL)
  const rows = Math.ceil((BOUNDS.maxZ - BOUNDS.minZ) / CELL)
  const heights = new Int16Array(cols * rows)
  /** 0 = open, 1 = grey rock, 2 = terracotta cliff. */
  const kinds = new Uint8Array(cols * rows)

  for (let j = 0; j < rows; j += 1) {
    for (let i = 0; i < cols; i += 1) {
      const x = BOUNDS.minX + (i + 0.5) * CELL
      const z = BOUNDS.minZ + (j + 0.5) * CELL
      const h = terrainHeight(x, z)
      heights[j * cols + i] = h
      kinds[j * cols + i] = h === 0 ? 0 : isCliff(x, z) ? 2 : 1
    }
  }

  // Greedy merge: runs along X, then stack identical runs along Z.
  const open = new Map()
  const emit = (run) => {
    const width = (run.i1 - run.i0 + 1) * CELL
    const depth = (run.j1 - run.j0 + 1) * CELL
    const x = BOUNDS.minX + run.i0 * CELL + width / 2
    const z = BOUNDS.minZ + run.j0 * CELL + depth / 2
    // Sunk slightly so no seam shows where the mountains meet the ground plane.
    if (run.kind === 2) {
      blocks.addOn(x, -0.5, z, width, run.h + 0.5, depth, cliff, cliffStyle)
    } else {
      // Grey rock in a few shades, by height, so the terraces read.
      const shade = palette.rock[(run.h / STEP) % palette.rock.length]
      blocks.addOn(x, -0.5, z, width, run.h + 0.5, depth, shade, STYLE.STUDS)
    }
  }

  for (let j = 0; j < rows; j += 1) {
    const runs = []
    let i = 0
    while (i < cols) {
      const h = heights[j * cols + i]
      const kind = kinds[j * cols + i]
      if (h === 0) {
        i += 1
        continue
      }
      let i1 = i
      while (i1 + 1 < cols && heights[j * cols + i1 + 1] === h && kinds[j * cols + i1 + 1] === kind) i1 += 1
      runs.push({ i0: i, i1, h, kind })
      i = i1 + 1
    }

    const nextOpen = new Map()
    for (const run of runs) {
      const key = `${run.i0}:${run.i1}:${run.h}:${run.kind}`
      const prev = open.get(key)
      if (prev) {
        prev.j1 = j
        nextOpen.set(key, prev)
        open.delete(key)
      } else {
        nextOpen.set(key, { ...run, j0: j, j1: j })
      }
    }
    for (const run of open.values()) emit(run)
    open.clear()
    for (const [key, run] of nextOpen) open.set(key, run)
  }
  for (const run of open.values()) emit(run)

  // Pines on the terraces, kept off the edges so they don't overhang anything, and
  // clear of each other: overlapping canopies of near-equal height flicker. More on the
  // green-topped cliffs than on the bare grey rock.
  const rand = mulberry32(5)
  const placed = []
  let trees = 0
  for (let j = 1; j < rows - 1; j += 1) {
    for (let i = 1; i < cols - 1; i += 1) {
      const h = heights[j * cols + i]
      if (h === 0) continue
      const chance = (kinds[j * cols + i] === 2 ? 0.16 : 0.05) * treeDensity
      if (hash2(i, j, 77) > chance) continue
      const flat =
        heights[j * cols + i - 1] === h &&
        heights[j * cols + i + 1] === h &&
        heights[(j - 1) * cols + i] === h &&
        heights[(j + 1) * cols + i] === h
      if (!flat) continue
      const x = BOUNDS.minX + (i + 0.5) * CELL
      const z = BOUNDS.minZ + (j + 0.5) * CELL
      const scale = 0.9 + rand() * 0.6
      const reach = TREE_HALF_WIDTH * scale
      if (placed.some((t) => Math.max(Math.abs(t.x - x), Math.abs(t.z - z)) < t.reach + reach)) continue
      placed.push({ x, z, reach })
      addTree(blocks, x, h, z, scale, rand, palette)
      trees += 1
    }
  }

  // Pines along the top of the walls round the plaza - over the Food Courts on the west,
  // and round the other sides - rather than down in the plaza, where they'd hide things.
  const wallTrees = [
    [PLAZA.minX - 3, 26],
    [PLAZA.minX - 3, 10],
    [PLAZA.minX - 3, -6],
    [PLAZA.minX - 3, -22],
    [-24, PLAZA.maxZ + 3],
    [PLAZA.maxX + 3, 24],
    [PLAZA.maxX + 3, -16],
    [-30, PLAZA.minZ - 3],
  ]
  for (const [x, z] of wallTrees) {
    const h = terrainHeight(x, z)
    const reach = TREE_HALF_WIDTH * 1.15
    if (h === 0 || placed.some((t) => Math.max(Math.abs(t.x - x), Math.abs(t.z - z)) < t.reach + reach)) continue
    placed.push({ x, z, reach })
    addTree(blocks, x, h, z, 1.15, rand, palette)
  }

  return { trees }
}
