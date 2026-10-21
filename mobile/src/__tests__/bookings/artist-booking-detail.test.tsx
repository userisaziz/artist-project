import type { ReactElement } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../../core/theme/theme-provider';
import { transport } from '../../core/api/client';
import type { TransportRequest } from '../../core/api/transport';
import { ArtistBookingDetail } from '../../components/bookings/ArtistBookingDetail';
import { bookingFixture } from '../../mocks/bookings/bookings';

jest.mock('../../context/auth/auth-provider', () => ({
  useAuth: () => ({ user: jest.requireActual('../../mocks/auth/auth').userFixture }),
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }), useIsFocused: () => true }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

jest.setTimeout(20_000);

const DETAIL = 'GET /artists/me/bookings/b-1';
const send = jest.spyOn(transport, 'request');
let client: QueryClient;
const wrap = (ui: ReactElement) => render(<QueryClientProvider client={client}><ThemeProvider>{ui}</ThemeProvider></QueryClientProvider>);

function serve(routes: Record<string, unknown>) {
  send.mockImplementation(async (req: TransportRequest) => {
    const key = `${req.method} ${req.path}`;
    if (!(key in routes)) return { status: 200, json: { items: [], next_cursor: null } }; // list refetches after a write
    const route = routes[key];
    return (typeof route === 'function' ? (route as (r: TransportRequest) => unknown)(req) : route) as { status: number; json: unknown };
  });
}

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  send.mockReset();
});
afterEach(() => client.clear());
afterAll(() => send.mockRestore());

it('shows a confirmed booking with what the artist earns; Mark completed waits for the start', async () => {
  serve({ [DETAIL]: { status: 200, json: bookingFixture() } });
  const onMessage = jest.fn();
  await wrap(<ArtistBookingDetail bookingId="b-1" onMessage={onMessage} isOpeningChat={false} />);

  expect(await screen.findByText('Booking AT-10427')).toBeTruthy();
  expect(screen.getByText('Priya Sharma')).toBeTruthy();
  expect(screen.getByText('12 Residency Rd, Bangalore')).toBeTruthy();
  expect(screen.getByText('Gate code 4411')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Mark completed' })).toBeDisabled();

  await fireEvent.press(screen.getByRole('button', { name: 'Message customer' }));
  expect(onMessage).toHaveBeenCalled();
});

it('accepts a request from its page', async () => {
  serve({
    [DETAIL]: { status: 200, json: bookingFixture({ status: 'requested', responded_at: null }) },
    'POST /artists/me/bookings/b-1/accept': { status: 200, json: bookingFixture() },
  });
  await wrap(<ArtistBookingDetail bookingId="b-1" onMessage={jest.fn()} isOpeningChat={false} />);

  await fireEvent.press(await screen.findByRole('button', { name: 'Accept Priya Sharma' }));

  expect(await screen.findByRole('button', { name: 'Mark completed' })).toBeTruthy();
});

it('offers a retry when the booking cannot be loaded', async () => {
  serve({ [DETAIL]: { status: 404, json: { code: 'not_found', message: 'Booking not found' } } });
  await wrap(<ArtistBookingDetail bookingId="b-1" onMessage={jest.fn()} isOpeningChat={false} />);

  expect(await screen.findByText('Booking not found')).toBeTruthy();
  expect(screen.getByRole('button', { name: /try again/i })).toBeTruthy();
});
