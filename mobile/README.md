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
# Optional in development: unset, the app uses the Metro host on port 8000 (simulator, emulator, phone or web).
# Required for release builds:
EXPO_PUBLIC_API_URL=https://api.example.com
```

The OTP screen reads codes from the backend's dev SMS provider (server console). Existing numbers sign straight in; new ones route through sign-up and Choose role.

### Artist onboarding

Choose role → "Create your profile" runs Intro → Profile → Services → Portfolio → Identity → In review.
Identity accepts only Verhoeff-valid Aadhaar numbers: use generated ones such as `234123412346` in dev, never a real one.
With the backend's `STORAGE_PROVIDER=fake`, uploads are skipped and photos show as broken images.

`expo-image-picker` and `expo-image-manipulator` are native modules: an existing dev client or the local `android/` prebuild must be rebuilt (`npx expo prebuild --clean`, then `npx expo run:android` / `run:ios`). Expo Go works as is.

Backend integration walkthrough: start `uvicorn app.main:app --reload` in `backend/` and read OTPs from the server console (dev SMS provider). Restart Metro with `-c` (env is baked at bundle time).

Testing against the backend on a physical phone: in development the app calls the API on the machine that serves Metro (your current LAN IP), so no `.env` edit is needed when your network changes; just bind the server to all interfaces with `./dev.sh --lan` (or `uvicorn app.main:app --reload --host 0.0.0.0`). Set `EXPO_PUBLIC_API_URL` only to use a different API.

### Push notifications

Signed-in users are asked for notification permission and the device is registered with `POST /notifications/devices` (removed on sign-out); tapping a push opens its in-app link. Expo push tokens need an EAS project id: run `npx eas init` once so `app.json` gets `extra.eas.projectId`. Without it the app skips push registration and the in-app inbox still works. `expo-notifications` is a native module, so rebuild the dev client. Android in Expo Go cannot receive pushes. On the backend set `PUSH_PROVIDER=expo` to send real pushes (`console` only logs them).

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
