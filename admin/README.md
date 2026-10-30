# Atelier admin

Internal web console for Art Circle: build the service catalog (**Catalog**), approve or reject artist profiles (**Verification**), and review the services approved artists add outside the catalog (**Custom services**). It's React + Vite + TypeScript, with shadcn/ui (Base UI + Tailwind v4, using the Atelier palette), TanStack Query, React Router, react-hook-form + zod, and sonner.

## Run

```bash
npm install
npm run dev          # http://localhost:5173, API through Vite's /api proxy → http://localhost:8000/api/v1
```

Dev keeps the API **same-origin** (Vite forwards `/api`, exactly like `vercel.json` does in production), so the httpOnly `ac_refresh` cookie stays first-party and a reload restores the session. Forward it elsewhere with `VITE_DEV_API_TARGET=http://host:port npm run dev`; to skip the proxy and hit a backend directly, `npm run dev -- --mode local` (reads `VITE_API_URL` from `.env.local`).

## Signing in

Admins use the same phone + OTP sign-in as the mobile app; any other role is refused. To make an account an admin, run this from `backend/`:

```bash
.venv/bin/python -m app.scripts.make_admin +919845012345
```

With `SMS_PROVIDER=console`, the OTP is printed in the backend log.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm test` | Vitest + Testing Library, against an in-memory fake API |
| `npm run typecheck` | `tsc -b` |
| `npm run lint` | oxlint |
| `npm run build` | Production build into `dist/` |

## Layout

```
src/
  lib/            api client (token refresh), auth context, types, formatting
  features/
    categories/   Catalog: categories and subcategories (left), the selected subcategory's services (right, ?sub=), dialogs, queries
    artists/      Verification queue, review page, queries
    custom-services/  Custom services queue with approve / reject, queries
  pages/          LoginPage
  components/     AppShell (sidebar), PageHeader, RejectReasonDialog, ui/ (shadcn)
```

**Fill in the catalog before artists onboard.** Artists can only add services from the catalog during onboarding, so every active category needs at least one active subcategory with services. New categories and subcategories start as **Draft** (admin-only); switch them to **Active** when they're ready.

Add shadcn components with `npx shadcn@latest add <name>`.
