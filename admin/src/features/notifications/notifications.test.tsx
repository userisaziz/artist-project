import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { calls, db, installFakeBackend, json } from '@/test/fake-backend'
import { renderSignedIn } from '@/test/render-app'
import type { AdminNotification } from './types'

// Mirrors backend NotificationOut for an admin (console links).
const submitted: AdminNotification = {
  id: 'n-1', kind: 'artist_submitted', title: 'New artist to review', body: 'Ayesha Mehendi Art · Bangalore',
  link: '/artists/a-1', read_at: null, created_at: '2026-10-21T09:00:00Z',
}
const ticket: AdminNotification = {
  id: 'n-2', kind: 'ticket_opened', title: 'Urgent support ticket', body: 'T-7720 · Customer didn’t show up',
  link: '/support?ticket=t-1', read_at: null, created_at: '2026-10-21T08:00:00Z',
}

beforeEach(() => installFakeBackend())
afterEach(() => vi.unstubAllGlobals())

it('the sidebar counts unread notifications; opening one marks it read and goes to it', async () => {
  db.notifications = [submitted, ticket]
  const user = userEvent.setup()
  renderSignedIn('/notifications')

  const nav = await screen.findByRole('navigation', { name: 'Primary' }, { timeout: 4000 })
  expect(await within(nav).findByText('2')).toBeInTheDocument()
  await user.click(await screen.findByRole('button', { name: /Unread: New artist to review/ }))

  await waitFor(() => expect(calls).toContainEqual({ method: 'POST', path: '/notifications/read', body: { ids: ['n-1'] } }))
  expect(await screen.findByRole('button', { name: 'Approve & publish' }, { timeout: 4000 })).toBeInTheDocument() // the artist's review page
})

it('marks everything read at once, and says so when there is nothing', async () => {
  db.notifications = [submitted, ticket]
  const user = userEvent.setup()
  renderSignedIn('/notifications')

  await user.click(await screen.findByRole('button', { name: 'Mark all read' }, { timeout: 4000 }))
  await waitFor(() => expect(calls).toContainEqual({ method: 'POST', path: '/notifications/read', body: { ids: null } }))
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Mark all read' })).not.toBeInTheDocument())

  db.notifications = []
  renderSignedIn('/notifications')
  expect(await screen.findByText('Nothing yet. New submissions, tickets and reports show up here.', {}, { timeout: 4000 })).toBeInTheDocument()
})

it('shows an error when the inbox can’t load', async () => {
  db.overrides['/notifications'] = () => json(500, { code: 'server_error', message: 'Database unavailable' })
  renderSignedIn('/notifications')
  expect(await screen.findByRole('alert', {}, { timeout: 5000 })).toHaveTextContent('Couldn’t load notifications.')
})
