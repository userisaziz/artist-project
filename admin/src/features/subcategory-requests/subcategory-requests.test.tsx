import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { calls, db, installFakeBackend, json } from '@/test/fake-backend'
import { renderSignedIn } from '@/test/render-app'
import type { SubcategoryRequest, SubcategoryRequestSummary } from './types'

// Mirrors backend app/subcategory_request/schemas.py.
const couple: SubcategoryRequest = {
  id: 'r-1', name: 'Couple portrait', description: 'Portraits of the couple', parent: { id: 1, name: 'Mehendi' },
  artist: { id: 'a-1', business_name: 'Ayesha Mehendi Art' }, services_waiting: 1, status: 'pending', rejection_reason: null,
  subcategory_id: null, created_at: '2026-10-19T02:00:00Z', reviewed_at: null,
}
const summary: SubcategoryRequestSummary = {
  counts: { pending: 1, approved: 0, rejected: 0 }, approved_30d: 0, admin_defaults: 24, oldest_pending_at: '2026-10-19T02:00:00Z',
}

beforeEach(() => {
  installFakeBackend()
  db.overrides['/admin/subcategory-requests/summary'] = () => json(200, summary)
  db.overrides['/admin/subcategory-requests?status=pending&limit=20'] = () => json(200, { items: [couple], next_cursor: null })
})
afterEach(() => vi.unstubAllGlobals())

it('lists pending suggestions with KPIs and approves one renamed', async () => {
  db.overrides['/admin/subcategory-requests/r-1/approve'] = () => json(200, { ...couple, name: 'Couple portraits', status: 'approved', subcategory_id: 7 })
  const user = userEvent.setup()
  renderSignedIn('/subcategory-requests')

  expect(await screen.findByText('Couple portrait', undefined, { timeout: 4000 })).toBeInTheDocument() // first render compiles the lazy page
  expect(screen.getByText('Portraits of the couple')).toBeInTheDocument()
  expect(within(screen.getByRole('group', { name: 'Admin defaults' })).getByText('24')).toBeInTheDocument()
  expect(within(screen.getByRole('link', { name: /^Subcategories/ })).getByText('1')).toBeInTheDocument() // sidebar count

  await user.click(screen.getByRole('button', { name: 'Approve Couple portrait' }))
  const dialog = await screen.findByRole('dialog')
  const field = within(dialog).getByLabelText('Subcategory name')
  expect(field).toHaveValue('Couple portrait')
  await user.clear(field)
  await user.type(field, 'Couple portraits')
  await user.click(within(dialog).getByRole('button', { name: 'Approve & publish' }))
  await waitFor(() => expect(calls).toContainEqual({ method: 'POST', path: '/admin/subcategory-requests/r-1/approve', body: { name: 'Couple portraits' } }))
  expect(await screen.findByText('“Couple portraits” is in the catalog under Mehendi')).toBeInTheDocument()
})

it('a name that already exists shows under the field', async () => {
  db.overrides['/admin/subcategory-requests/r-1/approve'] = () => json(409, { code: 'conflict', message: 'A category with that name or slug already exists' })
  const user = userEvent.setup()
  renderSignedIn('/subcategory-requests')

  await user.click(await screen.findByRole('button', { name: 'Approve Couple portrait' }, { timeout: 4000 }))
  const dialog = await screen.findByRole('dialog')
  await user.click(within(dialog).getByRole('button', { name: 'Approve & publish' }))
  expect(await within(dialog).findByText('A category with that name or slug already exists')).toBeInTheDocument()
})

it('rejecting needs a reason', async () => {
  db.overrides['/admin/subcategory-requests/r-1/reject'] = () => json(200, { ...couple, status: 'rejected', rejection_reason: 'Use Bridal' })
  const user = userEvent.setup()
  renderSignedIn('/subcategory-requests')

  await user.click(await screen.findByRole('button', { name: 'Reject Couple portrait' }, { timeout: 4000 }))
  const dialog = await screen.findByRole('dialog')
  await user.click(within(dialog).getByRole('button', { name: 'Reject' }))
  expect(within(dialog).getByText('Add a reason for the artist.')).toBeInTheDocument()
  await user.type(within(dialog).getByLabelText('Reason'), 'Use Bridal')
  await user.click(within(dialog).getByRole('button', { name: 'Reject' }))
  await waitFor(() => expect(calls).toContainEqual({ method: 'POST', path: '/admin/subcategory-requests/r-1/reject', body: { reason: 'Use Bridal' } }))
})

it('shows an error when requests can’t load', async () => {
  db.overrides['/admin/subcategory-requests?status=pending&limit=20'] = () => json(403, { code: 'forbidden', message: 'Admins only' })
  renderSignedIn('/subcategory-requests')
  expect(await screen.findByRole('alert', undefined, { timeout: 4000 })).toHaveTextContent('Couldn’t load subcategory requests.')
})
