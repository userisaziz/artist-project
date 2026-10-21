import { PATHS } from '@/lib/paths'

/** Which live figure, if any, sits beside a sidebar item (AppShell resolves each one). */
export type NavCount = 'unreadNotifications' | 'heldEnquiries' | 'pendingSubcategories' | 'pendingArtists' | 'artistsTotal' | 'bookings30d' | 'flaggedReviews' | 'pendingCustomServices'

export interface NavItem {
  to: string
  label: string
  count?: NavCount
  /** Verification shows its count as a pink pill; every other count is plain grey text. */
  pill?: boolean
}

/**
 * The console sidebar, top to bottom, in the design's order
 * (Overview, Verification, Artists, Customers, Bookings, Reviews, Shop, Feed, Catalog, Subcategories,
 * Enquiries, Support, Reports, Settings). New pages add their entry at their design position.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { to: PATHS.overview, label: 'Overview' },
  { to: PATHS.notifications, label: 'Notifications', count: 'unreadNotifications', pill: true },
  { to: PATHS.artists, label: 'Verification', count: 'pendingArtists', pill: true },
  { to: PATHS.artistDirectory, label: 'Artists', count: 'artistsTotal' },
  { to: PATHS.customers, label: 'Customers' },
  { to: PATHS.bookings, label: 'Bookings', count: 'bookings30d' },
  { to: PATHS.reviews, label: 'Reviews', count: 'flaggedReviews' },
  { to: PATHS.shopProducts, label: 'Shop · Products' },
  { to: PATHS.shopOrders, label: 'Shop · Orders' },
  { to: PATHS.feed, label: 'Feed' },
  { to: PATHS.categories, label: 'Catalog' },
  { to: PATHS.subcategoryRequests, label: 'Subcategories', count: 'pendingSubcategories' },
  { to: PATHS.customServices, label: 'Custom services', count: 'pendingCustomServices' },
  { to: PATHS.enquiries, label: 'Enquiries', count: 'heldEnquiries' },
  { to: PATHS.support, label: 'Support' },
  { to: PATHS.reports, label: 'Reports' },
  { to: PATHS.settings, label: 'Settings' },
]
