# Atelier hi-fi prototype (reference)

- **`AtelierScreen.dc.html`** — the single design source of truth (630 KB, Claude Design project `78770b42-a64a-4794-a923-399403a73753`).
  It is a template source, not a standalone page: it needs that project's `./support.js` and `./image-slot.js`
  (and `assets/hero/*` photos) beside it to render. Handy for reading exact markup, colours and copy.

To check a screen: open the file in the design project (or with its `support.js` local), pick it in the left rail;
compare against the app rendered at 393×852. The rail also has Back / Next navigation, and an iOS / Android toggle.

## Screen showcase — 75 screens

Every screen is a `show.<key>` block in `AtelierScreen.dc.html`, grouped by the HTML section comments
(Auth 5 · Customer 19 · Artist onboarding 6 · Artist app 40 · Admin console 5).

### Auth (5)
| key | screen |
| --- | --- |
| `welcome` | ATELIER — "Discover your artist." hero + Get started |
| `login` | Log in / Sign up — phone number entry |
| `otp` | Verify — 6-digit code, SMS autofill keyboard |
| `signup` | Your details — name + email |
| `role` | Choose role — For clients / Artists |

### Customer (19)
| key | screen |
| --- | --- |
| `home` | Home — greeting, nearby artists, location / city share |
| `feed` | Feed — For you / Following / Videos / Stories & guides |
| `post` | Post detail — guide article, "Book this look" |
| `shop` | Shop — marketplace search and categories |
| `product` | Product detail — henna cones, rating, price |
| `cart` | Cart — multi-artist items |
| `checkout` | Checkout — address, payment |
| `orderDone` | Order placed — confirmation timeline |
| `orders` | My orders — list with status |
| `search` | Search — recent / trending / suggestions |
| `explore` | Explore — filters (near me, date, price) |
| `artist` | Artist profile — verified badge, portfolio, services |
| `service` | Service detail — pricing, artist link |
| `book` | Book appointment — step 1 of 3 (calendar) |
| `review` | Review & pay — step 3 of 3 |
| `done` | Request sent — awaiting artist |
| `bookings` | My bookings — upcoming / past |
| `chat` | Chat — thread with quote card |
| `profile` | Customer profile — following, saved posts |

### Artist onboarding (6)
| key | screen |
| --- | --- |
| `onbIntro` | Intro — "Show your work to clients near you" |
| `onbProfile` | Step 1 of 9 — profile |
| `onbLocation` | Step 2 of 9 — studio location |
| `onbId` | Step 3 of 9 — Aadhaar identity |
| `onbPortfolio` | Step 4 of 9 — portfolio |
| `onbDone` | In review — submitted confirmation |

### Artist app (40)
| key | screen |
| --- | --- |
| `aDash` | Dashboard — earnings, plans |
| `aBookings` | Bookings — requests / upcoming / past |
| `aBookDetail` | Booking detail — full record |
| `aCal` | Calendar — month view, block dates |
| `aMsgs` | Messages — clients and enquiries |
| `aEnquiries` | Enquiries — empty state |
| `aEnquiry` | Enquiry — send ₹ quote / decline |
| `aEarnings` | Earnings & payouts — next payout, UPI |
| `aArea` | Service area & hours — travel radius, weekly hours |
| `aPortfolio` | Portfolio — grid, add work |
| `aReviews` | Reviews — rating summary, replies |
| `aServices` | My services — list, review queue |
| `aServiceNew` | New service — creation form |
| `aServiceEdit` | Edit service — with admin note |
| `aAdvance` | Payments & cancellation — advance, policy |
| `aMe` | Artist profile (self) — stats and links |
| `aPost` | New post — photos, caption |
| `aShop` | My shop — sales summary, products |
| `aProduct` | New product — draft form |
| `aFollowers` | Followers — count and growth |
| `aPlan` | My plan — current subscription |
| `aPlans` | Plans — monthly / yearly pricing |
| `aCheckout` | Plan checkout — coupon (FESTIVE20) |
| `aSubDone` | Subscription confirmed |
| `aBilling` | Billing — UPI mandate, invoices |
| `aCancel` | Cancel / change plan |
| `onbFix` | Changes needed — rejected onboarding fields |
| `feedSearch` | Feed search — recent / trending / artists / tags |
| `following` | Following list |
| `saved` | Saved posts |
| `cBooking` | Your booking (client view) |
| `cReview` | Review the experience |
| `cEnquiries` | My enquiries (client view) |
| `cEnquiry` | Enquiry detail — quote acceptance |
| `cNotifs` | Notifications — mark all read |
| `cHelp` | Support — FAQ, report a problem |
| `cAddr` | Saved addresses |
| `cPay` | Payment methods — UPI IDs |
| `cTrack` | Track order — shipment timeline |
| `cCoupon` | Apply coupon |

### Admin console (5)
| key | screen |
| --- | --- |
| `adLogin` | Admin login |
| `adOverview` | Overview — gross bookings, KPIs |
| `adVerify` | Artist verification queue |
| `adKyc` | KYC detail — Aadhaar approve / reject, SLA |
| `adPlans` | Subscription plans & MRR |

## Asset mapping

Welcome / Choose role photos: `mobile/assets/hero/welcome.webp`, `role-customer.webp`, `role-artist.webp`
are the design project's `assets/hero/welcome2.jpg`, `role-client.jpg`, `role-creator.jpg` (v4 screens),
re-encoded as webp. The Home carousel photos (mehendi hands, makeup, 1200×800 JPEG) map to
`mobile/assets/hero/home-bridal.webp` and `home-makeup.webp`.
