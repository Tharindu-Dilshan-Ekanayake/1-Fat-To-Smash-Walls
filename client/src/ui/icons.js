/**
 * The game's icon set, hand-drawn as SVG: glossy cartoon style with thick dark outlines,
 * matching the reference HUD. Strings rather than components so the same art feeds
 * both the DOM HUD (<img src>) and the canvas-drawn 3D world labels.
 *
 * Every icon uses a 100x100 viewBox. Gradient ids are prefixed per icon so icons can
 * be inlined side by side without clashing.
 */

import rebirthImage from '../assets/rebirth.webp'

const OUT = '#1b1b1f'

/** Icons that are artwork rather than drawn SVG, by name. */
const IMAGE_ICONS = {
  // The game's own rebirth art: pink and ice-blue chasing arrows (150 px, 5 KB).
  rebirth: rebirthImage,
}

const svg = (body, defs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs>${defs}</defs>${body}</svg>`

const vgrad = (id, stops) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${stops
    .map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`)
    .join('')}</linearGradient>`

const GOLD = [
  [0, '#fff6a3'],
  [0.45, '#ffcf2e'],
  [1, '#f08c00'],
]

const trophy = svg(
  `<g stroke="${OUT}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round">
    <path d="M27 24H11c0 19 9 28 22 30" fill="none" stroke-width="13"/>
    <path d="M73 24h16c0 19-9 28-22 30" fill="none" stroke-width="13"/>
  </g>
  <g fill="none" stroke="url(#tr-g)" stroke-width="5" stroke-linecap="round">
    <path d="M27 24H11c0 19 9 28 22 30"/><path d="M73 24h16c0 19-9 28-22 30"/>
  </g>
  <g stroke="${OUT}" stroke-width="5" stroke-linejoin="round" fill="url(#tr-g)">
    <path d="M42 62h16l3 15H39z"/>
    <rect x="27" y="76" width="46" height="15" rx="5"/>
    <path d="M22 12h56v22c0 19-12 30-28 30S22 53 22 34z"/>
  </g>
  <path d="M50 21l4.6 9.4 10.4 1.5-7.5 7.3 1.8 10.3L50 44.6l-9.3 4.9 1.8-10.3-7.5-7.3 10.4-1.5z" fill="#fffbd1" stroke="#d98900" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="M30 18v16c0 8 3 14 8 18" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" opacity=".75"/>`,
  vgrad('tr-g', GOLD),
)

/**
 * A chicken drumstick standing on its bone (tilt it with a transform): meat in `meat`,
 * bone in `bone`, outlines `sw` wide. `detail` adds the crispy spots and the shine.
 */
function drumstick(meat, bone, sw, detail = true) {
  const boneShape = '<circle cx="41" cy="86" r="8.5"/><circle cx="59" cy="86" r="8.5"/><rect x="43" y="60" width="14" height="26" rx="3"/>'
  return `<g fill="${OUT}" stroke="${OUT}" stroke-width="${sw * 2}" stroke-linejoin="round">${boneShape}</g>
    <g fill="${bone}">${boneShape}</g>
    <path d="M36 70C26 60 21 48 23 35 25 19 37 9 50 9s25 10 27 26c2 13-3 25-13 35-4 3-24 3-28 0z" fill="${meat}" stroke="${OUT}" stroke-width="${sw}" stroke-linejoin="round"/>
    ${
      detail
        ? `<g fill="#a64d14" opacity=".45"><ellipse cx="40" cy="31" rx="4.5" ry="3"/><ellipse cx="61" cy="45" rx="5" ry="3.5"/><circle cx="47" cy="56" r="3"/><circle cx="64" cy="26" r="2.5"/></g>
    <path d="M31 40c0-12 7-21 17-24" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".7"/>`
        : ''
    }`
}

/** Fat: a juicy, golden-brown chicken drumstick, tilted. */
const fat = svg(
  `<g transform="translate(3 -3) rotate(40 50 50)">${drumstick('url(#dr-m)', 'url(#dr-b)', 6)}</g>`,
  vgrad('dr-m', [
    [0, '#ffd47a'],
    [0.5, '#f0962e'],
    [1, '#b45a1a'],
  ]) +
    vgrad('dr-b', [
      [0, '#ffffff'],
      [1, '#e6d8c0'],
    ]),
)

const pets = svg(
  `<path d="M17 40L22 8l24 22zM83 40L78 8 54 30z" fill="url(#pt-o)" stroke="${OUT}" stroke-width="5.5" stroke-linejoin="round"/>
  <path d="M24 34l2-15 11 10zM76 34l-2-15-11 10z" fill="#ffc2c9"/>
  <rect x="10" y="24" width="80" height="68" rx="18" fill="url(#pt-o)" stroke="${OUT}" stroke-width="6"/>
  <path d="M38 26l3 10M50 25v11M62 26l-3 10" stroke="#c94a00" stroke-width="5" stroke-linecap="round"/>
  <ellipse cx="50" cy="74" rx="22" ry="14" fill="#fff4e6" stroke="${OUT}" stroke-width="4"/>
  <ellipse cx="33" cy="55" rx="8" ry="10" fill="${OUT}"/><ellipse cx="67" cy="55" rx="8" ry="10" fill="${OUT}"/>
  <circle cx="30" cy="51" r="3.4" fill="#fff"/><circle cx="64" cy="51" r="3.4" fill="#fff"/>
  <path d="M45 66h10l-5 5z" fill="#ff6f8f" stroke="${OUT}" stroke-width="3" stroke-linejoin="round"/>
  <path d="M42 76c4 4 12 4 16 0" fill="none" stroke="${OUT}" stroke-width="3.5" stroke-linecap="round"/>
  <path d="M46 78c0 9 8 9 8 0" fill="#ff5f84" stroke="${OUT}" stroke-width="3"/>
  <path d="M18 44c1-9 6-14 14-16" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" opacity=".55"/>`,
  vgrad('pt-o', [
    [0, '#ffb14a'],
    [1, '#ff7414'],
  ]),
)

const items = svg(
  `<path d="M34 22c0-14 32-14 32 0" fill="none" stroke="${OUT}" stroke-width="13" stroke-linecap="round"/>
  <path d="M34 22c0-14 32-14 32 0" fill="none" stroke="#c4192c" stroke-width="5" stroke-linecap="round"/>
  <rect x="14" y="20" width="72" height="72" rx="20" fill="url(#it-r)" stroke="${OUT}" stroke-width="6"/>
  <rect x="26" y="52" width="48" height="32" rx="9" fill="url(#it-p)" stroke="${OUT}" stroke-width="5"/>
  <path d="M26 64h48" stroke="${OUT}" stroke-width="4"/>
  <rect x="40" y="30" width="20" height="16" rx="3" fill="#fff" stroke="${OUT}" stroke-width="4"/>
  <path d="M44 34v8l6-5 6 5v-8" fill="none" stroke="#e0213b" stroke-width="3" stroke-linejoin="round"/>
  <path d="M22 40c0-8 4-12 10-13" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" opacity=".55"/>`,
  vgrad('it-r', [
    [0, '#ff6b62'],
    [1, '#d6182b'],
  ]) +
    vgrad('it-p', [
      [0, '#ff8a80'],
      [1, '#e42a3b'],
    ]),
)

const store = svg(
  `<path d="M26 44c0-34 48-34 48 0" fill="none" stroke="${OUT}" stroke-width="14" stroke-linecap="round"/>
  <path d="M26 44c0-34 48-34 48 0" fill="none" stroke="#5fc4ff" stroke-width="6" stroke-linecap="round"/>
  <path d="M8 40h84l-9 48c-1 4-4 6-8 6H25c-4 0-7-2-8-6z" fill="url(#st-y)" stroke="${OUT}" stroke-width="6" stroke-linejoin="round"/>
  <rect x="5" y="36" width="90" height="13" rx="6" fill="#ffe46b" stroke="${OUT}" stroke-width="5"/>
  <path d="M30 58v26M43 58v26M57 58v26M70 58v26" stroke="#d18a00" stroke-width="5" stroke-linecap="round"/>
  <path d="M18 66h64" stroke="#d18a00" stroke-width="4" stroke-linecap="round"/>`,
  vgrad('st-y', [
    [0, '#ffe25a'],
    [1, '#ffa412'],
  ]),
)

const calendar = svg(
  `<rect x="10" y="16" width="80" height="76" rx="12" fill="#ffffff" stroke="${OUT}" stroke-width="6"/>
  <path d="M10 28c0-7 5-12 12-12h56c7 0 12 5 12 12v12H10z" fill="url(#cl-r)" stroke="${OUT}" stroke-width="6" stroke-linejoin="round"/>
  <rect x="26" y="6" width="9" height="20" rx="4" fill="#cfd8e3" stroke="${OUT}" stroke-width="4"/>
  <rect x="65" y="6" width="9" height="20" rx="4" fill="#cfd8e3" stroke="${OUT}" stroke-width="4"/>
  <g fill="#ff9a1f"><rect x="22" y="50" width="12" height="10" rx="2"/><rect x="44" y="50" width="12" height="10" rx="2"/><rect x="66" y="50" width="12" height="10" rx="2"/><rect x="22" y="68" width="12" height="10" rx="2"/><rect x="44" y="68" width="12" height="10" rx="2" fill="#2fd14a"/><rect x="66" y="68" width="12" height="10" rx="2"/></g>`,
  vgrad('cl-r', [
    [0, '#ff6b6b'],
    [1, '#d91c3a'],
  ]),
)

const star = svg(
  `<path d="M50 8l12 25 27 4-20 19 5 27-24-13-24 13 5-27-20-19 27-4z" fill="#ffffff" stroke="${OUT}" stroke-width="6" stroke-linejoin="round"/>`,
)

/** Food: a big burger - sesame bun, lettuce, a slice of cheese and a juicy patty. */
const food = svg(
  `<path d="M12 73h76v5c0 8-6 14-14 14H26c-8 0-14-6-14-14z" fill="url(#bg-b)" stroke="${OUT}" stroke-width="6" stroke-linejoin="round"/>
  <rect x="8" y="56" width="84" height="20" rx="10" fill="url(#bg-p)" stroke="${OUT}" stroke-width="6"/>
  <path d="M18 70h10M44 71h12M74 70h8" stroke="#c27a48" stroke-width="3" stroke-linecap="round" opacity=".7"/>
  <path d="M8 50h84l-6 10-10-3-8 12-8-12H42l-8 10-8-10-12 2z" fill="#ffd21f" stroke="${OUT}" stroke-width="5" stroke-linejoin="round"/>
  <path d="M6 42h88v10q-5.5 10-11 0q-5.5 10-11 0q-5.5 10-11 0q-5.5 10-11 0q-5.5 10-11 0q-5.5 10-11 0q-5.5 10-11 0q-5.5 10-11 0z" fill="url(#bg-l)" stroke="${OUT}" stroke-width="5" stroke-linejoin="round"/>
  <path d="M8 42C8 20 26 6 50 6s42 14 42 36q0 4-4 4H12q-4 0-4-4z" fill="url(#bg-t)" stroke="${OUT}" stroke-width="6" stroke-linejoin="round"/>
  <g fill="#fff7de" stroke="#c98a3a" stroke-width="1.5">
    <ellipse cx="34" cy="24" rx="3.6" ry="2.2" transform="rotate(-30 34 24)"/><ellipse cx="50" cy="16" rx="3.6" ry="2.2"/>
    <ellipse cx="66" cy="24" rx="3.6" ry="2.2" transform="rotate(30 66 24)"/><ellipse cx="42" cy="34" rx="3.6" ry="2.2" transform="rotate(-15 42 34)"/>
    <ellipse cx="60" cy="35" rx="3.6" ry="2.2" transform="rotate(20 60 35)"/><ellipse cx="76" cy="35" rx="3.6" ry="2.2" transform="rotate(40 76 35)"/>
    <ellipse cx="24" cy="35" rx="3.6" ry="2.2" transform="rotate(-40 24 35)"/>
  </g>
  <path d="M17 33c3-11 11-19 21-22" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".7"/>`,
  vgrad('bg-t', [
    [0, '#ffdb8c'],
    [0.55, '#f5a63c'],
    [1, '#d4781e'],
  ]) +
    vgrad('bg-b', [
      [0, '#f7b552'],
      [1, '#c86a1a'],
    ]) +
    vgrad('bg-p', [
      [0, '#9c5428'],
      [1, '#4e240e'],
    ]) +
    vgrad('bg-l', [
      [0, '#9cf26a'],
      [1, '#3cb82e'],
    ]),
)

/** The currency: a glossy gold coin, its edge showing underneath, a star stamped on it. */
const coin = svg(
  `<ellipse cx="50" cy="55" rx="41" ry="39" fill="#c46a00" stroke="${OUT}" stroke-width="6"/>
  <circle cx="50" cy="47" r="40" fill="url(#cn-g)" stroke="${OUT}" stroke-width="6"/>
  <circle cx="50" cy="47" r="28" fill="url(#cn-i)" stroke="#d98200" stroke-width="4"/>
  <path d="M50 31l4.1 10.3 11.1.8-8.5 7.1 2.7 10.7L50 54l-9.4 5.9 2.7-10.7-8.5-7.1 11.1-.8z" fill="#fff3a0" stroke="#d98200" stroke-width="3" stroke-linejoin="round"/>
  <path d="M18 35A34 34 0 0 1 38 15" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".85"/>`,
  vgrad('cn-g', GOLD) +
    vgrad('cn-i', [
      [0, '#ffb300'],
      [1, '#ffe56a'],
    ]),
)

/** The ribbon of a finish tape, red and white stripes in a wave: what a roll smashes through. */
const TAPE_RIBBON = 'M4 38C28 22 52 56 96 32l-6 14 6 14C52 82 28 48 4 64l6-13z'
const tape = svg(
  `<path d="${TAPE_RIBBON}" fill="url(#tp-s)"/>
  <path d="${TAPE_RIBBON}" fill="url(#tp-sh)"/>
  <path d="M12 39c10-3 24 2 34 6s18 3 26 0" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".6"/>
  <path d="${TAPE_RIBBON}" fill="none" stroke="${OUT}" stroke-width="6" stroke-linejoin="round"/>`,
  `<pattern id="tp-s" width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="18" height="18" fill="#ffffff"/><rect width="9" height="18" fill="#ff2a3d"/></pattern>` +
    `<linearGradient id="tp-sh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></linearGradient>`,
)

/** A red gift box tied with a yellow ribbon and bow. */
const gift = svg(
  `<path d="M50 30c-6-14-26-18-26-6 0 8 14 8 26 6zM50 30c6-14 26-18 26-6 0 8-14 8-26 6z" fill="#ffd23a" stroke="${OUT}" stroke-width="5" stroke-linejoin="round"/>
  <rect x="14" y="44" width="72" height="44" rx="6" fill="url(#gf-r)" stroke="${OUT}" stroke-width="6"/>
  <rect x="9" y="30" width="82" height="18" rx="5" fill="url(#gf-r)" stroke="${OUT}" stroke-width="6"/>
  <rect x="43" y="30" width="14" height="58" fill="#ffd23a" stroke="${OUT}" stroke-width="5"/>
  <path d="M20 40h20M20 54v24" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".55"/>`,
  vgrad('gf-r', [
    [0, '#ff6b62'],
    [1, '#d6182b'],
  ]),
)

/** A settings gear. */
const gear = svg(
  `<path d="M43 8h14l3 12 8 4 11-6 10 10-6 11 4 8 12 3v14l-12 3-4 8 6 11-10 10-11-6-8 4-3 12H43l-3-12-8-4-11 6-10-10 6-11-4-8-12-3V43l12-3 4-8-6-11 10-10 11 6 8-4z" fill="url(#ge-g)" stroke="${OUT}" stroke-width="6" stroke-linejoin="round"/>
  <circle cx="50" cy="50" r="13" fill="#2c344d" stroke="${OUT}" stroke-width="5"/>`,
  vgrad('ge-g', [
    [0, '#e3ecf6'],
    [1, '#8fa1b8'],
  ]),
)

/** A little house: back to the lobby. */
const home = svg(
  `<path d="M12 50L50 16l38 34" fill="none" stroke="${OUT}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M12 50L50 16l38 34" fill="none" stroke="#ff5a4a" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M22 46v40h56V46L50 22z" fill="#fff6e0" stroke="${OUT}" stroke-width="6" stroke-linejoin="round"/>
  <rect x="41" y="60" width="18" height="26" rx="3" fill="#b0743c" stroke="${OUT}" stroke-width="5"/>`,
)

/** A round potion flask with a cork, filled with `liquid` and a small badge icon. */
function potion(id, liquid, liquidDark, badge) {
  return svg(
    `<rect x="38" y="6" width="24" height="16" rx="4" fill="#c98a4b" stroke="${OUT}" stroke-width="5"/>
    <path d="M40 22h20v12c16 5 26 18 26 32 0 18-16 30-36 30S14 84 14 66c0-14 10-27 26-32z" fill="#e8f6ff" stroke="${OUT}" stroke-width="6" stroke-linejoin="round"/>
    <path d="M18 64c10-6 22 4 32 0s22-6 32 0c0 16-14 26-32 26S18 80 18 64z" fill="url(#${id}-l)"/>
    <path d="M24 56c2-8 8-14 16-16" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/>
    ${badge}`,
    vgrad(`${id}-l`, [
      [0, liquid],
      [1, liquidDark],
    ]),
  )
}

const potionCoins = potion(
  'pw',
  '#4fd2ff',
  '#1565e0',
  `<ellipse cx="50" cy="75" rx="13" ry="12" fill="#c46a00" stroke="${OUT}" stroke-width="3.5"/>
   <circle cx="50" cy="71" r="12" fill="#ffd23a" stroke="${OUT}" stroke-width="3.5"/>
   <circle cx="50" cy="71" r="6.5" fill="none" stroke="#d98200" stroke-width="2.5"/>`,
)
const potionFat = potion(
  'pm',
  '#ff9ce0',
  '#e0247a',
  `<g transform="translate(50 72) scale(.36) rotate(40) translate(-50 -50)">${drumstick('#f0962e', '#fff8ec', 9.5, false)}</g>`,
)

/** An aura: a glowing ring in its colour round a white symbol. */
export function auraSvg(color, symbol) {
  return svg(
    `<circle cx="50" cy="50" r="42" fill="url(#au-g)" stroke="${OUT}" stroke-width="6"/>
    <circle cx="50" cy="50" r="30" fill="none" stroke="#fff" stroke-width="3" opacity=".6"/>
    <path d="${symbol}" fill="#ffffff" stroke="${OUT}" stroke-width="4" stroke-linejoin="round"/>`,
    `<radialGradient id="au-g"><stop offset="0" stop-color="#ffffff"/><stop offset=".35" stop-color="${color}"/><stop offset="1" stop-color="${color}" stop-opacity=".75"/></radialGradient>`,
  )
}

/** Each aura's symbol: a bolt, a star, a drop, a flame, a heart. */
const AURA_SYMBOLS = {
  lightning: 'M56 18L32 54h14l-6 28 26-38H52z',
  galaxy: 'M50 22l7 16 17 2-13 11 4 17-15-9-15 9 4-17-13-11 17-2z',
  water: 'M50 18c10 16 22 28 22 40a22 22 0 0 1-44 0c0-12 12-24 22-40z',
  fire: 'M52 16c4 14 20 22 20 40a22 22 0 0 1-44 0c0-10 6-16 10-22 2 8 6 12 10 12-4-12 0-22 4-30z',
  rainbow: 'M50 78C30 62 24 52 24 42a13 13 0 0 1 26-4 13 13 0 0 1 26 4c0 10-6 20-26 36z',
}
export const AURA_COLORS = { lightning: '#3fd2ff', galaxy: '#a35cff', water: '#1f8cff', fire: '#ff6a1e', rainbow: '#ff5fc8' }

/** A spotted egg in the given colours. */
export function eggSvg(base, dark, spot) {
  return svg(
    `<path d="M50 6C28 6 12 40 12 62c0 20 17 32 38 32s38-12 38-32C88 40 72 6 50 6z" fill="url(#eg-g)" stroke="${OUT}" stroke-width="6"/>
    <ellipse cx="34" cy="50" rx="7" ry="9" fill="${spot}"/><ellipse cx="62" cy="34" rx="6" ry="7" fill="${spot}"/>
    <ellipse cx="66" cy="68" rx="9" ry="8" fill="${spot}"/><ellipse cx="44" cy="80" rx="5" ry="4" fill="${spot}"/>
    <path d="M26 46c2-14 10-26 18-30" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".7"/>`,
    vgrad('eg-g', [
      [0, base],
      [1, dark],
    ]),
  )
}

const close = svg(
  `<path d="M24 24l52 52M76 24L24 76" stroke="${OUT}" stroke-width="22" stroke-linecap="round"/>
  <path d="M24 24l52 52M76 24L24 76" stroke="#fff" stroke-width="11" stroke-linecap="round"/>`,
)

const arrowDown = svg(
  `<path d="M36 8h28v40h20L50 90 16 48h20z" fill="#ffffff" stroke="${OUT}" stroke-width="6" stroke-linejoin="round"/>`,
)

const check = svg(
  `<path d="M16 52l22 22 46-48" fill="none" stroke="${OUT}" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M16 52l22 22 46-48" fill="none" stroke="#5cf064" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`,
)

const portal = svg(
  `<circle cx="50" cy="50" r="42" fill="url(#po-g)" stroke="${OUT}" stroke-width="6"/>
  <path d="M50 50c0-10 14-10 14 0 0 16-28 16-28 0 0-22 42-22 42 0 0 28-56 28-56 0" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/>`,
  `<radialGradient id="po-g"><stop offset="0" stop-color="#b8f3ff"/><stop offset="1" stop-color="#2f7fe6"/></radialGradient>`,
)

const starGold = svg(
  `<path d="M50 6l13 27 29 4-21 20 5 29-26-14-26 14 5-29L8 37l29-4z" fill="url(#sg-g)" stroke="${OUT}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M38 30l7-13" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".75"/>`,
  vgrad('sg-g', GOLD),
)

const fastForward = svg(
  `<path d="M8 18l40 32-40 32z" fill="url(#ff-g)" stroke="${OUT}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M50 18l40 32-40 32z" fill="url(#ff-g)" stroke="${OUT}" stroke-width="6" stroke-linejoin="round"/>`,
  vgrad('ff-g', [
    [0, '#ffffff'],
    [1, '#9fdcff'],
  ]),
)

const SPEAKER = `<path d="M14 38h16l22-18v60L30 62H14z" fill="url(#sp-g)" stroke="${OUT}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M20 44h8" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".7"/>`
const SPEAKER_GRADIENT = vgrad('sp-g', [
  [0, '#ffffff'],
  [1, '#c7d3e3'],
])

const sound = svg(
  `${SPEAKER}
  <path d="M62 38c6 7 6 17 0 24M72 30c11 11 11 29 0 40" fill="none" stroke="${OUT}" stroke-width="12" stroke-linecap="round"/>
  <path d="M62 38c6 7 6 17 0 24M72 30c11 11 11 29 0 40" fill="none" stroke="#7fe2ff" stroke-width="5" stroke-linecap="round"/>`,
  SPEAKER_GRADIENT,
)

const soundOff = svg(
  `${SPEAKER}
  <path d="M62 38l22 24M84 38L62 62" stroke="${OUT}" stroke-width="13" stroke-linecap="round"/>
  <path d="M62 38l22 24M84 38L62 62" stroke="#ff5a5a" stroke-width="6" stroke-linecap="round"/>`,
  SPEAKER_GRADIENT,
)

/** A padlock: something not unlocked yet (buy the one before it first). */
const lock = svg(
  `<path d="M32 46V34a18 18 0 0 1 36 0v12" fill="none" stroke="${OUT}" stroke-width="16" stroke-linecap="round"/>
  <path d="M32 46V34a18 18 0 0 1 36 0v12" fill="none" stroke="url(#lk-s)" stroke-width="7" stroke-linecap="round"/>
  <rect x="18" y="44" width="64" height="46" rx="10" fill="url(#lk-g)" stroke="${OUT}" stroke-width="6"/>
  <circle cx="50" cy="63" r="7" fill="${OUT}"/><rect x="46.5" y="64" width="7" height="14" rx="3" fill="${OUT}"/>
  <rect x="26" y="50" width="48" height="7" rx="3.5" fill="#ffffff" opacity="0.45"/>`,
  vgrad('lk-g', GOLD) + vgrad('lk-s', [[0, '#f4f7fb'], [1, '#9aa3ad']]),
)

export const ICON_SVGS = {
  lock,
  sound,
  soundOff,
  starGold,
  fastForward,
  trophy,
  coin,
  fat,
  pets,
  items,
  store,
  calendar,
  star,
  food,
  tape,
  gift,
  gear,
  home,
  potionCoins,
  potionFat,
  close,
  arrowDown,
  check,
  portal,
}

/** Egg colours by egg id, shared by the icons and the 3D eggs. */
export const EGG_COLORS = {
  basic: ['#ffffff', '#cdd6e2', '#e2e8f0'],
  meadow: ['#7cf08a', '#2fae4a', '#c8ffd0'],
  sunset: ['#ffc07a', '#ff6a3d', '#ffe2b8'],
  unicorn: ['#f6eaff', '#d3b4ff', '#ffd1f0'],
  demon: ['#4a1d2e', '#1a0710', '#ff4a1c'],
}

const urlCache = new Map()

/** `data:` URL for an icon name, `egg:<id>` for an egg or `aura:<id>` for an aura. */
export function iconUrl(name) {
  if (IMAGE_ICONS[name]) return IMAGE_ICONS[name]
  let url = urlCache.get(name)
  if (url) return url
  let markup = ICON_SVGS[name]
  if (!markup && name.startsWith('egg:')) {
    const colors = EGG_COLORS[name.slice(4)] || EGG_COLORS.basic
    markup = eggSvg(...colors)
  }
  if (!markup && name.startsWith('aura:')) {
    const id = name.slice(5)
    if (AURA_SYMBOLS[id]) markup = auraSvg(AURA_COLORS[id], AURA_SYMBOLS[id])
  }
  if (!markup) return null
  url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`
  urlCache.set(name, url)
  return url
}
