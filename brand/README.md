# Brand

The single source for GetReady's brand in both apps.

| File | Holds |
|---|---|
| `brand.json` | Names: brand name, admin name, wordmark text |
| `tokens.json` | Design system: colours (`color`), fonts (`font`), text styles (`typography`), spacing, radii, tracking, shadows, motion (durations + easing) |
| `logos/` | Logo files (none yet: the wordmark is text in the heading face) |

## Changing something

1. Edit `brand.json` or `tokens.json`.
2. Run `npm run brand` at the repo root. It rewrites the generated files below.
3. Commit the JSON and the generated files together. `npm run brand -- --check` fails if they are out of date.

Generated (do not edit by hand):

- mobile: `src/core/theme/tokens/{palette,typography,spacing,radii,shadows}.ts`, `src/core/brand/brand.ts`, `expo.name` in `app.json`
- admin: `src/brand.css` (fonts, text sizes, tracking, radii, easing, `--motion-*` durations, `--palette-*` colours), `src/lib/brand.ts`, `<title>` in `index.html`

## How the apps use it

- Colours: mobile semantic roles (`themes/light.ts`) and admin semantic variables (`src/index.css`) point at palette swatches, so a palette change reaches both apps.
- Text: mobile `<AppText variant="labelLg">`; admin `text-label-lg`, `text-logo-md`, `tracking-heading`. A new admin step is listed in `webText`, `webRadius` or `tracking`, and `cn()` learns it from `src/lib/brand.ts`.
- Name and logo: `<Logo />` (mobile `components/common/Logo`, admin `components/ui/logo`, sizes `md`/`lg`) and `brand.name` in copy.

## Not covered yet

- App icon, splash and favicon images still live in `mobile/assets/` and `admin/public/`; regenerate them when logo files exist.
- The app ID (`com.userisaziz.artcircle`), URL scheme and EAS slug keep their original names: changing them makes a new app in the stores.
