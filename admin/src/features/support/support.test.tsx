import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { calls, db, installFakeBackend, json } from '@/test/fake-backend'
import { renderSignedIn } from '@/test/render-app'
import type { Ticket } from './types'
import { waitingFor } from './waiting'

// The first render loads the lazy route chunk, which can take over the default 1s in a busy full run.
const FIRST_RENDER_MS = 5_000
/** Interactive flows type and click through several steps; on a loaded machine that outlasts Vitest's 5s default. */
const FLOW_TIMEOUT_MS = 20_000

// Mirrors backend app/support/schemas.py.
const ticket = (overrides: Partial<Ticket> = {}): Ticket => ({
  id: 't-1', code: 'T-8812', subject: 'Artist didn’t show up', topic: 'booking', issue: 'artist_no_show', status: 'new',
  priority: 'urgent', channel: 'app',
  requester: { id: 'u-9', name: 'Ananya Rao', phone: '+919845067890', side: 'customer' },
  assignee: null, booking: { id: 'b-1', code: 'BK-7F3K2Q', service_name: 'Bridal Classic', artist_name: 'Ayesha Mehendi Art' },
  created_at: '2026-10-19T09:00:00Z', waiting_since: '2026-10-19T09:00:00Z',
  messages: [{ id: 'm-1', author: 'requester', author_name: 'Ananya Rao', text: 'Waited an hour', created_at: '2026-10-19T09:00:00Z' }],
  ...overrides,
})
const summary = { counts: { open: 1, mine: 0, artists: 0, customers: 1, urgent: 1, resolved: 0 }, first_response_minutes: 11, resolved_7d: 4 }

beforeEach(() => {
  installFakeBackend()
  db.overrides['/admin/support/summary'] = () => json(200, summary)
  db.overrides['/admin/support/tickets?view=open&limit=20'] = () => json(200, { items: [ticket({ messages: [] })], next_cursor: null })
})
afterEach(() => vi.unstubAllGlobals())

it('works a ticket from the queue: reads it, replies and closes it', async () => {
  const user = userEvent.setup()
  let current = ticket()
  db.overrides['/admin/support/tickets/t-1'] = () => json(200, current)
  db.overrides['/admin/support/tickets/t-1/reply'] = () => {
    current = ticket({ status: 'waiting_on_user', messages: [...current.messages, { id: 'm-2', author: 'support', author_name: 'Atelier support', text: 'Sorry! Rebooking you now.', created_at: '2026-10-19T09:05:00Z' }] })
    return json(200, current)
  }
  db.overrides['/admin/support/tickets/t-1/close'] = () => { current = { ...current, status: 'resolved' }; return json(200, current) }
  renderSignedIn('/support')

  expect(await screen.findByRole('button', { name: 'Urgent 1' }, { timeout: FIRST_RENDER_MS })).toBeInTheDocument()
  await user.click(await screen.findByRole('button', { name: /T-8812 · Ananya Rao/ }))
  const conversation = await screen.findByRole('list', { name: 'Conversation' })
  expect(within(conversation).getByText('Waited an hour')).toBeInTheDocument()

  await user.type(screen.getByLabelText('Reply'), 'Sorry! Rebooking you now.')
  await user.click(screen.getByRole('button', { name: 'Send reply' }))
  expect(await within(conversation).findByText('Sorry! Rebooking you now.')).toBeInTheDocument()
  expect(calls).toContainEqual({ method: 'POST', path: '/admin/support/tickets/t-1/reply', body: { text: 'Sorry! Rebooking you now.' } })

  await user.click(screen.getByRole('button', { name: 'Close' }))
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument())
}, FLOW_TIMEOUT_MS)

it('logs a phone request as a new ticket', async () => {
  const user = userEvent.setup()
  db.overrides['/admin/support/tickets'] = () => json(201, ticket({ id: 't-2', code: 'T-9001', channel: 'phone', priority: 'normal' }))
  db.overrides['/admin/support/tickets/t-2'] = () => json(200, ticket({ id: 't-2', code: 'T-9001', channel: 'phone', priority: 'normal' }))
  renderSignedIn('/support')

  await user.click(await screen.findByRole('button', { name: /New ticket/ }, { timeout: FIRST_RENDER_MS }))
  const dialog = await screen.findByRole('dialog')
  await user.type(within(dialog).getByLabelText('Requester’s mobile'), '+919845067890')
  await user.selectOptions(within(dialog).getByLabelText('Issue'), 'change_number')
  await user.type(within(dialog).getByLabelText('What they told you'), 'Wants to move to a new SIM')
  await user.click(within(dialog).getByRole('button', { name: 'Open ticket' }))

  await waitFor(() => expect(calls).toContainEqual({
    method: 'POST', path: '/admin/support/tickets',
    body: { phone: '+919845067890', topic: 'account', issue: 'change_number', message: 'Wants to move to a new SIM' },
  }))
}, FLOW_TIMEOUT_MS)

it('refuses a phone number that isn’t in international format', async () => {
  const user = userEvent.setup()
  renderSignedIn('/support')

  await user.click(await screen.findByRole('button', { name: /New ticket/ }))
  const dialog = await screen.findByRole('dialog')
  await user.type(within(dialog).getByLabelText('Requester’s mobile'), '98450')
  await user.type(within(dialog).getByLabelText('What they told you'), 'x')
  await user.click(within(dialog).getByRole('button', { name: 'Open ticket' }))

  expect(await within(dialog).findByText(/international format/)).toBeInTheDocument()
}, FLOW_TIMEOUT_MS)

it('shows an error when the queue can’t load', async () => {
  db.overrides['/admin/support/tickets?view=open&limit=20'] = () => json(403, { code: 'forbidden', message: 'Not allowed for this account' })
  renderSignedIn('/support')

  expect(await screen.findByText(/Couldn’t load the queue/)).toBeInTheDocument()
}, FLOW_TIMEOUT_MS)

it('says how long a requester has waited', () => {
  const now = Date.parse('2026-10-19T12:00:00Z')
  expect(waitingFor('2026-10-19T11:56:00Z', now)).toBe('4 min')
  expect(waitingFor('2026-10-19T09:00:00Z', now)).toBe('3h')
  expect(waitingFor('2026-10-17T09:00:00Z', now)).toBe('2d')
  expect(waitingFor(null, now)).toBe('—')
})
