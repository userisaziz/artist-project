---
category: Layout
---
# FormScreen

The Atelier form frame used by Log in, Enter code and Create your account: blush wash fading to white behind the content, an optional round back button (`onBack`), and a keyboard-safe scroll body. Put the heading, fields and primary button inside; push the button down with a `flex: 1` spacer. Needs a parent with a height (a phone-sized frame in designs).

```jsx
<FormScreen onBack={goBack}>
  <AppText variant="display" style={{ marginTop: 24 }}>Log in</AppText>
  <PhoneInput value={phone} onChange={setPhone} />
  <View style={{ flex: 1 }} />
  <AppButton label="Send code" onPress={send} />
</FormScreen>
```
