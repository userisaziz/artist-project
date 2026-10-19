// Mirrors backend app/shop/schemas.py. Phase 1: nothing is paid in the app.
export type ShopCategory = 'henna' | 'makeup' | 'hair' | 'prints';
export type PaymentMethod = 'pay_on_delivery' | 'pay_before_shipping';
export type OrderStatus = 'placed' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';

export interface Seller {
  id: string;
  business_name: string;
  city: string;
  photo_url: string | null;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  category: ShopCategory;
  category_label: string;
  price_paise: number;
  mrp_paise: number | null;
  discount_percent: number | null;
  stock: number;
  photos: { url: string; width: number; height: number }[];
  seller: Seller;
  payment_methods: PaymentMethod[];
  status: 'live' | 'removed';
  is_active: boolean;
  sold: number;
  removed_reason: string | null;
  created_at: string;
}

export interface Order {
  id: string;
  code: string;
  status: OrderStatus;
  payment_method: PaymentMethod;
  paid_at: string | null;
  seller: Seller;
  customer: { id: string; name: string; phone: string };
  address: string;
  items: { product_id: string | null; name: string; unit_price_paise: number; quantity: number; photo_url: string | null }[];
  subtotal_paise: number;
  delivery_fee_paise: number;
  total_paise: number;
  tracking: string | null;
  cancelled_by: string | null;
  cancel_reason: string | null;
  created_at: string;
  timeline: { status: OrderStatus; at: string }[];
}

export interface OrderInput {
  items: { product_id: string; quantity: number }[];
  address: string;
  payment_methods: Record<string, PaymentMethod>; // artist id -> method
}

export interface ShopSettings {
  pay_on_delivery: boolean;
  pay_before_shipping: boolean;
  delivery_fee_paise: number;
  free_delivery_over_paise: number | null;
}

export interface ProductInput {
  name: string;
  description?: string | null;
  category: ShopCategory;
  price_paise: number;
  mrp_paise?: number | null;
  stock: number;
  photos: { key: string; width: number; height: number }[];
  payment_methods?: PaymentMethod[] | null;
}

export interface ArtistShopSummary {
  to_pack: number;
  orders_this_month: number;
  sales_this_month_paise: number;
  products: number;
}
