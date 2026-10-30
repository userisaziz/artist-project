# Admin Broadcast Push — Design

## Problem

The admin console can only *receive* notifications (read-only inbox at `/notifications`). Push delivery is
fully live (`PUSH_PROVIDER=expo` in `render.yaml` staging and `backend/.env.dev` / `.env.prod`), but every
push is event-triggered (bookings, quotes, chat, orders, requirements). The team has no way to compose and
send an announcement: today the only manual paths are Expo's web push tool or a hand-rolled curl to the
Expo API — neither writes an inbox row (the source of record) nor records who was reached.

## Goal

An admin composes a push announcement in the admin console, targets a segment refined by filters, sees
exactly how many people it will reach, confirms, and sends. The send writes one inbox row per recipient,
queues a push per registered device, and records the broadcast in an immutable history.

## Chosen approach

**B — broadcast record + set-based send.** One `notification_broadcast` row per send stores what was sent,
to whom (segment + filter JSONB), and the resulting counts; recipients are inserted with a single set-based
`INSERT ... SELECT` mirroring `notify_admins`, and push tokens are collected with one joined query.
(Rejected: per-user `notify()` loop with no record — no history, N+1 queries, no audit of who was reached;
and a campaign system with templates/scheduling/steps — far beyond the need.)

## Data model (one migration)

New table `notification_broadcast`:

- `id` uuid pk (`gen_random_uuid()`, same as `Notification`)
- `title` String(120) — `TITLE_MAX`
- `body` String(300) — `BODY_MAX`
- `link` String(200) nullable — an app route
- `segment` String(20): `all_users` | `all_artists` | `all_customers`
- `filters` JSONB: `{city?, artist_status?, category_id?, joined_from?, joined_to?}` (`{}` = no filters)
- `recipient_count` int — people the inbox rows went to
- `push_count` int — recipients who had at least one registered device (people, not tokens)
- `created_by` uuid nullable FK `user_account.id` ondelete SET NULL (history survives admin deletion)
- TimestampMixin (`created_at`)

Immutable by design: no update or delete endpoints. The history table plus the automatic `admin.action`
audit from the `audited_admin` guard is the trail.

New Kind value `"announcement"` in `app/notification/constants.py`. Backend `NotificationOut.kind` is
already plain `str` — no schema change. Mobile `NotificationKind`
(`mobile/src/types/notifications/notifications.ts`) is a closed union → add `"announcement"` (one line;
inbox and push handling render `title/body/link` generically, no other mobile change).

## Backend (`app/notification/admin_router.py`, new)

Mounted in `app/router.py` alongside the other `*_admin` routers with a router-level `audited_admin`
dependency (admin-only + automatic audit on every non-GET).

- **`POST /admin/broadcasts/preview`** — body `{segment, filters}` → `{recipients, with_push}`. Runs the
  exact recipient query the send uses, so the count the admin sees is the count they hit.
- **`POST /admin/broadcasts`** — body `{segment, filters, title, body, link?}`:
  1. resolve recipients; **422 if empty** (the UI also disables send at 0)
  2. insert the broadcast row (segment + filters snapshot, counts filled in)
  3. one `INSERT ... SELECT` of `Notification` rows — kind `announcement`, `DISTINCT` user ids, same shape
     as `notify_admins`
  4. one joined query collecting `DISTINCT` `PushDevice` tokens for the recipient set → extend
     `PENDING_PUSH` → delivered after commit by the existing provider
  5. returns `{id, recipients, with_push}`
- **`GET /admin/broadcasts`** — keyset-paginated history, newest first (same `keyset`/`split_page` pattern
  as the inbox service).

Pydantic input: `segment: Literal["all_users","all_artists","all_customers"]`;
`filters.city: str | None`; `filters.artist_status: Literal["draft","pending","approved"] | None`;
`filters.category_id: int | None`; `filters.joined_from / joined_to: date | None`; `title/body/link`
capped at `TITLE_MAX`/`BODY_MAX`/`LINK_MAX`; `link` must match `^/(?!/)` (app-relative, mirroring the
mobile router rule) — enforced server-side, mirrored client-side.

**Recipient resolution** — one reusable query shared by preview and send:

- Base: active users (`User.is_active`) holding the segment's role grant(s) via `UserRoleGrant` —
  `all_users` = customer OR artist grant (DISTINCT), `all_artists` = artist, `all_customers` = customer.
  Same shape as `notify_admins`.
- `joined_from` / `joined_to`: inclusive range on `User.created_at` (`>= from` 00:00, `< to + 1 day`).
- `city`: `ArtistProfile.city == city`.
- `artist_status`: `ArtistProfile.status == artist_status`; **when unset defaults to `approved`** (a
  broadcast "to artists" means live artists; draft/pending are opt-in via the filter).
- `category_id`: artist has an `ArtistServiceItem` whose `category_id` is the chosen category or a
  descendant of it (service items point at subcategories, with legacy rows pointing at top-level —
  descendants-of-chosen covers both).
- Any artist-only filter (city / artist_status / category) forces the artist role-grant condition; combined
  with `all_customers` this predictably yields an empty audience (preview shows 0).

**Required fix in existing code** — `ExpoPushProvider._send` posts the whole batch in one request; Expo
caps at **100 messages per request**. Chunk the messages into groups of 100, handled sequentially (each
chunk's response yields its own unregistered-token cleanup). Existing single-event sends are unaffected —
they are far under the cap.

## Admin UI (`admin/src/features/broadcasts/`, new)

Route `/broadcasts`: `PATHS` entry in `admin/src/lib/paths.ts`, Route in `app/routes.tsx`, lazy chunk in
`app/page-chunks.ts`, sidebar item in `app/layout/nav-items.ts`.

- **Composer**: segment select → contextual filter inputs (city dropdown from public `GET /cities`; artist
  status; category picker from the existing `useCategories()` admin data — two-level tree, choosing a
  parent matches all its subcategories; signup date range from/to) → title/body with live character
  counters at the caps → optional deep link validated `^/(?!/)` → **live recipient count** via debounced
  `preview` query → confirm dialog "This will reach N people, M with push" → send. Send button disabled
  while the count is 0 or the form is invalid.
- **History table**: title, segment + filter chips (rendered from the JSONB), recipients, with-push
  count, sent by, date.

Built with the existing stack: TanStack Query in `queries.ts`, types in `types.ts`, shadcn `ui/`
components, `PageHeader`/`Panel` console primitives, vitest tests following `notifications.test.tsx`
(fake-backend additions for the three endpoints).

## Mobile

One line: add `"announcement"` to `NotificationKind`. Nothing else — the inbox and push foreground
handling already render `title/body/link` generically.

## Testing

- **Backend pytest**: recipient query per segment × filter combination (incl. `all_users` DISTINCT across
  dual grants; artist-only filter constraining `all_customers` to empty; date-range bounds); preview count
  == send count; send produces one inbox row per recipient + queued tokens; broadcast row stores the
  snapshot + counts; Expo `_send` chunks >100 messages (fake transport); link pattern rejection; 403 for
  non-admins; 422 on empty audience.
- **Admin vitest**: composer validation (caps, link rule), debounced count → confirm → send flow, history
  rendering; fake-backend handlers for preview / send / history.
- **Mobile**: the type addition compiles; no behavioral change to test.

## Out of scope

Scheduled sends, message templates, SMS broadcast, per-user delivery/open tracking, 1:1 messaging, editing
or deleting sent broadcasts.

## Risks

- A large audience inserts many inbox rows in one transaction — bounded by the user base; the set-based
  insert is a single statement, and pushes leave only after commit (fire-and-forget, same as every
  existing push path).
- Expo rate limit ~600 msg/s — sequential 100-message chunks stay well below it for realistic audiences.
- A wrong-audience send cannot be undone — mitigated by the preview count, the confirm dialog quoting the
  exact audience, and the immutable audit trail.
