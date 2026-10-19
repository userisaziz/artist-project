import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { calls, db, installFakeBackend, json } from '@/test/fake-backend'
import { renderSignedIn } from '@/test/render-app'
import type { ShopOrder, ShopProduct } from './types'

// The first render loads the lazy route chunk, which can take over the default 1s in a busy full run.
const FIRST_RENDER_MS = 5_000
/** Interactive flows type and click through several steps; on a loaded machine that outlasts Vitest's 5s default. */
const FLOW_TIMEOUT_MS = 20_000

const seller = { id: 'a-1', business_name: 'Ayesha Mehendi Art', city: 'Bangalore', photo_url: null }
// Mirror backend ProductOut / OrderOut (app/shop/schemas.py).
const product = (overrides: Partial<ShopProduct> = {}): ShopProduct => ({
  id: 'pr-1', name: 'Organic henna cones · 12 pack', category_label: 'Henna & aftercare', price_paise: 48000, mrp_paise: 60000,
  stock: 3, photos: [], seller, payment_methods: ['pay_on_delivery'], status: 'live', is_active: true, sold: 214,
  removed_reason: null, created_at: '2026-10-09T09:00:00Z', ...overrides,
})
const order = (overrides: Partial<ShopOrder> = {}): ShopOrder => ({
  id: 'o-1', code: 'AT-48213', status: 'placed', payment_method: 'pay_on_delivery', paid_at: null, seller,
  customer: { id: 'u-9', name: 'Ananya Rao', phone: '+919845067890' }, address: 'Koramangala, Bangalore 560034',
  items: [{ product_id: 'pr-1', name: 'Organic henna cones · 12 pack', unit_price_paise: 48000, quantity: 2 }],
  subtotal_paise: 96000, delivery_fee_paise: 4900, total_paise: 100900, tracking: null, cancelled_by: null, cancel_reason: null,
  created_at: '2026-10-10T09:40:00Z', timeline: [{ status: 'placed', at: '2026-10-10T09:40:00Z' }], ...overrides,
})

beforeEach(() => {
  installFakeBackend()
  db.overrides['/admin/shop/products/summary'] = () => json(200, { counts: { all: 1, live: 1, low_stock: 1, removed: 0 } })
  db.overrides['/admin/shop/orders/summary'] = () => json(200, { counts: { all: 1, to_pack: 1, shipped: 0, delivered: 0, cancelled: 0 } })
})
afterEach(() => vi.unstubAllGlobals())

it('lists products with stock and units sold, and removes one with a reason', async () => {
  const user = userEvent.setup()
  db.overrides['/admin/shop/products?view=all&limit=20'] = () => json(200, { items: [product()], next_cursor: null })
  db.overrides['/admin/shop/products/pr-1/remove'] = () => json(200, product({ status: 'removed', removed_reason: 'Unverified claims' }))
  renderSignedIn('/shop/products')

  expect(await screen.findByText('Organic henna cones · 12 pack', {}, { timeout: FIRST_RENDER_MS })).toBeInTheDocument()
  expect(screen.getByText('214')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Remove' }))
  const dialog = await screen.findByRole('dialog')
  await user.type(within(dialog).getByRole('textbox'), 'Unverified claims')
  await user.click(within(dialog).getByRole('button', { name: 'Remove' }))

  await waitFor(() => expect(calls).toContainEqual({ method: 'POST', path: '/admin/shop/products/pr-1/remove', body: { reason: 'Unverified claims' } }))
}, FLOW_TIMEOUT_MS)

it('opens an order and moves it on', async () => {
  const user = userEvent.setup()
  db.overrides['/admin/shop/orders?view=all&limit=20'] = () => json(200, { items: [order()], next_cursor: null })
  db.overrides['/admin/shop/orders/o-1/status'] = () => json(200, order({ status: 'confirmed' }))
  renderSignedIn('/shop/orders')

  await user.click(await screen.findByRole('button', { name: /#AT-48213/ }, { timeout: FIRST_RENDER_MS }))
  const timeline = await screen.findByRole('list', { name: 'Order timeline' })
  expect(within(timeline).getByText('placed')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Mark confirmed' }))

  await waitFor(() => expect(calls).toContainEqual({ method: 'POST', path: '/admin/shop/orders/o-1/status', body: { status: 'confirmed' } }))
}, FLOW_TIMEOUT_MS)

it('shows an error when orders can’t load', async () => {
  db.overrides['/admin/shop/orders?view=all&limit=20'] = () => json(403, { code: 'forbidden', message: 'Not allowed for this account' })
  renderSignedIn('/shop/orders')

  expect(await screen.findByText(/Couldn’t load orders/, {}, { timeout: FIRST_RENDER_MS })).toBeInTheDocument()
}, FLOW_TIMEOUT_MS)
