# Project skills (`.qoder/skills/`)

Agent skills scoped to this repository. Qoder discovers each `<dir>/SKILL.md` by its
frontmatter `name` + `description`; the body is read only when the skill is invoked.

Two families live here per surface — vendored upstream skills, plus skills authored for this repo:

| Family | Dirs | Edit by hand? |
| --- | --- | --- |
| Vendored official Expo skills | `expo-*`, `eas-*` | No — upstream-owned, re-sync instead |
| Vendored official FastAPI skill | `fastapi` | No — comes from the installed wheel, re-sync after a FastAPI upgrade |
| Authored for this repo | `react-native-stack`, `fastapi-stack`, `react-web-stack`, `data-layer-stack` | Yes |

## Rule precedence

`.qoder/rules/react-bulletproof.md` (mobile) and `.qoder/rules/fastapi-best-practices.md`
(backend), both mirrored in root `CLAUDE.md`, win over every skill in this directory — including
the vendored upstream ones.

`admin/` has **no** file in `.qoder/rules/`. For that surface the enforced contracts are the code
and the gates, itemised at the top of [react-web-stack/SKILL.md](./react-web-stack/SKILL.md)
(`eslint.config.js` boundary zones, `.oxlintrc.json`, `tsconfig.app.json`, `src/test/`). If an
admin rule file is added later, it outranks `react-web-stack` the same way the backend rule
outranks `fastapi-stack`.

`data-layer-stack` never overrides `fastapi-best-practices.md` §Database/§Migrations; it expands
them for the storage half (poolers, extensions, grants, compose).

### Mobile divergences

Known divergences to resolve in favour of the project rules:

- **Folder layout.** `expo-project-structure`-style layouts do **not** apply here. Mobile uses
  the bulletproof layering (`app/` = thin routes, `src/<layer>/<feature>/`, `src/core/`) and it
  is enforced by `eslint-plugin-boundaries` in `mobile/eslint.config.js`.
- **Component library.** Vendored skills may suggest `@expo/ui`, NativeWind, Tamagui or
  third-party kits. This app's UI is its own three-layer token design system in
  `mobile/src/components` + `mobile/src/core/theme`. Do not add a competing kit; the approved
  list lives in `react-native-stack/LIBRARIES.md`.
- **Networking.** Vendored skills mention SWR / axios-style clients. Mobile uses one
  `fetch` client (`mobile/src/core/api`) plus TanStack Query only.

### Backend divergences

The vendored `fastapi` skill is authoritative on FastAPI's API surface, not on this stack.
Its disagreements with `.qoder/rules/fastapi-best-practices.md` are reconciled line by line in
[fastapi-stack/SKILL.md](./fastapi-stack/SKILL.md) ("Where the vendored official skill disagrees
with this repo") — the headline cases: `response_model=` stays mandatory, SQLModel and Asyncer are
rejected, the `fastapi` CLI is not installed (uvicorn serves the app), `app.frontend()` is unused,
and OpenTelemetry must not be switched on without an SDK. Add a row there whenever a new
disagreement shows up.

### Web console divergences

The admin is a static Vite SPA, so the React ecosystem's defaults do not apply. Headline cases,
reconciled line by line in [react-web-stack/SKILL.md](./react-web-stack/SKILL.md): no Next.js/Remix
(`vercel.json` is a static build plus an `/api` rewrite), shadcn runs the `base-nova` style on
**Base UI** rather than Radix, there is no client state library (TanStack Query + URL state), no
second HTTP client (`src/lib/api.ts` owns the 401 refresh), and no second component kit
(`src/components/ui` + `src/components/console`). Version pairing matters more here than anywhere
else: `vite` ⟷ `vitest` share one config file, and `shadcn` is a runtime dependency because
`src/index.css` imports its CSS.

### Data-layer divergences

Supabase is used as **managed Postgres only** — no `@supabase/supabase-js`, no PostgREST, no
Supabase Auth/Storage/Realtime/Edge Functions, no RLS. Alembic is the only schema writer, so the
Supabase CLI's `db push` is rejected. `data-layer-stack/SKILL.md` records why, plus the pooler rules
(port 5432 session mode only; 6543 breaks asyncpg's prepared statements) and the grant check that
must follow any table-creating migration, because Supabase publishes `public` through PostgREST.

## Curated stack skills — provenance

The four authored skills were filtered from these lists. Each list's licence covers the list text,
not the linked projects.

| Skill | Source list | Commit | Licence |
| --- | --- | --- | --- |
| `react-native-stack` | [jondot/awesome-react-native](https://github.com/jondot/awesome-react-native) | `6733606` | see `react-native-stack/LIBRARIES.md` |
| `fastapi-stack` | [mjhea0/awesome-fastapi](https://github.com/mjhea0/awesome-fastapi) + [vinta/awesome-python](https://github.com/vinta/awesome-python) | `38e525e` / `732d491` | see `fastapi-stack/LIBRARIES.md` |
| `react-web-stack` | [enaqx/awesome-react](https://github.com/enaqx/awesome-react) | `e6fd973` | no LICENSE file; README footer carries a CC0/BY badge |
| `data-layer-stack` | [dhamaniasad/awesome-postgres](https://github.com/dhamaniasad/awesome-postgres) + [lyqht/awesome-supabase](https://github.com/lyqht/awesome-supabase) + [docker/awesome-compose](https://github.com/docker/awesome-compose) | `954766a` / `11d47fd` / `30f4b7f` | CC0 (all three) |

The method those four follow is itself a global skill:
`~/.qoder/skills/awesome-list-curation/SKILL.md` — inventory the surface first, pin the list by
commit, classify each candidate as installed / own-rival / candidate / rejected, then write the
decision ladder and the list-vs-repo disagreement table. Copy that shape when adding a fifth.

Re-sync recipe (all four are authored, so this only re-pins the provenance; nothing is copied):

```bash
S=/tmp/dq-scratch && mkdir -p "$S" && cd "$S"
for r in jondot/awesome-react-native mjhea0/awesome-fastapi vinta/awesome-python \
         enaqx/awesome-react dhamaniasad/awesome-postgres lyqht/awesome-supabase \
         docker/awesome-compose; do
  [ -d "${r#*/}" ] || git clone --depth 1 "https://github.com/$r.git"
done
for d in */; do printf '%s %s\n' "$(git -C "$d" rev-parse --short HEAD)" "$d"; done
```

Update the commit column above when a re-pin changes it — an unpinned decision cannot be audited.

## Vendored Expo skills — provenance

| Field | Value |
| --- | --- |
| Source | https://github.com/expo/skills (official Expo team, MIT) |
| Plugin | `expo` v1.14.3 |
| Commit | `05754e7` |
| Vendored | 2026-10-31 |
| License text | [LICENSE-expo-skills](./LICENSE-expo-skills) |

Installed subset (8 of 24) and why:

| Skill | Reason |
| --- | --- |
| `expo-router` | Routing layer of `mobile/app/` |
| `expo-native-ui` | Native controls, media, safe areas, visual effects |
| `expo-animation` | Reanimated 4 / worklets motion work (see gap notes in that skill's own intro: it assumes `react-native-gesture-handler` + `expo-haptics`, neither of which is installed here) |
| `expo-design-system` | Token/theme structure audits |
| `expo-data-fetching` | TanStack Query + fetch error/loading/empty states |
| `expo-upgrade` | Expo SDK 57 / RN 0.86 / React 19 / new architecture / `reactCompiler: true` |
| `eas-update` | OTA is configured (`runtimeVersion: fingerprint`, `updates.url`, preview/production channels) |
| `eas-app-stores` | EAS build/submit for the `preview` APK and `production` |

Deliberately skipped: `expo-project-structure` (conflicts with our layout), `expo-ui`
(would push `@expo/ui` as the default sheet/control kit), `expo-dev-client`, `expo-module`,
`expo-brownfield`, `expo-dom`, `expo-web-to-native`, `expo-app-clip`, `expo-examples`,
`eas-hosting`, `eas-observe`, `eas-workflows`, `eas-simulator`, `eas-update-insights`.

Codex-only `agents/openai.yaml` files were dropped during the copy; everything else is
byte-identical to upstream.

## Re-sync recipe (Expo)

```bash
git clone --depth 1 https://github.com/expo/skills.git /tmp/expo-skills
SRC=/tmp/expo-skills/plugins/expo/skills
cd /Users/almabetter/artist-project
for s in expo-router expo-native-ui expo-animation expo-design-system \
         expo-data-fetching expo-upgrade eas-update eas-app-stores; do
  rsync -a --delete --exclude 'agents/' "$SRC/$s/" ".qoder/skills/$s/"
done
cp /tmp/expo-skills/plugins/expo/LICENSE .qoder/skills/LICENSE-expo-skills
git -C /tmp/expo-skills rev-parse --short HEAD   # record in the table above
```

## Vendored FastAPI skill — provenance

| Field | Value |
| --- | --- |
| Source | the `fastapi` wheel itself — `fastapi/.agents/skills/fastapi/`, the official agent skill bundled by the FastAPI team |
| Version | fastapi 0.143.3 (matches `backend/requirements.lock`) |
| Vendored | 2026-10-31 |
| Contents | `SKILL.md` (333 lines) + 6 references, 925 lines total: `dependencies`, `path-operations`, `pydantic`, `responses`, `streaming`, `other-tools` |
| License text | [fastapi/LICENSE](./fastapi/LICENSE) (MIT, copied from the wheel's `dist-info/licenses`) |

Provenance is deliberately the **installed wheel** rather than a floating GitHub clone: the skill
describes API surface that moves version to version, so vendoring from site-packages keeps it
exactly aligned with the code it governs.

Nothing was skipped from the bundle. `other-tools.md` is the one reference that disagrees with
this project (it recommends uv, ty, Asyncer and SQLModel) — read it through the reconciliation
table in `fastapi-stack/SKILL.md` rather than following it.

## Re-sync recipe (FastAPI)

```bash
cd /Users/almabetter/artist-project
SP=$(backend/.venv/bin/python -c "import site; print(site.getsitepackages()[0])")
V=$(backend/.venv/bin/python -c "import importlib.metadata as m; print(m.version('fastapi'))")
rsync -a --delete "$SP/fastapi/.agents/skills/fastapi/" ".qoder/skills/fastapi/"
cp "$SP/fastapi-$V.dist-info/licenses/LICENSE" .qoder/skills/fastapi/LICENSE
echo "vendored from fastapi $V — update the version row above"
```

Run it after any `fastapi` upgrade, and re-check the reconciliation table: a conflict recorded
there may have been resolved upstream (or a new one may have appeared).

After any sync, update the commit/version row in this file so drift is visible in review.
