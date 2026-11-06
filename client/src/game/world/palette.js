import { STYLE } from '../materials'
import { PALETTE } from '../sceneStyle'

/**
 * The lobby's colours, per world. World 1 is SMASH CITY at golden hour: warm concrete
 * paving, asphalt streets with white kerb lines, a dark asphalt SMASH LANE with yellow
 * lines up to the arena, brick and glass towers all round (skyline.js). World 2 is the
 * same city by night out in space: deep indigo paving with glowing edges, teal lawns
 * with glowing flowers, towers lit up in neon, pink and cyan lamps. The builders take
 * one of these, so the whole lobby is rebuilt in the other set when you go through the
 * portal (behind the fade to black).
 */

const DAY = {
  night: false,
  /** Warm concrete paving slabs. */
  plaza: '#dcd3c6',
  curb: '#bfb6a9',
  curbEdge: '#45a83a',
  lawn: '#5ccf3d',
  lawnEdge: '#3fa82c',
  dirt: '#b97b49',
  /** The demolition yards either side of the lane: packed gravel. */
  site: '#c9a06c',
  /** Streets: asphalt, a white kerb line down each side. */
  path: '#5a5f6c',
  pathEdge: '#f1eee6',
  /** The SMASH LANE from spawn to the SMASH ZONE: dark asphalt, a yellow line and a dark kerb down each side. */
  runway: '#3a3e49',
  runwayLine: '#ffcc1a',
  runwayEdge: '#22252c',
  /** Its arrows: marquee bulbs racing up it (STYLE.CHASE). */
  chevron: '#ffd23f',
  chevronStyle: STYLE.CHASE,
  /** The food market yard's border: a ring of alternating tiles. */
  marketBorder: ['#e8322f', '#fff6ec'],
  /** The Food Courts' street: terracotta brick paving, and its light edge. */
  street: '#c98f6a',
  streetEdge: '#f2e4d2',
  /** The food market's yard: its stall rings a shade deeper, the tent's floor deeper still. */
  market: '#e9c99e',
  marketRing: '#ddb27e',
  marketCore: '#c9925a',
  /** The town square's rings: a gold band, darker paving round the plinth. */
  gold: '#ffcc1a',
  squareCore: '#8d93a0',
  /** The egg plaza: its band under the egg stands, and the edge round it. */
  eggBand: '#cfc5b6',
  eggBandEdge: '#f3ede3',
  rock: PALETTE.rock,
  cliff: PALETTE.cliff,
  cliffStyle: STYLE.TERRAIN,
  trunk: PALETTE.trunk,
  leaves: PALETTE.leaves,
  water: PALETTE.water,
  waterfall: '#59c8ff',
  splash: '#a8e4ff',
  /** Lamp lanterns, in turn. */
  lamps: ['#ffd98a', '#ffd98a'],
  lampPost: '#2c303a',
  flowers: ['#ff5a7a', '#ffe14a', '#ff9a3c', '#c27bff', '#ffffff', '#4fc3ff'],
  flowerStyle: STYLE.SMOOTH,
  /** Neon strips along the paths' edges: none by day. */
  neon: null,
  bed: '#c9c1b5',
  /** The skyline (skyline.js): facades, roofs and trims, and the neon on signs and billboards. */
  facades: ['#c8644a', '#d9a066', '#b5543c', '#e3d6c0', '#8f9ab0', '#6f7c9c', '#c78a5a', '#a6b0c4'],
  roof: '#4a4f5c',
  trim: '#f2ece2',
  neonSigns: ['#ff3b6b', '#2fd2ff', '#ffcc1a', '#7dff5a', '#ff7ad9'],
  /** Cranes: yellow steel, and their dark bands. */
  crane: '#ffbf1f',
  craneDark: '#2c303a',
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
  site: '#3a3470',
  facades: ['#2c2a5e', '#3a3470', '#25234f', '#46407e', '#1f1d44', '#332f6a'],
  roof: '#17153a',
  trim: '#ff5fd0',
  neonSigns: ['#ff5fd0', '#58f0ff', '#ffe14a', '#7dff9a', '#b47bff'],
  crane: '#58f0ff',
  craneDark: '#1d1b46',
}

/** The lobby palette for world `world` (0 = World 1, 1 = World 2). */
export const lobbyPalette = (world) => (world === 1 ? NIGHT : DAY)
