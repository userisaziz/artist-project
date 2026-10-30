import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { calls, db, installFakeBackend } from '@/test/fake-backend'
import { renderSignedIn } from '@/test/render-app'
import type { AdminBroadcast } from './types'

// Mirrors backend BroadcastOut (models.py notification_broadcast).
const sentRow: AdminBroadcast = {
  id: 'bc-1', title: 'Festive slots open', body: 'Book early for November.', link: '/customer/discover',
  segment: 'all_users', filters: { city: 'Bangalore' }, recipient_count: 2, push_count: 1, created_at: '2026-10-31T09:00:00Z',
}

beforeEach(() => installFakeBackend())
afterEach(() => vi.unstubAllGlobals())

it('lists past sends with their audience and reach', async () => {
  db.broadcasts = [sentRow]
  renderSignedIn('/broadcasts')

  const row = (await screen.findByText('Festive slots open', {}, { timeout: 4000 })).closest('tr')
  expect(row).not.toBeNull()
  // "Everyone" also labels the audience picker, so read the table row itself.
  expect(within(row as HTMLElement).getByText('Everyone')).toBeInTheDocument()
  expect(within(row as HTMLElement).getByText('2 people · 1 with push')).toBeInTheDocument()
})

it('previews the audience, confirms, and sends', async () => {
  const user = userEvent.setup()
  renderSignedIn('/broadcasts')

  await user.type(await screen.findByLabelText('Title', {}, { timeout: 4000 }), 'Festive slots open')
  await user.type(screen.getByLabelText('Message'), 'Book early for November.')

  expect(await screen.findByText('This will reach 2 people, 1 with push.', {}, { timeout: 4000 })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Send broadcast' }))
  await user.click(await screen.findByRole('button', { name: 'Send now' }))

  await waitFor(() =>
    expect(calls).toContainEqual({
      method: 'POST',
      path: '/admin/broadcasts',
      body: expect.objectContaining({ segment: 'all_users', title: 'Festive slots open', body: 'Book early for November.' }),
    }),
  )
})

it('refuses to send to an empty audience', async () => {
  const user = userEvent.setup()
  renderSignedIn('/broadcasts')

  await user.click(await screen.findByLabelText('Audience', {}, { timeout: 4000 }))
  await user.click(await screen.findByRole('option', { name: 'All customers' }))
  await user.type(await screen.findByLabelText('Title'), 'Hello')
  await user.type(screen.getByLabelText('Message'), 'Nobody here')

  expect(await screen.findByText('No one matches this audience yet.', {}, { timeout: 4000 })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Send broadcast' })).toBeDisabled()
})

it('blocks an invalid deep link', async () => {
  const user = userEvent.setup()
  renderSignedIn('/broadcasts')

  await user.type(await screen.findByLabelText('Title', {}, { timeout: 4000 }), 'Hi')
  await user.type(screen.getByLabelText('Message'), 'There')
  await user.type(screen.getByLabelText('Link (optional)'), 'https://example.com')

  expect(await screen.findByText('Link must be an in-app path starting with /')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Send broadcast' })).toBeDisabled()
})
