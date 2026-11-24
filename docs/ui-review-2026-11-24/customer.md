# Customer app UI/UX gap review (mobile/app/customer/**)

Scope: every customer route under `mobile/app/customer/**` and the `mobile/src` components and hooks they render. This was a read-only review; no files were changed.
Paths are relative to `mobile/`. Severity: **P0** = broken, blocking, or a destructive action with no safety net; **P1** = notable UX, trust, or discovery gap, or a breach of a CLAUDE.md rule; **P2** = polish.

---

## 0. Cross-cutting findings (affect many screens)

| # | Gap | Where | Sev |
|---|-----|-------|-----|
| X1 | **Text characters used as icons**, which CLAUDE.md §11 forbids ("no emoji or text glyphs as icons"): `★` for rating, `●` for availability, `×` to remove a chip, `+` for add-to-cart. | `app/customer/(tabs)/explore.tsx:95,99`; `src/components/directory/ExploreFeaturedCard.tsx:56,66`; `ExploreResultRow.tsx:40,47`; `ArtistTile.tsx:44`; `ArtistCompactRow.tsx:41`; `src/components/shop/ProductCard.tsx:28` | P1 |
| X2 | **Hard-coded sizes instead of design tokens.** About 87 `fontSize: <n>` and 23 `borderRadius: <n>` literals in customer screens and components (for example 14.5, 10.5, 18.7, 30, 36, `borderRadius: 18`). Typography variants exist, but call sites override them, so the type scale and corner radii drift between screens. | e.g. `(tabs)/bookings.tsx:37,63,68`, `explore.tsx:116,118`, `home.tsx:113,144`, `ShopBanner.tsx:26`, `HomeHero.tsx:69`, `StorefrontFooter.tsx:23` | P1 |
| X3 | **Only one error boundary for the whole app** (`app/_layout.tsx`). CLAUDE.md §8 requires a boundary per route group with a retry fallback. If a render fails anywhere in the customer area, the entire app is replaced. | `app/customer/_layout.tsx:9-19`, `app/customer/(tabs)/_layout.tsx` | P1 |
| X4 | **Filter and tab state is kept in component state, not the URL** (CLAUDE.md §7.4). This covers Explore's filters and sort, the Feed tab, Shop category and search, the Bookings scope and the Saved tab. None of it survives a deep link, a share or a remount. | `src/hooks/directory/use-explore-filters.ts:23`; `src/components/feed/FeedList.tsx:33`; `ShopHome.tsx:33`; `(tabs)/bookings.tsx:29`; `SavedScreen.tsx:36` | P2 |
| X5 | **Deep relative imports** (`../../../src/...`) in every route file, where CLAUDE.md §4 requires the `@/` alias. | all `app/customer/**` | P2 |
| X6 | **No dark theme.** `Theme.name` is the literal type `'light'`, so a dark variant cannot be added without a type change. | `src/core/theme/types.ts` | P2 |
| X7 | **"Verified" is shown on every artist, unconditionally, and drawn two different ways**: a `verified` badge on Explore, Storefront, Service, Feed and Product, but a plain `check` on Home tiles and Top-rated rows. Nothing explains what "verified" means. Approval is not the same as verification; this weakens trust and may mislead customers. | `StorefrontHero.tsx:56-59`, `ServiceDetail.tsx:71`, `ExploreFeaturedCard.tsx:51`, `ArtistTile.tsx:41`, `ArtistCompactRow.tsx:38`, `PostAuthor.tsx:36`, `ProductDetail.tsx:53` | P1 |
| X8 | **Hard-coded policy numbers in copy.** "3 hours" and "72 hours" are typed into strings even though `ACCEPT_WINDOW_HOURS` and `FREE_CANCEL_HOURS` exist, and the support SLA "within 2 hours" is hard-coded too. If the backend config changes, the copy will be wrong. | `booking/[id].tsx:67,128`; `book/review.tsx:74`; `HelpSupport.tsx:15`; `SupportThread.tsx:58` | P1 |
| X9 | **No sharing anywhere** (no `Share`/`expo-sharing`): not for artists, posts or products. Sharing is a core growth loop for wedding and beauty marketplaces. | — | P1 |
| X10 | **Paginated lists have no "loading more" footer** (only Explore and AllReviews have one): Feed, Shop, Orders, Quotes, Notifications, Messages, Saved and Bookings. Several also omit `onEndReachedThreshold`. | `FeedList.tsx:71`, `ShopHome.tsx:75`, `MyOrders.tsx:35`, `CustomerEnquiries.tsx:31`, `NotificationInbox.tsx:49`, `ChatInbox.tsx:61`, `SavedScreen.tsx:74`, `(tabs)/bookings.tsx:48` | P2 |
| X11 | **A failed "load more" goes unreported.** Many lists show their error only when there is no data (`isError && !data`), so if a later page fails to load, nothing tells the user (Feed, Shop, Orders, Quotes, Notifications, Saved). | `FeedList.tsx:57`, `ShopHome.tsx:59`, `MyOrders.tsx:27`, `CustomerEnquiries.tsx:23`, `NotificationInbox.tsx:41`, `SavedScreen.tsx:67` | P2 |
| X12 | **Calls to action sit in the same place on every screen, but section headings and page titles do not.** Some screens use a display title at 30 px, Explore uses 36 px, and others use the BackHeader title. Pinned footers are consistent. | `explore.tsx:116` vs `bookings.tsx:37` vs `FeedList.tsx:46` | P2 |

---

## 1. Tab bar — `app/customer/(tabs)/_layout.tsx`

| Gap | Ref | Sev |
|---|---|---|
| **Bookings is not a tab** (`href: null`); it is reachable only via Profile → My bookings. In a booking marketplace this is the most-revisited screen (Urban Company, Airbnb Trips). The code comment says the spec is "Home, Explore, Bookings, Profile", but the shipped tabs are Home, Explore, Feed, Shop, Profile. | `_layout.tsx:6-12,14,37` | P1 |
| No badge counts on any tab: unread messages, pending booking actions or cart quantity. | `_layout.tsx:29-35` | P1 |
| Tab label size is a literal `fontSize: 10.5`. | `_layout.tsx:25` | P2 |

## 2. Home — `app/customer/(tabs)/home.tsx`

### Header (greeting, location, messages, avatar)
| Gap | Ref | Sev |
|---|---|---|
| **No notifications bell.** The Notifications route says it is opened from "Home → bell" (`notifications.tsx:4`), but customer Home has only a chat icon. The customer `NotificationBell` exists but is used only on the artist home. Notifications are reachable only from Profile. | `home.tsx:117-124`; `src/components/notifications/NotificationBell.tsx` | P1 |
| The Messages button shows no unread badge. | `home.tsx:117-124` | P1 |
| The location pill's label uses a literal `fontSize: 14`. The "Finding you…" state has no spinner (the LocationCard below it does). | `home.tsx:113` | P2 |

### Location card
| Gap | Ref | Sev |
|---|---|---|
| Good: covers locating, refused, and blocked (with a link to Settings). The card buttons are 34 px high, below the 44 pt minimum, and have no hitSlop. | `LocationCard.tsx:49` | P2 |

### Hero carousel
| Gap | Ref | Sev |
|---|---|---|
| The two slides are hard-coded with local images, so they cannot be changed without an app release (no CMS or remote config). The "FROM ₹X" figure comes from matching a category name, lower-cased, against a slug, which breaks if the names differ (e.g. "Mehndi" vs `mehendi`). It also uses only the first page of nearby artists, so the price is not a real "from" price. | `home.tsx:37-50` | P2 |
| The pagination dots are 6 px with `hitSlop` 10, which gives a target of about 26 px. | `HomeHero.tsx:74-82` | P2 |

### Search entry
| Gap | Ref | Sev |
|---|---|---|
| This is a fake search box that just switches to the Explore tab. The keyboard does not open on arrival, so the user has to tap a second time. Best practice is to focus the search field on landing. | `home.tsx:140-148` | P2 |

### Services (categories)
| Gap | Ref | Sev |
|---|---|---|
| **There is no error state.** If categories fail to load, the whole section disappears silently. CLAUDE.md §8 requires loading, error and empty states. | `home.tsx:150-160` | P1 |
| The first category is always filled and bold, as if selected, but that is purely decorative. Users read it as the active filter. | `CategoryIconRow.tsx:28-36` | P2 |

### Discover artists near you
| Gap | Ref | Sev |
|---|---|---|
| The heading says "near you" even when no place is set, in which case the list is not near anything. | `home.tsx:162` | P2 |
| The empty state reads "No artists yet. Check back soon." even when the cause is the selected place. It should offer to widen the area, change the place or show all cities. | `home.tsx:168` | P1 |
| Home tiles show no availability ("Available today"), even though Explore cards do. | `ArtistTile.tsx` | P2 |

### Shop banner
| Gap | Ref | Sev |
|---|---|---|
| The eyebrow text `"NEW · ATELIER SHOP"` is hard-coded when it should use `brand.name`. The "Shop now" button is a fake (a View inside a Pressable), and the title uses literal sizes 18.7 and 20. | `ShopBanner.tsx:25-31` | P2 |

### Top rated
| Gap | Ref | Sev |
|---|---|---|
| **"Top rated" is calculated on the phone** from the first page of the nearest-sorted list, so it is not actually the top rated in the area. Its "See all" opens Explore without setting sort to rating, so the full list does not match the heading. | `home.tsx:55-60,190` | P1 |
| `ArtistCompactRow` has no `accessibilityLabel`, so the screen reader reads the inner text including the "★" glyph. | `ArtistCompactRow.tsx:27-31` | P2 |

### Missing best-in-class blocks
| Gap | Sev |
|---|---|
| No card for the user's **upcoming booking or pending request** on Home (Urban Company leads with it). | P1 |
| No "Book again" or "Recently viewed" row, no offers or promos, and no rows for social proof or trust ("Verified artists · Free cancellation"). | P2 |

## 3. Explore — `app/customer/(tabs)/explore.tsx`

### Search
| Gap | Ref | Sev |
|---|---|---|
| No clear (×) button, no recent searches, and no typeahead suggestions for services or categories. The search box uses literal sizes (height 46, radius 12). | `explore.tsx:118-131` | P2 |

### Filter chips
| Gap | Ref | Sev |
|---|---|---|
| **Category cannot be picked inside Explore.** A category can only arrive from Home's circles (`?categoryId`). After it is removed (the "×" chip) there is no way to choose another without going back to Home. This is a basic discovery gap. | `explore.tsx:66,95` | P1 |
| The price filter offers only "Under X" caps: no range, and no "budget per person". | `src/utils/directory/explore-choices.ts:6,23-25` | P2 |
| The "Home visit" chip has no counterpart ("Studio") and no explanation. | `explore.tsx:100` | P2 |
| The rating chip is hard-wired to 4.8+ with no other thresholds, and its label uses the ★ glyph (X1). | `explore.tsx:99`; `use-explore-filters.ts:6` | P2 |
| The location error appears as loose caption text with no retry or Settings action. The LocationCard on Home has both. | `explore.tsx:134-136` | P2 |

### Results header (count · where · sort)
| Gap | Ref | Sev |
|---|---|---|
| The count is blank while loading, so the header shifts when it appears. The "Change city" and sort controls are 13 px captions with hitSlop 8, which are small targets. | `explore.tsx:165`; `ExploreResultsHeader.tsx:23-31` | P2 |

### Result list
| Gap | Ref | Sev |
|---|---|---|
| **The "featured" mosaic card is simply the first result**, whatever its quality or sort order. It reads as a promoted or editorial placement and confuses the hierarchy, especially under "Price: low to high". | `explore.tsx:146-160` | P1 |
| Rows other than the first have **no save (bookmark) button**, though the featured card does. | `ExploreResultRow.tsx` vs `ExploreFeaturedCard.tsx:53` | P2 |
| Distance appears only after "Near me". Rows do not show "Travels to you" or the service radius, which matters for home-visit services. | `src/utils/directory/format.ts:5-8` | P2 |
| There is no map view, even though the `PinMap` wrapper exists. | — | P2 |
| The previous results stay on screen at 55% opacity while new ones load, with no spinner. This is fine, but there is no screen-reader announcement that results are loading. | `explore.tsx:144` | P2 |

### Empty and error states
| Gap | Ref | Sev |
|---|---|---|
| Good: there are loading, error and empty states plus "Clear filters". When there are no filters, though, the empty state does not suggest widening the area. | `explore.tsx:103-110` | P2 |

## 4. Feed — `app/customer/(tabs)/feed.tsx` → `src/components/feed/FeedList.tsx`

| Section | Gap | Ref | Sev |
|---|---|---|---|
| List | Pull-to-refresh exists only once items are on screen, so the empty and error states cannot be refreshed. Loading, error and empty are rendered outside the list. | `FeedList.tsx:56-74` | P2 |
| List | A failed later page is silent, and there is no footer spinner (X10, X11). | `FeedList.tsx:57,71` | P2 |
| Following tab | Its empty state ("Follow artists…") has no button to discover artists to follow. | `FeedList.tsx:24` | P2 |
| Photo post | "Report" is a plain text link in the main action row, as prominent as Save. A best-in-class app puts it in an overflow (…) menu. There is no double-tap to like and no share. | `PhotoPostCard.tsx:25-31`; `ReportPostButton.tsx:29-31` | P2 |
| Photo post | The caption is not truncated: long captions take up the card ("more" is missing). | `PhotoPostCard.tsx:32-37` | P2 |
| Book this look | Good bridge into commerce. The pill shows the price but no duration or rating. | `BookLookButton.tsx` | P2 |

### Post / Article — `app/customer/post/[id].tsx` → `ArticleView.tsx`
| Gap | Ref | Sev |
|---|---|---|
| **The CTA label can be wrong.** It is built as `Book ${business_name.split(' ')[0]}`, so "The Glam Studio" becomes "Book The". | `ArticleView.tsx:44,81` | P1 |
| The rating is printed raw (`Rated ${artist.rating_average}`), so it may read "4.6666" and is not formatted with `formatAverage`. | `ArticleView.tsx:46` | P2 |
| The detail view has no Save button, though the cards do. There is no share and no "More from this artist". | `ArticleView.tsx:77-83` | P2 |
| The loading state uses the list skeleton rather than `shape="detail"`. | `ArticleView.tsx:39` | P2 |

## 5. Shop tab — `ShopHome.tsx`

| Section | Gap | Ref | Sev |
|---|---|---|---|
| Header | The cart is a text pill ("Cart · 3") rather than a bag icon with a badge. | `ShopHome.tsx:48-50` | P2 |
| Categories | The category chips are hard-coded on the client and can drift from the backend. | `ShopHome.tsx:20-26` | P2 |
| Grid | **"+" (add to cart) gives no feedback.** There is no toast, no badge animation and no undo, so customers tap repeatedly and end up with duplicates. The "+" button is also nested inside the card's button. | `ProductCard.tsx:19-29`; `ShopHome.tsx:72` | P1 |
| Grid | A product with no photo has no placeholder, so the "+" floats over nothing and the grid rows misalign. | `ProductCard.tsx:18` | P2 |
| Grid | There are no sort options (price, popularity, new), no price filter and no rating on product cards. | — | P2 |
| States | Pull-to-refresh exists only once items exist (as in Feed). There is no footer spinner. | `ShopHome.tsx:58-77` | P2 |

### Product — `shop/product/[id].tsx` → `ProductDetail.tsx`
| Gap | Ref | Sev |
|---|---|---|
| **The seller row is a dead end.** The avatar and name are not tappable, so there is no way to reach the artist's storefront or their other products. | `ProductDetail.tsx:50-54` | P1 |
| **"Buy now" adds the item to the existing cart and goes to checkout for the whole cart**, not just this item. Tapping it twice adds two. | `ProductDetail.tsx:79` | P1 |
| "Add to cart" sends the user straight to the cart, which breaks browsing. A toast or snackbar would be better. | `ProductDetail.tsx:78` | P2 |
| No product reviews or ratings, no delivery estimate or fee, no return or refund policy. "Nothing is paid in the app" is the only reassurance. | `ProductDetail.tsx:64-68` | P1 |
| The photo pager has no page dots or counter (the feed carousel has one). | `ProductDetail.tsx:46-48` | P2 |

### Cart — `shop/cart.tsx` → `CartScreen.tsx`
| Gap | Ref | Sev |
|---|---|---|
| **The cart lives only in memory for the session.** It is lost when the app is killed, and its lines keep a snapshot of price and stock that is never revalidated. | `src/context/shop/cart-context.tsx:14-16` | P1 |
| **The copy contradicts checkout.** The cart says "delivery charge, shown before you place the order", but checkout shows only "+ delivery" with no amount. The fee first appears on the order after it has been placed. | `CartScreen.tsx:44` vs `CheckoutScreen.tsx:79` and `OrderDetail.tsx:62` | P1 |
| The empty cart has no "Browse the shop" button, and there is no explicit Remove control (minus at quantity 1 removes the line silently, with no undo). | `CartScreen.tsx:28`; `QuantityStepper.tsx:13` | P2 |
| The footer label "Items" is vague. It should read "Subtotal (excl. delivery)". | `CartScreen.tsx:49` | P2 |

### Checkout — `CheckoutScreen.tsx`
| Gap | Ref | Sev |
|---|---|---|
| **The total and delivery fee are unknown before the order is placed**, so the price breakdown is not transparent. | `CheckoutScreen.tsx:79,104` | P1 |
| The validation message shows before the user has typed anything (the address is empty on mount). | `CheckoutScreen.tsx:75` | P2 |
| No recipient name or phone, no PIN field, and no item list (only a count per seller). | `CheckoutScreen.tsx:74-79` | P2 |
| The radio dots are hand-drawn 18 px Views; this should be a shared radio component. | `CheckoutScreen.tsx:93` | P2 |

### Order placed — `OrderPlaced.tsx`
| Gap | Ref | Sev |
|---|---|---|
| There is no success icon. "Track order" opens the orders list even when only one order was placed; it should open that order. `replace('/customer/shop')` from a stack screen onto a tab path can leave odd back-stack history. | `OrderPlaced.tsx:12-21`; `shop/placed.tsx:10-11` | P2 |

### My orders / Order detail — `MyOrders.tsx`, `OrderDetail.tsx`
| Gap | Ref | Sev |
|---|---|---|
| **"Cancel order" fires in one tap with no confirmation and no reason prompt.** The artist side asks for confirmation (`ShopOrderCard.tsx:50`) but the customer side does not. | `OrderDetail.tsx:67-69` | **P0** |
| There is no "Message seller", no help or "Report a problem" link, and the tracking number is not a link. | `OrderDetail.tsx:59-66` | P1 |
| The order detail has no pull-to-refresh. Progress dots are only coloured in or not (12 px), and the timeline group has no screen-reader label. | `OrderDetail.tsx:47-55` | P2 |
| Orders cannot be filtered (active vs past), and the list rows show no product thumbnail. | `MyOrders.tsx:36-43` | P2 |

## 6. Artist storefront — `app/customer/artist/[id].tsx` → `Storefront.tsx`

### Hero
| Gap | Ref | Sev |
|---|---|---|
| The "Verified artist" badge is always shown (X7). There is no share button. With no cover photo, the 440 px hero is an empty fallback block. | `StorefrontHero.tsx:22,39,56-59` | P1 |
| The save button wrapper is a literal 40 px. | `StorefrontHero.tsx:26,46` | P2 |

### Stats
| Gap | Ref | Sev |
|---|---|---|
| Good: rating, bookings, experience and reply time. "0 Bookings" is shown for new artists, which hurts them; it would be better to hide the stat or show "New". | `StorefrontStats.tsx:35` | P2 |

### Actions (Book now / Message / Enquire / Follow)
| Gap | Ref | Sev |
|---|---|---|
| Three CTAs plus a follow circle in one row: at 360 dp the three equal-weight buttons crowd together. "Book now" duplicates the pinned "Check availability" footer. | `StorefrontActions.tsx:29-58`; `StorefrontFooter.tsx:26` | P2 |
| The Follow control is an icon-only plus or check with no text, so it is easy to mistake for "add". | `StorefrontActions.tsx:39-57` | P2 |

### Chips (next free · travels · languages)
| Gap | Ref | Sev |
|---|---|---|
| "Fully booked for the next two weeks" offers no "Notify me" or "Enquire for later dates" action. | `StorefrontChips.tsx:29-33` | P1 |

### Section tabs
| Gap | Ref | Sev |
|---|---|---|
| The tabs never show which one is active (there is no scroll-spy), and they scroll away instead of sticking. Their `accessibilityRole="link"` is used for in-page jumps. | `StorefrontTabs.tsx:20-31` | P2 |

### Work (portfolio)
| Gap | Ref | Sev |
|---|---|---|
| **Portfolio photos cannot be opened** (no full-screen viewer or pinch to zoom). Only the "See all" tile is pressable. For makeup, mehndi and photography the portfolio is the main reason to choose an artist. | `StorefrontWork.tsx:28-41` | P1 |

### Services
| Gap | Ref | Sev |
|---|---|---|
| Rows show no add-on hint ("+3 add-ons") and no "at home / at studio". The "Most booked" badge uses a literal 10 px font. | `StorefrontServiceRow.tsx:57,60-63` | P2 |

### Posts ("From the studio")
| Gap | Ref | Sev |
|---|---|---|
| There is no loading state: the section and its tab pop in once posts arrive, which shifts the layout. | `artist/[id].tsx:23-25`; `Storefront.tsx:118,134` | P2 |

### Reviews
| Gap | Ref | Sev |
|---|---|---|
| The heading is not marked `accessibilityRole="header"`, unlike the other sections. | `StorefrontReviews.tsx:25` | P2 |

### About / missing trust blocks
| Gap | Ref | Sev |
|---|---|---|
| **No cancellation or refund policy on the storefront.** It appears only at the final review step. Urban Company and Airbnb show it on the listing page. | `Storefront.tsx:144-148` | P1 |
| There is no service area or map (where the artist is based and how far they travel), even though the `PinMap` wrapper is available. There is no "Report this artist". | — | P2 |
| There is no pull-to-refresh on the storefront. | `Storefront.tsx:104` | P2 |
| When the page opens from a list card, the stats and actions are missing while it loads (only the hero and a generic list skeleton appear). | `Storefront.tsx:73-81` | P2 |

## 7. All reviews — `artist/[id]/reviews.tsx` → `AllReviews.tsx`

| Gap | Ref | Sev |
|---|---|---|
| No sort (newest, highest, lowest), no filter by star rating or service, no photo reviews, and no "Verified booking" tag. | `AllReviews.tsx:27-41` | P1 |
| The reviewer avatar is always `uri={null}`. There are no "helpful" votes, no option to report a review, and no pull-to-refresh. | `ReviewCard.tsx:28` | P2 |
| The 5→1 distribution bars cannot be tapped to filter. | `ReviewSummaryView.tsx:23-34` | P2 |

## 8. Service detail — `artist/[id]/service/[serviceId].tsx` → `ServiceDetail.tsx`

| Gap | Ref | Sev |
|---|---|---|
| **The hero shows the artist's first portfolio photo, not the service's own photo** (`service.photo_url` exists but is not used). | `ServiceDetail.tsx:55,63` | P1 |
| The payment copy "You pay the artist directly after the service." is hard-coded and ignores `IN_APP_PAYMENTS`, so it will be wrong in phase 2. | `ServiceDetail.tsx:108` | P2 |
| The price is labelled "Starting at", but the price is fixed per package, so the label is misleading. | `ServiceDetail.tsx:75` | P2 |
| No reviews that mention this service, no cancellation policy, and no next free date. | — | P1 |
| The add-on guest stepper buttons are 30 px (`hitSlop` 6 gives 42 px), and the checkbox corner radius is a literal 6. | `AddonPicker.tsx:18,45,75` | P2 |

## 9. Booking flow

### Step 1 — Date & time: `app/customer/book/[artistId].tsx`
| Gap | Ref | Sev |
|---|---|---|
| **If the service is missing** (deleted, or a bad deep link), the summary line is absent and "Continue" stays disabled with no explanation and no way out. There is also no loading indicator for the artist query: only `isError` is handled. | `book/[artistId].tsx:26,37-41,49,59` | P1 |
| **The day strip covers only 14 days**, though `BOOKABLE_DAYS` is 60. Bridal and wedding bookings are made months ahead, and there is no calendar or month picker. | `SlotPicker.tsx:7`; `src/utils/bookings/pricing.ts:17` | P1 |
| The picker always opens on today. It does not jump to the artist's `next_free_date`, and the day chips do not show which days have openings, so users tap through up to 14 days. | `SlotPicker.tsx:21`; `DayStrip.tsx` | P1 |
| Times carry no IST note, which matters for NRI or out-of-state customers. Taken slots are shown only with strike-through and muted text, which is a weak contrast signal. | `SlotGrid.tsx:56-58` | P2 |
| The footer price has no label ("Total" or "Estimate") and no add-on breakdown. | `book/[artistId].tsx:55` | P2 |
| The step counter says "Step 1 of 2", but choosing the package and add-ons was already a step. | `book/[artistId].tsx:36` | P2 |
| The bottom padding is a literal `140`. | `book/[artistId].tsx:35` | P2 |

### Step 2 — Review & request: `app/customer/book/review.tsx`
| Gap | Ref | Sev |
|---|---|---|
| **The address is free text, with no check against the artist's travel radius or city**, and no map pin. The artist may decline only after the 3-hour wait. | `review.tsx:113-120` | P1 |
| The address field is single-line for a full address. There are no structured fields (flat, landmark, PIN). | `review.tsx:113-120` | P2 |
| **The error appears at the bottom of the scrolling content, out of view behind the pinned footer**, with no toast. The user taps "Request booking" and nothing visibly happens. | `review.tsx:132` | P1 |
| Nothing on this screen can be edited (time, add-ons). The user has to go back and lose the picks. There is no "Change" link on the summary card. | `review.tsx:101-105` | P2 |
| No link to terms or cancellation policy beside the CTA. The policy line uses `confirmedInk` (green) even when it is bad news ("isn't refundable"). | `review.tsx:126-131,74` | P2 |
| After a conflict the user is sent back with a notice, but the add-on picks survive only because they travel in the URL. This is fine. | `review.tsx:87-91` | — |

### Booking requested — `app/customer/book/done.tsx`
| Gap | Ref | Sev |
|---|---|---|
| Raw `react-native-svg` is used directly in a route, which breaks CLAUDE.md §11 (wrap primitives and use `Icon`). | `done.tsx:3,28-30` | P1 |
| "usually confirms within 3 hours" undersells a hard rule: the request **expires** after 3 hours. There is no "what happens next" timeline, no add-to-calendar, and no "Message artist". | `done.tsx:45` | P1 |
| `paddingTop: insets.top + 56` and the 72/34 icon sizes are magic numbers. | `done.tsx:26-28` | P2 |

## 10. Bookings list — `app/customer/(tabs)/bookings.tsx`

| Gap | Ref | Sev |
|---|---|---|
| **Navigation dead end.** This is a hidden tab reached from Profile with `router.navigate`. It has no back button, and no tab is highlighted while it is shown. | `bookings.tsx:34-39`; `(tabs)/_layout.tsx:37`; `profile.tsx:51` | P1 |
| Cards show no price, place or duration. Requested bookings show no countdown to expiry. Past bookings have no "Book again". | `bookings.tsx:59-87` | P1 |
| "Rate it" just opens the detail page (same `onPress`) without scrolling to the rating card. | `bookings.tsx:78` | P2 |
| The empty-state line "Find an artist on Explore" has no button. | `bookings.tsx:52` | P2 |
| The card corner radius 18 and padding 14 are literals, as is the "Rate it" chip height of 32. | `bookings.tsx:63,80` | P2 |

## 11. Booking detail — `app/customer/booking/[id].tsx`

| Section | Gap | Ref | Sev |
|---|---|---|---|
| Header | The artist avatar and name are not tappable, so there is no way to reach the storefront. | `booking/[id].tsx:101-107` | P1 |
| Status | There is only a pill: no timeline (Requested → Confirmed → Completed), and no countdown to the 3-hour expiry. | `booking/[id].tsx:100,126-130` | P1 |
| Details | No add-to-calendar, no "Get directions" or map, no artist phone number after confirmation, and no prep notes. | `booking/[id].tsx:108-112` | P1 |
| Pending notice | "3 hours" is hard-coded (X8). | `booking/[id].tsx:128` | P1 |
| Cancel | The confirmation is inline (good) but asks for no reason, and the refund copy hard-codes "72 hours" (X8). Cancel is a secondary button with the same weight as "Change time". | `booking/[id].tsx:63-67,144-152` | P2 |
| Reason | "Reason: …" does not say whether the artist declined or someone cancelled. | `booking/[id].tsx:68,124` | P2 |
| Errors | The error text sits at the very end of a long scroll view and is easy to miss. | `booking/[id].tsx:153` | P2 |
| Missing | No "Report a problem" or help link for this booking, no "Book again", and no pull-to-refresh or polling, so status changes are not visible live. | — | P1 |

### Rate card — `RateBookingCard.tsx`
| Gap | Ref | Sev |
|---|---|---|
| No photo upload, no tags ("On time", "Hygienic"), and no option to edit after posting. | `RateBookingCard.tsx:53-71` | P2 |

## 12. Reschedule — `app/customer/reschedule/[id].tsx`

| Gap | Ref | Sev |
|---|---|---|
| The same 14-day limit applies (§9). There is no note to the artist and no confirmation after a successful request: it simply goes back with no toast. | `reschedule/[id].tsx:50,63` | P2 |
| A booking whose service has been removed gets a "Message the artist instead" message with no button. | `reschedule/[id].tsx:37` | P2 |
| The bottom padding is a literal `140`. | `reschedule/[id].tsx:59` | P2 |

## 13. Chat — `chat/[id].tsx`, `messages.tsx` → `ChatThread.tsx`, `ChatInbox.tsx`

| Section | Gap | Ref | Sev |
|---|---|---|---|
| Header | **The name and avatar are not tappable** (no route to the artist's storefront or to the related booking). The booking tag is plain text. | `ChatHeader.tsx:21-25` | P1 |
| Header | The name is blank while loading, and the back button is 36 px (hitSlop 8 makes it acceptable). | `ChatHeader.tsx:15,18` | P2 |
| Composer | **Photos cannot be sent.** Reference designs are central to mehndi and makeup enquiries. | `ChatComposer.tsx:36-57` | P1 |
| Composer | No quick actions (Book, Request a quote) from inside the chat. | — | P1 |
| Thread | Failed sends have no per-message retry, and there are no read receipts or delivered ticks. | `MessageBubble.tsx:17` | P2 |
| Inbox | The customer inbox has no search (`searchable` defaults to false), and there is no filter for unread chats. | `ChatInbox.tsx:26,45` | P2 |

## 14. Notifications — `app/customer/notifications.tsx` → `NotificationInbox.tsx`

| Gap | Ref | Sev |
|---|---|---|
| Reachable only from Profile, with no badge anywhere (§2, §16). | — | P1 |
| "Mark all read" has no error handling, and a failure is silent. | `NotificationInbox.tsx:36` | P2 |
| Rows with no `link` are still announced as buttons and do nothing on tap. The link is cast with `as Href` without being checked, so a bad link leads to an unmatched route. | `NotificationInbox.tsx:27-30`; `notifications.tsx:7` | P2 |
| No icon per notification type, and no grouping (Today, Earlier). | `NotificationRow.tsx` | P2 |

## 15. Quotes (enquiries)

### New enquiry — `enquiry/new/[artistId].tsx` → `EnquiryForm.tsx`
| Gap | Ref | Sev |
|---|---|---|
| **The event date is picked from a horizontal strip of 60 day chips.** Choosing a date seven weeks out means scrolling through more than 40 chips. Dates beyond 60 days cannot be chosen at all, though weddings are booked months ahead. | `EnquiryForm.tsx:38,67`; `utils/quotes/status.ts:14` | P1 |
| No reference photos, no guest count, no location or venue, and no choice of service type. | `EnquiryForm.tsx:73-91` | P1 |

### My quotes — `CustomerEnquiries.tsx`
| Gap | Ref | Sev |
|---|---|---|
| A quote's "Valid until" date and how soon it expires do not show in the list. | `EnquiryRow.tsx:34` | P2 |

### Enquiry detail — `CustomerEnquiryDetail.tsx`
| Gap | Ref | Sev |
|---|---|---|
| No "Message artist" or "View artist" (a dead end for negotiating). | `CustomerEnquiryDetail.tsx:46-52` | P1 |
| The wording is from the artist's point of view: "What they need" on the customer's own request. | `EnquiryAsk.tsx:18` | P2 |
| No pull-to-refresh, so the customer cannot see a newly arrived quote without leaving the screen. | `CustomerEnquiryDetail.tsx:44` | P2 |

### Accept quote — `AcceptQuote.tsx`
| Gap | Ref | Sev |
|---|---|---|
| No payment or cancellation-policy line before "Confirm booking", though the booking flow shows one. Unlike a normal booking, accepting a quote confirms it immediately, and the screen does not say so. | `AcceptQuote.tsx:100-104` | P1 |
| The day strip starts up to 7 days before the event date, so the selected event day can be off-screen (there is no scroll-into-view). | `QuoteSlotPicker.tsx:25-28` | P2 |

## 16. Profile — `app/customer/(tabs)/profile.tsx`

| Gap | Ref | Sev |
|---|---|---|
| **"Become an artist" switches roles with a single tap** and moves the user into the artist area with no explanation or confirmation. | `profile.tsx:29-39,61-72` | P1 |
| No Terms, Privacy, licences or app version. App stores expect privacy and terms links, and they help trust. | `profile.tsx:49-59` | P1 |
| Menu rows have no icons and no counts (unread messages, notifications, active orders). | `profile.tsx:49-59`; `MenuRow.tsx` | P2 |
| "Log out" asks for no confirmation. | `profile.tsx:75` | P2 |
| The avatar cannot be changed anywhere (Edit profile has no photo). | `EditAccountForm.tsx` | P2 |

## 17. Edit profile — `account.tsx` → `EditAccountForm.tsx`
| Gap | Ref | Sev |
|---|---|---|
| Validation is imperative rather than RHF + zod, which differs from the EnquiryForm pattern. No photo, and no explanation of why the phone number cannot be edited. | `EditAccountForm.tsx:30-46` | P2 |

## 18. Saved — `saved.tsx` → `SavedScreen.tsx`
| Gap | Ref | Sev |
|---|---|---|
| Saved artist cards (`ArtistCardView`) have no unsave control, and there is no pull-to-refresh. | `saved.tsx:30`; `SavedScreen.tsx:69-76` | P2 |
| Saved products use `ProductCard`, whose "+" adds to the cart silently (§5). | `saved.tsx:32` | P2 |
| Opens on the Posts tab. For a booking app, Artists is the more useful default. | `SavedScreen.tsx:36` | P2 |

## 19. Saved addresses — `addresses.tsx` → `SavedAddresses.tsx`
| Gap | Ref | Sev |
|---|---|---|
| The address text cannot be edited (only the label), there is no default address, and no map pin or PIN code. | `SavedAddresses.tsx:43-71` | P2 |
| When the limit of 10 is reached, the "Add" form disappears with no explanation. | `SavedAddresses.tsx:38` | P2 |
| Inline label fields on every card look like a form. They should be read-only rows with Edit and Delete. | `SavedAddresses.tsx:58` | P2 |

## 20. Help & support — `support/index.tsx`, `support/[id].tsx`
| Gap | Ref | Sev |
|---|---|---|
| Only the latest 3 bookings can be chosen, and **shop orders cannot be reported at all**. The two bookings queries' loading and error states are ignored, so the chips silently vanish if they fail. | `support/index.tsx:7,13-18` | P1 |
| After sending, a line saying "Sent" stays on the page indefinitely, and the new ticket is not opened. The 2-hour reply promise is hard-coded. | `HelpSupport.tsx:15,42` | P2 |
| The ticket thread does not auto-scroll to the newest message. There is no phone, WhatsApp or escalation option. | `SupportThread.tsx:36-61` | P2 |
| The FAQ is static, with no search, and has no entry for cancellation or refund policy. | `HelpSupport.tsx:38` | P2 |

---

## Best-in-class additions (Urban Company / Airbnb Experiences benchmark)
1. A persistent **Bookings tab** and a Home card for the next upcoming booking, with live status and countdown.
2. A **cancellation policy and trust strip** on the storefront and service detail ("Free cancellation until…", "Verified ID", "X bookings").
3. A **full calendar date picker** with days that have openings highlighted, a jump to the next free date, and booking up to 60 or more days ahead.
4. A **check that the artist serves the customer's address** before requesting, plus structured addresses with a map pin.
5. **Photo sharing in chat and enquiries**, and quick actions from chat (Book, Quote).
6. A **portfolio lightbox**, filterable reviews with photos, and "Verified booking" tags.
7. **Share** on artists, posts and products, with deep links that keep the filters (URL state).
8. **Notification bell and badges** on Home and the tab bar.
9. A **persisted cart** with delivery fees shown before checkout, and confirmation before cancelling an order.
10. **Book again** and **Recently viewed** rows, and an add-to-calendar action after booking.
