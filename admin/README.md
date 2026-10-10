# Atelier admin

Internal web console for Art Circle: manage service categories (**Catalog**) and approve or reject artist profiles (**Verification**). It's React + Vite + TypeScript, with shadcn/ui (Base UI + Tailwind v4, using the Atelier palette), TanStack Query, React Router, react-hook-form + zod, and sonner.

## Run

```bash
npm install
npm run dev          # http://localhost:5173, talks to http://localhost:8000/api/v1
```

Point it at another API with `VITE_API_URL=http://host:port/api/v1 npm run dev`.

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
    categories/   Catalog page, create/edit dialog, queries
    artists/      Verification queue, review page, queries
  pages/          LoginPage
  components/     AppShell (sidebar), PageHeader, ui/ (shadcn)
```

Add shadcn components with `npx shadcn@latest add <name>`.
