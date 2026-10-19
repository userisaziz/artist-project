import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { calls, db, installFakeBackend, json } from '@/test/fake-backend'
import { renderSignedIn } from '@/test/render-app'
import type { CustomerDetail, CustomerRow } from './types'

// The first render loads the lazy route chunk, which can take over the default 1s in a busy full run.
const FIRST_RENDER_MS = 5_000
/** Interactive flows type and click through several steps; on a loaded machine that outlasts Vitest's 5s default. */
const FLOW_TIMEOUT_MS = 20_000

// Mirrors backend app/customer/schemas.py.
const ananya: CustomerRow = {
  id: 'c-1', name: 'Ananya Rao', phone: '+919845067890', email: 'ananya@example.com', city: 'Bangalore', bookings: 6,
  last_booking_at: '2026-10-09T04:11:00Z', joined_at: '2026-03-02T10:00:00Z', status: 'active',
}
const sneha: CustomerRow = { ...ananya, id: 'c-2', name: 'Sneha Kapoor', phone: '+919811076543', city: null, bookings: 0, status: 'new' }
const summary = { counts: { all: 2, new: 1, repeat: 1, blocked: 0 }, monthly_active: 1, repeat_rate: 0.5 }
const detail = (overrides: Partial<CustomerDetail> = {}): CustomerDetail => ({
  ...ananya, blocked_at: null, blocked_reason: null, reviews: 2,
  recent_bookings: [{ id: 'b-1', code: 'BK-7F3K2Q', artist_name: 'Ayesha Mehendi Art', service_name: 'Bridal Classic', start_at: '2026-10-20T05:30:00Z', status: 'requested', total_paise: 559900 }],
  ...overrides,
})

beforeEach(() => {
  installFakeBackend()
  db.overrides['/admin/customers/summary'] = () => json(200, summary)
  db.overrides['/admin/customers?segment=all&limit=20'] = () => json(200, { items: [sneha, ananya], next_cursor: null })
})
afterEach(() => vi.unstubAllGlobals())

it('lists customers with segment counts, and searches by name, phone or email', async () => {
  const user = userEvent.setup()
  db.overrides['/admin/customers?segment=all&q=ana&limit=20'] = () => json(200, { items: [ananya], next_cursor: null })
  renderSignedIn('/customers')

  expect(await screen.findByRole('heading', { name: 'Customers' }, { timeout: FIRST_RENDER_MS })).toBeInTheDocument()
  expect(await screen.findByText('Ananya Rao')).toBeInTheDocument()
  expect(screen.getByText('Sneha Kapoor')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Repeat 1' })).toBeInTheDocument()
  expect(screen.getByText('50%')).toBeInTheDocument()

  await user.type(screen.getByRole('searchbox', { name: 'Search customers' }), 'ana')
  await waitFor(() => expect(screen.queryByText('Sneha Kapoor')).not.toBeInTheDocument())
  expect(calls).toContainEqual({ method: 'GET', path: '/admin/customers?segment=all&q=ana&limit=20', body: undefined })
}, FLOW_TIMEOUT_MS)

it('opens a customer and blocks the account with a reason', async () => {
  const user = userEvent.setup()
  let current = detail()
  db.overrides['/admin/customers/c-1'] = () => json(200, current)
  db.overrides['/admin/customers/c-1/block'] = () => {
    current = detail({ status: 'blocked', blocked_at: '2026-10-19T10:00:00Z', blocked_reason: 'Repeated no-shows' })
    return json(200, current)
  }
  renderSignedIn('/customers')

  await user.click(await screen.findByText('Ananya Rao', {}, { timeout: FIRST_RENDER_MS }))
  expect(await screen.findByRole('heading', { name: 'Ananya Rao' })).toBeInTheDocument()
  expect(screen.getByText('BK-7F3K2Q · Ayesha Mehendi Art')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Block' }))
  const dialog = await screen.findByRole('dialog')
  await user.type(within(dialog).getByRole('textbox'), 'Repeated no-shows')
  await user.click(within(dialog).getByRole('button', { name: 'Block' }))

  expect(await screen.findByRole('button', { name: 'Unblock' })).toBeInTheDocument()
  expect(screen.getByText('Repeated no-shows')).toBeInTheDocument()
  expect(calls).toContainEqual({ method: 'POST', path: '/admin/customers/c-1/block', body: { reason: 'Repeated no-shows' } })
}, FLOW_TIMEOUT_MS)

it('shows an error when the directory can’t load', async () => {
  // A 4xx is final (server errors are retried first), so the error state shows at once.
  db.overrides['/admin/customers?segment=all&limit=20'] = () => json(403, { code: 'forbidden', message: 'Not allowed for this account' })
  renderSignedIn('/customers')

  expect(await screen.findByText(/Couldn’t load customers. Not allowed for this account/)).toBeInTheDocument()
}, FLOW_TIMEOUT_MS)

it('exports the filtered list as CSV', async () => {
  const user = userEvent.setup()
  const csv = 'name,phone,email,city,bookings,last_booking_at,joined_at,status\nAnanya Rao,+919845067890,,Bangalore,6,,,active\n'
  db.overrides['/admin/customers/export?segment=all'] = () => new Response(csv, { status: 200, headers: { 'Content-Type': 'text/csv' } })
  const created = vi.fn(() => 'blob:customers')
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: created, revokeObjectURL: vi.fn() }))
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  renderSignedIn('/customers')

  await user.click(await screen.findByRole('button', { name: /Export CSV/ }))

  await waitFor(() => expect(click).toHaveBeenCalled())
  expect(created).toHaveBeenCalled()
  click.mockRestore()
}, FLOW_TIMEOUT_MS)
