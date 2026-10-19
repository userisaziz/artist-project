import type { ReactElement, ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../../core/theme/theme-provider';
import { transport } from '../../core/api/client';
import type { TransportRequest } from '../../core/api/transport';
import { CartProvider } from '../../context/shop/cart-context';
import { ShopHome } from '../../components/shop/ShopHome';
import { CheckoutScreen } from '../../components/shop/CheckoutScreen';
import { CartScreen } from '../../components/shop/CartScreen';
import { ShopOrderCard } from '../../components/shop/ShopOrderCard';
import { orderFixture, productFixture } from '../../mocks/shop/shop';

jest.mock('../../context/auth/auth-provider', () => ({
  useAuth: () => ({ user: jest.requireActual('../../mocks/auth/auth').userFixture }),
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }), useIsFocused: () => true }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const send = jest.spyOn(transport, 'request');
let client: QueryClient;
const Providers = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}><ThemeProvider><CartProvider>{children}</CartProvider></ThemeProvider></QueryClientProvider>
);
const wrap = (ui: ReactElement) => render(<Providers>{ui}</Providers>);

function serve(routes: Record<string, unknown>) {
  send.mockImplementation(async (req: TransportRequest) => {
    const key = `${req.method} ${req.path}`;
    if (!(key in routes)) throw new Error(`unexpected request ${key}`);
    const route = routes[key];
    return (typeof route === 'function' ? (route as (r: TransportRequest) => unknown)(req) : route) as { status: number; json: unknown };
  });
}

const kit = productFixture({
  id: 'pr-2', name: 'Pastel bridal lip kit', price_paise: 115000, mrp_paise: null,
  seller: { id: 'a2', business_name: 'Meher by Riya', city: 'Mumbai', photo_url: null },
  payment_methods: ['pay_on_delivery', 'pay_before_shipping'],
});

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  send.mockReset();
});
afterEach(() => client.clear());
afterAll(() => send.mockRestore());

it('browses, adds to the cart, and checks out with a payment method per artist', async () => {
  const placed: unknown[] = [];
  serve({
    'GET /shop/products': { status: 200, json: { items: [productFixture(), kit], next_cursor: null } },
    'POST /shop/orders': (req: TransportRequest) => {
      placed.push(req.body);
      return { status: 201, json: [orderFixture(), orderFixture({ id: 'o-2', code: 'AT-48214' })] };
    },
  });
  const onPlaced = jest.fn();
  await wrap(<><ShopHome onOpenProduct={jest.fn()} onOpenCart={jest.fn()} /><CheckoutScreen onPlaced={onPlaced} /></>);

  await fireEvent.press(await screen.findByRole('button', { name: 'Add Organic henna cones · 12 pack to cart' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Add Pastel bridal lip kit to cart' }));
  expect(screen.getByRole('button', { name: 'Cart, 2 items' })).toBeTruthy();

  await fireEvent.changeText(screen.getByLabelText('Deliver to'), 'Flat 1204, Koramangala, Bangalore 560034');
  await fireEvent.press(screen.getAllByText('Pay the artist before shipping')[0]);
  await fireEvent.press(screen.getByText('Place 2 orders'));

  await waitFor(() => expect(onPlaced).toHaveBeenCalled());
  expect(placed[0]).toEqual({
    items: [{ product_id: 'pr-1', quantity: 1 }, { product_id: 'pr-2', quantity: 1 }],
    address: 'Flat 1204, Koramangala, Bangalore 560034',
    payment_methods: { a1: 'pay_on_delivery', a2: 'pay_before_shipping' }, // a1 only accepts one: chosen for you
  });
});

it('the cart groups items by artist and changes quantities', async () => {
  serve({ 'GET /shop/products': { status: 200, json: { items: [kit], next_cursor: null } } });
  await wrap(<><ShopHome onOpenProduct={jest.fn()} onOpenCart={jest.fn()} /><CartScreen onCheckout={jest.fn()} /></>);

  await fireEvent.press(await screen.findByRole('button', { name: 'Add Pastel bridal lip kit to cart' }));
  expect(screen.getByText('Shipped by Meher by Riya')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'One more Pastel bridal lip kit' }));
  expect(screen.getByLabelText('2 in cart')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'One less Pastel bridal lip kit' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Remove Pastel bridal lip kit' }));
  expect(screen.getByText('Your cart is empty.')).toBeTruthy();
});

it('a refused order (stock ran out) says why', async () => {
  serve({
    'GET /shop/products': { status: 200, json: { items: [productFixture()], next_cursor: null } },
    'POST /shop/orders': { status: 409, json: { code: 'conflict', message: 'Only 0 left of Organic henna cones · 12 pack' } },
  });
  await wrap(<><ShopHome onOpenProduct={jest.fn()} onOpenCart={jest.fn()} /><CheckoutScreen onPlaced={jest.fn()} /></>);

  await fireEvent.press(await screen.findByRole('button', { name: 'Add Organic henna cones · 12 pack to cart' }));
  await fireEvent.changeText(screen.getByLabelText('Deliver to'), 'Flat 1204, Koramangala, Bangalore 560034');
  await fireEvent.press(screen.getByText('Place order'));

  expect(await screen.findByText('Only 0 left of Organic henna cones · 12 pack')).toBeTruthy();
});

it('the shop shows an error with a retry when it can’t load', async () => {
  serve({ 'GET /shop/products': { status: 503, json: { code: 'service_unavailable', message: 'Service temporarily unavailable. Please try again.' } } });
  await wrap(<ShopHome onOpenProduct={jest.fn()} onOpenCart={jest.fn()} />);

  expect(await screen.findByText('Service temporarily unavailable. Please try again.')).toBeTruthy();
});

it('the artist confirms an order, then ships it with tracking', async () => {
  serve({
    'POST /artists/me/shop/orders/o-1/confirm': { status: 200, json: orderFixture({ status: 'confirmed' }) },
    'POST /artists/me/shop/orders/o-1/ship': { status: 200, json: orderFixture({ status: 'shipped' }) },
    'GET /artists/me/shop/summary': { status: 200, json: { to_pack: 0, orders_this_month: 1, sales_this_month_paise: 100900, products: 1 } },
  });
  const { rerender } = await wrap(<ShopOrderCard order={orderFixture()} />);

  await fireEvent.press(screen.getByText('Confirm order'));
  await waitFor(() => expect(send.mock.calls.some(([r]) => r.path === '/artists/me/shop/orders/o-1/confirm')).toBe(true));

  await rerender(<Providers><ShopOrderCard order={orderFixture({ status: 'confirmed' })} /></Providers>);
  await fireEvent.changeText(screen.getByLabelText('Tracking (optional)'), 'Delhivery 78294410');
  await fireEvent.press(screen.getByText('Mark shipped'));

  await waitFor(() => {
    const shipped = send.mock.calls.find(([r]) => r.path === '/artists/me/shop/orders/o-1/ship');
    expect(shipped?.[0].body).toEqual({ tracking: 'Delhivery 78294410' });
  });
});
