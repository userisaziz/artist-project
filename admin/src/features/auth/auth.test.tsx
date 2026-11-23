import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ADMIN, calls, db, installFakeBackend, requests } from '@/test/fake-backend'
import { renderApp, renderSignedIn } from '@/test/render-app'

beforeEach(() => {
  installFakeBackend()
  localStorage.clear()
  sessionStorage.clear()
  window.history.pushState({}, '', '/')
})
afterEach(() => vi.unstubAllGlobals())

it('signs an admin in with phone + code and opens the Overview', async () => {
  const user = userEvent.setup()
  renderApp()
  await user.type(await screen.findByLabelText('Phone number'), '98450 00001')
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
  expect(await screen.findByText('We texted a 6-digit code to +91 98450 00001.')).toBeInTheDocument()
  await user.keyboard('123456')
  expect(await screen.findByRole('heading', { name: /Neha/ })).toBeInTheDocument()
  expect(window.location.pathname).toBe('/overview')
  expect(calls).toContainEqual({ method: 'POST', path: '/auth/otp/verify', body: { phone: '+919845000001', code: '123456' } })
  expect(db.refreshCookie).not.toBeNull() // the refresh token lives in the httpOnly cookie
})

it('without "Keep me signed in" the session lasts only for this browser session', async () => {
  const user = userEvent.setup()
  renderApp()
  await user.type(await screen.findByLabelText('Phone number'), '9845000001')
  await user.click(screen.getByLabelText('Keep me signed in on this device'))
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
  await screen.findByText(/We texted a 6-digit code/)
  await user.keyboard('123456')
  await screen.findByRole('heading', { name: /Neha/ })
  const verify = requests.find((r) => r.path === '/auth/otp/verify')
  expect(verify?.headers['x-session-transport']).toBe('cookie-session')
  expect(verify?.credentials).toBe('include')
})

it('sends a signed-out deep link to /login, then back to that page after sign-in', async () => {
  const user = userEvent.setup()
  renderApp('/bookings?status=completed')
  await user.type(await screen.findByLabelText('Phone number'), '9845000001')
  expect(window.location.pathname).toBe('/login')
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
  await screen.findByText(/We texted a 6-digit code/)
  await user.keyboard('123456')
  await waitFor(() => expect(window.location.pathname).toBe('/bookings'))
  expect(window.location.search).toBe('?status=completed')
})

it('a signed-in admin visiting /login lands on the Overview', async () => {
  renderSignedIn('/login')
  expect(await screen.findByRole('heading', { name: /Neha/ })).toBeInTheDocument()
  expect(window.location.pathname).toBe('/overview')
})

it('signing out returns to /login', async () => {
  const user = userEvent.setup()
  renderSignedIn('/overview')
  await user.click(await screen.findByRole('button', { name: 'Sign out' }))
  expect(await screen.findByLabelText('Phone number')).toBeInTheDocument()
  expect(window.location.pathname).toBe('/login')
  expect(db.refreshCookie).toBeNull()
})

it('refuses a non-admin account and stores no session', async () => {
  db.me = { ...ADMIN, roles: ['artist'], active_role: 'artist' }
  const user = userEvent.setup()
  renderApp()
  await user.click(await screen.findByRole('button', { name: 'Sign in' }))
  expect(await screen.findByText('Enter your 10-digit mobile number.')).toBeInTheDocument()
  await user.type(screen.getByLabelText('Phone number'), '9845011111')
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
  await screen.findByText(/We texted a 6-digit code/)
  await user.keyboard('123456')
  expect(await screen.findByText("This account isn't an admin.")).toBeInTheDocument()
  expect(db.refreshCookie).toBeNull() // the cookie the verify call set was revoked again
})
