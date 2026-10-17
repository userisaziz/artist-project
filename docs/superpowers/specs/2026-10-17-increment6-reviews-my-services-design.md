# Increment 6: Reviews and ratings, and the approved artist's "My services"

Date: 2026-10-17 · Status: draft, written from the Atelier prototype; product-owner review pending

## Goal

Customers rate a completed booking. Ratings appear on the storefront and on artist cards. Artists read their reviews, can reply once, and can report a review. A simple auto-filter hides reviews that contain contact details or blocked words, and admins moderate them in a Reviews queue.

This increment also delivers catalog Part 2. Approved artists manage their services from the app: they see each service's status and can add, edit or delete custom services. The backend for this already exists (`/artists/me/custom-services`).

## Decisions (⚑ = product-owner confirmation wanted)

| Decision | Choice |
|---|---|
| Who can review | The customer of a `completed` booking, **once per booking**, within **30 days** of completion. Every review is therefore "verified" (the prototype's "Require completed booking" rule). |
| Content | ⚑ Rating 1–5 (required) and text up to 1000 characters (optional). Review photos come later. |
| Reviewer name | First name and last initial, e.g. "Priya S."; "Atelier customer" when the customer has no name. |
| Auto-filter | Before a review is published, its text is checked for **contact details** (phone numbers, emails, @handles, URLs) and **blocked words** (a settings list, default `scam, fraud, call me, whatsapp me`). A match makes the review `hidden` with flag `contact_info` or `blocked_word`. The customer is told it is "being checked". |
| Statuses | `published` (public), `flagged` (public, waiting for a moderator), `hidden` (not public), `removed` (not public, final). |
| Artist report | ⚑ The artist can report a review once, with a reason. A published review becomes `flagged` with flag `artist_report` and stays public until an admin decides. |
| Artist reply | One public reply per review, up to 500 characters, editable. Replies don't go through the auto-filter (artists are verified). |
| Admin decision | Publish, Hide or Remove, with an optional internal note. Remove is final. |
| Rating shown | The average of public reviews (`published` + `flagged`) to one decimal, plus their count; "New" when there are none. Computed on read, with no stored counters. |
| Editing | ⚑ Customers can't edit a review after posting it. |

## Out of scope

- Review photos, helpful votes, sorting or filtering reviews on the storefront.
- Profanity lists in Hindi or Kannada (the blocked-word list is configurable instead).
- Notifications when a review arrives.
- Editing services picked from the admin list after approval. They keep the onboarding rules.

## 1. Backend

### 1.1 Data (Alembic migration #9)

- New enum `review_status`: `published`, `flagged`, `hidden`, `removed`.
- **`reviews`** (UUID primary key, `TimestampMixin`):
  - `booking_id`: unique, references `bookings.id`.
  - `artist_id`: references `artist_profiles.id`, indexed.
  - `customer_id`: references `users.id`.
  - `rating`: smallint, checked to be 1–5.
  - `text`: varchar(1000), nullable.
  - `status`: `review_status`, indexed.
  - `flag`: varchar(20), nullable. One of `contact_info`, `blocked_word` or `artist_report`.
  - `report_reason`, `moderator_note`: varchar(500), nullable.
  - `moderated_by`: references `users.id`, nullable. `moderated_at`: nullable.
  - `reply`: varchar(500), nullable. `replied_at`: nullable.
- The downgrade drops the table and the enum.

### 1.2 Endpoints

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/bookings/{id}/review` | customer | `{rating, text?}`. The booking must be the caller's own, `completed`, and completed within 30 days. A second review gets `409`. Returns `ReviewOut`. |
| GET | `/artists/{id}/reviews?limit=&cursor=` | none | Public reviews, newest first. Returns `{items, next_cursor, summary}`, where `summary = {average, count, distribution: {5: n, …, 1: n}}`. |
| GET | `/artists/me/reviews?limit=&cursor=` | approved artist | All reviews except `removed`, each with its `status`, plus `summary`. |
| PUT | `/artists/me/reviews/{id}/reply` | approved artist | `{text}`, 1–500 characters. An empty string clears the reply. |
| POST | `/artists/me/reviews/{id}/report` | approved artist | `{reason}`. Only from `published`; anything else gets `409`. |
| GET | `/admin/reviews?status=&limit=&cursor=` | admin | Newest first. Items add `artist {id, business_name}`, `customer {id, name, phone}`, `booking {id, code, service_name}`, `flag`, `report_reason` and `moderator_note`. |
| POST | `/admin/reviews/{id}/decision` | admin | `{decision: "publish" \| "hide" \| "remove", note?}`. A `removed` review gets `409`. Publishing clears the flag. |

Response shapes:
- **`ReviewOut`** (public): `id, rating, text, reviewer_name, service_name, created_at, reply, replied_at`.
- **Artist view:** `ReviewOut` plus `status, flag, report_reason`.
- **Directory:** `ArtistCard` and `ArtistPublic` gain `rating` (number or null) and `review_count`.
- **Customer `BookingOut`:** gains `review: {id, rating, status} | null` and `can_review: bool`.
- **Admin overview:** gains `flagged_reviews`.

### 1.3 Auto-filter (`app/utils/review_filter.py`, pure)

- **`contact_info`** matches:
  - Indian mobile numbers, with or without +91 and with or without spaces or dashes.
  - Any run of 10 or more digits.
  - Emails.
  - `@handle` patterns.
  - `http` or `www` links.
- **`blocked_word`** is a case-insensitive whole-phrase match against `settings.review_blocked_words`.
- The filter returns the first flag that matches, or None.

### 1.4 Tests

- **Eligibility:** a completed booking can be reviewed. Rejected: an uncompleted booking, a second review, someone else's booking, and more than 30 days after completion (with a patched clock).
- **Filter:** unit tests for phone, email, handle, link and blocked-word matches. Clean text must pass, including prices like "₹5,500" and times like "11 AM", which must not trigger `contact_info`.
- **Visibility:** hidden and removed reviews are not public and don't count in the summary or the directory rating.
- **Artist:** reply, clearing a reply, report (only from published), and a 404 for another artist's review.
- **Admin:** the status filter, each decision, removed being final, and the overview count.

## 2. Mobile

### 2.1 Customer

- **Booking detail:** when `can_review` is true, show a "Rate your experience" card with 5 tappable stars, an optional text box, and "Post review".
  - If the review comes back `hidden`: "Thanks! Your review is being checked before it appears."
  - Once reviewed, the card shows the stars and "Thanks for your review".
- **Bookings, Past tab:** completed, reviewable bookings get a "Review" button that opens the detail.
- **Storefront:**
  - The stats card shows the rating ("★ 4.9 · 128 reviews", or "New").
  - A **Reviews** section shows the big average, a 5→1 distribution with bars, and the first 3 reviews.
  - "See all reviews" opens a paginated `artist/[id]/reviews` screen.
  - Review card: name, service · month, stars, text, and the artist's reply indented below "Response from <business>".
- **Artist cards** on Home and Explore show "★ 4.9 (128)", or "New".

### 2.2 Artist

- **Me tab:** gains "Reviews" (average · count) → `reviews`, and "My services" (count) → `services`.
- **Reviews screen:**
  - The summary at the top, then a list.
  - Status pills on non-public reviews ("Hidden: being checked", "Reported").
  - Each review has **Reply** / **Edit reply** (a sheet) and **Report** (a sheet asking for a reason).
- **My services screen:**
  - Services are grouped by "Category › Subcategory". Each row shows name, price and duration.
  - Custom services also show a status pill: Live (approved), In review (pending), or Not approved (rejected, with the reason).
  - "Add a custom service" opens a sheet: a subcategory picker from `/categories`, then name, price, duration and an optional description. It POSTs `/artists/me/custom-services`.
  - Custom rows can be edited or deleted. Any edit sends the service back to review, and the sheet says so.
  - Services picked from the admin list are read-only here.

### 2.3 Mock API

- Seed reviews for the six seeded artists, including one `hidden` and one `flagged`.
- Mirror the backend: eligibility rules, the filter (the same regexes), reply, report and the summary.
- Add `rating` and `review_count` to directory responses, and `review` and `can_review` to bookings.

## 3. Admin console

- **Reviews** (`/reviews`), a nav item after Bookings:
  - The badge counts `flagged` reviews plus `hidden` reviews no moderator has decided on yet.
  - Status chips: Flagged (the default), Hidden, Published, Removed.
  - Table columns:
    - Review: "Customer → Artist", service · month
    - Excerpt: the first 80 characters, in quotes
    - Rating: ★ n
    - Flag: a label, or "—"
    - Status: a pill
  - A row opens a detail panel with:
    - The full text and the reply.
    - The booking code, linking to `/bookings/:id`.
    - The report reason, and the flag explained, e.g. "Contains contact details".
    - An internal note box.
    - **Publish**, **Hide** and **Remove** (asks for confirmation).
- **Overview:** a 5th KPI card, "Flagged reviews", linking to `/reviews`.

## 4. Build sequence

1. Backend: migration, filter, review service and routes, directory and booking fields, overview count. Each with tests.
2. Admin: the Reviews page and the overview card, with tests.
3. Mobile: types, mock, the customer review flow, storefront reviews, and the artist Reviews and My services screens, with tests.
4. README.
