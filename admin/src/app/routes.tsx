import { Navigate, Route, Routes } from 'react-router'
import { GuestOnly, RequireAuth } from '@/app/guards'
import { AppShell } from '@/app/layout/AppShell'
import { pages } from '@/app/page-chunks'
import { RouteErrorBoundary } from '@/components/route-error-boundary'
import { LoginPage } from '@/features/auth/LoginPage'
import { HOME_PATH, PATHS } from '@/lib/paths'

/**
 * Public routes sit behind GuestOnly; everything else needs an admin session and renders inside the shell.
 * Each region has its own error boundary: the login page here, console pages inside AppShell (reset on navigation).
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<GuestOnly />}>
        <Route path={PATHS.login} element={<RouteErrorBoundary fullPage><LoginPage /></RouteErrorBoundary>} />
      </Route>

      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to={HOME_PATH} replace />} />
          <Route path={PATHS.overview} element={<pages.OverviewPage />} />
          <Route path={PATHS.artists} element={<pages.ArtistQueuePage />} />
          <Route path={PATHS.artistDetail} element={<pages.ArtistReviewPage />} />
          <Route path={PATHS.artistDirectory} element={<pages.ArtistDirectoryPage />} />
          <Route path={PATHS.customServices} element={<pages.CustomServicesPage />} />
          <Route path={PATHS.bookings} element={<pages.BookingsPage />} />
          <Route path={PATHS.bookingDetail} element={<pages.BookingDetailPage />} />
          <Route path={PATHS.reviews} element={<pages.ReviewsPage />} />
          <Route path={PATHS.categories} element={<pages.CategoriesPage />} />
          <Route path={PATHS.enquiries} element={<pages.EnquiriesPage />} />
          <Route path={PATHS.subcategoryRequests} element={<pages.SubcategoryRequestsPage />} />
          <Route path={PATHS.notifications} element={<pages.NotificationsPage />} />
          <Route path={PATHS.broadcasts} element={<pages.BroadcastsPage />} />
          <Route path={PATHS.customers} element={<pages.CustomersPage />} />
          <Route path={PATHS.customerDetail} element={<pages.CustomerDetailPage />} />
          <Route path={PATHS.support} element={<pages.SupportPage />} />
          <Route path={PATHS.reports} element={<pages.ReportsPage />} />
          <Route path={PATHS.settings} element={<pages.SettingsPage />} />
          <Route path={PATHS.feed} element={<pages.FeedModerationPage />} />
          <Route path={PATHS.shopProducts} element={<pages.ShopProductsPage />} />
          <Route path={PATHS.shopOrders} element={<pages.ShopOrdersPage />} />
          <Route path="*" element={<Navigate to={HOME_PATH} replace />} />
        </Route>
      </Route>
    </Routes>
  )
}
