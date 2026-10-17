---
trigger: glob
globs: admin/**,mobile/**
description: Bulletproof-react architecture, folder structure, and coding rules for the admin (React + Vite) and mobile (Expo + React Native) codebases.
---

# React Codebase Rules (bulletproof-react)

Doctrine adapted from https://github.com/alan2207/bulletproof-react for `admin/` and `mobile/`. Full rationale in project root `CLAUDE.md` — this file is the enforceable checklist. Both files must stay in sync.

## 1. Layering — unidirectional, no cycles
- Dependency direction: **shared (`components`/`lib`/`hooks`/`utils`/`types` or `src/core`) → features → app (routes/pages)**. Imports flow one way.
- NEVER import feature → feature. Compose features only at the route/page level.
- Shared layers never import from features or app.
- Genuinely shared code gets promoted to shared layers; do not reach into another feature for a helper.

## 2. Folder structure
- **admin/**: keep `src/features/<name>/` as the unit of organization. Once a feature exceeds ~5 files, split into `api/`, `components/`, `hooks/`, `types.ts`, `utils.ts`. Existing flat layouts (`queries.ts` + pages) migrate only when touched — no bulk restructuring.
- **mobile/**: `app/` contains ONLY Expo Router route files — thin screens that assemble `src/` building blocks (no logic, no fetchers, no style blobs). Business logic lives in `src/<layer>/<feature>/` (api, components, context, hooks, mocks, types, utils); infra in `src/core/`. Cross-feature shared pieces go into `common` subfolders.
- No barrel files re-exporting entire features; import files directly.

## 3. Naming
- Files/folders `kebab-case`; React component identifiers `PascalCase`; hooks `use-xxx.ts` / `useXxx`; API declaration files verb-first: `get-<resource>.ts`, `create-<resource>.ts`.
- One component per file. Match the dominant style of the folder being edited; new files follow the above.

## 4. Imports
- Absolute alias `@/` only; no `../../..` deep-relative imports in new code.

## 5. Components & styling
- Colocate state/handlers/UI near usage; lift only with a second real consumer.
- No nested `renderX()` functions — extract components.
- ≤ ~6 props; beyond that split or use composition (`children`/slots).
- Wrap third-party UI (shadcn/Base UI, Expo primitives) in shared UI folders; features consume wrappers.
- **admin**: Tailwind + CVA in shared `ui/`; no inline styles, no hardcoded hex outside token config.
- **mobile**: three-layer token system — components consume **semantic tokens only** via `ThemeProvider`/`useTheme`; never raw primitives or magic numbers (re-skinning must stay possible).

## 6. API layer
- Single preconfigured client per app (`admin/src/lib/api.ts`, `mobile/src/core/api`); components never call `fetch` directly.
- Each endpoint = a request declaration in the owning feature: (1) zod/TS types, (2) fetcher, (3) TanStack Query hook with a namespaced query key (`['<feature>', '<view>', id]`).
- Components call query hooks, not fetchers. Mutations invalidate via query keys.

## 7. State — four kinds, four tools
1. Component state → `useState`/`useReducer`, start local.
2. Server cache → TanStack Query ONLY; never mirror server data into Context/stores.
3. Client app/feature state → Context (mobile `src/context/<feature>`) or minimal store — session, theme, wizard state only.
4. URL state → route/search params for tabs, filters, pagination.
- Forms → React Hook Form + zod resolver; schema-based validation, not imperative checks.

## 8. Error handling
- Central interceptor on the API client: toasts for 4xx/5xx, 401 → logout. No swallowing in components.
- No silent catch — recover visibly or rethrow; empty catch blocks block review.
- Error boundaries per route/region with real retry fallbacks (not one app-wide boundary).
- Every query screen renders loading / error / empty states; missing states = incomplete.

## 9. Testing
- Priority: integration > unit > e2e. Test user-visible behavior, never implementation details.
- admin: Vitest + RTL, query by role/label; network mocked via handlers in `src/test/`.
- mobile: jest-expo, tests in `src/__tests__/<feature>`, fixtures in `src/mocks/<feature>` mirroring real API shapes.
- New features ship ≥1 happy-path integration test + ≥1 error-state test; bug fixes start with a failing test.

## 10. TypeScript / performance / security
- Strict TS: no `any`, no `@ts-ignore` (`@ts-expect-error` + reason only); update types first when refactoring.
- Perf: stable keys + memoized list items (FlatList on mobile), route-level lazy loading on admin, debounce search inputs.
- Security: tokens in `expo-secure-store` / httpOnly-friendly patterns only — never localStorage, never rendered markup, never API keys or secrets in client bundles or unauthenticated responses. No `dangerouslySetInnerHTML` without review.

## 11. Canonical Library Stack
Use only these; no competing kits. New core libs get added here first.
- admin data: TanStack Query v5 (client `src/lib/query-client.ts`) — no axios/bare fetch
- admin UI: shadcn/ui on `@base-ui/react` + CVA + `cn`, `lucide-react` icons, `sonner` toasts, `next-themes`; styling Tailwind v4 + `tw-animate-css`; routing `react-router` v8; forms `react-hook-form` + `@hookform/resolvers` + `zod` v4 (+ `input-otp`). Wrap TanStack Table/Virtual, `react-day-picker` in `ui/` before use.
- mobile data: TanStack Query v5 (declarations in `src/api/<feature>`); routing `expo-router`; UI = own three-layer-token design-system components (shadcn is web-only — apply the wrapper principle to `expo-image`/`expo-linear-gradient`/`react-native-svg` instead); tokens `expo-secure-store`.
- cross-cutting: zod = single validation layer; TanStack Query = single server-cache layer.

## 12. Gates
- Before finishing: admin `npm run lint` + `npm run lint:arch` + typecheck; mobile `npm run lint` (expo lint incl. boundaries) + `jest`. All green.
- Boundary enforcement INSTALLED (admin ESLint zones, mobile eslint-plugin-boundaries). Pre-existing violations are `warn` backlog; flip both configs to `error` once drained.
- Husky pre-commit at repo root lints staged apps; never bypass.
- Storybook (admin): new/reworked `src/components/ui/` components ship colocated `*.stories.tsx` with variants/states.
- Conventional Commits; keep diffs small — feature work and refactors in separate changes.
