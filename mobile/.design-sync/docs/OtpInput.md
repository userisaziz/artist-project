---
category: Forms
---
# OtpInput

Row of 6 single-digit boxes for the SMS code. Typing advances focus, backspace steps back, a pasted/autofilled code spreads across the boxes. `onComplete(code)` fires once when every box is filled. Set `error` after a failed verify: the boxes clear and shake. `busy` locks input while verifying. Boxes share the row width, so put it in the same column as the button below.

```jsx
<OtpInput onComplete={verify} error={wrongCode} busy={verifying} />
```
