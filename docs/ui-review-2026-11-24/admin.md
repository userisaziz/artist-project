# Admin console — UI/UX gap review

Scope: `admin/src/app/**` and every feature in `admin/src/features/**`. Read-only review, 2026-11-24.
Paths are relative to `admin/src/`. Severity: **P0** = broken/blocking, **P1** = notable gap, **P2** = polish.

No P0 found: every page loads, guards, paginates and renders a loading/empty/error body. The gaps are about what an ops team needs day to day: recovering from errors, throughput tools for queues, investigating across entities, and an audit trail.

---

## 0. Cross-cutting (affects most pages)

| # | Sev | Gap | Evidence |
|---|---|---|---|
| X1 | P1 | **List error states have no Retry.** `GridMessage state="error"` renders text only. A failed list stays dead until reload. CLAUDE.md §8 asks for a real retry fallback. The `ErrorState` component with `onRetry` exists but list panels don't use it. | `components/console/grid-message.tsx:16-19`; used by every list page (e.g. `features/bookings/BookingsPage.tsx:68`) |
| X2 | P1 | **KPI tiles skeleton forever on error.** `KpiTile` treats `value === undefined` as loading. When the summary query fails, tiles shimmer indefinitely with no error. | `components/console/kpi-tile.tsx:30-31`; all KPI strips (Overview, Directory, Bookings, Customers, Enquiries, Feed, Shop×2, Support, Subcategories, Reports, Settings) |
| X3 | P1 | **No column sorting anywhere.** Every list has a fixed server order ("newest first"/"oldest first"). You can't sort by amount, rating, waiting time, stock, etc. | `components/console/grid-header.tsx:4-13` (static labels) |
| X4 | P1 | **No bulk actions on any moderation queue.** No row selection or select-all on Enquiries, Reviews, Custom services, Feed, Subcategory requests or Verification. High-volume queues are handled one row at a time. | e.g. `features/enquiries/EnquiryRow.tsx:36-45` |
| X5 | P1 | **No undo on any decision.** Every approve/allow/publish/hide/feature fires immediately with a success toast. There is no undo action and no grace window. | e.g. `features/custom-services/CustomServicesPage.tsx:82`, `features/enquiries/EnquiriesPage.tsx:92` |
| X6 | P1 | **No audit trail in the UI.** The backend only writes log lines (`backend/app/core/audit.py:15`). No page shows "who did what, when". Detail views show at most a timestamp (`reviewed_at`, `moderated_at`) with no actor, even where the backend stores `reviewed_by_id` / `moderated_by_id` (`backend/app/subcategory_request/models.py:47`, `backend/app/chat/models.py:76`). | `features/artists/ArtistReviewPage.tsx:186`, `features/reviews/ReviewDetailPanel.tsx:96`, `features/enquiries/EnquiryRow.tsx:43` |
| X7 | P1 | **Entities are not cross-linked.** Customer names in bookings, tickets, orders, enquiries and reviews are never links, even though `customerPath()` exists (`lib/paths.ts:38`). Seller names on orders and products and requester names on tickets aren't links either. Investigating one incident takes manual searching. | `features/bookings/BookingDetailPage.tsx:50`, `features/support/TicketPanel.tsx:41-42`, `features/shop/ShopOrdersPage.tsx:117-118`, `features/enquiries/EnquiryRow.tsx:32-33`, `features/reviews/ReviewDetailPanel.tsx:89-92` |
| X8 | P1 | **Grid tables have no table semantics.** `GridHeader`/`GridRow` are `div`s with CSS grid, with no `role="table/row/columnheader/cell"`. Screen readers can't navigate by column, and the header is hidden below `md`. Rows that use `to` wrap every cell in one `<Link>`, so the link's accessible name is the whole row's text. | `components/console/grid-header.tsx:6-12`, `components/console/grid-row.tsx:26-28` |
| X9 | P1 | **No date-range filtering on any list.** Bookings, Customers, Reviews, Enquiries, Orders and Tickets only filter by status chips. Only Overview and Reports have periods. | `features/bookings/BookingsPage.tsx:51-65` |
| X10 | P2 | **CSV export is missing from most lists.** Only Customers (`features/customers/CustomersPage.tsx:75`) and Reports have it. Bookings, Directory, Orders, Products and Reviews have none. | — |
| X11 | P2 | **Pagination has no totals.** "Load more" with "Showing 20+" never tells the admin the size of the result set, and you can't jump. Chip counts exist for some lists but not for filtered searches. | e.g. `features/bookings/BookingsPage.tsx:79` |
| X12 | P2 | **One mutation disables every row.** Row buttons read a single page-level `isPending`, so one in-flight decision greys out the whole queue. No row shows its own spinner. | `features/custom-services/CustomServicesPage.tsx:79-83`, `features/enquiries/EnquiriesPage.tsx:92`, `features/subcategory-requests/SubcategoryRequestsPage.tsx:105`, `features/feed/FeedModerationPage.tsx:86-92` |
| X13 | P2 | **Confirm buttons stay clickable while pending.** `AlertDialogAction` is a plain `Button` (`components/ui/alert-dialog.tsx:142`), so a double-click fires twice: Category delete `features/categories/CategoriesPage.tsx:206`, Template delete `features/categories/ServiceTemplatesPane.tsx:105`, Remove admin `features/settings/TeamPanel.tsx:60`, Hide message `features/enquiries/EnquiriesPage.tsx:115`. | — |
| X14 | P2 | **Detail-page errors are dead ends.** Artist and Booking detail errors offer only "Back to …" with no Retry. A transient 5xx looks the same as "not found" apart from the wording. | `features/artists/ArtistReviewPage.tsx:39-45`, `features/bookings/BookingDetailPage.tsx:29-35`, `features/customers/CustomerDetailPage.tsx:32` |
| X15 | P2 | **Visual consistency.** Font sizes are arbitrary pixel values (`text-[13px]`, `[11.5px]`, `[12.5px]`, `[25px]`, `[26.5px]`, `[23.4px]`) instead of a type scale. Page titles differ in size and component: Overview uses a custom h1 at 26.5px (`features/overview/OverviewPage.tsx:36`) while `PageHeader` uses 25px (`components/PageHeader.tsx:8`). Breadcrumbs differ across the three detail pages: `ArtistReviewPage.tsx:80`, `BookingDetailPage.tsx:63`, `CustomerDetailPage.tsx:25`. | — |
| X16 | P2 | **Hardcoded colours and inline styles**, against CLAUDE.md §5: `rgba(182,77,117,…)` in `components/ui/filter-select.tsx:40`, the palette shadow in `app/layout/top-bar.tsx:27`, and inline `style={{gridTemplateColumns}}` in `grid-header.tsx:9` / `grid-row.tsx:25`. | — |
| X17 | P2 | **Cross-feature imports**, against CLAUDE.md §1. These are layering issues; they don't affect the UI. Overview→artists (`features/overview/VerificationQueuePanel.tsx:6`), bookings→overview (`features/bookings/queries.ts:2`), reviews→overview (`features/reviews/queries.ts:2`), artists→categories (`features/artists/ArtistReviewPage.tsx:12`), broadcasts→categories (`features/broadcasts/BroadcastsPage.tsx:15`), custom-services→artists (`features/custom-services/queries.ts:2`). `useBookingKpis` also duplicates the overview cache key by hand (`features/bookings/queries.ts:42`). | — |
| X18 | P2 | **The broadcast composer doesn't use RHF + zod** (CLAUDE.md §7). It hand-validates with `useState`. | `features/broadcasts/BroadcastsPage.tsx:44-85` |

---

## 1. App shell (`app/`)

### 1.1 Routing — `app/routes.tsx`
- **P2** An unknown URL silently redirects to Overview (`routes.tsx:44`). A mistyped or stale link gives the admin no "page not found" message.
- **P2** Each detail page is a separate route, but there is no route-level `<title>`. Every browser tab reads the same, which hurts multi-tab ops work.

### 1.2 Sidebar — `app/layout/sidebar.tsx`, `nav-items.ts`
- **P1** 18 items in one flat list (`nav-items.ts:19-38`) with no grouping (Moderation / Marketplace / Commerce / Catalog / Platform). Notifications and Broadcasts sit above the core ops items.
- **P2** Count styling is inconsistent. Only Verification and Notifications use the action "pill". Flagged reviews, held enquiries, pending subcategories and pending custom services are also action-needed but show as grey text (`nav-items.ts:27,32-34`). Meanwhile "Bookings" shows a 30-day total (`sidebar.tsx:57`) that looks like a to-do count.
- **P2** Badge counts cap at "99+" because they fetch 100 rows to count (`features/artists/queries.ts:73-81`, `features/custom-services/queries.ts:23-31`, `features/reviews/queries.ts:37-49`). The overview payload already returns `pending_custom_services` and `flagged_reviews` (`lib/types.ts:211-212`).
- **P2** No user menu (profile, session/device info, keyboard shortcuts). Sign out is a bare icon button (`sidebar.tsx:105`).

### 1.3 Top bar — `app/layout/top-bar.tsx`
- **P1** Global search only searches bookings (`top-bar.tsx:23`). There is no omnisearch across customers by phone, artists by name or phone, tickets by code, or orders by code. The placeholder promises "artists" but sends you to the bookings list.
- **P2** The search box is local state (`top-bar.tsx:17`). It doesn't reflect `?q=` when you land on /bookings, so the term disappears from the bar.
- **P2** No command palette and no quick keys (`/` to focus search, `j/k` through queues).

### 1.4 Shell — `app/layout/AppShell.tsx`
- **P2** No "last updated" or live indicator even though several queries poll every 30–60 s. No offline banner.

---

## 2. Sign in — `features/auth/LoginPage.tsx`
- **P2** Country code is hardcoded to `+91` (`LoginPage.tsx:18,95`). Staff with non-Indian numbers can't sign in.
- **P2** "Resend code" has no cooldown timer (`LoginPage.tsx:158`). Admins can trigger SMS rate limits and only find out from the error.
- **P2** The left panel is hidden below `lg` (`LoginPage.tsx:68`). That's fine, but the form has no brand mark at small widths.

---

## 3. Overview — `features/overview/`

### 3.1 Header / filters
- **P1** Several KPIs ignore the City and Period filters. `awaiting_artist` and `pending_artists` are unfiltered counts on the backend (`backend/app/booking/admin_service.py:77-78`), but they sit beside filtered tiles with no "all cities, live" note. Picking "Mumbai · Today" gives mixed-scope numbers (`OverviewPage.tsx:63-64`).
- **P1** On error the page shows a one-line alert (`OverviewPage.tsx:44`) with no Retry, and all four KPIs skeleton forever (X2).
- **P2** City and period are in the URL (good, `use-overview-filters.ts:19`). But they're only visible in the top bar at `md+`, and there's no "reset filters" control.

### 3.2 KPI tiles — `OverviewPage.tsx:56-66`
- **P1** Tiles are not clickable. "Awaiting artist" should open `/bookings?status=requested`, and "New artists → pending" should open Verification. Nothing on the page drills down.
- **P1** The tiles cover too little for an ops landing page. Missing: completion and cancellation rate, artist acceptance rate and response SLA, flagged reviews, held enquiries, open/urgent tickets, orders to pack, custom services pending. Some of these are already in the payload (`lib/types.ts:207,211-212`) but unused.
- **P2** "Gross bookings" has no definition tooltip. The backend comment says it excludes declined and expired (`lib/types.ts:202`).

### 3.3 Bookings by week — `WeeklyBookingsChart.tsx`
- **P1** The chart is always the last 12 weeks (`backend/app/booking/admin_service.py:89-96`) whatever the Period filter says, and the panel doesn't say so (`WeeklyBookingsChart.tsx:28`). The period chip reads "Today" while the chart shows 12 weeks.
- **P2** No y-axis or values. Bar values are only in `title` tooltips (`:39`), which don't appear on touch. There's no comparison series (previous period or GMV), the bars aren't clickable, and an all-zero chart gets no empty message.

### 3.4 Verification queue panel — `VerificationQueuePanel.tsx`
- **P2** Shows the first 3 items with no total ("3 of 27"). Other queues (reviews, enquiries, tickets, custom services) get no equivalent panel, so Overview isn't a single "what needs me" view.

---

## 4. Verification queue — `features/artists/ArtistQueuePage.tsx`
- **P1** No search (name or phone) and no city or category filter. The queue is only filterable by status (`ArtistQueuePage.tsx:43-45`).
- **P1** No SLA or age signal. "Submitted" is a timestamp, with no "waiting 3 d" and no colour for overdue (`:89`).
- **P2** "Re-review" is shown (`:78`), but there's no indication of what changed since the last rejection.
- **P2** Chip changes call `setParams({ status })` (`:44`), which pushes a history entry per click. That's acceptable, but other pages replace instead, so behaviour is inconsistent.

## 5. Artist review / detail — `features/artists/ArtistReviewPage.tsx`

### 5.1 Header & banners
- **P1** This one page serves both the KYC review and the general artist detail. Directory rows link here (`ArtistDirectoryPage.tsx:121`) but the breadcrumb always says "Verification" (`ArtistReviewPage.tsx:81`). For approved artists there's no operational view: bookings, cancellations/declines, rating and reviews, earnings, support tickets, shop products, feed posts. The Directory's "At-risk" signal can't be investigated here.
- **P2** The header row doesn't wrap on phones. Avatar, name, meta line and badge sit in one `flex` row (`:84-93`).

### 5.2 KYC checklist — `components/kyc-checklist.tsx`
- **P1** The checklist is advisory only. "Approve & publish" is enabled even with no Aadhaar, no photos or no services (`ArtistReviewPage.tsx:207`), with no warning or confirmation.
- **P2** "Phone verified" is always ticked (`kyc-checklist.tsx:8`), which makes the list look more complete than it is.

### 5.3 Evidence tabs (Aadhaar / Portfolio / Services)
- **P2** The image viewer has no prev/next, zoom or rotate (`ArtistReviewPage.tsx:161-166`). ID cards are often photographed sideways. The image has `alt=""` with only an sr-only title.
- **P2** A revealed Aadhaar stays visible until you leave the page (`components/identity-panel.tsx:62`). There's no auto re-mask timer and no "hide" button.
- **P2** The active tab isn't in the URL (`ArtistReviewPage.tsx:111`), so you can't deep-link to Services.
- **P2** Services can't be approved or rejected here. Pending custom services show a badge (`components/services-list.tsx:30`), but you have to leave for the Custom services page to act.

### 5.4 Decision column
- **P1** "Approve & publish" is one click with no confirmation (`:207`). It publishes a profile to every customer.
- **P1** After approving or rejecting there's no "Next in queue". The reviewer stays on the decided profile and has to go back to the list each time.
- **P1** There's no decision history: previous rejections and their reasons, who reviewed, suspension history. Only `reviewed_at` is shown (`:186`), plus the latest `rejection_reason` (`:101-105`).
- **P2** Rejection reasons are free text only. There are no templates linked to checklist items (`:137-145`).
- **P2** "Reinstate" is one click with no confirmation (`:221`). Suspend has no expiry and no "notify artist" preview.
- **P2** There's no way to message or contact the artist from here (only a reminder on the Requirements card).

### 5.5 Requirements card — `components/requirements-card.tsx`
- **P2** Hidden entirely while loading (`:17`), so the layout jumps. "Remind artist" doesn't show when the last reminder was sent, so it can be spammed.

## 6. Artist directory — `features/artists/ArtistDirectoryPage.tsx`
- **P1** Search matches only the business name (`queries.ts:17`, placeholder `:75`). Owner phone, city and category can't be searched or filtered, which ops needs.
- **P1** KPI tiles (`:103-112`) don't drill down. "At-risk: 12" can't be clicked to list those artists.
- **P2** No sort (rating, 30-day value, bookings) and no CSV export.
- **P2** The "Missing …" badge concatenates every requirement into one badge (`:135`) and overflows the Status column.

---

## 7. Bookings list — `features/bookings/BookingsPage.tsx`

### 7.1 KPI strip (`:87-99`)
- **P2** Fixed at 30 days and all cities, with no link to the Overview filters. "Cancellations" has no trend or tone. "Awaiting artist" isn't clickable (it could set `status=requested`).

### 7.2 Toolbar
- **P1** No date filter (today, upcoming, this week, custom), no city or artist filter, and no "starting within N hours" view for day-of operations.
- **P2** The search placeholder "Filter rows" (`:59`) doesn't say what's searchable. The code comment says code, phone or artist. The input is a fixed `w-40`.
- **P2** Status and search are in the URL (good, `:38-44`). There's no "clear filters" control.

### 7.3 Table
- **P2** No export, no sort, and no row actions (cancel, contact). On phones the City cell has no `CellLabel` (`:114`).

## 8. Booking detail — `features/bookings/BookingDetailPage.tsx`

### 8.1 Header
- **P1** The only action is Cancel (`:79-83`). There's no reschedule, reassign artist, mark completed or no-show, open dispute, or add internal note.

### 8.2 Details tab
- **P1** The customer isn't linked to the customer page (`:50`) and the phone isn't a `tel:` link (`:51`). There are no links to the related review, support tickets or chat thread.
- **P2** `dl` is fixed at `grid-cols-3` (`:98`), which is cramped on phones.

### 8.3 Payment tab
- **P1** "Refund due: Yes" (`:159`) is a dead end. There's no refund status, no "mark refunded" action and no reference ID. The cancel toast says the deposit is "due back" (`:42`) but nothing tracks it.
- **P2** Putting payment in a tab hides key numbers. Timeline and Payment would fit side by side on desktop.

### 8.4 Timeline — `BookingTimeline.tsx`
- **P2** Derived from timestamps only (`:38-46`). There are no admin actions, no actors beyond "cancelled by …", no reminders or notifications sent, and no chat events. It isn't an audit trail.

---

## 9. Reviews — `features/reviews/ReviewsPage.tsx`, `ReviewDetailPanel.tsx`

### 9.1 Queue
- **P1** The selected review isn't in the URL (`ReviewsPage.tsx:45`). Moderators can't share or bookmark a review, and a reload loses it.
- **P1** No search and no filter by rating, artist, flag type or date. No bulk publish or hide (X4).
- **P2** Rows are `<button aria-pressed>` (`components/console/grid-row.tsx:27`), so a list row is announced as a toggle.

### 9.2 Detail panel
- **P1** After a decision the panel stays on the decided review (`ReviewsPage.tsx:82`, `onDecided={setSelected}`). There's no "next flagged review", which slows queue work.
- **P2** "Hide" and "Publish" have no confirmation and no undo, while only "Remove" is confirmed (`ReviewDetailPanel.tsx:60`). The internal note is optional even for Remove.
- **P2** "Last decision" shows a time with no moderator (`:96`). The artist's reply can't be moderated separately.
- **P2** The panel is a restyled `Dialog` (`:35`) rather than the shared `Sheet` component (`components/ui/sheet.tsx`). Two drawer patterns exist, and Support and Shop use inline side panes, which makes three.

---

## 10. Custom services — `features/custom-services/CustomServicesPage.tsx`
- **P1** Approve is one click on the row (`:82`), with no confirmation and no undo. There's also no detail view: the description is truncated (`:71`), so you approve without reading it in full.
- **P1** No context to decide with. You can't see similar catalog templates (to spot duplicates) or the price range for the subcategory, and you can't "promote to catalog template".
- **P2** No search or artist filter. Approved services can't be revoked from here. Global busy state applies (X12).

---

## 11. Catalog — `features/categories/`

### 11.1 Category list — `CategoriesPage.tsx`, `CategoryRow.tsx`, `CategoryActions.tsx`
- **P1** Status changes (Publish / Move to draft / Archive) run straight from the ⋯ menu with no confirmation and no impact preview (`CategoriesPage.tsx:88-95`, `CategoryActions.tsx:38-40`). Archiving a live category with hundreds of artists is one click.
- **P2** "Move to draft" is offered for in-use categories (`CategoryActions.tsx:38`) even though the backend refuses it (`StatusSelect.tsx:5`). The admin learns from an error toast.
- **P2** No search. Reordering is only through a numeric "Order" field in the dialog (`CategoryDialog.tsx:96`), with no drag-and-drop.
- **P2** The header says "Listings" but the phone label says "Services" (`CategoriesPage.tsx:135` vs `CategoryRow.tsx:55`). Subcategory "Artists" shows "—" (`CategoryRow.tsx:54`).
- **P2** Expanded state isn't in the URL (`CategoriesPage.tsx:45`). The delete dialog closes even when the delete fails (`:106`).
- **P2** No category image or icon management, though customers browse by category.

### 11.2 Service templates pane — `ServiceTemplatesPane.tsx`
- **P2** The Active switch saves silently, with no success toast and no optimistic state (`:37-41`). Deactivating a template used by many artists has no confirmation.
- **P2** The disabled delete button explains itself only through `title` (`:85-86`), which keyboard and touch users never see.
- **P2** Templates have no suggested price range or default duration to guide artists.

### 11.3 KPIs — `CatalogKpis.tsx`
- **P2** Computed client-side from the list. There's no health signal such as "subcategories with no services", which the row warnings already know about.

## 12. Subcategory requests — `features/subcategory-requests/`
- **P1** Approve can only create a new subcategory under the suggested parent, optionally renamed (`ApproveRequestDialog.tsx:47-53`). You can't **merge into an existing subcategory** or change the parent. Merging is the most common outcome for duplicate suggestions.
- **P1** No similar-name hint. Duplicates are only caught by a 409 after submit (`SubcategoryRequestsPage.tsx:65`).
- **P2** The artist isn't linked, and the "Services waiting" count doesn't drill down (`RequestRow.tsx:32-36`). Rejected reasons are truncated (`:45`).
- **P2** The footer replaces the row count with a static sentence (`SubcategoryRequestsPage.tsx:118`).

## 13. Enquiries monitor — `features/enquiries/`
- **P1** The message is truncated to one line (`EnquiryRow.tsx:29`) and can't be expanded. There's no conversation context and the matched phrase isn't highlighted. Moderators decide without seeing the full text.
- **P1** "Allow" is one click and final (`queries.ts:33`). There's no confirmation and no undo, and it delivers contact details.
- **P1** No repeat-offender signal (flag count per customer or artist) and no escalation path (block customer, suspend artist) from the row.
- **P2** Customer and artist aren't links. Moderated rows show a time but no moderator (`EnquiryRow.tsx:43`). No search or bulk actions.

## 14. Feed moderation — `features/feed/FeedModerationPage.tsx`
- **P1** No post preview. Only a 40px thumbnail and a one-line title (`:74-77`). You can't see full photos or article text before Hide or Remove.
- **P1** Report reasons and reporters aren't shown, only `report_count` (`:82`).
- **P1** Hide and Remove send no reason to the artist. `moderation_note` exists in the type (`types.ts:20`) but is neither captured nor displayed.
- **P2** "Feature" stays enabled when featured slots are full (`:86`, the summary knows `featured_slots`). No search or artist filter. Four ghost buttons per row are crowded on narrow widths.

---

## 15. Notifications — `features/notifications/NotificationsPage.tsx`
- **P2** No Unread or Kind filter and no date grouping. The body is truncated (`:71`).
- **P2** Rows are `<button>` plus `navigate()` (`:56-59`), so Cmd/middle-click can't open a new tab.
- **P2** A read item can't be marked unread. Mark-all-read gives no feedback toast.

## 16. Broadcasts — `features/broadcasts/BroadcastsPage.tsx`

### 16.1 Composer
- **P1** **Layout bug:** the composer `Panel` has no padding (`:116`, `className="flex flex-col gap-4"`). Selects and inputs sit flush against the rounded border. Every other panel uses `p-4`.
- **P1** A preview failure is invisible. `reachLine` ignores `preview.isError` and shows "Pick an audience to see its size." (`:101-108`), and Send stays disabled with no explanation.
- **P1** No date-range validation. "Signed up from" can be after "until" (`:137-143`).
- **P1** Ambiguous targeting. With "Everyone", the artist-only Status / City / Category filters are still shown and sent (`:61,131-133`), and it's unclear whether customers are then excluded. Customers can't be targeted by city at all.
- **P2** The confirmation dialog closes as soon as Send is clicked (`:234`), before the request finishes. Pending and failure are only reported through toasts.
- **P2** No test-send to self, no push preview, no scheduling, no draft or templates, and no link picker for in-app paths. Large audiences get no stronger confirmation.

### 16.2 History table
- **P2** The audience summary drops numeric filters such as `category_id` (`:247`, strings only). The link isn't shown. There's no delivery or open data and no detail view.

## 17. Customers — `features/customers/`

### 17.1 List — `CustomersPage.tsx`
- **P2** No sort or city filter. Full phone numbers are shown in the list (`:130`), which is a PII exposure risk for screen-shares.
- Good: search and segment are in the URL, there's a CSV export, and the error is guarded by `!list.data`.

### 17.2 Detail — `CustomerDetailPage.tsx`
- **P1** Only "Recent bookings" are shown (`:97-112`), with no full history or link to `/bookings?q=<phone>`. There are no reviews written, support tickets, enquiries or flags, no internal notes, and no account actions beyond block (for example reset sessions or change number).
- **P2** The "Block" button isn't disabled while pending (`:75`). "Unblock" is one click with no confirmation (`:74`).
- **P2** Booking status is shown as raw `capitalize` text (`:108`) rather than the status pill used elsewhere. (Promote `BookingStatusPill` to shared.)
- **P2** Block history (earlier blocks or unblocks, and who did them) isn't shown. Only the current reason is (`:78-82`).

## 18. Shop — `features/shop/`

### 18.1 Products — `ShopProductsPage.tsx`
- **P2** The search term is local state, not in the URL (`:37`). This is inconsistent with every other list and is lost on reload.
- **P2** No product detail (description, all photos, MRP vs price, payment methods). The removed reason isn't shown in the row. The seller isn't linked. No category filter and no export.

### 18.2 Orders — `ShopOrdersPage.tsx`
- **P1** No search by order code, customer phone or seller (`:58-60`).
- **P1** "Mark shipped" doesn't ask for a tracking number or carrier (`:28,129`), although the detail shows `tracking` (`:122`).
- **P1** No ageing or SLA signal (for example "placed 4 days ago, not packed").
- **P2** The selected order isn't in the URL (`:41`, while Support uses `?ticket=`). The panel vanishes when the order leaves the current view after a status change (`:43`).
- **P2** Timeline statuses show as raw enum values ("placed") (`:126`) while the pill says "To pack". Status advances have no confirmation. "Cancel order" isn't disabled while pending (`:130`). Customer and seller aren't linked. No export.

## 19. Support — `features/support/`

### 19.1 Queue — `SupportPage.tsx`
- **P1** No search (ticket code or requester phone) and no SLA breach highlight. "Waiting" is plain text (`:106`) with no colour past target.
- **P2** "Mine" and "Assigned to me" exist, but there's no assignee column or filter by agent.

### 19.2 Ticket panel — `TicketPanel.tsx`
- **P1** **Bug: the reply draft can leak to another ticket.** `TicketBody` holds `reply` in state and isn't keyed by ticket id (`TicketPanel.tsx:29,50`). When you switch to a ticket that's already cached, the draft typed for the previous requester stays in the box and can be sent to the wrong person.
- **P1** The requester and booking are plain text (`:41-42`), with no links to the customer, artist or booking.
- **P1** Workflow gaps. There are no internal (private) notes. You can't reassign to another agent or unassign, set "waiting on user", reopen a resolved ticket, or lower priority after "Mark urgent" (`:73-78`). Close is one click with no resolution reason.
- **P2** No canned replies. The conversation doesn't auto-scroll to the latest message (`:61`). The error state has no Retry.

### 19.3 New ticket dialog — `NewTicketDialog.tsx`
- **P2** `topic` is in the schema but has no control (`:20,32,55-60`). Only "account" issues can be logged, so a phone complaint about a booking can't be recorded. The requester phone isn't looked up or confirmed against an existing account before submit.

## 20. Reports — `features/reports/ReportsPage.tsx`
- **P2** `PanelToolbar` is used outside a `Panel` (`:52-54`), so its border-b and padding float on the page background.
- **P1** No custom date range: only four presets (`:21-26`). Ops and finance need month boundaries.
- **P2** No inline preview or charts. KPIs stay skeleton on error (X2), and the error is a single line (`:55`). There are no scheduled or emailed exports and no XLSX. There are no commission or revenue reports, although booking detail already shows commission (`BookingDetailPage.tsx:157-158`).

## 21. Settings — `features/settings/`

### 21.1 Tabs / KPIs — `SettingsPage.tsx`
- **P2** Two of the four KPI tiles are static text ("Direct", "Phase 2") (`:51-52`). That space is wasted.

### 21.2 Policies
- **P2** Read-only. `Policy.editable` is fetched (`types.ts:9`) but ignored (`SettingsPage.tsx:76-81`).

### 21.3 Profile requirements — `RequirementsPanel.tsx`
- **P1** Turning "Mandatory" on can hide every non-compliant approved artist once the grace period ends. Saving has no impact preview ("this will put N artists on hold on <date>") and no confirmation (`:58-62`).

### 21.4 Cities
- **P1** Read-only list (`SettingsPage.tsx:88-104`). You can't open or close a city, set a launch date, or rename one.

### 21.5 Team & roles — `TeamPanel.tsx`, `AddAdminDialog.tsx`
- **P1** There's only one admin role, so no RBAC (support-only, moderator, finance). The tab is called "Team & roles" but has no roles.
- **P1** No audit or activity log per admin (X6), and no last-sign-in or session list.
- **P2** Remove admin isn't disabled while pending (X13). Add-admin requires an E.164 number with no country helper (`AddAdminDialog.tsx:14`).

---

## Priority shortlist

1. **P1 bug:** Support reply draft can be sent to the wrong ticket (`features/support/TicketPanel.tsx:29,50`). Fix by keying `TicketBody` by `t.id`.
2. **P1 bug:** the Broadcast composer panel has no padding (`features/broadcasts/BroadcastsPage.tsx:116`). Preview errors are hidden (`:101-108`) and the date range isn't validated (`:137-143`).
3. **P1 systemic:** list and KPI error states have no Retry, and KPIs skeleton forever (`grid-message.tsx`, `kpi-tile.tsx`).
4. **P1:** one-click, final, unconfirmed approvals with no undo: Artist approve, Custom service approve, Enquiry allow, Category archive, Requirement mandatory.
5. **P1:** moderation throughput. No bulk actions, no "next item" after a decision, no full-content preview (Enquiries, Feed, Custom services), and the review selection isn't in the URL.
6. **P1:** investigation. Entities aren't cross-linked, global search covers bookings only, and approved artists have no operational detail page.
7. **P1:** no audit trail or actor shown anywhere, and no RBAC. The backend already stores `reviewed_by_id` / `moderated_by_id` for some entities.
8. **P1:** the Overview mixes filtered and unfiltered KPIs, the chart ignores the period, tiles don't drill down, and other queues aren't surfaced.
9. **P1:** ops workflows missing on Booking detail (refund tracking, reschedule/no-show), Shop orders (tracking on ship, search, ageing) and Support (notes, reassign, reopen, SLA).
10. **P1:** tables have no sorting, no date filters and no a11y table semantics. CSV export exists on only two pages.
