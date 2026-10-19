import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { addLine, setQuantity, type CartLine } from '../../utils/shop/cart';
import type { Product } from '../../types/shop/shop';

interface Cart {
  lines: CartLine[];
  add: (product: Product, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  clear: (productIds?: string[]) => void;
}

const CartContext = createContext<Cart | null>(null);

/** The customer's cart: client state for this app session (orders, once placed, live on the server). */
export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const add = useCallback((product: Product, quantity = 1) => setLines((l) => addLine(l, product, quantity)), []);
  const set = useCallback((id: string, quantity: number) => setLines((l) => setQuantity(l, id, quantity)), []);
  const clear = useCallback((ids?: string[]) => setLines((l) => (ids ? l.filter((x) => !ids.includes(x.product.id)) : [])), []);
  const value = useMemo(() => ({ lines, add, setQuantity: set, clear }), [lines, add, set, clear]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): Cart {
  const cart = useContext(CartContext);
  if (!cart) throw new Error('useCart needs a CartProvider (app/customer/_layout.tsx)');
  return cart;
}
