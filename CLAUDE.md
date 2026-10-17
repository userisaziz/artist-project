# Project Rules — React Codebases (bulletproof-react based)

Applies to `admin/` (React + Vite + Tailwind + shadcn) and `mobile/` (Expo + React Native).
Source of doctrine: https://github.com/alan2207/bulletproof-react — adapted to this repo's existing structure. Backend (`backend/`, FastAPI) is out of scope for these rules.

## 1. Architecture — Unidirectional Layering

Layers, in dependency order: **shared (`components`, `lib`, `hooks`, `utils`, `types`) → features → app (routes/pages)**. Imports only flow downward-left-to-right:

- Shared folders must NEVER import from features or app.
- Features may import from shared, never from other features.
- App/routes may import from features and shared.
- Cross-feature composition happens at the **app level** (a page/route imports two features), never feature → feature.

Existing `admin/` feature folders (`auth`, `artists`, `bookings`, `categories`, `custom-services`, `overview`, `reviews`) keep their independence. Do not add helpers in one feature that another feature imports — promote them to `src/lib` / `src/components` / `src/hooks` if genuinely shared.

## 2. Folder Structure

### admin/ — feature-first (target shape)
```
src/
├── app/          # routes, layout, providers, paths.ts
├── components/   # shared UI (ui/ = shadcn/Base UI wrappers)
├── features/<name>/
│   ├── api/        # request declarations + react-query hooks (new: prefer over flat queries.ts)
│   ├── components/ # feature-scoped components
│   ├── hooks/      # feature-scoped hooks
│   ├── types.ts    # feature types
│   └── utils.ts    # feature utils
├── lib/          # preconfigured 3rd-party libs (api client, query-client, utils)
└── test/         # test setup + shared mocks
```
A feature file starts flat (e.g. `bookings/queries.ts`); split into the subfolders above once the feature grows beyond ~5 files. Do not mass-rename existing files — restructure a feature only when actively working on it.

### mobile/ — existing split, respect the boundaries
- `app/` = Expo Router screens ONLY. Route files stay thin: assemble components/hooks from `src/`, no business logic, no inline fetchers, no styled-object blobs.
- `src/<layer>/<feature>/` (api, components, context, hooks, mocks, types, utils) is the standing convention. Same layering rule applies inside: a `components/bookings` file must not import from `hooks/reviews` internals that belong to another feature's logic — shared pieces live in `components/common`, `hooks/common`, `utils/common`.
- `src/core/` = preconfigured infrastructure (api client, theme). Features import from core; core imports from nothing above it.

## 3. Naming Conventions

- Files/folders: `kebab-case` (bulletproof standard). React component **identifiers**: `PascalCase`. Hook files/exports: `use-xxx` / `useXxx`. API declaration files: verb-first — `get-<resource>.ts`, `create-<resource>.ts`, `update-<resource>.ts`.
- Match the dominant style of the folder you are editing; new files follow the conventions above. Never bulk-rename unrelated files.
- One component per file. Export the component as the file's default or single named export.

## 4. Imports

- Absolute imports via the `@/` alias (already configured). No `../../../` deep-relative paths in new code.
- No barrel files re-exporting whole features — import files directly (Vite tree-shaking + clarity).
- No cross-feature imports (see §1); ESLint/lint should treat violations as errors.

## 5. Components & Styling

- **Colocate** state, handlers, and subcomponents near where they're used; lift only when a second consumer exists.
- No nested `renderX()` functions inside a component — extract a real component for any UI unit.
- Limit props (~≤6). Too many props = split the component or use composition (`children`, slots).
- Wrap third-party components (shadcn/Base UI on admin; Expo/RN primitives on mobile) inside shared UI folders — feature code consumes app-level components, not raw library JSX.
- Styling: admin = Tailwind + CVA variants in the shared `ui/` layer; no inline styles, no arbitrary hardcoded hex/colors.
- mobile = three-layer design tokens: components consume **semantic tokens only** (via `ThemeProvider`/`useTheme`); never raw primitives, never magic numbers for spacing/color/radius. This keeps re-skinning possible.

## 6. API Layer

- One preconfigured client instance: `admin/src/lib/api.ts`, `mobile/src/core/api`. Components never call `fetch`/axios directly.
- Every endpoint is a **request declaration** living in the owning feature, containing: (1) zod schema / TS types for request+response, (2) a fetcher function, (3) a react-query hook (`useQuery`/`useMutation`) with a stable query key. Components call hooks, not fetchers.
- Query keys: namespaced arrays per feature, e.g. `['bookings', 'detail', id]`. Mutations invalidate via these keys — no refetch-on-prop-change hacks.
- Response types are inferred from schemas; do not hand-write duplicate response interfaces.

## 7. State Management — Four Kinds, Four Tools

1. **Component state** → `useState` / `useReducer`. Start local; lift only on real need.
2. **Server cache state** → TanStack Query ONLY (already in both apps). Never copy server data into Context/stores/redux.
3. **Client feature/app state** → React Context (mobile: `src/context/<feature>`) or a small store; only for genuine client concerns (session, theme, wizard state), not server data.
4. **URL state** → route params/search params (react-router / expo-router) for tabs, filters, pagination — not local state that should survive refresh or sharing.
- Forms → React Hook Form + zod resolver (admin); validate with schemas, not imperative checks.

## 8. Error Handling

- API errors handled centrally in the client interceptor: toast the user, 401 → force logout, 4xx → surface message. Do not swallow errors in components.
- **No silent catch**: every `try/catch` either recovers visibly (user-facing fallback) or rethrows. Empty catch blocks are a review blocker.
- Error boundaries per region/route (admin: wrap route outlets; mobile: per route-group layout), each with a real retry fallback UI — not one app-wide boundary.
- Every query-driven screen renders its states: loading, error, empty. Missing an error/empty state is considered incomplete work.

## 9. Testing

- Value order: **integration > unit > e2e**. Test features the way users use them (render a screen, interact, assert output) — don't assert internal state or implementation details.
- admin: Vitest + React Testing Library; query by role/label (`getByRole`), never `getByTestId` as first resort. Mock the network with handlers in `src/test/` (MSW-style), not by stubbing `fetch` per test.
- mobile: jest-expo per existing test structure (`src/__tests__/<feature>`); mock via `src/mocks/<feature>` fixtures.
- Every new feature module ships with at least: one happy-path integration test + one error-state test. Fix bugs by adding a failing test first.
- Real backend contract wins; mocks must mirror actual API response shapes.

## 10. TypeScript, Performance, Security

- Strict TS: no `any` (use `unknown` + narrow), no `@ts-ignore` (only `@ts-expect-error` with a reason comment). Types first when refactoring.
- Perf: memoize expensive lists (mobile: FlatList `keyExtractor` + stable items), `React.lazy`/route-level code-splitting on admin for heavy pages, debounce search inputs (use existing `use-debounced-value`).
- Security: tokens only in secure storage (mobile: `expo-secure-store`; admin: httpOnly cookie-friendly patterns), never in localStorage or rendered markup. Never expose API keys/secrets in client bundles or unauthenticated responses. Sanitize any rendered user-supplied HTML; no `dangerouslySetInnerHTML` without review.

## 11. Quality Gates

- Admin: `npm run lint` (oxlint) + `tsc` must pass before finishing work; mobile: `eslint` + `jest` likewise.
- Architectural boundaries (cross-feature / layering, §1–§2) are enforced by ESLint once the boundary configs are installed: `npm run lint:arch` in admin (`import/no-restricted-paths` zones), `eslint` with `eslint-plugin-boundaries` in mobile. Until installed, treat §1–§2 as manual review items.
- Conventional Commits for all commits.
- Small, reviewable diffs: a PR mixes either feature work or refactor, not both.

## Backend (FastAPI) — always-on rules

@.qoder/rules/fastapi-best-practices.md

Backend layout: module-first, one package per domain under `backend/app/`
(auth, user, catalog, artist, booking, review, directory, upload) plus global
`core/` and `shared/`. Run tests from `backend/` with `uv run pytest -q`
(or `.venv/bin/pytest -q` if `uv` is not on PATH).
