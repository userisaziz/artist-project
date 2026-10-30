// Builds the package the design-sync converter consumes (cfg.buildCmd).
// admin/ is an app, not a published library: this compiles .design-sync/web-entry.ts
// (the shared src/components/ui layer) with Vite in library mode, using the app's own
// @tailwindcss/vite plugin so the CSS is the real compiled stylesheet, into
// .design-sync/.cache/web-pkg (dist JS + CSS + fonts + .d.ts).
// react/react-dom stay external - the converter maps them to window.React/ReactDOM.
// Run from admin/: node .design-sync/web-build.mjs
import { execFileSync } from 'node:child_process'
import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { build } from 'vite'

const ROOT = path.resolve('.')
const PKG = path.resolve('.design-sync/.cache/web-pkg')
rmSync(PKG, { recursive: true, force: true })
mkdirSync(PKG, { recursive: true })
writeFileSync(`${PKG}/package.json`, JSON.stringify({
  name: '@art-circle/atelier-admin', version: '1.0.0', private: true,
  module: 'dist/index.js', types: 'dist/types/.design-sync/web-entry.d.ts',
}, null, 2))

await build({
  configFile: false,
  root: ROOT,
  logLevel: 'warn',
  publicDir: false,
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.join(ROOT, 'src') } },
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    outDir: path.join(PKG, 'dist'),
    emptyOutDir: true,
    minify: false,
    cssCodeSplit: false,
    assetsInlineLimit: 0,
    lib: { entry: { index: '.design-sync/web-entry.ts', styles: '.design-sync/web-styles.ts' }, formats: ['es'] },
    rolldownOptions: {
      external: [/^react($|\/)/, /^react-dom($|\/)/, /^use-sync-external-store($|\/)/],
      output: { assetFileNames: (a) => (a.names?.[0]?.endsWith('.css') ? 'styles.css' : 'assets/[name][extname]') },
    },
  },
})

// .d.ts from the real sources, with the app's own compiler options.
execFileSync(path.resolve('node_modules/.bin/tsc'), ['-p', '.design-sync/tsconfig.dts.json'], { stdio: 'inherit' })
console.log(`web-pkg built -> ${PKG}`)
