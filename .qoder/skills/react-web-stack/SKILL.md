---
name: react-web-stack
description: Chooses and governs libraries for the GetReady admin console (admin/, React 19 + Vite 8 + react-router 8 + TanStack Query 5 + shadcn base-nova on Base UI + Tailwind v4) using a capability-first decision ladder and one approved kit per capability. Use when picking a library or pattern for the web console, when adding/upgrading/removing anything in admin/package.json, when deciding between a new dependency and the existing src/lib client or src/components primitives, or when reviewing admin/ code for a competing or redundant library.
---

# React Web Stack (admin/)

Curated against [enaqx/awesome-react](https://github.com/enaqx/awesome-react) (commit
`e6fd973`, no LICENSE file — README footer carries a CC0/BY badge), then filtered to what this
console actually needs. The approved table is [LIBRARIES.md](./LIBRARIES.md).

`admin/` has no `.qoder/rules/*` file, unlike `mobile/` and `backend/`. The enforceable contracts
are the code itself:

| Contract | Enforced by |
| --- | --- |
| Feature/shared layering | `admin/eslint.config.js` → `npm run lint:arch` (`import/no-restricted-paths`) |
| Hooks rules + export hygiene | `admin/.oxlintrc.json` → `npm run lint` |
| Types, `erasableSyntaxOnly`, `verbatimModuleSyntax` | `admin/tsconfig.app.json` → `npm run typecheck` |
| Behaviour | `admin/src/test/*` → `npm test` (vitest + jsdom + a fake fetch backend) |
| Commit gate | `.husky/pre-commit` runs `lint` + `lint:arch` for staged `admin/**` (warnings pass) |

## The defining fact about this console

`admin/` is a **static Vite SPA**, not a Next.js app: `vercel.json` rewrites `/api/*` to
`https://artist-project.onrender.com` and every other path to `/index.html`. There is no server
runtime, no SSR, no RSC, no route loader — the only server is FastAPI. Every data-fetching,
auth, and navigation decision follows from that.

Three consequences worth stating before you add anything:

- **One HTTP client.** `src/lib/api.ts` owns the in-memory access token, the httpOnly
  `ac_refresh` cookie (`credentials: 'include'` + `X-Session-Transport`), the single 401 →
  refresh → retry, `SESSION_TIMEOUT_MS` (20 s), and `ApiError.code` as the backend's stable
  contract. Nothing else in the app calls `fetch`.
- **TanStack Query is the only server cache.** `src/lib/query-client.ts` retries only
  `>= 500` twice and holds `staleTime: 30_000`. Each feature owns a `queries.ts` with a
  `*Keys` object. There is no global store (no redux/zustand/jotai) and none is needed.
- **The design system is local.** `src/index.css` (`@import "tailwindcss"` + `@theme inline`)
  reads semantic colours from `src/brand.css`, which is **generated** from `brand/tokens.json`
  by `npm run brand`. `src/lib/utils.ts` extends `cn()` so the custom steps (`text-label-lg`,
  `rounded-control`, `tracking-heading`) merge as sizes rather than colours.

## Decision ladder — run in order, stop at the first hit

1. **React 19 built-in.** `useState`/`useReducer`, `useTransition`, `useDeferredValue`,
   `useOptimistic`, `use()`, `lazy` + `Suspense`, `<form>`. Already covers most of this console
   (`src/app/page-chunks.ts` lazy-loads all 21 console pages and warms them on idle).
2. **Something already in `admin/package.json`.** React Router 8, TanStack Query 5, react-hook-form
   + zod, Base UI primitives through `src/components/ui`, sonner through `src/lib/notify.ts`,
   `input-otp`, `next-themes`, lucide icons, `cn`. Check there before proposing anything.
3. **An existing primitive in `src/components/`.** `ui/` is 21 shadcn-style components (each with a
   `.stories.tsx`); `console/` holds the grid kit every queue page reuses — `grid-row`, `grid-header`,
   `cell-label`, `panel`, `panel-toolbar`, `panel-footer`, `grid-message`, `kpi-tile`,
   `initials-avatar`. `route-error-boundary` is the app's own error boundary. Extend these; do not
   bolt a second kit next to them.
4. **A row in [LIBRARIES.md](./LIBRARIES.md)** marked `candidate`. That is the pre-approved pick for
   the capability — install it, do not re-survey the ecosystem.
5. **Only then** propose a new dependency, and record it in LIBRARIES.md **and** in the
   "Where awesome-react disagrees" table below in the same change. If a second kit for the same
   capability would be needed, the answer is *no* — pick one and note the rejected alternative.

## Where awesome-react disagrees with this repo

The list is authoritative on what exists in the React ecosystem; it is not authoritative on this
console.

| awesome-react says | Here | Why |
| --- | --- | --- |
| Frameworks: Next.js, Remix, Gatsby, Vike | **Vite 8 SPA + react-router 8** | `vercel.json` is a static build (`tsc -b && vite build`) with an `/api` rewrite and an SPA fallback. There is no server runtime to host SSR, and the API is same-origin behind that rewrite |
| shadcn-ui "built using Radix UI and Tailwind CSS" | shadcn CLI 4.21 with `"style": "base-nova"` on **`@base-ui/react` 1.9** | `components.json` pins base-nova; the primitives are Base UI, not Radix. Paste a Radix-based snippet by hand and you fork the primitive contract |
| Component libraries: antd, MUI, Chakra, Mantine, Ariakit, Headless UI | **own `src/components/ui` + `src/components/console`** | A second kit duplicates tokens and focus/state behaviour; the Atelier palette lives in `brand/tokens.json` |
| State: redux, zustand, jotai, xstate, mobx, effector | **TanStack Query for server state, `useState`/context for the rest** (`src/lib/auth-context.ts`), the URL for filters | No client store exists. Adding one duplicates the query cache and the router's URL state |
| Data fetching: SWR, Apollo, Relay | **one `fetch` client (`src/lib/api.ts`) + TanStack Query** | `api.ts` is where auth refresh, error codes and timeouts live; a second client bypasses the 401 path |
| Styling: styled-components, emotion, vanilla-extract | **Tailwind v4 CSS-first** (`@import "tailwindcss"` + `@theme inline`; no `tailwind.config.*`, no `postcss.config.*`) | v4 does not need a JS config; `@tailwindcss/vite` is the plugin. Brand steps are generated into `src/brand.css` |
| Icons: react-icons, heroicons | **lucide-react** | `components.json` sets `iconLibrary: "lucide"`; one icon set keeps stroke weight consistent |
| Routing: TanStack Router, speedy-router | **react-router 8** (`react-router`, not `react-router-dom`) | Routes are one explicit table in `src/app/routes.tsx` + `src/lib/paths.ts`; the border is `GuestOnly` / `RequireAuth` / `AppShell` |
| Testing: jest, cypress, playwright | **vitest 5 + jsdom + Testing Library**, against `src/test/fake-backend.ts` | `npm test` is the gate. The fake fetches through `API_URL` and `renderSignedIn()` starts with a refresh cookie. No E2E runner is installed — see gaps |
| Toasts: react-hot-toast | **sonner**, funnelled through `src/lib/notify.ts` | `toastError` is the single place a failed mutation becomes a toast; it also suppresses `SESSION_EXPIRED`, which is already redirecting |
| Tables: TanStack Table, react-data-grid, react-grid-layout | **own `components/console` grid** | Every queue is the same table shell; no table in the app virtualises (see gaps) |
| Animations: framer-motion, react-spring, auto-animate | **`tw-animate-css` + CSS** | Zero motion-library imports; the console is an internal tool where motion is state feedback, not choreography |
| Forms: tanstack-form, formily, react-jsonschema-form | **react-hook-form 7 + zod 4 + `@hookform/resolvers`** | Installed and used by every dialog; `components.json` ships the shadcn `field` primitives that pair with it |
| Sandboxes: bit, react-cosmos | **Storybook 10** (`@storybook/react-vite`, `.storybook/`) | 21 `.stories.tsx` files; `.design-sync/config.json` builds the shared design bundle from that Storybook |
| Dev tools: react-scan, why-did-you-render | not installed | Opt-in dev-only by nature; add neither without a measured render problem |

## Version floors and pairing

Do not upgrade a member of a pair alone. Exact ranges live in `admin/package.json`.

- `react` 19.2 ⟷ `react-dom` 19.2 ⟷ `@types/react` 19.2.8. React 19 removed `forwardRef` from
  the happy path and made `ref` a normal prop — check `ui/*.tsx` before a major bump.
- `vite` 8.3 ⟷ `@vitejs/plugin-react` 6.1 ⟷ `vitest` 5.0. The vitest config lives **inside**
  `vite.config.ts` (`defineConfig` imported from `vitest/config`), so a Vite major can break the
  test entry point, not just the build.
- `tailwindcss` 4.3 ⟷ `@tailwindcss/vite` 4.3. No PostCSS config exists — do not add
  `autoprefixer` or `postcss.config.mjs`; v4 handles both.
- `shadcn` 4.21 ⟷ `@base-ui/react` 1.9 ⟷ `components.json` `"style": "base-nova"`.
  `src/index.css` imports `shadcn/tailwind.css`, so `shadcn` is a **runtime dependency** here, not
  a devDependency.
- `react-router` 8 is a major of the `react-router` package itself; `react-router-dom` is not a
  dependency and should not become one.
- `typescript` ~6.0.2 with `erasableSyntaxOnly` and `verbatimModuleSyntax`: `enum`, `namespace`,
  parameter properties and non-`type` import of types are **compile errors**. Use `as const`
  maps and `import type`.
- `vitest` 5 ⟷ `jsdom` 30 ⟷ `@testing-library/react` 16 ⟷ `@testing-library/jest-dom` 7.
  `src/test/setup.ts` also stubs `document.elementFromPoint` for `input-otp`.

## Adding a dependency

```bash
cd admin
npm i <pkg>                    # runtime
npm i -D <pkg>                 # tests, lint, build only
npx shadcn@latest add <name>   # lands in src/components/ui + a .stories.tsx
npm run brand                  # only after editing brand/tokens.json
```

Two consequences to state before installing:

- **The bundle is the delivery.** Every page is a lazy chunk (`src/app/page-chunks.ts`), so a heavy
  dependency lands in whichever chunk imports it. Prefer what is already in the vendor chunk; if a
  library is only used by one page, import it inside that page's module.
- **`build` is `tsc -b && vite build`.** A dependency without usable types fails the Vercel build
  even if Vite would bundle it — check `types` before adopting.

UI components arrive through the shadcn CLI, never by copy-paste, so their Base UI primitive and
`cn()` wiring stay correct. Anything that touches `@theme` belongs in `brand/tokens.json`, not in a
hand-edited `src/brand.css`.

## Gates before finishing in `admin/`

```bash
cd admin
npm run lint        # oxlint: rules-of-hooks, only-export-components
npm run lint:arch   # eslint import/no-restricted-paths (warn)
npm run typecheck   # tsc -b
npm test            # vitest run
npm run build       # tsc -b && vite build
```

`lint` and `lint:arch` also run in `.husky/pre-commit` for staged `admin/**`. `lint:arch` is
configured at `warn` severity, so a boundary violation prints but does not fail the gate — read its
output, do not trust its exit code.

Every behaviour change ships a test. The harness is `src/test/render-app.ts`:
`renderSignedIn(path)` starts from the refresh cookie and renders the real `App` with a fresh
`QueryClient`; `src/test/fake-backend.ts` answers `fetch` for the flows that have tests.

## Auth and request shape (the parts that bite)

- Admin sign-in is **phone + OTP**, same as mobile; any other role is refused. `backend` is told who
  is an admin with `python -m app.scripts.make_admin +91…`.
- The access token is memory-only. A reload restores the session through the refresh cookie; a 401
  triggers exactly one refresh and one retry. `SESSION_EXPIRED` is a sentinel, not an error to show.
- Branch on `ApiError.code`, never on message text. Mutation failures go through `toastError`.
- Queries key off per-feature `*Keys` objects and invalidate by `queryKey`, as
  `src/features/categories/queries.ts` does.

## Known gaps worth acting on

Ranked by payoff; install commands and status in [LIBRARIES.md](./LIBRARIES.md).

1. **`strict` is not enabled.** `tsconfig.app.json` turns on `noUnusedLocals`,
   `noUnusedParameters` and `noFallthroughCasesInSwitch` but never `"strict": true`, so null-safety
   is unchecked across 193 TS files. Turning it on is a project (expect a large diff), not a
   drive-by — but it is the single largest correctness hole here.
2. **Boundary lint covers 7 of 17 features.** `eslint.config.js` lists `artists, auth, bookings,
   categories, custom-services, overview, reviews`; `broadcasts, customers, enquiries, feed,
   notifications, reports, settings, shop, subcategory-requests, support` are unzoned, so
   cross-feature imports among them pass. Add new feature dirs to `FEATURES` when adding the feature.
3. **No end-to-end coverage.** 19 unit test files, zero browser tests, while the risky paths
   (OTP sign-in, refresh cookie, the destructive booking/review actions) are integration-shaped.
   Playwright is the curated pick.
4. **No table virtualisation.** Every queue renders all rows. If a queue grows past a few thousand
   rows, TanStack Table + virtualization is the curated upgrade — not a second grid component.
5. **No chart library.** Overview KPIs and Reports are hand-built; when real charts are needed,
   recharts is the curated pick (React-friendly, tree-shaken per chart type).
6. **No date/time picker.** Booking filters and schedules are text/select only today.
7. **React Compiler is off.** `mobile/` runs `reactCompiler: true`; the admin does not. Enabling it
   here is a `@vitejs/plugin-react` + babel-plugin change and a re-verification of every `useMemo`
   that assumed manual memoisation — do it as its own change.
8. **Declared-but-missing `@/hooks` alias.** `components.json` maps `hooks: "@/hooks"`; there is no
   `src/hooks` (the two hooks live in `src/lib/use-debounced-value.ts` and
   `use-media-query.ts`). Either create the dir or drop the alias.
9. **`admin/README.md` layout section is stale.** It shows `src/pages/` (login actually lives in
   `src/features/auth/LoginPage.tsx`) and lists 3 of 17 features.

Do not bundle these into one change. One capability per commit, dependency and all.
