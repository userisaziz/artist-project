import type { AdminBooking, AdminCategory, AdminKyc, AdminOverview, AdminReview, ArtistDetail, CustomServiceItem, ServiceTemplate, User } from '@/lib/types'
import { API_URL } from '@/lib/api'

// A tiny in-memory backend behind fetch: just enough of the API contract for these flows.
export const ADMIN: User = { id: 'u-admin', phone: '+919845000001', roles: ['admin'], active_role: null, first_name: 'Neha', last_name: 'Menon', email: null }

// Generated Aadhaar number (not a real person's): 234123412346, so the masked form ends 2346.
export const KYC: AdminKyc = {
  aadhaar_masked: '•••• •••• 2346',
  front_url: 'https://fake.storage/private/artists/u-1/aadhaar/front.jpg?expires_at=1',
  back_url: 'https://fake.storage/private/artists/u-1/aadhaar/back.jpg?expires_at=1',
}

export function artist(overrides: Partial<ArtistDetail> = {}): ArtistDetail {
  return {
    id: 'a-1', status: 'pending', business_name: 'Ayesha Mehendi Art', city: 'Bangalore', bio: null, photo_url: null,
    categories: [{ id: 1, slug: 'mehendi', name: 'Mehendi' }],
    services: [{ id: 's-1', category_id: 1, subcategory_id: 1, template_id: null, name: 'Bridal Classic', price_paise: 550000, duration_minutes: 180, description: null, status: 'approved', rejection_reason: null }],
    photos: [], kyc: KYC, rejection_reason: null, submitted_at: '2026-10-10T09:41:00Z', reviewed_at: null,
    owner: { id: 'u-1', phone: '+919845011111', first_name: 'Ayesha', last_name: null, email: null },
    ...overrides,
  }
}

export const category = (overrides: Partial<AdminCategory> & Pick<AdminCategory, 'id' | 'name'>): AdminCategory => ({
  slug: overrides.name.toLowerCase(), sort_order: 0, status: 'active', parent_id: null,
  artist_count: 0, service_count: 0, child_count: 0, template_count: 0, ...overrides,
})

export function customService(overrides: Partial<CustomServiceItem> = {}): CustomServiceItem {
  return {
    id: 'cs-1', artist_id: 'a-1', business_name: 'Ayesha Mehendi Art', category: { id: 1, name: 'Mehendi' }, subcategory: { id: 2, name: 'Bridal' },
    name: 'Glitter mehendi', price_paise: 150000, duration_minutes: 60, description: 'Gold glitter accents', status: 'pending',
    rejection_reason: null, created_at: '2026-10-12T09:00:00Z', ...overrides,
  }
}

// ₹5,500 service + ₹99 fee = ₹5,599; 30% deposit ₹1,680, balance ₹3,919; 10% commission ₹550, so the artist earns ₹4,950.
export function booking(overrides: Partial<AdminBooking> = {}): AdminBooking {
  return {
    id: 'b-1', code: 'BK-7F3K2Q', status: 'requested', start_at: '2026-10-20T05:30:00Z', end_at: '2026-10-20T08:30:00Z',
    address: '12 Residency Road, Bangalore', note: 'Gate code 4512', service_name: 'Bridal Classic', duration_minutes: 180,
    artist: { id: 'a-1', business_name: 'Ayesha Mehendi Art', photo_url: null, city: 'Bangalore' },
    customer: { id: 'u-9', first_name: 'Priya', last_name: 'Rao', phone: '+919845022222' },
    subtotal_paise: 550000, platform_fee_paise: 9900, total_paise: 559900, deposit_paise: 168000, balance_paise: 391900,
    commission_paise: 55000, artist_earning_paise: 495000, deposit_paid_at: '2026-10-17T04:12:00Z', expires_at: '2026-10-17T07:11:00Z',
    responded_at: null, cancelled_at: null, completed_at: null,
    decline_reason: null, cancel_reason: null, cancelled_by: null, refund_due: null, created_at: '2026-10-17T04:11:00Z', ...overrides,
  }
}

export function review(overrides: Partial<AdminReview> = {}): AdminReview {
  return {
    id: 'r-1', rating: 2, text: 'Half the flowers were missing and the stage was set up two hours late.', reviewer_name: 'Priya R.',
    service_name: 'Bridal Classic', created_at: '2026-10-14T09:00:00Z', reply: 'We are sorry, the supplier let us down.', replied_at: '2026-10-15T09:00:00Z',
    status: 'flagged', flag: 'artist_report', report_reason: 'This customer never booked this service', moderator_note: null, moderated_at: null,
    artist: { id: 'a-1', business_name: 'Ayesha Mehendi Art' }, customer: { id: 'u-9', name: 'Priya Rao', phone: '+919845022222' },
    booking: { id: 'b-1', code: 'BK-7F3K2Q', service_name: 'Bridal Classic' }, ...overrides,
  }
}

export const OVERVIEW: AdminOverview = {
  period_days: 30, gross_paise: 426000000, gross_paise_previous: 379000000, bookings: 1284, bookings_previous: 1188,
  completed: 902, cancelled: 22, new_artists: 86, awaiting_artist: 42, cities: ['Bangalore', 'Mumbai'],
  pending_artists: 1, pending_custom_services: 0, flagged_reviews: 3,
  bookings_by_week: Array.from({ length: 12 }, (_, i) => ({ week_start: new Date(Date.UTC(2026, 6, 27 + 7 * i)).toISOString().slice(0, 10), count: 10 + i })),
}

/** How POST /auth/refresh misbehaves: a dropped connection, or an HTTP status (401, 429, 503...). */
export type RefreshFailure = 'network' | number

export interface Db {
  categories: AdminCategory[]; templates: ServiceTemplate[]; customServices: CustomServiceItem[]; artist: ArtistDetail
  bookings: AdminBooking[]; reviews: AdminReview[]; overview: AdminOverview; me: User
  /** The httpOnly `ac_refresh` cookie the browser holds for /api/v1/auth (null: none). JS in the app never sees it. */
  refreshCookie: string | null
  /** When set, /auth/refresh fails this way instead of reading the cookie. */
  refreshFailure: RefreshFailure | null
  /** When set, /auth/refresh waits for this promise before answering (to observe the restoring state). */
  holdRefresh: Promise<void> | null
  /** When true, POST /auth/logout drops the connection. */
  logoutFails: boolean
  /** When true, every non-auth endpoint answers 401 (the access token was revoked or expired). */
  accessRevoked: boolean
  /** Ad-hoc handlers by path, checked before the built-in routes. */
  overrides: Record<string, () => Response>
}

/** One request as the server saw it; `calls` keeps the {method, path, body} shape the flows assert on. */
export interface FakeRequest { method: string; path: string; body: unknown; headers: Record<string, string>; credentials: RequestCredentials | undefined }

export let db: Db
export let calls: { method: string; path: string; body: unknown }[]
export let requests: FakeRequest[]

export const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const AUTH_ERROR = { code: 'auth_error', message: 'Not signed in' }

/** The cookie contract: X-Session-Transport + credentials: 'include' → HttpOnly cookie set, refresh_token null in the body. */
function authRoute(req: FakeRequest): Response | null {
  const usesCookie = req.credentials === 'include' && ['cookie', 'cookie-session'].includes(req.headers['x-session-transport'])
  const pair = (user: User) => ({ access_token: 'access', refresh_token: usesCookie ? null : 'refresh', token_type: 'bearer', user })
  if (req.method !== 'POST') return null
  if (req.path === '/auth/otp/request') return json(204)
  if (req.path === '/auth/otp/verify') {
    if (usesCookie) db.refreshCookie = 'refresh-1'
    return json(200, pair(db.me))
  }
  if (req.path === '/auth/refresh') {
    if (typeof db.refreshFailure === 'number') return json(db.refreshFailure, { code: 'unavailable', message: 'Try again later' })
    if (!usesCookie || !db.refreshCookie || req.body !== undefined) return json(401, AUTH_ERROR)
    return json(200, pair(db.me))
  }
  if (req.path === '/auth/logout') {
    if (req.credentials === 'include') db.refreshCookie = null
    return json(204)
  }
  return null
}

function route(method: string, path: string, body: any): Response {
  if (method === 'GET' && path === '/users/me') return json(200, db.me)
  if (method === 'GET' && path === '/admin/categories') return json(200, db.categories)
  if (method === 'POST' && path === '/admin/categories') {
    const created: AdminCategory = { id: db.categories.length + 1, slug: body.name.toLowerCase(), name: body.name, sort_order: db.categories.length, status: body.status, parent_id: body.parent_id ?? null, artist_count: 0, service_count: 0, child_count: 0, template_count: 0 }
    db.categories = db.categories.map((c) => (c.id === created.parent_id ? { ...c, child_count: c.child_count + 1 } : c))
    db.categories.push(created)
    return json(201, created)
  }
  if (method === 'GET' && path.startsWith('/admin/service-templates?')) {
    const sub = Number(new URLSearchParams(path.split('?')[1]).get('subcategory_id'))
    return json(200, db.templates.filter((t) => t.subcategory_id === sub))
  }
  if (method === 'POST' && path === '/admin/service-templates') {
    const created: ServiceTemplate = { id: 100 + db.templates.length, subcategory_id: body.subcategory_id, name: body.name, description: body.description, sort_order: db.templates.length, is_active: body.is_active, artist_count: 0 }
    db.templates.push(created)
    return json(201, created)
  }
  if (method === 'GET' && path.startsWith('/admin/custom-services?')) {
    const status = new URLSearchParams(path.split('?')[1]).get('status')
    return json(200, { items: db.customServices.filter((s) => s.status === status), next_cursor: null })
  }
  const decided = path.match(/^\/admin\/custom-services\/([^/]+)\/(approve|reject)$/)
  if (method === 'POST' && decided) {
    const [, id, action] = decided
    const item = db.customServices.find((s) => s.id === id)
    if (!item) return json(404, { code: 'not_found', message: 'Custom service not found' })
    const next = { ...item, status: action === 'approve' ? 'approved' : 'rejected', rejection_reason: action === 'reject' ? body.reason : null } as CustomServiceItem
    db.customServices = db.customServices.map((s) => (s.id === id ? next : s))
    return json(200, next)
  }
  if (method === 'GET' && path.startsWith('/admin/artists?')) {
    const status = new URLSearchParams(path.split('?')[1]).get('status')
    const a = db.artist
    const items = a.status === status ? [{ ...a, categories: a.categories.map((c) => c.name), service_count: a.services.length, photo_count: a.photos.length }] : []
    return json(200, { items, next_cursor: null })
  }
  if (method === 'GET' && path === `/admin/artists/${db.artist.id}`) return json(200, db.artist)
  if (method === 'POST' && path === `/admin/artists/${db.artist.id}/approve`) {
    db.artist = { ...db.artist, status: 'approved', reviewed_at: '2026-10-10T10:00:00Z' }
    return json(200, db.artist)
  }
  if (method === 'POST' && path === `/admin/artists/${db.artist.id}/reject`) {
    db.artist = { ...db.artist, status: 'rejected', rejection_reason: body.reason }
    return json(200, db.artist)
  }
  if (method === 'POST' && path === `/admin/artists/${db.artist.id}/kyc/reveal`) {
    return db.artist.kyc ? json(200, { aadhaar_number: '234123412346' }) : json(404, { code: 'not_found', message: 'No Aadhaar on file' })
  }
  if (method === 'GET' && path.split('?')[0] === '/admin/overview') return json(200, db.overview)
  if (method === 'GET' && path.startsWith('/admin/bookings?')) {
    const query = new URLSearchParams(path.split('?')[1])
    const status = query.get('status')
    const q = query.get('q')?.toLowerCase()
    const limit = Number(query.get('limit') ?? 20)
    const start = Number(query.get('cursor') ?? 0)
    const matches = db.bookings.filter((b) =>
      (!status || b.status === status) &&
      (!q || [b.code, b.customer.phone, b.artist.business_name].some((field) => field.toLowerCase().includes(q))))
    const end = start + limit
    return json(200, { items: matches.slice(start, end), next_cursor: end < matches.length ? String(end) : null })
  }
  const bookingPath = path.match(/^\/admin\/bookings\/([^/]+)(\/cancel)?$/)
  if (bookingPath) {
    const [, id, cancel] = bookingPath
    const found = db.bookings.find((b) => b.id === id)
    if (!found) return json(404, { code: 'not_found', message: 'Booking not found' })
    if (method === 'GET' && !cancel) return json(200, found)
    if (method === 'POST' && cancel) {
      if (found.status !== 'requested' && found.status !== 'confirmed') return json(409, { code: 'conflict', message: `This booking is already ${found.status}` })
      const next: AdminBooking = { ...found, status: 'cancelled', cancel_reason: body.reason, cancelled_by: 'admin', refund_due: true, cancelled_at: '2026-10-17T05:00:00Z' }
      db.bookings = db.bookings.map((b) => (b.id === id ? next : b))
      return json(200, next)
    }
  }
  if (method === 'GET' && path.startsWith('/admin/reviews?')) {
    const query = new URLSearchParams(path.split('?')[1])
    const limit = Number(query.get('limit') ?? 20)
    const start = Number(query.get('cursor') ?? 0)
    const matches = db.reviews.filter((r) => r.status === query.get('status'))
    const end = start + limit
    return json(200, { items: matches.slice(start, end), next_cursor: end < matches.length ? String(end) : null })
  }
  const decision = path.match(/^\/admin\/reviews\/([^/]+)\/decision$/)
  if (method === 'POST' && decision) {
    const found = db.reviews.find((r) => r.id === decision[1])
    if (!found) return json(404, { code: 'not_found', message: 'Review not found' })
    if (found.status === 'removed') return json(409, { code: 'conflict', message: 'This review was removed' })
    const status = ({ publish: 'published', hide: 'hidden', remove: 'removed' } as const)[body.decision as 'publish' | 'hide' | 'remove']
    const next: AdminReview = { ...found, status, flag: status === 'published' ? null : found.flag, moderator_note: body.note ?? null, moderated_at: '2026-10-17T06:00:00Z' }
    db.reviews = db.reviews.map((r) => (r.id === found.id ? next : r))
    return json(200, next)
  }
  return json(404, { code: 'not_found', message: `No fake route for ${method} ${path}` })
}

const headersOf = (init: RequestInit): Record<string, string> =>
  Object.fromEntries(Object.entries((init.headers ?? {}) as Record<string, string>).map(([k, v]) => [k.toLowerCase(), v]))

/** Fresh fake data, and a fetch stub that routes every request to it. Call from beforeEach. */
export function installFakeBackend(): void {
  db = {
    categories: [], templates: [], customServices: [], artist: artist(), bookings: [], reviews: [], overview: OVERVIEW, me: ADMIN,
    refreshCookie: null, refreshFailure: null, holdRefresh: null, logoutFails: false, accessRevoked: false, overrides: {},
  }
  calls = []
  requests = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
    const path = url.slice(API_URL.length)
    const method = init.method ?? 'GET'
    const body = init.body ? JSON.parse(String(init.body)) : undefined
    const req: FakeRequest = { method, path, body, headers: headersOf(init), credentials: init.credentials }
    calls.push({ method, path, body })
    requests.push(req)
    if (path === '/auth/refresh') {
      if (db.holdRefresh) await db.holdRefresh
      if (db.refreshFailure === 'network') throw new TypeError('Failed to fetch')
    }
    if (path === '/auth/logout' && db.logoutFails) throw new TypeError('Failed to fetch')
    const override = db.overrides[path]
    if (override) return override()
    if (db.accessRevoked && !path.startsWith('/auth/')) return json(401, AUTH_ERROR)
    return authRoute(req) ?? route(method, path, body)
  }))
}
