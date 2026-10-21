import type { ReactElement } from 'react';
import { render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../../core/theme/theme-provider';
import { transport } from '../../core/api/client';
import { EarningsHistory } from '../../components/bookings/EarningsHistory';

jest.mock('../../context/auth/auth-provider', () => ({
  useAuth: () => ({ user: jest.requireActual('../../mocks/auth/auth').userFixture }),
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const send = jest.spyOn(transport, 'request');
let client: QueryClient;
const wrap = (ui: ReactElement) => render(<QueryClientProvider client={client}><ThemeProvider>{ui}</ThemeProvider></QueryClientProvider>);

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  send.mockReset();
});
afterEach(() => client.clear());
afterAll(() => send.mockRestore());

it('lists earnings month by month with the twelve-month total', async () => {
  // Mirrors GET /artists/me/earnings?months=12 (newest first; empty months included).
  send.mockResolvedValue({ status: 200, json: { months: [
    { month: '2026-10', bookings: 2, earnings_paise: 990000 },
    { month: '2026-09', bookings: 0, earnings_paise: 0 },
    { month: '2026-08', bookings: 1, earnings_paise: 495000 },
  ] } });
  await wrap(<EarningsHistory />);

  expect(await screen.findByText('₹14,850')).toBeTruthy();
  expect(screen.getByText('October 2026')).toBeTruthy();
  expect(screen.getByText('2 completed')).toBeTruthy();
  expect(screen.getByText('No completed bookings')).toBeTruthy();
  expect(send.mock.calls[0][0]).toMatchObject({ method: 'GET', path: '/artists/me/earnings?months=12' });
});

it('offers a retry when earnings cannot load', async () => {
  send.mockResolvedValue({ status: 503, json: { code: 'service_unavailable', message: 'Try again in a minute' } });
  await wrap(<EarningsHistory />);
  expect(await screen.findByText('Try again in a minute')).toBeTruthy();
  expect(screen.getByRole('button', { name: /try again/i })).toBeTruthy();
});
