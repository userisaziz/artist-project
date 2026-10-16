# Increment 5: Customer discovery and booking requests

Date: 2026-10-17 · Status: draft, written from the Atelier prototype; product-owner review pending

## Goal

The first end-to-end slice of the marketplace. A customer finds an approved artist, picks one of the artist's services and a free slot, and sends a booking request with a (mocked) 30% deposit. The artist accepts or declines within 3 hours, then marks the booking completed. The admin watches every booking and can cancel one.

It touches every surface:
- **Backend:** public artist directory, availability, bookings.
- **Customer app:** Home, Explore, Artist storefront, Date & time, Review & pay, Booking requested, My bookings, Profile.
- **Artist app:** the approved artist's tab bar with Home, Bookings (Requests / Upcoming / Past), Calendar, Me.
- **Admin:** Overview and Bookings.

## Decisions (taken from the prototype; ⚑ = product-owner confirmation wanted)

| Decision | Choice |
|---|---|
| Booking lifecycle | `requested` → `confirmed` → `completed`. Requests can also become `declined`, `expired` (no answer in time) or `cancelled`. |
| Acceptance window | 3 hours from the request (the prototype's admin SLA). The customer copy says "usually confirms within 3 hours", not the prototype's "10 minutes". |
| Pricing ⚑ | `subtotal` = the service price. `platform_fee` = ₹99, **waived when the subtotal is ₹25,000 or more**. `total` = subtotal + fee. **No GST line** (the prototype has none). |
| Deposit | 30% of `total`, rounded to the nearest rupee. The balance is paid to the artist after the service, outside the app. |
| Commission | 10% of `subtotal`. The artist sees "You earn" = subtotal − commission. |
| Payment ⚑ | **Mocked.** The deposit is recorded as paid when the request is created (`payment_provider = 'mock'`). A real gateway (e.g. Razorpay) is a later increment and needs product-owner keys. |
| Free cancellation | The customer can cancel a `requested` or `confirmed` booking before it starts. Cancelling at least 72h before the start sets `refund_due = true`; later sets `false`. No money moves (payment is mocked). |
| Slots | Hourly start times 09:00–17:00 **IST (Asia/Kolkata)**, the same for every artist. A slot is free when `[start, start + duration)` overlaps no `requested`/`confirmed` booking of that artist, and the start is at least 2 hours from now. Bookable up to 60 days ahead. |
| Address | One free-text address line plus an optional note per booking. No maps, distance or saved addresses. |
| Settings | Fee, waiver threshold, deposit %, commission %, window hours, cancel hours and slot hours live in `app/core/config.py`. The money values are copied onto each booking, so changing them only affects new bookings (the prototype's "Changes to fees apply to new bookings only"). |
| Customer tabs | Home, Explore, Bookings, Profile. Feed and Shop come in later increments. |
| Artist tabs | Home, Bookings, Calendar, Me. Messages comes with chat. |

## Out of scope

- Real payments, refunds and payouts. Chat. Reviews and ratings: the storefront shows no rating until the reviews increment. Disputes. Notifications and push.
- Add-ons, per-person pricing, guest counts, booking for "Someone else".
- Location and distance, maps, favourites, Feed, Shop, posts.
- Artist working hours, blocked dates, rescheduling.
- The approved artist's "My services" screen (catalog Part 2). The Me tab doesn't link to it yet.

## 1. Backend

### 1.1 Data (Alembic migration #8)

- New enum `booking_status`: `requested`, `confirmed`, `declined`, `expired`, `cancelled`, `completed`.
- **`bookings`** (UUID primary key, `TimestampMixin`):
  - **Parties:**
    - `code` varchar(12), unique. A human ID like `BK-7F3K2Q`, random, with no ambiguous characters.
    - `customer_id` references `users.id`, indexed. `artist_id` references `artist_profiles.id`, indexed.
    - `service_id` references `artist_services.id`, nullable, `ON DELETE SET NULL`.
  - **Service snapshot:** `service_name` varchar(120) and `duration_minutes`. These are copied in so the booking survives later edits to the service.
  - **Schedule:** `start_at` and `end_at` (timestamptz). Index on (`artist_id`, `start_at`).
  - **Place and status:**
    - `address` varchar(300) and `note` varchar(500), nullable.
    - `status booking_status` (default `requested`), indexed.
  - **Money, integer paise:** `subtotal_paise`, `platform_fee_paise`, `total_paise`, `deposit_paise`, `commission_paise`. A check requires each to be ≥ 0.
  - **Payment:** `deposit_paid_at` (timestamptz, nullable) and `payment_provider` varchar(20).
  - **Lifecycle:**
    - `expires_at`, `responded_at`, `cancelled_at`, `completed_at`. All are timestamptz; all except `expires_at` are nullable.
    - `cancelled_by` varchar(10): `customer`, `artist` or `admin`.
    - `decline_reason` varchar(500), `cancel_reason` varchar(500), `refund_due` boolean (nullable).
- The downgrade drops the table and the enum.

### 1.2 Rules (`BookingService`, `app/services/booking_service.py`)

**Expiry** is applied lazily, with no background job. Before bookings are read or changed, one statement runs: `UPDATE … SET status='expired' WHERE status='requested' AND expires_at < now()`. It is scoped to the artist or customer being read.

**Create** (customer):
- The artist must be `approved`, and the service must be the artist's own and `approved`.
- `start_at` must be one of the slots in §1.3 and still free. Otherwise `conflict`: "That time was just taken. Pick another slot."
- The artist profile row is locked (`SELECT … FOR UPDATE`) during the overlap check, so two concurrent requests can't both take a slot.
- A customer can't book their own artist profile (`validation`).

**Transitions.** Anything not listed below is a `conflict`: "This booking is already <status>".

| Who | From | To | Notes |
|---|---|---|---|
| artist | requested | confirmed | |
| artist | requested | declined | optional reason |
| artist | confirmed | completed | only after `start_at` |
| customer | requested, confirmed | cancelled | only before `start_at` |
| admin | requested, confirmed | cancelled | at any time; a reason is required |

**Refunds.** `refund_due` is set on cancel:
- When the customer cancels at least 72h before `start_at`, it is `true`.
- When the admin cancels, it is always `true`.
- When the booking is declined or expired, `refund_due` is set to `true` as well.

### 1.3 Public directory (no auth)

| Method | Path | Notes |
|---|---|---|
| GET | `/artists?city=&category_id=&q=&limit=&cursor=` | Approved artists only. `category_id` is a top-level category. `q` matches `business_name` or an approved service name, case-insensitively. Ordered by `reviewed_at` desc then `id`, cursor-paginated. |
| GET | `/artists/{id}` | 404 unless approved. |
| GET | `/artists/{id}/availability?date=YYYY-MM-DD&service_id=` | IST date. Returns `{date, slots: [{start_at, available}]}`. A date in the past or more than 60 days ahead is `validation`. |

- **List item** (`ArtistCard`):
  - `id, business_name, city`
  - `photo_url` (card size) and `cover_url` (first portfolio photo, card size)
  - `categories [{id,name}]`
  - `from_price_paise`: the cheapest approved service.
- **Detail** (`ArtistPublic`): the card fields, plus:
  - `bio`
  - `photos [{id, url, thumb_url}]`
  - `services`: approved only, each `{id, name, description, price_paise, duration_minutes, category {id,name}|null, subcategory {id,name}|null}`
  - `member_since`: `reviewed_at`
  - `completed_bookings`
- Never exposed: KYC, the owner's phone, the rejection reason, pending or rejected services.

### 1.4 Customer bookings (`require_role(customer)`)

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/bookings` | `{artist_id, service_id, start_at, address, note?}` | Returns `BookingOut` with status `requested` and the deposit paid (mock). |
| GET | `/bookings?scope=upcoming\|past&limit=&cursor=` | | Only the caller's own bookings. |
| GET | `/bookings/{id}` | | Someone else's booking returns 404. |
| POST | `/bookings/{id}/cancel` | `{reason?}` | |

Scopes:
- **upcoming:** `requested` or `confirmed` bookings whose `end_at` is still in the future. Ordered by `start_at` ascending.
- **past:** all the rest. Ordered by `start_at` descending.

**`BookingOut`** fields:
- **Identity and schedule:** `id, code, status, start_at, end_at, address, note, service_name, duration_minutes`.
- **Parties:** `artist {id, business_name, photo_url, city}` and `customer {id, first_name, last_name}`.
- **Money:** `subtotal_paise, platform_fee_paise, total_paise, deposit_paise, balance_paise, commission_paise, artist_earning_paise`.
- **Lifecycle:** `deposit_paid_at, expires_at, decline_reason, cancel_reason, cancelled_by, refund_due, created_at`.

### 1.5 Artist bookings (`current_artist`; the profile must be approved, otherwise `conflict`)

| Method | Path | Notes |
|---|---|---|
| GET | `/artists/me/bookings?scope=requests\|upcoming\|past&from=&to=&limit=&cursor=` | The scope filters status (details below). `from`/`to` are IST dates that filter on `start_at`; the calendar uses them. |
| POST | `/artists/me/bookings/{id}/accept` | |
| POST | `/artists/me/bookings/{id}/decline` | `{reason?}` |
| POST | `/artists/me/bookings/{id}/complete` | |
| GET | `/artists/me/dashboard` | `{requests, upcoming, completed_this_month, earnings_this_month_paise, today: [BookingOut]}`. Earnings sum `artist_earning` over bookings completed in the current IST month. |

Scopes:
- **requests:** `requested`, ordered by `expires_at`.
- **upcoming:** `confirmed`.
- **past:** everything else.
- With no `scope`, all statuses are returned. The calendar uses this.

### 1.6 Admin (`current_admin`)

| Method | Path | Notes |
|---|---|---|
| GET | `/admin/bookings?status=&q=&limit=&cursor=` | `q` matches the code, the customer's phone or the artist's business name. Ordered by `created_at` desc. `AdminBookingOut` = `BookingOut` plus `customer.phone`. |
| GET | `/admin/bookings/{id}` | |
| POST | `/admin/bookings/{id}/cancel` | `{reason}` is required, with the same rules as `RejectIn`. |
| GET | `/admin/overview` | Returns the fields below. |

The `/admin/overview` response:
- `gross_paise_30d`: the `total_paise` of bookings created in the last 30 days that weren't declined or expired.
- `bookings_30d`, `awaiting_artist`, `completed_30d`, `cancelled_30d`.
- `pending_artists` and `pending_custom_services`.
- `bookings_by_week`: 12 entries of `{week_start, count}`.

### 1.7 Tests (pytest, real DB)

- **Migration:**
  - Round-trip upgrade and downgrade.
  - Add `bookings` to `EXPECTED_TABLES` and to conftest `TABLES`.
- **Directory:**
  - Lists approved artists only.
  - Filters by city, category and `q`.
  - Paginates.
  - The detail hides pending services and KYC.
  - A draft artist gives 404.
- **Availability:**
  - Slots are in IST.
  - A booked or overlapping slot is unavailable.
  - A declined or expired booking frees its slot.
  - A slot less than 2h away is unavailable.
  - Out-of-range dates are rejected.
- **Create:**
  - Pricing: the fee waiver at ₹25,000 and deposit rounding.
  - A taken or overlapping slot gives `conflict`.
  - Booking another artist's service, a pending service or an unapproved artist is rejected.
  - When two requests race for the same slot, exactly one succeeds.
- **Transitions:**
  - Every allowed transition, and `conflict` for the rest.
  - Expiry after 3h, with the clock patched.
  - Completing before the start gives `conflict`.
  - The `refund_due` rules.
- **Ownership:** another customer or another artist gets 404.
- **Admin:** the list filters, cancel, and the overview numbers.

## 2. Customer app (`mobile/app/customer/`)

The customer area becomes a tab layout: `(tabs)/home`, `(tabs)/explore`, `(tabs)/bookings` and `(tabs)/profile`. The flow screens are stacked above the tabs.

- **Home:**
  - "Good morning, <first name>".
  - A 2-slide hero.
  - A search bar that opens Explore.
  - Category circles (`GET /categories`); each opens Explore with that filter.
  - A "Discover artists" carousel.
  - A "New on Atelier" list.
- **Explore:**
  - A search field, debounced 300 ms.
  - Category chips.
  - "N artists" and an infinite list of artist cards.
  - Empty state: "No artists match yet. Try another category."
- **Artist storefront `artist/[id]`:**
  - A hero with the cover photo, avatar, a "✓ Verified artist" pill, the name, and "Categories · City".
  - Stats: bookings completed and "On Atelier since".
  - "Packages": services grouped by subcategory. Each card shows the name, description, duration and price, with "Select".
  - "Work": a 2-column portfolio grid.
  - "About": the bio.
  - A sticky footer with the selected service and "Check availability".
- **Date & time `book/[artistId]`** (step 1 of 2):
  - A 14-day date strip.
  - A slot grid from `/availability`; taken slots are struck through.
  - A footer showing "Fri, 9 Oct · 11:00 AM" and the price, with Continue.
- **Review & pay `book/review`** (step 2 of 2):
  - A summary of the service, artist and time.
  - An address field (required) and a note.
  - The breakdown: service, platform fee (or "Waived"), total, "Deposit today (30%)", "Balance after the service".
  - "Free cancellation until <start − 72h>".
  - "Test mode: no real payment is taken."
  - The CTA "Pay deposit · ₹X". On a `conflict` response, it goes back to Date & time with a message and refetched slots.
- **Booking requested `book/done`:**
  - A check icon, "Booking *requested*", and "<Artist> usually confirms within 3 hours."
  - Summary rows.
  - "View booking" and "Back to home".
- **Bookings tab:**
  - An Upcoming / Past switch.
  - Each card has a status pill, the artist, the service and the time. The pills are:
    - Awaiting confirmation (amber)
    - Confirmed (green)
    - Completed, Declined, Expired, Cancelled
  - **`booking/[id]`** shows the details and the breakdown, with "Cancel booking". Before cancelling, a confirm step states whether the deposit is refunded.
- **Profile tab:**
  - Name and phone.
  - "My bookings".
  - "Switch to artist" or "Become an artist" (`PUT /users/me/role`).
  - Log out.

## 3. Artist app (approved artists, `mobile/app/artist/(tabs)/`)

The placeholder `home.tsx` becomes the tabs `home`, `bookings`, `calendar` and `me`.

- **Home:**
  - The date, and "Good morning, <name>".
  - An earnings card: "Earnings this month", the completed count and the upcoming count.
  - "New requests": the first 2, each with Accept and Decline.
  - The "Today" schedule.
- **Bookings:**
  - A Requests · n / Upcoming / Past switch.
  - **Request card:**
    - The customer's name and a countdown pill ("2h 14m left"). The pill is amber, and turns red under 30 min.
    - Service, When, Where, "You earn".
    - The customer's note.
    - Decline (with an optional reason) and Accept.
  - Upcoming cards have "Mark completed", enabled once the start time has passed.
- **Calendar:**
  - A month grid with day dots: pink for confirmed, amber for requested.
  - Tapping a day shows that day's agenda.
  - The data is `GET /artists/me/bookings?from=&to=` for the visible month.
- **Me:**
  - Avatar, business name and "✓ Verified".
  - "View public profile" opens the storefront.
  - "Switch to customer".
  - Log out.

## 4. Admin console

- **Overview** (`/overview`, the new default route):
  - A greeting.
  - KPI cards: Gross bookings (30d), Bookings (30d), Awaiting artist, Pending verification.
  - A 12-week bar chart made with plain CSS bars (no chart library).
  - The first 5 artists waiting for verification, with "Open queue".
- **Bookings** (`/bookings`), a nav item after Custom services:
  - Status chips: All, Requested, Confirmed, Completed, Cancelled, Declined, Expired.
  - Search by code, phone or artist.
  - A table with columns Booking (code · customer, created), Artist · service, When (IST), City, Amount, Status.
  - A "Load more" button for the next page.
- **`/bookings/:id`:**
  - The parties, schedule, address and note.
  - The payment breakdown: deposit paid, balance, commission, artist earning.
  - A timeline: requested → deposit paid → responded → completed/cancelled.
  - "Cancel booking", which asks for a reason (reuses `RejectReasonDialog`).

## 5. Mobile mock API (`EXPO_PUBLIC_USE_MOCKS=true`)

- **Seed:** 6 approved artists across Mehendi and Makeup, with placeholder photo URLs, services, and a few bookings.
- **Handlers:** the directory, availability, customer bookings, and artist bookings and dashboard. They follow the same rules as the backend: pricing, overlap, expiry against the mock clock (`advanceTime`), and transitions.
- **Test hook:** `mock.requestBooking(customerPhone, artistUserId, …)` creates a request, so artist tests can receive one.

## 6. Build sequence

1. Backend: migration, pricing and slot helpers, directory, availability, customer bookings, artist bookings, admin endpoints. Each step comes with tests.
2. Admin: Overview and Bookings, with tests.
3. Mobile: types, endpoints, mock seed and handlers; customer tabs and booking flow; artist tabs. Each comes with tests.
4. README: the booking lifecycle, mocked payment, and the new settings.
