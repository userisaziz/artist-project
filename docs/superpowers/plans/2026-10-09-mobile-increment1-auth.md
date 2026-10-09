# Mobile Increment 1 (Design System + Auth Flow) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A running Expo React Native app in `mobile/` with a token-based design system (v2 nude/cocoa theme, Task 9) and a complete phone+OTP auth flow (login → OTP → placeholder home), working fully against an in-memory mock transport that mirrors the backend's auth contract, switchable to the real FastAPI via one env flag.

**Architecture:** Three-layer design system (primitive tokens → semantic `Theme` object → components via `useTheme()`). expo-router with a root auth gate driven by a four-state `AuthProvider`. All network I/O behind a single `Transport` interface; `client.ts` owns error typing and 401→refresh→replay. `MockTransport` implements the same rules as `auth_service.py` (60 s cooldown, 5-min expiry, 5 attempts, JIT user, refresh rotation).

**Tech Stack:** Expo SDK (latest, expo-router), TypeScript, expo-secure-store, expo-font via `@expo-google-fonts`, Animated API, jest-expo + @testing-library/react-native, ESLint (expo config).

**Spec:** `docs/superpowers/specs/2026-10-09-mobile-increment1-auth-design.md`

All commands run from `mobile/` unless noted. Commit identity: repo default.

---

## File map

```text
mobile/
├── app/
│   ├── _layout.tsx            # fonts → ThemeProvider → AuthProvider → GateStack
│   ├── (auth)/_layout.tsx     # headerless stack
│   ├── (auth)/index.tsx       # A1 Login
│   ├── (auth)/otp.tsx         # A2 OTP entry
│   └── (app)/index.tsx        # placeholder home + sign out
├── src/
│   ├── theme/
│   │   ├── tokens/{palette,typography,spacing,radii,shadows}.ts
│   │   ├── types.ts           # Theme interface (the contract any theme must satisfy)
│   │   ├── themes/light.ts
│   │   └── theme-provider.tsx # ThemeProvider + useTheme
│   ├── components/
│   │   ├── Screen.tsx  AppText.tsx  AppButton.tsx  AppTextField.tsx  Logo.tsx
│   │   ├── PhoneInput.tsx     OtpInput.tsx
│   │   └── __tests__/{otp-input}.test.tsx
│   ├── api/
│   │   ├── types.ts           # User, TokenPair, ApiError
│   │   ├── transport.ts       # Transport interface
│   │   ├── real-transport.ts  client.ts
│   │   ├── mock/transport.ts
│   │   ├── endpoints/auth.ts
│   │   └── __tests__/mock-transport.test.ts
│   ├── auth/
│   │   ├── session-store.ts   auth-provider.tsx
│   │   └── __tests__/auth-provider.test.tsx
│   └── __tests__/theme.test.ts   # (or src/theme/__tests__/)
├── .env  .env.example
└── jest.config.js  app.json  package.json
```

---

### Task 1: Scaffold + router + env + test runner

**Files:**
- Create: whole `mobile/` tree via Expo template, then `app/_layout.tsx`, `app/(auth)/index.tsx` (temp "hello"), `.env`, `.env.example`, `jest.config.js`, `jest-setup.ts`
- Modify: `package.json` (scripts), `app.json` (scheme), root `.gitignore`

Why: get the three load-bearing conventions proven first — expo-router wiring, env exposure (`EXPO_PUBLIC_` prefix is the only way vars reach the bundle), and a green `npm test` — so every later task builds on a running skeleton, not on guesswork.

- [ ] **Step 1: Create the app**

```bash
cd /Users/almabetter/artist-project
npx create-expo-app@latest mobile
cd mobile
npx expo install expo-secure-store expo-font @expo-google-fonts/playfair-display @expo-google-fonts/inter @expo/vector-icons
npm i -D jest jest-expo @testing-library/react-native react-test-renderer @types/jest
```

Expected: `mobile/` with `package.json`, `app.json`, `node_modules`; no errors.

- [ ] **Step 2: Enable typed routes + scheme**

Replace `app.json` `"scheme"` and add plugins so expo-router works. Ensure the top-level JSON contains:

```json
{
  "expo": {
    "name": "Art Circle",
    "slug": "art-circle",
    "scheme": "artcircle",
    "plugins": ["expo-router"],
    "newArchEnabled": true
  }
}
```

Set entry in `package.json`: `"main": "expo-router/entry"`.

Run: `npx expo start` briefly → Metro bundle builds without "expo-router not configured" errors → Ctrl-C.

- [ ] **Step 3: Write `.env.example` and copy to `.env`**

```text
EXPO_PUBLIC_API_URL=http://localhost:8000
EXPO_PUBLIC_USE_MOCKS=true
```

`cp .env.example .env`. Why `EXPO_PUBLIC_`: variables without the prefix are silently undefined in the client bundle — a runtime footgun we eliminate by naming convention.

- [ ] **Step 4: Configure jest**

`jest.config.js`:

```js
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest-setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg)',
  ],
};
```

`jest-setup.ts`:

```ts
// Intentionally empty for now; add global mocks here as needed.
```

- [ ] **Step 5: Write the smoke test**

`src/__tests__/smoke.test.ts` (create `src/` dir):

```ts
it('env flag selects mocks explicitly', () => {
  expect(typeof process.env.EXPO_PUBLIC_USE_MOCKS).toBe('string');
});
```

Create minimal `app/_layout.tsx` and `app/(auth)/index.tsx` placeholders so the router tree is valid:

```tsx
// app/_layout.tsx
import { Stack } from 'expo-router';
export default function RootLayout() {
  return <Stack />;
}
```

```tsx
// app/(auth)/index.tsx
import { Text } from 'react-native';
export default function Login() {
  return <Text>Art Circle</Text>;
}
```

Run: `npx jest src/__tests__/smoke.test.ts` — but `.env` isn't loaded by jest yet, so first add `dotenv` loading to `jest-setup.ts`:

```ts
import * as fs from 'fs';
for (const file of ['.env.test', '.env']) {
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
    }
  }
}
```

Re-run: `npx jest` → PASS (1 test).

- [ ] **Step 6: gitignore + commit**

Append to root `.gitignore` (check first; skip lines already present):

```text
mobile/node_modules/
mobile/.expo/
mobile/.env
```

```bash
cd /Users/almabetter/artist-project
git add mobile .gitignore
git commit -m "feat(mobile): scaffold Expo app with router, env seam, and jest"
```

---

### Task 2: Design system — tokens, theme, provider

**Files:**
- Create: `src/theme/tokens/{palette,typography,spacing,radii,shadows}.ts`, `src/theme/types.ts`, `src/theme/themes/light.ts`, `src/theme/theme-provider.tsx`, `src/__tests__/theme.test.ts`
- Delete: `src/__tests__/smoke.test.ts` (superseded by theme test)

Why: the whole "change theme later" requirement stands on this file set. Layer 2 (`light.ts`) is the *only* place semantic roles are assigned; a `dark.ts` or full re-skin later is one more file plus one prop. The failing test first asserts the semantic contract is complete, so a missing role is caught at build time, not render time.

- [ ] **Step 1: Write the failing test `src/__tests__/theme.test.ts`**

```ts
import { lightTheme } from '../theme/themes/light';
import { palette } from '../theme/tokens/palette';

it('assigns every semantic color role', () => {
  const roles = Object.keys(lightTheme.colors);
  expect(roles.length).toBeGreaterThanOrEqual(17);
  for (const role of roles) expect(lightTheme.colors[role as keyof typeof lightTheme.colors]).toMatch(/^#[0-9A-Fa-f]{6}$/);
});

it('maps brand to plum and background to blush (feminine identity)', () => {
  expect(lightTheme.colors.brand).toBe(palette.plum500);
  expect(lightTheme.colors.background).toBe(palette.blush100);
});

it('exposes all six typography roles with serif display and sans body', () => {
  expect(lightTheme.typography.display.fontFamily).toBe('PlayfairDisplay_700Bold');
  expect(lightTheme.typography.body.fontFamily).toBe('Inter_400Regular');
  expect(lightTheme.typography.caption.fontSize).toBeLessThan(lightTheme.typography.body.fontSize);
});
```

Run: `npx jest src/__tests__/theme.test.ts` → FAIL (no modules).

- [ ] **Step 2: Write layer-1 tokens**

```ts
// src/theme/tokens/palette.ts
export const palette = {
  blush100: '#FDF6F4', blush300: '#F7E1DA', blush500: '#EFCBC1',
  rose300: '#E8A2B4', rose500: '#D27B98', rose700: '#B85C7B',
  plum500: '#6E3657', plum700: '#4A2038',
  terra500: '#C97B5D', gold400: '#D9A56C', sage500: '#A8BFA5',
  cream: '#FFFBF8', white: '#FFFFFF',
  ink900: '#3A2530', ink600: '#7A6672', ink400: '#A99AA4',
  error500: '#C24A4A', error100: '#F9E3E3',
} as const;
```

```ts
// src/theme/tokens/typography.ts
// Font names match the @expo-google-fonts exports loaded in Task 7.
export const fontFamilies = {
  serifBold: 'PlayfairDisplay_700Bold',
  sansSemiBold: 'Inter_600SemiBold',
  sansMedium: 'Inter_500Medium',
  sansRegular: 'Inter_400Regular',
} as const;

export const typographyTokens = {
  display:  { fontFamily: fontFamilies.serifBold,    fontSize: 32, lineHeight: 40, letterSpacing: -0.5 },
  title:    { fontFamily: fontFamilies.serifBold,    fontSize: 22, lineHeight: 30, letterSpacing: -0.3 },
  subtitle: { fontFamily: fontFamilies.sansSemiBold, fontSize: 16, lineHeight: 24, letterSpacing: 0 },
  body:     { fontFamily: fontFamilies.sansRegular,  fontSize: 15, lineHeight: 22, letterSpacing: 0 },
  caption:  { fontFamily: fontFamilies.sansMedium,   fontSize: 12, lineHeight: 16, letterSpacing: 0.2 },
  button:   { fontFamily: fontFamilies.sansSemiBold, fontSize: 16, lineHeight: 24, letterSpacing: 0.3 },
} as const;
```

```ts
// src/theme/tokens/spacing.ts
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;
```

```ts
// src/theme/tokens/radii.ts
export const radii = { sm: 8, md: 14, card: 20, pill: 999 } as const;
```

```ts
// src/theme/tokens/shadows.ts
// Rose-tinted soft shadows: warm low-alpha ink keeps the feminine feel (gray shadows read cold).
export const shadows = {
  sm: { shadowColor: '#3A2530', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  md: { shadowColor: '#3A2530', shadowOpacity: 0.10, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  lg: { shadowColor: '#3A2530', shadowOpacity: 0.12, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
} as const;
```

- [ ] **Step 3: Write `src/theme/types.ts`**

```ts
import type { TextStyle, ViewStyle } from 'react-native';

export type FontVariant = Pick<TextStyle, 'fontFamily' | 'fontSize' | 'lineHeight' | 'letterSpacing'>;
export type ShadowStyle = NonNullable<ViewStyle>;

export interface ThemeColors {
  background: string; surface: string;
  textPrimary: string; textSecondary: string; textMuted: string; textOnBrand: string;
  brand: string; brandPressed: string; brandSoft: string;
  accent: string; separator: string;
  inputBackground: string; border: string; borderFocus: string;
  error: string; errorBackground: string; success: string;
}

export interface Theme {
  name: 'light';
  colors: ThemeColors;
  typography: { display: FontVariant; title: FontVariant; subtitle: FontVariant; body: FontVariant; caption: FontVariant; button: FontVariant };
  spacing: { xs: number; sm: number; md: number; lg: number; xl: number; xxl: number };
  radii: { sm: number; md: number; card: number; pill: number };
  shadows: { sm: ShadowStyle; md: ShadowStyle; lg: ShadowStyle };
}
```

- [ ] **Step 4: Write `src/theme/themes/light.ts`**

```ts
import { palette } from '../tokens/palette';
import { typographyTokens } from '../tokens/typography';
import { spacing } from '../tokens/spacing';
import { radii } from '../tokens/radii';
import { shadows } from '../tokens/shadows';
import type { Theme } from '../types';

export const lightTheme: Theme = {
  name: 'light',
  colors: {
    background: palette.blush100,
    surface: palette.cream,
    textPrimary: palette.ink900,
    textSecondary: palette.ink600,
    textMuted: palette.ink400,
    textOnBrand: palette.white,
    brand: palette.plum500,
    brandPressed: palette.plum700,
    brandSoft: palette.blush300,
    accent: palette.terra500,
    separator: palette.blush500,
    inputBackground: palette.cream,
    border: palette.blush500,
    borderFocus: palette.rose500,
    error: palette.error500,
    errorBackground: palette.error100,
    success: palette.sage500,
  },
  typography: typographyTokens,
  spacing,
  radii,
  shadows,
};
```

- [ ] **Step 5: Write `src/theme/theme-provider.tsx`**

```tsx
import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { lightTheme } from './themes/light';
import type { Theme } from './types';

const ThemeContext = createContext<Theme>(lightTheme);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // State exists so setTheme (future: dark / re-skin) flips the whole app from one place.
  const [theme] = useState<Theme>(lightTheme);
  const value = useMemo(() => theme, [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
```

- [ ] **Step 6: Delete the Task-1 smoke test + run suite + commit**

Delete `src/__tests__/smoke.test.ts` (superseded by the theme tests). Run: `npx jest` → PASS (3 theme tests only).

```bash
git add mobile/src
git commit -m "feat(mobile): add three-layer feminine design system"
```

---

### Task 3: Base components — AppText, Screen, AppButton, AppTextField, Logo

**Files:**
- Create: `src/components/{AppText,Screen,AppButton,AppTextField,Logo}.tsx`, `src/components/__tests__/components.test.tsx`

Why: these five are everything the auth screens render. Each takes zero raw colors — style comes from `useTheme()` only — which is what keeps the future re-skin a one-file change.

- [ ] **Step 1: Write failing component test `src/components/__tests__/components.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme/theme-provider';
import { AppText } from '../AppText';
import { AppButton } from '../AppButton';

const wrap = (ui: React.ReactElement) => render(<ThemeProvider>{ui}</ThemeProvider>);

it('AppText maps variants to theme typography', () => {
  wrap(<AppText variant="title">Welcome back</AppText>);
  expect(screen.getByText('Welcome back')).toHaveProperty('props.style.0.fontFamily', 'PlayfairDisplay_700Bold');
});

it('AppButton shows spinner instead of label while loading and blocks presses', () => {
  const onPress = jest.fn();
  wrap(<AppButton label="Continue" onPress={onPress} loading />);
  expect(screen.queryByText('Continue')).toBeNull();
  expect(screen.getByTestId('app-button-spinner')).toBeTruthy();
});
```

Run: `npx jest src/components` → FAIL.

- [ ] **Step 2: Write the components**

```tsx
// src/components/AppText.tsx
import { Text } from 'react-native';
import type { TextProps, TextStyle } from 'react-native';
import { useTheme } from '../theme/theme-provider';
import type { Theme } from '../theme/types';

type Variant = keyof Theme['typography'];

export function AppText({ variant = 'body', style, ...rest }: TextProps & { variant?: Variant }) {
  const theme = useTheme();
  const variantStyle = theme.typography[variant] as TextStyle;
  return <Text {...rest} style={[variantStyle, rest.style]} />;
}
```

Note: `style={[variantStyle, rest.style]}` keeps the array so the test's `.style.0.fontFamily` assertion holds.

```tsx
// src/components/Screen.tsx
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';
import { useTheme } from '../theme/theme-provider';

export function Screen({ children, scroll = false, keyboardOffset = true }: { children: ReactNode; scroll?: boolean; keyboardOffset?: boolean }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const body = scroll ? (
    <ScrollView contentContainerStyle={{ flexGrow: 1, padding: theme.spacing.lg, paddingBottom: insets.bottom + theme.spacing.xl }} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  ) : (
    <View style={{ flex: 1, padding: theme.spacing.lg }}>{children}</View>
  );
  return (
    <View style={[{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top }, Platform.OS === 'web' && { paddingTop: 40 }]}>
      {keyboardOffset ? (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          {body}
        </KeyboardAvoidingView>
      ) : body}
    </View>
  );
}
```

(`react-native-safe-area-context` ships with expo-router; if missing: `npx expo install react-native-safe-area-context`.)

```tsx
// src/components/AppButton.tsx
import { ActivityIndicator, Pressable } from 'react-native';
import type { ReactNode } from 'react';
import { useTheme } from '../theme/theme-provider';
import { AppText } from './AppText';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
}

export function AppButton({ label, onPress, variant = 'primary', loading = false, disabled = false }: Props) {
  const theme = useTheme();
  const inactive = disabled || loading;
  const isPrimary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={inactive ? undefined : onPress}
      style={({ pressed }) => [
        {
          height: 52,
          borderRadius: theme.radii.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isPrimary ? theme.colors.brand : 'transparent',
          borderColor: isPrimary ? 'transparent' : theme.colors.brand,
          borderWidth: isPrimary ? 0 : 1,
          opacity: inactive ? 0.4 : pressed && isPrimary ? 0.85 : 1,
          ...(pressed && !inactive && isPrimary ? { backgroundColor: theme.colors.brandPressed } : {}),
        },
        theme.shadows.md,
      ]}
    >
      {loading ? (
        <ActivityIndicator testID="app-button-spinner" color={isPrimary ? theme.colors.textOnBrand : theme.colors.brand} />
      ) : (
        <AppText variant="button" style={{ color: isPrimary ? theme.colors.textOnBrand : theme.colors.brand }}>
          {label}
        </AppText>
      )}
    </Pressable>
  );
}
```

```tsx
// src/components/AppTextField.tsx
import { View, TextInput } from 'react-native';
import type { TextInputProps } from 'react-native';
import { useState } from 'react';
import { useTheme } from '../theme/theme-provider';
import { AppText } from './AppText';

interface Props extends TextInputProps {
  label: string;
  error?: string | null;
}

export function AppTextField({ label, error, style, ...rest }: Props) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ marginBottom: theme.spacing.md }}>
      <AppText variant="caption" style={{ color: theme.colors.textSecondary, marginBottom: theme.spacing.xs }}>
        {label}
      </AppText>
      <TextInput
        {...rest}
        onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
        style={[
          {
            height: 52,
            borderRadius: theme.radii.md,
            borderWidth: focused ? 2 : 1,
            borderColor: error ? theme.colors.error : focused ? theme.colors.borderFocus : theme.colors.border,
            backgroundColor: theme.colors.inputBackground,
            color: theme.colors.textPrimary,
            paddingHorizontal: theme.spacing.md,
            fontSize: theme.typography.body.fontSize,
            fontFamily: theme.typography.body.fontFamily,
          },
          style,
        ]}
      />
      {error ? (
        <AppText variant="caption" style={{ color: theme.colors.error, marginTop: theme.spacing.xs }}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}
```

```tsx
// src/components/Logo.tsx
import { View } from 'react-native';
import { useTheme } from '../theme/theme-provider';
import { AppText } from './AppText';

export function Logo({ compact = false }: { compact?: boolean }) {
  const theme = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: theme.spacing.xs }}>
      <AppText variant="display" style={{ color: theme.colors.brand }}>Art Circle</AppText>
      {!compact && (
        <AppText variant="caption" style={{ color: theme.colors.textMuted }}>
          mehnadi · makeup · artists near you
        </AppText>
      )}
    </View>
  );
}
```

- [ ] **Step 3: Run tests + manual sanity**

Run: `npx jest src/components` → PASS (2 tests).

- [ ] **Step 4: Commit**

```bash
git add mobile/src/components mobile/src
git commit -m "feat(mobile): add themed base components (text, screen, button, field, logo)"
```

---

### Task 4: API layer — types, transports, client, mock

**Files:**
- Create: `src/api/{types,transport,real-transport,client}.ts`, `src/api/mock/transport.ts`, `src/api/endpoints/auth.ts`, `src/api/__tests__/mock-transport.test.ts`

Why: this task is the parallel-build seam. One `Transport` interface, two implementations, chosen by env once. `MockTransport` encodes the same business rules as the backend plan (cooldown/expiry/attempts/rotation/JIT), so the app is testable today and integration later is a flag flip — and the mock's own tests mirror the backend's `tests/test_auth.py` assertions so we'd notice drift.

- [ ] **Step 1: Write `src/api/types.ts`**

```ts
export type UserRole = 'customer' | 'artist' | 'admin';

export interface User {
  id: string;
  phone: string;
  role: UserRole;
  is_phone_verified: boolean;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: 'bearer';
  user: User;
}

/** Every failed API call becomes an ApiError — screens switch on `.code`, never on raw status. */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}
```

- [ ] **Step 2: Write `src/api/transport.ts`**

```ts
export interface TransportRequest {
  method: 'POST';
  path: string;          // API-relative, e.g. '/auth/otp/verify'
  body?: unknown;
  headers?: Record<string, string>;
}

export interface TransportResponse {
  status: number;
  json: unknown | null;  // null for 204
}

export interface Transport {
  request(req: TransportRequest): Promise<TransportResponse>;
}
```

- [ ] **Step 3: Write failing `src/api/__tests__/mock-transport.test.ts`**

```ts
import { MockTransport } from '../mock/transport';

const PHONE = '+15550001111';

async function requestOtp(t: MockTransport, phone = PHONE) {
  return t.request({ method: 'POST', path: '/auth/otp/request', body: { phone } });
}

it('request returns 204 and emits the code via callback', async () => {
  const t = new MockTransport();
  const seen: string[] = [];
  t.onOtpGenerated = (_phone, code) => seen.push(code);
  const res = await requestOtp(t);
  expect(res.status).toBe(204);
  expect(seen).toHaveLength(1);
  expect(seen[0]).toMatch(/^\d{6}$/);
});

it('resend within 60s is rate limited (429 rate_limited)', async () => {
  const t = new MockTransport();
  await requestOtp(t);
  const res = await requestOtp(t);
  expect(res.status).toBe(429);
  expect((res.json as { code: string }).code).toBe('rate_limited');
});

it('rejects non E.164 phone with 422', async () => {
  const t = new MockTransport();
  const res = await requestOtp(t, '15550001111');
  expect(res.status).toBe(422);
});

it('verify with correct code creates JIT user and returns TokenPair', async () => {
  const t = new MockTransport();
  let code = '';
  t.onOtpGenerated = (_p, c) => { code = c; };
  await requestOtp(t);
  const res = await t.request({ method: 'POST', path: '/auth/otp/verify', body: { phone: PHONE, code } });
  expect(res.status).toBe(200);
  const pair = res.json as { access_token: string; refresh_token: string; user: { phone: string; is_phone_verified: boolean } };
  expect(pair.access_token).toBeTruthy();
  expect(pair.user.phone).toBe(PHONE);
  expect(pair.user.is_phone_verified).toBe(true);
});

it('wrong code increments attempts; 6th try fails even with correct code (max 5)', async () => {
  const t = new MockTransport();
  let code = '';
  t.onOtpGenerated = (_p, c) => { code = c; };
  await requestOtp(t);
  for (let i = 0; i < 5; i++) {
    const bad = await t.request({ method: 'POST', path: '/auth/otp/verify', body: { phone: PHONE, code: '000000' === code ? '111111' : '000000' } });
    expect(bad.status).toBe(401);
  }
  const good = await t.request({ method: 'POST', path: '/auth/otp/verify', body: { phone: PHONE, code } });
  expect(good.status).toBe(401);
});

it('expired code (5 min) is rejected', async () => {
  const t = new MockTransport();
  let code = '';
  t.onOtpGenerated = (_p, c) => { code = c; };
  await requestOtp(t);
  t.advanceTime(5 * 60 * 1000 + 1);
  const res = await t.request({ method: 'POST', path: '/auth/otp/verify', body: { phone: PHONE, code } });
  expect(res.status).toBe(401);
});

it('refresh rotates: old token is dead after one use', async () => {
  const t = new MockTransport();
  let code = '';
  t.onOtpGenerated = (_p, c) => { code = c; };
  await requestOtp(t);
  const verify = await t.request({ method: 'POST', path: '/auth/otp/verify', body: { phone: PHONE, code } });
  const pair = verify.json as { refresh_token: string };
  const fresh = await t.request({ method: 'POST', path: '/auth/refresh', body: { refresh_token: pair.refresh_token } });
  expect(fresh.status).toBe(200);
  const reuse = await t.request({ method: 'POST', path: '/auth/refresh', body: { refresh_token: pair.refresh_token } });
  expect(reuse.status).toBe(401);
});

it('known artist phone returns artist role (lets UI test role rendering without backend)', async () => {
  const t = new MockTransport();
  let code = '';
  t.onOtpGenerated = (_p, c) => { code = c; };
  await requestOtp(t, '+15550009999');
  const res = await t.request({ method: 'POST', path: '/auth/otp/verify', body: { phone: '+15550009999', code } });
  expect((res.json as { user: { role: string } }).user.role).toBe('artist');
});
```

Run: `npx jest src/api` → FAIL (module missing).

- [ ] **Step 4: Write `src/api/mock/transport.ts`**

Time is virtualized (`advanceTime`) so tests can prove expiry/cooldown without sleeping. No artificial latency: keeps jest timers honest; the real transport has genuine network delay anyway.

```ts
import type { Transport, TransportRequest, TransportResponse } from '../transport';
import type { TokenPair, User } from '../types';

interface MockOtp { phone: string; code: string; createdAt: number; expiresAt: number; attempts: number; consumed: boolean }
interface MockRefresh { token: string; userId: string; expiresAt: number; revoked: boolean }

const PHONE_RE = /^\+[1-9]\d{6,14}$/;            // same as backend schemas/auth.py
const RESEND_COOLDOWN_MS = 60_000;               // OTP_RESEND_COOLDOWN_SECONDS
const OTP_TTL_MS = 5 * 60_000;                   // OTP_TTL_MINUTES
const MAX_ATTEMPTS = 5;                          // OTP_MAX_ATTEMPTS
const REFRESH_TTL_MS = 7 * 24 * 3600_000;        // REFRESH_TOKEN_TTL_DAYS

const err = (code: string, message: string, status: number): TransportResponse => ({ status, json: { code, message } });
const ok = (json: unknown): TransportResponse => ({ status: 200, json });
const noContent: TransportResponse = { status: 204, json: null };

export class MockTransport implements Transport {
  onOtpGenerated?: (phone: string, code: string) => void;

  private now = Date.now();
  private otps: MockOtp[] = [];
  private refreshes: MockRefresh[] = [];
  private users = new Map<string, User>();
  private seq = 0;

  advanceTime(ms: number) { this.now += ms; }

  private fakeToken(kind: string) { return `mock-${kind}-${++this.seq}-${Math.random().toString(36).slice(2)}`; }

  async request({ path, body }: TransportRequest): Promise<TransportResponse> {
    const data = (body ?? {}) as Record<string, string>;
    if (path === '/auth/otp/request') return this.otpRequest(data.phone ?? '');
    if (path === '/auth/otp/verify') return this.otpVerify(data.phone ?? '', data.code ?? '');
    if (path === '/auth/refresh') return this.refresh(data.refresh_token ?? '');
    return err('not_found', `Mock has no handler for ${path}`, 404); // loud: contract drift surfaces, never silent
  }

  private otpRequest(phone: string): TransportResponse {
    if (!PHONE_RE.test(phone)) return err('validation_error', 'phone must be E.164 format, e.g. +15550001111', 422);
    const latest = [...this.otps].reverse().find((o) => o.phone === phone);
    if (latest && this.now - latest.createdAt < RESEND_COOLDOWN_MS) {
      return err('rate_limited', 'Please wait before requesting another code', 429);
    }
    for (const o of this.otps) if (o.phone === phone && !o.consumed) o.consumed = true;
    const code = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
    this.otps.push({ phone, code, createdAt: this.now, expiresAt: this.now + OTP_TTL_MS, attempts: 0, consumed: false });
    this.onOtpGenerated?.(phone, code);
    return noContent;
  }

  private otpVerify(phone: string, code: string): TransportResponse {
    const otp = [...this.otps].reverse().find((o) => o.phone === phone && !o.consumed && o.expiresAt > this.now);
    if (!otp || otp.attempts >= MAX_ATTEMPTS) return err('auth_error', 'Invalid or expired code', 401);
    if (otp.code !== code) { otp.attempts += 1; return err('auth_error', 'Invalid or expired code', 401); }
    otp.consumed = true;
    let user = this.users.get(phone);
    if (!user) {  // JIT registration, same as backend verify_otp
      const isArtistSeed = phone === '+15550009999';
      user = {
        id: this.fakeToken('user'), phone, is_phone_verified: true,
        role: isArtistSeed ? 'artist' : 'customer',
        first_name: isArtistSeed ? 'Priya' : null,
      };
      this.users.set(phone, user);
    }
    return ok(this.issuePair(user));
  }

  private refresh(token: string): TransportResponse {
    const row = this.refreshes.find((r) => r.token === token);
    if (!row || row.revoked || row.expiresAt < this.now) return err('auth_error', 'Refresh token expired or revoked', 401);
    row.revoked = true; // rotation
    const user = this.users.get([...this.users.values()].find((u) => u.id === row.userId)!.phone)!;
    return ok(this.issuePair(user));
  }

  private issuePair(user: User): TokenPair {
    const refreshToken = this.fakeToken('refresh');
    this.refreshes.push({ token: refreshToken, userId: user.id, expiresAt: this.now + REFRESH_TTL_MS, revoked: false });
    return { access_token: this.fakeToken('access'), refresh_token: refreshToken, token_type: 'bearer', user };
  }
}
```

- [ ] **Step 5: Run mock tests**

Run: `npx jest src/api` → PASS (8 tests). (If a `resend-cooldown`-adjacent test fails, remember verify does NOT reset cooldown; only request does.)

- [ ] **Step 6: Write `src/api/real-transport.ts`**

```ts
import type { Transport, TransportRequest, TransportResponse } from './transport';
import { ApiError } from './types';

const BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000').replace(/\/$/, '');

export class RealTransport implements Transport {
  async request({ method, path, body, headers }: TransportRequest): Promise<TransportResponse> {
    try {
      const res = await fetch(`${BASE_URL}/api/v1${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const json = res.status === 204 ? null : await res.json().catch(() => null);
      return { status: res.status, json };
    } catch (e) {
      // Network errors become typed ApiErrors so screens can show the retry banner — never a silent reject.
      throw new ApiError('network_error', 'Network unreachable. Check your connection.', 0);
    }
  }
}
```


- [ ] **Step 7: Write `src/api/client.ts`**

Why a "session bridge" instead of importing AuthProvider: `client.ts` must not depend on React (it's used inside providers, tests, and interceptors). The provider injects two functions at mount; the client stays pure and testable, and the 401→refresh→replay logic lives in exactly one file.

```ts
import type { Transport } from './transport';
import { RealTransport } from './real-transport';
import { MockTransport } from './mock/transport';
import { ApiError } from './types';
import type { TokenPair } from './types';

/** THE parallel-build seam: one line decides mock vs real for the whole app. */
export const transport: Transport =
  process.env.EXPO_PUBLIC_USE_MOCKS === 'true' ? new MockTransport() : new RealTransport();

export interface SessionBridge {
  getAccessToken: () => string | null;
  refreshSession: () => Promise<TokenPair | null>; // must return null on failure, never throw
}
let bridge: SessionBridge | null = null;
export function configureSessionBridge(b: SessionBridge | null) { bridge = b; }

export async function request<T>(path: string, body?: unknown, opts: { auth?: boolean } = {}): Promise<T> {
  const call = () =>
    transport.request({
      method: 'POST',
      path,
      body,
      headers: opts.auth && bridge?.getAccessToken() ? { Authorization: `Bearer ${bridge.getAccessToken()}` } : undefined,
    });

  let res = await call();
  if (res.status === 401 && opts.auth && bridge) {
    const pair = await bridge.refreshSession(); // bridge dedupes concurrent refreshes
    if (!pair) throw toApiError(res);           // refresh failed → surface the original 401
    res = await call();                          // replay once with the new access token
  }
  if (res.status >= 400) throw toApiError(res);
  return res.json as T; // 204 → null, fine for request<void>
}

function toApiError(res: { status: number; json: unknown }): ApiError {
  const j = (res.json ?? {}) as { code?: string; message?: string };
  return new ApiError(
    j.code ?? 'server_error',
    j.message ?? 'Something went wrong. Please try again.',
    res.status,
  );
}
```

- [ ] **Step 8: Write `src/api/endpoints/auth.ts`**

```ts
import { request } from '../client';
import type { TokenPair } from '../types';

// Mirrors the backend contract table (spec §3) — keep paths/statuses in lockstep with backend plan Tasks 3–4.
export function requestOtp(phone: string) {
  return request<void>('/auth/otp/request', { phone });
}
export function verifyOtp(phone: string, code: string) {
  return request<TokenPair>('/auth/otp/verify', { phone, code });
}
export function refreshSession(refreshToken: string) {
  return request<TokenPair>('/auth/refresh', { refresh_token: refreshToken });
}
```

- [ ] **Step 9: Commit**

```bash
git add mobile/src/api
git commit -m "feat(mobile): add transport seam with contract-faithful mock auth API"
```

---

### Task 5: Session store + AuthProvider state machine

**Files:**
- Create: `src/auth/session-store.ts`, `src/auth/auth-provider.tsx`, `src/auth/__tests__/auth-provider.test.tsx`

Why: this is the four-transition state machine from the spec (restore → requestOtp → verified → signedOut). Tokens go in **SecureStore, not AsyncStorage** — they're credentials. The restore-on-mount path calls `POST /auth/refresh` silently so returning users never see the login screen.

- [ ] **Step 1: Write failing `src/auth/__tests__/auth-provider.test.tsx`**

Each test uses a **distinct phone number** because the `MockTransport` singleton keeps cooldown state across tests (importing fresh per file, not per test — simpler, and the distinct-phone rule is documented here precisely so it isn't mistaken for flakiness).

```tsx
import { render, screen, waitFor, act } from '@testing-library/react-native';
import { Text, Pressable } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { AuthProvider, useAuth } from '../auth-provider';
import { transport } from '../../api/client';
import { MockTransport } from '../../api/mock/transport';

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    setItemAsync: (k: string, v: string) => Promise.resolve(store.set(k, v)),
    getItemAsync: (k: string) => Promise.resolve(store.get(k) ?? null),
    deleteItemAsync: (k: string) => Promise.resolve(store.delete(k)),
    __store: store,
  };
});

const mock = transport as MockTransport;
const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;
const statusIs = (s: string) => () => expect(screen.getByTestId('status').props.children).toBe(s);

// Each test gets its OWN phone: the MockTransport singleton shares cooldown state across tests.
// Assert exact status via props.children — toHaveTextContent('authenticated') would also match 'unauthenticated'.
function Probe({ phone }: { phone: string }) {
  const { status, user, requestOtp, verifyOtp, signOut } = useAuth();
  return (
    <>
      <Text testID="status">{status}</Text>
      <Text testID="user">{user?.phone ?? 'none'}</Text>
      <Pressable testID="flow" onPress={async () => {
        let code = '';
        mock.onOtpGenerated = (_p, c) => { code = c; };
        await requestOtp(phone);
        await verifyOtp(phone, code);
      }}><Text>flow</Text></Pressable>
      <Pressable testID="signout" onPress={() => { void signOut(); }}><Text>signout</Text></Pressable>
    </>
  );
}

it('settles unauthenticated when no session is stored', async () => {
  render(<AuthProvider><Probe phone="+15550002222" /></AuthProvider>);
  await waitFor(statusIs('unauthenticated'));
});

it('request → verify authenticates, persists tokens, exposes user', async () => {
  render(<AuthProvider><Probe phone="+15550003333" /></AuthProvider>);
  await waitFor(statusIs('unauthenticated'));
  await act(async () => { screen.getByTestId('flow').props.onPress(); });
  await waitFor(statusIs('authenticated'));
  expect(screen.getByTestId('user')).toHaveTextContent('+15550003333');
  expect(store.get('ac.access_token')).toBeTruthy();
  expect(store.get('ac.refresh_token')).toBeTruthy();
});

it('restore path: stored refresh token skips login on remount (simulates app restart)', async () => {
  const { unmount } = render(<AuthProvider><Probe phone="+15550004444" /></AuthProvider>);
  await waitFor(statusIs('unauthenticated'));
  await act(async () => { screen.getByTestId('flow').props.onPress(); });
  await waitFor(statusIs('authenticated'));
  unmount();
  render(<AuthProvider><Probe phone="+15550004444" /></AuthProvider>);
  await waitFor(statusIs('authenticated')); // never touched the login screen after restart
});

it('signOut clears the session', async () => {
  render(<AuthProvider><Probe phone="+15550005555" /></AuthProvider>);
  await waitFor(statusIs('unauthenticated'));
  await act(async () => { screen.getByTestId('flow').props.onPress(); });
  await waitFor(statusIs('authenticated'));
  await act(async () => { screen.getByTestId('signout').props.onPress(); });
  await waitFor(statusIs('unauthenticated'));
  expect(store.size).toBe(0);
});
```

Run: `npx jest src/auth` → FAIL (modules missing).

- [ ] **Step 2: Write `src/auth/session-store.ts`**

```ts
import * as SecureStore from 'expo-secure-store';
import type { TokenPair } from '../api/types';

const ACCESS_KEY = 'ac.access_token';
const REFRESH_KEY = 'ac.refresh_token';

export const sessionStore = {
  async save(pair: TokenPair): Promise<void> {
    await SecureStore.setItemAsync(ACCESS_KEY, pair.access_token);
    await SecureStore.setItemAsync(REFRESH_KEY, pair.refresh_token);
  },
  async getRefreshToken(): Promise<string | null> {
    return SecureStore.getItemAsync(REFRESH_KEY);
  },
  async clear(): Promise<void> {
    await SecureStore.deleteItemAsync(ACCESS_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
  },
};
```

- [ ] **Step 3: Write `src/auth/auth-provider.tsx`**

```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { TokenPair, User } from '../api/types';
import { configureSessionBridge, transport } from '../api/client';
import * as authApi from '../api/endpoints/auth';
import { sessionStore } from './session-store';
import { MockTransport } from '../api/mock/transport';

type AuthStatus = 'restoring' | 'unauthenticated' | 'authenticated';

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  requestOtp: (phone: string) => Promise<void>;
  verifyOtp: (phone: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('restoring');
  const [user, setUser] = useState<User | null>(null);
  const accessTokenRef = useRef<string | null>(null);
  const pendingRefresh = useRef<Promise<TokenPair | null> | null>(null);

  const applyPair = useCallback(async (pair: TokenPair) => {
    accessTokenRef.current = pair.access_token;
    setUser(pair.user);
    setStatus('authenticated');
    await sessionStore.save(pair);
  }, []);

  const doRefresh = useCallback(async (): Promise<TokenPair | null> => {
    const stored = await sessionStore.getRefreshToken();
    if (!stored) return null;
    try {
      const pair = await authApi.refreshSession(stored);
      await applyPair(pair);
      return pair;
    } catch {
      // Refresh failure IS the logout signal: no silent half-authenticated state.
      accessTokenRef.current = null;
      setUser(null);
      setStatus('unauthenticated');
      await sessionStore.clear();
      return null;
    }
  }, [applyPair]);

  const refreshSession = useCallback(async () => {
    // Dedupe: concurrent 401s share one refresh instead of stampeding rotation (a rotated token dies on second use).
    if (!pendingRefresh.current) pendingRefresh.current = doRefresh().finally(() => { pendingRefresh.current = null; });
    return pendingRefresh.current;
  }, [doRefresh]);

  useEffect(() => {
    configureSessionBridge({ getAccessToken: () => accessTokenRef.current, refreshSession });
    (async () => {
      const stored = await sessionStore.getRefreshToken();
      if (!stored) { setStatus('unauthenticated'); return; }
      await refreshSession(); // success → authenticated (via applyPair); failure → unauthenticated (via catch)
    })();
    return () => configureSessionBridge(null);
  }, [refreshSession]);

  const value = useMemo<AuthContextValue>(() => ({
    status,
    user,
    requestOtp: (phone) => authApi.requestOtp(phone),
    verifyOtp: async (phone, code) => { await applyPair(await authApi.verifyOtp(phone, code)); },
    signOut: async () => {
      accessTokenRef.current = null;
      setUser(null);
      setStatus('unauthenticated');
      await sessionStore.clear();
    },
  }), [status, user, applyPair]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** OTP screen helper: surface the generated code in mock mode (mirrors backend console-SMS). No-op against real transport. */
export function useMockOtpListener(cb: (phone: string, code: string) => void) {
  useEffect(() => {
    if (transport instanceof MockTransport) {
      transport.onOtpGenerated = cb;
      return () => { transport.onOtpGenerated = undefined; };
    }
    return undefined;
  }, [cb]);
}
```

- [ ] **Step 4: Run tests**

Run: `npx jest src/auth` → PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add mobile/src/auth
git commit -m "feat(mobile): add secure session store and auth state machine"
```

---

### Task 6: PhoneInput + OtpInput components

**Files:**
- Create: `src/components/PhoneInput.tsx`, `src/components/OtpInput.tsx`, `src/components/__tests__/otp-input.test.tsx`

Why: the two flow-critical inputs deserve their own task (and tests) — auto-advance, paste distribution, backspace navigation, and iOS autofill are exactly the interactions that break silently if untested.

- [ ] **Step 1: Write failing `src/components/__tests__/otp-input.test.tsx`**

```tsx
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme/theme-provider';
import { OtpInput } from '../OtpInput';

const wrap = (onComplete: (code: string) => void) =>
  render(<ThemeProvider><OtpInput onComplete={onComplete} /></ThemeProvider>);

it('typing digits auto-advances and fires onComplete exactly once at six digits', () => {
  const onComplete = jest.fn();
  wrap(onComplete);
  const boxes = screen.getAllByTestId(/otp-box-\d/);
  '123456'.split('').forEach((d, i) => fireEvent.changeText(boxes[i], d));
  expect(onComplete).toHaveBeenCalledTimes(1);
  expect(onComplete).toHaveBeenCalledWith('123456');
});

it('pasting 6 digits into the first box distributes them across boxes and completes', () => {
  const onComplete = jest.fn();
  wrap(onComplete);
  fireEvent.changeText(screen.getByTestId('otp-box-0'), '234567');
  expect(onComplete).toHaveBeenCalledWith('234567');
  expect(screen.getAllByTestId(/otp-box-\d/).map((b) => b.props.value)).join('').toBe('234567');
});

it('error=true clears digits so the user can retry immediately', () => {
  const onComplete = jest.fn();
  const { rerender } = render(<ThemeProvider><OtpInput onComplete={onComplete} /></ThemeProvider>);
  const boxes = screen.getAllByTestId(/otp-box-\d/);
  '123456'.split('').forEach((d, i) => fireEvent.changeText(boxes[i], d));
  rerender(
    <ThemeProvider>
      <OtpInput onComplete={onComplete} error />
    </ThemeProvider>,
  );
  expect(screen.getAllByTestId(/otp-box-\d/).every((b) => b.props.value === '')).toBe(true);
});
```

Run: `npx jest src/components/__tests__/otp-input` → FAIL.

- [ ] **Step 2: Write `src/components/OtpInput.tsx`**

```tsx
import { Animated, TextInput, View } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { useTheme } from '../theme/theme-provider';

interface Props {
  length?: number;
  onComplete: (code: string) => void;
  error?: boolean;   // parent sets true on 401; toggling back re-arms input
  busy?: boolean;    // parent sets true while verifying
}

export function OtpInput({ length = 6, onComplete, error = false, busy = false }: Props) {
  const theme = useTheme();
  const [digits, setDigits] = useState<string[]>(Array(length).fill(''));
  const inputs = useRef<(TextInput | null)[]>([]);
  const shake = useRef(new Animated.Value(0)).current;
  const completedFor = useRef<string | null>(null); // onComplete fires once per code, not per keystroke

  useEffect(() => {
    if (!error) return;
    setDigits(Array(length).fill(''));
    completedFor.current = null;
    inputs.current[0]?.focus();
    shake.setValue(0);
    Animated.sequence([
      Animated.timing(shake, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }, [error, length, shake]);

  const tryComplete = (next: string[]) => {
    const code = next.join('');
    if (next.every((d) => d !== '') && completedFor.current !== code) {
      completedFor.current = code;
      onComplete(code);
    }
  };

  const setDigit = (i: number, raw: string) => {
    const clean = raw.replace(/\D/g, '');
    if (clean.length > 1) {  // autofill/paste lands as one string in the focused box — distribute it
      const next = Array(length).fill('');
      clean.slice(0, length).split('').forEach((c, idx) => { next[idx] = c; });
      setDigits(next);
      inputs.current[Math.min(clean.length, length) - 1]?.focus();
      tryComplete(next);
      return;
    }
    const next = [...digits];
    next[i] = clean;
    setDigits(next);
    if (clean && i < length - 1) inputs.current[i + 1]?.focus();
    tryComplete(next);
  };

  const onBackspace = (i: number) => {
    const next = [...digits];
    if (next[i]) next[i] = '';
    else if (i > 0) { next[i - 1] = ''; inputs.current[i - 1]?.focus(); }
    setDigits(next);
  };

  return (
    <Animated.View
      style={{ transform: [{ translateX: shake }], gap: theme.spacing.sm, flexDirection: 'row', justifyContent: 'center' }}
    >
      {digits.map((d, i) => (
        <TextInput
          key={i}
          testID={`otp-box-${i}`}
          ref={(el) => { inputs.current[i] = el; }}
          value={d}
          onChangeText={(v) => setDigit(i, v)}
          onKeyPress={(e) => { if (e.nativeEvent.key === 'Backspace') onBackspace(i); }}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          autoFocus={i === 0}
          editable={!busy}
          maxLength={length - i} // first box accepts a paste; later boxes accept the remainder
          style={{
            width: 48,
            height: 58,
            borderRadius: theme.radii.md,
            borderWidth: error ? 2 : 1.5,
            borderColor: error ? theme.colors.error : theme.colors.border,
            backgroundColor: theme.colors.inputBackground,
            textAlign: 'center',
            fontSize: 22,
            fontFamily: theme.typography.subtitle.fontFamily,
            color: theme.colors.textPrimary,
          }}
        />
      ))}
    </Animated.View>
  );
}
```

- [ ] **Step 3: Run OTP tests**

Run: `npx jest src/components/__tests__/otp-input` → PASS (3 tests).

- [ ] **Step 4: Write `src/components/PhoneInput.tsx`**

Country chip + national digits; emits a full E.164 string on every change so the screen validates exactly what the backend will see.

```tsx
import { Pressable, TextInput, View, Modal, FlatList } from 'react-native';
import { useState } from 'react';
import { useTheme } from '../theme/theme-provider';
import { AppText } from './AppText';

const COUNTRIES = [
  { code: '+91', name: 'India' }, { code: '+1', name: 'USA / Canada' }, { code: '+44', name: 'UK' },
  { code: '+971', name: 'UAE' }, { code: '+966', name: 'Saudi Arabia' }, { code: '+62', name: 'Indonesia' },
  { code: '+60', name: 'Malaysia' }, { code: '+880', name: 'Bangladesh' }, { code: '+92', name: 'Pakistan' },
  { code: '+234', name: 'Nigeria' }, { code: '+254', name: 'Kenya' }, { code: '+27', name: 'South Africa' },
];

interface Props {
  /** Full E.164 value, e.g. '+919876543210' */
  value: string;
  onChange: (e164: string) => void;
}

export function PhoneInput({ value, onChange }: Props) {
  const theme = useTheme();
  const [pickerOpen, setPickerOpen] = useState(false);
  const country = COUNTRIES.find((c) => value.startsWith(c.code)) ?? COUNTRIES[0];
  const national = value.slice(country.code.length).replace(/\D/g, '');

  const emit = (code: string, nat: string) => onChange(code + nat);

  return (
    <View>
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center' }}>
        <Pressable
          testID="country-code-chip"
          onPress={() => setPickerOpen(true)}
          style={{
            height: 52, paddingHorizontal: theme.spacing.md, borderRadius: theme.radii.md,
            borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.inputBackground,
            alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4,
          }}
        >
          <AppText variant="subtitle" style={{ color: theme.colors.textPrimary }}>{country.code} ▾</AppText>
        </Pressable>
        <TextInput
          testID="phone-national"
          value={national}
          onChangeText={(t) => emit(country.code, t.replace(/\D/g, ''))}
          keyboardType="phone-pad"
          placeholder="98765 43210"
          placeholderTextColor={theme.colors.textMuted}
          style={{
            flex: 1, height: 52, borderRadius: theme.radii.md, borderWidth: 1,
            borderColor: theme.colors.border, backgroundColor: theme.colors.inputBackground,
            color: theme.colors.textPrimary, paddingHorizontal: theme.spacing.md,
            fontSize: theme.typography.body.fontSize, fontFamily: theme.typography.body.fontFamily,
          }}
        />
      </View>
      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: '#00000088', justifyContent: 'flex-end' }} onPress={() => setPickerOpen(false)}>
          <View style={{ backgroundColor: theme.colors.surface, borderTopLeftRadius: theme.radii.card, borderTopRightRadius: theme.radii.card, padding: theme.spacing.md, maxHeight: 420 }}>
            <FlatList
              data={COUNTRIES}
              keyExtractor={(c) => c.code}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => { emit(item.code, national); setPickerOpen(false); }}
                  style={{ paddingVertical: theme.spacing.sm, flexDirection: 'row', justifyContent: 'space-between' }}
                >
                  <AppText variant="body" style={{ color: theme.colors.textPrimary }}>{item.name}</AppText>
                  <AppText variant="body" style={{ color: theme.colors.textSecondary }}>{item.code}</AppText>
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
```

- [ ] **Step 5: Run all component tests + commit**

Run: `npx jest src/components` → PASS.

```bash
git add mobile/src/components
git commit -m "feat(mobile): add phone and OTP inputs with paste/autofill handling"
```

---

### Task 7: Screens, root gate, fonts

**Files:**
- Modify: `app/_layout.tsx`, `app/(auth)/index.tsx` (replace placeholder)
- Create: `app/(auth)/_layout.tsx`, `app/(auth)/otp.tsx`, `app/(app)/_layout.tsx`, `app/(app)/index.tsx`, `app/index.tsx` is NOT needed (route group `(auth)/index` serves `/`)

Why: `_layout.tsx` composes the providers in load order (fonts before anything paints serif text, theme before components, auth before navigation decisions). The gate renders exactly one route group per status and `key={status}` remounts the stack — users can never back-navigate across the auth boundary.

- [ ] **Step 1: Root layout `app/_layout.tsx`**

```tsx
import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { ThemeProvider, useTheme } from '../src/theme/theme-provider';
import { AuthProvider, useAuth } from '../src/auth/auth-provider';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ PlayfairDisplay_700Bold, Inter_400Regular, Inter_500Medium, Inter_600SemiBold });
  useEffect(() => { if (fontsLoaded) SplashScreen.hideAsync(); }, [fontsLoaded]);
  if (!fontsLoaded) return null;
  return (
    <ThemeProvider>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </ThemeProvider>
  );
}

function Gate() {
  const { status } = useAuth();
  const theme = useTheme();
  if (status === 'restoring') {
    return <View style={{ flex: 1, backgroundColor: theme.colors.background }} />;
  }
  return (
    <Stack
      key={status}
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background } }}
    >
      {/* Declaring only the reachable group makes the other physically inaccessible. */}
      {status === 'unauthenticated' ? <Stack.Screen name="(auth)" /> : <Stack.Screen name="(app)" />}
    </Stack>
  );
}
```

- [ ] **Step 2: `(auth)` layout + Login screen `app/(auth)/_layout.tsx` + `app/(auth)/index.tsx`**

```tsx
// app/(auth)/_layout.tsx
import { Stack } from 'expo-router';
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

```tsx
// app/(auth)/index.tsx
import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { Logo } from '../../src/components/Logo';
import { AppText } from '../../src/components/AppText';
import { AppButton } from '../../src/components/AppButton';
import { PhoneInput } from '../../src/components/PhoneInput';
import { useTheme } from '../../src/theme/theme-provider';
import { useAuth } from '../../src/auth/auth-provider';
import { ApiError } from '../../src/api/types';

const PHONE_RE = /^\+[1-9]\d{6,14}$/; // same rule the backend enforces

export default function LoginScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { requestOtp } = useAuth();
  const [phone, setPhone] = useState('+91');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      await requestOtp(phone);
      router.push({ pathname: '/otp', params: { phone } });
    } catch (e) {
      const api = e as ApiError;
      setError(
        api.code === 'rate_limited' ? 'Please wait before requesting another code'
        : api.code === 'network_error' ? 'Network unreachable. Check your connection.'
        : api.message,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll>
      <View style={{ flex: 1, justifyContent: 'center', gap: theme.spacing.xl, paddingVertical: theme.spacing.xl }}>
        <Logo />
        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="title" style={{ color: theme.colors.textPrimary }}>Welcome back</AppText>
          <AppText variant="body" style={{ color: theme.colors.textSecondary }}>
            Continue with your phone number — existing or new, the number decides.
          </AppText>
        </View>
        <PhoneInput value={phone} onChange={(v) => { setError(null); setPhone(v); }} />
        {error ? (
          <AppText variant="caption" style={{ color: theme.colors.error }}>{error}</AppText>
        ) : null}
        <AppButton label="Continue" onPress={onSubmit} loading={loading} disabled={!PHONE_RE.test(phone)} />
        <AppText variant="caption" style={{ textAlign: 'center', color: theme.colors.textMuted }}>
          By continuing you agree to our Terms · Privacy
        </AppText>
      </View>
    </Screen>
  );
}
```

- [ ] **Step 3: OTP screen `app/(auth)/otp.tsx`**

```tsx
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { AppText } from '../../src/components/AppText';
import { AppButton } from '../../src/components/AppButton';
import { OtpInput } from '../../src/components/OtpInput';
import { useTheme } from '../../src/theme/theme-provider';
import { useAuth, useMockOtpListener } from '../../src/auth/auth-provider';
import { ApiError } from '../../src/api/types';

export default function OtpScreen() {
  const { phone = '' } = useLocalSearchParams<{ phone: string }>();
  const theme = useTheme();
  const { verifyOtp, requestOtp } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const [mockCode, setMockCode] = useState<string | null>(null);

  useMockOtpListener(useCallback((_p: string, code: string) => setMockCode(code), []));

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  const submit = async (code: string) => {
    setBusy(true);
    setError(null);
    setShaking(false);
    try {
      await verifyOtp(phone, code); // success → gate flips to (app); nothing to navigate here
    } catch (e) {
      const api = e as ApiError;
      setError(api.code === 'network_error' ? api.message : 'Invalid or expired code');
      setShaking(true); // clears + shakes OtpInput; reset below so a same-code retry re-triggers it
      setTimeout(() => setShaking(false), 350);
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    try {
      await requestOtp(phone);
      setSecondsLeft(60);
      setError(null);
    } catch (e) {
      setError((e as ApiError).code === 'rate_limited' ? 'Please wait before requesting another code' : (e as ApiError).message);
    }
  };

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center', gap: theme.spacing.xl }}>
        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="title" style={{ color: theme.colors.textPrimary }}>Verify your number</AppText>
          <AppText variant="body" style={{ color: theme.colors.textSecondary }}>Code sent to {phone}</AppText>
        </View>
        {mockCode ? (
          <AppText variant="caption" style={{ color: theme.colors.accent }}>
            Mock mode: your code is {mockCode}
          </AppText>
        ) : null}
        <OtpInput onComplete={submit} error={shaking} busy={busy} />
        {error ? <AppText variant="caption" style={{ color: theme.colors.error }}>{error}</AppText> : null}
        <AppButton label={secondsLeft > 0 ? `Resend code in 0:${String(secondsLeft).padStart(2, '0')}` : 'Resend code'} onPress={resend} variant="ghost" disabled={secondsLeft > 0} />
      </View>
    </Screen>
  );
}
```

- [ ] **Step 4: Placeholder home `app/(app)/_layout.tsx` + `app/(app)/index.tsx`**

```tsx
// app/(app)/_layout.tsx
import { Stack } from 'expo-router';
export default function AppLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

```tsx
// app/(app)/index.tsx
import { View } from 'react-native';
import { Screen } from '../../src/components/Screen';
import { AppText } from '../../src/components/AppText';
import { AppButton } from '../../src/components/AppButton';
import { useTheme } from '../../src/theme/theme-provider';
import { useAuth } from '../../src/auth/auth-provider';

export default function HomeScreen() {
  const theme = useTheme();
  const { user, signOut } = useAuth();
  const name = user?.first_name ?? user?.phone ?? '';
  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: theme.spacing.lg }}>
        <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: theme.colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
          <AppText variant="title" style={{ color: theme.colors.brand }}>{name.slice(0, 1).toUpperCase()}</AppText>
        </View>
        <View style={{ alignItems: 'center', gap: theme.spacing.xs }}>
          <AppText variant="title" style={{ color: theme.colors.textPrimary }}>Welcome, {name}</AppText>
          <View style={{ paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.xs, borderRadius: theme.radii.pill, backgroundColor: theme.colors.brandSoft }}>
            <AppText variant="caption" style={{ color: theme.colors.brand, textTransform: 'capitalize' }}>{user?.role}</AppText>
          </View>
        </View>
        <AppText variant="body" style={{ color: theme.colors.textSecondary, textAlign: 'center' }}>
          Signed in — discover, bookings and profile arrive in the next increment.
        </AppText>
        <AppButton label="Sign out" variant="ghost" onPress={signOut} />
      </View>
    </Screen>
  );
}
```

- [ ] **Step 5: Delete the Task-1 placeholder route and verify manually**

`app/(auth)/index.tsx` was already replaced in Step 2. Run: `npx expo start` → open on iOS simulator (and Android emulator) and walk:

1. Cold start on mock mode → login screen renders with Playfair headings (fonts bundled, no runtime fetch).
2. Invalid phone → Continue stays disabled; `+91` + 10 digits → enabled.
3. Continue → OTP screen; "Mock mode: your code is …" banner shows the code; countdown running.
4. Tap code (or paste) → auto-submit → home with role chip + greeting.
5. Reload app (Cmd-R / restart) → lands straight on home (restore via refresh path).
6. Sign out → login screen; SecureStore cleared.
7. Wrong code → shake + inline error + digits cleared; iOS autofill fills and submits in one gesture.

Expected: no redboxes; every screen keeps the blush background through navigation.

- [ ] **Step 6: Commit**

```bash
git add mobile/app
git commit -m "feat(mobile): add gated auth flow screens (login, OTP, home)"
```

---

### Task 8: Docs, lint, full green suite

**Files:**
- Create: `mobile/README.md`
- Modify: nothing in code (unless lint fixes required)

- [ ] **Step 1: Write `mobile/README.md`**

````markdown
# Art Circle Mobile

Expo + expo-router. Increment 1: feminine design system + phone/OTP auth (mockable API seam).

## Run
```bash
cd mobile
npm install
npm start          # then press i (iOS) or a (Android)
```

## Configuration (.env)
```text
EXPO_PUBLIC_USE_MOCKS=true                # in-memory auth API; flip false to hit FastAPI
EXPO_PUBLIC_API_URL=http://localhost:8000 # iOS simulator
# Android emulator: use http://10.0.2.2:8000 instead
```

Backend integration walkthrough: start `uvicorn app.main:app --reload` in `backend/`, read OTPs from the server console (dev SMS provider), set `EXPO_PUBLIC_USE_MOCKS=false`, restart Metro with `-c` (env is baked at bundle time).

## Test
```bash
npm test
```

## Theme guide (why three layers)
- Change a color once: edit `src/theme/tokens/palette.ts`.
- Re-assign meaning (brand → terracotta?): edit `src/theme/themes/light.ts`.
- New theme (dark/festive): copy `light.ts` → `dark.ts` (same `Theme` interface, TypeScript lists missing roles) and pass it to `ThemeProvider`.
- Never hardcode colors/sizes in components — they read only `useTheme()` semantic roles.

## Structure
`app/` routes only · `src/theme` design system · `src/components` UI primitives · `src/auth` state machine + SecureStore · `src/api` transport seam (mock ↔ real).
````

- [ ] **Step 2: Lint + full suite**

```bash
cd mobile
npx expo lint
npm test
```

Expected: lint clean (fix any rule findings); all suites pass: theme, components, mock-transport, auth-provider.

- [ ] **Step 3: Commit**

```bash
git add mobile
git commit -m "docs(mobile): add README with run/config/theme guide; green full suite"
```

- [ ] **Step 4: Silent-failure sweep (code review gate)**

Dispatch the `silent-failure-hunter` review over the diff `git log --oneline` range of Tasks 1–8. Checklist to verify by hand too: every `catch` in `src/` maps to UI state or re-throws — allowed catches are exactly `client.ts` (never catches — it throws typed `ApiError`), `real-transport.ts` (network → `ApiError`), `auth-provider.ts` doRefresh catch (→ signed-out), screens' submit catches (→ inline errors). Anything else is a plan violation; fix it.

---

### Task 9: Re-theme to the nude / cocoa palette (added 2026-10-10)

The product owner picked a new visual reference: peach-nude backgrounds, a cocoa-brown primary, tan chips and serif headings. The fonts already changed in `1744ab9` (Cormorant Garamond + Plus Jakarta Sans). This task swaps the colours. Because of the three-layer rule, only Layer 1 and Layer 2 files change, and no component is touched.

**Spec:** §1 Layer 1 palette v2 and Layer 2 mapping. §8 (Home / Categories / Booking direction) is reference only and is **not** built here.

**Files:**
- Modify: `mobile/src/theme/tokens/palette.ts`
- Modify: `mobile/src/theme/themes/light.ts`
- Modify: `mobile/src/theme/tokens/shadows.ts` (shadow colour follows the new ink900)
- Modify: `mobile/src/__tests__/theme.test.ts`
- Modify: `mobile/README.md` (theme-guide example only, if it names plum/terracotta)

- [ ] **Step 1: Update the theme test first (it should fail)**

Replace the identity test in `src/__tests__/theme.test.ts`:

```ts
it('maps brand to cocoa and background to nude (v2 identity)', () => {
  expect(lightTheme.colors.brand).toBe(palette.cocoa500);
  expect(lightTheme.colors.brandPressed).toBe(palette.cocoa700);
  expect(lightTheme.colors.background).toBe(palette.nude100);
  expect(lightTheme.colors.accent).toBe(palette.tan600);
});
```

Run: `npx jest src/__tests__/theme.test.ts`. Expected: FAIL, because `palette.cocoa500` is undefined.

- [ ] **Step 2: Replace the palette**

`src/theme/tokens/palette.ts`:

```ts
// v2 nude / cocoa palette (reference 2026-10-10). White text only on cocoa*; on tan/nude fills use ink900 or cocoa700.
export const palette = {
  nude100: '#FBF3EE', nude300: '#F3DFD1', nude500: '#E6C9B4',
  tan400: '#D2AC8E', tan600: '#B8876A',
  cocoa500: '#7A5444', cocoa700: '#5A3B2F',
  gold400: '#D9A56C', sage500: '#A8BFA5',
  cream: '#FFFBF8', white: '#FFFFFF',
  ink900: '#3B2A23', ink600: '#7D6A60', ink400: '#AE9D93',
  error500: '#C24A4A', error100: '#F9E3E3',
  scrim: '#3B2A2388', // ink900 at ~53% alpha, for modal backdrops
} as const;
```

- [ ] **Step 3: Remap the semantic roles**

In `src/theme/themes/light.ts`, change only these lines:

```ts
    background: palette.nude100,
    brand: palette.cocoa500,
    brandPressed: palette.cocoa700,
    brandSoft: palette.nude300,
    accent: palette.tan600,
    separator: palette.nude500,
    border: palette.nude500,
    borderFocus: palette.tan600,
```

All other roles keep the same keys and resolve to the new values automatically: surface, the three text colours, textOnBrand, inputBackground, error, errorBackground, success and overlay.

- [ ] **Step 4: Shadow colour**

In `src/theme/tokens/shadows.ts`, replace `'#3A2530'` with `'#3B2A23'` (all three levels). Change the comment to: `// Warm-tinted soft shadows: low-alpha brown ink (gray shadows read cold).`

- [ ] **Step 5: Verify**

```bash
cd mobile
grep -rn "blush\|plum\|rose\|terra" src app   # expect: no matches
npx jest && npx tsc --noEmit && npx expo lint
```

Expected: all suites pass, tsc and lint clean.

Then do a manual check in Expo Go. On Login, the Continue button is cocoa with white text, the background is nude, and the focused input ring is tan. On OTP, the boxes have nude borders, and the wrong-code state is still red.

- [ ] **Step 6: Commit**

```bash
git add mobile/src/theme mobile/src/__tests__/theme.test.ts mobile/README.md
git commit -m "feat(mobile): re-theme to nude/cocoa palette (v2 reference)"
```

**Not in this task (Increment 2):** the home hero, the categories row, booking screens, and any new semantic roles they need. Examples are `chip`, `chipSelected` and `rating`. Add each role in the increment whose screen first uses it, following spec §8.
