# Atelier — building with this design system

Atelier is the Art Circle **mobile app's** component library (React Native, rendered in the browser through react-native-web). Design phone screens: put each screen in a 393×852 frame.

## Wrapping (required)

Every tree needs both providers, outermost first. Without `ThemeProvider` the components fall back to the light theme. Without `SafeAreaProvider`, `Screen` and `FormScreen` throw.

```jsx
const { SafeAreaProvider, ThemeProvider } = window.Atelier;
<SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 393, height: 852 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } }}>
  <ThemeProvider>{/* screen */}</ThemeProvider>
</SafeAreaProvider>
```

## Styling idiom: React Native style objects + theme roles. No CSS classes, no CSS variables

- Lay out with the exported RN primitives `View`, `ScrollView`, `Pressable`, `Image` and `LinearGradient`, using `style={{ ... }}` objects (flexbox, column by default). Don't use raw `<div>`/`<span>`: text must go through `AppText`.
- Read every colour, size and radius from `useTheme()`. Never hardcode hex values.
  - `theme.colors`: `background`, `surface`, `textPrimary`, `textSecondary`, `textMuted`, `textOnBrand`, `brand` (rose, primary actions), `brandPressed`, `brandSoft` (blush tint), `brandInk` (deep rose eyebrows/headings), `brandOnImage`, `accent`, `separator`, `border`, `borderFocus`, `inputBackground`, `error`, `errorBackground`, `success`, `overlay`, `imageFallback`, `washTop`/`washBottom` (blush page gradient), `photoScrim` (plum over photos).
  - `theme.spacing`: `xs` 4, `sm` 8, `md` 16, `lg` 24, `xl` 32, `xxl` 48. Screen gutters are `lg`.
  - `theme.radii`: `sm` 8, `md` 12 (fields), `card` 20, `pill` 999 (buttons, chips).
  - `theme.shadows`: `sm`, `md`, `lg`, rose-tinted (spread into a style).
- Type: `<AppText variant=…>` with `hero`, `display`, `title`, `subtitle`, `body`, `label`, `caption`, `eyebrow` (uppercase, tracked) or `button`. Set the colour through `style`. The signature headline puts one word in rose italic with `<Accent>` nested inside the `AppText`, e.g. "Welcome *back*".
- Raw palette (rarely needed): `window.Atelier.palette`, e.g. `rose500`, `rose800`, `blush100`, `ink900`, `plum950`.

## Where the truth lives

`components/<group>/<Name>/<Name>.prompt.md` and `.d.ts` for each component. The frames: `FormScreen` (blush-wash auth/onboarding forms with an optional back button) and `Screen` (plain white page). The controls: `AppButton` (primary/secondary/ghost, full-width 52pt pill), `AppTextField`, `PhoneInput` (E.164 value) and `OtpInput`.

## Example (the app's Log in screen)

```jsx
const { FormScreen, AppText, Accent, PhoneInput, AppButton, View, useTheme } = window.Atelier;
function LogIn() {
  const theme = useTheme();
  const [phone, setPhone] = React.useState('+91');
  return (
    <FormScreen onBack={() => {}}>
      <AppText variant="display" style={{ color: theme.colors.textPrimary, marginTop: theme.spacing.lg }}>
        {'Welcome '}<Accent>back</Accent>
      </AppText>
      <AppText variant="label" style={{ color: theme.colors.textSecondary, marginTop: theme.spacing.xl, marginBottom: theme.spacing.sm }}>Mobile number</AppText>
      <PhoneInput value={phone} onChange={setPhone} />
      <View style={{ marginTop: theme.spacing.lg }}><AppButton label="Send code" onPress={() => {}} /></View>
    </FormScreen>
  );
}
```
