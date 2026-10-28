import { lazy, type ComponentType } from 'react'
import { PATHS } from '@/lib/paths'

// Console pages as per-route chunks. The loaders are shared so the sidebar can fetch a page's code on
// hover/focus (before the click) and the shell can warm the rest once the browser is idle.
const loaders = {
  NotificationsPage: () => import('@/features/notifications/NotificationsPage').then((m) => ({ default: m.NotificationsPage })),
  OverviewPage: () => import('@/features/overview/OverviewPage').then((m) => ({ default: m.OverviewPage })),
  ArtistQueuePage: () => import('@/features/artists/ArtistQueuePage').then((m) => ({ default: m.ArtistQueuePage })),
  ArtistDirectoryPage: () => import('@/features/artists/ArtistDirectoryPage').then((m) => ({ default: m.ArtistDirectoryPage })),
  ArtistReviewPage: () => import('@/features/artists/ArtistReviewPage').then((m) => ({ default: m.ArtistReviewPage })),
  CustomServicesPage: () => import('@/features/custom-services/CustomServicesPage').then((m) => ({ default: m.CustomServicesPage })),
  BookingsPage: () => import('@/features/bookings/BookingsPage').then((m) => ({ default: m.BookingsPage })),
  BookingDetailPage: () => import('@/features/bookings/BookingDetailPage').then((m) => ({ default: m.BookingDetailPage })),
  ReviewsPage: () => import('@/features/reviews/ReviewsPage').then((m) => ({ default: m.ReviewsPage })),
  CustomersPage: () => import('@/features/customers/CustomersPage').then((m) => ({ default: m.CustomersPage })),
  CustomerDetailPage: () => import('@/features/customers/CustomerDetailPage').then((m) => ({ default: m.CustomerDetailPage })),
  ShopProductsPage: () => import('@/features/shop/ShopProductsPage').then((m) => ({ default: m.ShopProductsPage })),
  ShopOrdersPage: () => import('@/features/shop/ShopOrdersPage').then((m) => ({ default: m.ShopOrdersPage })),
  FeedModerationPage: () => import('@/features/feed/FeedModerationPage').then((m) => ({ default: m.FeedModerationPage })),
  SettingsPage: () => import('@/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })),
  ReportsPage: () => import('@/features/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })),
  SupportPage: () => import('@/features/support/SupportPage').then((m) => ({ default: m.SupportPage })),
  SubcategoryRequestsPage: () => import('@/features/subcategory-requests/SubcategoryRequestsPage').then((m) => ({ default: m.SubcategoryRequestsPage })),
  EnquiriesPage: () => import('@/features/enquiries/EnquiriesPage').then((m) => ({ default: m.EnquiriesPage })),
  CategoriesPage: () => import('@/features/categories/CategoriesPage').then((m) => ({ default: m.CategoriesPage })),
} satisfies Record<string, () => Promise<{ default: ComponentType }>>

type PageName = keyof typeof loaders

export const pages = Object.fromEntries(
  Object.entries(loaders).map(([name, load]) => [name, lazy(load)]),
) as { [K in PageName]: ReturnType<typeof lazy<ComponentType>> }

const loaderByPath: Record<string, () => Promise<unknown>> = {
  [PATHS.notifications]: loaders.NotificationsPage,
  [PATHS.overview]: loaders.OverviewPage,
  [PATHS.artists]: loaders.ArtistQueuePage,
  [PATHS.artistDirectory]: loaders.ArtistDirectoryPage,
  [PATHS.artistDetail]: loaders.ArtistReviewPage,
  [PATHS.customServices]: loaders.CustomServicesPage,
  [PATHS.bookings]: loaders.BookingsPage,
  [PATHS.bookingDetail]: loaders.BookingDetailPage,
  [PATHS.reviews]: loaders.ReviewsPage,
  [PATHS.customers]: loaders.CustomersPage,
  [PATHS.customerDetail]: loaders.CustomerDetailPage,
  [PATHS.shopProducts]: loaders.ShopProductsPage,
  [PATHS.shopOrders]: loaders.ShopOrdersPage,
  [PATHS.feed]: loaders.FeedModerationPage,
  [PATHS.settings]: loaders.SettingsPage,
  [PATHS.reports]: loaders.ReportsPage,
  [PATHS.support]: loaders.SupportPage,
  [PATHS.subcategoryRequests]: loaders.SubcategoryRequestsPage,
  [PATHS.enquiries]: loaders.EnquiriesPage,
  [PATHS.categories]: loaders.CategoriesPage,
}

/** Starts downloading a page's code; a no-op once loaded (the module cache keeps it). */
export function preloadPage(path: string) {
  void loaderByPath[path]?.()
}

/** Warms every page chunk, so later navigations never wait on the network for code. */
export function preloadAllPages() {
  for (const load of Object.values(loaders)) void load()
}
