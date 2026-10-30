# Mobile Motion System — Design

## Problem

The mobile app answers taps (ripple/dim via `PressableFeedback`), slides its bottom sheet, shakes the OTP
input on error, and cross-fades images — but all of it is hardcoded, one-off RN `Animated` code. There is
no motion vocabulary: no shared durations or easings, no springs, no entrance choreography, no skeletons.
The result reads as "clean and functional", not premium. The admin app already has a designed motion
language (`brand/tokens.json` motion block → generated `admin/src/brand.css` tokens → `tw-animate-css`),
so the brand's motion identity exists but stops at the web dashboard.

## Goal

A Premium motion personality for the mobile app, expressed as generated design tokens + a small set of
reanimated-backed primitives, applied in increment 1 to the highest-visibility surfaces: buttons, list
entrances, the bottom sheet, the tab bar, and first-load skeletons. Reduced-motion users get a dignified
fallback everywhere.

## Chosen approach

**react-native-reanimated 4** (SDK-matched via `npx expo install`) as the single animation engine, wrapped
behind `src/core/motion/`. Worklets run on the UI thread so motion stays 60fps under JS load (query
refetches, typing), layout/entrance animations make staggered lists robust, and it is the prerequisite for
any future gesture- or shared-element work. It works in Expo Go; custom dev-client/prebuild builds need
one rebuild after the dependency lands.

Rejected: **core Animated only** — zero deps but JS-thread driven, manual orchestration, no layout
animations (would cap the premium bar); **phased core-then-reanimated** — the primitives would be written
twice for no user-visible gain in increment 1.

## Motion personality (confirmed by user: Premium)

Premium = elegant, controlled, **0% overshoot**. Desktop premium ranges scale ×0.8 for mobile; functional
feedback keeps its instant tier. No squash & stretch, no bouncy landings.

**Brand Motion Identity** (three constants every animation derives from):

| Constant | Value | Notes |
| --- | --- | --- |
| Signature easing | `cubic-bezier(0.4, 0, 0.2, 1)` | Entrances and on-screen moves; exits use `(0.4, 0, 1, 1)` (accelerate-out) |
| Duration palette | `quick 120` · `base 180` · `slow 240` · `enter 320` · `reveal 480` (ms) | First three mirror the admin tokens for cross-app continuity; `enter`/`reveal` are the Premium mobile tiers |
| Entrance pattern | `fadeRise`: opacity 0→1 + translateY 12px→0, 320ms, micro-cascade stagger 36ms | One entry style everywhere |

**Springs** (interactions only — entrances use the signature easing):

| Spring | stiffness / damping / mass | Feel |
| --- | --- | --- |
| `press` | 400 / 28 / 1 | Very stiff, near-critical — the finger is answered instantly, no visible overshoot |
| `settle` | 300 / 24 / 1 | Standard smooth landing for releases and the sheet |

**Stagger budget**: 36ms step, applied to at most the first 8 items (288ms total; hard cap 500ms).

## Token architecture (single source of truth)

Extends the existing codegen chain instead of adding a parallel one:

1. `brand/tokens.json` — `motion` gains a `native` block: durations, bezier control-point arrays, spring
   params, stagger step. The existing `fast/base/slow/ease` keys (admin) are untouched.
2. `brand/build.mjs` — generates `mobile/src/core/theme/tokens/motion.ts` from that block: dependency-free
   numbers, same GENERATED header contract as every other token file. `npm run brand` regenerates;
   `npm run brand -- --check` guards CI/pre-commit.
3. `src/core/motion/` (hand-written, the only module importing `react-native-reanimated` — same wrapper
   principle as `core/push`, `core/location`): turns tokens into reanimated `Easing`/spring configs and
   exports the vocabulary — `timings`, `springs`, `fadeRise(delayMs)`, `staggerDelay(index)` (caps at 8),
   and a reduced-motion hook.
4. Shared primitives in `src/components/common/`: `PressableScale`, `Skeleton`, `MotionEntrance`.
   Feature components consume primitives + `core/motion`, never raw reanimated.
5. `CLAUDE.md` §11 canonical stack gains one line: `react-native-reanimated`, used only through
   `src/core/motion/` and the shared primitives (per the "new core library must be added to this list"
   rule).

## Element specs (increment 1)

| Element | Primary layer | Secondary layer | Craft notes |
| --- | --- | --- | --- |
| **Buttons** — `AppButton`, new `PressableScale` | Scale 1 → 0.97 on press-in via `press` spring; release springs back ~250ms | Primary label/background crossfades to `brandPressed` over `quick` (120ms) | The press IS the response — no anticipation beat; squash & stretch deliberately skipped |
| **List/card entrances** — `MotionEntrance` on explore rows, artist tiles, storefront packages | `fadeRise` 320ms with stagger | None per item — flat cleanliness is the Premium look | **Staging**: stagger only the initial rendered batch; recycled FlatList items get no `entering` (recycling would replay the entrance mid-scroll) |
| **BottomSheet** | Enter: translateY spring (`settle`); backdrop fades `base` (180ms). Exit: `slow` (240ms) accelerate-out + fade | Content unchanged | The spring's settle is the follow-through |
| **Tab bar** — `TabIcon` | Icon scales 0.88 → 1 via `press` spring on select (~180ms) | Label color shift stays state-based | Exaggeration 0% — a quiet settle, not a bounce |
| **Skeleton** (new) — replaces first-load `ActivityIndicator` on explore + storefront | Shimmer band sweeps 1200ms linear loop (linear is the sanctioned exception for loading/progress) | Base surface tint, band at ~30% opacity | Ambient layer; runs on a UI-thread worklet, stops at `reveal` cap once content arrives |

Existing behaviors kept as-is: OTP shake (RN `Animated`), `HomeHero` cross-fade (already reduce-motion
aware), expo-image 150ms load cross-fades, native stack screen transitions.

## Reduced motion & accessibility

`useReducedMotion()` (reanimated) is honored inside `core/motion` only: entrances collapse to opacity-only
over `quick` (120ms) with zero delay and no travel; the shimmer becomes a static band; press scale is
disabled and feedback falls back to the existing dim/ripple. Every animated primitive keeps its existing
accessibility roles/labels unchanged.

## Performance rules

Transform + opacity only, all driven on the UI thread (worklets). No animating width/height/margin.
Entrances never run on recycled list items. The shimmer loop stops when content replaces the skeleton.
`react-native-web` builds use reanimated's web support; motion degrades gracefully where worklets don't run.

## Out of scope

- Custom screen-to-screen transitions (native stack defaults are platform-correct).
- Haptics, Lottie, success/celebration moments, shared-element transitions (future increments).
- Any admin/web change — its motion system already ships.
- Migrating `OtpInput`'s shake off RN `Animated` (works; cleanup later, not now).

## Verification

1. `npm run brand` regenerates `motion.ts`; `npm run brand -- --check` passes (generated files in sync).
2. `tsc`, `expo lint`, and `jest` pass in `mobile/`. Reanimated's jest mock is wired in `jest-setup.ts`.
3. Unit tests: `staggerDelay` caps at 8 items; reduced-motion gating switches `fadeRise` to opacity-only;
   `PressableScale`/`Skeleton` render with roles/labels intact. Existing suites stay green.
4. Manual smoke in Expo Go: explore list stagger, storefront skeletons, sheet spring, tab settle, button
   press — plus OS reduced-motion enabled.
5. Dev-client/prebuild rebuild (`npx expo prebuild`, then run:android/run:ios or EAS) is executed by the
   user on their machine — Gradle distribution downloads are blocked in the agent sandbox.

## Risks

- New native module: custom builds need one rebuild (Expo Go unaffected); CI is JS-only, unaffected.
- FlatList recycling could replay entrances — mitigated by staging rule (initial batch only), covered by a
  unit test on the gating helper.
- Jest mock drift between reanimated versions — the mock setup is pinned to the installed version by
  `npx expo install`.
- Motion is subjective: increment 1 stays inside the confirmed token palette; feel-tuning happens by
  editing `brand/tokens.json`, never per-component magic numbers.
