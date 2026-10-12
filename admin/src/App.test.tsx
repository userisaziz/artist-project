import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { createQueryClient } from './lib/query-client'
import { API_URL } from './lib/api'
import type { AdminCategory, AdminKyc, ArtistDetail, User } from './lib/types'

// A tiny in-memory backend behind fetch: just enough of the API contract for these flows.
const ADMIN: User = { id: 'u-admin', phone: '+919845000001', roles: ['admin'], active_role: null, first_name: 'Neha', last_name: 'Menon', email: null }

// Generated Aadhaar number (not a real person's): 234123412346, so the masked form ends 2346.
const KYC: AdminKyc = {
  aadhaar_masked: '•••• •••• 2346',
  front_url: 'https://fake.storage/private/artists/u-1/aadhaar/front.jpg?expires_at=1',
  back_url: 'https://fake.storage/private/artists/u-1/aadhaar/back.jpg?expires_at=1',
}

function artist(overrides: Partial<ArtistDetail> = {}): ArtistDetail {
  return {
    id: 'a-1', status: 'pending', business_name: 'Ayesha Mehendi Art', city: 'Bangalore', bio: null, photo_url: null,
    categories: [{ id: 1, slug: 'mehendi', name: 'Mehendi' }],
    services: [{ id: 's-1', category_id: 1, name: 'Bridal Classic', price_paise: 550000, duration_minutes: 180, description: null }],
    photos: [], kyc: KYC, rejection_reason: null, submitted_at: '2026-10-10T09:41:00Z', reviewed_at: null,
    owner: { id: 'u-1', phone: '+919845011111', first_name: 'Ayesha', last_name: null, email: null },
    ...overrides,
  }
}

interface Db { categories: AdminCategory[]; artist: ArtistDetail; me: User }
let db: Db
let calls: { method: string; path: string; body: unknown }[]

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function route(method: string, path: string, body: any): Response {
  const pair = (user: User) => ({ access_token: 'access', refresh_token: 'refresh', token_type: 'bearer', user })
  if (method === 'POST' && path === '/auth/otp/request') return json(204)
  if (method === 'POST' && path === '/auth/otp/verify') return json(200, pair(db.me))
  if (method === 'POST' && path === '/auth/refresh') return json(200, pair(db.me))
  if (method === 'GET' && path === '/users/me') return json(200, db.me)
  if (method === 'GET' && path === '/admin/categories') return json(200, db.categories)
  if (method === 'POST' && path === '/admin/categories') {
    const created: AdminCategory = { id: db.categories.length + 1, slug: body.name.toLowerCase(), name: body.name, sort_order: db.categories.length, is_active: body.is_active, artist_count: 0, service_count: 0 }
    db.categories.push(created)
    return json(201, created)
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
  return json(404, { code: 'not_found', message: `No fake route for ${method} ${path}` })
}

beforeEach(() => {
  db = { categories: [], artist: artist(), me: ADMIN }
  calls = []
  localStorage.clear()
  sessionStorage.clear()
  window.history.pushState({}, '', '/')
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
    const path = url.slice(API_URL.length)
    const method = init.method ?? 'GET'
    const body = init.body ? JSON.parse(String(init.body)) : undefined
    calls.push({ method, path, body })
    return route(method, path, body)
  }))
})
afterEach(() => vi.unstubAllGlobals())

const renderApp = (path = '/') => {
  window.history.pushState({}, '', path)
  return render(<App queryClient={createQueryClient()} />)
}

/** Start signed in: a stored refresh token restores the admin session on load. */
const renderSignedIn = (path: string) => {
  localStorage.setItem('atelier-admin.refresh', 'refresh')
  return renderApp(path)
}

it('signs an admin in with phone + code and opens Verification', async () => {
  const user = userEvent.setup()
  renderApp()
  await user.type(await screen.findByLabelText('Phone number'), '98450 00001')
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
  expect(await screen.findByText('We texted a 6-digit code to +91 98450 00001.')).toBeInTheDocument()
  await user.keyboard('123456')
  expect(await screen.findByRole('heading', { name: 'Verification' })).toBeInTheDocument()
  expect(calls).toContainEqual({ method: 'POST', path: '/auth/otp/verify', body: { phone: '+919845000001', code: '123456' } })
  expect(localStorage.getItem('atelier-admin.refresh')).toBe('refresh') // "Keep me signed in" is on by default
})

it('without "Keep me signed in" the session lasts only for this browser session', async () => {
  const user = userEvent.setup()
  renderApp()
  await user.type(await screen.findByLabelText('Phone number'), '9845000001')
  await user.click(screen.getByLabelText('Keep me signed in on this device'))
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
  await screen.findByText(/We texted a 6-digit code/)
  await user.keyboard('123456')
  await screen.findByRole('heading', { name: 'Verification' })
  expect(localStorage.getItem('atelier-admin.refresh')).toBeNull()
  expect(sessionStorage.getItem('atelier-admin.refresh')).toBe('refresh')
})

it('refuses a non-admin account and stores no session', async () => {
  db.me = { ...ADMIN, roles: ['artist'], active_role: 'artist' }
  const user = userEvent.setup()
  renderApp()
  await user.click(await screen.findByRole('button', { name: 'Sign in' }))
  expect(await screen.findByText('Enter your 10-digit mobile number.')).toBeInTheDocument()
  await user.type(screen.getByLabelText('Phone number'), '9845011111')
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
  await screen.findByText(/We texted a 6-digit code/)
  await user.keyboard('123456')
  expect(await screen.findByText("This account isn't an admin.")).toBeInTheDocument()
  expect(localStorage.getItem('atelier-admin.refresh')).toBeNull()
  expect(sessionStorage.getItem('atelier-admin.refresh')).toBeNull()
})

it('creates the first category from the empty Catalog', async () => {
  const user = userEvent.setup()
  renderSignedIn('/categories')
  expect(await screen.findByText('No categories yet')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /New category/ }))
  const dialog = await screen.findByRole('dialog')
  await user.click(within(dialog).getByRole('button', { name: 'Create category' }))
  expect(await within(dialog).findByText('Name is required')).toBeInTheDocument()

  await user.type(within(dialog).getByLabelText('Name'), 'Mehendi')
  await user.click(within(dialog).getByRole('button', { name: 'Create category' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(await screen.findByRole('cell', { name: 'Mehendi' })).toBeInTheDocument()
  expect(calls).toContainEqual({ method: 'POST', path: '/admin/categories', body: { name: 'Mehendi', is_active: true } })
})

it('lists a pending artist and approves them', async () => {
  const user = userEvent.setup()
  renderSignedIn('/artists')
  await user.click(await screen.findByText('Ayesha Mehendi Art'))
  expect(await screen.findByText('Bridal Classic')).toBeInTheDocument()
  expect(screen.getByText('₹5,500')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Approve' }))
  expect(await screen.findByText('Approved')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
})

it('rejecting needs a reason, then shows it', async () => {
  const user = userEvent.setup()
  renderSignedIn('/artists/a-1')
  await user.click(await screen.findByRole('button', { name: 'Reject' }))
  const dialog = await screen.findByRole('dialog')
  await user.click(within(dialog).getByRole('button', { name: 'Reject' }))
  expect(within(dialog).getByText('Tell the artist what to fix.')).toBeInTheDocument()
  expect(calls.some((c) => c.path.endsWith('/reject'))).toBe(false)

  await user.type(within(dialog).getByLabelText('What needs fixing'), 'Photos are blurry')
  await user.click(within(dialog).getByRole('button', { name: 'Reject' }))
  expect(await screen.findByText('Photos are blurry')).toBeInTheDocument()
  expect(calls).toContainEqual({ method: 'POST', path: '/admin/artists/a-1/reject', body: { reason: 'Photos are blurry' } })
})

it('shows the masked Aadhaar above Services, and both card photos open full size', async () => {
  const user = userEvent.setup()
  renderSignedIn('/artists/a-1')
  expect(await screen.findByText('•••• •••• 2346')).toBeInTheDocument()
  expect(screen.getByText('Reveals are logged.')).toBeInTheDocument()
  expect(screen.getByText('Identity (Aadhaar)').compareDocumentPosition(screen.getByText('Services · 1')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(screen.getByAltText('Aadhaar front')).toHaveAttribute('src', KYC.front_url)
  expect(screen.getByAltText('Aadhaar back')).toHaveAttribute('src', KYC.back_url)

  await user.click(screen.getByRole('button', { name: 'Open Aadhaar back' }))
  const dialog = await screen.findByRole('dialog')
  expect(dialog.querySelector('img')).toHaveAttribute('src', KYC.back_url)
})

it('Reveal POSTs to the reveal endpoint and shows the full number without caching it', async () => {
  const user = userEvent.setup()
  const queryClient = createQueryClient()
  localStorage.setItem('atelier-admin.refresh', 'refresh')
  window.history.pushState({}, '', '/artists/a-1')
  render(<App queryClient={queryClient} />)

  await user.click(await screen.findByRole('button', { name: 'Reveal' }))
  expect(await screen.findByText('2341 2341 2346')).toBeInTheDocument()
  expect(screen.queryByText('•••• •••• 2346')).not.toBeInTheDocument()
  expect(calls).toContainEqual({ method: 'POST', path: '/admin/artists/a-1/kyc/reveal', body: undefined })
  const cached = [...queryClient.getQueryCache().getAll(), ...queryClient.getMutationCache().getAll()].map((entry) => entry.state.data)
  expect(JSON.stringify(cached)).not.toContain('234123412346')
})

it('says "No Aadhaar on file" when there is none, and Approve still works', async () => {
  db.artist = artist({ kyc: null })
  const user = userEvent.setup()
  renderSignedIn('/artists/a-1')
  expect(await screen.findByText('No Aadhaar on file')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Reveal' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Approve' }))
  expect(await screen.findByText('Approved')).toBeInTheDocument()
})

it('refetches the detail once when the card links have expired', async () => {
  const detailGets = () => calls.filter((c) => c.method === 'GET' && c.path === '/admin/artists/a-1').length
  renderSignedIn('/artists/a-1')
  await screen.findByAltText('Aadhaar front')
  expect(detailGets()).toBe(1)

  const fresh = { ...KYC, front_url: KYC.front_url.replace('expires_at=1', 'expires_at=2'), back_url: KYC.back_url.replace('expires_at=1', 'expires_at=2') }
  db.artist = artist({ kyc: fresh })
  fireEvent.error(screen.getByAltText('Aadhaar front'))
  fireEvent.error(screen.getByAltText('Aadhaar back')) // both expire together: still one refetch
  await waitFor(() => expect(screen.getByAltText('Aadhaar front')).toHaveAttribute('src', fresh.front_url))
  expect(screen.getByAltText('Aadhaar back')).toHaveAttribute('src', fresh.back_url)

  fireEvent.error(screen.getByAltText('Aadhaar front')) // broken again: no second refetch, no loop
  await new Promise((resolve) => setTimeout(resolve, 50))
  expect(detailGets()).toBe(2)
})
