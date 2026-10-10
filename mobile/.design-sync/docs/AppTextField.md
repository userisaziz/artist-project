---
category: Forms
---
# AppTextField

Labelled 57pt input in the Atelier field style: rounded box, blush border that turns rose on focus and red on `error`. The `label` renders above the box and doubles as the accessibility label. Accepts every React Native `TextInput` prop (`value`, `onChangeText`, `placeholder`, `keyboardType`, `autoCapitalize`...). Pass `error` as the message string to show it below the field.

```jsx
<AppTextField label="Full name" value={name} onChangeText={setName} placeholder="Ananya Rao" autoCapitalize="words" />
<AppTextField label="Email (optional)" value={email} onChangeText={setEmail} error="Enter a valid email, or leave it empty." />
```
