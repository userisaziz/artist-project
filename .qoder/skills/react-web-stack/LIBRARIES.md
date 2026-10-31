# Approved libraries — `admin/` (React web console)

One kit per capability. `installed` = in `admin/package.json` today. `candidate` = pre-approved,
install it rather than re-surveying the ecosystem. `rejected` = a rival to code we already own; do
not add it next to ours.

Source list: [enaqx/awesome-react](https://github.com/enaqx/awesome-react) at commit `e6fd973`
(no LICENSE file; README footer carries a CC0/BY badge). The list is a catalogue of what exists,
not a budget: most rows below are rivals to something already in `src/`.

## Installed

| Capability | Pick | Version | Notes |
| --- | --- | --- | --- |
| UI runtime | `react` + `react-dom` | 19.2.8 | Bump together with `@types/react` |
| Build | `vite` + `@vitejs/plugin-react` | 8.3.0 / 6.1.1 | `build` = `tsc -b && vite build` |
| Styling | `tailwindcss` + `@tailwindcss/vite` | 4.3.3 | CSS-first; no `tailwind.config.*`, no PostCSS |
| Motion CSS | `tw-animate-css` | 1.4.0 | The only animation dependency |
| Components | `shadcn` CLI (style `base-nova`) | 4.21.4 | Runtime dep: `index.css` imports `shadcn/tailwind.css` |
| Primitives | `@base-ui/react` | 1.9.0 | **Not Radix** — Base UI is what base-nova targets |
| Class merging | `cn` + `class-variance-authority` | 0.4.0 / 0.7.1 | `src/lib/utils.ts` extends `cn` with the brand steps |
| Icons | `lucide-react` | 1.55.0 | `components.json` `iconLibrary: lucide` |
| Routing | `react-router` | 8.4.0 | Not `react-router-dom` |
| Server state | `@tanstack/react-query` | 5.104.1 | The only cache; `src/lib/query-client.ts` |
| Forms | `react-hook-form` + `@hookform/resolvers` + `zod` | 7.89.0 / 5.9.1 / 4.6.5 | Validation layer for every dialog |
| OTP input | `input-otp` | 1.5.0 | Needs the `elementFromPoint` stub in `src/test/setup.ts` |
| Toasts | `sonner` | 2.0.8 | Reached only through `src/lib/notify.ts` |
| Theming | `next-themes` | 0.4.6 | Dark variant is declared in `index.css` |
| Fonts | `@fontsource-variable/plus-jakarta-sans` | 5.3.0 | Imported by `index.css`; no CDN |
| Component workbench | `storybook` + `@storybook/react-vite` | 10.6.2 | 21 stories; feeds `.design-sync` |
| Unit tests | `vitest` + `jsdom` + `@testing-library/react` + `user-event` + `jest-dom` | 5.0.3 / 30.1.2 / 16.3.3 / 14.6.7 / 7.0.1 | Config inside `vite.config.ts` |
| Lint (fast) | `oxlint` | 1.81.0 | `npm run lint`; hooks + export rules |
| Lint (architecture) | `eslint` + `eslint-plugin-import` + `@typescript-eslint/parser` + `eslint-import-resolver-typescript` | 9.39.5 / 2.32.0 / 8.71.2 / 4.4.5 | `npm run lint:arch`; boundary zones only |
| Types | `typescript` | ~6.0.2 | `erasableSyntaxOnly` + `verbatimModuleSyntax` |

`@types/node` 24.13.3 exists only for `vite.config.ts` (`node:path`, `import.meta.dirname`).

## Candidates (pre-approved, not installed)

| Capability | Pick | Why this one | Cost of adopting |
| --- | --- | --- | --- |
| End-to-end tests | `@playwright/test` | The 22 `PATHS` routes and the OTP/refresh flow are integration-shaped; unit tests fake `fetch` | New dev dep + `e2e/` config + a CI job; no bundle impact |
| Long-table virtualisation | `@tanstack/react-table` (+ `@tanstack/react-virtual`) | Headless, so `components/console` keeps owning the markup; the alternative rewrites the grid | Rewrites one queue at a time; only worth it past a few thousand rows |
| Charts | `recharts` | Component-shaped, tree-shakes per chart type, matches the React 19 SPA model | Lands in the Overview/Reports chunk only |
| Date/time input | `react-day-picker` | Headless-ish, styled by our tokens; the shadcn calendar is built on it | One component + a stories file |
| Accessibility assertions | `vitest-axe` | Runs inside the existing vitest harness; no new runner | Test-only; adds assertions to existing tests |
| Render profiling | `react-scan` | Dev-only overlay, no production bundle | Dev-only import; remove before measuring production |

## Rejected

| Capability | Rejected | Already owned by |
| --- | --- | --- |
| App framework | Next.js, Remix, Gatsby, Vike | Vite SPA + `vercel.json` rewrites; no server runtime exists |
| Component kit | antd, MUI, Chakra, Mantine, Ariakit, Headless UI, Fluent UI, Framework7 | `src/components/ui` (21 components) + `src/components/console` |
| Client state | redux, zustand, jotai, mobx, xstate, effector, immer, immutable-js | TanStack Query + `useState` + URL state |
| Data fetching | swr, apollo-client, relay, rxdb | `src/lib/api.ts` + TanStack Query |
| Styling | styled-components, emotion, vanilla-extract | Tailwind v4 + `src/brand.css` |
| Icons | react-icons, heroicons, thesvg | lucide-react |
| Router | TanStack Router, speedy-router | react-router 8 |
| Forms | tanstack-form, formily, react-jsonschema-form, formisch | react-hook-form + zod |
| Toasts | react-hot-toast | sonner + `src/lib/notify.ts` |
| Error boundaries | react-error-boundary | `src/components/route-error-boundary.tsx` |
| Grid | react-data-grid, react-grid-layout | `src/components/console` |
| Animation | framer-motion, react-spring, auto-animate, tsparticles, parallax | `tw-animate-css` |
| Sandbox | bit, react-cosmos | Storybook 10 |
| Test runner | jest, cypress | vitest + jsdom (+ Playwright when E2E lands) |
| Admin framework | react-admin, refine | The console is 22 hand-built routes over a hand-built API; either would rewrite the auth/session contract |
| Select | react-select, downshift | `src/components/ui/filter-select` + Base UI |
| i18n | react-i18next, formatjs, intlayer | Single-locale English console; no i18n layer exists |
| Renderers | react-three-fiber, ink, remotion, react-pdf, react-figma | Out of scope for an internal CRUD console |
| Code splitting lib | loadable-components | `React.lazy` + `src/app/page-chunks.ts` |
| PDF/export | react-pdf | `src/lib/download.ts` covers CSV-style export today |

## Adding a row

Append to **Candidates** with the reason the capability is missing and what adopting it costs. When
one gets installed, move it to **Installed** with its exact version from `package.json`, and add the
pairing note to `SKILL.md` if it has a companion package.
