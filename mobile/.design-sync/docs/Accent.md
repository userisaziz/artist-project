---
category: Typography
---
# Accent

Italic rose emphasis nested INSIDE an `AppText` headline - it inherits the parent's size and swaps in the italic heading face. The signature Atelier headline pattern: one or two words accented at the end. `light` uses the lighter italic (used on Welcome and Choose role).

```jsx
<AppText variant="hero">{'Discover\nyour '}<Accent light color={theme.colors.brandOnImage}>artist.</Accent></AppText>
<AppText variant="display">{'What brings you '}<Accent light color={theme.colors.accent}>here?</Accent></AppText>
```
