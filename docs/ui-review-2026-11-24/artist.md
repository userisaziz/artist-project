# Artist-side UI/UX gap review (mobile/, excluding onboarding and Home)

Scope: `mobile/app/artist/**` (except `onboarding/*`, `(tabs)/home.tsx`, `in-review.tsx`) plus the `src/` components and hooks they render.
Ratings: **P0** = broken or blocking, **P1** = notable UX gap, **P2** = polish.
Paths are relative to `mobile/`. Benchmarks: Urban Company Partner (UCP), Airbnb Host (AH), Shopify mobile (SM).

---

## 0. Cross-cutting findings (affect several screens)

| # | Rating | Gap | Evidence |
|---|---|---|---|
| X1 | **P1** | **New requests don't show up in real time.** A foreground push only invalidates the notifications query. The bookings lists (`useArtistBookings`) don't poll, and staleTime is 60s. An artist sitting on Bookings when a request arrives sees nothing until they pull to refresh, even though the request has a 3h countdown. UCP and AH push the lead straight into the list and ring. | `src/hooks/notifications/use-push.ts:44`; `src/hooks/bookings/bookings.ts:44-53` (no `refetchInterval`); `src/core/api/query-client.ts:10` |
| X2 | **P1** | **Possible dead-end from a cold-start deep link.** `app/artist/_layout.tsx` has no `unstable_settings.initialRouteName`. When a push (for example `/artist/chat/{id}` from `backend/app/chat/service.py:206`) opens `booking/[id]` or `chat/[id]` on a cold start, `BackHeader`/`ChatHeader` call `router.back()` without checking `canGoBack()`, and nothing sits underneath. Needs a device test to confirm. The pattern already exists in `app/(auth)/login.tsx:27`. | `app/artist/_layout.tsx:41`; `src/components/common/BackHeader.tsx:24`; `src/components/chat/ChatHeader.tsx:18` |
| X3 | **P1** | **Customer avatars are always blank.** `Avatar uri={null}` on the request card, booking detail and enquiry detail, so the artist never sees who the client is. Chat has `counterpart.photo_url`, so the data exists elsewhere. | `src/components/bookings/RequestCard.tsx:51`; `ArtistBookingDetail.tsx:74`; `src/components/quotes/ArtistEnquiryDetail.tsx:45` |
| X4 | **P1** | **No customer context on requests or enquiries.** No "repeat client", past bookings with you, customer rating or member-since. UCP and AH both show guest history before you accept. | `RequestCard.tsx:52-55` |
| X5 | P2 | **Token violations everywhere.** The theme has `spacing[n]`, `radii.*` and typography variants (MenuRow and Segmented use them), but screens hardcode `fontSize: 30/26/24/20/15/14.5/13/12.5/11/10.5`, `gap: 12`, `padding: 14/16`, `borderRadius: 16/18/21`, `height: 34/42`. Examples: `app/artist/(tabs)/bookings.tsx:65-66`, `calendar.tsx:46-96`, `me.tsx:73,110,113`, `RequestCard.tsx:37-43`, `AgendaRow.tsx:30-45`, `ConversationRow.tsx:42-43`, `MessageBubble.tsx:22-34`, `ChatComposer.tsx:45-53`, `HelpSupport.tsx:26,35`, `MyShop.tsx:44,48`. The display headers (`fontSize: 30, lineHeight: 34`) are repeated on every tab and should be a `displayLg` variant. | as listed |
| X6 | P2 | **Text glyphs used as icons, against CLAUDE.md §11.** `"+ New post"`, `"+ Add product"`, `"+ Photos"`, `"+ Suggest a new one"`, `"+ Cover photo"`, and `●` dots in the calendar legend. | `src/components/feed/MyPosts.tsx:39`; `app/artist/(tabs)/me.tsx:97`; `MyShop.tsx:59`; `ProductForm.tsx:115`; `CustomServiceSheet.tsx:108`; `NewPostForm.tsx:152`; `calendar.tsx:91-92` |
| X7 | P2 | **Logic and subcomponents in route files, against CLAUDE.md §2 ("route files stay thin").** `ServiceRow` and `RowAction` live in `app/artist/services.tsx:128-175`; `ArtistReviewRow` and `SmallAction` in `app/artist/reviews.tsx:98-132`. `SmallAction` and `RowAction` are the same component; promote one shared `PillAction` to `components/common`. `calendar.tsx` builds the whole month grid inline (`:57-93`). | as listed |
| X8 | P2 | **Pull-to-refresh is inconsistent.** It exists on Bookings, Messages, Enquiries and Notifications. It's missing on Calendar, Reviews, Followers, Posts, My shop, Earnings, Booking detail, Enquiry detail and Support. | see per-screen notes |
| X9 | P2 | **No "loading more" footer on most paginated lists.** Only Reviews has one (`reviews.tsx:58`). Missing on Bookings, Messages, Enquiries, Followers, Posts and Notifications. | e.g. `bookings.tsx:73-88` |
| X10 | P1 | **No notification preferences, payout/business settings, language, or terms/privacy entry anywhere on the artist side.** | `me.tsx:88-104` |

---

## 1. Bookings tab: `app/artist/(tabs)/bookings.tsx`

### 1.1 Header and segmented control
- **P2**: The request count shows `"…"` while loading and `"20+"` once a page is full (`:38`). It's a client-side count of loaded pages. The dashboard endpoint already returns `requests` (`types/bookings/bookings.ts:82`), so use that for an exact count.
- **P2**: The scope is local `useState` (`:32`). Per CLAUDE.md §7.4 tabs belong in URL state, so a deep link or notification can't land on "Upcoming".
- **P2**: Hardcoded `fontSize: 30, lineHeight: 34`, `gap: 12` (`:65-66`).

### 1.2 Requests list (`RequestCard`)
- **P0/P1: FlashList v2 recycling leaks local state.** `RequestCard` keeps `declining` and `reason` in `useState` (`RequestCard.tsx:33-34`), and FlashList 2.0.2 (`package.json`) recycles item components. If an artist opens "Decline" and types a reason, then scrolls or the list changes after an accept, the open decline form and the typed reason can appear on a different customer's card. Fix with `useRecyclingState` or a `key`/state reset.
- **P1: Expired requests stay actionable.** When the countdown reads "Expired" (`utils/common/time.ts:87`), Accept and Decline are still enabled (`RequestCard.tsx:78-90`), so tapping them gives a server error. Disable them and show "Expired", or drop the card from the list.
- **P1: No conflict or overlap warning.** Accept doesn't say "you already have X at 4pm" or whether the slot is outside working hours. AH and UCP flag clashes before you accept.
- **P1: Duration and end time aren't shown.** The card shows only `formatWhen(start_at)` (`:60`), but `duration_minutes` and `end_at` are on the booking. Artists need the time block to decide.
- **P1: No decline reason presets.** It's free text only (`:71`). UCP and AH offer chips such as "Fully booked", "Too far" and "Outside my services", with an optional "Suggest another time".
- **P1: Add-ons aren't on the request card.** `AddonLines` appears only on the detail page (`ArtistBookingDetail.tsx:81`). Guest counts drive effort and should be visible before accepting.
- **P2**: The Message button has no busy state in the list. `chat.openingId` is unused here (`bookings.tsx:52`), though the detail page passes `isOpeningChat`.
- **P2**: Accept has no undo or snackbar confirmation. A quick "Accepted, undo" toast is standard for fast, one-thumb triage.
- **P2**: The full address is shown before acceptance (`RequestCard.tsx:61`). Consider showing the area only until accepted, for customer privacy.
- **P2**: Requests aren't sorted by urgency on the client; it relies on server order. Make sure soonest-expiry comes first.
- **P2**: Hardcoded `borderRadius: 18`, `fontSize: 12.5`, `size={46}` (`:39,43,51,66`).

### 1.3 Upcoming list (`AgendaRow` with `complete`)
- **P1: "Mark completed" has no confirmation.** It's an irreversible state change that drives earnings and review eligibility (`bookings.tsx:58`, `AgendaRow.tsx:51-57`).
- **P1: Every upcoming row carries a full-width "Mark completed" button.** It's disabled until start time with no explanation, which doubles row height and buries the list. Show it only when actionable (start ≤ now), or move it into a swipe action or the detail page.
- **P2**: Rows aren't grouped by day ("Today", "Tomorrow", "Sat 30 Nov"). `showDate` only adds a tiny `meridiem · date` caption (`AgendaRow.tsx:40`).

### 1.4 Past list
- **P2**: No filter between completed, declined, expired and cancelled. No "earned" summary on past items, and no link to the review left on a completed booking.

### 1.5 States
- Loading, error and empty are handled via `ListEmptyComponent` (`:83-87`). **P2**: when a refetch fails with data already loaded, there's no indicator (Messages has "Couldn't refresh").

---

## 2. Booking detail: `app/artist/booking/[id].tsx` → `src/components/bookings/ArtistBookingDetail.tsx`

### 2.1 Header and status
- **P2**: The status pill sits alone under the header (`:60`). There's no timeline (requested → accepted → completed, with timestamps), although `responded_at`, `completed_at` and `cancelled_at` are in the payload.

### 2.2 Money section
- **P1: The artist doesn't know what to collect.** Phase 1 is pay-direct (`backend/app/booking/service.py:247`), yet the card shows only "You earn" (`:82`). It doesn't show the customer's total (`subtotal_paise` / `total_paise`), the commission (`commission_paise`), or how the commission is settled with the platform. An artist who charges the "You earn" figure undercharges. Show "Collect from customer ₹X · Platform commission ₹Y · You keep ₹Z" with an explainer.

### 2.3 Customer and logistics
- **P1: No "Get directions" or map for the address** (`:80`). `PinMap` exists in common. UCP puts navigation one tap from the job.
- **P1: No artist-side cancel or "can't make it" path for a confirmed booking.** The backend has customer cancel only (`backend/app/booking/router.py:59`); admin cancels exist. The only route is a generic support ticket limited to the 3 latest bookings (§15). Add at least "Need to cancel? Contact support about this booking", deep-linked with the booking preselected.
- **P1: No "Report a problem" or "Customer didn't show" action here.** The backend has `customer_no_show` as an urgent issue (`backend/app/support/constants.py:19`), but it's only reachable through Help & support chips.
- **P2**: Duration and end time aren't shown. `reschedule_declined_reason` isn't shown. The completed booking's `review` isn't shown, and there's no "Reply to review" link.
- **P2**: No pull-to-refresh or polling. A reschedule request that arrives while the page is open won't appear.

### 2.4 Actions
- **P1**: "Mark completed" has no confirmation (`:94-99`), and its disabled state has no explanation ("Available from 4:00 pm").
- **P2**: The `MoveRequest` card (`:115-141`) doesn't say whether the new time clashes with other bookings or falls outside working hours.
- **P2**: Accept from the detail page stays on the page with no success feedback beyond the pill change.

### 2.5 States
- Loading and error are handled (`:43-49`). A not-found booking falls into the generic error, which is fine.

---

## 3. Calendar tab: `app/artist/(tabs)/calendar.tsx`

### 3.1 Month grid
- **P1: Days off aren't visible on the grid.** `schedule.days_off` is never consulted when rendering cells (`:63-88`). The artist has to tap each day to learn it's off. Weekdays closed in working hours aren't greyed either. AH's calendar makes blocked and available days visually obvious.
- **P1: No bulk or range blocking.** "Day off" is one day at a time via the toggle (`DayOffToggle.tsx`). There's no vacation range, no multi-select of days, and no partial-day block (for example "busy 2–5pm"). UCP and AH both support range blocking and slot-level blocking.
- **P2**: The week starts on Sunday (`WEEKDAYS` `:17`, `monthGrid` `time.ts:94`), while Working hours runs Monday to Sunday (`WorkingHoursForm.tsx:21`). Pick one convention; Monday is standard in India and in AH's settings.
- **P2**: No "Today" button. You can't swipe between months, only use the chevrons (`:50-55`). Past and future months are equally prominent.
- **P2**: Each cell shows a single dot per status, not a count. The `count` variable is only in the a11y label (`:69,74`).
- **P2**: Completed bookings share the "Booked" (accent) dot with confirmed ones (`:67`).
- **P2**: The legend uses `●` text glyphs (`:91-92`). Hardcoded `42/32/16/4/14/10/11/13` sizes (`:64-84`).

### 3.2 Day agenda
- **P1: No timeline or day view.** You get a list of rows, with no sense of free gaps between bookings or relative to working hours.
- **P2**: Booking rows aren't explicitly sorted by start time (`:36-40` relies on server order).
- **P2**: Loading renders a skeleton under the date heading while the grid is already drawn without dots (`:98`), so the grid briefly reads as "nothing booked". Dim the grid or add a spinner in the month header instead.

### 3.3 DayOffToggle (`src/components/artist-schedule/DayOffToggle.tsx`)
- **P1: Silent failure.** If `useSchedule` is loading or errors, the toggle returns `null` (`:18`). The artist doesn't learn that day-off control is unavailable, and there's no retry.
- **P2**: Turning on a day off while requests are pending that day doesn't prompt "You have 2 pending requests on this day — decline them?" The copy says existing bookings stay (`:27`), but pending requests are ambiguous.
- **P2**: No pull-to-refresh on the screen.

---

## 4. Messages tab: `app/artist/(tabs)/messages.tsx` → `src/components/chat/ChatInbox.tsx`

### 4.1 Inbox
- **P2**: No unread filter or "Needs reply" segment. Search is by name only (`:47`).
- **P2**: No footer spinner while paging (`:61`). The loading skeleton and search field show together on the first load; that's fine.
- **P2**: There's no `onEndReachedThreshold`. The default is fine, but it's inconsistent with the other lists.
- **P2**: `ConversationRow` hardcodes the unread badge sizing (`ConversationRow.tsx:42-43`, `fontSize: 11`).
- States are handled, including "Couldn't refresh. Retrying…" (`:50-53`). That's good.

---

## 5. Chat thread: `app/artist/chat/[id].tsx` → `src/components/chat/ChatThread.tsx`

- **P1: The booking tag in the header isn't tappable** (`ChatHeader.tsx:24`). The artist can't jump from the conversation to the booking to accept it. That's a dead-end in the "message, then accept" flow.
- **P1: No quick replies or saved templates.** No contextual actions (Accept request, Send quote, Share location) in the composer. UCP has canned responses, and AH has saved messages plus a booking card pinned in the thread.
- **P2**: No photo attachments (artists need to send design references).
- **P2**: Moderation notes show only on my own messages (`MessageBubble.tsx:17`). That's fine. But the artist isn't told up front that sharing contact details before booking is blocked. A one-line hint above the composer would prevent held messages.
- **P2**: No read receipts or delivered state beyond "Sending…".
- **P2**: `MessageBubble` uses `fontSize: 10.5`, `borderRadius: 18/6`, `padding: 14/10` (`:22-34`); `ChatComposer` uses `borderRadius: 21`, `height: 42` (`:45,53`).
- States are handled (`ChatThread.tsx:59-66`).

---

## 6. Me tab: `app/artist/(tabs)/me.tsx`

### 6.1 Hero (cover, avatar, name)
- **P1: No profile completeness or strength meter.** Only `RequirementsBanner` covers mandatory items (`:85`), and it renders nothing on error (`RequirementsBanner.tsx:17`). There's no guidance on soft items like portfolio count, bio, services with photos, working hours set, or travel radius. AH's "Listing quality" checklist is the benchmark.
- **P2**: You can't change the cover or avatar from here. The cover is `photos[0]` (`:50`), changeable only by re-opening the whole profile for review (§6.3).
- **P2**: `city` renders `''` while loading (`:79`). The name is blank if the profile query errored (`:43`, error not handled; the layout guarantees initial data).
- **P2**: Hardcoded `COVER_HEIGHT=170`, `AVATAR=84`, `fontSize: 26` (`:27,34,73`).

### 6.2 "View public profile"
- **P1: No "Share my profile" link or QR.** This is the artist's main growth lever (Instagram/WhatsApp). The button only previews (`:82`).

### 6.3 Menu card (`:88-104`)
- **P1: Thirteen flat rows with no grouping.** Business (Bookings settings, Working hours, Services, Earnings, Shop), Profile (Location, Experience, Edit profile, Public profile), Growth (Posts, Followers, Reviews, Enquiries), and Account (Support, Notifications, Log out). Today the order is arbitrary: Earnings sits under Edit profile.
- **P2: Inconsistent separators.** The first four rows have explicit 1px dividers (`:90,92,94`); the remaining nine have none (`:95-103`).
- **P1: "Edit profile" hides the artist from clients** until re-review (`EditProfileRow.tsx:19`). It sits casually among everyday rows with no visual warning. Explain which edits need review and which don't (Location, Experience and service prices are review-free). Ideally offer field-level edits for bio and photos without taking the profile offline.
- **P2**: Several rows lack a summary `detail`: Working hours ("Mon–Sat · 10–7"), Earnings ("₹12,400 this month"), My shop ("3 to pack"), Help & support ("1 open ticket").
- **P2**: `Posts & articles` shows `detail="+ New post"` (`:97`), but tapping opens the list, not the composer. The copy is misleading and uses a glyph.
- **P2**: `Enquiries` shows nothing when `open` is 0 or the query errors (`:95`).
- **P1**: Notifications aren't reachable from Me. The only entry is the Home bell (`app/artist/notifications.tsx:4`), so the Home redesign must keep it.

### 6.4 Switch to customer, Log out, Delete
- **P2**: Log out has no confirmation (`:120`). The switch card has hardcoded `borderRadius: 18`, `padding: 16`, `fontSize: 14.5` (`:110,113`).

---

## 7. Experience & languages: `app/artist/details.tsx`

- **P2**: Imperative validation (`parseExperience`, `:23`) instead of RHF + zod, against CLAUDE.md §7 "Forms".
- **P2**: No unsaved-changes guard on back (`:35`). There's no success toast; it just navigates back.
- **P2**: Initial state comes from `saved` at mount (`:18-19`). That's fine because the layout guarantees the profile.

---

## 8. Earnings: `app/artist/earnings.tsx` → `src/components/bookings/EarningsHistory.tsx`

### 8.1 Summary card
- **P1: No pending or upcoming earnings.** Only completed bookings count (`:19`). "Expected from confirmed bookings this month" is missing; the dashboard has the data via upcoming bookings.
- **P1: No breakdown.** Gross collected from customers vs platform commission vs kept isn't shown. Bookings carry `subtotal_paise` and `commission_paise`. The copy "Clients pay you directly" (`:42`) doesn't explain how the commission is owed or settled, which is the biggest earnings-clarity hole.
- **P1: Shop sales aren't included.** They're shown only on My shop (`MyShop.tsx:44`). There's no combined "total income".
- **P2**: No chart or trend comparison ("+18% vs last month"). No period selector.

### 8.2 Month list
- **P1: Months aren't drillable.** You can't tap a month to see the bookings behind the number (`MonthRow` `:54-66` isn't pressable). There's no per-booking statement and no export or download (for tax and GST), which SM and AH both provide.
- **P2**: A new artist sees 12 rows of "No completed bookings ₹0" (`:61`). Collapse empty months or show a proper empty state with a CTA.
- **P2**: No pull-to-refresh (`:34`). The error view is only shown when there's no data (`:32`), so a failed refetch is silent.
- **P2**: The card uses `fontSize: 28`, `padding: 16` (`:38-40`).

---

## 9. Enquiries list: `app/artist/enquiries/index.tsx` → `src/components/quotes/ArtistEnquiries.tsx`

- **P1: No age or response deadline on rows.** It shows "Event 12 Dec", budget/price and details (`EnquiryRow.tsx:34-35`). It doesn't show "received 3h ago" or "expires in …". Speed of reply is the key conversion metric for quotes.
- **P2**: No avatar on rows. No "Closed" count. No footer spinner. When a refetch fails with data already loaded, there's no indicator.
- **P2**: The empty view is wrapped in an extra `View` with `marginTop: 12`, while the FlashList still renders below it. That's fine, but it's inconsistent with Bookings, which uses `ListEmptyComponent`.

## 10. Enquiry detail: `app/artist/enquiries/[id].tsx` → `ArtistEnquiryDetail.tsx`

- **P1: No "Message customer" button.** The artist can't clarify scope before quoting, which is a dead-end compared with booking detail.
- **P1: The quote form is too thin** (`QuoteForm.tsx:50-85`). It has a single price only: no line items or add-ons, no "start from my service X" prefill, no proposed time slot. `QuoteSlotPicker` exists but is used on the customer side only. It doesn't compare the price to the customer's budget ("₹2,000 over budget").
- **P2**: The "Quote sent" confirmation persists after further edits (`QuoteForm.tsx:83`). There's no explicit "the customer sees this" preview.
- **P2**: Duration uses a stepper here, but free-text minutes in the service sheets. Standardize.
- **P2**: If `event_date` is earlier than today, `daysBetween` returns `[]` and the "Valid until" strip is empty (`QuoteForm.tsx:42`). `canQuote` doesn't check the date (`utils/quotes/status.ts:50`).
- **P2**: Decline has no reason presets (`DeclineEnquiry.tsx:21`).
- States: loading and error are handled (`:29-35`). No pull-to-refresh.

---

## 11. Followers: `app/artist/followers.tsx` → `src/components/feed/FollowersList.tsx`

- **P2**: Rows aren't tappable (`:34-38`), so you can't message a follower or see whether they booked. There's nothing actionable on the screen; consider "Post something new" as a CTA.
- **P2**: `keyExtractor` uses the index (`:31`), which is unstable across pages. Use the follower id.
- **P2**: No pull-to-refresh and no footer spinner.

---

## 12. Notifications: `app/artist/notifications.tsx` → `src/components/notifications/NotificationInbox.tsx`

- **P1**: Rows have no per-type icon or colour (`NotificationRow.tsx:21`; only an unread dot) and no Today/Earlier grouping. A new booking request should stand out from "someone followed you".
- **P1**: No inline actions. A request notification should allow Accept or View directly, as UCP does.
- **P2**: "Mark all read" has no pending or error state (`NotificationInbox.tsx:36`), and `markRead` errors are dropped.
- **P2**: Notifications without a `link` do nothing on tap, with no affordance difference (`:29`).
- **P2**: No link to notification settings, because none exist (X10).

---

## 13. Posts: `app/artist/posts/index.tsx` → `src/components/feed/MyPosts.tsx`, `posts/new.tsx` → `NewPostForm.tsx`

### 13.1 My posts list
- **P1: Posts can't be opened or edited.** Delete is the only action (`MyPosts.tsx:59`). A typo means delete and repost, which loses likes.
- **P2**: Analytics are limited to likes (`:55`). Views, saves and profile taps or bookings from the post are missing, which is the "is posting worth it" signal for artists.
- **P2**: `remove.isPending` disables every row's Delete (`:59`). Delete is a red text link rather than an icon or swipe action.
- **P2**: The moderation copy shows "Hidden by our team" for both `hidden` and `removed` (`:56`; type `types/feed/feed.ts:29`). There's no reason and no appeal path.
- **P2**: The `+ New post` glyph (`:39`). No pull-to-refresh. Rows without a thumbnail lose alignment (`:52`).

### 13.2 New post
- **P2**: Cancel doesn't confirm when there's a draft (`NewPostForm.tsx:120`). The Post button sits in the header while the reason it's disabled appears at the bottom of a long form (`:193`). `+ Photos` / `+ Cover photo` glyphs (`:152`). Only approved services can be linked (`posts/new.tsx:9`), but the form doesn't say why a pending service is missing.

---

## 14. Public profile: `app/artist/public-profile.tsx`

- **P1**: No Share (X/IG/WhatsApp link, QR) and no "Edit this section" shortcuts from the preview.
- **P2**: `artistId={data?.id ?? ''}` (`:7`) renders with an empty id if the profile is ever missing. The layout guards it, but it's fragile.

---

## 15. Help & support: `app/artist/support/index.tsx` → `HelpSupport.tsx`, `support/[id].tsx` → `SupportThread.tsx`

### 15.1 Report a problem
- **P1: Only the 3 most recent bookings can be reported** (`app/artist/support/index.tsx:8,16-19`), and only from the first page of upcoming and past. A dispute about last month's no-show can't be tied to its booking. Add "Pick another booking…" or start the flow from booking detail (§2.3).
- **P2**: The booking chips appear late with no loading state, because the two queries aren't surfaced (`:14-15`). An error drops them silently.
- **P2**: Free-text `TextInput` with hardcoded styles (`ReportProblemForm.tsx:61-70`) instead of the shared field.

### 15.2 Tickets list
- **P2**: Only the first page is rendered. `TicketList` maps `items` with no "load more" (`HelpSupport.tsx:25,48`).
- **P2**: The "We usually reply within 2 hours" SLA is hardcoded in two places (`HelpSupport.tsx:15`, `SupportThread.tsx:58`).
- **P2**: Section-label styles are inline (`HelpSupport.tsx:26`, `fontSize: 11`) and should use the `eyebrow` variant, as services.tsx does.

### 15.3 Thread
- **P2**: The booking line prints `artist_name` (`SupportThread.tsx:46`), so on the artist side it shows the artist's own name. It should show the customer.
- **P2**: Uses a `ScrollView` with no scroll-to-latest on open or after send. Attachments aren't supported.

---

## 16. My services: `app/artist/services.tsx`

### 16.1 Adding
- **P0/P1: Approved artists can't add a catalog service.** The backend has `POST /artists/me/services` ("Add a service from the catalog", `backend/app/artist/router.py:73`), but the mobile API layer only exposes custom-service add (`src/api/artist-services/artist-services.ts:6-18`). The only button is "Add a custom service" (`services.tsx:71`), which goes to admin review. To add a standard catalog item, the artist has to use "Edit profile", which hides them from clients.
- **P2**: The add button replaces the loading and error slot, so its position shifts (`:60-72`).

### 16.2 Service rows
- **P1: Catalog services can't be removed or paused.** Delete appears only for custom ones (`:140-150`), although the backend has `DELETE /artists/me/services/{id}` (`router.py:95`). There's also no "Pause / hide temporarily" toggle (seasonal services, out of stock). Both are standard in UCP and SM.
- **P1: Catalog services can't edit add-ons, photo or description.** `ServicePriceSheet` edits only price and minutes (`ServicePriceSheet.tsx:52-59`).
- **P1: No earnings preview on price edits** ("Customer pays ₹2,500 · You keep ₹2,125"). Commission is invisible while setting prices.
- **P1: Editing a live custom service sends it back to review.** The sheet says so (`CustomServiceSheet.tsx:100`) but doesn't say whether it stays bookable at the old details meanwhile. The "Send for review" button gives no warning for a simple price change.
- **P2**: Rows don't show photo, add-ons or description (`:133-139`). There's no reorder or "most booked" signal.
- **P2**: `deleting={deleteService.isPending}` is shared, so every row's "Yes, delete" spins together (`:83`). The delete error renders at the top of the page, far from the row (`:73`).
- **P2**: Price is rounded with `Math.round(paise/100)`, which drops paise (`CustomServiceSheet.tsx:48`, `ServicePriceSheet.tsx:28`). `CustomServiceSheet` validates imperatively (`:65-76`) rather than with RHF + zod like the price sheet.
- **P2**: Duration is free-text minutes (`CustomServiceSheet.tsx:125`), whereas Quote uses a stepper. Hardcoded `height: 34`, `fontSize: 13/15` (`services.tsx:135,170-172`).

---

## 17. My shop: `app/artist/shop/index.tsx` → `src/components/shop/MyShop.tsx`

### 17.1 Summary tiles
- **P1: Summary errors are silent.** `useShopSummary().data` shows `'…'` forever on error (`:30,44,48`). There's no retry.
- **P2**: Tiles aren't tappable (for example to open a sales breakdown). Hardcoded `fontSize: 24` and `flex: 1.4` (`:42-48`).

### 17.2 "To pack" banner
- **P1: The banner switches to Orders but doesn't filter.** It tells you "3 to pack" (`:52-57`), then shows *all* orders (`useShopOrders('all')`, `:32`). There's no status filter on the Orders tab at all.

### 17.3 Products list
- **P0/P1: No pagination.** Products and orders are infinite queries, but neither `FlatList` has `onEndReached` (`:70-96`). Only the first page is ever reachable.
- **P2**: `update.isPending` disables *every* product's switch while one toggles (`:87`).
- **P2**: Rows without a photo lose alignment (`:76`). A low stock count is colour-only (`:80`, a11y). There's no delete or archive for a product.
- **P2**: The header area (two tiles, two buttons, banner and segmented control) is fixed above the list and takes about 45% of a small screen. Put it in `ListHeaderComponent` so it scrolls away.
- **P2**: No pull-to-refresh.

### 17.4 Orders list (`ShopOrderCard.tsx`)
- **P1: No order detail screen and no timeline.** `Order.timeline` exists (`types/shop/shop.ts:50`) but isn't shown. The phone number is plain text, not tap-to-call or WhatsApp (`:35`).
- **P1: Cancel always sends `reason: null`** (`:52`), so the customer never learns why.
- **P2**: Mark paid, Mark shipped and Mark delivered have no confirmation or undo (`:37-44`). Tracking is a free-text field with no courier picker or tracking link.

## 18. New and edit product: `ProductForm.tsx`, `EditProductForm.tsx`

- **P1: Edit can't change photos, category or payment methods** (`EditProductForm.tsx:20`, "set at listing time"). A wrong category means deleting and relisting, and there's no delete either.
- **P1: Photo tiles are removed on a single tap, with no confirmation and no visible "x"** (`ProductForm.tsx:104`). It's easy to lose photos by accident. There's no reorder or cover selection.
- **P2**: Cancel doesn't confirm with unsaved input (`ProductForm.tsx:93`, `EditProductForm.tsx:76`). The disabled "Publish" in the header doesn't explain itself (the reason is at the bottom, `:137`).
- **P2**: Categories are hardcoded in the component (`ProductForm.tsx:21-26`). Stock defaults to the magic value `'10'` (`:39`). Forms use `useState` plus `firstIssue` rather than RHF + zod.
- **P2**: If upload fails midway, retrying re-uploads every photo (`:66-69`).

## 19. Payment & delivery: `app/artist/shop/settings.tsx` → `ShopSettingsForm.tsx`

- **P1: "Pay before shipping" has no payment details.** It's enabled with nowhere to enter a UPI ID or QR (`:50-58`), so how does the customer pay? It's either a dead feature or done through chat out of band.
- **P2**: No shop-profile fields (return policy, dispatch time, pickup option). There's no success toast; it just goes back (`:77`).
- **P2**: The `rupees()` helper treats `0` as `''` (`:16`), so a saved ₹0 delivery fee shows as empty with a placeholder of "0". That's ambiguous.

---

## 20. Working hours: `app/artist/working-hours.tsx` → `src/components/artist-schedule/WorkingHoursForm.tsx`

### 20.1 Weekly hours
- **P1: One block per day, with whole-hour steps only** (`:86-101`). There's no split shift or break (for example 10–1 and 4–9), no 30-minute granularity, and no "Copy to all weekdays". Setting seven days means up to 14 steppers with up to 24 taps each.
- **P1: No booking rules.** Buffer or travel time between bookings, minimum notice (for example "no same-day"), how far ahead clients can book, and max bookings per day are all missing. These are core in UCP and AH.
- **P2**: No unsaved-changes guard on back. The "Saved" label stays until the next edit (`:119`). Validation is mixed: radius uses zod, while hours are clamped by the steppers.

### 20.2 Travel radius
- **P2**: Free-text km with `placeholder="15"` (`:111`). A slider or map preview of the radius would make it clearer. The helper caption uses `marginTop: -8` (`:117`).

### 20.3 Days off
- **P1: No way to add a day off here.** You can only remove chips. The copy points you to the Calendar (`:140`). There's no date range or vacation mode (see §3.1).
- **P2**: Every chip is disabled while one removal is in flight (`:130`).

---

## 21. Location: `app/artist/location.tsx` → `LocationForm.tsx`

- Mostly solid: loading and error handling for areas (`LocationForm.tsx:130-136`), and pincode validation.
- **P2**: No unsaved-changes guard. The save error is generic text at the bottom (`:151`).

---

## 22. Reviews: `app/artist/reviews.tsx`

- **P1: No "Needs reply" filter, rating filter or sort.** Replying to new reviews quickly is the key reputation action. AH highlights "respond to reviews".
- **P2**: The summary header is hidden until loaded (`:47`). No pull-to-refresh.
- **P2**: Reply and Report pills are hardcoded at `height: 34`, `fontSize: 13` (`:127-129`), duplicating the services `RowAction` (X7).
- **P2**: Report is only offered on published reviews (`:110`). That's fine, but once reported there's no status ("Under moderator review") beyond echoing the reason (`:112-114`).
- States are handled (`:53-58`). Footer spinner present.

---

## 23. Tab layout: `app/artist/(tabs)/_layout.tsx`

- **P1: No badges on the tabs.** Bookings shows no pending-request count and Messages no unread count (`:29-35`). This is the main "act fast" signal in UCP, AH and SM.
- **P2**: `fontSize: 10.5` is hardcoded (`:25`).

---

## Priority shortlist

1. **P0/P1**: FlashList recycling leaks `RequestCard` decline state across customers (`RequestCard.tsx:33`).
2. **P0/P1**: My shop products and orders never paginate (`MyShop.tsx:70-96`).
3. **P0/P1**: Approved artists can't add or remove catalog services, even though the backend endpoints exist (`services.tsx:71`; `api/artist-services/artist-services.ts`).
4. **P1**: New requests aren't pushed into lists in real time, and there are no tab badges (`use-push.ts:44`; `(tabs)/_layout.tsx`).
5. **P1**: Expired requests are still actionable. There's no conflict warning, duration or add-ons on the request card.
6. **P1**: Money clarity: the artist sees only "You earn". There's no "collect from customer" figure, no commission explanation, no pending earnings and no drill-down.
7. **P1**: Availability: days off are invisible on the calendar, there's no range or partial blocking, hours are one hourly block per day, and there are no buffer, notice or limit rules.
8. **P1**: Dead ends: the chat booking tag isn't tappable, enquiry detail has no Message button, there's no cancel or "report" from booking detail, and support is limited to 3 bookings. Cold-start deep links may have no back target.
9. **P1**: Me menu: no grouping, no completeness meter, no share-profile, no notifications/settings entry, and "Edit profile" silently takes the artist offline.
10. **P2**: Widespread hardcoded sizes and glyph icons, and subcomponents living in route files.
