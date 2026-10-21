import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { createQueryClient } from './lib/query-client'
import { ADMIN, KYC, artist, booking, calls, category, customService, db, installFakeBackend, json, requests, review } from './test/fake-backend'
import { renderApp, renderSignedIn } from './test/render-app'

// The fake backend (src/test/fake-backend.ts) stands in for the API behind fetch.

beforeEach(() => {
  installFakeBackend()
  localStorage.clear()
  sessionStorage.clear()
  window.history.pushState({}, '', '/')
})
afterEach(() => vi.unstubAllGlobals())

it('signs an admin in with phone + code and opens the Overview', async () => {
  const user = userEvent.setup()
  renderApp()
  await user.type(await screen.findByLabelText('Phone number'), '98450 00001')
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
  expect(await screen.findByText('We texted a 6-digit code to +91 98450 00001.')).toBeInTheDocument()
  await user.keyboard('123456')
  expect(await screen.findByRole('heading', { name: /Neha/ })).toBeInTheDocument()
  expect(window.location.pathname).toBe('/overview')
  expect(calls).toContainEqual({ method: 'POST', path: '/auth/otp/verify', body: { phone: '+919845000001', code: '123456' } })
  expect(db.refreshCookie).not.toBeNull() // the refresh token lives in the httpOnly cookie
})

it('without "Keep me signed in" the session lasts only for this browser session', async () => {
  const user = userEvent.setup()
  renderApp()
  await user.type(await screen.findByLabelText('Phone number'), '9845000001')
  await user.click(screen.getByLabelText('Keep me signed in on this device'))
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
  await screen.findByText(/We texted a 6-digit code/)
  await user.keyboard('123456')
  await screen.findByRole('heading', { name: /Neha/ })
  const verify = requests.find((r) => r.path === '/auth/otp/verify')
  expect(verify?.headers['x-session-transport']).toBe('cookie-session')
  expect(verify?.credentials).toBe('include')
})

it('sends a signed-out deep link to /login, then back to that page after sign-in', async () => {
  const user = userEvent.setup()
  renderApp('/bookings?status=completed')
  await user.type(await screen.findByLabelText('Phone number'), '9845000001')
  expect(window.location.pathname).toBe('/login')
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
  await screen.findByText(/We texted a 6-digit code/)
  await user.keyboard('123456')
  await waitFor(() => expect(window.location.pathname).toBe('/bookings'))
  expect(window.location.search).toBe('?status=completed')
})

it('a signed-in admin visiting /login lands on the Overview', async () => {
  renderSignedIn('/login')
  expect(await screen.findByRole('heading', { name: /Neha/ })).toBeInTheDocument()
  expect(window.location.pathname).toBe('/overview')
})

it('signing out returns to /login', async () => {
  const user = userEvent.setup()
  renderSignedIn('/overview')
  await user.click(await screen.findByRole('button', { name: 'Sign out' }))
  expect(await screen.findByLabelText('Phone number')).toBeInTheDocument()
  expect(window.location.pathname).toBe('/login')
  expect(db.refreshCookie).toBeNull()
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
  expect(db.refreshCookie).toBeNull() // the cookie the verify call set was revoked again
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
  expect(await screen.findByRole('button', { name: 'Mehendi' })).toBeInTheDocument()
  expect(calls).toContainEqual({ method: 'POST', path: '/admin/categories', body: { name: 'Mehendi', status: 'draft' } })
})

it('lists a pending artist and approves them', async () => {
  const user = userEvent.setup()
  renderSignedIn('/artists')
  await user.click(await screen.findByText('Ayesha Mehendi Art'))
  await user.click(await screen.findByRole('tab', { name: 'Services (1)' }))
  expect(await screen.findByText('Bridal Classic')).toBeInTheDocument()
  expect(screen.getByText('₹5,500')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Approve & publish' }))
  expect(await screen.findByText('Approved')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Approve & publish' })).not.toBeInTheDocument()
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

it('opens on the masked Aadhaar tab, and both card photos open full size', async () => {
  const user = userEvent.setup()
  renderSignedIn('/artists/a-1')
  expect(await screen.findByText('•••• •••• 2346')).toBeInTheDocument()
  expect(screen.getByText('Reveals are logged.')).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: 'Aadhaar' })).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByRole('tab', { name: 'Services (1)' })).toHaveAttribute('aria-selected', 'false')
  expect(screen.getByAltText('Aadhaar front')).toHaveAttribute('src', KYC.front_url)
  expect(screen.getByAltText('Aadhaar back')).toHaveAttribute('src', KYC.back_url)

  await user.click(screen.getByRole('button', { name: 'Open Aadhaar back' }))
  const dialog = await screen.findByRole('dialog')
  expect(dialog.querySelector('img')).toHaveAttribute('src', KYC.back_url)
})

it('Reveal POSTs to the reveal endpoint and shows the full number without caching it', async () => {
  const user = userEvent.setup()
  const queryClient = createQueryClient()
  db.refreshCookie = 'refresh-1'
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
  await user.click(screen.getByRole('button', { name: 'Approve & publish' }))
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

  await user.click(screen.getByRole('button', { name: 'More actions for Makeup' }))
  expect(await screen.findByRole('menuitem', { name: 'Delete' })).toHaveAttribute('aria-disabled', 'true')
  expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveAttribute('title', 'In use — archive it instead')
})

it('shows catalog KPIs and archives a category from its row menu', async () => {
  db.categories = [
    category({ id: 1, name: 'Mehendi', artist_count: 12, service_count: 30, child_count: 2, status: 'active' }),
    category({ id: 2, name: 'Bridal', parent_id: 1, template_count: 3 }),
    category({ id: 3, name: 'Arabic', parent_id: 1, template_count: 1 }),
    category({ id: 4, name: 'Nail art', status: 'draft' }),
  ]
  const user = userEvent.setup()
  renderSignedIn('/categories')

  expect(await screen.findByText('Bridal, Arabic')).toBeInTheDocument() // subcategories under the name
  expect(within(screen.getByRole('group', { name: 'Categories' })).getByText('2')).toBeInTheDocument()
  expect(within(screen.getByRole('group', { name: 'Categories' })).getByText('+ 2 subcategories')).toBeInTheDocument()
  expect(within(screen.getByRole('group', { name: 'Catalogue services' })).getByText('4')).toBeInTheDocument()
  expect(within(screen.getByRole('group', { name: 'Top category' })).getByText('Mehendi')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Draft 1' }))
  expect(window.location.search).toBe('?status=draft')
  expect(screen.queryByRole('button', { name: 'Mehendi' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'All 2' }))

  await user.click(screen.getByRole('button', { name: 'More actions for Mehendi' }))
  await user.click(await screen.findByRole('menuitem', { name: 'Archive' }))
  await waitFor(() => expect(calls).toContainEqual({ method: 'PATCH', path: '/admin/categories/1', body: { status: 'inactive' } }))
  expect(await screen.findByText('“Mehendi” is now inactive')).toBeInTheDocument()
})

it('shows an error state when the catalog fails to load', async () => {
  db.overrides['/admin/categories'] = () => json(500, { code: 'server_error', message: 'Database unavailable' })
  renderSignedIn('/categories')
  // A 500 is retried twice (about 1 s + 2 s, src/lib/query-client.ts) before the error shows.
  expect(await screen.findByRole('alert', {}, { timeout: 5000 })).toHaveTextContent('Couldn’t load categories.')
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

  await user.click(screen.getByRole('button', { name: 'Rejected' }))
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
  const user = userEvent.setup()
  renderSignedIn('/artists/a-1')
  const row = (name: string) => screen.getByText(name).closest('tr') as HTMLElement
  await user.click(await screen.findByRole('tab', { name: 'Services (3)' }))
  await screen.findByText('Glitter mehendi')
  expect(within(row('Bridal Classic')).getByText('Mehendi › Bridal')).toBeInTheDocument()
  expect(within(row('Bridal Classic')).queryByText('Custom')).not.toBeInTheDocument()
  expect(within(row('Glitter mehendi')).getByText('Custom')).toBeInTheDocument()
  expect(within(row('Glitter mehendi')).getByText('Pending review')).toBeInTheDocument()
  expect(within(row('Old custom')).getByText('Mehendi')).toBeInTheDocument() // older rows point at the top-level category
})

it('lands on the Overview by default, with KPIs, the weekly chart and the first pending artists', async () => {
  const user = userEvent.setup()
  renderSignedIn('/')
  expect(await screen.findByRole('heading', { name: /Neha/ })).toBeInTheDocument()
  expect(window.location.pathname).toBe('/overview')
  expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page')

  const kpi = (label: string) => screen.getByRole('group', { name: label })
  await screen.findByText('₹42.6L')
  expect(within(kpi('Gross bookings')).getByText('₹42.6L')).toBeInTheDocument()
  expect(within(kpi('Gross bookings')).getByText('▲ 12.4%')).toBeInTheDocument() // against the previous 30 days
  expect(within(kpi('Bookings')).getByText('1,284')).toBeInTheDocument()
  expect(within(kpi('New artists')).getByText('86')).toBeInTheDocument()
  expect(within(kpi('New artists')).getByText('1 pending review')).toBeInTheDocument()
  expect(within(kpi('Awaiting artist')).getByText('42')).toBeInTheDocument()

  expect(screen.getAllByRole('listitem', { name: /^Week of/ })).toHaveLength(12)
  expect(screen.getByRole('listitem', { name: 'Week of 12 Oct: 21 bookings' })).toBeInTheDocument()
  expect(screen.getByRole('listitem', { name: 'Week of 27 Jul: 10 bookings' })).toBeInTheDocument()

  const artistLink = await screen.findByRole('link', { name: /Ayesha Mehendi Art/ })
  expect(artistLink).toHaveAttribute('href', '/artists/a-1')
  await user.click(screen.getByRole('link', { name: 'Open queue' }))
  expect(await screen.findByRole('heading', { name: 'Verification queue' })).toBeInTheDocument()
})

it('filters bookings by status chip and by search', async () => {
  db.bookings = [
    booking(),
    booking({ id: 'b-2', code: 'BK-9H4M2P', status: 'confirmed', service_name: 'Party Makeup', artist: { id: 'a-2', business_name: 'Glam by Riya', photo_url: null, city: 'Mumbai' } }),
  ]
  const user = userEvent.setup()
  renderSignedIn('/bookings')
  const row = await screen.findByRole('link', { name: /BK-7F3K2Q/ })
  expect(row).toHaveAttribute('href', '/bookings/b-1')
  expect(screen.getByText(/BK-9H4M2P/)).toBeInTheDocument()
  expect(within(row).getByText('₹5,599')).toBeInTheDocument()
  expect(within(row).getByText('Requested')).toBeInTheDocument()
  expect(within(row).getByText(/20 Oct.*11:00 am/i)).toBeInTheDocument() // 05:30 UTC is 11:00 IST

  await user.click(screen.getByRole('button', { name: 'Confirmed' }))
  await waitFor(() => expect(screen.queryByText(/BK-7F3K2Q/)).not.toBeInTheDocument())
  expect(screen.getByText(/BK-9H4M2P/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Confirmed' })).toHaveAttribute('aria-pressed', 'true')
  expect(calls.some((c) => c.path.startsWith('/admin/bookings?') && c.path.includes('status=confirmed'))).toBe(true)

  await user.click(screen.getByRole('button', { name: 'All' }))
  await user.type(screen.getByRole('searchbox', { name: 'Filter bookings' }), 'ayesha')
  await waitFor(() => expect(screen.queryByText(/BK-9H4M2P/)).not.toBeInTheDocument())
  expect(await screen.findByText(/BK-7F3K2Q/)).toBeInTheDocument()
  expect(calls.some((c) => c.path.includes('q=ayesha'))).toBe(true)
})

it('loads the next page of bookings with "Load more"', async () => {
  db.bookings = Array.from({ length: 21 }, (_, i) => booking({ id: `b-${i}`, code: `BK-${String(i).padStart(6, '0')}` }))
  const user = userEvent.setup()
  renderSignedIn('/bookings')
  expect(await screen.findByText(/BK-000019/)).toBeInTheDocument()
  expect(screen.queryByText(/BK-000020/)).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Load more' }))
  expect(await screen.findByText(/BK-000020/)).toBeInTheDocument()
  expect(calls.some((c) => c.path.includes('cursor=20'))).toBe(true)
  expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
})

it('booking detail shows the payment breakdown, and cancelling needs a reason', async () => {
  db.bookings = [booking()]
  const user = userEvent.setup()
  renderSignedIn('/bookings/b-1')
  expect(await screen.findByRole('heading', { name: 'BK-7F3K2Q' })).toBeInTheDocument()
  expect(screen.getByText('Priya Rao')).toBeInTheDocument()
  expect(screen.getByText('+919845022222')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Ayesha Mehendi Art' })).toHaveAttribute('href', '/artists/a-1')
  expect(screen.getByText('12 Residency Road, Bangalore')).toBeInTheDocument()
  expect(screen.getByText('Gate code 4512')).toBeInTheDocument()
  await user.click(screen.getByRole('tab', { name: 'Payment' }))
  const payment = (label: string) => screen.getByText(label).closest('div') as HTMLElement
  expect(within(payment('Deposit paid')).getByText('₹1,680')).toBeInTheDocument()
  expect(within(payment('Balance')).getByText('₹3,919')).toBeInTheDocument()
  expect(within(payment('Commission')).getByText('₹550')).toBeInTheDocument()
  expect(within(payment('Artist earns')).getByText('₹4,950')).toBeInTheDocument()
  expect(screen.getByText('Booking requested')).toBeInTheDocument()
  expect(screen.getByText('Waiting for the artist')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Cancel booking' }))
  const dialog = await screen.findByRole('dialog')
  await user.click(within(dialog).getByRole('button', { name: 'Cancel booking' }))
  expect(within(dialog).getByText('Add a reason for cancelling.')).toBeInTheDocument()
  expect(calls.some((c) => c.path.endsWith('/cancel'))).toBe(false)

  await user.type(within(dialog).getByLabelText('Reason'), 'Artist is unwell')
  await user.click(within(dialog).getByRole('button', { name: 'Cancel booking' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(calls).toContainEqual({ method: 'POST', path: '/admin/bookings/b-1/cancel', body: { reason: 'Artist is unwell' } })
  expect(await screen.findByText('Cancelled')).toBeInTheDocument()
  expect(screen.getByText(/Artist is unwell/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Cancel booking' })).not.toBeInTheDocument()
})

const LONG_TEXT = 'Total scam, never showed up on the day. Call me on 98450 12345 and I will tell you everything about it.'

function reviewQueue() {
  return [
    review(),
    review({ id: 'r-2', rating: 1, text: LONG_TEXT, reviewer_name: 'Vikram T.', status: 'hidden', flag: 'contact_info', report_reason: null, reply: null, replied_at: null, artist: { id: 'a-2', business_name: 'Ink & Om Tattoo' } }),
    review({ id: 'r-3', reviewer_name: 'Kiran M.', status: 'hidden', flag: 'blocked_word', report_reason: null, moderated_at: '2026-10-16T09:00:00Z', artist: { id: 'a-3', business_name: 'Lens & Light' } }), // already decided: not in the badge
    review({ id: 'r-4', rating: 5, reviewer_name: 'Sneha K.', status: 'published', flag: null, report_reason: null, artist: { id: 'a-4', business_name: 'Meher by Riya' } }),
  ]
}

it('the Reviews queue lists flagged reviews by default and filters by status chip', async () => {
  db.reviews = reviewQueue()
  const user = userEvent.setup()
  renderSignedIn('/reviews')
  expect(await screen.findByText('Priya R. → Ayesha Mehendi Art')).toBeInTheDocument()
  const row = screen.getByText('Priya R. → Ayesha Mehendi Art').closest('button, a') as HTMLElement
  expect(within(row).getByText('Bridal Classic · Oct 2026')).toBeInTheDocument()
  expect(within(row).getByText('★ 2')).toBeInTheDocument()
  expect(within(row).getByText('Reported by artist')).toBeInTheDocument()
  expect(within(row).getByText('Flagged')).toBeInTheDocument()
  expect(screen.queryByText('Vikram T. → Ink & Om Tattoo')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Flagged' })).toHaveAttribute('aria-pressed', 'true')
  expect(calls.some((c) => c.path.startsWith('/admin/reviews?') && c.path.includes('status=flagged') && c.path.includes('limit=20'))).toBe(true)
  // nav badge: 1 flagged + 1 hidden that no moderator has decided on
  await waitFor(() => expect(within(screen.getByRole('link', { name: /Reviews/ })).getByText('2')).toBeInTheDocument())

  await user.click(screen.getByRole('button', { name: 'Hidden' }))
  expect(await screen.findByText('Vikram T. → Ink & Om Tattoo')).toBeInTheDocument()
  expect(screen.queryByText('Priya R. → Ayesha Mehendi Art')).not.toBeInTheDocument()
  expect(window.location.search).toBe('?status=hidden')
  const hidden = screen.getByText('Vikram T. → Ink & Om Tattoo').closest('button, a') as HTMLElement
  expect(within(hidden).getByText(`“${LONG_TEXT.slice(0, 80)}…”`)).toBeInTheDocument()
  expect(within(hidden).getByText('Contact details')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Published' }))
  const published = (await screen.findByText('Sneha K. → Meher by Riya')).closest('button, a') as HTMLElement
  expect(within(published).getByText('—')).toBeInTheDocument() // no flag
})

it('the review detail explains the flag and publishes with a note', async () => {
  db.reviews = reviewQueue()
  const user = userEvent.setup()
  renderSignedIn('/reviews')
  await user.click(await screen.findByText('Priya R. → Ayesha Mehendi Art'))
  const panel = await screen.findByRole('dialog')
  expect(within(panel).getByText('Half the flowers were missing and the stage was set up two hours late.')).toBeInTheDocument()
  expect(within(panel).getByText('We are sorry, the supplier let us down.')).toBeInTheDocument()
  expect(within(panel).getByText('Reported by the artist')).toBeInTheDocument()
  expect(within(panel).getByText('This customer never booked this service')).toBeInTheDocument()
  expect(within(panel).getByText('+919845022222')).toBeInTheDocument()
  expect(within(panel).getByRole('link', { name: 'BK-7F3K2Q' })).toHaveAttribute('href', '/bookings/b-1')
  expect(within(panel).getByRole('button', { name: 'Hide' })).toBeInTheDocument()
  expect(within(panel).getByRole('button', { name: 'Remove' })).toBeInTheDocument()

  await user.type(within(panel).getByLabelText('Internal note'), 'Booking BK-7F3K2Q is real; the review stands')
  await user.click(within(panel).getByRole('button', { name: 'Publish' }))
  expect(await within(panel).findByText('Published')).toBeInTheDocument()
  expect(calls).toContainEqual({ method: 'POST', path: '/admin/reviews/r-1/decision', body: { decision: 'publish', note: 'Booking BK-7F3K2Q is real; the review stands' } })
  expect(within(panel).queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument() // already published
  expect(within(panel).getByRole('button', { name: 'Hide' })).toBeInTheDocument()

  await user.click(within(panel).getByRole('button', { name: 'Close' }))
  await waitFor(() => expect(screen.queryByText('Priya R. → Ayesha Mehendi Art')).not.toBeInTheDocument()) // left the Flagged queue
})

it('removing a review asks for confirmation first', async () => {
  db.reviews = reviewQueue()
  const user = userEvent.setup()
  renderSignedIn('/reviews?status=hidden')
  await user.click(await screen.findByText('Vikram T. → Ink & Om Tattoo'))
  const panel = await screen.findByRole('dialog')
  expect(within(panel).getByText('Contains contact details')).toBeInTheDocument()
  expect(within(panel).queryByRole('button', { name: 'Hide' })).not.toBeInTheDocument() // already hidden

  await user.click(within(panel).getByRole('button', { name: 'Remove' }))
  let confirm = await screen.findByRole('alertdialog')
  expect(within(confirm).getByText('Remove this review?')).toBeInTheDocument()
  await user.click(within(confirm).getByRole('button', { name: 'Keep it' }))
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  expect(calls.some((c) => c.path.endsWith('/decision'))).toBe(false)

  await user.click(within(panel).getByRole('button', { name: 'Remove' }))
  confirm = await screen.findByRole('alertdialog')
  await user.click(within(confirm).getByRole('button', { name: 'Remove review' }))
  expect(await within(panel).findByText('Removed')).toBeInTheDocument()
  expect(calls).toContainEqual({ method: 'POST', path: '/admin/reviews/r-2/decision', body: { decision: 'remove' } })
  for (const name of ['Publish', 'Hide', 'Remove']) expect(within(panel).queryByRole('button', { name })).not.toBeInTheDocument()
})

it('the sidebar shows the flagged reviews count beside Reviews, linking to the queue', async () => {
  db.reviews = [review({ id: 'r-1' }), review({ id: 'r-2' }), review({ id: 'r-3' })]
  renderSignedIn('/overview')
  const reviews = await screen.findByRole('link', { name: /^Reviews/ })
  expect(reviews).toHaveAttribute('href', '/reviews')
  expect(await within(reviews).findByText('3')).toBeInTheDocument()
})

it('the top bar search opens Bookings filtered by the query', async () => {
  db.bookings = [booking()]
  const user = userEvent.setup()
  renderSignedIn('/overview')
  await user.type(await screen.findByRole('searchbox', { name: 'Search bookings' }), 'BK-7F3K2Q{Enter}')
  expect(await screen.findByRole('heading', { name: 'Bookings' })).toBeInTheDocument()
  expect(window.location.search).toBe('?q=BK-7F3K2Q')
  expect(screen.getByRole('searchbox', { name: 'Filter bookings' })).toHaveValue('BK-7F3K2Q')
})

it('the Overview city and date range filters go to the URL and the overview request', async () => {
  const user = userEvent.setup()
  renderSignedIn('/overview')
  await user.click(await screen.findByRole('combobox', { name: 'Date range' }))
  await user.click(await screen.findByRole('option', { name: 'Last 7 days' }))
  await waitFor(() => expect(window.location.search).toBe('?period=7d'))
  await waitFor(() => expect(calls.some((c) => c.path === '/admin/overview?period=7d')).toBe(true))

  await user.click(screen.getByRole('combobox', { name: 'City' }))
  await user.click(await screen.findByRole('option', { name: 'Mumbai' }))
  await waitFor(() => expect(calls.some((c) => c.path === '/admin/overview?period=7d&city=Mumbai')).toBe(true))
})
