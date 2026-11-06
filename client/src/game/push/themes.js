import { STYLE } from '../materials'

/**
 * Per-stage look, as in the reference: a tiled floor (`floor`, or `floorStyle`) between
 * stepped cliffs of big square studs (`wall`, or `wallStyle`; BLOCK_GRASS gives them
 * grass caps of their own, otherwise they get a cap slab in `cap`), the line where the
 * stage's slope starts (`gate`), the sky up there (`stars` out in space) and the HUD's
 * stage-name colours. World 1's stages first, then Future World's.
 */
export const STAGE_THEMES = {
  // Bright green tiles between salmon cliffs with grass along every step.
  grass: {
    floor: '#5fe03c',
    wall: '#c98a6e',
    wallStyle: STYLE.BLOCK_GRASS,
    gate: '#ffd21f',
    sky: ['#2f8ff2', '#a6d6fb'],
    name: ['#e6ffb0', '#8dff4f', '#2fd12f'],
  },
  // A peach floor between tall tan cliffs.
  sand: {
    floor: '#f8c999',
    wall: '#c99a6b',
    cap: '#e7b886',
    gate: '#ff9c3c',
    sky: ['#2f8ff2', '#a6d6fb'],
    name: ['#fff3d6', '#ffcf8a', '#e8913a'],
  },
  ice: {
    floor: '#e3f5ff',
    wall: '#8cc3ec',
    cap: '#ffffff',
    gate: '#5cc8ff',
    sky: ['#57aef0', '#e4f4ff'],
    name: ['#ffffff', '#c9f1ff', '#5cc8ff'],
  },
  volcano: {
    floor: '#4a3f42',
    wall: '#352e31',
    cap: '#ff5a1c',
    capStyle: STYLE.LAVA,
    gate: '#ff4a1c',
    sky: ['#5a2a3a', '#d27a52'],
    name: ['#ffd0b0', '#ff7a3c', '#e2240c'],
  },
  candy: {
    floor: '#ffc6e4',
    wall: '#ff9fd2',
    cap: '#fff2fa',
    gate: '#ff5fb8',
    sky: ['#7a8cff', '#ffd6f0'],
    name: ['#ffe6f6', '#ff9cd6', '#ff3fa8'],
  },
  crystal: {
    floor: '#6a4fc0',
    wall: '#4a3394',
    cap: '#a98bff',
    capStyle: STYLE.GLOW,
    gate: '#c08bff',
    sky: ['#2a1e6a', '#8a7ae0'],
    name: ['#f2e6ff', '#c69bff', '#8a3ee8'],
  },
  moon: {
    floor: '#a3a8b2',
    wall: '#6c727d',
    cap: '#cdd1d8',
    gate: '#8a63ff',
    sky: ['#05051a', '#241544'],
    stars: true,
    name: ['#e6e0ff', '#a98bff', '#6a4cff'],
  },
  // Mossy stone ruins under a green canopy.
  jungle: {
    floor: '#4caa3c',
    wall: '#77705a',
    wallStyle: STYLE.BLOCK_GRASS,
    gate: '#7dff4f',
    sky: ['#2d8a5a', '#b8ecc0'],
    name: ['#e6ffd0', '#7ddc5a', '#2f8a2f'],
  },
  // Golden sand between sandstone cliffs, the sea running over their tops.
  beach: {
    floor: '#ffe7b3',
    wall: '#efbd85',
    cap: '#3fd0ff',
    capStyle: STYLE.WATER,
    gate: '#3fd0ff',
    sky: ['#2fa8ff', '#c4f2ff'],
    name: ['#fffbe0', '#7fe0ff', '#2fa8ff'],
  },
  // Bright moss between purple rock, red toadstool caps along the cliff tops.
  mushroom: {
    floor: '#7ed957',
    wall: '#7a5a9a',
    cap: '#ff4f5e',
    capStyle: STYLE.SMOOTH,
    gate: '#ff4f5e',
    sky: ['#4a5ad8', '#f6c8ff'],
    name: ['#fff0f2', '#ff8a96', '#e8243c'],
  },
  // Murky ground between dark mossy stone, glowing green slime running over the tops.
  swamp: {
    floor: '#5a6a34',
    wall: '#34402a',
    cap: '#8aff3a',
    capStyle: STYLE.WATER,
    gate: '#9dff3a',
    sky: ['#1f3a24', '#8aa85a'],
    name: ['#f2ffd8', '#a8ff5a', '#4ac81a'],
  },
  // A road of gold tiles above the clouds: white cliffs, gold glowing along every top.
  cloud: {
    floor: '#fff1c4',
    wall: '#eef4ff',
    cap: '#ffd23f',
    capStyle: STYLE.GLOW,
    gate: '#ffd23f',
    sky: ['#5ab4ff', '#fff4d6'],
    name: ['#fffbe6', '#ffe066', '#e8a81a'],
  },
  // A purple night, pumpkin-orange glowing along the cliff tops.
  spooky: {
    floor: '#4a4356',
    wall: '#2f2a3a',
    cap: '#ff8a1e',
    capStyle: STYLE.GLOW,
    gate: '#ff8a1e',
    sky: ['#1e1433', '#6a4a8a'],
    name: ['#ffe0c0', '#ffa040', '#e2600c'],
  },
  // Future World: lit-up towers at night, neon along every edge.
  neon: {
    floor: '#1d1f3a',
    wall: '#2a2d52',
    wallStyle: STYLE.WINDOWS,
    cap: '#ff3fd0',
    capStyle: STYLE.GLOW,
    gate: '#ff3fd0',
    sky: ['#120a3a', '#5a2a8a'],
    name: ['#ffe6ff', '#ff7ae8', '#c03fff'],
  },
  cyber: {
    floor: '#2a3346',
    floorStyle: STYLE.ROAD,
    wall: '#1c2a3e',
    cap: '#2fe8ff',
    capStyle: STYLE.GLOW,
    gate: '#2fe8ff',
    sky: ['#0a1a3a', '#2a6a9a'],
    name: ['#e0fbff', '#5ff0ff', '#1aa8e8'],
  },
  // Steel plate and hazard stripes.
  factory: {
    floor: '#6a707c',
    floorStyle: STYLE.PLATE,
    wall: '#3d434e',
    cap: '#ffcc1a',
    capStyle: STYLE.STRIPES,
    gate: '#ffcc1a',
    sky: ['#3a3f4a', '#9aa6b8'],
    name: ['#fff6d0', '#ffd21f', '#e89a1a'],
  },
  station: {
    floor: '#d8dee8',
    floorStyle: STYLE.PLATE,
    wall: '#8a94a6',
    cap: '#4fb4ff',
    capStyle: STYLE.GLOW,
    gate: '#4fb4ff',
    sky: ['#05051a', '#1a1a4a'],
    stars: true,
    name: ['#ffffff', '#bfe4ff', '#4fb4ff'],
  },
  mars: {
    floor: '#c8603a',
    wall: '#8a3a22',
    cap: '#e07a4a',
    gate: '#ff6a3a',
    sky: ['#5a2418', '#e08a5a'],
    name: ['#ffe0d0', '#ff8a5a', '#c83a1a'],
  },
  asteroid: {
    floor: '#5a5652',
    wall: '#3a3634',
    cap: '#8a8682',
    gate: '#b0a8ff',
    sky: ['#05051a', '#241544'],
    stars: true,
    name: ['#eeeeff', '#b0a8ff', '#6a5aff'],
  },
  galaxy: {
    floor: '#2a1a5a',
    floorStyle: STYLE.GALAXY,
    wall: '#1a1240',
    wallStyle: STYLE.GALAXY,
    cap: '#c08bff',
    capStyle: STYLE.GLOW,
    gate: '#ff7ad9',
    sky: ['#05021a', '#3a1a6a'],
    stars: true,
    name: ['#fff0ff', '#ff9bea', '#a03fff'],
  },
}

/** Each world's lobby sky (and stars), by world index; World 1's is the scene's own. */
export const WORLD_SKIES = [null, { sky: ['#1a1050', '#8a6ad8'], stars: true }]

/** Every SAFEZONE, whatever the stage: light blue studs, floor and cliffs alike. */
export const SAFE_THEME = { floor: '#a6dbff', floorStyle: STYLE.STUDS, wall: '#7ab9ec', cap: '#d8efff', gate: '#5cc8ff' }
