# design-sync notes (Atelier mobile → Claude Design)

Project: "Atelier Design System" `4089fac3-51e7-4c9b-9e89-7820c017c617` (https://claude.ai/design/p/4089fac3-51e7-4c9b-9e89-7820c017c617).
Run everything from `mobile/`.

## How this repo syncs (non-standard)
- The DS is the Expo app's own React Native components, not a published package. `buildCmd` (`node .design-sync/web-build.mjs`) compiles `.design-sync/web-entry.ts` with esbuild, `react-native` → `react-native-web` alias, `.web.*` resolve-first, into `.design-sync/.cache/web-pkg/` (dist JS + tsc `.d.ts`). The converter takes that via `cfg.entry`; `srcDir: ../../../src` points enrichment back at `mobile/src`.
- `react-native-web`, `react@19.2.3`, `react-dom@19.2.3`, esbuild, ts-morph, @types/react and playwright live ONLY in `.ds-sync/node_modules` (isolated; `mobile/package.json` is untouched). Pass `--node-modules .ds-sync/node_modules` — `mobile/node_modules` has no react-dom.
- Fresh clone setup: `cp -r <skill>/{package-build,package-validate,package-capture,resync}.mjs <skill>/{lib,storybook} .ds-sync/`, then `cd .ds-sync && npm i esbuild ts-morph @types/react react@19.2.3 react-dom@19.2.3 react-native-web playwright && npx playwright install chromium`.
- tsc 6 refuses CLI file args next to a tsconfig.json without `--ignoreConfig` (already in web-build.mjs).
- `cfg.cssEntry` must live inside the package dir, so web-build.mjs copies `.design-sync/web.css` into web-pkg. It removes the browser focus outline on `<input>` (RN fields draw their own `borderFocus`).
- Fonts: `.design-sync/fonts.css` registers Plus Jakarta Sans under the exact RN family names (`PlusJakartaSans_600SemiBold`…) from `node_modules/@expo-google-fonts/plus-jakarta-sans`. Add a weight there if `src/theme/tokens/typography.ts` starts using a new one.
- Provider chain: `SafeAreaProvider` (fixed `initialMetrics`) → `ThemeProvider`. `Screen`/`FormScreen` throw without SafeAreaProvider.
- `componentSrcMap` nulls: ThemeProvider/SafeAreaProvider (providers) and the re-exported RN primitives (View, ScrollView, Pressable, Image, LinearGradient) — exported for designs' layout glue, no cards. `PlaceholderHome` is not in the web entry (needs the auth session).
- Cards are phone-width (340–393pt): every component except AppButton uses `cardMode: column`.
- Groups come from `.design-sync/docs/<Name>.md` frontmatter (`docsDir: ../../docs`); those docs also become each `.prompt.md`.

## Known render warns
- none (validate is warning-free apart from informational `[CSS_RUNTIME]`, expected: RN-web injects styles at runtime).

## First sync, 2026-10-10
- Re-adopted the existing "Atelier Design System" project on the user's explicit OK. Its previous hand-made terracotta/SF Pro DS (10 components, 7 token files, SF Pro fonts, a guideline card, lowercase readme.md) was deleted; source backup is in `.design-sync/.cache/remote-backup/` (local, gitignored — copy elsewhere if it matters). `assets/icons/` (45 Lucide SVGs) and the project thumbnail were left in place.

## Re-sync risks
- New components in `src/components/` are NOT picked up automatically: add them to `.design-sync/web-entry.ts` (+ a doc and a preview).
- Any new native-only dependency (expo-image, expo-secure-store, …) imported by a synced component must have a web build, or web-build.mjs fails / the card blanks.
- `react-native-web` is unpinned in `.ds-sync` (0.21.4 at first sync); a new major can shift rendering — spot-check sheets after reinstalling.
- `fonts.css` URLs are tied to the @expo-google-fonts folder layout.
- The SafeAreaProvider `initialMetrics` in config uses zero insets for cards; the conventions header tells designs to use 47/34.
