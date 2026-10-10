---
category: Layout
---
# Screen

Plain white page frame: fills its parent (`flex: 1`), pads content by 24, respects the safe area, and keeps content above the keyboard. `scroll` makes the body scroll. Use for simple signed-in pages; onboarding/auth forms use `FormScreen`. Needs a parent with a height (a phone-sized frame in designs).

```jsx
<Screen scroll>
  <AppText variant="display">Welcome, Ananya</AppText>
</Screen>
```
