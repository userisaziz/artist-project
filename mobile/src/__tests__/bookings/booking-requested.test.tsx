import type { ReactElement } from 'react';
import { render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../../core/theme/theme-provider';
import { transport } from '../../core/api/client';
import type { TransportRequest } from '../../core/api/transport';
import BookingRequested from '../../../app/customer/book/done';
import { bookingFixture } from '../../mocks/bookings/bookings';

jest.mock('../../context/auth/auth-provider', () => ({
  useAuth: () => ({ user: jest.requireActual('../../mocks/auth/auth').userFixture }),
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn(), dismissTo: jest.fn() }), useLocalSearchParams: () => ({ id: 'b-1' }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const send = jest.spyOn(transport, 'request');
let client: QueryClient;
const wrap = (ui: ReactElement) => render(<QueryClientProvider client={client}><ThemeProvider>{ui}</ThemeProvider></QueryClientProvider>);
function serve(booking: unknown, status = 200) {
  send.mockImplementation(async (req: TransportRequest) =>
    (req.path.startsWith('/bookings/b-1') ? { status, json: booking } : { status: 200, json: {} }) as { status: number; json: unknown });
}

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  send.mockReset();
});
afterEach(() => client.clear());
afterAll(() => send.mockRestore());

it('says who the customer is waiting for once the request is sent', async () => {
  serve(bookingFixture({ status: 'requested' }));
  await wrap(<BookingRequested />);

  expect(await screen.findByText('Waiting for Ayesha Mehendi Art')).toBeTruthy();
  expect(screen.getByText(/usually confirms within/)).toBeTruthy();
});

it('shows the error state when the booking cannot be loaded', async () => {
  serve({ detail: 'Booking not found' }, 404);
  await wrap(<BookingRequested />);

  expect(await screen.findByText(/not found/i)).toBeTruthy();
  expect(screen.queryByText(/^Waiting for /)).toBeNull();
});
