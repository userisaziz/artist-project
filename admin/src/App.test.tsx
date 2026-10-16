import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { createQueryClient } from './lib/query-client'
import { API_URL } from './lib/api'
import type { AdminCategory, AdminKyc, ArtistDetail, CustomServiceItem, ServiceTemplate, User } from './lib/types'

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
    services: [{ id: 's-1', category_id: 1, subcategory_id: 1, template_id: null, name: 'Bridal Classic', price_paise: 550000, duration_minutes: 180, description: null, status: 'approved', rejection_reason: null }],
    photos: [], kyc: KYC, rejection_reason: null, submitted_at: '2026-10-10T09:41:00Z', reviewed_at: null,
    owner: { id: 'u-1', phone: '+919845011111', first_name: 'Ayesha', last_name: null, email: null },
    ...overrides,
  }
}

const category = (overrides: Partial<AdminCategory> & Pick<AdminCategory, 'id' | 'name'>): AdminCategory => ({
  slug: overrides.name.toLowerCase(), sort_order: 0, status: 'active', parent_id: null,
  artist_count: 0, service_count: 0, child_count: 0, template_count: 0, ...overrides,
})

function customService(overrides: Partial<CustomServiceItem> = {}): CustomServiceItem {
  return {
    id: 'cs-1', artist_id: 'a-1', business_name: 'Ayesha Mehendi Art', category: { id: 1, name: 'Mehendi' }, subcategory: { id: 2, name: 'Bridal' },
    name: 'Glitter mehendi', price_paise: 150000, duration_minutes: 60, description: 'Gold glitter accents', status: 'pending',
    rejection_reason: null, created_at: '2026-10-12T09:00:00Z', ...overrides,
  }
}

interface Db { categories: AdminCategory[]; templates: ServiceTemplate[]; customServices: CustomServiceItem[]; artist: ArtistDetail; me: User }
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
  return json(404, { code: 'not_found', message: `No fake route for ${method} ${path}` })
}

beforeEach(() => {
  db = { categories: [], templates: [], customServices: [], artist: artist(), me: ADMIN }
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
  expect(await screen.findByRole('cell', { name: /^Mehendi/ })).toBeInTheDocument()
  expect(calls).toContainEqual({ method: 'POST', path: '/admin/categories', body: { name: 'Mehendi', status: 'draft' } })
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

it('adds a subcategory under a category, then a service to it', async () => {
  db.categories = [category({ id: 1, name: 'Makeup' })]
  const user = userEvent.setup()
  renderSignedIn('/categories')
  expect(await screen.findByText('Pick a subcategory to manage its services.')).toBeInTheDocument()

  await user.click(await screen.findByRole('button', { name: 'Makeup' }))
  await user.click(screen.getByRole('button', { name: /Subcategory/ }))
  let dialog = await screen.findByRole('dialog')
  expect(within(dialog).getByText('Makeup')).toBeInTheDocument() // "Under: Makeup", read-only
  await user.type(within(dialog).getByLabelText('Name'), 'Bridal')
  await user.click(within(dialog).getByRole('button', { name: 'Create subcategory' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(calls).toContainEqual({ method: 'POST', path: '/admin/categories', body: { name: 'Bridal', status: 'draft', parent_id: 1 } })

  await user.click(await screen.findByRole('button', { name: 'Bridal' }))
  expect(await screen.findByRole('heading', { name: 'Makeup › Bridal' })).toBeInTheDocument()
  expect(window.location.search).toBe('?sub=2')
  expect(await screen.findByText('No services yet')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /New service/ }))
  dialog = await screen.findByRole('dialog')
  await user.type(within(dialog).getByLabelText('Name'), 'HD Bridal Makeup')
  await user.type(within(dialog).getByLabelText('Description'), 'Long-wear HD base')
  await user.click(within(dialog).getByRole('button', { name: 'Add service' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(await screen.findByText('HD Bridal Makeup')).toBeInTheDocument()
  expect(screen.getByText('Long-wear HD base')).toBeInTheDocument()
  expect(calls).toContainEqual({
    method: 'POST', path: '/admin/service-templates',
    body: { name: 'HD Bridal Makeup', description: 'Long-wear HD base', is_active: true, subcategory_id: 2 },
  })
})

it('delete is disabled with a reason for categories and services in use', async () => {
  db.categories = [category({ id: 1, name: 'Makeup', child_count: 1 }), category({ id: 2, name: 'Bridal', parent_id: 1, template_count: 2 })]
  db.templates = [
    { id: 100, subcategory_id: 2, name: 'HD Bridal Makeup', description: null, sort_order: 0, is_active: true, artist_count: 3 },
    { id: 101, subcategory_id: 2, name: 'Old look', description: null, sort_order: 1, is_active: false, artist_count: 0 },
  ]
  const user = userEvent.setup()
  renderSignedIn('/categories?sub=2')
  expect(await screen.findByText('HD Bridal Makeup')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Delete HD Bridal Makeup' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Delete HD Bridal Makeup' })).toHaveAttribute('title', 'Artists offer it — deactivate it instead')
  expect(screen.getByRole('button', { name: 'Delete Old look' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Delete Makeup' })).toBeDisabled()

  await user.click(screen.getByRole('button', { name: 'Makeup' }))
  expect(screen.getByRole('button', { name: 'Delete Bridal' })).toHaveAttribute('title', 'In use — deactivate it instead')
})

it('approves a custom service from the queue', async () => {
  db.customServices = [customService()]
  const user = userEvent.setup()
  renderSignedIn('/custom-services')
  expect(await screen.findByText('Glitter mehendi')).toBeInTheDocument()
  expect(screen.getByText('Mehendi › Bridal')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Ayesha Mehendi Art' })).toHaveAttribute('href', '/artists/a-1')
  expect(within(screen.getByRole('link', { name: /Custom services/ })).getByText('1')).toBeInTheDocument() // nav badge

  await user.click(screen.getByRole('button', { name: 'Approve Glitter mehendi' }))
  expect(await screen.findByText('No custom services waiting for review.')).toBeInTheDocument()
  expect(calls).toContainEqual({ method: 'POST', path: '/admin/custom-services/cs-1/approve', body: undefined })
})

it('rejecting a custom service needs a reason', async () => {
  db.customServices = [customService()]
  const user = userEvent.setup()
  renderSignedIn('/custom-services')
  await user.click(await screen.findByRole('button', { name: 'Reject Glitter mehendi' }))
  await user.type(within(await screen.findByRole('dialog')).getByLabelText('What needs fixing'), 'Draft note')
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

  await user.click(screen.getByRole('button', { name: 'Reject Glitter mehendi' }))
  const dialog = await screen.findByRole('dialog')
  expect(within(dialog).getByLabelText('What needs fixing')).toHaveValue('') // each opening starts blank
  await user.click(within(dialog).getByRole('button', { name: 'Reject' }))
  expect(within(dialog).getByText('Tell the artist what to fix.')).toBeInTheDocument()

  await user.type(within(dialog).getByLabelText('What needs fixing'), 'Already in the catalog')
  await user.click(within(dialog).getByRole('button', { name: 'Reject' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(calls).toContainEqual({ method: 'POST', path: '/admin/custom-services/cs-1/reject', body: { reason: 'Already in the catalog' } })

  await user.click(screen.getByRole('tab', { name: 'Rejected' }))
  expect(await screen.findByText('Sent back: Already in the catalog')).toBeInTheDocument()
})

it('the review page shows Category › Subcategory and marks custom and pending services', async () => {
  db.categories = [category({ id: 1, name: 'Mehendi' }), category({ id: 2, name: 'Bridal', parent_id: 1 })]
  db.artist = artist({
    status: 'approved',
    services: [
      { id: 's-1', category_id: 2, subcategory_id: 2, template_id: 100, name: 'Bridal Classic', price_paise: 550000, duration_minutes: 180, description: null, status: 'approved', rejection_reason: null },
      { id: 's-2', category_id: 2, subcategory_id: 2, template_id: null, name: 'Glitter mehendi', price_paise: 150000, duration_minutes: 60, description: null, status: 'pending', rejection_reason: null },
      { id: 's-3', category_id: 1, subcategory_id: 1, template_id: null, name: 'Old custom', price_paise: 100000, duration_minutes: 30, description: null, status: 'approved', rejection_reason: null },
    ],
  })
  renderSignedIn('/artists/a-1')
  const row = (name: string) => screen.getByText(name).closest('tr') as HTMLElement
  await screen.findByText('Glitter mehendi')
  expect(within(row('Bridal Classic')).getByText('Mehendi › Bridal')).toBeInTheDocument()
  expect(within(row('Bridal Classic')).queryByText('Custom')).not.toBeInTheDocument()
  expect(within(row('Glitter mehendi')).getByText('Custom')).toBeInTheDocument()
  expect(within(row('Glitter mehendi')).getByText('Pending review')).toBeInTheDocument()
  expect(within(row('Old custom')).getByText('Mehendi')).toBeInTheDocument() // older rows point at the top-level category
})
