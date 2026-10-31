import type { ReactElement } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../../core/theme/theme-provider';
import { transport } from '../../core/api/client';
import type { TransportRequest } from '../../core/api/transport';
import { ShopSettingsForm } from '../../components/shop/ShopSettingsForm';
import type { ShopSettings } from '../../types/shop/shop';

jest.mock('../../context/auth/auth-provider', () => ({
  useAuth: () => ({ user: jest.requireActual('../../mocks/auth/auth').userFixture }),
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const SETTINGS: ShopSettings = { pay_on_delivery: true, pay_before_shipping: false, delivery_fee_paise: 10_000, free_delivery_over_paise: 99_900 };
const send = jest.spyOn(transport, 'request');
const sent: TransportRequest[] = [];
let client: QueryClient;
const wrap = (ui: ReactElement) => render(<QueryClientProvider client={client}><ThemeProvider>{ui}</ThemeProvider></QueryClientProvider>);

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  sent.length = 0;
  send.mockReset();
  send.mockImplementation(async (req: TransportRequest) => {
    sent.push(req);
    if (req.method === 'GET') return { status: 200, json: SETTINGS };
    return { status: 200, json: { ...SETTINGS, ...(req.body as object) } };
  });
});
afterAll(() => send.mockRestore());

it('saves a charge the artist typed in rupees', async () => {
  await wrap(<ShopSettingsForm onSaved={jest.fn()} />);
  await fireEvent.changeText(await screen.findByLabelText('Delivery charge (₹)'), '250');

  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

  await waitFor(() => expect(sent.find((r) => r.method === 'PUT')?.body).toEqual({
    pay_on_delivery: true, pay_before_shipping: false, delivery_fee_paise: 25_000, free_delivery_over_paise: 99_900,
  }));
});

it('refuses to save a charge that is not an amount, instead of quietly making delivery free', async () => {
  await wrap(<ShopSettingsForm onSaved={jest.fn()} />);
  const charge = await screen.findByLabelText('Delivery charge (₹)');

  await fireEvent.changeText(charge, 'free for friends');

  expect(screen.getByText('Enter the charge in rupees, or leave it empty.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  expect(sent.filter((r) => r.method === 'PUT')).toHaveLength(0);
});

it('says the same about the free-delivery threshold, and leaves it alone when empty', async () => {
  await wrap(<ShopSettingsForm onSaved={jest.fn()} />);
  const over = await screen.findByLabelText('Free delivery over (₹, optional)');

  await fireEvent.changeText(over, 'soon');
  expect(screen.getByText('Enter the threshold in rupees, or leave it empty.')).toBeTruthy();

  await fireEvent.changeText(over, '');
  expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
});
