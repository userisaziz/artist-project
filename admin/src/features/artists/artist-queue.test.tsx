import { screen } from '@testing-library/react'
import { artist, db, installFakeBackend } from '@/test/fake-backend'
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
