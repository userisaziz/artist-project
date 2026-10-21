import type { ReactElement } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../../core/theme/theme-provider';
import { transport } from '../../core/api/client';
import type { TransportRequest } from '../../core/api/transport';
import { ArtistBookingDetail } from '../../components/bookings/ArtistBookingDetail';
import RescheduleBooking from '../../../app/customer/reschedule/[id]';
import { bookingFixture } from '../../mocks/bookings/bookings';

const mockBack = jest.fn();
jest.mock('../../context/auth/auth-provider', () => ({
  useAuth: () => ({ user: jest.requireActual('../../mocks/auth/auth').userFixture }),
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack, push: jest.fn() }), useLocalSearchParams: () => ({ id: 'b-1' }), useIsFocused: () => true }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

jest.setTimeout(20_000);

const MOVE = { start_at: '2030-11-03T05:30:00Z', end_at: '2030-11-03T08:30:00Z', expires_at: '2030-11-01T08:00:00Z', requested_at: '2030-11-01T05:00:00Z' };
const send = jest.spyOn(transport, 'request');
const sent: { key: string; body: unknown }[] = [];
let client: QueryClient;
const wrap = (ui: ReactElement) => render(<QueryClientProvider client={client}><ThemeProvider>{ui}</ThemeProvider></QueryClientProvider>);
function serve(routes: Record<string, unknown>) {
  send.mockImplementation(async (req: TransportRequest) => {
    const key = `${req.method} ${req.path.split('?')[0]}`;
    sent.push({ key, body: req.body });
    if (key in routes) {
      const route = routes[key];
      return (typeof route === 'function' ? (route as (r: TransportRequest) => unknown)(req) : { status: 200, json: route }) as { status: number; json: unknown };
    }
    return { status: 200, json: { items: [], next_cursor: null } }; // lists refreshed after a write
  });
}

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  sent.length = 0;
  send.mockReset();
  mockBack.mockReset();
});
afterEach(() => client.clear());
afterAll(() => send.mockRestore());

it('the artist accepts a request to move a booking', async () => {
  serve({
    'GET /artists/me/bookings/b-1': bookingFixture({ reschedule: MOVE }),
    'POST /artists/me/bookings/b-1/reschedule/accept': bookingFixture({ start_at: MOVE.start_at, end_at: MOVE.end_at }),
  });
  await wrap(<ArtistBookingDetail bookingId="b-1" onMessage={jest.fn()} isOpeningChat={false} />);

  expect(await screen.findByText(/^Asked to move to /)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Accept new time' }));

  await waitFor(() => expect(screen.queryByText(/^Asked to move to /)).toBeNull());
  expect(sent.map((s) => s.key)).toContain('POST /artists/me/bookings/b-1/reschedule/accept');
});

it('the artist declines with a reason and the time stays', async () => {
  serve({
    'GET /artists/me/bookings/b-1': bookingFixture({ reschedule: MOVE }),
    'POST /artists/me/bookings/b-1/reschedule/decline': bookingFixture({ reschedule_declined_reason: 'Fully booked that day' }),
  });
  await wrap(<ArtistBookingDetail bookingId="b-1" onMessage={jest.fn()} isOpeningChat={false} />);

  await fireEvent.press(await screen.findByRole('button', { name: 'Decline' }));
  await fireEvent.changeText(screen.getByLabelText('Reason (optional)'), 'Fully booked that day');
  await fireEvent.press(screen.getByRole('button', { name: 'Keep current time' }));

  await waitFor(() => expect(sent).toContainEqual({ key: 'POST /artists/me/bookings/b-1/reschedule/decline', body: { reason: 'Fully booked that day' } }));
});

it('the customer picks a new open time and asks to move', async () => {
  const day = (iso: string) => new URLSearchParams(iso.split('?')[1]).get('date') ?? '';
  serve({
    'GET /bookings/b-1': bookingFixture(),
    'GET /artists/a1/availability': (req: TransportRequest) => ({ status: 200, json: { date: day(req.path), slots: [{ start_at: `${day(req.path)}T12:00:00+05:30`, available: true }] } }),
    'POST /bookings/b-1/reschedule': (req: TransportRequest) => ({ status: 200, json: bookingFixture({ reschedule: { ...MOVE, start_at: (req.body as { start_at: string }).start_at } }) }),
  });
  await wrap(<RescheduleBooking />);

  await fireEvent.press(await screen.findByRole('button', { name: '12:00 PM, available' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Ask to move' }));

  await waitFor(() => expect(mockBack).toHaveBeenCalled());
  const asked = sent.find((s) => s.key === 'POST /bookings/b-1/reschedule');
  expect((asked?.body as { start_at: string }).start_at).toMatch(/T12:00:00\+05:30$/);
});

it('a taken time shows why and stays on the screen', async () => {
  const day = (iso: string) => new URLSearchParams(iso.split('?')[1]).get('date') ?? '';
  serve({
    'GET /bookings/b-1': bookingFixture(),
    'GET /artists/a1/availability': (req: TransportRequest) => ({ status: 200, json: { date: day(req.path), slots: [{ start_at: `${day(req.path)}T12:00:00+05:30`, available: true }] } }),
    'POST /bookings/b-1/reschedule': () => ({ status: 409, json: { code: 'conflict', message: 'That time was just taken. Pick another.' } }),
  });
  await wrap(<RescheduleBooking />);
  await fireEvent.press(await screen.findByRole('button', { name: '12:00 PM, available' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Ask to move' }));
  expect(await screen.findByText('That time was just taken. Pick another.')).toBeTruthy();
  expect(mockBack).not.toHaveBeenCalled();
});
