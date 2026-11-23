import { screen } from '@testing-library/react'
import { artist, db, installFakeBackend, json } from '@/test/fake-backend'
import { renderSignedIn } from '@/test/render-app'

beforeEach(() => installFakeBackend())
afterEach(() => vi.unstubAllGlobals())

it('marks an artist who edited an approved profile as a re-review', async () => {
  db.artist = artist({ reviewed_at: '2026-09-02T10:00:00Z' }) // approved before, then reopened and resubmitted
  renderSignedIn('/artists')
  expect(await screen.findByText('Ayesha Mehendi Art')).toBeInTheDocument()
  expect(screen.getByText('Re-review')).toBeInTheDocument()
})

it('a first submission has no re-review mark', async () => {
  renderSignedIn('/artists')
  expect(await screen.findByText('Ayesha Mehendi Art')).toBeInTheDocument()
  expect(screen.queryByText('Re-review')).not.toBeInTheDocument()
})

it('shows an error state when the Verification queue fails to load', async () => {
  db.overrides['/admin/artists'] = () => json(500, { code: 'server_error', message: 'Database unavailable' })
  renderSignedIn('/artists')
  // A 500 is retried twice (about 1 s + 2 s, src/lib/query-client.ts) before the error shows.
  expect(await screen.findByText(/Couldn’t load artists\./, {}, { timeout: 5000 })).toBeInTheDocument()
})
