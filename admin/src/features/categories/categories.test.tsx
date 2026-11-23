import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { calls, category, db, installFakeBackend, json } from '@/test/fake-backend'
import { renderSignedIn } from '@/test/render-app'

beforeEach(() => {
  installFakeBackend()
  localStorage.clear()
  sessionStorage.clear()
  window.history.pushState({}, '', '/')
})
afterEach(() => vi.unstubAllGlobals())

it('creates the first category from the empty Catalog', async () => {
  const user = userEvent.setup()
  renderSignedIn('/categories')
  expect(await screen.findByText('No categories yet')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /New category/ }))
  const dialog = await screen.findByRole('dialog')
  await user.click(within(dialog).getByRole('button', { name: 'Create category' }))
  expect(await within(dialog).findByText('Name is required')).toBeInTheDocument()

  await user.type(within(dialog).getByLabelText('Name'), 'Mehendi')
  await user.click(within(dialog).getByRole('button', { name: 'Create category' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(await screen.findByRole('button', { name: 'Mehendi' })).toBeInTheDocument()
  expect(calls).toContainEqual({ method: 'POST', path: '/admin/categories', body: { name: 'Mehendi', status: 'draft' } })
})

it('adds a subcategory under a category, then a service to it', async () => {
  db.categories = [category({ id: 1, name: 'Makeup' })]
  const user = userEvent.setup()
  renderSignedIn('/categories')
  expect(await screen.findByText(/Add a subcategory under a category, then add its services here/)).toBeInTheDocument()

  await user.click(await screen.findByRole('button', { name: 'Makeup' }))
  await user.click(screen.getByRole('button', { name: /Subcategory/ }))
  let dialog = await screen.findByRole('dialog')
  expect(within(dialog).getByText('Makeup')).toBeInTheDocument() // "Under: Makeup", read-only
  await user.type(within(dialog).getByLabelText('Name'), 'Bridal')
  await user.click(within(dialog).getByRole('button', { name: 'Create subcategory' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(calls).toContainEqual({ method: 'POST', path: '/admin/categories', body: { name: 'Bridal', status: 'draft', parent_id: 1 } })

  await user.click(await screen.findByRole('button', { name: 'Bridal' }))
  expect(await screen.findByRole('heading', { name: 'Makeup › Bridal' })).toBeInTheDocument()
  expect(window.location.search).toBe('?sub=2')
  expect(await screen.findByText('No services in Bridal yet')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /New service/ }))
  dialog = await screen.findByRole('dialog')
  await user.type(within(dialog).getByLabelText('Name'), 'HD Bridal Makeup')
  await user.type(within(dialog).getByLabelText('Description'), 'Long-wear HD base')
  await user.click(within(dialog).getByRole('button', { name: 'Add service' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(await screen.findByText('HD Bridal Makeup')).toBeInTheDocument()
  expect(screen.getByText('Long-wear HD base')).toBeInTheDocument()
  expect(calls).toContainEqual({
    method: 'POST', path: '/admin/service-templates',
    body: { name: 'HD Bridal Makeup', description: 'Long-wear HD base', is_active: true, subcategory_id: 2 },
  })
})

it('opens the subcategory that still needs services, flags it, and adds its first service', async () => {
  db.categories = [
    category({ id: 1, name: 'Mehendi', child_count: 2, status: 'active' }),
    category({ id: 2, name: 'Arabic', parent_id: 1, template_count: 1 }),
    category({ id: 3, name: 'Bridal', parent_id: 1 }),
  ]
  db.templates = [{ id: 100, subcategory_id: 2, name: 'Arabic Hands', description: null, sort_order: 0, is_active: true, artist_count: 0 }]
  const user = userEvent.setup()
  renderSignedIn('/categories')

  expect(await screen.findByRole('heading', { name: 'Mehendi › Bridal' })).toBeInTheDocument()
  expect(screen.getByText('No services – artists can’t pick it')).toBeInTheDocument()
  expect(screen.getByText('1 catalogue service')).toBeInTheDocument()

  await user.click(await screen.findByRole('button', { name: /Add first service/ }))
  const dialog = await screen.findByRole('dialog')
  await user.type(within(dialog).getByLabelText('Name'), 'Bridal Full Hands')
  await user.click(within(dialog).getByRole('button', { name: 'Add service' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(calls).toContainEqual(expect.objectContaining({ method: 'POST', path: '/admin/service-templates', body: expect.objectContaining({ name: 'Bridal Full Hands', subcategory_id: 3 }) }))

  await user.click(screen.getByRole('button', { name: 'Services for Arabic' }))
  expect(await screen.findByRole('heading', { name: 'Mehendi › Arabic' })).toBeInTheDocument()
  expect(window.location.search).toBe('?sub=2')
})

it('delete is disabled with a reason for categories and services in use', async () => {
  db.categories = [category({ id: 1, name: 'Makeup', child_count: 1 }), category({ id: 2, name: 'Bridal', parent_id: 1, template_count: 2 })]
  db.templates = [
    { id: 100, subcategory_id: 2, name: 'HD Bridal Makeup', description: null, sort_order: 0, is_active: true, artist_count: 3 },
    { id: 101, subcategory_id: 2, name: 'Old look', description: null, sort_order: 1, is_active: false, artist_count: 0 },
  ]
  const user = userEvent.setup()
  renderSignedIn('/categories?sub=2')
  expect(await screen.findByText('HD Bridal Makeup')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Delete HD Bridal Makeup' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Delete HD Bridal Makeup' })).toHaveAttribute('title', 'Artists offer it — deactivate it instead')
  expect(screen.getByRole('button', { name: 'Delete Old look' })).toBeEnabled()

  await user.click(screen.getByRole('button', { name: 'More actions for Makeup' }))
  expect(await screen.findByRole('menuitem', { name: 'Delete' })).toHaveAttribute('aria-disabled', 'true')
  expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveAttribute('title', 'In use — archive it instead')
})

it('shows catalog KPIs and archives a category from its row menu', async () => {
  db.categories = [
    category({ id: 1, name: 'Mehendi', artist_count: 12, service_count: 30, child_count: 2, status: 'active' }),
    category({ id: 2, name: 'Bridal', parent_id: 1, template_count: 3 }),
    category({ id: 3, name: 'Arabic', parent_id: 1, template_count: 1 }),
    category({ id: 4, name: 'Nail art', status: 'draft' }),
  ]
  const user = userEvent.setup()
  renderSignedIn('/categories')

  expect(await screen.findByText('Bridal, Arabic')).toBeInTheDocument() // subcategories under the name
  expect(within(screen.getByRole('group', { name: 'Categories' })).getByText('2')).toBeInTheDocument()
  expect(within(screen.getByRole('group', { name: 'Categories' })).getByText('+ 2 subcategories')).toBeInTheDocument()
  expect(within(screen.getByRole('group', { name: 'Catalogue services' })).getByText('4')).toBeInTheDocument()
  expect(within(screen.getByRole('group', { name: 'Top category' })).getByText('Mehendi')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Draft 1' }))
  expect(window.location.search).toBe('?status=draft')
  expect(screen.queryByRole('button', { name: 'Mehendi' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'All 2' }))

  await user.click(screen.getByRole('button', { name: 'More actions for Mehendi' }))
  await user.click(await screen.findByRole('menuitem', { name: 'Archive' }))
  // Archiving is confirmed first, with the artists it affects.
  const confirm = await screen.findByRole('alertdialog', { name: 'Archive “Mehendi”?' })
  expect(confirm).toHaveTextContent('12 artists offer it today.')
  expect(calls.some((c) => c.method === 'PATCH')).toBe(false)
  await user.click(within(confirm).getByRole('button', { name: 'Archive' }))
  await waitFor(() => expect(calls).toContainEqual({ method: 'PATCH', path: '/admin/categories/1', body: { status: 'inactive' } }))
  expect(await screen.findByText('“Mehendi” is now inactive')).toBeInTheDocument()
})

it('shows an error state when the catalog fails to load', async () => {
  db.overrides['/admin/categories'] = () => json(500, { code: 'server_error', message: 'Database unavailable' })
  renderSignedIn('/categories')
  // A 500 is retried twice (about 1 s + 2 s, src/lib/query-client.ts) before the error shows.
  expect(await screen.findByRole('alert', {}, { timeout: 5000 })).toHaveTextContent('Couldn’t load categories.')
})
