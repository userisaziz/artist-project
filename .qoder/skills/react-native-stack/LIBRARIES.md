# Approved library table — mobile/

One capability, one kit. Statuses:

- **installed** — in `mobile/package.json`, pinned to Expo SDK 57
- **built-in** — React Native core, no dependency
- **wrapper** — this app's own token-driven component in `mobile/src/components/common/`
- **candidate** — pre-approved pick for a gap; installing it is the whole decision
- **rival** — deliberately excluded; adding one needs a rules §11 amendment first

| Capability | Approved pick | Status | Notes |
| --- | --- | --- | --- |
| Routing | `expo-router` (~57) | installed | Built on React Navigation; never add `react-navigation` or `react-native-navigation` beside it |
| Native screen stack | `react-native-screens`, `react-native-safe-area-context` | installed | Back expo-router; single copy each |
| Server cache | `@tanstack/react-query` v5 | installed | Only server-state layer; declarations in `src/api/<feature>` |
| HTTP client | `fetch` in `src/core/api/real-transport.ts` | wrapper | One preconfigured client; no axios / apisauce |
| Transport types | `zod` v4 | installed | Single validation layer (rules §11): every form's rules are a schema in `src/utils/<feature>/*-draft.ts`, money parsed to paise inside it |
| Forms | `react-hook-form` v7 + `@hookform/resolvers` v6 | installed | Submit-driven forms: `useForm` + `zodResolver`, fields bound through `common/FormField.tsx`. Live-gated forms read the same schema with `firstIssue()` (rules §7). No per-form second set of checks |
| Client state | `Context` (`src/context/<feature>`) | wrapper | Session, theme, wizard only |
| Extra client state | `zustand` | candidate | Only if a store is genuinely needed; never for server data |
| Secrets storage | `expo-secure-store` | installed | Tokens, never AsyncStorage |
| Local key-value | `@react-native-async-storage/async-storage` | candidate | Community pick and drop-in; Expo's own guidance is converging on `expo-sqlite` + `localStorage/install` as the replacement |
| Fast key-value | `react-native-mmkv` | rival | Faster but native build + JSI pairing; adopt only with a measured need |
| On-device DB | `expo-sqlite` (+ Drizzle) | candidate | Only for offline catalogs; not on the roadmap |
| Images | `expo-image` | installed | Wrap via `Photo.tsx`; no `fast-image` |
| Image placeholder | `expo-image` blurhash placeholder | built-in | Requires the backend to ship a blurhash per asset |
| Picker | `expo-image-picker` | installed | Camera permission explicitly off in `app.json` |
| Resize/compress | `expo-image-manipulator` | installed | Presigned R2 upload path — keep the Blob `type` fix |
| Camera capture | `react-native-vision-camera` | candidate | Only for live frame processing; native, build required |
| Lists | `FlatList` | built-in | Current default everywhere |
| Long/virtualised lists | `@shopify/flash-list` | installed | 2.0.2 on the 15 paginated catalogs; short/static lists + `ChatThread` (no `inverted` in v2) stay on `FlatList`; broken shipped `jestSetup` — mock lives in `jest-setup.ts` |
| Sheets | `BottomSheet.tsx` (`Modal` + Reanimated) | wrapper | `@gorhom/bottom-sheet` and `@expo/ui` are rivals — evaluate as a migration, never beside the wrapper |
| Keyboard | `KeyboardAvoider.tsx` | wrapper | One wrapper reserves the keyboard for all form screens: `behavior="padding"` on iOS **and** Android (edge-to-edge ignores `adjustResize`), none on web; ESLint bans raw `KeyboardAvoidingView` outside it. `react-native-keyboard-controller` stays the equaliser if we outgrow it |
| Toasts | `Toast.tsx` + `src/core/toast` | wrapper | Store (`toast('error' \| 'success', title, body?)`) read with `useSyncExternalStore`, so `src/hooks/**` can raise one without a provider; one `ToastHost` in `app/_layout.tsx`, newest replaces current, 4s auto-dismiss, Reanimated layout animations (`toastMotion`) for the exit. `Alert` stays for the 6 destructive confirmations only. `react-native-flash-message` rejected: 0.4.2 last published 2023-08, peer-depends on `prop-types`, and is built on the legacy `Animated` API we retired — a second motion kit; `burnt` is native and unnecessary here |
| Menus | `MenuRow.tsx`, `ChoiceSheet.tsx` | wrapper | No `zeego` / `popup-menu` |
| OTP input | `OtpInput.tsx` | wrapper | Keeps autofill + token styling; `confirmation-code-field` not needed |
| Date/time picker | `react-native-date-picker` | candidate | Native controls on both platforms; needed for schedules and DOB |
| Carousel | `react-native-reanimated-carousel` | candidate | Needs Reanimated 4 pairing (present) |
| Animation | `react-native-reanimated` 4 + `react-native-worklets` | installed | UI-thread motion via `src/core/motion` + shared primitives only (`MotionEntrance`, `CrossfadeStack`, `PressableFeedback`, `Skeleton`, `AppButton`, `BottomSheet`, `OtpInput`, `Toast`); see `expo-animation` skill |
| Legacy animation | `Animated` API | retired | No file imports it — the last three (`BottomSheet`, `OtpInput`, `HomeHero`) moved to Reanimated 4. Do not reintroduce: a new animation starts from `src/core/motion` |
| Gestures | `react-native-gesture-handler` | candidate | Prerequisite for drag sheets and most gesture work; single copy |
| Haptics | `expo-haptics` | installed | Only through `src/core/motion/haptics.ts` — `haptic('tap' \| 'select' \| 'success' \| 'warning' \| 'error')`, fire-and-forget, silent on web and on a device that cannot buzz. Opt in per control with `PressableFeedback haptic=`. Native: changes the fingerprint, so it ships with a build, not an OTA |
| Lottie | `lottie-react-native` | candidate | Only if designed `.lottie` assets exist |
| SVG | `react-native-svg` | installed | Via `Icon.tsx` / `lucide-react-native` |
| Gradients | `expo-linear-gradient` | installed | |
| Styling | Three-layer tokens + `ThemeProvider` (`src/core/theme`) | wrapper | NativeWind / Tamagui / Unistyles / styled-components are all rivals here |
| Icons | `lucide-react-native` | installed | `react-native-vector-icons` excluded |
| Maps | `react-native-maps` + `expo-location` | installed | Wrap via `PinMap.tsx`; Google key in env, not source |
| Open in maps app | `react-native-map-link` | candidate | For "navigate to the studio" |
| Address autocomplete | `react-native-google-places-autocomplete` | candidate | Only with a Places API budget; `src/core/location` covers the rest |
| Push/local notifications | `expo-notifications` | installed | Free Expo relay path; `src/core/push` |
| Connectivity | `@react-native-community/netinfo` | candidate | Lets login distinguish offline from 5xx instead of guessing |
| Sharing | `Share` API | built-in | |
| i18n / locale | `react-native-localize` | candidate | Signup already stores a language preference |
| Error monitoring | `sentry-react-native` | candidate | Native; needs a build + DSN in env, not in the bundle |
| OAuth (social login) | `react-native-app-auth` | candidate | Not needed while auth is OTP-only |
| Tests (unit/integration) | `jest-expo`, `@testing-library/react-native` 14, `@react-native/jest-preset` | installed | `render()` is async; query via `screen` |
| Tests (E2E) | Maestro | candidate | Declarative flows; lighter than Detox for this app |
| OTA updates | `expo-updates` + EAS Update | installed | `runtimeVersion: fingerprint`, channels preview/production |
| Builds | EAS CLI (`preview` APK, `production`) | installed | Local alternative: `expo prebuild` + `./gradlew assembleDebug` |
| Web target | `react-native-web` | installed | Keep code universal; `*.web.tsx` for platform splits |

## Refresh the shortlist

```bash
git clone --depth 1 https://github.com/jondot/awesome-react-native.git /tmp/arn
sed -n '95,300p' /tmp/arn/README.md      # Components + Data sections
```

Then verify any new candidate at https://reactnative.directory (maintenance + New Architecture)
and `npx expo install --check` after adding. Record the upstream commit at the top of `SKILL.md`
when the table is re-mined.
