import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { calls, db, installFakeBackend, json } from '@/test/fake-backend'
import { renderSignedIn } from '@/test/render-app'

beforeEach(() => {
  installFakeBackend()
  localStorage.clear()
  sessionStorage.clear()
  window.history.pushState({}, '', '/')
})
afterEach(() => vi.unstubAllGlobals())

it('lands on the Overview by default, with KPIs, the weekly chart and the first pending artists', async () => {
  const user = userEvent.setup()
  renderSignedIn('/')
  expect(await screen.findByRole('heading', { name: /Neha/ })).toBeInTheDocument()
  expect(window.location.pathname).toBe('/overview')
  expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page')

  const kpi = (label: string) => screen.getByRole('group', { name: label })
  await screen.findByText('₹42.6L')
  expect(within(kpi('Gross bookings')).getByText('₹42.6L')).toBeInTheDocument()
  expect(within(kpi('Gross bookings')).getByText('▲ 12.4%')).toBeInTheDocument() // against the previous 30 days
  expect(within(kpi('Bookings')).getByText('1,284')).toBeInTheDocument()
  expect(within(kpi('New artists')).getByText('86')).toBeInTheDocument()
  expect(within(kpi('New artists')).getByText('1 pending review')).toBeInTheDocument()
  expect(within(kpi('Awaiting artist')).getByText('42')).toBeInTheDocument()

  expect(screen.getAllByRole('listitem', { name: /^Week of/ })).toHaveLength(12)
  expect(screen.getByRole('listitem', { name: 'Week of 12 Oct: 21 bookings' })).toBeInTheDocument()
  expect(screen.getByRole('listitem', { name: 'Week of 27 Jul: 10 bookings' })).toBeInTheDocument()

  const artistLink = await screen.findByRole('link', { name: /Ayesha Mehendi Art/ })
  expect(artistLink).toHaveAttribute('href', '/artists/a-1')
  await user.click(screen.getByRole('link', { name: 'Open queue' }))
  expect(await screen.findByRole('heading', { name: 'Verification queue' })).toBeInTheDocument()
})

it('the Overview city and date range filters go to the URL and the overview request', async () => {
  const user = userEvent.setup()
  renderSignedIn('/overview')
  await user.click(await screen.findByRole('combobox', { name: 'Date range' }))
  await user.click(await screen.findByRole('option', { name: 'Last 7 days' }))
  await waitFor(() => expect(window.location.search).toBe('?period=7d'))
  await waitFor(() => expect(calls.some((c) => c.path === '/admin/overview?period=7d')).toBe(true))

  await user.click(screen.getByRole('combobox', { name: 'City' }))
  await user.click(await screen.findByRole('option', { name: 'Mumbai' }))
  await waitFor(() => expect(calls.some((c) => c.path === '/admin/overview?period=7d&city=Mumbai')).toBe(true))
})

it('shows an error state when the overview fails to load', async () => {
  db.overrides['/admin/overview'] = () => json(500, { code: 'server_error', message: 'Database unavailable' })
  renderSignedIn('/overview')
  // A 500 is retried twice (about 1 s + 2 s, src/lib/query-client.ts) before the error shows.
  expect(await screen.findByText(/Couldn’t load the overview\./, {}, { timeout: 5000 })).toBeInTheDocument()
})
