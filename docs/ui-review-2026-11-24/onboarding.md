# UI/UX Gap Review: Onboarding + Auth (mobile/)

Scope: `app/(auth)/*`, `app/(onboarding)/*`, `app/artist/onboarding/*`, `app/artist/in-review.tsx`, `app/artist/index.tsx`, `app/customer/index.tsx`, `app/index.tsx`, plus the components and hooks they use (`src/components/{auth,artist-onboarding,common}`, `src/hooks/{auth,artist-onboarding}`), the root gate (`app/_layout.tsx`) and the artist layout (`app/artist/_layout.tsx`).

All paths are relative to `mobile/`. This was a read-only review; no files were changed.

Severity: **P0** = broken or blocking, **P1** = notable UX gap, **P2** = polish.

---

## 0. Cross-cutting findings (apply to many screens)

| # | Sev | Gap | Where |
|---|---|---|---|
| X1 | P1 | **The progress bar is wrong.** Auth shows "step N of 3" (Log in, Verify, Your details). A returning user finishes at step 2, while a new user hits "3 of 3" and then still has Choose role. Artists then get another bar for 5 more steps. Nothing gives one honest view of how much is left. | `src/components/common/FormScreen.tsx:11`, `app/(auth)/login.tsx:33`, `app/(auth)/otp.tsx:73`, `app/(onboarding)/signup.tsx:54` |
| X2 | P1 | **Screen readers don't hear the progress bar.** `accessibilityLabel` is set on a plain `View` without `accessible`, `accessibilityRole="progressbar"` or `accessibilityValue`, so VoiceOver and TalkBack skip it. | `src/components/common/FormScreen.tsx:41` |
| X3 | P1 | **Screen readers don't hear errors.** Each screen's error is a plain `AppText` with no `accessibilityLiveRegion="polite"` or `accessibilityRole="alert"`. `AppTextField`'s inline error is not tied to its input either (no `accessibilityHint` or `aria-describedby`). | `src/components/common/AppTextField.tsx:57-61`; every screen's `{error ? <AppText …>}` line |
| X4 | P1 | **Errors can sit off screen.** Submit errors render at the bottom of a scrolling body while the button is pinned in the footer. On long steps (Profile, Location, Identity) a failed Continue shows nothing visible. There is no scroll-to-error and no toast. | `app/artist/onboarding/profile.tsx:144`, `src/components/artist-onboarding/LocationForm.tsx:151`, `app/artist/onboarding/identity.tsx:132`, `app/artist/onboarding/portfolio.tsx:131` |
| X5 | P1 | **Disabled buttons don't say why.** Continue / Send code / Submit go grey (opacity 0.4) and never say what is missing. Profile is the worst: the photo is silently required. | `src/components/common/AppButton.tsx:57`; `app/artist/onboarding/profile.tsx:71`, `app/(auth)/login.tsx:40`, `app/artist/onboarding/identity.tsx:97` |
| X6 | P1 | **Destructive "Back" or "Close" signs the user out with no confirmation.** The button is labelled Back (or shows an X) but runs `signOut()`, and typed data is lost. | `app/(onboarding)/signup.tsx:53`, `app/(onboarding)/choose-role.tsx:46-49`, `app/artist/onboarding/intro.tsx:44-51`, `app/artist/in-review.tsx:79` |
| X7 | P1 | **Only one error boundary for the whole app.** CLAUDE.md §8 asks for one per route group with a retry fallback. There is a single root `ErrorBoundary` and none for `(auth)`, `(onboarding)` or `artist/onboarding`. A render crash in one step wipes the whole app. | `app/_layout.tsx:88-96`; `app/(auth)/_layout.tsx`, `app/(onboarding)/_layout.tsx`, `app/artist/onboarding/_layout.tsx` |
| X8 | P2 | **Third-party primitives are used raw in route files.** `expo-image`, `expo-linear-gradient` and `react-native-svg` appear directly in routes, against CLAUDE.md §5 and §11. Wrappers `Photo` and `PhotoScrim` already exist in `src/components/common`. | `app/(auth)/welcome.tsx:2,4,23,31`; `app/(onboarding)/choose-role.tsx:3,6,7,139-166`; `app/artist/onboarding/intro.tsx:3,53-56`; `app/artist/in-review.tsx:3-4,40-45`; `identity.tsx:4,155`; `portfolio.tsx:4,89,99`; `profile.tsx:4,110` |
| X9 | P2 | **Text characters used as icons**, against CLAUDE.md §11: `+`, `▾`, `+ Add service`. | `profile.tsx:110`, `identity.tsx:157`, `portfolio.tsx:110`, `services.tsx:71`, `src/components/artist-onboarding/CityField.tsx:26`, `LanguageField.tsx:65` |
| X10 | P2 | **Hard-coded sizes instead of tokens.** Fixed numbers for font size, letter spacing, radius, padding and margin override the typography and spacing tokens. Examples: `fontSize: 28/10.5/13.5/23.4/36/34/11/13`, `borderRadius: 24/22/18/14`, `padding: 24/14`, `marginTop: 18/20/26/12`, `height: 236/308/640/420`, `insets.top + 64`. | welcome 12,34,39-43,48; choose-role 54-57,63,68-70,75,133-169; intro 27,42,48,52,59,78; in-review 27,41-46,64; identity 101-102,127,149,161; portfolio 63,91-92,108-110,124; profile 106-116,121,124,135; services 51-71; AddServiceSheet 93-94,159; LanguageField 69-81; PinConfirmSheet 32,37 |
| X11 | P2 | **Colour opacity built by appending hex to token strings** (`${fade}00`, `${base}BF`, `${white}99`, `${brand}55`). This breaks if a token is ever `rgba()` or 3-digit hex, and transparent tints should be semantic tokens. | welcome.tsx:32, choose-role.tsx:141,152, PhoneInput.tsx:66, OtpInput.tsx:113, AppTextField.tsx:33 |
| X12 | P2 | **Large text sizes break layouts.** Fixed heights (role card 236, intro collage 308, welcome hero 640) plus `lineHeight` at or below `fontSize` (welcome 28/28, role card 23.4/23) clip at large accessibility font sizes, especially on Android. No `maxFontSizeMultiplier` is set. | welcome.tsx:40, choose-role.tsx:133,157, intro.tsx:52,59 |
| X13 | P2 | **No `returnKeyType` / `onSubmitEditing` field chaining** in any multi-field form, so the keyboard "next" doesn't move between fields. | signup.tsx:64-97, profile.tsx:121, LocationForm.tsx:139-148, AddServiceSheet.tsx:144-150 |
| X14 | P2 | **Back loses unsaved edits without warning.** On steps that save only on Continue (Profile, Location, AddServiceSheet), Back or swipe throws away typed data. | profile.tsx:91, location.tsx:12, AddServiceSheet.tsx:92 |
| X15 | P2 | **No offline awareness on the forms.** Users only learn they are offline after submitting (generic "Network unreachable"). Nothing warns up front or keeps a draft queued. | all form screens |

---

## 1. `app/index.tsx`: boot hub

| Sev | Gap | Line |
|---|---|---|
| P2 | Returns `null` while restoring or unavailable. That is correct (the gate draws those states), but if this route ever renders outside the gate the user sees a blank screen. Low risk. | `app/index.tsx:9` |

**Root gate (`app/_layout.tsx`)**
- P2: The restoring state is a blank `View`. It is covered by the native splash, but if `hideAsync` runs early or the restore is slow there is no branded loader. (`app/_layout.tsx:54-56`)
- P2: `SessionUnavailable` has a good title, body and retry. It lacks Sign out (an escape hatch when the server is down for a long time) and a support or contact link. (`src/components/auth/SessionUnavailable.tsx:24-33`)

## 2. `app/customer/index.tsx`
No gaps. It is a pure redirect.

## 3. `app/artist/index.tsx` and `app/artist/_layout.tsx`: artist hub

| Sev | Gap | Line |
|---|---|---|
| P1 | **No loading state.** While `GET /artists/me` is pending the layout paints an empty canvas, with no spinner or skeleton. On a slow network after Choose role → artist, the screen looks frozen. | `app/artist/_layout.tsx:29` |
| P2 | The error state is a bare message plus Try again: no title, no Sign out, no "Browse as customer" escape. An artist with a broken profile fetch is stuck. | `app/artist/_layout.tsx:30-36` |
| P2 | The hub returns `null` until data arrives (fine, because the layout gates it). | `app/artist/index.tsx:10` |

---

## 4. `app/(auth)/welcome.tsx`

### Hero
- P2: `HERO_HEIGHT = 640` and gradient `height: 420` are fixed. On a 667pt iPhone SE the photo fills almost the whole screen and the copy overlaps the subject. On tablets the image stops at 640 and the rest is flat colour. Size it from `useWindowDimensions`. (12, 27, 34)
- P2: The image is decorative and correctly has no label. `testID` in production code is fine.

### Copy block
- P2: Font size, letter spacing, line height and margins are all hard-coded, overriding the `eyebrow`, `hero` and `body` variants. (39-45)
- P2: The value proposition is only "booked in minutes". There are no trust signals: verified artists, count of artists, ratings, secure payments, cities served. Best-in-class marketplaces show social proof here.
- P2: The copy says "Mehendi"; elsewhere the product says "Mehndi" or "mehendi". Spell it the same way everywhere.

### CTAs
- P1: **"Get started" and "I already have an account" do the same thing** (both `toLogin`). The second button is a false choice, and returning users may expect a different flow. Use one CTA ("Continue with phone"), or keep both and pass intent to tailor the copy on Login. (18, 49-50)
- P1: **No guest or browse mode.** Customers must verify a phone before seeing a single artist. Best-in-class marketplaces (Urban Company, Airbnb) let people browse first and gate sign-in at booking.
- P2: No language picker (Hindi and regional languages) for an India-first audience.
- P2: Terms and Privacy only appear on the next screen. Consider linking them here too.

---

## 5. `app/(auth)/login.tsx`: "Your number"

### Header and progress
- P2: "Step 1 of 3" is misleading for returning users (see X1). (33)
- P2: The eyebrow "LOG IN / SIGN UP" is good, but the subtitle "No passwords." doesn't say the code arrives by SMS from a short code, or roughly when.

### Phone input (`src/components/common/PhoneInput.tsx`)
- P1: **The phone input has no `accessibilityLabel`.** A screen reader announces the placeholder "98450 67890" or nothing. (`PhoneInput.tsx:63-80`)
- P1: **Validation is too loose.** `PHONE_RE = /^\+[1-9]\d{6,14}$/` accepts `+91` plus 5 digits, so Send code turns on for invalid Indian numbers and the server error comes after a round trip. Check country-specific lengths (India: exactly 10 digits starting 6-9) and show an inline hint ("Enter a 10-digit mobile number"). (`login.tsx:12,40`)
- P2: No `autoComplete="tel"` / `textContentType="telephoneNumber"`, so OS autofill of the user's own number is missing. (`PhoneInput.tsx:63-80`)
- P2: The country-code chip has no `accessibilityRole="button"` or hint ("Change country"), and there is no chevron to show it is tappable. (`PhoneInput.tsx:59-61`)
- P2: **Country picker** problems:
  - only 12 countries, no search, no flags;
  - no title, no close button (only a backdrop tap), no tick on the current country;
  - rows have no `accessibilityRole`;
  - `maxHeight: 420` is a magic number;
  - picking a country keeps the national digits even when they no longer make sense.
  (`PhoneInput.tsx:8-13,83-101`)
- P2: Pasting `+91 98450 12345` or `09845012345` doubles the prefix or keeps the leading 0. Normalise the paste. (`PhoneInput.tsx:69`)

### Error
- P1: The rate-limit message "Please wait before requesting another code" has no countdown. The user can't tell if that means 10 seconds or 10 minutes. The server cooldown is 60s (`backend/app/auth/config.py:16`), so show a timer. (`login.tsx:20`)
- P2: The error is not announced (X3). SMS delivery failure from the server falls back to a generic "Something went wrong". Map it to "We couldn't send an SMS to this number". (`login.tsx:19-21`, `backend/app/auth/service.py:80-85`)

### Footer
- P1: **"Terms" and "Privacy" are not links.** They are styled spans with no `onPress` and no `accessibilityRole="link"`, so consent is unreadable (a legal and trust gap). (`login.tsx:36-39`)
- P2: The legal text is fixed at 11pt (`fontSize: 11` ×3), below comfortable reading size, and overrides the caption token. (36-38)
- P2: No secondary channel (WhatsApp OTP or a voice call), which is common in India when SMS is slow.

---

## 6. `app/(auth)/otp.tsx`: "Enter the code"

### Heading and "Edit" number
- P2: The "Edit" link is a 13pt inline text with no `hitSlop`, a touch target well under 44pt. (83)
- P1: **Wrong number, then a re-request, hits the cooldown.** Edit → back to Login → Send code within 60s returns `rate_limited`. The 60s timer is not carried across. (27, 83; `login.tsx:24`)
- P2: If `phone` is missing (deep link or state restore), the subtitle reads "Sent to " and verify posts an empty phone. Redirect to `/login` instead. (18, 82)

### Code boxes (`src/components/common/OtpInput.tsx`)
- P1: **Each box has no accessibility label** ("Digit 1 of 6"), so a screen reader hears six unlabeled text fields. A single hidden input with visual boxes is the accessible pattern. (`OtpInput.tsx:110-137`)
- P2: Android SMS autofill relies on `autoComplete="sms-otp"` only. The SMS Retriever / User Consent API (one-tap fill) is not used. (`OtpInput.tsx:122-123`)
- P2: While verifying, the boxes are locked (`editable={!busy}`) but show no in-box busy state. Only the footer button spins. (125)

### Error handling
- P1: **Expired codes, locked codes (5 attempts) and inactive users all show "That code is incorrect."** The backend returns the same `auth_error` "Invalid or expired code" for each (`backend/app/auth/service.py:92-99,107`). After the 5th attempt or the 5-minute expiry the user keeps typing into a dead code. Track attempts on the client and, after a failure, say "Code incorrect or expired. Request a new one" and highlight Resend. (42-44)
- P2: No attempts-remaining hint and no code expiry indicator (TTL is 5 min, `backend/app/auth/config.py:14`).

### Resend
- P1: **A successful resend gives no feedback.** The timer resets silently. Add a toast or inline "New code sent to +91 …". (54-60)
- P2: **The timer shows "0:60" at start** because `RESEND_SECONDS = 60` is formatted as `0:${secs}`. Format as m:ss. (15, 102)
- P2: The timer is a chain of `setTimeout`s, which pause when the app is backgrounded (the user goes to read the SMS). It drifts and shows more time than the server enforces. Use a deadline timestamp. (29-33)
- P2: The resend control is a caption-size text, a small target. When disabled it is still focusable with `onPress={undefined}`. Good: it has `accessibilityState.disabled`. (91-107)

### Footer
- P2: The Verify button is redundant with auto-submit, but kept for retries, which is fine. "Step 2 of 3" is misleading for returning users (X1).

---

## 7. `app/(onboarding)/signup.tsx`: "Your details"

### Heading
- P2: The title "What's your name?" doesn't match the content: the screen also asks for date of birth and email. (61)
- P1: **Nothing explains why date of birth is needed** (18+ eligibility). Collecting DOB without a reason is a trust gap. Add helper text such as "You must be 18+. We never show this publicly." (70-85)

### Name fields
- P1: **Labels are placeholders only** (`hideLabel`). Once typed, the visible context is gone. Mixed required and optional fields (first required, last optional) aren't marked. (64, 67)
- P2: No max length and no character rules (digits or emoji in names). The server error surfaces as an email error (see below).

### Date of birth
- P1: **Typed DOB with no date picker.** The DD/MM/YYYY hint lives in the placeholder and disappears once typing starts. A wheel or calendar picker (or at least a persistent helper label) is standard. (71-84; `src/utils/auth/date-of-birth.ts:4`)
- P2: The iOS `number-pad` keyboard has no return key, so there is no way to go to Email except tapping. (79)

### Email
- P2: Validation runs only on submit, not on blur. (88-97)
- P2: The "Optional" pill disappears as soon as the user types (`accessory && !rest.value`). That is fine, but the visual label is also gone. (`AppTextField.tsx:53`)

### Submit and errors
- P1: **Every server `validation_error` is reported as an email error.** A DOB or name rejection (for example the device clock and server timezone disagreeing on an 18th birthday) shows "Enter a valid email", which is wrong and confusing. Map `details.field`, or fall back to the general error. (42)
- P1: **The WhatsApp opt-in is forced on** (`whatsapp_booking_updates: true`) with no visible consent. WhatsApp Business policy and DPDP both expect explicit opt-in. Add a pre-checked-off toggle, or at least a disclosure. (37-38)
- P1: **Back signs out silently** and throws away typed details (X6). The a11y label says "Back". (49-53)
- P2: Continue turns on with only a first name. DOB errors appear only after tapping, so there is no up-front "required" signal. (57)

---

## 8. `app/(onboarding)/choose-role.tsx`

### Header
- P1: The Back button signs out when there is no history (X6), with no confirmation and labelled "Back". (46-49, 59-66)
- P2: No progress cue after the "3 of 3" bar on Signup. This screen looks like an unexpected 4th step (X1).

### Role cards
- P2: The arrow is a raw `react-native-svg` `<Svg><Path>` instead of `Icon name="arrow-right"`. (164-166)
- P2: Magic numbers throughout: `height: 236`, `borderRadius: 24`, shadows, `fontSize: 23.4`, `lineHeight: 23` (below font size, so glyphs clip), `width: '58%'`, `left/top: 18`, and the 38×38 CTA circle. (133-169)
- P2: Disabled-but-not-busy opacity is 0.9, which is barely visible. The non-chosen card doesn't read as disabled while the other saves. (135)
- P1: **No expectations are set for the artist path.** "Create your profile" doesn't mention the requirements: Aadhaar, 6+ photos, a price list, a 24-48h review. A short line ("5 steps · ~10 min · ID needed") would cut drop-off later. (88-96)
- P2: The accessibility label joins title and CTA ("Book an artist. Browse artists") with no hint of what happens when tapped.

### Error and footer
- P2: The error renders under the cards and may be below the fold on small screens. It is not announced (X3). (99)
- P2: "You can switch roles anytime from your profile." Good reassurance. Consider moving it above the cards.

---

## 9. `app/artist/onboarding/intro.tsx`

### Close button
- P1: **The X signs the user out without confirmation.** The icon reads as "dismiss", not "log out". (44-51)

### Collage
- P1: **The layout doesn't scroll.** A fixed 308pt collage, a 36pt headline, the benefits and the footer sit in a non-scrolling `View` with `flex:1`. On small phones or large text sizes the "Let's get started" CTA is pushed off screen or overlaps. (42, 52, 59, 70)
- P2: The images have no accessibility handling (they are decorative, so mark them hidden from screen readers). It reuses customer and welcome photos, which don't show artists' work.

### Benefits
- P2: Only two benefits. The payouts line has been removed. There are no trust or value signals: commission rate, how many clients nearby, cancellation protection, "free to join". (17, 62-69)

### Steps teaser
- P1: **"5 short steps" lists no prerequisites.** Artists learn at step 4 that they need 6 photos and at step 5 that they need both sides of their Aadhaar card. Add a "Keep these handy" checklist (Aadhaar card, 6+ photos of your work, your prices) and a time estimate. Add "Your progress saves automatically" (resume exists in `src/utils/artist-onboarding/routing.ts:16-22`, but the user is never told). (71)

### Secondary action
- P2: The "Browse as customer" pill has `paddingVertical: 8`, about 32pt tall, under the 44pt minimum. Its fontSize 12 is hard-coded. (78-80)

---

## 10. `app/artist/onboarding/profile.tsx`: Step 1 · Profile

### Navigation
- P1: **No way out while editing.** When `editing` (rejected → "Edit and resubmit", or approved → Edit profile), `onBack` is `undefined`. There is no back, cancel or "discard changes". An approved artist who taps Edit profile has their profile set back to draft by the server (`EditProfileRow.tsx:24-26`) and must finish all 5 steps to get back to live. Add "Cancel editing" (re-submit unchanged) or a save-and-exit. (91)

### Profile photo
- P1: **The photo is required but not marked.** Continue silently stays disabled until a photo is uploaded (`ready` includes `!!photoKey`). Show "Required" and explain when Continue is disabled. (71, 115-116)
- P2: Uses a `+` text glyph. The 84/42/38 avatar sizes are hard-coded. Upload progress is just a spinner, with no percentage and no cancel. (108-112)
- P2: Camera capture isn't offered: `pickImages` opens the library only. (57; `src/api/artist-onboarding/upload.ts:16-20`)

### Business name
- P2: No guidance on whether a personal name is allowed. maxLength 120 has no counter. (121)

### "What do you offer?" categories
- P1: **No loading state.** While `categories.isPending` the chip row renders empty, so the section looks blank. Add a skeleton. (125-133)
- P1: **The cap of 6 is silent.** The 7th tap is ignored with no message or haptic. Add the helper "Pick up to 6". (21, 67-68)
- P2: The section label is a separate `AppText` that isn't announced as a group label for the chips. (124)

### City
- P1: **Loading state missing.** `CityField` gets `[]` while loading and opens an empty sheet. (136-140)
- P1: **The city is asked twice.** It is asked here, and again implied by the Location step's area (which "sets the city", `LocationForm.tsx:31-33,50`). A pin in another city silently overrides it. Collect location once.
- P1: **The CityField screen-reader label is the fixed "City".** The chosen value isn't announced. Uses a `▾` text glyph. (`CityField.tsx:18,26`)
- P2: The city sheet has no search and no empty state. (`CityField.tsx:28-40`)

### Experience and languages (`ProfileDetailsFields.tsx`, `LanguageField.tsx`)
- P2: "(optional)" lives inside the placeholder of the experience field, so it disappears when typing. (`ProfileDetailsFields.tsx:27`)
- P2: The experience error only shows on Continue, at the bottom of the screen. (`profile.tsx:74-75`)
- P2: The language sheet has a hard-coded radius 24 and padding 24. Its "Remove" X targets are 12pt icons with hitSlop 8, about 28pt total. (`LanguageField.tsx:59-61,69`)

### Save
- P2: Continue error placement (X4). No "Saved" confirmation.

---

## 11. `app/artist/onboarding/location.tsx` and `LocationForm.tsx`: Step 2 · Location

### Heading
- P2: Good privacy copy ("Clients only see your area, never your address"). (`LocationForm.tsx:108`)

### "Use my current location" card (`CurrentLocationCard.tsx`)
- P1: **No "Open Settings" action when location permission is blocked.** The message says "Turn it on in Settings" with no button (use `Linking.openSettings()`). (`LocationForm.tsx:62-63`, `src/core/location/location.ts:97-99`)
- P2: **"Change" forgets the pin** (`forget`, sets idle) instead of reopening the map. The label misleads. (`LocationForm.tsx:76,116`; `CurrentLocationCard.tsx:44-46`)
- P2: After confirming the pin, the area lookup (`nearest`) shows "Pin placed" with no spinner. (`LocationForm.tsx:49,113`)
- P2: Good: the "busy" state has `accessibilityLiveRegion`. (`CurrentLocationCard.tsx:25`)

### Map sheet (`PinConfirmSheet.tsx`)
- P2: No address search, no recenter-on-me, no map loading or failure state. Only `Close`. Header fontSize 16 is hard-coded. (32-44)

### Area
- P1: **No loading state.** While `areas` loads, `AreaField` gets `[]` and the sheet says "No areas listed for this city yet", which reads as an error. (`LocationForm.tsx:130-137`; `AreaSheet.tsx:43-45`)
- P2: The area rows use `accessibilityRole="button"` with selected state. `radio` would be better. Good: they have a search box. (`AreaSheet.tsx:33-35`)
- P2: The "contact support to add yours" copy has no link to support. (`AreaSheet.tsx:44`)

### Pincode and address
- P2: The pincode error only appears at 6 digits. Pincode and area aren't cross-checked (a 560xxx pincode with a Delhi area is accepted). (`LocationForm.tsx:146`)
- P2: The optional address line says nothing about who sees it. Add "only shared with confirmed bookings" or similar. (148)

### Footer
- P2: Continue is disabled without saying whether the area or the pincode is missing (X5).

---

## 12. `app/artist/onboarding/services.tsx`: Step 3 · Services

### Service list
- P0/P1: **The catalog query's loading and error states are ignored.** `const { data: catalog = [] } = useCategories()` drops `isPending` and `isError`, against the CLAUDE.md §8 rule. When the catalog fails or is still loading:
  - `mine` is `[]`;
  - `AddServiceSheet` computes `nothingListed = [].every(...) === true`;
  - it tells the artist "Services for your categories are being set up. Check back soon."
  
  That is a false dead end that blocks onboarding with no retry. (26-28; `AddServiceSheet.tsx:56,96-99`)
- P1: **Services can't be edited.** A row can only be removed (X), so a typo in a price means delete and re-add. (53-65)
- P1: **Remove has no confirmation, undo or pending state.** One tap on a small X deletes the service. Repeat taps can fire several deletes. (39-42, 61-63)
- P2: The empty state is just the dashed "+ Add service" button. There is no explanation or example price range ("Bridal makeup typically ₹8k-25k in Bengaluru"). Pricing guidance is a key conversion lever in best-in-class marketplaces. (66-72)
- P2: The `+` glyph is text. Height 52 and padding 14 are hard-coded. (69-71)

### Add service sheet (`AddServiceSheet.tsx`)
- P1: **No close button and no drag handle.** The only ways out are a backdrop tap or Android back. In the "nothing listed" state the only button is a disabled "Save service". (90-162)
- P1: **Validation errors are not attached to fields.** One error line at the bottom of the scroll, possibly off screen, for price, duration or extras. (68-71, 157)
- P2: Duration is typed in raw minutes. Presets (30/60/90/120 chips or a stepper) would be faster and less error-prone. The price field has no ₹ prefix and no thousands separator. (144-147)
- P2: No sheet title per sub-step and no "Step 1/3" cue across the three progressive sections. The comment describes three steps, but the user just sees content grow. (19-22, 95-155)
- P2: Hard-coded `borderRadius: 24`, `padding: 24`, `paddingHorizontal: 24`, `insets.bottom + 16`. (93-94, 159)
- P2: The template rows use `accessibilityRole="radio"` with `selected`. Radio buttons should use `checked`. (121-123)

### Package photo (`ServicePhotoField.tsx`)
- P2: **Unhandled promise rejection.** `pickImages` is called outside the try, so a picker or permission failure rejects unhandled. (31-32)
- P2: Change and Remove text targets are about 20pt tall with hitSlop 6. (65-70)

---

## 13. `app/artist/onboarding/portfolio.tsx`: Step 4 · Portfolio

### Heading
- P2: Good: the minimum is stated and shown in the CTA ("Continue · 2 of 6 photos"). Missing: why 6, and examples of good versus bad photos.

### Grid
- P1: **Managing photos depends on long-press**, which users can't discover and screen readers can't easily trigger. Tiles have no `accessibilityRole` and no `accessibilityActions` (Make cover, Remove). Add a visible "⋯" overflow on each tile or an "Edit" mode. (81-88)
- P1: **Remove has no confirmation and no undo.** (61, 121)
- P2: There is no drag-to-reorder. Only "Make cover" exists. (60)
- P2: Tile `width: '31.5%'`, `borderRadius: 16` and the Cover badge sizes are hard-coded. `+` is a text glyph. (63, 91-92, 108-111)

### Uploads
- P1: **Failed uploads vanish.** A failed item is dropped from the queue (`finally` filter) and only the last error shows. If 3 of 10 fail, the user doesn't know which. Keep failed tiles with a "Retry" badge. (40-48)
- P2: Uploads run one at a time with no per-item progress and no "Uploading 3 of 10". (39-49)
- P2: Back during an upload leaves the loop running unseen. There is no warning. (67)
- P2: Camera capture isn't offered (library only). (36)

### Footer
- P2: During uploads Continue is disabled, but the label doesn't change ("Uploading…"). (71-75)

---

## 14. `app/artist/onboarding/identity.tsx`: Step 5 · Identity (KYC)

### Heading and trust
- P1: **Trust and consent fall short for Aadhaar collection.**
  - There is no explicit consent checkbox (DPDP Act 2023 and UIDAI guidance).
  - No link to the privacy policy.
  - No explanation of *why* ID is required (client safety, verified badge).
  - No retention or deletion statement.
  
  The two reassurance lines are good but not enough for an ID upload. (99, 127-131)
- P1: **Only Aadhaar is accepted.** There is no PAN, voter ID, passport or driving licence alternative, which excludes artists without Aadhaar or unwilling to share it. Not supporting **masked Aadhaar** (the UIDAI-recommended last-4-only form) also conflicts with asking for the full 12-digit number. (18, 110-119)

### Aadhaar number field
- P2: The Verhoeff check is good. The error appears on blur, which is fine. There is no secure-entry option (show/hide) for a sensitive ID shown on screen. (110-119)

### Card sides (front/back)
- P1: **Library only, no camera capture**, and no capture guidance (all four corners, no glare, readable). Most users haven't photographed their card beforehand. Upload rejections for blurry images are found only by admin review, which means a 24-48h round trip. (51-64, 137-166)
- P2: `+` text glyph; hard-coded radius 14 and fontSize 22/13. The "· Retake" suffix looks like a link but isn't separately tappable. (149-163)
- P2: The tile's screen-reader label is good (Uploading, Retake or Add).

### "On file" state
- P2: "Replace details" has no cancel to go back to the on-file details. One accidental tap forces a full re-entry. (66-72, 100-106)

### Submit
- P1: **No review step before submitting.** There is no preview of the storefront as clients will see it ("Review your profile") and no checklist of the 5 steps. Best-in-class onboarding ends with a summary and edit links. (97)
- P2: Errors are not attached to the field and appear below the trust box. (132)

---

## 15. `app/artist/in-review.tsx`

### Status header
- P2: A raw `Svg` illustration, `insets.top + 64`, fontSize 34 and a gradient are hard-coded or used raw (X8, X10). (40-48)
- P2: Pending, rejected and suspended states are handled. There is no **approved / "You're live!"** celebration screen. The artist is jumped straight into tabs when the guard flips.

### Timeline (pending)
- P2: `submitted` is an empty string if `submitted_at` is missing, so "Profile submitted" shows no date. (24-26, 68)
- P2: "24-48 hours" is hard-coded twice. There is no "we'll notify you" text or **push-notification opt-in** at the moment of highest intent. (65, 69)
- P2: No manual refresh (pull-to-refresh or a "Check status" button). The status refreshes only when the app returns to the foreground (`query-client.ts:20`).
- P2: No "Preview my profile" or "Edit while in review".

### Rejected
- P1: **The rejection reason is a single free-text paragraph.** It doesn't point to the step or field that needs fixing, and "Edit and resubmit" always starts at step 1 (`routing.ts:31`). Deep-link to the failing step and highlight the fields. (57-61, 77)

### Suspended
- P1: **"We'll contact you" with no contact channel.** There is no support link, email or chat, even though a support feature exists (`app/artist/support`). (50-56)

### Actions
- P1: **Silent catch, which CLAUDE.md §8 calls a review blocker.** `switchToCustomer` catches the error and only resets `switching`. The user gets no message and the button just stops spinning. Compare `intro.tsx:29-39`, which shows the error. (29-37)
- P2: Sign out has no confirmation. (79)

---

## 16. Hooks: `src/hooks/auth/auth.ts`, `src/hooks/artist-onboarding/artist-onboarding.ts`

- P2: **Auth requests are split between hooks and context.** `useRequestOtp` is a TanStack mutation (Login), but OTP verify, resend, signup and choose-role call context methods with hand-rolled `busy` state (`otp.tsx:25-26`, `signup.tsx:25`, `choose-role.tsx:29`). That gives two patterns for the same API family and inconsistent loading and error handling.
- P2: The `useRequestOtp` docstring says "text a login code to a **staff** phone", which is stale or wrong copy. (`auth.ts:8`)
- P2: `useArtistWrite` (raw callback) and `useProfileMutation` (mutation) both exist. Portfolio and Identity use the raw callback, so they get no `isPending` and no invalidation of requirements. (`artist-onboarding.ts:21-30` vs `33-45`)
- P2: `MIN_PHOTOS = 6` is duplicated in `routing.ts:6` and `portfolio.tsx:15`. A drift risk.

---

## 17. What a best-in-class marketplace onboarding would add (summary)

1. **One honest progress model**: a single "Account · Role · Profile …" stepper, or a "2 min left" estimate, plus a visible "Progress saved, resume anytime".
2. **Prerequisite checklist up front** (artists): Aadhaar, 6+ photos, price list, about 10 minutes.
3. **Guest browse for customers**, with phone sign-in deferred to booking.
4. **OTP polish**: SMS Retriever autofill, WhatsApp or voice fallback, an attempts and expiry message, "Code sent" confirmation, a deadline-based timer that carries across Edit number.
5. **KYC trust**: consent checkbox, privacy link, why we need it, masked Aadhaar or alternative IDs, camera capture with an edge-detection overlay.
6. **Pricing help**: suggested ranges per category and city, duration presets, editing existing services.
7. **Review and preview before submit**, plus deep-linked rejection fixes.
8. **Accessible photo management**: visible per-tile actions, drag reorder, per-item retry.
9. **Approval moment**: a "You're live" celebration, a push opt-in during review, and share-your-profile links.
10. **Confirmations on destructive or exit actions** (sign out, remove service or photo, discard edits) and an "unsaved changes" guard.
