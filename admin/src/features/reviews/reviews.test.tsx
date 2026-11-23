import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { calls, db, installFakeBackend, json, review } from '@/test/fake-backend'
import { renderSignedIn } from '@/test/render-app'

beforeEach(() => {
  installFakeBackend()
  localStorage.clear()
  sessionStorage.clear()
  window.history.pushState({}, '', '/')
})
afterEach(() => vi.unstubAllGlobals())

const LONG_TEXT = 'Total scam, never showed up on the day. Call me on 98450 12345 and I will tell you everything about it.'

function reviewQueue() {
  return [
    review(),
    review({ id: 'r-2', rating: 1, text: LONG_TEXT, reviewer_name: 'Vikram T.', status: 'hidden', flag: 'contact_info', report_reason: null, reply: null, replied_at: null, artist: { id: 'a-2', business_name: 'Ink & Om Tattoo' } }),
    review({ id: 'r-3', reviewer_name: 'Kiran M.', status: 'hidden', flag: 'blocked_word', report_reason: null, moderated_at: '2026-10-16T09:00:00Z', artist: { id: 'a-3', business_name: 'Lens & Light' } }), // already decided: not in the badge
    review({ id: 'r-4', rating: 5, reviewer_name: 'Sneha K.', status: 'published', flag: null, report_reason: null, artist: { id: 'a-4', business_name: 'Meher by Riya' } }),
  ]
}

it('the Reviews queue lists flagged reviews by default and filters by status chip', async () => {
  db.reviews = reviewQueue()
  const user = userEvent.setup()
  renderSignedIn('/reviews')
  expect(await screen.findByText('Priya R. → Ayesha Mehendi Art')).toBeInTheDocument()
  const row = screen.getByText('Priya R. → Ayesha Mehendi Art').closest('button, a') as HTMLElement
  expect(within(row).getByText('Bridal Classic · Oct 2026')).toBeInTheDocument()
  expect(within(row).getByText('★ 2')).toBeInTheDocument()
  expect(within(row).getByText('Reported by artist')).toBeInTheDocument()
  expect(within(row).getByText('Flagged')).toBeInTheDocument()
  expect(screen.queryByText('Vikram T. → Ink & Om Tattoo')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Flagged' })).toHaveAttribute('aria-pressed', 'true')
  expect(calls.some((c) => c.path.startsWith('/admin/reviews?') && c.path.includes('status=flagged') && c.path.includes('limit=20'))).toBe(true)
  // nav badge: 1 flagged + 1 hidden that no moderator has decided on
  await waitFor(() => expect(within(screen.getByRole('link', { name: /Reviews/ })).getByText('2')).toBeInTheDocument())

  await user.click(screen.getByRole('button', { name: 'Hidden' }))
  expect(await screen.findByText('Vikram T. → Ink & Om Tattoo')).toBeInTheDocument()
  expect(screen.queryByText('Priya R. → Ayesha Mehendi Art')).not.toBeInTheDocument()
  expect(window.location.search).toBe('?status=hidden')
  const hidden = screen.getByText('Vikram T. → Ink & Om Tattoo').closest('button, a') as HTMLElement
  expect(within(hidden).getByText(`“${LONG_TEXT.slice(0, 80)}…”`)).toBeInTheDocument()
  expect(within(hidden).getByText('Contact details')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Published' }))
  const published = (await screen.findByText('Sneha K. → Meher by Riya')).closest('button, a') as HTMLElement
  expect(within(published).getByText('—')).toBeInTheDocument() // no flag
})

it('the review detail explains the flag and publishes with a note', async () => {
  db.reviews = reviewQueue()
  const user = userEvent.setup()
  renderSignedIn('/reviews')
  await user.click(await screen.findByText('Priya R. → Ayesha Mehendi Art'))
  const panel = await screen.findByRole('dialog')
  expect(within(panel).getByText('Half the flowers were missing and the stage was set up two hours late.')).toBeInTheDocument()
  expect(within(panel).getByText('We are sorry, the supplier let us down.')).toBeInTheDocument()
  expect(within(panel).getByText('Reported by the artist')).toBeInTheDocument()
  expect(within(panel).getByText('This customer never booked this service')).toBeInTheDocument()
  expect(within(panel).getByText('+919845022222')).toBeInTheDocument()
  expect(within(panel).getByRole('link', { name: 'BK-7F3K2Q' })).toHaveAttribute('href', '/bookings/b-1')
  expect(within(panel).getByRole('button', { name: 'Hide' })).toBeInTheDocument()
  expect(within(panel).getByRole('button', { name: 'Remove' })).toBeInTheDocument()

  await user.type(within(panel).getByLabelText('Internal note'), 'Booking BK-7F3K2Q is real; the review stands')
  await user.click(within(panel).getByRole('button', { name: 'Publish' }))
  expect(await within(panel).findByText('Published')).toBeInTheDocument()
  expect(calls).toContainEqual({ method: 'POST', path: '/admin/reviews/r-1/decision', body: { decision: 'publish', note: 'Booking BK-7F3K2Q is real; the review stands' } })
  expect(within(panel).queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument() // already published
  expect(within(panel).getByRole('button', { name: 'Hide' })).toBeInTheDocument()

  await user.click(within(panel).getByRole('button', { name: 'Close' }))
  await waitFor(() => expect(screen.queryByText('Priya R. → Ayesha Mehendi Art')).not.toBeInTheDocument()) // left the Flagged queue
})

it('removing a review asks for confirmation first', async () => {
  db.reviews = reviewQueue()
  const user = userEvent.setup()
  renderSignedIn('/reviews?status=hidden')
  await user.click(await screen.findByText('Vikram T. → Ink & Om Tattoo'))
  const panel = await screen.findByRole('dialog')
  expect(within(panel).getByText('Contains contact details')).toBeInTheDocument()
  expect(within(panel).queryByRole('button', { name: 'Hide' })).not.toBeInTheDocument() // already hidden

  await user.click(within(panel).getByRole('button', { name: 'Remove' }))
  let confirm = await screen.findByRole('alertdialog')
  expect(within(confirm).getByText('Remove this review?')).toBeInTheDocument()
  await user.click(within(confirm).getByRole('button', { name: 'Keep it' }))
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  expect(calls.some((c) => c.path.endsWith('/decision'))).toBe(false)

  await user.click(within(panel).getByRole('button', { name: 'Remove' }))
  confirm = await screen.findByRole('alertdialog')
  await user.click(within(confirm).getByRole('button', { name: 'Remove review' }))
  expect(await within(panel).findByText('Removed')).toBeInTheDocument()
  expect(calls).toContainEqual({ method: 'POST', path: '/admin/reviews/r-2/decision', body: { decision: 'remove' } })
  for (const name of ['Publish', 'Hide', 'Remove']) expect(within(panel).queryByRole('button', { name })).not.toBeInTheDocument()
})

it('the sidebar shows the flagged reviews count beside Reviews, linking to the queue', async () => {
  db.reviews = [review({ id: 'r-1' }), review({ id: 'r-2' }), review({ id: 'r-3' })]
  renderSignedIn('/overview')
  const reviews = await screen.findByRole('link', { name: /^Reviews/ })
  expect(reviews).toHaveAttribute('href', '/reviews')
  expect(await within(reviews).findByText('3')).toBeInTheDocument()
})

it('shows an error state when the Reviews queue fails to load', async () => {
  db.overrides['/admin/reviews'] = () => json(500, { code: 'server_error', message: 'Database unavailable' })
  renderSignedIn('/reviews')
  // A 500 is retried twice (about 1 s + 2 s, src/lib/query-client.ts) before the error shows.
  expect(await screen.findByText(/Couldn’t load reviews\./, {}, { timeout: 5000 })).toBeInTheDocument()
})
