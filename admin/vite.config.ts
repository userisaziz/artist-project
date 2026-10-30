import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const apiTarget = loadEnv(mode, process.cwd()).VITE_DEV_API_TARGET || 'http://localhost:8000'
  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
    // Dev keeps the API same-origin, exactly like production's vercel.json rewrite: the browser only ever talks to
    // Vite, which forwards /api. The httpOnly `ac_refresh` cookie stays first-party (SameSite=strict) whichever
    // backend the admin is pointed at, and a phone on the Wi-Fi reaches it through this server too.
    server: { proxy: { '/api': { target: apiTarget, changeOrigin: true } } },
    test: { globals: true, environment: 'jsdom', setupFiles: ['./src/test/setup.ts'], css: false },
  }
})
