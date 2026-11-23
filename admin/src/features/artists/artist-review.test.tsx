import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '@/App'
import { createQueryClient } from '@/lib/query-client'
import { KYC, artist, calls, category, db, installFakeBackend } from '@/test/fake-backend'
import { renderSignedIn } from '@/test/render-app'

beforeEach(() => {
  installFakeBackend()
  localStorage.clear()
  sessionStorage.clear()
  window.history.pushState({}, '', '/')
})
afterEach(() => vi.unstubAllGlobals())

it('lists a pending artist and approves them', async () => {
  const user = userEvent.setup()
  renderSignedIn('/artists')
  await user.click(await screen.findByText('Ayesha Mehendi Art'))
  await user.click(await screen.findByRole('tab', { name: 'Services (1)' }))
  expect(await screen.findByText('Bridal Classic')).toBeInTheDocument()
  expect(screen.getByText('₹5,500')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Approve & publish' }))
  expect(await screen.findByText('Approved')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Approve & publish' })).not.toBeInTheDocument()
})

it('rejecting needs a reason, then shows it', async () => {
  const user = userEvent.setup()
  renderSignedIn('/artists/a-1')
  await user.click(await screen.findByRole('button', { name: 'Reject' }))
  const dialog = await screen.findByRole('dialog')
  await user.click(within(dialog).getByRole('button', { name: 'Reject' }))
  expect(within(dialog).getByText('Tell the artist what to fix.')).toBeInTheDocument()
  expect(calls.some((c) => c.path.endsWith('/reject'))).toBe(false)

  await user.type(within(dialog).getByLabelText('What needs fixing'), 'Photos are blurry')
  await user.click(within(dialog).getByRole('button', { name: 'Reject' }))
  expect(await screen.findByText('Photos are blurry')).toBeInTheDocument()
  expect(calls).toContainEqual({ method: 'POST', path: '/admin/artists/a-1/reject', body: { reason: 'Photos are blurry' } })
})

it('opens on the masked Aadhaar tab, and both card photos open full size', async () => {
  const user = userEvent.setup()
  renderSignedIn('/artists/a-1')
  expect(await screen.findByText('•••• •••• 2346')).toBeInTheDocument()
  expect(screen.getByText('Reveals are logged.')).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: 'Aadhaar' })).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByRole('tab', { name: 'Services (1)' })).toHaveAttribute('aria-selected', 'false')
  expect(screen.getByAltText('Aadhaar front')).toHaveAttribute('src', KYC.front_url)
  expect(screen.getByAltText('Aadhaar back')).toHaveAttribute('src', KYC.back_url)

  await user.click(screen.getByRole('button', { name: 'Open Aadhaar back' }))
  const dialog = await screen.findByRole('dialog')
  expect(dialog.querySelector('img')).toHaveAttribute('src', KYC.back_url)
})

it('Reveal POSTs to the reveal endpoint and shows the full number without caching it', async () => {
  const user = userEvent.setup()
  const queryClient = createQueryClient()
  db.refreshCookie = 'refresh-1'
  window.history.pushState({}, '', '/artists/a-1')
  render(<App queryClient={queryClient} />)

  await user.click(await screen.findByRole('button', { name: 'Reveal' }))
  expect(await screen.findByText('2341 2341 2346')).toBeInTheDocument()
  expect(screen.queryByText('•••• •••• 2346')).not.toBeInTheDocument()
  expect(calls).toContainEqual({ method: 'POST', path: '/admin/artists/a-1/kyc/reveal', body: undefined })
  const cached = [...queryClient.getQueryCache().getAll(), ...queryClient.getMutationCache().getAll()].map((entry) => entry.state.data)
  expect(JSON.stringify(cached)).not.toContain('234123412346')
})

it('says "No Aadhaar on file" when there is none, and Approve still works', async () => {
  db.artist = artist({ kyc: null })
  const user = userEvent.setup()
  renderSignedIn('/artists/a-1')
  expect(await screen.findByText('No Aadhaar on file')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Reveal' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Approve & publish' }))
  expect(await screen.findByText('Approved')).toBeInTheDocument()
})

it('refetches the detail once when the card links have expired', async () => {
  const detailGets = () => calls.filter((c) => c.method === 'GET' && c.path === '/admin/artists/a-1').length
  renderSignedIn('/artists/a-1')
  await screen.findByAltText('Aadhaar front')
  expect(detailGets()).toBe(1)

  const fresh = { ...KYC, front_url: KYC.front_url.replace('expires_at=1', 'expires_at=2'), back_url: KYC.back_url.replace('expires_at=1', 'expires_at=2') }
  db.artist = artist({ kyc: fresh })
  fireEvent.error(screen.getByAltText('Aadhaar front'))
  fireEvent.error(screen.getByAltText('Aadhaar back')) // both expire together: still one refetch
  await waitFor(() => expect(screen.getByAltText('Aadhaar front')).toHaveAttribute('src', fresh.front_url))
  expect(screen.getByAltText('Aadhaar back')).toHaveAttribute('src', fresh.back_url)

  fireEvent.error(screen.getByAltText('Aadhaar front')) // broken again: no second refetch, no loop
  await new Promise((resolve) => setTimeout(resolve, 50))
  expect(detailGets()).toBe(2)
})

it('the review page shows Category › Subcategory and marks custom and pending services', async () => {
  db.categories = [category({ id: 1, name: 'Mehendi' }), category({ id: 2, name: 'Bridal', parent_id: 1 })]
  db.artist = artist({
    status: 'approved',
    services: [
      { id: 's-1', category_id: 2, subcategory_id: 2, template_id: 100, name: 'Bridal Classic', price_paise: 550000, duration_minutes: 180, description: null, status: 'approved', rejection_reason: null },
      { id: 's-2', category_id: 2, subcategory_id: 2, template_id: null, name: 'Glitter mehendi', price_paise: 150000, duration_minutes: 60, description: null, status: 'pending', rejection_reason: null },
      { id: 's-3', category_id: 1, subcategory_id: 1, template_id: null, name: 'Old custom', price_paise: 100000, duration_minutes: 30, description: null, status: 'approved', rejection_reason: null },
    ],
  })
  const user = userEvent.setup()
  renderSignedIn('/artists/a-1')
  const row = (name: string) => screen.getByText(name).closest('tr') as HTMLElement
  await user.click(await screen.findByRole('tab', { name: 'Services (3)' }))
  await screen.findByText('Glitter mehendi')
  expect(within(row('Bridal Classic')).getByText('Mehendi › Bridal')).toBeInTheDocument()
  expect(within(row('Bridal Classic')).queryByText('Custom')).not.toBeInTheDocument()
  expect(within(row('Glitter mehendi')).getByText('Custom')).toBeInTheDocument()
  expect(within(row('Glitter mehendi')).getByText('Pending review')).toBeInTheDocument()
  expect(within(row('Old custom')).getByText('Mehendi')).toBeInTheDocument() // older rows point at the top-level category
})
