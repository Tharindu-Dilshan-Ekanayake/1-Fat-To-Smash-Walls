import process from 'node:process'
import { fileURLToPath, URL } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

/**
 * Boxity's local environment (a whole Boxity stack running on this machine), told to the
 * page by the dev server - only with BLOXITY_LOCAL=1, and never in a build: Boxity tells
 * the pages it serves where they are, and a page told nothing uses production.
 */
const BOXITY_LOCAL = {
  env: 'local',
  apiUrl: 'http://localhost:4000',
  playUrl: 'http://localhost:2567',
  portalUrl: 'http://localhost:3000',
  staticUrl: 'https://static.bloxity.io',
}
const boxityLocalEnv = {
  name: 'boxity-local-env',
  apply: 'serve',
  transformIndexHtml: () =>
    process.env.BLOXITY_LOCAL ? [{ tag: 'script', children: `window.BLOXITY_ENV = ${JSON.stringify(BOXITY_LOCAL)}`, injectTo: 'head-prepend' }] : [],
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), boxityLocalEnv],
  resolve: {
    alias: {
      // Game rules and world layout, shared with the server.
      '@shared': fileURLToPath(new URL('../shared', import.meta.url)),
    },
  },
  server: {
    // ../shared lives outside the client root.
    fs: { allow: ['..'] },
  },
  optimizeDeps: {
    // Dev-only perf overlay, imported lazily; pre-bundle it so the first ?perf load
    // doesn't hit a mid-session dependency re-optimisation.
    include: ['r3f-perf'],
  },
})
