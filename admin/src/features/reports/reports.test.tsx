import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { calls, db, installFakeBackend, json } from '@/test/fake-backend'
import { renderSignedIn } from '@/test/render-app'
import type { ReportSummary } from './types'

// The first render loads the lazy route chunk, which can take over the default 1s in a busy full run.
const FIRST_RENDER_MS = 5_000
/** Interactive flows click through several steps; on a loaded machine that outlasts Vitest's 5s default. */
const FLOW_TIMEOUT_MS = 20_000

// Mirrors backend app/report/schemas.py.
const summary = (overrides: Partial<ReportSummary> = {}): ReportSummary => ({
  period_days: 30, bookings: 120, bookings_previous: 100, completed: 90, completion_rate: 0.75,
  top_city: { name: 'Bangalore', share: 0.41 }, top_category: { name: 'Mehendi', share: 0.38 }, ...overrides,
})

beforeEach(() => {
  installFakeBackend()
  db.overrides['/admin/reports/summary?period=30d'] = () => json(200, summary())
  db.overrides['/admin/reports/summary?period=7d'] = () => json(200, summary({ period_days: 7, bookings: 31, bookings_previous: 40 }))
})
afterEach(() => vi.unstubAllGlobals())

it('shows booking figures for the period and switches periods', async () => {
  const user = userEvent.setup()
  renderSignedIn('/reports')

  expect(await screen.findByText('Bangalore', {}, { timeout: FIRST_RENDER_MS })).toBeInTheDocument()
  expect(screen.getByText('75%')).toBeInTheDocument()
  expect(screen.getByText('▲ 20.0%')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Last 7 days' }))
  expect(await screen.findByText('▼ 22.5%')).toBeInTheDocument()
  expect(screen.queryByText(/GMV|revenue/i)).not.toBeInTheDocument()
}, FLOW_TIMEOUT_MS)

it('downloads a report as CSV for the chosen period', async () => {
  const user = userEvent.setup()
  db.overrides['/admin/reports/bookings_by_city.csv?period=30d'] = () =>
    new Response('city,bookings,completed,cancelled\nBangalore,49,40,2\n', { status: 200, headers: { 'Content-Type': 'text/csv' } })
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:report'), revokeObjectURL: vi.fn() }))
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  renderSignedIn('/reports')

  await user.click(await screen.findByRole('button', { name: 'Download Bookings by city' }, { timeout: FIRST_RENDER_MS }))

  await waitFor(() => expect(click).toHaveBeenCalled())
  expect(calls).toContainEqual({ method: 'GET', path: '/admin/reports/bookings_by_city.csv?period=30d', body: undefined })
  click.mockRestore()
}, FLOW_TIMEOUT_MS)

it('says so when the figures can’t load', async () => {
  db.overrides['/admin/reports/summary?period=30d'] = () => json(403, { code: 'forbidden', message: 'Not allowed for this account' })
  renderSignedIn('/reports')

  expect(await screen.findByRole('alert', {}, { timeout: FIRST_RENDER_MS })).toHaveTextContent('Couldn’t load the figures')
}, FLOW_TIMEOUT_MS)
