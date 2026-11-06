import {
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Euler,
  ExtrudeGeometry,
  InstancedMesh,
  Matrix4,
  OctahedronGeometry,
  Quaternion,
  Shape,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import { FOODS } from '@shared/balance'

import { asToyInstance, PropBuilder } from './blocks'
import { sharedMaterials, STYLE } from './materials'

/**
 * The foods: what every player eats, from the Choco Cookie to the DRAGON STEAK.
 *
 * Each is a small low-poly model built once from merged three.js primitives with its
 * colours baked into the vertices and its toy style (plain, glowing, galaxy, rainbow)
 * baked per vertex too, so a fancy food can mix a glowing topping with a plain base. They all draw through the one shared toy material - no textures, no shader
 * program of their own - with the instance colour left white, as the material
 * multiplies vertex colour by instance colour.
 *
 * Model frame: up is +Y, the food's front (the side you'd show someone) is +Z, the
 * origin is the middle of its bounding box, and its longest side is HELD_SIZE across
 * before foodSize(id) scales it. Every model stays under ~600 triangles.
 */

/** Longest side of a food at foodSize 1, in world units (the avatar is 1.8 tall). */
export const HELD_SIZE = 0.35

/** Accent colour of each food: the halo over its shop pad and the ring round its stand. */
const GLOW_HEX = {
  cookie: '#ffc27a',
  fries: '#ffd447',
  donut: '#ff8fc8',
  hotdog: '#ff9a4a',
  pizza: '#ffcf3c',
  taco: '#ffd84a',
  burger: '#ffb03b',
  sushi: '#ff8a5c',
  icecream: '#ffb3d1',
  cupcake: '#ff6fa8',
  pancakes: '#ffcf6a',
  drumstick: '#ff7a3a',
  ramen: '#ff5a4a',
  cake: '#ff9ccf',
  watermelon: '#ff4a6a',
  turkey: '#ffb04a',
  galaxyDonut: '#a46bff',
  neonSundae: '#39ff88',
  diamondCupcake: '#bff4ff',
  dragonSteak: '#ff5a1c',
}

const FIRST = FOODS[0].id
const known = (id) => (GLOW_HEX[id] ? id : FIRST)
const GLOWS = Object.fromEntries(Object.entries(GLOW_HEX).map(([id, hex]) => [id, new Color(hex)]))
const ORDER = Object.fromEntries(FOODS.map((food, i) => [food.id, i]))

export const foodGlow = (id) => GLOWS[known(id)]
/** How big a food is drawn: a little bigger with every food down the shop (0.88 to 1.3). */
export const foodSize = (id) => 0.88 + 0.022 * (ORDER[known(id)] ?? 0)

// --- Building blocks ------------------------------------------------------------------

const S = STYLE.SMOOTH
const GLOW = STYLE.GLOW
const PI = Math.PI
const HALF = PI / 2

/** Unit primitives, made once and only ever cloned (they never reach the GPU). */
const templates = new Map()
function template(key, make) {
  let g = templates.get(key)
  if (!g) {
    g = make()
    templates.set(key, g)
  }
  return g
}
/** Radius 1 at the bottom, `top` at the top, 1 tall. */
const cyl = (sides = 12, top = 1) => template(`cyl:${sides}:${top}`, () => new CylinderGeometry(top, 1, 1, sides))
/** A square frustum with axis-aligned sides: half-width 0.707 at the bottom. */
const frustum4 = (top) => template(`f4:${top}`, () => new CylinderGeometry(top, 1, 1, 4).rotateY(PI / 4))
const ball = (w = 10, h = 6) => template(`ball:${w}:${h}`, () => new SphereGeometry(1, w, h))
/** The top half of a ball. */
const dome = (w = 12, h = 5) => template(`dome:${w}:${h}`, () => new SphereGeometry(1, w, h, 0, PI * 2, 0, HALF))
/** A ring round the Z axis: radius 1, tube `tube`. */
const ring = (tube, radial, tubular) => template(`ring:${tube}:${radial}:${tubular}`, () => new TorusGeometry(1, tube, radial, tubular))
/** Point up, radius 1 at the base, 1 tall. */
const cone = (sides = 10) => template(`cone:${sides}`, () => new ConeGeometry(1, 1, sides))
const box = () => template('box', () => new BoxGeometry(1, 1, 1))
const gem = () => template('gem', () => new OctahedronGeometry(1, 0))

/**
 * Extrudes `shape` along Z, `depth` deep and centred on z 0 (a bevel adds its thickness
 * to both faces evenly, so it stays centred).
 */
function extrude(shape, depth, extra = {}) {
  const g = new ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 10, ...extra })
  g.translate(0, 0, -depth / 2)
  return g
}

/** A half disc, radius 1, flat edge along the top (y 0), 1 deep. */
const halfDisc = () =>
  template('halfDisc', () => {
    const shape = new Shape()
    shape.moveTo(-1, 0)
    shape.absarc(0, 0, 1, PI, PI * 2, false)
    shape.lineTo(-1, 0)
    return extrude(shape, 1)
  })

/** A pizza slice's outline, tip down, 1 deep. */
const wedge = () =>
  template('wedge', () => {
    const shape = new Shape()
    shape.moveTo(0, -0.55)
    shape.lineTo(0.36, 0.38)
    shape.lineTo(-0.36, 0.38)
    shape.lineTo(0, -0.55)
    return extrude(shape, 1)
  })

const STEAK_OUTLINE = [
  [-0.5, 0.05],
  [-0.42, 0.28],
  [-0.2, 0.4],
  [0.08, 0.39],
  [0.32, 0.31],
  [0.5, 0.12],
  [0.52, -0.1],
  [0.38, -0.3],
  [0.1, -0.4],
  [-0.18, -0.38],
  [-0.4, -0.25],
]
function outline(points, k = 1) {
  const shape = new Shape()
  points.forEach(([x, y], i) => (i ? shape.lineTo(x * k, y * k) : shape.moveTo(x * k, y * k)))
  shape.closePath()
  return shape
}
/** The steak: bevelled, so its edges are rounded. Its faces are 0.12 either side of z 0. */
const steak = () =>
  template('steak', () =>
    extrude(outline(STEAK_OUTLINE), 0.16, { bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.035, bevelSegments: 1, curveSegments: 1 }),
  )
/** The fat round the steak's edge, a little wider and thinner than the steak. */
const steakRim = () => template('steakRim', () => extrude(outline(STEAK_OUTLINE, 1.15), 0.12))

// --- The foods --------------------------------------------------------------------

const SPRINKLES = ['#ffffff', '#ffe14a', '#4fc3ff', '#7dff6a', '#ff4a6a', '#b46bff']
const NEON_SPRINKLES = ['#7fe0ff', '#ff7ad9', '#ffe14a', '#ffffff']

/** A ring donut standing up, its icing on the front, sprinkles on the icing. */
function ringDonut(add, { dough, doughStyle = S, icing, icingStyle = S, sprinkles, sprinkleStyle = S }) {
  add(ring(0.45, 6, 12), [0, 0, 0], 0.36, dough, doughStyle)
  add(ring(0.45, 6, 12), [0, 0, 0.04], [0.37, 0.37, 0.3], icing, icingStyle)
  for (let i = 0; i < 10; i += 1) {
    const a = i * 2.39996
    const r = 0.37 + (((i * 0.618) % 1) - 0.5) * 0.1
    add(box(), [r * Math.cos(a), r * Math.sin(a), 0.168], [0.075, 0.024, 0.024], sprinkles[i % sprinkles.length], sprinkleStyle, [0, 0, a * 1.7 + i])
  }
}

/** A cupcake: a fluted wrapper, two tiers of frosting and a peak. */
function cupcakeBase(add, { wrapper, wrapperStyle = S, band, bandStyle = S, frosting, frosting2, sprinkles, sprinkleStyle = S }) {
  add(cyl(10, 1.28), [0, -0.25, 0], [0.27, 0.34, 0.27], wrapper, wrapperStyle)
  add(cyl(10), [0, -0.075, 0], [0.35, 0.03, 0.35], band, bandStyle)
  add(ball(10, 6), [0, -0.02, 0], [0.38, 0.17, 0.38], frosting)
  add(ball(10, 6), [0, 0.11, 0], [0.27, 0.14, 0.27], frosting2)
  add(cone(10), [0, 0.25, 0], [0.15, 0.18, 0.15], frosting)
  for (let i = 0; i < 6; i += 1) {
    const a = i * 1.047 + 0.3
    add(box(), [0.3 * Math.cos(a), 0.06, 0.3 * Math.sin(a)], [0.06, 0.02, 0.02], sprinkles[i % sprinkles.length], sprinkleStyle, [0, a * 2, 0.5])
  }
}

/** A maki piece: nori round rice, salmon and cucumber in the middle. Axis along y. */
function maki(add, group, position, rotation) {
  group(position, rotation, () => {
    add(cyl(10), [0, 0, 0], [0.2, 0.3, 0.2], '#1f3a2a')
    add(cyl(10), [0, 0, 0], [0.18, 0.32, 0.18], '#f7f7f2')
    add(box(), [-0.035, 0, 0.03], [0.09, 0.34, 0.07], '#ff8a5c')
    add(box(), [0.055, 0, -0.035], [0.05, 0.34, 0.05], '#5fd35a')
  })
}

/**
 * Each food's model, in food units (about 1 across; it's scaled to HELD_SIZE after).
 * `add(geometry, position, scale, colour, style, rotation)` adds one coloured part;
 * `group(position, rotation, fn)` moves every part fn adds as one.
 */
const BUILDERS = {
  /** A golden cookie standing on its edge, chocolate chips on both faces. */
  cookie(add) {
    add(cyl(14), [0, 0, 0], [0.5, 0.13, 0.5], '#d9a05a', S, [HALF, 0, 0])
    add(cyl(14), [0, 0, 0], [0.515, 0.08, 0.515], '#b7783c', S, [HALF, 0, 0])
    const chips = [
      [-0.22, 0.2, 1],
      [0.14, 0.27, 1],
      [0.3, -0.02, 1],
      [-0.04, 0.0, 1],
      [-0.3, -0.16, 1],
      [0.08, -0.3, 1],
      [-0.1, 0.36, 1],
      [0.2, 0.12, -1],
      [-0.2, -0.05, -1],
      [0.05, -0.25, -1],
      [-0.05, 0.3, -1],
    ]
    chips.forEach(([x, y, side], i) => add(gem(), [x, y, side * 0.07], [0.07, 0.07, 0.035], '#4a2a17', S, [0, 0, i * 0.7]))
  },

  /** Crispy fries in a red carton with a yellow badge. */
  fries(add) {
    add(frustum4(1.28), [0, -0.2, 0], [0.3, 0.5, 0.21], '#e8322f')
    add(cyl(10), [0, -0.2, 0.175], [0.085, 0.02, 0.085], '#ffd21f', S, [HALF - 0.08, 0, 0])
    const sticks = [
      [-0.15, 0.12, -0.06, 0.12],
      [-0.08, 0.2, 0.05, -0.05],
      [0, 0.24, -0.03, 0.04],
      [0.08, 0.18, 0.06, -0.1],
      [0.15, 0.1, -0.05, 0.14],
      [-0.04, 0.14, 0.09, 0.02],
      [0.05, 0.12, -0.09, -0.03],
      [-0.12, 0.06, 0.08, -0.12],
      [0.12, 0.08, 0.1, 0.08],
    ]
    for (const [x, y, z, tilt] of sticks) add(box(), [x, y, z], [0.065, 0.46, 0.065], '#ffd447', S, [tilt * 0.5, 0, tilt])
  },

  /** A ring donut with pink icing and rainbow sprinkles. */
  donut(add) {
    ringDonut(add, { dough: '#e0a35a', icing: '#ff7eb6', sprinkles: SPRINKLES })
  },

  /** A sausage in a split bun with a mustard zigzag. */
  hotdog(add) {
    for (const side of [-1, 1]) add(ball(10, 6), [0, -0.05, side * 0.085], [0.5, 0.15, 0.16], '#e6a65a')
    add(ball(10, 6), [0, 0.06, 0], [0.56, 0.1, 0.1], '#c2452a')
    for (let i = 0; i < 6; i += 1) {
      const x = -0.27 + i * 0.108
      const y = 0.06 + 0.1 * Math.sqrt(Math.max(0, 1 - (x / 0.56) ** 2)) + 0.004
      add(box(), [x, y, 0], [0.13, 0.025, 0.035], '#ffd21f', S, [0, i % 2 ? 0.75 : -0.75, 0])
    }
  },

  /** A slice held tip down: cheese on the front, crust along the top, pepperoni. */
  pizza(add) {
    add(wedge(), [0, 0, 0.025], [1, 1, 0.05], '#ffc93c')
    add(wedge(), [0, 0, -0.025], [1, 1, 0.05], '#e8b56a')
    add(cyl(10), [0, 0.4, 0], [0.075, 0.8, 0.075], '#d48a3c', S, [0, 0, HALF])
    for (const [x, y] of [
      [-0.12, 0.18],
      [0.13, 0.2],
      [0, -0.05],
      [0.02, -0.28],
    ]) {
      add(cyl(10), [x, y, 0.055], [0.075, 0.02, 0.075], '#c8322b', S, [HALF, 0, 0])
    }
    add(gem(), [-0.02, 0.06, 0.055], [0.05, 0.028, 0.012], '#3fae3a', S, [0, 0, 0.6])
    add(gem(), [0.1, -0.14, 0.055], [0.05, 0.028, 0.012], '#3fae3a', S, [0, 0, -0.5])
  },

  /** A crunchy shell, open at the top, stuffed with meat, lettuce, tomato and cheese. */
  taco(add) {
    for (const side of [-1, 1]) add(halfDisc(), [0, 0, side * 0.12], [0.45, 0.45, 0.05], '#f2c14e', S, [side * 0.2, 0, 0])
    add(box(), [0, -0.05, 0], [0.74, 0.14, 0.15], '#7a3b1e')
    for (let i = 0; i < 5; i += 1) {
      add(gem(), [-0.3 + i * 0.15, 0.03, (i % 2) * 0.02 - 0.01], [0.13, 0.09, 0.1], '#6fd24a', S, [i * 0.5, i, 0])
    }
    for (const [x, y, z] of [
      [-0.22, 0.08, 0.02],
      [0.05, 0.09, -0.02],
      [0.25, 0.07, 0.01],
    ]) {
      add(box(), [x, y, z], 0.075, '#e8322f', S, [x * 3, x * 5, 0])
    }
    for (const [x, y, z, r] of [
      [-0.08, 0.1, 0.03, 0.4],
      [0.17, 0.1, -0.02, -0.6],
      [-0.3, 0.08, 0, 1.1],
      [0.32, 0.07, 0.02, 0.2],
    ]) {
      add(box(), [x, y, z], [0.1, 0.03, 0.03], '#ffd84a', S, [0, r, 0])
    }
  },

  /** Two patties, cheese, lettuce and tomato in a sesame bun. */
  burger(add) {
    add(cyl(12), [0, -0.3, 0], [0.46, 0.14, 0.46], '#e3a04f')
    add(cyl(12), [0, -0.17, 0], [0.5, 0.12, 0.5], '#5a2e1a')
    add(box(), [0, -0.095, 0], [0.72, 0.035, 0.72], '#ffc93c', S, [0, PI / 4, 0])
    add(cyl(12), [0, -0.02, 0], [0.5, 0.12, 0.5], '#5a2e1a')
    add(cyl(12), [0, 0.055, 0], [0.53, 0.035, 0.53], '#6fd24a')
    add(cyl(12), [0, 0.09, 0], [0.44, 0.04, 0.44], '#e8322f')
    add(cyl(12), [0, 0.125, 0], [0.48, 0.05, 0.48], '#e8a650')
    add(dome(12, 5), [0, 0.12, 0], [0.48, 0.3, 0.48], '#e8a650')
    for (let i = 0; i < 5; i += 1) {
      const a = i * 1.257 + 0.4
      const e = 0.75 + (i % 2) * 0.3
      const r = 0.49 * Math.cos(e)
      add(box(), [r * Math.cos(a), 0.12 + 0.305 * Math.sin(e), r * Math.sin(a)], [0.05, 0.02, 0.03], '#fff4d6', S, [0, a, 0.4])
    }
  },

  /** Three maki pieces: two standing, one lying on top showing its fillings. */
  sushi(add, group) {
    maki(add, group, [-0.21, -0.12, 0], [0.35, 0, 0.1])
    maki(add, group, [0.21, -0.12, 0], [0.35, 0, -0.1])
    maki(add, group, [0, 0.16, 0.03], [HALF - 0.25, 0, 0])
  },

  /** A waffle cone with vanilla, strawberry and mint scoops and a wafer. */
  icecream(add) {
    add(cone(10), [0, -0.27, 0], [0.2, 0.55, 0.2], '#d99a4e', S, [PI, 0, 0])
    add(cyl(10), [0, 0.02, 0], [0.215, 0.05, 0.215], '#c9853c')
    add(ball(10, 6), [0, 0.17, 0], 0.21, '#fff1d0')
    add(ball(10, 6), [0.015, 0.43, 0], 0.195, '#ff8fb1')
    add(ball(10, 6), [-0.01, 0.66, 0.01], 0.175, '#8ff0c0')
    add(box(), [0.1, 0.8, 0], [0.05, 0.22, 0.03], '#e0a860', S, [0, 0, -0.3])
  },

  /** A pink cupcake with a frosting swirl and a cherry. */
  cupcake(add) {
    cupcakeBase(add, { wrapper: '#ff6fa8', band: '#e0508a', frosting: '#fff4fa', frosting2: '#ffd1e6', sprinkles: SPRINKLES })
    add(ball(8, 6), [0, 0.37, 0], 0.075, '#e01f3d')
    add(box(), [0.02, 0.46, 0], [0.015, 0.1, 0.015], '#4a7a2a', S, [0, 0, -0.3])
  },

  /** Five pancakes, butter and syrup dripping down the sides. */
  pancakes(add) {
    for (let i = 0; i < 5; i += 1) {
      add(cyl(12), [(i % 2) * 0.02 - 0.01, -0.3 + i * 0.09, 0], [0.46, 0.085, 0.46], i % 2 ? '#dc9440' : '#e9a94f')
    }
    const top = -0.3 + 4 * 0.09 + 0.0425
    add(cyl(12), [0, top + 0.012, 0], [0.4, 0.03, 0.4], '#8a3f12')
    for (let i = 0; i < 4; i += 1) {
      const a = i * 1.57 + 0.5
      add(box(), [0.455 * Math.cos(a), top - 0.06, 0.455 * Math.sin(a)], [0.03, 0.15, 0.07], '#8a3f12', S, [0, -a, 0])
    }
    add(box(), [0.02, top + 0.06, 0], [0.14, 0.07, 0.14], '#ffe680', S, [0, 0.4, 0])
  },

  /** A BBQ-glazed drumstick held by its bone. */
  drumstick(add) {
    add(ball(10, 7), [0, 0.18, 0], [0.28, 0.3, 0.28], '#a4471e')
    add(cone(10), [0, -0.05, 0], [0.2, 0.3, 0.2], '#a4471e', S, [PI, 0, 0])
    add(cyl(8), [0, -0.3, 0], [0.055, 0.32, 0.055], '#f7f0e1')
    for (const side of [-1, 1]) add(ball(6, 4), [side * 0.045, -0.47, 0], 0.07, '#f7f0e1')
    for (const [x, y, z] of [
      [0.12, 0.25, 0.22],
      [-0.15, 0.1, 0.2],
      [0.05, 0.02, 0.17],
    ]) {
      add(gem(), [x, y, z], [0.06, 0.04, 0.02], '#7a2f12', S, [0, Math.atan2(x, z), 0])
    }
  },

  /** A red bowl of noodles: egg, fishcake, pork, nori and chopsticks. */
  ramen(add) {
    add(cyl(12, 1.55), [0, -0.1, 0], [0.32, 0.36, 0.32], '#d8342c')
    add(cyl(12), [0, -0.3, 0], [0.2, 0.06, 0.2], '#a8231e')
    add(cyl(12), [0, 0.09, 0], [0.47, 0.02, 0.47], '#f2b24a')
    for (let i = 0; i < 4; i += 1) add(box(), [-0.05 + i * 0.04, 0.105, -0.05 + (i % 2) * 0.08], [0.3, 0.02, 0.04], '#ffe7a8', S, [0, i * 0.8, 0])
    add(ball(8, 5), [0.18, 0.11, 0.12], [0.1, 0.05, 0.13], '#ffffff')
    add(cyl(8), [0.18, 0.158, 0.12], [0.055, 0.01, 0.055], '#ffb21e')
    add(cyl(10), [-0.18, 0.11, 0.1], [0.08, 0.02, 0.08], '#ffffff')
    add(cyl(8), [-0.18, 0.122, 0.1], [0.03, 0.01, 0.03], '#ff6fa8')
    add(cyl(10), [-0.05, 0.11, -0.18], [0.12, 0.025, 0.12], '#c97a4a', S, [0.15, 0, 0])
    add(box(), [0.05, 0.18, -0.36], [0.2, 0.22, 0.02], '#1f3a2a', S, [-0.3, 0, 0])
    for (const dx of [0, 0.07]) add(box(), [0.2 + dx, 0.22, 0], [0.025, 0.025, 0.8], '#d9a66b', S, [-0.35, 0.3, 0])
  },

  /** A two-tier party cake with candles and strawberries. */
  cake(add) {
    add(cyl(14), [0, -0.2, 0], [0.5, 0.3, 0.5], '#ff9ccf')
    add(cyl(14), [0, -0.06, 0], [0.515, 0.05, 0.515], '#ffffff')
    add(cyl(14), [0, 0.07, 0], [0.33, 0.24, 0.33], '#fff4e0')
    add(cyl(14), [0, 0.18, 0], [0.345, 0.04, 0.345], '#ff9ccf')
    const candles = [
      [-0.12, 0.05, '#4fc3ff'],
      [0, -0.08, '#ffe14a'],
      [0.13, 0.06, '#7dff6a'],
    ]
    for (const [x, z, color] of candles) {
      add(box(), [x, 0.27, z], [0.035, 0.16, 0.035], color)
      add(gem(), [x, 0.385, z], [0.03, 0.05, 0.03], '#ffb02e', GLOW)
    }
    for (let i = 0; i < 5; i += 1) {
      const a = i * 1.257 + 0.3
      add(gem(), [0.42 * Math.cos(a), -0.01, 0.42 * Math.sin(a)], [0.05, 0.06, 0.05], '#e8322f')
    }
  },

  /** A big watermelon slice: rind, pale band, red flesh and seeds. */
  watermelon(add) {
    add(halfDisc(), [0, -0.04, 0], [0.5, 0.5, 0.17], '#2f8f3a')
    add(halfDisc(), [0, -0.02, 0], [0.46, 0.46, 0.2], '#d8f5a2')
    add(halfDisc(), [0, 0, 0], [0.42, 0.42, 0.23], '#ff4258')
    const seeds = [
      [-0.2, -0.1, 1],
      [0, -0.16, 1],
      [0.2, -0.1, 1],
      [-0.1, -0.27, 1],
      [0.1, -0.27, 1],
      [0, -0.34, 1],
      [-0.15, -0.14, -1],
      [0.15, -0.14, -1],
      [0, -0.28, -1],
    ]
    for (const [x, y, side] of seeds) add(gem(), [x, y, side * 0.12], [0.025, 0.04, 0.012], '#1d1d1d', S, [0, 0, x * 2])
  },

  /** A golden roast turkey, its legs to the front. */
  turkey(add) {
    add(ball(10, 8), [0, 0, 0], [0.42, 0.3, 0.36], '#c46a2a')
    add(ball(8, 6), [0, 0.17, 0.02], [0.3, 0.16, 0.24], '#d98a3c')
    for (const side of [-1, 1]) {
      add(ball(8, 6), [side * 0.27, -0.05, 0.22], [0.13, 0.13, 0.2], '#b85e22', S, [0, side * 0.4, 0])
      add(cyl(6), [side * 0.3, -0.04, 0.42], [0.03, 0.14, 0.03], '#f7f0e1', S, [HALF, 0, 0])
      add(cyl(6), [side * 0.31, -0.04, 0.5], [0.05, 0.05, 0.05], '#ffffff', S, [HALF, 0, 0])
    }
  },

  /** A deep-space donut: galaxy icing, glowing sprinkles and a ring in orbit. */
  galaxyDonut(add) {
    ringDonut(add, {
      dough: '#4a2a8a',
      icing: '#5b3fd0',
      icingStyle: STYLE.GALAXY,
      sprinkles: NEON_SPRINKLES,
      sprinkleStyle: GLOW,
    })
    add(ring(0.035, 4, 20), [0, 0, 0], 0.66, '#9fe8ff', GLOW, [1.15, 0.35, 0])
  },

  /** A glass of glowing neon scoops in a cup that shifts colour as you move. */
  neonSundae(add) {
    add(cyl(10, 2), [0, -0.14, 0], [0.17, 0.24, 0.17], '#bff4ff', STYLE.RAINBOW)
    add(cyl(8), [0, -0.34, 0], [0.04, 0.16, 0.04], '#e8faff')
    add(cyl(10), [0, -0.43, 0], [0.18, 0.03, 0.18], '#e8faff')
    add(ball(8, 6), [-0.1, 0.06, 0.03], 0.17, '#ff3bd4', GLOW)
    add(ball(8, 6), [0.11, 0.07, -0.02], 0.17, '#39ff88', GLOW)
    add(ball(8, 6), [0, 0.22, 0.02], 0.15, '#3fd2ff', GLOW)
    add(cone(8), [0, 0.39, 0.01], [0.1, 0.12, 0.1], '#ffffff')
    add(ball(6, 5), [0, 0.49, 0.01], 0.06, '#ff2a6a', GLOW)
    add(box(), [0.2, 0.25, -0.05], [0.05, 0.3, 0.1], '#ffd27a', S, [0, 0, -0.4])
  },

  /** A frosty cupcake crowned with a glowing diamond. */
  diamondCupcake(add) {
    cupcakeBase(add, {
      wrapper: '#d9e6f2',
      band: '#7fe0ff',
      bandStyle: GLOW,
      frosting: '#eefaff',
      frosting2: '#c4f0ff',
      sprinkles: ['#bff4ff', '#ffffff'],
      sprinkleStyle: GLOW,
    })
    add(gem(), [0, 0.47, 0], [0.13, 0.19, 0.13], '#c4f6ff', GLOW)
    add(gem(), [0, 0.47, 0], [0.1, 0.15, 0.1], '#ffffff', GLOW, [0, PI / 4, 0])
  },

  /**
   * THE DRAGON STEAK: a thick glowing-red slab with brighter grill marks, a rim of fat,
   * a bone to hold it by and green dragon spikes. (Not STYLE.LAVA: its cracks are a
   * world-space pattern about 1.25 m apart, so a hand-sized steak would be all dark crust.)
   */
  dragonSteak(add) {
    add(steak(), [0, 0, 0], 1, '#d9301c', GLOW)
    add(steakRim(), [0, 0, 0], 1, '#ffe0b0')
    for (const [x, length] of [
      [-0.24, 0.46],
      [-0.08, 0.6],
      [0.08, 0.6],
      [0.24, 0.46],
    ]) {
      add(box(), [x, 0, 0.125], [0.05, length, 0.012], '#ffb02e', GLOW, [0, 0, 0.7])
    }
    add(cyl(8), [-0.66, -0.02, 0], [0.055, 0.36, 0.055], '#f7f0e1', S, [0, 0, HALF])
    for (const y of [0.05, -0.09]) add(ball(6, 4), [-0.86, y, 0], 0.075, '#f7f0e1')
    for (const [x, y, tilt] of [
      [-0.28, 0.43, 0.25],
      [-0.06, 0.47, 0],
      [0.17, 0.44, -0.2],
      [0.38, 0.35, -0.5],
    ]) {
      add(cone(6), [x, y, 0], [0.055, 0.17, 0.055], '#3dff6a', GLOW, [0, 0, tilt])
    }
  },
}

// --- Geometry cache -------------------------------------------------------------------

const _groupMatrix = new Matrix4()
const _q = new Quaternion()
const _e = new Euler()
const _p = new Vector3()
const _s = new Vector3()
const _center = new Vector3()
const _size = new Vector3()

/** Builds food `id`'s model, centred, its longest side HELD_SIZE. */
function buildFood(id) {
  const parts = new PropBuilder()
  const add = (geometry, position, scale, color, style = S, rotation = undefined) =>
    parts.add(geometry, { position, rotation, scale, color, style })
  const group = (position, rotation, fn) => {
    _p.fromArray(position)
    _q.setFromEuler(_e.set(rotation[0], rotation[1], rotation[2]))
    parts.transform = _groupMatrix.compose(_p, _q, _s.setScalar(1))
    fn()
    parts.transform = null
  }
  BUILDERS[id](add, group)
  const geometry = parts.build()
  geometry.computeBoundingBox()
  geometry.boundingBox.getCenter(_center)
  geometry.boundingBox.getSize(_size)
  const k = HELD_SIZE / Math.max(_size.x, _size.y, _size.z)
  geometry.translate(-_center.x, -_center.y, -_center.z)
  geometry.scale(k, k, k)
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

const geometries = new Map()

/**
 * Food `id`'s model (a shared, cached geometry: never dispose it). Non-indexed, with
 * position, normal, colour and a per-vertex aStyle, ready for the shared toy material.
 */
export function foodGeometry(id) {
  const key = known(id)
  let g = geometries.get(key)
  if (!g) {
    g = buildFood(key)
    geometries.set(key, g)
  }
  return g
}

/**
 * A placed copy of food `id`'s model, for merging into a bigger static mesh (the
 * caller owns it). `scale` multiplies foodSize(id); `yaw` turns its front (+Z) about
 * the vertical; `lean` tips its top towards its front first.
 *
 * @param {string} id
 * @param {{ position?: number[], yaw?: number, lean?: number, scale?: number }} [placement]
 */
export function foodPart(id, { position = [0, 0, 0], yaw = 0, lean = 0, scale = 1 } = {}) {
  const g = foodGeometry(id).clone()
  _p.fromArray(position)
  _q.setFromEuler(_e.set(lean, yaw, 0, 'YXZ'))
  _s.setScalar(scale * foodSize(id))
  g.applyMatrix4(_groupMatrix.compose(_p, _q, _s))
  return g
}

/**
 * Adds a placed food (see foodPart) to a PropBuilder, keeping its own colours and styles
 * - PropBuilder.add would repaint it one flat colour - so it merges into that builder's
 * single mesh like any other prop.
 *
 * @param {import('./blocks').PropBuilder} props
 */
export function addFoodToProps(props, id, placement) {
  const part = foodPart(id, placement)
  // Its own little animation in the toy shader (see PropBuilder.add's `anim`).
  if (placement?.anim) part.userData.anim = placement.anim
  props.parts.push(part)
}

// --- Meshes -----------------------------------------------------------------------

const WHITE = new Color(1, 1, 1)
const _m = new Matrix4()

/**
 * A single food to hold in one hand: an InstancedMesh of one, so it shares the toy
 * shader program with everything else. `setFood(id)` swaps in that food's (cached)
 * model and size; it's a no-op when the food hasn't changed, so it's fine to call
 * every frame. Lives as a child of whatever holds it, origin in the middle of the food.
 */
/**
 * How much bigger than its model a food is in your hand: a big, juicy, cartoon-sized
 * bite of it (about 0.6-0.9 across, against a 1.8-tall avatar).
 */
const HELD_SCALE = 1.9

export function createHeldFood() {
  const mesh = new InstancedMesh(foodGeometry(FIRST), sharedMaterials().toy, 1)
  mesh.setColorAt(0, WHITE)
  mesh.frustumCulled = false
  mesh.castShadow = true
  let current = null
  mesh.setFood = (id) => {
    if (id === current) return
    current = id
    mesh.geometry = foodGeometry(id)
    const s = foodSize(id) * HELD_SCALE
    mesh.setMatrixAt(0, _m.makeScale(s, s, s))
    mesh.instanceMatrix.needsUpdate = true
  }
  mesh.setFood(FIRST)
  return mesh
}

/** Frees what createHeldFood made; the shared food models and material stay. */
export function disposeHeldFood(mesh) {
  mesh?.dispose()
}

/**
 * Many foods merged into ONE static mesh - one draw call however many there are, e.g.
 * the whole food market's shelf. Each placement is `{ id, ...foodPart's placement }`.
 * Move it as a whole (its position), never per food.
 *
 * @param {Array<{ id: string, position?: number[], yaw?: number, lean?: number, scale?: number }>} placements
 */
export function createFoodDisplay(placements) {
  const parts = placements.map((placement) => foodPart(placement.id, placement))
  const geometry = mergeGeometries(parts, false)
  for (const part of parts) part.dispose()
  geometry.computeBoundingSphere()
  return asToyInstance(geometry, sharedMaterials().toy)
}

/** Frees a mesh made by createFoodDisplay (its merged geometry is its own). */
export function disposeFoodDisplay(mesh) {
  if (!mesh) return
  mesh.geometry.dispose()
  mesh.dispose()
}
