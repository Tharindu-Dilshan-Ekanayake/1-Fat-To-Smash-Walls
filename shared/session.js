import {
  EGGS,
  ITEMS,
  BITE_BURST,
  MAX_BITES_PER_SECOND,
  MULTI_HATCH,
  PUSH_START,
  PUSH_TIMEOUT_MS,
  RUN_SPEED_MAX,
  SHOP,
  TRAIN_INTERVAL,
  TRAIN_ZONES,
  WORLD_PORTALS,
} from './balance.js'
import {
  advanceTutorial,
  applyBite,
  applyRebirth,
  applyTrain,
  awardBadge,
  buyFood,
  buyFatPack,
  buyShopItem,
  claimDaily,
  claimFreeReward,
  claimPlaytime,
  createSession,
  deletePet,
  equipAura,
  equipBestPets,
  equipFood,
  equipPet,
  hatchEgg,
  isMaxLevel,
  isZoneUnlocked,
  skipRebirth,
  trackOf,
  TRACKS,
  unequipPet,
  usePotion,
  coinsMultiplier,
  worldUnlocked,
} from './logic.js'
import {
  atFoodCounter,
  eggStandNear,
  FREE_REWARD,
  inPushZone,
  MAX_MOVE_SPEED,
  portalAt,
  TRACK_HALF_WIDTH,
  benchAt,
} from './world.js'

/** A seated player's reported position may wander this far off the bench (lag). */
const SEAT_SLACK = 0.5
/** Same for the push zone. */
const PUSH_SLACK = 1.5
/** Food is bought at the Food Shop's counter; allow for a little lag. */
const COUNTER_SLACK = 2
/** How far to either side of the track a runner may report being. */
const TRACK_X = TRACK_HALF_WIDTH - 1

/**
 * One player's authoritative session: validates intents, runs the Food Court tick and
 * reports what happened through `emit`.
 *
 * Transport-agnostic on purpose. The Colyseus room wraps one of these per client; the
 * offline mode wraps one for the local player. Either way the rules that run are
 * byte-for-byte the same.
 *
 * A roll down the tape track is called a `push` in the protocol (startPush, pushAt,
 * endPush): every tape its Fat is enough for it smashes, and the first one too strong
 * stops it. You keep your Fat.
 *
 * Events emitted (type, payload):
 * - 'profile'    { profile, session }  full state, after anything structural
 * - 'train'      { source, zone, gain, fat, eaten, level, leveledUp, maxed }  each Fat
 *                  gain; `source` is 'bite' (a click) or 'zone' (sat at Food Court
 *                  `zone`). Walking earns nothing.
 * - 'push'       { reach, power, start, x }  a roll's begun: its power (your Fat now) and
 *                  where it's stopped (the first tape too strong for it, or the end)
 * - 'tape'       { stage, coins, top }  a tape smashed, and what it paid
 * - 'pushEnd'    { reason, coins, tapes }  the roll is over, back in the plaza
 *                  ('blocked', 'left', 'top', 'timeout'), with what it earned
 * - 'pack'       { amount }  a Fat pack landed
 * - 'hatch'      { eggId, pets: [{ uid, id }] }  pets to reveal
 * - 'badge'      { id, name }
 *
 * `onPush(run | null)` lets the host show other players where someone is on the track.
 */
export class PlayerSession {
  /**
   * @param {object} profile normalized profile (see logic.normalizeProfile)
   * @param {{ now: number, emit: (type: string, payload?: object) => void,
   *           getPosition: () => {x: number, y: number, z: number},
   *           onPurchase?: (productId: string) => boolean,
   *           onPush?: (push: object | null) => void }} options
   *   `onPurchase` lets the host veto or count a shop sale (stock limits).
   */
  constructor(profile, { now, emit, getPosition, onPurchase, onPush }) {
    this.profile = profile
    this.session = createSession(now)
    this.emit = emit
    this.getPosition = getPosition
    this.onPurchase = onPurchase
    this.onPush = onPush

    /** Food Court the client says it's sat at; verified against position every tick. */
    this.zone = -1
    this.trainTimer = 0
    /**
     * The roll in progress: { phase: 'run', world, stage, startedAt, start, power, reach,
     * meter, x, lastReportAt, tapes, coins }. `power` is the Fat it set off with, `reach`
     * the metre it's stopped at; `tapes` the ones it's been paid for.
     */
    this.push = null
    /** Coins earned rolling (tapes) not yet counted towards a leaderboard. */
    this.coinsEarned = 0
    /** Server time until which a new run can't start (just after one ended). */
    this.busyUntil = 0
    /** Bites banked (a token bucket refilling at MAX_BITES_PER_SECOND), and when last refilled. */
    this.biteTokens = BITE_BURST
    this.biteRefilledAt = now
    this.dirty = false
  }

  // --- Plumbing --------------------------------------------------------------------

  sendProfile() {
    this.dirty = false
    this.emit('profile', { profile: this.profile, session: this.session })
  }

  badge(id) {
    const badge = awardBadge(this.profile, id)
    if (badge) {
      this.dirty = true
      this.emit('badge', badge)
    }
  }

  tutorial(event) {
    if (advanceTutorial(this.profile, event)) this.dirty = true
  }

  // --- Intents ---------------------------------------------------------------------

  /** Dispatches one client message. Unknown types are ignored. */
  handle(type, payload = {}, now) {
    const handler = this.handlers[type]
    if (!handler) return
    handler.call(this, payload || {}, now)
    if (this.dirty) this.sendProfile()
  }

  handlers = {
    enterZone({ zone }) {
      const index = Number(zone)
      if (!Number.isInteger(index) || !TRAIN_ZONES[index]) return
      if (!isZoneUnlocked(this.profile, index)) return
      if (this.zone !== index) {
        this.zone = index
        // The first bite comes a beat after sitting down, not instantly.
        this.trainTimer = TRAIN_INTERVAL * 0.5
      }
    },

    leaveZone() {
      this.zone = -1
    },

    /** One click: a bite of your food, worth more sat at a Food Court. Not mid-run. */
    eat(_payload, now) {
      if (this.push) return
      this.biteTokens = Math.min(BITE_BURST, this.biteTokens + ((now - this.biteRefilledAt) / 1000) * MAX_BITES_PER_SECOND)
      this.biteRefilledAt = now
      if (this.biteTokens < 1) return
      this.biteTokens -= 1
      const zone = this.onClaimedZone() ? this.zone : -1
      this.gain('bite', zone, applyBite(this.profile, zone, now))
      this.tutorial('eat')
    },

    setting({ key, value }) {
      if (key !== 'autoRebirth') return
      this.profile.settings.autoRebirth = Boolean(value)
      this.dirty = true
    },

    rebirth() {
      if (this.push) return
      const result = applyRebirth(this.profile)
      if (result.ok) this.afterRebirth()
    },

    skipRebirth() {
      if (this.push) return
      const result = skipRebirth(this.profile)
      if (result.ok) this.afterRebirth()
    },

    /**
     * Sets off down the tape track from the ROLL ZONE at its top, with all your Fat behind
     * you. No Fat, no roll.
     */
    startPush(_payload, now) {
      if (now < this.busyUntil || this.push) return
      const p = this.getPosition()
      if (!inPushZone(p.x, p.z, PUSH_SLACK)) return
      const power = this.profile.fat
      if (!(power > 0)) return
      const track = trackOf(this.profile)
      const start = PUSH_START
      const reach = Math.round(track.reachOf(power) * 100) / 100
      const x = Math.max(-TRACK_X, Math.min(TRACK_X, p.x))
      this.profile.stats.runs += 1
      this.push = {
        phase: 'run',
        world: track.index,
        stage: 0,
        startedAt: now,
        start,
        power,
        reach,
        meter: start,
        x,
        lastReportAt: now,
        tapes: [],
        coins: 0,
      }
      this.zone = -1
      this.emit('push', { reach, power, start, x })
      this.onPush?.(this.push)
      this.dirty = true
      this.badge('firstRun')
    },

    /**
     * Where the roller has got to - trusted only as far as they could really have got: no
     * further than the first tape too strong for them, nor than rolling flat out since
     * they set off could take them, and never backwards. Every tape at or before that,
     * that their Fat is enough for, is smashed, and pays once.
     */
    pushAt({ meter, x }, now) {
      const run = this.push
      if (!run) return
      const m = Number(meter)
      if (!Number.isFinite(m)) return
      const track = TRACKS[run.world]
      run.x = Math.max(-TRACK_X, Math.min(TRACK_X, Number(x) || 0))
      run.lastReportAt = now
      const allowed = Math.min(run.reach, run.start + ((now - run.startedAt) / 1000) * RUN_SPEED_MAX + 4)
      run.meter = Math.max(run.meter, Math.min(m, allowed))
      run.stage = track.stageAt(run.meter)
      this.onPush?.(run)
      const stats = this.profile.stats
      stats.bestMeter = Math.max(stats.bestMeter, Math.round(run.meter * 10) / 10)

      for (const tape of track.tapes) {
        if (run.tapes.includes(tape.stage) || run.meter < tape.meter - 0.01 || run.power < tape.need - 1e-6) continue
        run.tapes.push(tape.stage)
        const coins = Math.max(1, Math.round(tape.coins * coinsMultiplier(this.profile, now)))
        const top = tape.stage === track.stages.length - 1
        this.profile.coins += coins
        this.coinsEarned += coins
        run.coins += coins
        stats.tapes += 1
        this.dirty = true
        this.emit('tape', { stage: tape.stage, coins, top })
        this.tutorial('tape')
        this.badge('firstTape')
        if (top) {
          stats.tops += 1
          this.badge('top')
        }
      }
    },

    /** The roll is over: stopped by a tape too strong ('blocked'), the end reached ('top'), or given up ('left'). */
    endPush({ reason }, now) {
      if (!this.push) return
      this.finishPush(now, ['blocked', 'left', 'top'].includes(reason) ? reason : 'left')
    },

    buyFood({ id }) {
      if (!this.atCounter()) return
      const result = buyFood(this.profile, id)
      if (!result.ok) return
      this.dirty = true
      if (result.bought) this.tutorial('buyFood')
    },

    equipFood({ id }) {
      const result = equipFood(this.profile, id)
      if (result.ok) this.dirty = true
    },

    equipAura({ id }) {
      if (equipAura(this.profile, id ?? null).ok) this.dirty = true
    },

    buyPack({ index }) {
      const result = buyFatPack(this.profile, Number(index))
      if (!result.ok) return
      this.dirty = true
      this.emit('pack', { amount: result.amount })
    },

    hatch({ eggId, count }) {
      const egg = EGGS[eggId]
      if (!egg) return
      const p = this.getPosition()
      if (eggStandNear(p.x, p.z)?.eggId !== eggId) return
      const n = count === MULTI_HATCH ? MULTI_HATCH : 1
      this.reveal(hatchEgg(this.profile, eggId, n))
    },

    openEggItem({ itemId }) {
      const item = ITEMS[itemId]
      if (!item || item.kind !== 'egg') return
      this.reveal(hatchEgg(this.profile, item.egg, 1, { paid: 'item' }))
    },

    equipPet({ uid }) {
      if (equipPet(this.profile, Number(uid)).ok) this.dirty = true
    },

    unequipPet({ uid }) {
      unequipPet(this.profile, Number(uid))
      this.dirty = true
    },

    equipBest() {
      equipBestPets(this.profile)
      this.dirty = true
    },

    deletePet({ uid }) {
      if (deletePet(this.profile, Number(uid)).ok) this.dirty = true
    },

    claimDaily({ day }, now) {
      const result = claimDaily(this.profile, Number(day), now)
      this.afterReward(result)
    },

    claimPlaytime({ index }, now) {
      const result = claimPlaytime(this.profile, this.session, Number(index), now)
      this.afterReward(result)
    },

    claimFreeReward() {
      const p = this.getPosition()
      if (Math.hypot(p.x - FREE_REWARD.x, p.z - FREE_REWARD.z) > FREE_REWARD.radius + 1.5) return
      const result = claimFreeReward(this.profile, this.session)
      this.afterReward(result)
    },

    /**
     * Stepping through a world portal: to its world (the first time, with its Coins), or,
     * from that world, back to World 1. Not mid-run.
     */
    portal() {
      if (this.push) return
      const p = this.getPosition()
      const portal = portalAt(p.x, p.z, 2)
      if (!portal) return
      const there = WORLD_PORTALS[portal.id].world
      const to = this.profile.world === there ? 0 : there
      if (!worldUnlocked(this.profile, to)) return
      if (to === there) this.badge(portal.id)
      this.profile.world = to
      this.dirty = true
      this.emit('world', { world: to })
    },

    usePotion({ itemId }, now) {
      const result = usePotion(this.profile, itemId, now)
      if (!result.ok) return
      this.dirty = true
    },

    /** Buys a SHOP item with Coins. */
    purchase({ productId }) {
      const item = SHOP[productId]
      if (!item) return
      // Checked before the host takes stock, so a short wallet never uses up a Sphinx.
      if (this.profile.coins < item.price) return
      if (item.kind === 'pass' && this.profile.passes[productId]) return
      if (this.onPurchase && !this.onPurchase(productId)) return
      const result = buyShopItem(this.profile, productId)
      if (!result.ok) return
      this.dirty = true
      this.reveal(result)
    },
  }

  afterReward(result) {
    if (!result?.ok) return
    this.dirty = true
    if (result.pets?.length) this.reveal(result)
  }

  /** Sends newly gained pets to the client's hatch animation. */
  reveal(result) {
    if (!result?.ok || !result.pets?.length) return
    this.dirty = true
    this.emit('hatch', { eggId: result.eggId ?? null, pets: result.pets })
    this.tutorial('hatch')
    this.badge('firstPet')
  }

  afterRebirth() {
    this.dirty = true
    this.tutorial('rebirth')
    if (this.profile.rebirths === 1) this.badge('firstRebirth')
  }

  /** Ends the roll in progress, if any, and tells the client (it may already know). You keep your Fat. */
  finishPush(now, reason) {
    const run = this.push
    if (!run) return
    this.push = null
    this.busyUntil = now + 600
    this.dirty = true
    this.onPush?.(null)
    this.emit('pushEnd', { reason, coins: run.coins, tapes: run.tapes.length })
  }

  // --- Simulation ------------------------------------------------------------------

  /** Whether the player is at (or right by) the Food Shop's counter. */
  atCounter() {
    const p = this.getPosition()
    return atFoodCounter(p.x, p.z, COUNTER_SLACK)
  }

  /** Whether the player is really sat at the table of the Food Court they claim. */
  onClaimedZone() {
    if (this.zone < 0) return false
    const p = this.getPosition()
    return benchAt(p.x, p.z, SEAT_SLACK) === this.zone
  }

  /** Advances Food Court eating and runs. Call at a steady rate (the room's simulation interval). */
  tick(dt, now) {
    if (this.push) {
      if (now - this.push.lastReportAt > PUSH_TIMEOUT_MS) this.finishPush(now, 'timeout')
    } else if (this.zone >= 0 && now >= this.busyUntil && this.onClaimedZone()) {
      this.trainTimer += dt
      while (this.trainTimer >= TRAIN_INTERVAL) {
        this.trainTimer -= TRAIN_INTERVAL
        this.trainOnce(now)
      }
    } else {
      this.trainTimer = Math.min(this.trainTimer, TRAIN_INTERVAL * 0.5)
    }
    this.profile.stats.playtime += dt
    if (this.dirty) this.sendProfile()
  }

  /** Tells the client about a Fat gain from `source` ('bite' or 'zone'). */
  gain(source, zone, result) {
    if (result.gain > 0) {
      this.emit('train', {
        source,
        zone,
        gain: result.gain,
        fat: this.profile.fat,
        eaten: this.profile.eaten,
        level: this.profile.level,
        leveledUp: result.leveledUp,
        maxed: result.maxed,
      })
    }
    if (this.profile.settings.autoRebirth && !this.push && isMaxLevel(this.profile)) {
      const rebirth = applyRebirth(this.profile)
      if (rebirth.ok) this.afterRebirth()
    }
  }

  trainOnce(now) {
    const result = applyTrain(this.profile, this.zone, now)
    if (!result.ok) {
      this.zone = -1
      return
    }
    this.gain('zone', this.zone, result)
    this.tutorial('eat')
  }
}
