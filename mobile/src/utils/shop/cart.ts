import type { OrderStatus, PaymentMethod, Product, Seller } from '../../types/shop/shop';
import { rupeesToPaise } from '../common/format';

export { paiseToRupeesText, rupeesToPaise } from '../common/format';

export interface CartLine {
  product: Product;
  quantity: number;
}

export interface SellerGroup {
  seller: Seller;
  lines: CartLine[];
  subtotal_paise: number;
  /** Methods every product in this seller's group accepts; the customer picks one at checkout. */
  methods: PaymentMethod[];
}

export const MAX_QUANTITY = 20; // backend MAX_QUANTITY

export const METHOD_LABEL: Record<PaymentMethod, { title: string; detail: string }> = {
  pay_on_delivery: { title: 'Pay on delivery', detail: 'Cash or UPI when it arrives' },
  pay_before_shipping: { title: 'Pay the artist before shipping', detail: 'They share how to pay; it ships once paid' },
};

/** New cart with `quantity` more of `product`, capped by stock and the per-line maximum. */
export function addLine(lines: CartLine[], product: Product, quantity = 1): CartLine[] {
  const cap = Math.min(product.stock, MAX_QUANTITY);
  const existing = lines.find((l) => l.product.id === product.id);
  if (!existing) return cap > 0 ? [...lines, { product, quantity: Math.min(quantity, cap) }] : lines;
  return lines.map((l) => (l.product.id === product.id ? { ...l, quantity: Math.min(l.quantity + quantity, cap) } : l));
}

/** New cart with the line set to `quantity`; zero removes it. */
export function setQuantity(lines: CartLine[], productId: string, quantity: number): CartLine[] {
  if (quantity <= 0) return lines.filter((l) => l.product.id !== productId);
  return lines.map((l) => (l.product.id === productId ? { ...l, quantity: Math.min(quantity, l.product.stock, MAX_QUANTITY) } : l));
}

/** The cart split by seller (one order each), with each group's subtotal and the payment methods all its products accept. */
export function groupBySeller(lines: CartLine[]): SellerGroup[] {
  const groups = new Map<string, SellerGroup>();
  for (const line of lines) {
    const id = line.product.seller.id;
    const group = groups.get(id) ?? { seller: line.product.seller, lines: [], subtotal_paise: 0, methods: [...line.product.payment_methods] };
    groups.set(id, {
      ...group,
      lines: [...group.lines, line],
      subtotal_paise: group.subtotal_paise + line.product.price_paise * line.quantity,
      methods: group.methods.filter((m) => line.product.payment_methods.includes(m)),
    });
  }
  return [...groups.values()];
}

export const cartCount = (lines: CartLine[]) => lines.reduce((n, l) => n + l.quantity, 0);
export const cartTotal = (lines: CartLine[]) => lines.reduce((n, l) => n + l.product.price_paise * l.quantity, 0);

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: 'pending' | 'confirmed' | 'brand' | 'neutral' | 'danger' }> = {
  placed: { label: 'Placed', tone: 'pending' },
  confirmed: { label: 'Confirmed', tone: 'brand' },
  shipped: { label: 'Shipped', tone: 'brand' },
  delivered: { label: 'Delivered', tone: 'confirmed' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
};
