import { STYLE } from '../materials'
import { PALETTE } from '../sceneStyle'

/**
 * The lobby's colours, per world. World 1 is the bright toy-brick day (sceneStyle's
 * PALETTE); World 2 is the same town by night - a neon diner out in space: deep indigo
 * studs, violet paving with glowing edges, teal lawns with glowing flowers, purple moon
 * rock, and pink and cyan lamps. The builders take one of these, so the whole lobby is
 * rebuilt in the other set when you go through the portal (behind the fade to black).
 */

const DAY = {
  night: false,
  plaza: PALETTE.plaza,
  curb: PALETTE.curb,
  curbEdge: PALETTE.curbEdge,
  lawn: PALETTE.lawn,
  lawnEdge: '#4ec434',
  dirt: PALETTE.dirt,
  path: PALETTE.apron,
  pathEdge: PALETTE.apronEdge,
  /** The walkway from spawn to the ROLL ZONE: a red-carpet runway, a gold line and a light edge down each side, white chevrons up it. */
  runway: '#ee6a58',
  runwayLine: '#ffd36a',
  runwayEdge: '#fff4e6',
  chevron: '#ffffff',
  chevronStyle: STYLE.SMOOTH,
  /** The food market yard's border: a ring of alternating tiles. */
  marketBorder: ['#e8322f', '#fff6ec'],
  /** The Food Courts' street: warm paving, and its light edge. */
  street: '#f1d9bd',
  streetEdge: '#fff1e0',
  /** The food market's sandy yard: its stall rings a shade deeper, the tent's floor deeper still. */
  market: '#f4e2c4',
  marketRing: '#e9cda2',
  marketCore: '#ddb487',
  /** The town square's rings: a gold band, darker paving round the plinth. */
  gold: '#f3d595',
  squareCore: '#c4d3e2',
  /** The egg plaza: its band under the egg stands, and the edge round it. */
  eggBand: '#f3e4c4',
  eggBandEdge: '#fff6e4',
  rock: PALETTE.rock,
  cliff: PALETTE.cliff,
  cliffStyle: STYLE.TERRAIN,
  trunk: PALETTE.trunk,
  leaves: PALETTE.leaves,
  water: PALETTE.water,
  waterfall: '#59c8ff',
  splash: '#a8e4ff',
  /** Lamp lanterns, in turn. */
  lamps: ['#fff3b0', '#fff3b0'],
  lampPost: '#3a4150',
  flowers: ['#ff5a7a', '#ffe14a', '#ff9a3c', '#c27bff', '#ffffff', '#4fc3ff'],
  flowerStyle: STYLE.SMOOTH,
  /** Neon strips along the paths' edges: none by day. */
  neon: null,
  bed: '#d9e2ec',
}

const NIGHT = {
  night: true,
  plaza: '#2c2a5e',
  curb: '#4a4794',
  curbEdge: '#1d1b46',
  lawn: '#1d7a76',
  lawnEdge: '#145a5c',
  dirt: '#4a2f86',
  path: '#4b4690',
  pathEdge: '#8f86ea',
  runway: '#6b2a9c',
  runwayLine: '#ff5fd0',
  runwayEdge: '#2a2758',
  chevron: '#58f0ff',
  chevronStyle: STYLE.GLOW,
  marketBorder: ['#ff5fd0', '#2c2a66'],
  street: '#4a3470',
  streetEdge: '#ff6fd8',
  market: '#3d3a80',
  marketRing: '#4c4898',
  marketCore: '#2c2a66',
  gold: '#ffcf4a',
  squareCore: '#36346e',
  eggBand: '#433a7c',
  eggBandEdge: '#a99cff',
  rock: ['#4b4668', '#403b5c', '#57517a'],
  cliff: '#5b3b86',
  cliffStyle: STYLE.BLOCK,
  trunk: '#3b2a52',
  leaves: ['#1fb59c', '#27c9ad', '#17907c'],
  water: '#7a63ff',
  waterfall: '#8a7aff',
  splash: '#c4b8ff',
  lamps: ['#ff7ad9', '#7ff6ff'],
  lampPost: '#262044',
  flowers: ['#ff5ad8', '#7ff6ff', '#ffe14a', '#b47bff', '#ffffff', '#5aff9c'],
  flowerStyle: STYLE.GLOW,
  /** Neon strips along the paths' edges, in turn. */
  neon: ['#ff5fd0', '#58f0ff'],
  bed: '#5a55a8',
}

/** The lobby palette for world `world` (0 = World 1, 1 = World 2). */
export const lobbyPalette = (world) => (world === 1 ? NIGHT : DAY)
