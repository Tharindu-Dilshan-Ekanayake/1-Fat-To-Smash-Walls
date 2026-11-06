import { Vector3 } from 'three'

import { SPAWN } from '@shared/world'

/**
 * Per-frame mutable state shared between systems.
 *
 * Deliberately outside React and zustand: it changes every frame, nothing should
 * re-render because of it, and every reader lives in a `useFrame` or a timer. UI that
 * needs a slow-changing derivative of it (which zone the player is in, say) gets it
 * from the 10 Hz game ticker, which is the only thing that copies from here into the
 * store.
 */
export const runtime = {
  player: {
    position: new Vector3(SPAWN.x, 0, SPAWN.z),
    /** Facing, radians about +Y. 0 faces south (+Z): at spawn, the Food Street. */
    yaw: SPAWN.yaw,
    speed: 0,
    grounded: true,
    /** The Train Zone whose bench you're sat on, or -1. */
    bench: -1,
    /** When the win dance (back in the lobby after cashing in) started; 0 when not dancing. */
    danceAt: 0,
    /** 'idle' | 'walk' | 'train' (sat on a bench) | 'jump' | 'push' | 'dance' - what other players see. */
    anim: 'idle',
    /** Set when the controller should ignore input (pushing, cutscenes). */
    frozen: false,
    /** performance.now() of the last bite (a click), for the hand to the mouth. */
    ateAt: 0,
    /** performance.now() of the last bite taken at a Food Court table: the belly wobbles. */
    jiggleAt: 0,
    /** How big your character is drawn (fatter is bigger): 1 skinny. */
    drawnSize: 1,
    /** performance.now() of the last happy hop (a purchase, a level up) and rebirth spin; 0 for none. */
    happyAt: 0,
    spinAt: 0,
    /** performance.now() of the last size milestone: the belly puffs up, big and wobbly. */
    puffAt: 0,
    /** The Boxity emote playing: `{ id, at }` (at = performance.now() it started), or null. */
    emote: null,
  },

  /** Touch input, written by the on-screen joystick. -1..1, +y = forward. */
  input: {
    joyX: 0,
    joyY: 0,
    jump: false,
  },

  camera: {
    /** 'follow' orbits the player; 'push' is the chase camera down the track (see FollowCamera). */
    mode: 'follow',
    /** Where round the player it orbits: 0 is south of them. Starts behind you, as you spawn facing the Food Street. */
    yaw: SPAWN.yaw + Math.PI,
    pitch: 0.36,
    distance: 11,
    /** Set to jump the follow camera straight to its target next frame. */
    snap: false,
  },

  /** What the sun's shadow box centres on while the camera is up the track with you. */
  focus: null,

  /**
   * Other players' pets, written by the multiplayer layer: `{ id, position, yaw, hop }`
   * per pet. Drawn by the same instanced pet meshes as yours.
   */
  remotePets: [],

  /** Walls that come and go at runtime, e.g. locked Train Zones. */
  dynamicColliders: [],

  /**
   * Things that get a blob shadow on low presets. Each entry is
   * `{ position: Vector3, size: number, visible?: boolean }`.
   */
  shadowCasters: new Set(),
}

/** Puts the player back at spawn, e.g. after a reconnect into a fresh lobby. */
export function respawn() {
  runtime.player.position.set(SPAWN.x, 0, SPAWN.z)
  runtime.player.yaw = SPAWN.yaw
}
