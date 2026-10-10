---
category: Typography
---
# AppText

The only text primitive in Atelier. Pick a `variant` from the theme's type scale; never set `fontFamily`/`fontSize` from scratch. Colour comes from `style` using theme roles (`useTheme().colors`).

Variants: `hero` (welcome headline), `display` (screen titles), `title`, `subtitle`, `body` (default), `label` (field labels), `caption` (helper/error text), `eyebrow` (uppercase tracking label, e.g. "ATELIER"), `button`.

```jsx
const theme = useTheme();
<AppText variant="eyebrow" style={{ color: theme.colors.brandInk }}>ATELIER</AppText>
<AppText variant="display" style={{ color: theme.colors.textPrimary }}>Create your account</AppText>
<AppText variant="body" style={{ color: theme.colors.textSecondary }}>We'll text you a 6-digit code.</AppText>
```
