import cors from 'cors'
import express from 'express'
import { defineRoom, defineServer } from '@colyseus/core'
import { WebSocketTransport } from '@colyseus/ws-transport'

import { flushScores, hostedOrigins, installRoomReporter, installScoreReporter, verifyPlayerToken } from './boxity.js'
import { closeStorage, openStorage } from './db.js'
import { startLeaderboards } from './leaderboards.js'
import { activePlayers, liveRooms } from './registry.js'
import { GameRoom } from './rooms/GameRoom.js'

// Bloxity Legion injects PORT (HTTP and WebSocket share it); 2567 is Colyseus's usual.
const PORT = Number(process.env.PORT || 2567)

/**
 * Browser origins allowed to call /api: Legion's CLIENT_ORIGIN (the game's site), the
 * game's Boxity-hosted pages in the environment we were told, extra ones from
 * CLIENT_ORIGINS, and Vite dev servers.
 */
const ALLOWED_ORIGINS = [
  process.env.CLIENT_ORIGIN,
  ...hostedOrigins(),
  ...(process.env.CLIENT_ORIGINS || '').split(',').map((s) => s.trim()),
  ...(process.env.NODE_ENV === 'production' ? [] : ['http://localhost:5173', 'http://localhost:5180', 'http://127.0.0.1:5180']),
].filter(Boolean)

/** HTTP endpoints next to the Colyseus matchmaker on the same port. */
function routes(app) {
  // Legion's readiness and liveness probes. Answers at once, whatever else is going on.
  app.get('/health', (_req, res) => {
    res.json({ ok: true })
  })

  app.use('/api', cors({ origin: ALLOWED_ORIGINS, credentials: true }))
  app.use('/api', express.json())

  app.get('/api/health', (_req, res) => {
    // `game` lets a development client tell this server from another project's.
    res.json({ ok: true, game: 'belly-buster', players: activePlayers.size })
  })

  /**
   * For `Legion.SDK.auth.authenticateWithServer('/api/legion-auth')`: the frontend POSTs
   * `{ token, user }`, and only what Boxity says about the token counts - never the
   * `user` it sent along.
   */
  app.post('/api/legion-auth', async (req, res) => {
    const verified = await verifyPlayerToken(req.body?.token)
    if (!verified) return res.status(401).json({ error: 'invalid token' })
    res.json({ user: { legionId: String(verified.user._id), username: verified.user.username } })
  })
}

await openStorage()

const server = defineServer({
  transport: new WebSocketTransport(),
  rooms: {
    game: defineRoom(GameRoom).enableRealtimeListing(),
  },
  express: routes,
  greet: false,
})

// SIGTERM (a deploy or scale-in) runs Colyseus' graceful shutdown: every room saves
// and hands its players to another pod (GameRoom.onBeforeShutdown), then this.
server.onShutdown(async () => {
  for (const room of liveRooms) room.collectScores()
  await flushScores()
  await closeStorage()
})

await server.listen(PORT)
startLeaderboards()
// Boxity: this pod's rooms for "Open Rooms" and join-by-id, and the leaderboard scores.
// Both do nothing outside a Boxity deployment.
installRoomReporter()
installScoreReporter(() => {
  for (const room of liveRooms) room.collectScores()
})
console.log(`[server] listening on port ${PORT}${process.env.POD_NAME ? ` (${process.env.POD_NAME}, ${process.env.BLOXITY_CHANNEL})` : ''}`)
