import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { calls, db, installFakeBackend, json } from '@/test/fake-backend'
import { renderSignedIn } from '@/test/render-app'
import type { Policy, TeamMember } from './types'

// The first render loads the lazy route chunk, which can take over the default 1s in a busy full run.
const FIRST_RENDER_MS = 5_000
/** Interactive flows type and click through several steps; on a loaded machine that outlasts Vitest's 5s default. */
const FLOW_TIMEOUT_MS = 20_000

// Mirrors backend app/platform/schemas.py.
const policies: Policy[] = [
  { key: 'booking_accept_hours', label: 'Artist response window', value: '3 hours to accept a request', scope: 'All cities', editable: false },
  { key: 'payments', label: 'Payments', value: 'Customers pay the artist directly; no in-app payments', scope: 'All cities', editable: false },
]
const me: TeamMember = { id: 'u-admin', name: 'Neha Menon', phone: '+919845000001', email: null, admin_since: '2026-08-12T10:00:00Z', is_me: true }
const rahul: TeamMember = { id: 'u-2', name: 'Rahul Ops', phone: '+919845070001', email: 'rahul@example.com', admin_since: '2026-09-01T10:00:00Z', is_me: false }

beforeEach(() => {
  installFakeBackend()
  db.overrides['/admin/settings/policies'] = () => json(200, policies)
  db.overrides['/admin/settings/cities'] = () => json(200, [{ name: 'Bangalore', artists: 12, bookings_30d: 40 }, { name: 'Pune', artists: 0, bookings_30d: 0 }])
})
afterEach(() => vi.unstubAllGlobals())

it('shows the booking rules read-only and the live cities', async () => {
  const user = userEvent.setup()
  db.overrides['/admin/settings/team'] = () => json(200, [me])
  renderSignedIn('/settings')

  expect(await screen.findByText('3 hours to accept a request', {}, { timeout: FIRST_RENDER_MS })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Edit/ })).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Cities' }))
  expect(await screen.findByText('Bangalore')).toBeInTheDocument()
  expect(screen.getByText('of 2 open')).toBeInTheDocument()
}, FLOW_TIMEOUT_MS)

it('adds an admin by phone and removes another, never yourself', async () => {
  const user = userEvent.setup()
  let team = [me]
  db.overrides['/admin/settings/team'] = () => {
    if (calls.at(-1)?.method === 'POST') { team = [me, rahul]; return json(201, rahul) }
    return json(200, team)
  }
  db.overrides['/admin/settings/team/u-2'] = () => { team = [me]; return json(204) }
  renderSignedIn('/settings?tab=team')

  expect(await screen.findByText('Neha Menon', {}, { timeout: FIRST_RENDER_MS })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /Add admin/ }))
  const dialog = await screen.findByRole('dialog')
  await user.type(within(dialog).getByLabelText('Mobile'), '+919845070001')
  await user.click(within(dialog).getByRole('button', { name: 'Add admin' }))
  expect(await screen.findByText('Rahul Ops')).toBeInTheDocument()
  expect(calls).toContainEqual({ method: 'POST', path: '/admin/settings/team', body: { phone: '+919845070001' } })

  await user.click(screen.getByRole('button', { name: 'Remove' }))
  await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Remove' }))
  await waitFor(() => expect(screen.queryByText('Rahul Ops')).not.toBeInTheDocument())
}, FLOW_TIMEOUT_MS)

it('shows an error when the rules can’t load', async () => {
  db.overrides['/admin/settings/policies'] = () => json(403, { code: 'forbidden', message: 'Not allowed for this account' })
  db.overrides['/admin/settings/team'] = () => json(200, [me])
  renderSignedIn('/settings')

  expect(await screen.findByText(/Couldn’t load the booking rules/, {}, { timeout: FIRST_RENDER_MS })).toBeInTheDocument()
}, FLOW_TIMEOUT_MS)
