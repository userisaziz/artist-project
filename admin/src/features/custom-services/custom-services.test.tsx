import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { calls, customService, db, installFakeBackend, json } from '@/test/fake-backend'
import { renderSignedIn } from '@/test/render-app'

beforeEach(() => {
  installFakeBackend()
  localStorage.clear()
  sessionStorage.clear()
  window.history.pushState({}, '', '/')
})
afterEach(() => vi.unstubAllGlobals())

it('approves a custom service from the queue', async () => {
  db.customServices = [customService()]
  const user = userEvent.setup()
  renderSignedIn('/custom-services')
  expect(await screen.findByText('Glitter mehendi')).toBeInTheDocument()
  expect(screen.getByText('Mehendi › Bridal')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Ayesha Mehendi Art' })).toHaveAttribute('href', '/artists/a-1')
  expect(within(screen.getByRole('link', { name: /Custom services/ })).getByText('1')).toBeInTheDocument() // nav badge

  await user.click(screen.getByRole('button', { name: 'Approve Glitter mehendi' }))
  // Approving makes it bookable, so it's confirmed first.
  const confirm = await screen.findByRole('alertdialog', { name: 'Approve “Glitter mehendi”?' })
  expect(confirm).toHaveTextContent('customers can book it straight away')
  expect(calls.some((c) => c.path.endsWith('/approve'))).toBe(false)
  await user.click(within(confirm).getByRole('button', { name: 'Approve' }))
  expect(await screen.findByText('No custom services waiting for review.')).toBeInTheDocument()
  expect(calls).toContainEqual({ method: 'POST', path: '/admin/custom-services/cs-1/approve', body: undefined })
})

it('rejecting a custom service needs a reason', async () => {
  db.customServices = [customService()]
  const user = userEvent.setup()
  renderSignedIn('/custom-services')
  await user.click(await screen.findByRole('button', { name: 'Reject Glitter mehendi' }))
  await user.type(within(await screen.findByRole('dialog')).getByLabelText('What needs fixing'), 'Draft note')
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

  await user.click(screen.getByRole('button', { name: 'Reject Glitter mehendi' }))
  const dialog = await screen.findByRole('dialog')
  expect(within(dialog).getByLabelText('What needs fixing')).toHaveValue('') // each opening starts blank
  await user.click(within(dialog).getByRole('button', { name: 'Reject' }))
  expect(within(dialog).getByText('Tell the artist what to fix.')).toBeInTheDocument()

  await user.type(within(dialog).getByLabelText('What needs fixing'), 'Already in the catalog')
  await user.click(within(dialog).getByRole('button', { name: 'Reject' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(calls).toContainEqual({ method: 'POST', path: '/admin/custom-services/cs-1/reject', body: { reason: 'Already in the catalog' } })

  await user.click(screen.getByRole('button', { name: 'Rejected' }))
  expect(await screen.findByText('Sent back: Already in the catalog')).toBeInTheDocument()
})

it('shows an error state when the custom services queue fails to load', async () => {
  db.overrides['/admin/custom-services'] = () => json(500, { code: 'server_error', message: 'Database unavailable' })
  renderSignedIn('/custom-services')
  // A 500 is retried twice (about 1 s + 2 s, src/lib/query-client.ts) before the error shows.
  expect(await screen.findByText(/Couldn’t load custom services\./, {}, { timeout: 5000 })).toBeInTheDocument()
})
