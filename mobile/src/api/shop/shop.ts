import { request } from '../../core/api/client';
import { withQuery } from '../../core/api/query-string';
import type { Page } from '../../core/api/types';
import type { ArtistShopSummary, Order, OrderInput, Product, ProductInput, ShopCategory, ShopSettings } from '../../types/shop/shop';

// Customer shop (backend app/shop/router.py).
export function listProducts(category: ShopCategory | null, q: string, cursor?: string | null) {
  return request<Page<Product>>(withQuery('/shop/products', { category, q: q || undefined, cursor }), undefined, { auth: true, method: 'GET' });
}
export function getProduct(id: string) {
  return request<Product>(`/shop/products/${encodeURIComponent(id)}`, undefined, { auth: true, method: 'GET' });
}
export function placeOrder(body: OrderInput) {
  return request<Order[]>('/shop/orders', body, { auth: true });
}
export function listMyOrders(cursor?: string | null) {
  return request<Page<Order>>(withQuery('/shop/orders', { cursor }), undefined, { auth: true, method: 'GET' });
}
export function getMyOrder(id: string) {
  return request<Order>(`/shop/orders/${encodeURIComponent(id)}`, undefined, { auth: true, method: 'GET' });
}
export function cancelMyOrder(id: string, reason: string | null) {
  return request<Order>(`/shop/orders/${encodeURIComponent(id)}/cancel`, { reason }, { auth: true });
}

// The artist's own shop (backend app/shop/artist_router.py).
const MINE = '/artists/me/shop';
export function getShopSettings() {
  return request<ShopSettings>(`${MINE}/settings`, undefined, { auth: true, method: 'GET' });
}
export function saveShopSettings(body: ShopSettings) {
  return request<ShopSettings>(`${MINE}/settings`, body, { auth: true, method: 'PUT' });
}
export function listMyProducts(cursor?: string | null) {
  return request<Page<Product>>(withQuery(`${MINE}/products`, { cursor }), undefined, { auth: true, method: 'GET' });
}
export function createProduct(body: ProductInput) {
  return request<Product>(`${MINE}/products`, body, { auth: true });
}
export function updateProduct(id: string, body: Partial<Pick<Product, 'name' | 'description' | 'price_paise' | 'mrp_paise' | 'stock' | 'is_active'>>) {
  return request<Product>(`${MINE}/products/${encodeURIComponent(id)}`, body, { auth: true, method: 'PATCH' });
}
export function listShopOrders(view: 'all' | 'to_pack' | 'shipped' | 'delivered' | 'cancelled', cursor?: string | null) {
  return request<Page<Order>>(withQuery(`${MINE}/orders`, { view, cursor }), undefined, { auth: true, method: 'GET' });
}
export function getShopSummary() {
  return request<ArtistShopSummary>(`${MINE}/summary`, undefined, { auth: true, method: 'GET' });
}
export type OrderStep = 'confirm' | 'mark-paid' | 'ship' | 'deliver' | 'cancel';
export function stepOrder(id: string, step: OrderStep, body?: { tracking?: string | null; reason?: string | null }) {
  return request<Order>(`${MINE}/orders/${encodeURIComponent(id)}/${step}`, body ?? {}, { auth: true });
}
