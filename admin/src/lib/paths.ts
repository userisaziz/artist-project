import { generatePath } from 'react-router'

/**
 * Every URL in the admin console. Route definitions (app/routes.tsx) use the patterns;
 * links and navigate() use the patterns for static pages and the builders for detail pages.
 * Never hardcode a path string anywhere else.
 */
export const PATHS = {
  login: '/login',
  overview: '/overview',
  artists: '/artists',
  artistDetail: '/artists/:id',
  artistDirectory: '/artist-directory',
  customServices: '/custom-services',
  bookings: '/bookings',
  bookingDetail: '/bookings/:id',
  reviews: '/reviews',
  categories: '/categories',
  enquiries: '/enquiries',
  customers: '/customers',
  customerDetail: '/customers/:id',
  support: '/support',
  reports: '/reports',
  settings: '/settings',
} as const

/** Where signed-in admins land by default. */
export const HOME_PATH = PATHS.overview

export const artistPath = (id: string): string => generatePath(PATHS.artistDetail, { id })
export const bookingPath = (id: string): string => generatePath(PATHS.bookingDetail, { id })
export const customerPath = (id: string): string => generatePath(PATHS.customerDetail, { id })
