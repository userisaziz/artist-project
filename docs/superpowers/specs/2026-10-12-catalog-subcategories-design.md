# Increment 4 (Part 1): Subcategories, admin service list and custom-service approval

Date: 2026-10-12 · Status: approved in brainstorming, awaiting written-spec review

## Goal

Admins build the catalog in three levels: **Category → Subcategory → Service** (for example Makeup → Bridal → "HD Bridal Makeup"). During onboarding, artists can only add services from this admin list, and they set their own price and duration. After approval, artists can also propose **custom services**. The admin approves or rejects each one separately.

Part 1 covers the backend, the admin panel and the mobile onboarding change. The mobile screen where approved artists add custom services is **Part 2**. In Part 1, custom services are reached through the API only.

## Decisions (made with the product owner, 2026-10-12)

| Decision | Choice |
|---|---|
| Depth | Two category levels: top-level category → subcategory. Services sit under a subcategory. |
| What artists pick in onboarding | Top-level categories, unchanged. |
| Where services come from in onboarding | **Only the admin service list.** No free-text services during onboarding. |
| What the admin enters per service | Name and optional description. No suggested or min/max price. |
| What the artist enters per service | Price, duration and an optional note. |
| Custom services | Only for **approved** artists. Each one is approved or rejected separately, with a reason on rejection. |
| Renaming | An artist's listed service shows the admin's current name. Renaming a service on the list renames it for every artist. |
| Existing services | Kept valid. They become `approved` with no template, and show as "Custom". |
| Data model | `parent_id` on `categories`, plus a new `service_templates` table. A separate subcategories table or a generic tree table were rejected. |
| Category status (added 2026-10-12, during build) | Categories and subcategories get `status`: `draft`, `inactive` or `active`, replacing `is_active` (see "Category status" below). Services on the admin list keep a simple active/hidden switch. |

## Category status (added during the build)

- **`categories.status`** is a new enum `category_status` (`draft`, `inactive`, `active`) added in migration #7. It replaces `is_active`. Backfill: `true` becomes `active`, and `false` becomes `inactive`.
- **`draft`:** being set up. Admin-only, never in the public tree, and can't be picked. **New categories and subcategories start as `draft`.**
- **`inactive`:** hidden from the public tree and from new picks. Artists who already have it keep it, including when they re-save their profile.
- **`active`:** public and pickable.
- A subcategory is visible only when it and its parent are both `active`. Everywhere this spec says "active" or "hidden" for a category or subcategory, it means this status. Service templates keep `is_active`.
- A category with artists or services can't go back to `draft` (`409 conflict`).
- The admin API takes and returns `status` in place of `is_active`. The admin panel's Catalog page needs updating to match; that happens in the admin part.

## Out of scope

- Mobile "My services" screen for approved artists (Part 2).
- Promoting a custom service into the admin list.
- Suggested, minimum or maximum prices.
- Customer-side browsing by subcategory.
- More than two category levels.
- Approved artists editing services picked from the admin list (profile editing after approval stays out of scope, as in Increment 3).

## 1. Backend

### 1.1 Data (Alembic migration #6)

- **`categories`**: add `parent_id INTEGER NULL REFERENCES categories(id)`, with an index.
  - A row with `parent_id IS NULL` is a top-level category. A row with a parent is a subcategory.
  - The parent must be a top-level category. This is enforced in the service layer, because a check constraint can't look at another row.
  - The current unique constraint on `slug` stays global.
  - Name uniqueness becomes "unique among siblings" (same `parent_id`), checked in the service layer.
- **`service_templates`** (new):
  - `id` integer primary key.
  - `subcategory_id` integer, not null, references `categories(id)`, indexed.
  - `name` varchar(120), not null.
  - `description` text, nullable.
  - `sort_order` integer, not null, default 0.
  - `is_active` boolean, not null, default true.
  - Unique on (`subcategory_id`, lower(`name`)).
- **`artist_services`**: three new columns, and `name` becomes nullable.
  - `template_id INTEGER NULL REFERENCES service_templates(id)`, indexed.
  - `status` uses a new enum `artist_service_status` (`approved`, `pending`, `rejected`). It is not null, with server default `'approved'`.
  - `rejection_reason VARCHAR(500) NULL`.
  - `name` becomes nullable. A check constraint requires `template_id IS NOT NULL OR name IS NOT NULL`.
  - `category_id` meaning:
    - For a template service, it is the template's subcategory, copied in when the service is created.
    - For a custom service, it is the subcategory the artist chose.
    - For an old row, it is the original top-level category, left unchanged.
- Existing rows get `status = 'approved'` and `template_id = NULL` from the server default. No data is rewritten.
- The downgrade drops the new columns, the table and the enum. It fails cleanly if a row has `name IS NULL`, so service names are never silently lost.

### 1.2 Models

- `Category`:
  - add `parent_id`.
  - add `children`, a relationship ordered by `sort_order` and loaded with `selectin`.
- `ServiceTemplate` (new file `app/models/service_template.py`).
- `ArtistServiceItem`:
  - add `template_id`, `status` and `rejection_reason`.
  - add `template`, a relationship loaded with `selectin`.
  - add a `display_name` property that returns `template.name if template else name`.
- `ArtistServiceStatus` enum goes in `app/utils/enums.py`.

### 1.3 Public catalog: `GET /categories`

The response keeps its current top-level shape and adds one nested field:

```json
[{ "id": 1, "slug": "makeup", "name": "Makeup",
   "subcategories": [{ "id": 7, "slug": "makeup-bridal", "name": "Bridal",
                       "services": [{ "id": 3, "name": "HD Bridal Makeup", "description": "…" }] }] }]
```

- It returns only active top-level categories, their active subcategories, and those subcategories' active templates, each level ordered by `sort_order`.
- Hiding a category hides everything under it.
- New schemas `SubcategoryOut` and `TemplateOut` go in `schemas/artist.py`. `CategoryOut` gains `subcategories: list[SubcategoryOut] = []`.

### 1.4 Admin categories: `/admin/categories`

These are the existing endpoints, extended.

- `CategoryIn` and `CategoryPatch` gain `parent_id: int | None`.
- `AdminCategoryOut` gains:
  - `parent_id`.
  - `template_count`, the number of service templates directly under the item (0 for top-level categories).
  - `child_count`.
- Rules, enforced in `CategoryService`:
  - The parent must exist and be top-level. Otherwise `validation`: "Subcategories can only sit under a top-level category".
  - A category with children can't get a parent (`validation`).
  - A subcategory can't move to a different parent while artists use it or it has templates (`conflict`).
  - A category can't be its own parent (`validation`).
  - Names must be unique among siblings, compared case-insensitively. Otherwise `conflict`.
  - When the slug is omitted for a subcategory, it is generated as `slugify(parent.name + " " + name)`, e.g. `makeup-bridal`. Slugs remain globally unique.
  - Delete is blocked (`conflict`, "in use; hide it instead") when the item has children, templates, artists or services.
  - Artist and service usage counts work as they do today.
- `GET` returns a flat list ordered by (`parent_id` nulls first, `sort_order`, `id`). The admin panel builds the tree.
- Picking categories in artist onboarding (`ProfileIn.category_ids`) must accept **top-level, active** categories only. Anything else is a `validation` error ("Unknown category").

### 1.5 Admin service list: `/admin/service-templates` (new router, `current_admin`)

| Method | Path | Body / query | Notes |
|---|---|---|---|
| GET | `/admin/service-templates` | `?subcategory_id=` (required) | Ordered by `sort_order`, `id`. Each item has `id, subcategory_id, name, description, sort_order, is_active, artist_count`. |
| POST | `/admin/service-templates` | `{subcategory_id, name, description?, sort_order?, is_active?}` | `subcategory_id` must be a subcategory (`validation` otherwise). `sort_order` defaults to last. Duplicate name in the same subcategory is a `conflict`. |
| PATCH | `/admin/service-templates/{id}` | any of the above except `subcategory_id` | Moving a template to another subcategory is not supported. |
| DELETE | `/admin/service-templates/{id}` | | `conflict` when `artist_count > 0`: "in use; hide it instead". |

The logic lives in a new `ServiceTemplateService` (`app/services/service_template_service.py`).

### 1.6 Artist onboarding services: `/artists/me/services`

Only allowed while the profile is a draft or rejected (the existing `_editable` check).

- `ServiceIn` becomes `{template_id, price_paise, duration_minutes, description?}`:
  - The template must be active.
  - Its subcategory and that subcategory's parent must be active. Otherwise `validation`: "Unknown service".
  - The subcategory's parent must be one of the artist's chosen categories. Otherwise `validation`: "Pick that category on your profile first".
  - The artist can't already have this template. Otherwise `conflict`: "You've already added this service".
  - The new row is created with `category_id = template.subcategory_id`, `name = NULL` and `status = approved`.
- `ServicePatch` becomes `{price_paise?, duration_minutes?, description?}`. The template and category can't change. To swap, the artist deletes the service and adds another.
- `ServiceOut` gains `template_id`, `subcategory_id` (the row's `category_id`), `status` and `rejection_reason`. Its `name` returns `display_name`. `category_id` stays in the response for compatibility.
- Submit validation is unchanged: at least one service is still required.
- Saving the profile with a changed category list does not touch existing services, which is today's behaviour. The "must be under a chosen category" check only runs when a service is added.

### 1.7 Custom services: `/artists/me/custom-services` (new endpoints)

These are only allowed when the profile is `approved`. Otherwise `conflict`: "Custom services open once your profile is approved".

| Method | Path | Body | Behaviour |
|---|---|---|---|
| POST | `/artists/me/custom-services` | `{subcategory_id, name, price_paise, duration_minutes, description?}` | The subcategory must be active and a subcategory. It does **not** have to be under the artist's chosen categories. Creates the service as `pending` and returns the profile. |
| PATCH | `/artists/me/custom-services/{id}` | any of the above | Only for the artist's own custom services (template services return `not_found`). Any edit sets `status = pending` and clears `rejection_reason`. |
| DELETE | `/artists/me/custom-services/{id}` | | Removes the service. |

### 1.8 Admin custom-service queue: `/admin/custom-services` (new router, `current_admin`)

| Method | Path | Notes |
|---|---|---|
| GET | `/admin/custom-services?status=pending&limit=&cursor=` | Cursor-paginated like `/admin/artists` (`{items, next_cursor}`). Each item has `id, artist_id, business_name, category {id,name}, subcategory {id,name}, name, price_paise, duration_minutes, description, status, rejection_reason, created_at`. Oldest first. |
| POST | `/admin/custom-services/{id}/approve` | Only from `pending` (`conflict` otherwise). Sets `approved`, clears the reason. |
| POST | `/admin/custom-services/{id}/reject` | `{reason}`, with the same rules as `RejectIn`. Only from `pending`. Sets `rejected` and stores the reason. |

The nav badge needs no new endpoint. It copies `usePendingCount` (`admin/src/features/artists/queries.ts`), which fetches `?status=pending&limit=100` and shows "99+" when there is a `next_cursor`.

### 1.9 Tests (pytest, real test DB)

- Migration:
  - Upgrade and downgrade round-trip.
  - Existing services become `approved` with `template_id = NULL` and keep their name.
- Categories:
  - Only two levels: a subcategory can't be the parent of another subcategory, and a category with children can't get a parent.
  - Sibling names must be unique, but two categories can each have a "Bridal" subcategory.
  - The slug is generated from the parent and child names.
  - The delete rules: children, templates or usage block deletion.
- Public catalog: hiding a category, a subcategory or a template removes it and everything below from `GET /categories`.
- Templates: CRUD, a duplicate name gives `conflict`, a top-level `subcategory_id` gives `validation`, and deleting one in use is blocked.
- Onboarding services:
  - Happy path.
  - Unknown, hidden or out-of-category template.
  - Adding the same template twice.
  - The name comes from the template, and renaming the template changes it.
  - `PATCH` ignores the template.
  - `ProfileIn` rejects subcategory IDs.
- Custom services:
  - Blocked for draft, pending and rejected profiles.
  - Created as pending.
  - Approve and reject.
  - Editing a rejected service sets it back to pending.
  - An artist can't touch another artist's service.
- Admin queue: filtering by status, pagination, and approving or rejecting a non-pending service gives `conflict`.

## 2. Admin panel

### 2.1 Catalog page (`/categories`) becomes two panes

- **Left pane, "Categories":**
  - Top-level categories that expand to show their subcategories.
  - Each row shows the name, usage count, active switch, edit and delete.
  - An "+ Subcategory" button sits inside each expanded category.
  - A "New category" button sits at the top.
- `CategoryDialog` is reused for both levels:
  - It gets an optional `parent` prop.
  - For a subcategory it shows "Under: Makeup" (read-only) and sends `parent_id`.
- **Right pane, "<Category> › <Subcategory>":**
  - A table of service templates with columns Order, Service (name and muted description), Artists, Active, edit and delete.
  - A "New service" button at the top.
  - With nothing selected: "Pick a subcategory to manage its services."
- New `ServiceTemplateDialog` with name, description, order and active.
- The selected subcategory lives in the URL (`?sub=<id>`).
- Delete is disabled with a hover reason when the item is in use, as today.
- New hooks in `features/categories/queries.ts`: `useServiceTemplates(subId)`, `useSaveServiceTemplate`, `useDeleteServiceTemplate`.

### 2.2 Custom services queue (`/custom-services`)

- A new nav item "Custom services" sits between Verification and Catalog, with a pending-count badge.
- A table with columns Artist (links to `/artists/:id`), Category › Subcategory, Service (name and description), Price, Duration, Submitted, and Approve / Reject buttons.
- Reject reuses the existing reason dialog from artist review.
- The feature folder is `features/custom-services/`.

### 2.3 Artist review page

- The services table shows "Category › Subcategory" for each row. Old rows, which point at a top-level category, show just the category name.
- Custom services, where `template_id` is null, get a "Custom" badge.
- Rows with a status other than approved get a status badge.

### 2.4 Types and tests (Vitest and Testing Library, mocked fetch)

- `lib/types.ts`:
  - `AdminCategory` gains `parent_id`, `template_count` and `child_count`.
  - New types: `ServiceTemplate`, `CustomServiceItem` and the page type.
  - `Service` gains `template_id`, `subcategory_id`, `status` and `rejection_reason`.
- Tests:
  - Create a subcategory under a category.
  - Select it and create a service template.
  - Delete is disabled when the item is in use.
  - Approve a custom service from the queue.
  - Reject one with a reason.
  - The review page shows "Custom" and the subcategory.

## 3. Mobile app (artist onboarding)

### 3.1 Add-service sheet (`src/artist/AddServiceSheet.tsx`)

The sheet now works in three steps.

1. **Category and subcategory.** First row: chips for the artist's chosen categories (preselected when there is only one). Second row: chips for that category's subcategories, from the `GET /categories` tree.
2. **Service.** A list of the subcategory's templates, showing the name and the description underneath. Templates the artist already has are disabled and marked "Added".
3. **Price and duration**, plus an optional note. The validation and limits stay the same.

- The free-text "Service name" field is removed.
- `onSubmit` sends `{template_id, price_paise, duration_minutes, description?}`.

**Empty states:**
- When a subcategory has no services: "No services listed here yet. Try another subcategory."
- When none of the artist's categories have any services: "Services for your categories are being set up. Check back soon." The artist can't submit in this case, so **the admin must fill in the catalog before artists onboard**. The README will say this.

### 3.2 Services step (`app/artist/onboarding/services.tsx`)

- Each row shows "Category › Subcategory · ₹4,500 · 2 hr" under the service name.
- The editing path, if one exists, only changes price, duration and note.

### 3.3 Supporting changes

- `src/api/types.ts`:
  - `Category` gains `subcategories`.
  - New types `Subcategory` and `ServiceTemplate`.
  - `ServiceInput` and `Service` are updated to match section 1.6.
- `src/api/mock/transport.ts` and `src/api/mock/artist.ts`:
  - Seed data: Makeup → Bridal, Party, and Mehendi → Bridal, Arabic, with 2 or 3 templates each.
  - Mirror the new validation: unknown template, adding the same template twice, and a template outside the artist's categories.
- The catalog query is unchanged: the same `/categories` request, cached by React Query.

### 3.4 Tests (Jest)

- The three-step sheet happy path submits the right payload.
- An already-added template is disabled.
- Both empty states.
- The services list shows "Category › Subcategory".
- The mock transport rejects a duplicate template.

## 4. Build sequence

1. Backend: migration, models, catalog `GET`, admin categories rules, template CRUD (with tests).
2. Backend: onboarding service changes, custom-service endpoints and admin queue (with tests).
3. Admin panel: two-pane Catalog, Custom services queue and review-page badges (with tests).
4. Mobile: types, mock data and transport, three-step sheet and services list (with tests).
5. README updates: the catalog must be filled in before onboarding opens, and the new admin pages.

## 5. Operations

- Run migration #6 before deploying the new backend. It only adds columns and a table, and existing rows stay valid.
- **Before artists onboard on the new build, the admin must create subcategories and services** for every active category. Otherwise artists in those categories can't add services and can't submit.
