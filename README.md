# Art Circle

A marketplace connecting customers with artists (mehendi, makeup, and similar services). Customers browse and book; artists offer their services.

Current state:
- **Everyone:** phone + OTP sign-in, then sign-up and a role choice.
- **Artists:** onboard with services from the admin's catalog and Aadhaar verification. Once approved, they answer booking requests, see their calendar and earnings, and mark bookings completed.
- **Customers:** browse approved artists and book a slot with a deposit. Payment is mocked for now.
- **Admins** (`admin/`, the web console): verify artists, build the catalog, review custom services, and watch and cancel bookings from Overview and Bookings.

## Repository layout

| Path | What it is |
|---|---|
| [`backend/`](backend/README.md) | FastAPI + PostgreSQL API (async SQLAlchemy, Alembic, JWT auth) |
| [`mobile/`](mobile/README.md) | Expo / React Native app (expo-router, TypeScript) |
| `docs/design/atelier/` | "Atelier" hi-fi prototype, the visual reference for the app |
| `docs/wireframes/` | Wireframes for the complete flow |
| `docs/superpowers/` | Design specs and implementation plans per increment |

## Quick start

You need: Python 3.12+, PostgreSQL (local, e.g. Homebrew), Node.js LTS, and Expo Go on a phone or an iOS/Android simulator.

```bash
# 1. Backend: API on http://localhost:8000
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # set SMS_PROVIDER=console for local dev
createdb art_circle && createdb art_circle_test
alembic upgrade head
uvicorn app.main:app --reload

# 2. Mobile: in a second terminal
cd mobile
npm install
cp .env.example .env          # EXPO_PUBLIC_USE_MOCKS=true runs without the backend
npm start
```

The mobile app can run on its own against an in-memory mock API (`EXPO_PUBLIC_USE_MOCKS=true`). To use the real backend, set it to `false` and restart Metro with `npx expo start -c`. Each sub-README has the details.

## User flow

```
welcome → login (phone) → otp → signup (name, email) → choose-role → customer | artist home

customer: home / explore → artist storefront → date & time → review & pay → booking requested → bookings
artist:   onboarding → in review → (approved) home · bookings (requests / upcoming / past) · calendar · me
```

The server is the source of truth for routing. The app reads `is_onboarded`, `first_name`, and `role` from `/api/v1/users/me` and sends the user to the right area.

## Tests

```bash
cd backend && pytest          # needs the art_circle_test database
cd mobile  && npm test && npm run lint
```
