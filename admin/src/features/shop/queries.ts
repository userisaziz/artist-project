import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { OrderStatus, OrderView, Page, ProductView, ShopOrder, ShopProduct } from './types'

const PAGE_SIZE = 20

export const shopKeys = {
  all: ['admin', 'shop'] as const,
  products: (view: ProductView, q: string) => ['admin', 'shop', 'products', view, q] as const,
  productSummary: ['admin', 'shop', 'products', 'summary'] as const,
  orders: (view: OrderView) => ['admin', 'shop', 'orders', view] as const,
  orderSummary: ['admin', 'shop', 'orders', 'summary'] as const,
}

function paged<T>(path: string, params: Record<string, string>) {
  return ({ pageParam }: { pageParam: string | null }) => {
    const search = new URLSearchParams({ ...params, limit: String(PAGE_SIZE) })
    if (pageParam) search.set('cursor', pageParam)
    return api<Page<T>>(`${path}?${search.toString()}`)
  }
}

export function useShopProducts(view: ProductView, q: string) {
  return useInfiniteQuery({
    queryKey: shopKeys.products(view, q),
    queryFn: paged<ShopProduct>('/admin/shop/products', q ? { view, q } : { view }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
    placeholderData: keepPreviousData,
  })
}

export function useProductSummary() {
  return useQuery({ queryKey: shopKeys.productSummary, queryFn: () => api<{ counts: Record<ProductView, number> }>('/admin/shop/products/summary') })
}

export function useShopOrders(view: OrderView) {
  return useInfiniteQuery({
    queryKey: shopKeys.orders(view),
    queryFn: paged<ShopOrder>('/admin/shop/orders', { view }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
    placeholderData: keepPreviousData,
  })
}

export function useOrderSummary() {
  return useQuery({ queryKey: shopKeys.orderSummary, queryFn: () => api<{ counts: Record<OrderView, number> }>('/admin/shop/orders/summary') })
}

export function useSetProductRemoved() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string | null }) =>
      reason === null
        ? api<ShopProduct>(`/admin/shop/products/${id}/restore`, { method: 'POST' })
        : api<ShopProduct>(`/admin/shop/products/${id}/remove`, { method: 'POST', body: { reason } }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: shopKeys.all }),
  })
}

export function useSetOrderStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: OrderStatus; reason?: string }) =>
      api<ShopOrder>(`/admin/shop/orders/${id}/status`, { method: 'POST', body: reason ? { status, reason } : { status } }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: shopKeys.all }),
  })
}
