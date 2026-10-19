import { lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { GuestOnly, RequireAuth } from '@/app/guards'
import { AppShell } from '@/app/layout/AppShell'
import { RouteErrorBoundary } from '@/components/route-error-boundary'
import { LoginPage } from '@/features/auth/LoginPage'
import { HOME_PATH, PATHS } from '@/lib/paths'

// Console pages split into per-route chunks, loaded on navigation (AppShell's Suspense covers the fallback).
const OverviewPage = lazy(() => import('@/features/overview/OverviewPage').then(m => ({ default: m.OverviewPage })))
const ArtistQueuePage = lazy(() => import('@/features/artists/ArtistQueuePage').then(m => ({ default: m.ArtistQueuePage })))
const ArtistDirectoryPage = lazy(() => import('@/features/artists/ArtistDirectoryPage').then(m => ({ default: m.ArtistDirectoryPage })))
const ArtistReviewPage = lazy(() => import('@/features/artists/ArtistReviewPage').then(m => ({ default: m.ArtistReviewPage })))
const CustomServicesPage = lazy(() => import('@/features/custom-services/CustomServicesPage').then(m => ({ default: m.CustomServicesPage })))
const BookingsPage = lazy(() => import('@/features/bookings/BookingsPage').then(m => ({ default: m.BookingsPage })))
const BookingDetailPage = lazy(() => import('@/features/bookings/BookingDetailPage').then(m => ({ default: m.BookingDetailPage })))
const ReviewsPage = lazy(() => import('@/features/reviews/ReviewsPage').then(m => ({ default: m.ReviewsPage })))
const CustomersPage = lazy(() => import('@/features/customers/CustomersPage').then(m => ({ default: m.CustomersPage })))
const CustomerDetailPage = lazy(() => import('@/features/customers/CustomerDetailPage').then(m => ({ default: m.CustomerDetailPage })))
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage').then(m => ({ default: m.SettingsPage })))
const ReportsPage = lazy(() => import('@/features/reports/ReportsPage').then(m => ({ default: m.ReportsPage })))
const SupportPage = lazy(() => import('@/features/support/SupportPage').then(m => ({ default: m.SupportPage })))
const EnquiriesPage = lazy(() => import('@/features/enquiries/EnquiriesPage').then(m => ({ default: m.EnquiriesPage })))
const CategoriesPage = lazy(() => import('@/features/categories/CategoriesPage').then(m => ({ default: m.CategoriesPage })))

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
          <Route path={PATHS.overview} element={<OverviewPage />} />
          <Route path={PATHS.artists} element={<ArtistQueuePage />} />
          <Route path={PATHS.artistDetail} element={<ArtistReviewPage />} />
          <Route path={PATHS.artistDirectory} element={<ArtistDirectoryPage />} />
          <Route path={PATHS.customServices} element={<CustomServicesPage />} />
          <Route path={PATHS.bookings} element={<BookingsPage />} />
          <Route path={PATHS.bookingDetail} element={<BookingDetailPage />} />
          <Route path={PATHS.reviews} element={<ReviewsPage />} />
          <Route path={PATHS.categories} element={<CategoriesPage />} />
          <Route path={PATHS.enquiries} element={<EnquiriesPage />} />
          <Route path={PATHS.customers} element={<CustomersPage />} />
          <Route path={PATHS.customerDetail} element={<CustomerDetailPage />} />
          <Route path={PATHS.support} element={<SupportPage />} />
          <Route path={PATHS.reports} element={<ReportsPage />} />
          <Route path={PATHS.settings} element={<SettingsPage />} />
          <Route path="*" element={<Navigate to={HOME_PATH} replace />} />
        </Route>
      </Route>
    </Routes>
  )
}
