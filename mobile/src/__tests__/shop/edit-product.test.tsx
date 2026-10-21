import type { ReactElement } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../../core/theme/theme-provider';
import { transport } from '../../core/api/client';
import type { TransportRequest } from '../../core/api/transport';
import { EditProductForm } from '../../components/shop/EditProductForm';
import { productFixture } from '../../mocks/shop/shop';
import { paiseToRupeesText } from '../../utils/shop/cart';

jest.mock('../../context/auth/auth-provider', () => ({
  useAuth: () => ({ user: jest.requireActual('../../mocks/auth/auth').userFixture }),
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }), useIsFocused: () => true }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

jest.setTimeout(20_000);

const LIST = 'GET /artists/me/shop/products';
const PATCH = 'PATCH /artists/me/shop/products/pr-1';
const send = jest.spyOn(transport, 'request');
let client: QueryClient;
const wrap = (ui: ReactElement) => render(<QueryClientProvider client={client}><ThemeProvider>{ui}</ThemeProvider></QueryClientProvider>);

function serve(routes: Record<string, unknown>) {
  send.mockImplementation(async (req: TransportRequest) => {
    const key = `${req.method} ${req.path}`;
    if (!(key in routes)) throw new Error(`unexpected request ${key}`);
    const route = routes[key];
    return (typeof route === 'function' ? (route as (r: TransportRequest) => unknown)(req) : route) as { status: number; json: unknown };
  });
}
const listed = { status: 200, json: { items: [productFixture()], next_cursor: null } };

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  send.mockReset();
});
afterEach(() => client.clear());
afterAll(() => send.mockRestore());

it('prefills the product and saves only what changed', async () => {
  const patches: unknown[] = [];
  serve({ [LIST]: listed, [PATCH]: (req: TransportRequest) => { patches.push(req.body); return { status: 200, json: productFixture() }; } });
  const onDone = jest.fn();
  await wrap(<EditProductForm productId="pr-1" onDone={onDone} />);

  const price = await screen.findByDisplayValue('480');
  expect(screen.getByDisplayValue('600')).toBeTruthy();
  await fireEvent.changeText(price, '450');
  await fireEvent.changeText(screen.getByDisplayValue('600'), '');
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

  await waitFor(() => expect(onDone).toHaveBeenCalled());
  expect(patches).toEqual([{ price_paise: 45000, mrp_paise: null }]);
});

it('blocks saving an MRP below the price, and shows a failed save', async () => {
  serve({ [LIST]: listed, [PATCH]: { status: 422, json: { code: 'validation_error', message: 'Name looks like spam' } } });
  await wrap(<EditProductForm productId="pr-1" onDone={jest.fn()} />);

  await fireEvent.changeText(await screen.findByDisplayValue('600'), '300');
  expect(screen.getByText('The MRP can’t be below the price')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

  await fireEvent.changeText(screen.getByDisplayValue('300'), '600');
  await fireEvent.changeText(screen.getByDisplayValue(productFixture().name), 'Buy now cheap cones');
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText('Name looks like spam')).toBeTruthy();
});

it('says so when the product is no longer in the shop', async () => {
  serve({ [LIST]: { status: 200, json: { items: [], next_cursor: null } } });
  await wrap(<EditProductForm productId="pr-1" onDone={jest.fn()} />);
  expect(await screen.findByText('This product is no longer in your shop.')).toBeTruthy();
});

it('shows prices the way an artist types them', () => {
  expect(paiseToRupeesText(115000)).toBe('1150');
  expect(paiseToRupeesText(115050)).toBe('1150.50');
});
