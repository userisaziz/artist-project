# Art Circle Mobile

Expo + expo-router. Increment 1: feminine design system + phone/OTP auth (mockable API seam).

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
EXPO_PUBLIC_USE_MOCKS=true                # in-memory auth API; flip false to hit FastAPI
EXPO_PUBLIC_API_URL=http://localhost:8000 # iOS simulator
# Android emulator: use http://10.0.2.2:8000 instead
```

In mock mode the OTP screen shows "Mock mode: your code is ...", and `+15550009999` signs in as an artist.

Backend integration walkthrough: start `uvicorn app.main:app --reload` in `backend/`, read OTPs from the server console (dev SMS provider), set `EXPO_PUBLIC_USE_MOCKS=false`, restart Metro with `-c` (env is baked at bundle time).

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
- `app/` routes only: `app/(auth)/login.tsx`, `app/(auth)/otp.tsx`, `app/(app)/index.tsx`; `Stack.Protected` in `app/_layout.tsx` gates auth vs app.
- `src/theme` design system · `src/components` UI primitives · `src/auth` state machine + SecureStore · `src/api` transport seam (mock <-> real).
