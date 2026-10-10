// Builds the web package the design-sync converter consumes (cfg.buildCmd).
// The app's components are React Native; react-native-web renders them in the
// browser, so this compiles .design-sync/web-entry.ts with react-native aliased
// to react-native-web into .design-sync/.cache/web-pkg (dist JS + .d.ts).
// react/react-dom stay external - the converter maps them to window.React/ReactDOM.
// Run from mobile/: node .design-sync/web-build.mjs  (deps: .ds-sync/node_modules)
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(resolve('.ds-sync/package.json'));
const esbuild = require('esbuild');
const PKG = resolve('.design-sync/.cache/web-pkg');
rmSync(PKG, { recursive: true, force: true });
mkdirSync(PKG, { recursive: true });
writeFileSync(`${PKG}/package.json`, JSON.stringify({
  name: '@art-circle/atelier-mobile', version: '1.0.0', private: true,
  module: 'dist/index.js', types: 'dist/types/.design-sync/web-entry.d.ts',
}, null, 2));
// cfg.cssEntry must live inside the package dir.
copyFileSync('.design-sync/web.css', `${PKG}/web.css`);

await esbuild.build({
  entryPoints: ['.design-sync/web-entry.ts'],
  outfile: `${PKG}/dist/index.js`,
  bundle: true, format: 'esm', platform: 'browser', target: 'es2020',
  jsx: 'automatic',
  alias: { 'react-native': 'react-native-web' },
  // RN libraries ship platform files; web variants win, as in Expo's web build.
  resolveExtensions: ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.js', '.json'],
  nodePaths: [resolve('node_modules'), resolve('.ds-sync/node_modules')],
  external: ['react', 'react/*', 'react-dom', 'react-dom/*'],
  loader: { '.js': 'jsx' },
  define: { __DEV__: 'false', 'process.env.EXPO_OS': '"web"', 'process.env.NODE_ENV': '"production"', global: 'globalThis' },
  logLevel: 'warning',
});

// .d.ts from the real sources; react-native types resolve from mobile/node_modules.
execFileSync(resolve('node_modules/.bin/tsc'), [
  '.design-sync/web-entry.ts', '--declaration', '--emitDeclarationOnly', '--jsx', 'react-jsx',
  '--moduleResolution', 'bundler', '--module', 'esnext', '--target', 'es2020', '--strict',
  '--ignoreConfig', '--skipLibCheck', '--esModuleInterop', '--types', 'node', '--outDir', `${PKG}/dist/types`,
], { stdio: 'inherit' });
console.log(`web-pkg built -> ${PKG}`);
