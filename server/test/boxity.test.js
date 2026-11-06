import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'

import { BOXITY_BOARDS } from '../../shared/balance.js'
import { createProfile, TRACKS } from '../../shared/logic.js'
import { PlayerSession } from '../../shared/session.js'
import { PUSH_ZONE } from '../../shared/world.js'
import { isGuestId, legionId, noteScores } from '../src/boxity.js'
import { adoptGuestProgress, closeStorage, loadProfile, openStorage, saveProfile } from '../src/db.js'

before(() => openStorage({ mongoUri: '', path: ':memory:' }))
after(() => closeStorage())

test('Boxity report ids: legion_<id>, no mode suffix; our own guests are never reported', () => {
  assert.equal(legionId('abc123'), 'legion_abc123')
  assert.equal(legionId('legion_abc123'), 'legion_abc123')
  assert.equal(legionId('abc123#m2'), 'legion_abc123')
  assert.equal(isGuestId('guest-1f2e'), true)
  assert.equal(isGuestId('abc123'), false)
  // A guest's scores are dropped before they're even queued.
  noteScores('guest-1f2e', createProfile('guest-1f2e', 'G'), 50)
})

test('the leaderboards are declared as Boxity takes them', () => {
  const ids = BOXITY_BOARDS.map((b) => b.id)
  assert.deepEqual(ids, ['fat', 'rebirths', 'coins'])
  for (const board of BOXITY_BOARDS) {
    assert.match(board.id, /^[a-z0-9_-]{1,32}$/)
    assert.ok(['best', 'sum', 'latest'].includes(board.mode))
    assert.ok(['number', 'compact', 'time'].includes(board.format))
    assert.ok(['none', 'daily', 'weekly', 'monthly'].includes(board.reset))
  }
})

test('a guest who signs in brings their progress to a new account - once', async () => {
  const guest = await loadProfile('boxity-guest-1', 'Guest', 'pod:a')
  guest.coins = 500
  guest.rebirths = 2
  await saveProfile(guest, 'pod:a')

  assert.equal(await adoptGuestProgress('account-1', ['boxity-guest-1']), 'boxity-guest-1')
  const account = await loadProfile('account-1', 'Player', 'pod:b')
  assert.equal(account.id, 'account-1')
  assert.equal(account.coins, 500)
  assert.equal(account.rebirths, 2)

  // That guest save can never go to a second account...
  assert.equal(await adoptGuestProgress('account-2', ['boxity-guest-1']), null)
  // ...and an account that already has progress keeps its own.
  const other = await loadProfile('boxity-guest-2', 'Guest', 'pod:a')
  other.coins = 9
  await saveProfile(other, 'pod:a')
  assert.equal(await adoptGuestProgress('account-1', ['boxity-guest-2']), null)
  assert.equal((await loadProfile('account-1', 'Player', 'pod:b')).coins, 500)
})

test('Coins earned running are counted for the Most Coins board', () => {
  const p = createProfile('a', 'A')
  p.fat = 30
  const at = { x: 0, y: 0, z: (PUSH_ZONE.minZ + PUSH_ZONE.maxZ) / 2 }
  const s = new PlayerSession(p, { now: 0, emit: () => {}, getPosition: () => at })
  const track = TRACKS[0]
  s.handle('startPush', {}, 0)
  s.handle('pushAt', { meter: track.stageTop(0), x: 0 }, 4000)
  const tape = track.tapes[0]
  assert.equal(p.coins, tape.coins)
  assert.equal(s.coinsEarned, tape.coins)
})
