import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { calls, db, installFakeBackend, json } from '@/test/fake-backend'
import { renderSignedIn } from '@/test/render-app'
import type { Enquiry, EnquirySummary } from './types'

// Mirrors backend app/chat/schemas.py.
const held: Enquiry = {
  id: 'm-1', conversation_id: 'c-1', sender: 'customer', text: 'Call me on 98450 67890', flag: 'contact_info', status: 'held',
  created_at: '2026-10-19T08:00:00Z', moderated_at: null, customer: { id: 'u-9', name: 'Priya Rao' }, artist: { id: 'a-1', name: 'Ayesha Mehendi Art' },
}
const summary: EnquirySummary = { counts: { held: 1, allowed: 0, hidden: 0 }, messages_7d: 40, flagged_7d: 2 }

beforeEach(() => {
  installFakeBackend()
  db.overrides['/admin/enquiries/summary'] = () => json(200, summary)
  db.overrides['/admin/enquiries?status=held&limit=20'] = () => json(200, { items: [held], next_cursor: null })
})
afterEach(() => vi.unstubAllGlobals())

it('lists held messages with KPIs and allows one', async () => {
  db.overrides['/admin/enquiries/m-1/allow'] = () => json(200, { ...held, status: 'allowed', moderated_at: '2026-10-19T09:00:00Z' })
  const user = userEvent.setup()
  renderSignedIn('/enquiries')

  expect(await screen.findByText('“Call me on 98450 67890”', undefined, { timeout: 4000 })).toBeInTheDocument() // first render compiles the lazy page
  expect(screen.getByText('Contact details shared')).toBeInTheDocument()
  expect(within(screen.getByRole('group', { name: 'Flagged · 7d' })).getByText('5.0% of enquiries')).toBeInTheDocument()
  expect(within(screen.getByRole('link', { name: /^Enquiries/ })).getByText('1')).toBeInTheDocument() // sidebar count

  await user.click(screen.getByRole('button', { name: 'Allow message from Priya Rao' }))
  await waitFor(() => expect(calls).toContainEqual({ method: 'POST', path: '/admin/enquiries/m-1/allow', body: undefined }))
  expect(await screen.findByText('Marked safe and delivered')).toBeInTheDocument()
})

it('hiding asks first', async () => {
  db.overrides['/admin/enquiries/m-1/hide'] = () => json(200, { ...held, status: 'hidden' })
  const user = userEvent.setup()
  renderSignedIn('/enquiries')

  await user.click(await screen.findByRole('button', { name: 'Hide message from Priya Rao' }, { timeout: 4000 }))
  const dialog = await screen.findByRole('alertdialog')
  expect(calls.some((c) => c.path.endsWith('/hide'))).toBe(false)
  await user.click(within(dialog).getByRole('button', { name: 'Hide' }))
  await waitFor(() => expect(calls).toContainEqual({ method: 'POST', path: '/admin/enquiries/m-1/hide', body: undefined }))
})

it('shows an error when enquiries can’t load', async () => {
  db.overrides['/admin/enquiries?status=held&limit=20'] = () => json(403, { code: 'forbidden', message: 'Admins only' })
  renderSignedIn('/enquiries')
  expect(await screen.findByRole('alert', undefined, { timeout: 4000 })).toHaveTextContent('Couldn’t load enquiries.')
})
