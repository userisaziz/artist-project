import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { booking, db, installFakeBackend } from '@/test/fake-backend'
import { renderSignedIn } from '@/test/render-app'

beforeEach(() => {
  installFakeBackend()
  localStorage.clear()
  sessionStorage.clear()
  window.history.pushState({}, '', '/')
})
afterEach(() => vi.unstubAllGlobals())

it('the top bar search opens Bookings filtered by the query', async () => {
  db.bookings = [booking()]
  const user = userEvent.setup()
  renderSignedIn('/overview')
  await user.type(await screen.findByRole('searchbox', { name: 'Search bookings' }), 'BK-7F3K2Q{Enter}')
  expect(await screen.findByRole('heading', { name: 'Bookings' })).toBeInTheDocument()
  expect(window.location.search).toBe('?q=BK-7F3K2Q')
  expect(screen.getByRole('searchbox', { name: 'Filter bookings' })).toHaveValue('BK-7F3K2Q')
})
