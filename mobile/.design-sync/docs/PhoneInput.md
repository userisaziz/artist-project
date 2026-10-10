---
category: Forms
---
# PhoneInput

Phone number field: a tappable country-code chip (opens a bottom-sheet picker of 12 countries) + the national number. Controlled with a full E.164 string: `value="+919845012345"`, `onChange(e164)`. Indian numbers display as "98450 12345". `error` turns the border red. Use `formatPhone(e164)` to show a saved number read-only ("+91 98450 12345").

```jsx
const [phone, setPhone] = useState('+91');
<PhoneInput value={phone} onChange={setPhone} />
```
