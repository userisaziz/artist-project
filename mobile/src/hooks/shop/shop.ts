import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as shopApi from '../../api/shop/shop';
import { useAuth } from '../../context/auth/auth-provider';
import type { Order, OrderInput, ProductInput, ShopCategory, ShopSettings } from '../../types/shop/shop';

// Keyed by user id, so another account on the device never sees cached orders.
export const shopKeys = {
  all: ['shop'] as const,
  products: (userId: string | undefined, category: ShopCategory | null, q: string) => ['shop', userId, 'products', category, q] as const,
  product: (userId: string | undefined, id: string) => ['shop', userId, 'product', id] as const,
  orders: (userId: string | undefined) => ['shop', userId, 'orders'] as const,
  order: (userId: string | undefined, id: string) => ['shop', userId, 'order', id] as const,
  mine: (userId: string | undefined) => ['shop', userId, 'mine'] as const,
};

export function useProducts(category: ShopCategory | null, q: string) {
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: shopKeys.products(user?.id, category, q),
    queryFn: ({ pageParam }) => shopApi.listProducts(category, q, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
    placeholderData: keepPreviousData,
    enabled: !!user,
  });
}

export function useProduct(id: string) {
  const { user } = useAuth();
  return useQuery({ queryKey: shopKeys.product(user?.id, id), queryFn: () => shopApi.getProduct(id), enabled: !!user && !!id });
}

export function usePlaceOrder() {
  const { user } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: OrderInput) => shopApi.placeOrder(input),
    onSuccess: () => client.invalidateQueries({ queryKey: ['shop', user?.id] }), // stock and orders changed
  });
}

export function useMyOrders() {
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: shopKeys.orders(user?.id),
    queryFn: ({ pageParam }) => shopApi.listMyOrders(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
    enabled: !!user,
  });
}

export function useMyOrder(id: string) {
  const { user } = useAuth();
  return useQuery({ queryKey: shopKeys.order(user?.id, id), queryFn: () => shopApi.getMyOrder(id), enabled: !!user && !!id });
}

export function useCancelOrder(id: string) {
  const { user } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (reason: string | null) => shopApi.cancelMyOrder(id, reason),
    onSuccess: (order) => {
      client.setQueryData(shopKeys.order(user?.id, id), order);
      return client.invalidateQueries({ queryKey: shopKeys.orders(user?.id) });
    },
  });
}

// --- the artist's own shop --------------------------------------------------------------------------

export function useShopSettings() {
  const { user } = useAuth();
  return useQuery({ queryKey: [...shopKeys.mine(user?.id), 'settings'], queryFn: shopApi.getShopSettings, enabled: !!user });
}

export function useSaveShopSettings() {
  const { user } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: ShopSettings) => shopApi.saveShopSettings(body),
    onSuccess: (settings) => {
      client.setQueryData([...shopKeys.mine(user?.id), 'settings'], settings);
      return client.invalidateQueries({ queryKey: [...shopKeys.mine(user?.id), 'products'] }); // inherited methods changed
    },
  });
}

export function useMyProducts() {
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: [...shopKeys.mine(user?.id), 'products'],
    queryFn: ({ pageParam }) => shopApi.listMyProducts(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
    enabled: !!user,
  });
}

/** One of the artist's own products, from the My shop list it was opened from. */
export function useMyProduct(id: string) {
  const products = useMyProducts();
  const product = products.data?.pages.flatMap((p) => p.items).find((p) => p.id === id);
  return { product, isPending: products.isPending, isError: products.isError, error: products.error, refetch: products.refetch };
}

export function useShopSummary() {
  const { user } = useAuth();
  return useQuery({ queryKey: [...shopKeys.mine(user?.id), 'summary'], queryFn: shopApi.getShopSummary, enabled: !!user });
}

export function useShopOrders(view: Parameters<typeof shopApi.listShopOrders>[0]) {
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: [...shopKeys.mine(user?.id), 'orders', view],
    queryFn: ({ pageParam }) => shopApi.listShopOrders(view, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
    enabled: !!user,
  });
}

/** Creating, editing and order steps all refresh the artist's shop lists and summary. */
function useShopWrite<TArgs>(fn: (args: TArgs) => Promise<unknown>) {
  const { user } = useAuth();
  const client = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => client.invalidateQueries({ queryKey: shopKeys.mine(user?.id) }) });
}

export const useCreateProduct = () => useShopWrite((input: ProductInput) => shopApi.createProduct(input));
export const useUpdateProduct = () =>
  useShopWrite(({ id, patch }: { id: string; patch: Parameters<typeof shopApi.updateProduct>[1] }) => shopApi.updateProduct(id, patch));
export const useOrderStep = () =>
  useShopWrite(({ order, step, body }: { order: Order; step: shopApi.OrderStep; body?: { tracking?: string | null; reason?: string | null } }) =>
    shopApi.stepOrder(order.id, step, body));
