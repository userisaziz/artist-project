import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { artist, calls, db, installFakeBackend, json } from '@/test/fake-backend'
import { renderSignedIn } from '@/test/render-app'
import type { ArtistRequirements, DirectoryRow, DirectorySummary } from '@/lib/types'

// Mirrors backend app/artist_directory/schemas.py.
const ayesha: DirectoryRow = {
  id: 'a-1', business_name: 'Ayesha Mehendi Art', photo_url: null, category: 'Mehendi', city: 'Bangalore', status: 'approved',
  rating_average: 4.9, rating_count: 128, bookings_total: 640, booking_value_30d: 24000000, open_complaints: null, created_at: '2024-03-04T10:00:00Z',
  missing_requirements: [],
}
const ink: DirectoryRow = {
  ...ayesha, id: 'a-2', business_name: 'Ink & Om Tattoo', category: 'Tattoo', city: 'Pune', status: 'pending',
  rating_average: null, rating_count: 0, bookings_total: 0, booking_value_30d: 0, created_at: '2026-10-19T05:00:00Z',
}
const summary: DirectorySummary = {
  counts: { all: 2, approved: 1, pending: 1, suspended: 0, on_hold: 0 }, active_artists: 1, new_this_month: 1, avg_rating: 4.9,
  total_reviews: 128, median_response_minutes: 14, at_risk: 0,
}

beforeEach(() => {
  installFakeBackend()
  db.overrides['/admin/artists/directory/summary'] = () => json(200, summary)
  db.overrides['/admin/artists/directory?status=all&limit=20'] = () => json(200, { items: [ink, ayesha], next_cursor: null })
  db.overrides['/admin/requirements/a-1'] = () => json(200, { on_hold: false, items: [] })
})
afterEach(() => vi.unstubAllGlobals())

it('lists every artist with counts, KPIs and filters by status chip', async () => {
  const user = userEvent.setup()
  db.overrides['/admin/artists/directory?status=pending&limit=20'] = () => json(200, { items: [ink], next_cursor: null })
  renderSignedIn('/artist-directory')

  const row = await screen.findByRole('link', { name: /Ayesha Mehendi Art/ }, { timeout: 4000 }) // first render compiles the lazy page
  expect(row).toHaveAttribute('href', '/artists/a-1')
  expect(within(row).getByText('★ 4.9')).toBeInTheDocument()
  expect(within(row).getByText('₹2.4L')).toBeInTheDocument()
  expect(within(row).getByText(/640 bookings/)).toBeInTheDocument()
  expect(within(screen.getByRole('link', { name: /Ink & Om Tattoo/ })).getByText('Pending review')).toBeInTheDocument()
  expect(within(screen.getByRole('group', { name: 'Avg. rating' })).getByText('4.9')).toBeInTheDocument()
  expect(within(screen.getByRole('group', { name: 'Response time' })).getByText('14 min')).toBeInTheDocument()
  expect(within(screen.getByRole('link', { name: /^Artists/ })).getByText('2')).toBeInTheDocument() // sidebar count

  await user.click(screen.getByRole('button', { name: 'Pending 1' }))
  await waitFor(() => expect(screen.queryByText('Ayesha Mehendi Art')).not.toBeInTheDocument())
  expect(window.location.search).toBe('?status=pending')
  expect(screen.getByText('Ink & Om Tattoo')).toBeInTheDocument()
})

it('shows an error when the directory can’t load', async () => {
  db.overrides['/admin/artists/directory?status=all&limit=20'] = () => json(403, { code: 'forbidden', message: 'Admins only' })
  renderSignedIn('/artist-directory')
  expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t load artists.')
})

it('suspending an approved artist needs a reason, then Reinstate brings them back', async () => {
  db.artist = artist({ status: 'approved' })
  // Like the backend, the detail reads back the new status after each change.
  db.overrides['/admin/artists/a-1/suspend'] = () => {
    db.artist = { ...db.artist, status: 'suspended' }
    return json(200, { id: 'a-1', status: 'suspended', suspension_reason: 'No-shows', suspended_at: '2026-10-19T10:00:00Z' })
  }
  db.overrides['/admin/artists/a-1/reinstate'] = () => {
    db.artist = { ...db.artist, status: 'approved' }
    return json(200, { id: 'a-1', status: 'approved', suspension_reason: null, suspended_at: null })
  }
  const user = userEvent.setup()
  renderSignedIn('/artists/a-1')

  await user.click(await screen.findByRole('button', { name: 'Suspend artist' }))
  const dialog = await screen.findByRole('dialog')
  await user.click(within(dialog).getByRole('button', { name: 'Suspend' }))
  expect(within(dialog).getByText('Add a reason for suspending.')).toBeInTheDocument()
  expect(calls.some((c) => c.path.endsWith('/suspend'))).toBe(false)

  await user.type(within(dialog).getByLabelText('Reason'), 'No-shows')
  await user.click(within(dialog).getByRole('button', { name: 'Suspend' }))
  expect(await screen.findByText(/can’t take new bookings until reinstated/)).toBeInTheDocument()
  expect(calls).toContainEqual({ method: 'POST', path: '/admin/artists/a-1/suspend', body: { reason: 'No-shows' } })

  await user.click(screen.getByRole('button', { name: 'Reinstate' }))
  expect(await screen.findByRole('button', { name: 'Suspend artist' })).toBeInTheDocument()
  expect(calls).toContainEqual({ method: 'POST', path: '/admin/artists/a-1/reinstate', body: undefined })
})

it('the On hold chip lists artists missing a mandatory item, with what is missing', async () => {
  const user = userEvent.setup()
  const held: DirectoryRow = { ...ayesha, id: 'a-3', business_name: 'Henna by Noor', missing_requirements: ['location'] }
  db.overrides['/admin/artists/directory?status=on_hold&limit=20'] = () => json(200, { items: [held], next_cursor: null })
  renderSignedIn('/artist-directory')

  await screen.findByRole('link', { name: /Ayesha Mehendi Art/ }, { timeout: 4000 })
  await user.click(screen.getByRole('button', { name: /On hold/ }))
  const row = await screen.findByRole('link', { name: /Henna by Noor/ })
  expect(within(row).getByText('Missing location')).toBeInTheDocument()
})

it('an artist missing a requirement shows it on their page, and Remind notifies them', async () => {
  const user = userEvent.setup()
  db.artist = artist({ status: 'approved' })
  // Mirrors backend app/requirement/schemas.py MyRequirements.
  const pending: ArtistRequirements = {
    on_hold: true,
    items: [{ key: 'location', title: 'Add your studio location', body: 'Clients nearby can only find you once…', action: '/artist/location', due_at: '2026-10-20T10:00:00Z', overdue: true }],
  }
  db.overrides['/admin/requirements/a-1'] = () => json(200, pending)
  db.overrides['/admin/requirements/a-1/remind'] = () => json(204)
  renderSignedIn('/artists/a-1')

  const card = await screen.findByRole('region', { name: 'Profile requirements' }, { timeout: 4000 })
  expect(within(card).getByText('On hold')).toBeInTheDocument()
  expect(within(card).getByText('Add your studio location')).toBeInTheDocument()
  await user.click(within(card).getByRole('button', { name: 'Remind artist' }))
  await waitFor(() => expect(calls).toContainEqual({ method: 'POST', path: '/admin/requirements/a-1/remind', body: undefined }))
})
