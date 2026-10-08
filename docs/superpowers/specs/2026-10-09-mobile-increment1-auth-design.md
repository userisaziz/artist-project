# Mobile Increment 1 — React Native Auth Flow + Feminine Design System

**Date:** 2026-10-09
**Status:** Approved by product owner
**Companion backend spec:** `2026-10-09-backend-increment1-design.md` (auth APIs built in parallel)

---

## Goal

A new Expo React Native app in `mobile/` with:

1. A **themeable design system** (primitive tokens → semantic theme → components) with a feminine visual identity, so re-skinning later means editing token/theme files only.
2. The **phone + OTP auth flow** (wireframes A1 Login → A2 OTP → placeholder home), including session persistence, silent refresh, and cooldown/error handling.
3. A **mock transport seam** so the app is fully buildable and testable *before* the backend auth endpoints exist, switching to the real API via one env flag.

## Decisions already made (context)

| Question | Choice | Why |
|---|---|---|
| Scaffold | Expo (SDK 53+, new architecture) | Industry default; `prebuild` escape hatch later |
| Design system | Custom TS tokens + ThemeProvider | Zero lock-in; theme swap = second semantic mapping file |
| Repo layout | Same repo, `mobile/` sibling of `backend/` | One history, contracts stay in sync |
| Scope | Pure auth only | YAGNI; onboarding/role selection is Increment 2 |
| Navigation | expo-router (Approach A) | File-based stacks; route groups enable auth gating |
| Server state | Plain fetch client, no TanStack Query yet | Auth flow doesn't exercise it; add with lists/pagination in Increment 2 |

## Out of scope (this increment)

Sign-up/role screens (wireframe A3+), artist/customer onboarding, discover, bookings, chat, wallet, dark theme *file* (architecture must support it; we ship light only), push notifications, biometrics.

---

## 1. Design system

### Layering rule

Components may **only** reference Layer-2 semantic roles (via `useTheme()`), never Layer-1 primitives directly, and never hardcode values. Lint-enforced by convention + a test that every semantic role is consumed-able.

### Layer 1 — primitive tokens (`src/theme/tokens/`)

`palette.ts` — raw feminine palette:

```
blush100 #FDF6F4  blush300 #F7E1DA  blush500 #EFCBC1        (warm backgrounds)
rose300  #E8A2B4  rose500  #D27B98  rose700 #B85C7B         (brand pinks)
plum500  #6E3657  plum700  #4A2038                          (primary action / headings)
terra500 #C97B5D                                           (accent, links, highlights)
gold400  #D9A56C                                           (ratings, badges — future)
sage500  #A8BFA5                                           (success)
cream    #FFFBF8                                           (card surface)
ink900   #3A2530  ink600 #7A6672  ink400 #A99AA4           (text warm-gray family)
error500 #C24A4A  error100 #F9E3E3
```

`typography.ts` — roles over raw sizes:
`display` 32/700 serif · `title` 22/700 serif · `subtitle` 16/600 sans · `body` 15/400 sans · `caption` 12/500 sans · `button` 16/600 sans. Font families: `"PlayfairDisplay"` (display/title), `"Inter"` (everything else), bundled in `assets/fonts/` via `expo-font` — no runtime fetch.

`spacing.ts` — 4px base: `xs 4, sm 8, md 16, lg 24, xl 32, xxl 48`.
`radii.ts` — `sm 8, md 14, pill 999, card 20`.
`shadows.ts` — soft rose-tinted (`color: ink with 8–12% alpha`, blur 16–24, y 6–10); iOS `shadow*` + Android `elevation` mapped per level.

### Layer 2 — semantic theme (`src/theme/themes/light.ts`)

Typed object `Theme` assigning roles:

```
colors: background (blush100), surface (cream),
        textPrimary (ink900), textSecondary (ink600), textMuted (ink400),
        textOnBrand (#FFFFFF),
        brand (plum500), brandPressed (plum700), brandSoft (blush300),
        accent (terra500), separator (blush500),
        inputBackground (cream), border (blush500), borderFocus (rose500),
        error, errorBackground, success
typography, spacing, radii, shadows  (pass-through of layer 1)
```

`src/theme/types.ts` exports the `Theme` interface — the contract any future theme (dark, festive re-skin) must satisfy; TypeScript flags missing roles.

### Layer 3 — access

- `ThemeProvider` (React context) at the root of `app/_layout.tsx`.
- `useTheme()` hook returns the current `Theme`.
- `NavigationTheme` adapter feeds React Navigation (header, card, status bar styles) so chrome re-skins too.
- `setTheme()` supported via prop on day one (single theme shipped); the switch mechanism exists, it's just unpopulated.

### Components (`src/components/`) — built this increment

| Component | Contract | Notes |
|---|---|---|
| `Screen` | `{children, scroll?, keyboardOffset?}` | SafeAreaView + `KeyboardAvoidingView` |
| `AppText` | `variant: display/title/subtitle/body/caption` | Maps to theme typography |
| `AppButton` | `variant: primary/ghost`, `loading`, `disabled`, `onPress` | Pill radius; spinner replaces label while loading; disabled = brand at 40% opacity |
| `AppTextField` | `label, value, onChange, error?, focusRing` | border→borderFocus on focus; inline red caption on error |
| `PhoneInput` | country-code chip `+91 ▾` (Picker modal, top-12 countries), digits field | Formats as you type; emits E.164 |
| `OtpInput` | `length=6, onComplete(digits)` | 6 boxed fields (feminine rounded squares), auto-advance, backspace steps back, paste distributes, `textContentType="oneTimeCode"` + autoFocus for iOS SMS autofill |
| `Logo` | wordmark "Art Circle" in Playfair | Used on login + splash |

---

## 2. App structure & navigation

```text
mobile/
├── app/
│   ├── _layout.tsx           # fonts loaded → ThemeProvider → AuthProvider → gate
│   ├── (auth)/_layout.tsx    # stack: headerless
│   ├── (auth)/index.tsx      # A1 Login
│   ├── (auth)/otp.tsx        # A2 OTP (param: phone)
│   └── (app)/index.tsx       # placeholder home
├── src/
│   ├── theme/…  components/…  auth/…  api/…
├── assets/fonts/
└── .env  (EXPO_PUBLIC_API_URL, EXPO_PUBLIC_USE_MOCKS)
```

**Root gate:** `AuthProvider` exposes `status: 'restoring' | 'unauthenticated' | 'authenticated'`. `_layout.tsx` renders splash while `restoring`, then keys the Stack: `unauthenticated` → `(auth)` group only, `authenticated` → `(app)` group only. Groups are replaced, not pushed — no manual navigation into forbidden screens, and back-from-home lands on home (no bounce into OTP).

**Login screen (A1):** wireframe-faithful — `Logo`, "Welcome back", "Continue with your phone number", `PhoneInput`, `Continue` (disabled until valid), footer row *Terms · Privacy* (`textSecondary`, non-linked for now). On submit: `POST /auth/otp/request`; success → `router.push('/otp', { phone })`; `rate_limited` → inline "Please wait before requesting another code".

**OTP screen (A2):** "Verify your number", subtitle shows the phone (`+91 98765 43210` style), `OtpInput`, resend row with 60s countdown ("Resend code in 0:24"), `Verify` button as manual fallback. On 6th digit → auto-submit `POST /auth/otp/verify`. Wrong code: `OtpInput` shake animation + inline "Invalid or expired code", digits cleared for retry. Success → tokens stored → gate flips to `(app)`.

**Placeholder home (Increment-1 stub):** greeting "Welcome, {first name or phone}", avatar circle, role chip from `user.role`, "Signed in — real app screens arrive in the next increment", and a **Sign out** ghost button (clears SecureStore → gate flips back). This proves the full session lifecycle end-to-end.

---

## 3. Session & API layer

### Token storage — `src/auth/session-store.ts`

`expo-secure-store` keys `ac.access_token`, `ac.refresh_token`. Written only after verify/refresh; cleared on logout or refresh-failure. (Not AsyncStorage: tokens are credentials.)

### AuthProvider — `src/auth/auth-provider.tsx`

State machine, exactly four transitions:

1. **restore (app mount):** read refresh token → if none, `unauthenticated`. If present, `POST /auth/refresh`; success → store new pair → `authenticated`; any failure → clear → `unauthenticated`. Silent to the user; splash shows meanwhile.
2. **otpRequested(phone):** after A1 submit succeeds — navigates; cooldown timer starts on OTP screen mount (60s).
3. **verified(tokens, user):** after A2 success.
4. **signedOut:** from home button or refresh-failure interceptor.

Exposes `{ status, user, requestOtp, verifyOtp, signOut }`. `user` comes from the `TokenPair.user` payload of whichever call last succeeded (backend returns it on both verify and refresh — mirrors `UserOut`).

### Transport seam — `src/api/`

```
client.ts       # ApiError, request<T>(method, path, body, {auth})
transport.ts    # interface Transport { request(...): Promise<{status, json}> }
real-transport.ts   # fetch + EXPO_PUBLIC_API_URL
mock/transport.ts   # implements the contract table below in memory
endpoints/auth.ts   # requestOtp / verifyOtp / refresh — pure functions on client
```

Selection: `EXPO_PUBLIC_USE_MOCKS === 'true'` → `MockTransport`. Nothing else in the app knows which transport is active.

**401 replay logic (only place it lives):** `request()` attaches `Authorization: Bearer <access>` when `auth: true`; on 401 it calls refresh once (serialized via a pending-promise guard so concurrent 401s don't stampede), updates storage, replays. Refresh failure → `signOut`.

### MockTransport behavior (mirrors backend rules exactly)

- `POST /auth/otp/request`: E.164-valid phone required (else 422). Generates 6-digit OTP in memory; 60s resend cooldown → 429 `rate_limited`; earlier unconsumed codes invalidated; 5-min expiry. Returns 204. In dev (`__DEV__` only), the code is also surfaced via a `mock://` console log **and** an `onOtpGenerated` callback the OTP screen can prefill from (visible "Mock mode: code is 123456" helper banner) — mirrors backend console-SMS dev mode, never rendered when mocks are off.
- `POST /auth/otp/verify`: unknown/expired/consumed/wrong code or attempts ≥ 5 → 401 `auth_error`. First-ever number → JIT "create user" (mock user with that phone, role `customer`); known mock phone `+15550009999` → returns role `artist` so role chip rendering is testable. Returns fake JWT-shaped tokens (`header.payload.sig`, `type: "access"|"refresh"`, exp far enough in future) + `user`.
- `POST /auth/refresh`: valid unrevoked refresh token → rotate (old one dies — reuse returns 401 `auth_error`); else 401. Returns fresh pair + `user`.

### API contract (source of truth — both sides implement this)

Backend base: `/api/v1`. Error body everywhere: `{ "code": string, "message": string }`.

| Endpoint | Request | Success | Errors |
|---|---|---|---|
| `POST /auth/otp/request` | `{phone}` E.164 | `204` | `422` validation · `429 rate_limited` |
| `POST /auth/otp/verify` | `{phone, code}` 6 digits | `200 TokenPair` | `401 auth_error` · `422` |
| `POST /auth/refresh` | `{refresh_token}` | `200 TokenPair` | `401 auth_error` |

`TokenPair = { access_token, refresh_token, token_type: "bearer", user: UserOut }`
`UserOut = { id, phone, role: "customer"|"artist"|"admin", is_phone_verified, first_name?, last_name?, email?, avatar_url? }`

Divergence rule: if the real backend returns anything outside this table, we fix the client or flag it — we do not silently tolerate it.

---

## 4. Error handling summary

- All transport/status errors become `ApiError { code, message, status }` — screens switch on `code`, fall back to `message`, then to a generic "Something went wrong. Please try again."
- Network failure (fetch reject / offline) → inline retry banner on the current screen, never a dead button.
- No `try/catch` that swallows: every catch either maps to UI state or re-throws. Rule enforced in code review; `silent-failure-hunter` pass at the end of the increment.
- Crash-safety: unexpected render errors → React error boundary with themed "Something went wrong" + Retry (restart app) screen.

## 5. Testing

- **Runner:** `jest-expo` (`npm test`). No E2E this increment (Detox/MAESTRO-style tooling out of scope, YAGNI).
- `theme.test.ts` — light theme satisfies `Theme` interface; every role non-undefined; spot mapping assertions (brand = plum500).
- `otp-input.test.ts` — auto-advance, backspace, paste-6, onComplete fires once.
- `mock-transport.test.ts` — cooldown 429, expiry, attempt limit, rotation-reuse 401, JIT user creation (the mock is trustworthy *because* it's tested against the same rules as the backend plan's tests).
- `auth-provider.test.tsx` — restore→(refresh ok/fail), request→verify happy path, signOut clears storage (mocked SecureStore).
- Manual pass: iOS simulator + Android emulator, verify keyboard handling, autofill, countdown, theme colors.

## 6. Configuration & commands

- Node 22, `npx create-expo-app@latest mobile --template blank` then add expo-router per Expo docs.
- `EXPO_PUBLIC_API_URL=http://localhost:8000` (iOS sim) — Android emulator needs `http://10.0.2.2:8000`; documented in `mobile/README.md` with both.
- Scripts: `start` (expo with scheme), `test`, `lint` (eslint + prettier).
- Root `.gitignore` already covers env files; add `mobile/` entries (`.expo/`, `node_modules/`).
- Rationale for `EXPO_PUBLIC_` prefix: only such vars reach the bundle; a non-prefixed var silently fails at runtime — footgun we avoid by convention.

## 7. Parallel-build sequence

1. Mobile increment proceeds end-to-end on `MockTransport` (no backend needed).
2. Backend Tasks 3–4 (auth domain) land independently.
3. Integration: set `EXPO_PUBLIC_USE_MOCKS=false`, run against `uvicorn` on :8000, walk the full flow incl. cooldown/rotation against real 429/401s; OTP read from server console (dev SMS provider).
4. Any contract drift discovered is fixed on whichever side deviated from §3's table.
