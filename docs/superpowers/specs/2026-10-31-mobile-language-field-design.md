# Mobile Language Multi-Select Dropdown — Design

## Problem

The artist "Languages you speak" control renders all 11 languages from `LANGUAGES` as a wrapping row of
`Chip`s, in two places: the onboarding Profile step (`app/artist/onboarding/profile.tsx`) and
Me → Experience & languages (`app/artist/details.tsx`). Eleven pills occupy a large block of the screen and
the chosen ones are hard to review at a glance — the selected pills sit wherever they fall in the full list.

The user asked for the same shape the city picker already uses: a field that opens a dropdown, with the
current choice shown as a badge inside the field.

## Goal

One compact field that (a) shows the chosen languages as removable badges, (b) opens a bottom sheet listing
all 11 languages, (c) lets the artist toggle several in one visit. Nothing else about the feature changes:
same state, same PATCH body, same ordering rule (the order the artist picked them), backend untouched.

## Chosen approach

A new `LanguageField` component modelled on `CityField`, with badges **inside** the field and a sheet that
**stays open** while the artist taps.

- The field keeps `CityField`'s look — 50pt minimum height, `fieldBorder`, `▾` — but grows in height instead
  of clipping, because the badges wrap inside it. Empty state shows "Choose the languages you speak".
- Each badge carries an ✕ that removes that language and does **not** open the sheet.
- The sheet lists every option with a checkmark on the selected ones; a tap toggles immediately and the
  sheet stays open, so multiple picks need one visit. "Done" closes it. Eleven rows plus the footer exceed a
  small screen, so the sheet is capped at 80% height and the list scrolls under a pinned "Done".
- (Rejected: closing the sheet on each tap — the city is single-select, languages are not; a "+N more"
  overflow instead of wrapping — hides selections the artist then cannot see or remove without reopening;
  draft state with an Apply button — more state to keep in sync for no gain.)

The two consumers already pass `languages` + `onLanguagesChange` through `ProfileDetailsFields`, so replacing
the `Chip` row there covers both screens with one edit.

### Why no shared `FieldDropdown` primitive

`CityField` and `LanguageField` differ exactly where a generic abstraction would have to bend: single vs
multi select, close-on-pick vs stay-open, plain text vs badge row, and the accessibility role (`button` vs
`checkbox`). Extracting a common primitive would put the shipping city picker at risk to serve a two-file
similarity. Two focused components, each readable on its own, beat one carrying mode flags.

## Interface

```ts
interface LanguageFieldProps {
  /** Rendered above the field and reused as its screen-reader name — the field owns the label, like AppTextField. */
  label: string;
  /** Selected languages, in the order the artist picked them. */
  languages: string[];
  options: readonly string[];
  onChange: (next: string[]) => void;
}
```

Toggle semantics live in the field (same rule as today's `toggle`): present → remove, absent → append.
`ProfileDetailsFields` drops its hand-rolled `AppText` label so the string exists in exactly one place.

## Error handling

None to add. The field cannot be in an invalid state — an empty selection is legal ("optional") and every
option comes from the closed `LANGUAGES` list, so there is no input to reject. The existing save path
(`useUpdateDetails` on the details screen, `useSaveProfile` on the onboarding step) is unchanged.

## Accessibility

- The field is one `accessibilityRole="button"` element labelled "Languages you speak: Hindi, English", so the
  selection is read once, in order, rather than as loose pills scattered in the tab order.
- Because that button aggregates its children, the badge ✕ is a pointer convenience; the accessible removal
  path is the sheet, where every language is a `checkbox` row (`accessibilityState={{ checked }}`), matching
  `Chip`. No screen-reader route is lost — only the duplicate way to remove.
- `onRequestClose` (Android back) closes the sheet without discarding the toggles already made, since each
  tap commits immediately.

## Tests

- New `src/__tests__/artist-onboarding/language-field.test.tsx`: field shows the badges in pick order and an
  empty placeholder; the sheet opens on press; a tap adds and keeps the sheet open; a second tap removes;
  the badge ✕ removes without opening the sheet; "Done" closes.
- Update the two tests that press the old chips: `profile-details.test.tsx` (toggle order) and
  `details.test.tsx` (approved artist adds a language, then PATCHes).
- No type, API, mock-fixture, or backend change, so no other suite is touched.

## Verification

`npx jest src/__tests__/artist-onboarding/ src/__tests__/auth/`, `npx expo lint`, and `npx tsc --noEmit`
(`package.json` has no typecheck script). The mobile suite is slow on this machine and parallel workers can
push individual tests past the 5s default timeout, so triage any timeout with `--runInBand` before treating
it as a real failure.
