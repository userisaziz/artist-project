import type { ReactElement } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../../core/theme/theme-provider';
import { transport } from '../../core/api/client';
import type { TransportRequest } from '../../core/api/transport';
import type { ArtistDashboard } from '../../types/bookings/bookings';
import ArtistHome from '../../../app/artist/(tabs)/home';

const mockPush = jest.fn();
const mockNavigate = jest.fn();
jest.mock('../../context/auth/auth-provider', () => ({
  useAuth: () => ({ user: jest.requireActual('../../mocks/auth/auth').userFixture }),
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, navigate: mockNavigate }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

jest.setTimeout(20_000);

// Mirrors GET /artists/me/dashboard.
const DASHBOARD: ArtistDashboard = {
  requests: 3,
  requests_expiring_soon: 1,
  reschedules_pending: 1,
  enquiries_open: 2,
  upcoming: 9,
  upcoming_this_week: 4,
  completed_this_month: 5,
  earnings_this_month_paise: 2480000,
  completed_last_month: 4,
  earnings_last_month_paise: 2000000,
  rating: 4.8,
  review_count: 36,
  trend: [
    { month: '2026-06', bookings: 2, earnings_paise: 900000 },
    { month: '2026-07', bookings: 3, earnings_paise: 1400000 },
    { month: '2026-08', bookings: 0, earnings_paise: 0 },
    { month: '2026-09', bookings: 4, earnings_paise: 1800000 },
    { month: '2026-10', bookings: 4, earnings_paise: 2000000 },
    { month: '2026-11', bookings: 5, earnings_paise: 2480000 },
  ],
  today: [],
};

const send = jest.spyOn(transport, 'request');
let client: QueryClient;
const wrap = (ui: ReactElement) => render(<QueryClientProvider client={client}><ThemeProvider>{ui}</ThemeProvider></QueryClientProvider>);

function serve(dashboard: { status: number; json: unknown }) {
  send.mockImplementation(async (req: TransportRequest) => {
    const path = req.path.split('?')[0];
    if (path === '/artists/me/dashboard') return dashboard;
    if (path === '/artists/me/bookings') return { status: 200, json: { items: [], next_cursor: null } };
    if (path === '/artists/me/requirements') return { status: 200, json: { on_hold: false, items: [] } };
    if (path === '/notifications/unread-count') return { status: 200, json: { count: 0 } };
    return { status: 200, json: { items: [] } };
  });
}

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  send.mockReset();
  mockPush.mockReset();
  mockNavigate.mockReset();
});
afterEach(() => client.clear());
afterAll(() => send.mockRestore());

it('shows the month against last month, the KPI tiles and what needs attention', async () => {
  serve({ status: 200, json: DASHBOARD });
  await wrap(<ArtistHome />);

  expect(await screen.findByText('₹24,800')).toBeTruthy();
  expect(screen.getByText('+24% vs last month')).toBeTruthy();
  expect(screen.getByText('4.8')).toBeTruthy();
  expect(screen.getByText('36 reviews')).toBeTruthy();
  expect(screen.getByText('1 expiring soon')).toBeTruthy();
  expect(screen.getByText('1 request expires soon')).toBeTruthy();
  expect(screen.getByText('1 client wants a new time')).toBeTruthy();
  expect(screen.getByText('2 enquiries wait for a quote')).toBeTruthy();

  await fireEvent.press(screen.getByRole('button', { name: /^Enquiries: 2/ }));
  expect(mockNavigate).toHaveBeenCalledWith('/artist/enquiries');
  await fireEvent.press(screen.getByRole('button', { name: 'New post' }));
  expect(mockPush).toHaveBeenCalledWith('/artist/posts/new');
});

it('says all caught up when nothing waits on the artist', async () => {
  serve({ status: 200, json: { ...DASHBOARD, requests: 0, requests_expiring_soon: 0, reschedules_pending: 0, enquiries_open: 0, rating: null, review_count: 0 } });
  await wrap(<ArtistHome />);
  expect(await screen.findByText('You’re all caught up')).toBeTruthy();
  expect(screen.getByText('No reviews yet')).toBeTruthy();
});

it('offers a retry when the dashboard cannot load', async () => {
  serve({ status: 503, json: { code: 'service_unavailable', message: 'Try again in a minute' } });
  await wrap(<ArtistHome />);
  expect(await screen.findByText('Try again in a minute')).toBeTruthy();
  expect(screen.getAllByRole('button', { name: /try again/i }).length).toBeGreaterThan(0);
});
