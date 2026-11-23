import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { booking, calls, db, installFakeBackend, json } from '@/test/fake-backend'
import { renderSignedIn } from '@/test/render-app'

beforeEach(() => {
  installFakeBackend()
  localStorage.clear()
  sessionStorage.clear()
  window.history.pushState({}, '', '/')
})
afterEach(() => vi.unstubAllGlobals())

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

it('shows an error state when bookings fails to load', async () => {
  db.overrides['/admin/bookings'] = () => json(500, { code: 'server_error', message: 'Database unavailable' })
  renderSignedIn('/bookings')
  // A 500 is retried twice (about 1 s + 2 s, src/lib/query-client.ts) before the error shows.
  expect(await screen.findByText(/Couldn’t load bookings\./, {}, { timeout: 5000 })).toBeInTheDocument()
})

it('recovers a failed list and its KPI strip with Retry instead of a reload', async () => {
  db.bookings = [booking()]
  let listDown = true
  db.overrides['/admin/bookings'] = () => (listDown ? json(403, { code: 'forbidden', message: 'Try again' }) : json(200, { items: db.bookings, next_cursor: null }))
  db.overrides['/admin/overview'] = () => json(403, { code: 'forbidden', message: 'Try again' })
  const user = userEvent.setup()
  renderSignedIn('/bookings')

  expect(await screen.findByText(/Couldn’t load bookings\./)).toBeInTheDocument()
  // The KPI strip says it failed rather than shimmering forever.
  await waitFor(() => expect(screen.getByRole('group', { name: 'Bookings · 30d' })).toHaveTextContent('Couldn’t load'))

  listDown = false
  await user.click(screen.getByRole('button', { name: 'Retry' }))
  expect(await screen.findByRole('link', { name: /BK-7F3K2Q/ })).toBeInTheDocument()
})

it('booking detail offers Retry when it fails to load', async () => {
  db.bookings = [booking()]
  let down = true
  db.overrides['/admin/bookings/b-1'] = () => (down ? json(403, { code: 'forbidden', message: 'Try again' }) : json(200, booking()))
  const user = userEvent.setup()
  renderSignedIn('/bookings/b-1')

  expect(await screen.findByText('Couldn’t load this booking')).toBeInTheDocument()
  down = false
  await user.click(screen.getByRole('button', { name: 'Retry' }))
  expect(await screen.findByRole('button', { name: 'Cancel booking' })).toBeInTheDocument()
})
