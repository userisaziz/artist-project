import type { Order, Product } from '../../types/shop/shop';

// Mirror backend ProductOut / OrderOut (app/shop/schemas.py).
export function productFixture(overrides: Partial<Product> = {}): Product {
  return {
    id: 'pr-1',
    name: 'Organic henna cones · 12 pack',
    description: 'Hand-rolled Rajasthani henna',
    category: 'henna',
    category_label: 'Henna & aftercare',
    price_paise: 48000,
    mrp_paise: 60000,
    discount_percent: 20,
    stock: 10,
    photos: [{ url: 'https://fake.storage/full/cones.jpg', width: 1200, height: 1200 }],
    seller: { id: 'a1', business_name: 'Ayesha Mehendi Art', city: 'Bangalore', photo_url: null },
    payment_methods: ['pay_on_delivery'],
    status: 'live',
    is_active: true,
    sold: 214,
    removed_reason: null,
    created_at: '2026-10-09T09:00:00Z',
    ...overrides,
  };
}

export function orderFixture(overrides: Partial<Order> = {}): Order {
  return {
    id: 'o-1',
    code: 'AT-48213',
    status: 'placed',
    payment_method: 'pay_on_delivery',
    paid_at: null,
    seller: { id: 'a1', business_name: 'Ayesha Mehendi Art', city: 'Bangalore', photo_url: null },
    customer: { id: 'u-9', name: 'Ananya Rao', phone: '+919845067890' },
    address: 'Flat 1204, Prestige Acropolis, Koramangala, Bangalore 560034',
    items: [{ product_id: 'pr-1', name: 'Organic henna cones · 12 pack', unit_price_paise: 48000, quantity: 2, photo_url: null }],
    subtotal_paise: 96000,
    delivery_fee_paise: 4900,
    total_paise: 100900,
    tracking: null,
    cancelled_by: null,
    cancel_reason: null,
    created_at: '2026-10-10T09:40:00Z',
    timeline: [{ status: 'placed', at: '2026-10-10T09:40:00Z' }],
    ...overrides,
  };
}
