// Mirrors backend app/shop/schemas.py. Phase 1: nothing is paid in the app, so no refunds or payouts here.
export type ProductView = 'all' | 'live' | 'low_stock' | 'removed'
export type OrderView = 'all' | 'to_pack' | 'shipped' | 'delivered' | 'cancelled'
export type OrderStatus = 'placed' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'
export type PaymentMethod = 'pay_on_delivery' | 'pay_before_shipping'

interface Seller {
  id: string
  business_name: string
  city: string
  photo_url: string | null
}

export interface ShopProduct {
  id: string
  name: string
  category_label: string
  price_paise: number
  mrp_paise: number | null
  stock: number
  photos: { url: string }[]
  seller: Seller
  payment_methods: PaymentMethod[]
  status: 'live' | 'removed'
  is_active: boolean
  sold: number
  removed_reason: string | null
  created_at: string
}

export interface ShopOrder {
  id: string
  code: string
  status: OrderStatus
  payment_method: PaymentMethod
  paid_at: string | null
  seller: Seller
  customer: { id: string; name: string; phone: string }
  address: string
  items: { product_id: string | null; name: string; unit_price_paise: number; quantity: number }[]
  subtotal_paise: number
  delivery_fee_paise: number
  total_paise: number
  tracking: string | null
  cancelled_by: string | null
  cancel_reason: string | null
  created_at: string
  timeline: { status: OrderStatus; at: string }[]
}

export interface Page<T> {
  items: T[]
  next_cursor: string | null
}

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  pay_on_delivery: 'Pay on delivery',
  pay_before_shipping: 'Pay before shipping',
}
