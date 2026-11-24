# Category-specific service schema — research

Status: decided 2026-11-24 (see §5); backend implemented.

## 1. What the backend stores today

| Table | Shape | Notes |
|---|---|---|
| `catalog_category` | id, parent_id, slug, name, sort_order, status | Two levels (category → subcategory). No behaviour or fields per category. |
| `catalog_service_template` | subcategory_id, name, description | The admin's list of services artists pick from. |
| `artist_service_item` | category_id, template_id \| name, price_paise, duration_minutes, description, photo_key, included_items[], status, addons | One shape for every service. `template_id` NULL = custom service. |
| `artist_service_addon` | name, price_paise, per_person | Flat or per-person extras. |
| `booking` | service snapshot, start_at/end_at (required), address, note, money, addons | Every booking is a time slot at an address. |
| `quote_enquiry` | event_date, details (free text), budget, quote price/duration | Custom requests; accepting books a slot. |
| `shop_product` | name, category (string), price, stock, photos | Stocked goods with shipping; separate from services. |

**Custom services** use the same `artist_service_item` row with a free-text `name`, filed under a subcategory
(or a suggested one via `subcategory_request`). They start `pending`; an admin approves or rejects; any edit sends
them back to review.

## 2. Where the single shape breaks

| Category | Pricing | Fulfilment | Listing details (artist) | Booking details (customer) |
|---|---|---|---|---|
| Mehendi / Makeup / Hair | package, per person | appointment at home or studio | — | guests, occasion |
| Photography | package or per hour | appointment / event (hours, multi-day) | edited photos, album, delivery days | event type, venue |
| Calligraphy / Canvas | per piece | made to order | sizes, frame options, turnaround | text/name to write, size, reference photo |
| Custom cards | per piece / per 50, minimum qty | made to order, delivered | paper, turnaround, proof | wording, quantity, needed-by date |
| Aqiqah boxes / Hampers | per box, minimum qty | made to order, delivered | box contents, minimum order | baby's name, quantity, delivery date |
| Crafts (resin, hoop) | per piece | made to order (pickup + delivery) | sizes, turnaround | names/dates, pickup address |

So three things vary by category, not one:

1. **Fulfilment** — `appointment` (time slot + duration, at the customer or the studio) vs `made_to_order`
   (needed-by date + turnaround days + quantity, delivered or picked up; no slot, no calendar overlap).
2. **Pricing unit** — `package` (today), `per_person`, `per_hour`, `per_unit` (with a unit label like "box" or
   "50 cards" and a minimum quantity), or `on_request` (no price; goes through an enquiry/quote).
3. **Fields** — admin-defined, in two scopes: *listing* fields the artist fills when offering the service, and
   *booking* fields the customer fills when booking.

## 3. Proposed model

- **Category config** (on `catalog_category`; a subcategory inherits from its parent unless it overrides):
  `fulfilment`, `pricing_units` (allowed set), `unit_label`, `field_schema` (JSONB list of field definitions).
- **Field definition:** `{key, label, scope: listing|booking, type: text|long_text|number|select|multi_select|boolean|date|photo, required, options?, min?, max?, unit?, help?}`.
  Keys are immutable once used; labels can change.
- **Service item:** add `pricing_unit`, `unit_label`, `min_quantity`, `attributes` (JSONB, listing-scope values),
  validated against the subcategory schema on write.
- **Booking:** add `quantity`, `details` (JSONB, booking-scope values) and a snapshot of the field labels, so later
  schema edits never change history. Made-to-order bookings carry `needed_by_date` and `fulfilment`; appointment
  bookings keep `start_at`/`end_at`.
- **Storage choice:** JSONB + schema (flexible, admin-editable without migrations, GIN-indexable for filters later),
  over EAV tables (heavy joins) or per-category tables (a migration per category).

## 4. Custom services

- A custom service inherits its subcategory's fulfilment, pricing units and fields, so the artist fills the same
  form as for a listed service, plus a **Price on request** option that routes customers to an enquiry.
- Admin review shows the attributes; the admin can **promote** a good custom service to a catalog template.
- Price/duration/quantity edits stay live (as for listed services); name, description, photos and attributes go
  back to review.

## 5. Decisions (2026-11-24)

1. **Made-to-order is enquiry and quote only.** A `made_to_order` service refuses instant booking; the customer
   sends an enquiry naming the service, a quantity and their answers to its booking fields, and accepting the quote
   carries those answers onto the booking.
2. **Admins build the fields** per category/subcategory (JSONB schema; no release for a new category).
3. **Pricing: whole service, or per unit.** Per unit counts in person, piece, box, card, hour or set, from a
   minimum quantity ("₹350 per box, min 25"); a category names a default unit its services start from. Bookings and
   enquiries keep the unit with the quantity. Per-hour is a unit; price-on-request is still not in this cut.
5. **Review and request show add-ons and suggestions.** Quote requests carry picked add-ons and can tick up to five
   more of the artist's services ("Goes well with", closest first: same subcategory, then category). The booking
   review suggests the same services, opening one on tap; a booking stays one service and one slot.
4. **Custom services stay free-form**: no listing attributes (customers still answer their subcategory's booking
   fields), no promote-to-catalog.

## 6. Phasing (once decided)

1. Backend: category config + field schema + validation; service `attributes`/pricing unit; migration with
   defaults that keep every existing row `appointment` + `package`.
2. Admin: field builder and pricing/fulfilment settings per category; custom-service review shows attributes,
   with promote to template.
3. Mobile artist: dynamic listing form per subcategory (listed and custom services).
4. Mobile customer: storefront/service detail render attributes; booking form renders booking fields, quantity and
   either a slot (appointment) or a needed-by date (made to order).
5. Booking/order backend: made-to-order lifecycle (no slot, turnaround, delivery), dashboard and calendar handling.
