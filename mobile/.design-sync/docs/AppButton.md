---
category: Actions
---
# AppButton

Full-width 52pt pill button. `primary` = rose fill with a soft rose shadow (one per screen, the main action); `secondary` = white pill with a hairline border (the alternative action, e.g. "I already have an account"); `ghost` = rose outline. `loading` swaps the label for a spinner and blocks presses; `disabled` dims to 40%.

```jsx
<View style={{ gap: 10 }}>
  <AppButton label="Get started" onPress={next} />
  <AppButton label="I already have an account" variant="secondary" onPress={login} />
</View>
```
