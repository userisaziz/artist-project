import type { ReactElement } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../../core/theme/theme-provider';
import { transport } from '../../core/api/client';
import type { TransportRequest } from '../../core/api/transport';
import { MyShop } from '../../components/shop/MyShop';
import { orderFixture, productFixture } from '../../mocks/shop/shop';

jest.mock('../../context/auth/auth-provider', () => ({
  useAuth: () => ({ user: jest.requireActual('../../mocks/auth/auth').userFixture }),
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const send = jest.spyOn(transport, 'request');
const paths: string[] = [];
let summaryFails = false;
let client: QueryClient;
const wrap = (ui: ReactElement) => render(<QueryClientProvider client={client}><ThemeProvider>{ui}</ThemeProvider></QueryClientProvider>);

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  send.mockReset();
  paths.length = 0;
  summaryFails = false;
  // Mirrors backend app/shop/artist_router.py: cursor pages of products and orders, and the summary.
  send.mockImplementation(async (req: TransportRequest) => {
    paths.push(req.path);
    const [path, query = ''] = req.path.split('?');
    const cursor = new URLSearchParams(query).get('cursor');
    if (path.endsWith('/summary')) {
      return summaryFails
        ? { status: 503, json: { code: 'service_unavailable', message: 'Try again' } }
        : { status: 200, json: { to_pack: 2, orders_this_month: 7, sales_this_month_paise: 420000, products: 2 } };
    }
    if (path.endsWith('/products')) {
      return cursor
        ? { status: 200, json: { items: [productFixture({ id: 'p-2', name: 'Bridal stencil kit' })], next_cursor: null } }
        : { status: 200, json: { items: [productFixture({ id: 'p-1', name: 'Henna cones' })], next_cursor: 'c2' } };
    }
    if (path.endsWith('/orders')) return { status: 200, json: { items: [orderFixture()], next_cursor: null } };
    return { status: 200, json: {} };
  });
});
afterEach(() => client.clear());
afterAll(() => send.mockRestore());

const shop = () => <MyShop onAddProduct={jest.fn()} onEditProduct={jest.fn()} onOpenSettings={jest.fn()} />;

it('loads the next page of products at the end of the list', async () => {
  await wrap(shop());
  expect(await screen.findByText('Henna cones')).toBeTruthy();
  await fireEvent(screen.getByLabelText('Your products'), 'endReached'); // the user reaches the bottom
  expect(await screen.findByText('Bridal stencil kit')).toBeTruthy();
  expect(paths.some((p) => p.includes('/products') && p.includes('cursor=c2'))).toBe(true);
});

it('opens only the orders to pack from the banner', async () => {
  await wrap(shop());
  await fireEvent.press(await screen.findByText('2 orders to pack'));
  expect(await screen.findByText('AT-48213', { exact: false })).toBeTruthy();
  expect(paths.some((p) => p.includes('/orders') && p.includes('view=to_pack'))).toBe(true);
});

it('says when the shop totals fail and retries', async () => {
  summaryFails = true;
  await wrap(shop());
  expect(await screen.findByText('Couldn’t load your shop totals. Tap to try again.')).toBeTruthy();
  expect(screen.getAllByText('—').length).toBe(2);
  summaryFails = false;
  await fireEvent.press(screen.getByText('Couldn’t load your shop totals. Tap to try again.'));
  expect(await screen.findByText('₹4,200')).toBeTruthy();
});
