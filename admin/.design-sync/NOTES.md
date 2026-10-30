# design-sync notes (admin/)

Run every design-sync command from `admin/` - the converter and compare resolve `.design-sync/` from cwd, and this config lives in `admin/.design-sync/`, not the git root.

## Build
- [GENERAL] admin/ is an app, not a library. `buildCmd` (`node .design-sync/web-build.mjs`) compiles `.design-sync/web-entry.ts` (the `src/components/ui` layer) with Vite library mode + the app's own `@tailwindcss/vite`, into `.design-sync/.cache/web-pkg`. That dir is the converter's `--entry` / dist. Re-run it whenever `src/components/ui` or `src/index.css` changes.
- Converter: `node .ds-sync/package-build.mjs --config .design-sync/config.json --node-modules ./node_modules --entry .design-sync/.cache/web-pkg/dist/index.js --out ./ds-bundle`. The .d.ts step takes ~10 min on this machine; don't pipe it through tail.
- Font: Plus Jakarta Sans via `cfg.extraFonts` (@fontsource-variable). The build logs "4 dead @font-face block(s) dropped" from `_ds_bundle.css` - expected, the extraFonts copy is the one that ships (`fonts/`).
- `.storybook/preview.ts` has no decorators, so no provider chain is needed; components style from `styles.css` alone.

## Compare
- [GENERAL] Overlay components (Dialog, AlertDialog, DropdownMenu, Toaster) portal outside the story root, so compare's storybook capture is cropped to the root (e.g. 868x32) and shows only the trigger. Grade them against a full-viewport reference shot instead: `node .design-sync/.cache/sbshot.mjs <outdir> <story-id>...` (serves sb-reference, 900x700 screenshot per story id). The script lives in gitignored .cache - recreate if missing (playwright from .ds-sync/node_modules, static server over .design-sync/sb-reference).
- Storybook canvas paints a light grey strip behind each story; the preview page doesn't. Framing only - ignore when grading.
- `[RENDER_THIN]` Toaster: 0px rendered height in validate - toasts are fixed-position; cardMode single already set. Known, triaged - not a new warn.
- [GENERAL] InputOTP and Toaster report `sb-error` ("no storybook root content") on every story: input-otp positions its slots outside the measured root, and sonner portals the toast. Both render fine in storybook. Graded instead from full-viewport pairs: `node .design-sync/.cache/sbshot.mjs <dir> <story-id>...` (reference) and `node .design-sync/.cache/dsshot.mjs <dir> "components/ui/<Name>/<Name>.html?story=<Export>"` (preview), side by side via `.design-sync/.cache/montage.mjs`. Grade keys use the story display name ("Error Toast"), not the export name.
- Input/Textarea `Invalid`: the sheet's reference crop cuts off the outer aria-invalid ring (box-shadow outside the root); a full-viewport reference shows the same ring. Match.
- Preview cards set `body{background:#fff}` for framing, so they look white where storybook shows the blush `--background`. The app's `body` rule does ship in `_ds_bundle.css`.

## Conventions header
- `.design-sync/conventions.md` (wired via `readmeHeader`) lists utility classes verified present in the compiled `_ds_bundle.css`. Tailwind is compiled from app usage, so classes like `space-y-4`, `mb-4`, `gap-6`, `bg-muted`, `text-foreground` do NOT exist - re-verify the listed classes on every re-sync (a refactor that stops using one silently removes it).
- No `cn` helper is exported; the bundle exports components, subparts, `toast`, `buttonVariants`, `badgeVariants`, `tabsListVariants`. Export list: `node .design-sync/.cache/exports.mjs`.

## Re-sync risks
- New component in `src/components/ui` -> add an `export *` line to `.design-sync/web-entry.ts`, otherwise it never reaches the bundle.
- Grades for portal/overlay components (Dialog, AlertDialog, DropdownMenu, Toaster, InputOTP) and the Invalid input states were judged from full-viewport shots, not the compare sheet. If their stories change, re-grade the same way - the sheet alone will look like a mismatch or an sb-error.
- Helper scripts (sbshot/dsshot/montage/exports .mjs) live in gitignored `.design-sync/.cache/` and vanish on a fresh clone - recreate from the descriptions above.
- No component loads remote images, so the `[ASSETS_BLOCKED]` sandbox canary was never exercised.
