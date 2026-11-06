import { Color, MeshLambertMaterial, Vector2 } from 'three'

/**
 * The toy-brick look, done in the shader instead of with textures.
 *
 * Every block in the world shares one Lambert material whose fragment shader draws the
 * stud tiles, grass caps, windows and so on from world position. That keeps texture
 * memory at zero for the whole world and lets thousands of differently sized boxes
 * share one InstancedMesh: world-space patterns tile identically whatever the scale.
 *
 * Which pattern a surface gets is per instance (or per vertex, for merged meshes) via
 * the `aStyle` attribute, using the ids below.
 */
export const STYLE = {
  /** Rounded stud tiles. */
  STUDS: 0,
  /** Hill block: tan studded sides with a grass cap and lip. */
  TERRAIN: 1,
  /** Building wall with a window grid on the sides. */
  WINDOWS: 2,
  /** Diagonal diamond plate. */
  PLATE: 3,
  /** Plain, no pattern. */
  SMOOTH: 4,
  /** Self-lit: neon, lava glow, signs. */
  GLOW: 5,
  /** Horizontal white bands, for gate pillars. */
  STRIPES: 6,
  /** Lava: dark crust with glowing cracks. */
  LAVA: 7,
  /** Hue cycles across the surface. */
  RAINBOW: 8,
  /** Deep blue with stars. */
  GALAXY: 9,
  /** Asphalt with no studs but a fine grain. */
  ROAD: 10,
  /** Falling water: bright streaks scrolling down. */
  WATER: 11,
  /** Treadmill belt: dark rubber with ribs scrolling east along the top. */
  BELT: 12,
  /** Big square studs, as on the track's cliffs in the reference. */
  BLOCK: 13,
  /** Big square studs with a grass cap and lip: the reference's grassy cliffs. */
  BLOCK_GRASS: 14,
  /** Big floor tiles with thin seams and a faint checker: the track's floor. */
  TILES: 15,
  /** Brickwork in running bond up the sides (mortar lines a paler shade): city walls. */
  BRICKS: 16,
  /** Diagonal black hazard stripes over the instance colour (yellow, usually). */
  HAZARD: 17,
  /** Marquee bulbs, lit in pulses that race along towards -z (down the track). */
  CHASE: 18,
  /** A tower's windows at sunset: most dark glass, some lit up warm. */
  LITWIN: 19,
  /** Big racing checks: the instance colour and near-black. */
  CHECKER: 20,
  /** An aviation light, blinking on and off, each at its own beat. */
  BLINK: 21,
}

/** Shared clock for animated styles; WorldClock advances it once per frame. */
export const toyTime = { value: 0 }

/**
 * Where the breathing statue stands (x, z): vertices with a negative `aAnim.y` swell
 * out from the vertical line through it and back, like a big belly breathing.
 */
export const toyBreathe = { value: new Vector2() }

/**
 * 0-1: how wild the crowd in the stands is going (a wall just smashed). Their hop
 * (aAnim with phase >= 100) gets quicker and higher with it; Push eases it back down.
 */
export const toyCheer = { value: 0 }

/** Cap colour for STYLE.TERRAIN blocks; the instance colour is the dirt underneath. */
export const GRASS_COLOR = new Color('#4fd93a')

const vertexHead = /* glsl */ `
  attribute float aStyle;
  // A prop's (or a box's) own little animation, done here so it costs no draw call and
  // no per-frame work on the CPU: (phase, amount). amount > 0 bobs it up and down by that
  // much - or, with a phase of 100 or more, hops (a crowd cheering); amount < 0 breathes
  // it in and out round uBreathe by that share. (0, 0) - what everything without the
  // attribute gets - is still.
  attribute vec2 aAnim;
  uniform float uTime;
  uniform float uCheer;
  uniform vec2 uBreathe;
  varying vec3 vToyPos;
  varying vec3 vToyNormal;
  varying float vToyStyle;
  varying float vToyTop;
  varying float vToyDepth;
`

const vertexBody = /* glsl */ `
  vec4 toyWorld = vec4(transformed, 1.0);
  vec3 toyN = objectNormal;
  vec4 toyTop = vec4(0.0, 0.5, 0.0, 1.0);
  #ifdef USE_INSTANCING
    toyWorld = instanceMatrix * toyWorld;
    toyN = mat3(instanceMatrix) * toyN;
    toyTop = instanceMatrix * toyTop;
  #endif
  toyWorld = modelMatrix * toyWorld;
  vToyPos = toyWorld.xyz;
  vToyNormal = normalize(mat3(modelMatrix) * toyN);
  vToyTop = (modelMatrix * toyTop).y;
  vToyStyle = aStyle;
  #ifdef USE_INSTANCING
    // How far below a box's top, along its own up: exact even tipped up a slope.
    vToyDepth = (0.5 - transformed.y) * length(instanceMatrix[1].xyz);
  #else
    vToyDepth = vToyTop - vToyPos.y;
  #endif
`

const vertexAnim = /* glsl */ `
  if (aAnim.y > 0.0) {
    if (aAnim.x >= 100.0) {
      transformed.y += abs(sin(uTime * (5.5 + 5.0 * uCheer) + aAnim.x)) * aAnim.y * (1.0 + 1.4 * uCheer);
    } else {
      transformed.y += sin(uTime * 1.7 + aAnim.x) * aAnim.y;
    }
  } else if (aAnim.y < 0.0) {
    float breath = 0.5 + 0.5 * sin(uTime * 2.2 + aAnim.x);
    transformed.xz += (transformed.xz - uBreathe) * (-aAnim.y) * breath;
  }
`

const fragmentHead = /* glsl */ `
  uniform float uStudScale;
  uniform float uTime;
  uniform vec3 uGrass;
  varying vec3 vToyPos;
  varying vec3 vToyNormal;
  varying float vToyStyle;
  varying float vToyTop;
  varying float vToyDepth;

  float toyHash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  // Every pattern below takes \`w\`, how much its coordinate changes across a pixel
  // (fwidth), worked out once up front in uniform control flow: a derivative taken inside
  // a branch is undefined, and Direct3D's shader compiler takes ages flattening them.

  // Rounded stud tile: dark seams, a lit upper-left bevel and shaded lower-right.
  // Fades to its average once tiles shrink below a couple of pixels, so distant
  // ground doesn't shimmer with moire.
  float toyTile(vec2 p, vec2 w) {
    float aa = max(max(w.x, w.y), 1e-4);
    vec2 c = fract(p) - 0.5;
    vec2 q = abs(c) - vec2(0.34);
    float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 0.1;
    float inside = 1.0 - smoothstep(-aa, aa, d);
    float bevel = clamp(-d * 9.0, 0.0, 1.0);
    float lit = (c.y - c.x) * (1.0 - bevel) * 0.22;
    float shade = mix(0.82, 1.0 + lit, inside);
    return mix(shade, 0.95, smoothstep(0.28, 0.6, aa));
  }

  // Diamond plate: a raised lozenge grid on the diagonals.
  float toyPlate(vec2 p, vec2 pw) {
    vec2 r = vec2(p.x + p.y, p.x - p.y) * 0.7071 * 1.4;
    float aa = max((pw.x + pw.y) * 0.7071 * 1.4, 1e-4);
    vec2 f = abs(fract(r) - 0.5);
    float line = 1.0 - smoothstep(0.06 - aa, 0.06 + aa, min(f.x, f.y));
    float hl = 1.0 - smoothstep(0.1, 0.2, abs(f.x - f.y));
    float shade = 1.0 - line * 0.28 + hl * 0.06;
    return mix(shade, 0.92, smoothstep(0.2, 0.5, aa));
  }

  // Big square stud: a raised square in each cell, its bevel lit from the upper left,
  // in a dark groove. Fades to its average far off.
  float toyBlock(vec2 p, vec2 w) {
    float aa = max(max(w.x, w.y), 1e-4);
    vec2 c = fract(p) - 0.5;
    float e = max(abs(c.x), abs(c.y));
    float seam = smoothstep(0.455 - aa, 0.455 + aa, e);
    float inner = 1.0 - smoothstep(0.3 - aa, 0.3 + aa, e);
    float bevel = clamp((c.y - c.x) / max(e, 1e-3), -1.0, 1.0) * 0.13;
    float shade = mix(1.0 + bevel, 1.05, inner) * (1.0 - seam * 0.32);
    // Each stud a shade lighter or darker than the next, so a cliff isn't one flat colour.
    float tint = 0.92 + 0.15 * toyHash(floor(p));
    return mix(shade * tint, 0.95, smoothstep(0.2, 0.5, aa));
  }

  // Big floor tile: thin seams and a faint checker.
  float toyFloor(vec2 p, vec2 w) {
    float aa = max(max(w.x, w.y), 1e-4);
    vec2 f = abs(fract(p) - 0.5);
    float seam = smoothstep(0.475 - aa, 0.475 + aa, max(f.x, f.y));
    vec2 cell = floor(p);
    float check = mod(cell.x + cell.y, 2.0) * 0.045;
    return mix(1.0 + check - seam * 0.2, 0.99, smoothstep(0.25, 0.6, aa));
  }

  vec3 toyHue(float h) {
    return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  }
`

const fragmentBody = /* glsl */ `
  {
    vec3 n = normalize(vToyNormal);
    vec3 an = abs(n);
    bool isTop = n.y > 0.5;
    // Planar projection along the dominant axis keeps studs square on every face.
    vec2 suv = an.y > 0.5 ? vToyPos.xz : (an.x > 0.5 ? vToyPos.zy : vToyPos.xy);
    vec2 sp = suv * uStudScale;
    // Screen-space widths, once, before any branching (see toyTile).
    vec2 suvW = fwidth(suv);
    vec2 spW = suvW * uStudScale;
    float yW = fwidth(vToyPos.y);
    float xW = fwidth(vToyPos.x);
    vec3 col = diffuseColor.rgb;
    float style = vToyStyle + 0.5;

    if (style < 1.0) {
      col *= toyTile(sp, spW);
    } else if (style < 2.0) {
      // Grass cap plus a lip a little way down the sides; tan dirt below.
      bool lip = (vToyTop - vToyPos.y) < 0.45;
      if (isTop || lip) col = uGrass * (isTop ? 1.0 : 0.88);
      col *= toyTile(sp, spW);
    } else if (style < 3.0) {
      if (!isTop) {
        vec2 cell = vec2(suv.x / 2.2, (vToyPos.y - 0.6) / 2.6);
        vec2 f = fract(cell);
        float win = step(0.18, f.x) * step(f.x, 0.82) * step(0.22, f.y) * step(f.y, 0.86);
        float frame = step(0.12, f.x) * step(f.x, 0.88) * step(0.16, f.y) * step(f.y, 0.92);
        float lowest = step(0.0, vToyPos.y - 0.6);
        col = mix(col, vec3(0.97), frame * lowest);
        col = mix(col, vec3(0.42, 0.78, 1.0) * (0.9 + 0.2 * f.y), win * lowest);
      }
      col *= toyTile(sp * 0.5, spW * 0.5);
    } else if (style < 4.0) {
      col *= toyPlate(suv * 0.9, suvW * 0.9);
    } else if (style < 5.0) {
      // Smooth: no pattern.
    } else if (style < 6.0) {
      totalEmissiveRadiance += col * 0.75;
    } else if (style < 7.0) {
      float band = step(0.5, fract(vToyPos.y * 0.5));
      col = mix(col, vec3(1.0), band);
      col *= toyTile(sp, spW);
    } else if (style < 8.0) {
      vec2 cell = floor(suv * 0.8);
      vec2 f = fract(suv * 0.8) - 0.5;
      float crack = 1.0 - smoothstep(0.03, 0.09, min(abs(f.x), abs(f.y)) + toyHash(cell) * 0.04);
      // The instance colour is the glow; the crust is a dark, mottled version of it.
      vec3 crust = col * (0.16 + 0.12 * toyHash(cell));
      vec3 glow = min(col * 1.2, vec3(1.0));
      col = mix(crust, glow, crack);
      totalEmissiveRadiance += glow * crack * 0.9;
    } else if (style < 9.0) {
      vec3 rainbow = toyHue(fract((vToyPos.x + vToyPos.z + vToyPos.y) * 0.04));
      col = mix(rainbow, vec3(1.0), 0.25);
      col *= toyTile(sp, spW);
      totalEmissiveRadiance += col * 0.35;
    } else if (style < 10.0) {
      vec2 cell = floor(suv * 1.5);
      float star = step(0.93, toyHash(cell));
      vec2 f = fract(suv * 1.5) - 0.5;
      star *= 1.0 - smoothstep(0.05, 0.15, length(f));
      col = mix(col, vec3(1.0), star);
      totalEmissiveRadiance += col * 0.35 + star * 0.6;
    } else if (style < 11.0) {
      col *= 0.94 + 0.06 * toyHash(floor(suv * 3.0));
    } else if (style < 12.0) {
      // Water: streaks falling down the sides, ripples on top.
      float lane = floor(suv.x * 2.0);
      float fall = fract(vToyPos.y * 0.35 + uTime * (1.2 + toyHash(vec2(lane, 1.0)) * 0.6) + toyHash(vec2(lane, 7.0)));
      float streak = isTop ? 0.5 + 0.5 * sin(vToyPos.x * 2.0 + vToyPos.z * 1.3 + uTime * 3.0) : smoothstep(0.7, 1.0, fall);
      col = mix(col, vec3(0.92, 0.98, 1.0), streak * 0.65);
      totalEmissiveRadiance += col * 0.25;
    } else if (style < 13.0) {
      if (isTop) {
        // Belt: ribs running east under the runner's feet.
        float rib = smoothstep(0.72, 0.86, fract(vToyPos.x * 1.6 - uTime * 2.4));
        col = mix(col, col * 2.4 + vec3(0.07), rib * 0.8 * (1.0 - smoothstep(0.15, 0.4, xW)));
      }
    } else if (style < 14.0) {
      col *= toyBlock(suv * 0.62, suvW * 0.62);
      // A band of light along the top edge of each block.
      if (!isTop && vToyDepth < 0.14) col *= 1.16;
    } else if (style < 15.0) {
      if (isTop || vToyDepth < 0.55) col = uGrass * (isTop ? 1.0 : 0.86);
      col *= toyBlock(suv * 0.62, suvW * 0.62);
    } else if (style < 16.0) {
      col *= toyFloor(suv / 2.25, suvW / 2.25);
    } else if (style < 17.0) {
      // Bricks: running bond, a paler mortar between them, each brick its own shade.
      if (!isTop) {
        vec2 bp = vec2(suv.x / 0.95, vToyPos.y / 0.42);
        bp.x += mod(floor(bp.y), 2.0) * 0.5;
        float aa = max(max(suvW.x / 0.95, yW / 0.42), 1e-4);
        vec2 f = fract(bp);
        float mortar = max(1.0 - smoothstep(0.08, 0.08 + aa, f.y), 1.0 - smoothstep(0.04, 0.04 + aa, f.x));
        vec3 brick = col * (0.86 + 0.24 * toyHash(floor(bp)));
        vec3 bricked = mix(brick, col * 0.45 + vec3(0.32), mortar);
        col = mix(bricked, col * 0.95, smoothstep(0.25, 0.6, aa));
      } else {
        col *= toyTile(sp * 0.5, spW * 0.5);
      }
    } else if (style < 18.0) {
      float stripe = step(0.5, fract((suv.x + suv.y + (isTop ? 0.0 : vToyPos.y)) * 0.9));
      col = mix(col, vec3(0.07), stripe);
    } else if (style < 19.0) {
      // Bulbs a third of a metre apart; a bright pulse every four metres racing towards -z.
      float s = vToyPos.x + vToyPos.z;
      float bulb = 1.0 - smoothstep(0.25, 0.4, abs(fract(s * 3.0) - 0.5) * 2.0);
      float pulse = smoothstep(0.55, 1.0, fract(s * 0.25 + uTime * 1.8));
      float bright = 0.3 + 0.7 * pulse;
      col = col * mix(0.45, 1.0, bulb) * (0.55 + 0.45 * bright);
      totalEmissiveRadiance += col * bright * (0.5 + 0.5 * bulb);
    } else if (style < 20.0) {
      // Windows: two metres a bay, a storey every 2.4 m from 0.8 up; about a third lit.
      if (!isTop) {
        vec2 cell = vec2(suv.x / 2.0, (vToyPos.y - 0.8) / 2.4);
        vec2 f = fract(cell);
        float far = smoothstep(0.15, 0.4, max(suvW.x / 2.0, yW / 2.4));
        float win = step(0.2, f.x) * step(f.x, 0.8) * step(0.22, f.y) * step(f.y, 0.86) * step(0.0, vToyPos.y - 0.8);
        float lit = step(0.64, toyHash(floor(cell) + floor(vToyPos.xz / 40.0)));
        vec3 glass = mix(vec3(0.16, 0.2, 0.36), vec3(0.42, 0.5, 0.78), f.y);
        vec3 warm = vec3(1.0, 0.82, 0.48);
        vec3 pane = mix(glass, warm, lit);
        col = mix(col, mix(pane, mix(col, warm, 0.25), far), win * (1.0 - far * 0.6));
        totalEmissiveRadiance += warm * lit * win * 0.7 * (1.0 - far * 0.5);
      }
      col *= toyTile(sp * 0.5, spW * 0.5);
    } else if (style < 21.0) {
      vec2 cell = floor(suv);
      float check = mod(cell.x + cell.y, 2.0);
      col = mix(col, vec3(0.09), check * (1.0 - smoothstep(0.3, 0.7, max(suvW.x, suvW.y)) * 0.5));
    } else {
      float on = step(0.55, fract(uTime * 0.7 + toyHash(floor(vToyPos.xz * 0.5))));
      col *= 0.35 + 0.65 * on;
      totalEmissiveRadiance += col * on * 1.2;
    }

    diffuseColor.rgb = col;
  }
`

/**
 * One material per variant (instanced or vertex-coloured), shared by every mesh of that
 * kind. Program code is identical across all toy materials, so three compiles it once
 * per variant no matter how many there are.
 *
 * @param {{ instanced?: boolean, vertexColors?: boolean, map?: import('three').Texture,
 *           studScale?: number }} [options]
 *   `studScale` is studs per world unit. Non-instanced meshes default to vertex colours.
 */
export function createToyMaterial({
  instanced = true,
  vertexColors = !instanced,
  map = null,
  studScale = 2,
} = {}) {
  const material = new MeshLambertMaterial({ color: 0xffffff, vertexColors, map })

  // Meshes without an aAnim attribute read it as still, not as whatever another program
  // left in that attribute slot.
  material.defaultAttributeValues = { ...(material.defaultAttributeValues ?? {}), aAnim: [0, 0] }
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uStudScale = { value: studScale }
    shader.uniforms.uTime = toyTime
    shader.uniforms.uCheer = toyCheer
    shader.uniforms.uBreathe = toyBreathe
    shader.uniforms.uGrass = { value: GRASS_COLOR }
    material.userData.shader = shader

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${vertexHead}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${vertexAnim}`)
      .replace('#include <project_vertex>', `#include <project_vertex>\n${vertexBody}`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${fragmentHead}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${fragmentBody}`)
  }
  // The stud scale is a uniform, so materials differing only in it share a program.
  material.customProgramCacheKey = () => 'toy-v6'
  return material
}

/**
 * The one shared toy material: instanced, with vertex colours and instance colours.
 * Everything toy-styled - blocks, props, pets, arrows, trophies, other players,
 * confetti - is drawn as instances through it, so it compiles to a single shader
 * program however many systems use it. (Only the ground, which needs a texture map,
 * has its own variant.)
 *
 * Created lazily; `blocks` and `props` are the same material under the names the
 * systems know it by.
 */
let shared = null
export function sharedMaterials() {
  if (!shared) {
    const toy = createToyMaterial({ instanced: true, vertexColors: true, studScale: 2 })
    shared = { toy, blocks: toy, props: toy }
  }
  return shared
}
