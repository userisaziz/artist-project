import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db, installFakeBackend, requests, type RefreshFailure } from '@/test/fake-backend'
import { renderApp, renderSignedIn } from '@/test/render-app'

// Session lifecycle against the cookie contract: the refresh token is an httpOnly `ac_refresh` cookie
// the app never sees; the access token lives in memory only.

beforeEach(() => {
  installFakeBackend()
  localStorage.clear()
  sessionStorage.clear()
  window.history.pushState({}, '', '/')
})
afterEach(() => vi.unstubAllGlobals())

const refreshCalls = () => requests.filter((r) => r.path === '/auth/refresh')

/** Every value in web storage: tokens must never land there. */
const storedValues = (storage: Storage) => Array.from({ length: storage.length }, (_, i) => storage.getItem(storage.key(i) ?? '') ?? '')

async function signInThroughTheForm(keepSignedIn = true) {
  const user = userEvent.setup()
  await user.type(await screen.findByLabelText('Phone number'), '9845000001')
  if (!keepSignedIn) await user.click(screen.getByLabelText('Keep me signed in on this device'))
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
  await screen.findByText(/We texted a 6-digit code/)
  await user.keyboard('123456')
  await screen.findByRole('heading', { name: /Neha/ })
}

it('restores the session on load from the refresh cookie, sending no body', async () => {
  renderSignedIn('/overview')
  expect(await screen.findByRole('heading', { name: /Neha/ })).toBeInTheDocument()
  const [refresh] = refreshCalls()
  expect(refresh.credentials).toBe('include')
  expect(refresh.headers['x-session-transport']).toBe('cookie')
  expect(refresh.body).toBeUndefined()
})

it('always tries one refresh on load, and without a cookie lands on sign-in', async () => {
  renderApp('/overview')
  expect(await screen.findByLabelText('Phone number')).toBeInTheDocument()
  expect(window.location.pathname).toBe('/login')
  expect(refreshCalls()).toHaveLength(1)
})

it('shows a labelled loading state while the session is being restored', async () => {
  let release = () => {}
  db.holdRefresh = new Promise<void>((resolve) => { release = resolve })
  renderSignedIn('/overview')
  expect(await screen.findByRole('status', { name: 'Restoring your session' })).toBeInTheDocument()
  release()
  expect(await screen.findByRole('heading', { name: /Neha/ })).toBeInTheDocument()
  expect(screen.queryByRole('status', { name: 'Restoring your session' })).not.toBeInTheDocument()
})

it.each<[string, RefreshFailure]>([
  ['the network is down', 'network'],
  ['the server answers 503', 503],
  ['the server rate-limits (429)', 429],
])('keeps the session when %s on load, and Retry restores it', async (_, failure) => {
  const user = userEvent.setup()
  db.refreshFailure = failure
  renderSignedIn('/bookings')
  const alert = await screen.findByRole('alert')
  expect(within(alert).getByText(/couldn’t reach GetReady/i)).toBeInTheDocument()
  expect(window.location.pathname).toBe('/bookings') // not bounced to sign-in
  expect(db.refreshCookie).not.toBeNull()

  db.refreshFailure = null
  await user.click(within(alert).getByRole('button', { name: 'Retry' }))
  expect(await screen.findByRole('heading', { name: 'Bookings' })).toBeInTheDocument()
})

it('sign-in sends X-Session-Transport: cookie with credentials, and the reload refresh re-sends it', async () => {
  const first = renderApp('/login')
  await signInThroughTheForm(true)
  const verify = requests.find((r) => r.path === '/auth/otp/verify')
  expect(verify?.headers['x-session-transport']).toBe('cookie')
  expect(verify?.credentials).toBe('include')

  first.unmount()
  renderApp('/overview') // a page reload: memory is gone, only the cookie remains
  expect(await screen.findByRole('heading', { name: /Neha/ })).toBeInTheDocument()
  expect(refreshCalls().at(-1)?.headers['x-session-transport']).toBe('cookie')
})

it('"this browser session only" re-sends cookie-session on reload', async () => {
  const first = renderApp('/login')
  await signInThroughTheForm(false)
  first.unmount()
  renderApp('/overview')
  expect(await screen.findByRole('heading', { name: /Neha/ })).toBeInTheDocument()
  expect(refreshCalls().at(-1)?.headers['x-session-transport']).toBe('cookie-session')
})

it('never writes a token to localStorage or sessionStorage, and purges a legacy one', async () => {
  localStorage.setItem('atelier-admin.refresh', 'legacy-refresh-token')
  renderApp('/login')
  await signInThroughTheForm(true)
  for (const value of [...storedValues(localStorage), ...storedValues(sessionStorage)]) {
    expect(value).not.toMatch(/access|refresh/)
  }
  expect(localStorage.getItem('atelier-admin.refresh')).toBeNull()
  expect(sessionStorage.length).toBe(0)
})

it('sign-out calls /auth/logout with the cookie, then returns to sign-in', async () => {
  const user = userEvent.setup()
  renderSignedIn('/overview')
  await user.click(await screen.findByRole('button', { name: 'Sign out' }))
  expect(await screen.findByLabelText('Phone number')).toBeInTheDocument()
  expect(window.location.pathname).toBe('/login')
  const logout = requests.find((r) => r.path === '/auth/logout')
  expect(logout?.credentials).toBe('include')
  expect(logout?.body).toBeUndefined()
  expect(db.refreshCookie).toBeNull()
})

it('signs out locally even when /auth/logout cannot be reached', async () => {
  const user = userEvent.setup()
  db.logoutFails = true
  renderSignedIn('/overview')
  await user.click(await screen.findByRole('button', { name: 'Sign out' }))
  expect(await screen.findByLabelText('Phone number')).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: /Neha/ })).not.toBeInTheDocument()
})

it('a session that expires mid-use goes back to sign-in without an error toast', async () => {
  const user = userEvent.setup()
  renderSignedIn('/artists/a-1')
  const approve = await screen.findByRole('button', { name: 'Approve & publish' })
  db.accessRevoked = true // the access token is no longer accepted…
  db.refreshCookie = null // …and the refresh cookie is gone too
  await user.click(approve)
  expect(await screen.findByLabelText('Phone number')).toBeInTheDocument()
  expect(window.location.pathname).toBe('/login')
  expect(screen.queryByText(/session has expired|Not signed in|Something went wrong/i)).not.toBeInTheDocument()
})
