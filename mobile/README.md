# Art Circle Mobile

Expo + expo-router. Feminine "Atelier" design system, phone/OTP auth, sign-up and Choose role onboarding, on a typed API seam.

## Run
```bash
cd mobile
npm install        # .npmrc sets legacy-peer-deps=true (RNTL 14 / react-dom peer conflict)
npm start          # then press i (iOS) or a (Android)
```

### Run on your phone
1. Install **Expo Go** on your phone.
2. Put the phone on the same Wi-Fi as your computer.
3. `npm start`, then scan the QR code (or enter `exp://<your-LAN-IP>:8081` manually in Expo Go).

## Configuration (.env)
```text
EXPO_PUBLIC_API_URL=http://localhost:8000 # iOS simulator
# Android emulator: use http://10.0.2.2:8000 instead
```

The OTP screen reads codes from the backend's dev SMS provider (server console). Existing numbers sign straight in; new ones route through sign-up and Choose role.

### Artist onboarding

Choose role → "Create your profile" runs Intro → Profile → Services → Portfolio → Identity → In review.
Identity accepts only Verhoeff-valid Aadhaar numbers: use generated ones such as `234123412346` in dev, never a real one.
With the backend's `STORAGE_PROVIDER=fake`, uploads are skipped and photos show as broken images.

`expo-image-picker` and `expo-image-manipulator` are native modules: an existing dev client or the local `android/` prebuild must be rebuilt (`npx expo prebuild --clean`, then `npx expo run:android` / `run:ios`). Expo Go works as is.

Backend integration walkthrough: start `uvicorn app.main:app --reload` in `backend/` and read OTPs from the server console (dev SMS provider). Restart Metro with `-c` (env is baked at bundle time).

Testing against the backend on a physical phone: `localhost` is the phone itself, so set `EXPO_PUBLIC_API_URL=http://<your-LAN-IP>:8000` and bind the server to all interfaces with `uvicorn app.main:app --reload --host 0.0.0.0`.

## Test and lint
```bash
npm test
npm run lint
```

## Theme guide (why three layers)
- Change a color once: edit `src/theme/tokens/palette.ts`.
- Re-assign meaning (brand -> terracotta?): edit `src/theme/themes/light.ts`.
- New theme (dark/festive): copy `light.ts` -> `dark.ts` (same `Theme` interface, TypeScript lists missing roles) and pass it to `ThemeProvider`.
- Never hardcode colors/sizes in components; they read only `useTheme()` semantic roles.

## Structure
- `app/` routes only, grouped by phase:
  - `(auth)/`: `welcome`, `login`, `otp`
  - `(onboarding)/`: `signup`, `choose-role`
  - `customer/`, `artist/`: role home areas
  - `index.tsx`: the `/` redirect hub
- `app/_layout.tsx` wraps each area in `Stack.Protected`. `destination()` in `src/auth/routing.ts` picks exactly one area from the server's user (`is_onboarded`, `role`), so the guards and the `/` hub always agree.
- `src/theme` design system · `src/components` UI primitives · `src/auth` session state, routing and SecureStore · `src/api` transport seam (real FastAPI) plus `endpoints/` (`auth`, `account`).
