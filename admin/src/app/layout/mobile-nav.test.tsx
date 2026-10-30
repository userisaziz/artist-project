import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { installFakeBackend } from '@/test/fake-backend'
import { renderSignedIn } from '@/test/render-app'

beforeEach(() => installFakeBackend())
afterEach(() => vi.unstubAllGlobals())

it('opens the navigation drawer from the top bar and closes it once a page is picked', async () => {
  const user = userEvent.setup()
  renderSignedIn('/bookings')
  await user.click(await screen.findByRole('button', { name: 'Open navigation' }))

  const drawer = await screen.findByRole('dialog', { name: 'Navigation' })
  await user.click(within(drawer).getByRole('link', { name: 'Overview' }))

  await waitFor(() => expect(window.location.pathname).toBe('/overview'))
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Navigation' })).not.toBeInTheDocument())
})

it('closes the navigation drawer from its close button without leaving the page', async () => {
  const user = userEvent.setup()
  renderSignedIn('/bookings')
  await user.click(await screen.findByRole('button', { name: 'Open navigation' }))

  const drawer = await screen.findByRole('dialog', { name: 'Navigation' })
  await user.click(within(drawer).getByRole('button', { name: 'Close' }))

  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Navigation' })).not.toBeInTheDocument())
  expect(window.location.pathname).toBe('/bookings')
})

it('on a phone the Overview filters open the page, since the top bar has no room for them', async () => {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {} }))
  renderSignedIn('/overview')

  const main = await screen.findByRole('main')
  expect(await within(main).findByRole('combobox', { name: 'Date range' })).toBeInTheDocument()
  expect(within(screen.getByRole('banner')).queryByRole('combobox', { name: 'Date range' })).not.toBeInTheDocument()
})
