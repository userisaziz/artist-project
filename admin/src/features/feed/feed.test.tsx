import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { calls, db, installFakeBackend, json } from '@/test/fake-backend'
import { renderSignedIn } from '@/test/render-app'
import type { AdminPost } from './types'

// The first render loads the lazy route chunk, which can take over the default 1s in a busy full run.
const FIRST_RENDER_MS = 5_000
/** Interactive flows click through several steps; on a loaded machine that outlasts Vitest's 5s default. */
const FLOW_TIMEOUT_MS = 20_000

// Mirrors backend AdminPostOut (app/feed/schemas.py).
const post = (overrides: Partial<AdminPost> = {}): AdminPost => ({
  id: 'p-1', kind: 'photos', topic: 'look', title: null, text: 'Priya’s bridal set', excerpt: null, cover_url: null,
  photos: [{ url: 'https://fake.storage/full/p1.jpg', width: 1080, height: 1350 }],
  artist: { id: 'a-1', business_name: 'Ayesha Mehendi Art', city: 'Bangalore' },
  like_count: 1200, featured: false, moderation: 'live', report_count: 2, moderation_note: null, created_at: '2026-10-19T09:00:00Z',
  ...overrides,
})
const summary = { counts: { all: 3, featured: 1, reported: 1, hidden: 0 }, posts_7d: 3, featured_slots: 12 }

beforeEach(() => {
  installFakeBackend()
  db.overrides['/admin/feed/summary'] = () => json(200, summary)
})
afterEach(() => vi.unstubAllGlobals())

it('lists posts with reports and keeps a reported one, clearing its reports', async () => {
  const user = userEvent.setup()
  let current = post()
  db.overrides['/admin/feed/posts?view=all&limit=20'] = () => json(200, { items: [current], next_cursor: null })
  db.overrides['/admin/feed/posts/p-1/moderate'] = () => { current = post({ report_count: 0 }); return json(200, current) }
  renderSignedIn('/feed')

  expect(await screen.findByText('Priya’s bridal set', {}, { timeout: FIRST_RENDER_MS })).toBeInTheDocument()
  expect(screen.getByText('Reported', { selector: 'span' })).toBeInTheDocument()
  expect(screen.getByText('1 / 12')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Keep' }))
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Keep' })).not.toBeInTheDocument())
  expect(calls).toContainEqual({ method: 'POST', path: '/admin/feed/posts/p-1/moderate', body: { decision: 'keep' } })
}, FLOW_TIMEOUT_MS)

it('removes a post only after confirming', async () => {
  const user = userEvent.setup()
  db.overrides['/admin/feed/posts?view=all&limit=20'] = () => json(200, { items: [post({ report_count: 0 })], next_cursor: null })
  db.overrides['/admin/feed/posts/p-1/moderate'] = () => json(200, post({ moderation: 'removed', report_count: 0 }))
  renderSignedIn('/feed')

  await user.click(await screen.findByRole('button', { name: 'Remove' }, { timeout: FIRST_RENDER_MS }))
  const dialog = await screen.findByRole('alertdialog')
  expect(within(dialog).getByText('Remove this post?')).toBeInTheDocument()
  await user.click(within(dialog).getByRole('button', { name: 'Remove' }))

  await waitFor(() => expect(calls).toContainEqual({ method: 'POST', path: '/admin/feed/posts/p-1/moderate', body: { decision: 'remove' } }))
}, FLOW_TIMEOUT_MS)

it('features a post', async () => {
  const user = userEvent.setup()
  db.overrides['/admin/feed/posts?view=all&limit=20'] = () => json(200, { items: [post({ report_count: 0 })], next_cursor: null })
  db.overrides['/admin/feed/posts/p-1/feature'] = () => json(200, post({ report_count: 0, featured: true }))
  renderSignedIn('/feed')

  await user.click(await screen.findByRole('button', { name: 'Feature' }, { timeout: FIRST_RENDER_MS }))

  await waitFor(() => expect(calls).toContainEqual({ method: 'POST', path: '/admin/feed/posts/p-1/feature', body: undefined }))
}, FLOW_TIMEOUT_MS)

it('shows an error when posts can’t load', async () => {
  db.overrides['/admin/feed/posts?view=all&limit=20'] = () => json(403, { code: 'forbidden', message: 'Not allowed for this account' })
  renderSignedIn('/feed')

  expect(await screen.findByText(/Couldn’t load posts/, {}, { timeout: FIRST_RENDER_MS })).toBeInTheDocument()
}, FLOW_TIMEOUT_MS)
