import type { ReactElement } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../../core/theme/theme-provider';
import { transport } from '../../core/api/client';
import type { TransportRequest } from '../../core/api/transport';
import { ArtistEnquiries } from '../../components/quotes/ArtistEnquiries';
import { ArtistEnquiryDetail } from '../../components/quotes/ArtistEnquiryDetail';
import { enquiryFixture, quoteFixture } from '../../mocks/quotes/quotes';
import { addDays, formatDay, istDateKey } from '../../utils/common/time';

jest.mock('../../context/auth/auth-provider', () => ({
  useAuth: () => ({ user: jest.requireActual('../../mocks/auth/auth').userFixture }),
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }), useLocalSearchParams: () => ({}), useIsFocused: () => true }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

jest.setTimeout(20_000);

type Route = unknown | ((req: TransportRequest) => { status: number; json: unknown });
const send = jest.spyOn(transport, 'request');
const sent: { key: string; path: string; body: unknown }[] = [];
let client: QueryClient;
const wrap = (ui: ReactElement) => render(<QueryClientProvider client={client}><ThemeProvider>{ui}</ThemeProvider></QueryClientProvider>);
function serve(routes: Record<string, Route>) {
  send.mockImplementation(async (req: TransportRequest) => {
    const key = `${req.method} ${req.path.split('?')[0]}`;
    sent.push({ key, path: req.path, body: req.body });
    if (key in routes) {
      const route = routes[key];
      return typeof route === 'function' ? (route as (r: TransportRequest) => { status: number; json: unknown })(req) : { status: 200, json: route };
    }
    return { status: 200, json: { items: [], next_cursor: null } }; // lists refreshed after a write
  });
}
const statusOf = (path: string) => new URLSearchParams(path.split('?')[1]).get('status') ?? '';
const today = istDateKey(Date.now());
const OPEN = enquiryFixture({ event_date: addDays(today, 10) });

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  sent.length = 0;
  send.mockReset();
});
afterEach(() => client.clear());
afterAll(() => send.mockRestore());

describe('Enquiries tabs', () => {
  it('shows open enquiries with counts, and switches to quoted ones', async () => {
    const quoted = enquiryFixture({ id: 'e-2', status: 'quoted', customer: { first_name: 'Neha', last_name: 'Kapoor' }, quote: quoteFixture() });
    serve({
      'GET /artists/me/enquiries/summary': { open: 2, quoted: 1 },
      'GET /artists/me/enquiries': (req: TransportRequest) => ({ status: 200, json: { items: statusOf(req.path) === 'quoted' ? [quoted] : [OPEN], next_cursor: null } }),
    });
    const onOpen = jest.fn();
    await wrap(<ArtistEnquiries onOpen={onOpen} />);

    expect(await screen.findByRole('tab', { name: 'Open · 2' })).toBeTruthy();
    expect(await screen.findByText('Priya S.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('tab', { name: 'Quoted · 1' }));
    expect(await screen.findByText('Neha K.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /^Neha K\., / }));

    expect(onOpen).toHaveBeenCalledWith('e-2');
    expect(sent.filter((s) => s.key === 'GET /artists/me/enquiries').map((s) => statusOf(s.path))).toEqual(['open', 'quoted']);
  });

  it('shows the empty state for a tab with nothing in it', async () => {
    serve({ 'GET /artists/me/enquiries/summary': { open: 0, quoted: 0 }, 'GET /artists/me/enquiries': { items: [], next_cursor: null } });
    await wrap(<ArtistEnquiries onOpen={jest.fn()} />);
    expect(await screen.findByText('No new enquiries. Customers can ask for a quote from your page.')).toBeTruthy();
  });

  it('shows a failed load with Try again', async () => {
    serve({
      'GET /artists/me/enquiries/summary': { open: 0, quoted: 0 },
      'GET /artists/me/enquiries': () => ({ status: 500, json: { code: 'server_error', message: 'Could not load enquiries' } }),
    });
    await wrap(<ArtistEnquiries onOpen={jest.fn()} />);
    expect(await screen.findByText('Could not load enquiries')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });
});

describe('answering an enquiry', () => {
  it('sends a quote with price, duration, note and valid until', async () => {
    serve({
      'GET /artists/me/enquiries/e-1': OPEN,
      'POST /artists/me/enquiries/e-1/quote': (req: TransportRequest) => ({ status: 200, json: { ...OPEN, status: 'quoted', quote: { ...(req.body as object), quoted_at: '2030-11-01T06:00:00Z' } } }),
    });
    await wrap(<ArtistEnquiryDetail enquiryId="e-1" onOpenBooking={jest.fn()} />);

    expect(await screen.findByText('Bridal mehendi for the bride and four bridesmaids')).toBeTruthy();
    expect(screen.getByText('Priya S.')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Price in ₹'), '12,500');
    await fireEvent.press(screen.getByRole('button', { name: 'Duration later' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Duration later' }));
    await fireEvent.changeText(screen.getByLabelText('Note (optional)'), 'Trial included');
    await fireEvent.press(screen.getByRole('button', { name: formatDay(addDays(today, 5)) }));
    await fireEvent.press(screen.getByRole('button', { name: 'Send quote' }));

    await waitFor(() => expect(sent.find((s) => s.key === 'POST /artists/me/enquiries/e-1/quote')?.body).toEqual({
      price_paise: 1_250_000, duration_minutes: 180, note: 'Trial included', valid_until: addDays(today, 5),
    }));
    expect(await screen.findByRole('button', { name: 'Update quote' })).toBeTruthy();
    expect(screen.getByText('Quoted')).toBeTruthy();
  });

  it('shows why a quote was refused', async () => {
    serve({
      'GET /artists/me/enquiries/e-1': OPEN,
      'POST /artists/me/enquiries/e-1/quote': () => ({ status: 409, json: { code: 'conflict', message: 'This enquiry is closed.' } }),
    });
    await wrap(<ArtistEnquiryDetail enquiryId="e-1" onOpenBooking={jest.fn()} />);
    await fireEvent.changeText(await screen.findByLabelText('Price in ₹'), '5000');
    await fireEvent.press(screen.getByRole('button', { name: 'Send quote' }));
    expect(await screen.findByText('This enquiry is closed.')).toBeTruthy();
  });

  it('declines with a reason', async () => {
    serve({
      'GET /artists/me/enquiries/e-1': OPEN,
      'POST /artists/me/enquiries/e-1/decline': { ...OPEN, status: 'declined', decline_reason: 'Fully booked that week' },
    });
    await wrap(<ArtistEnquiryDetail enquiryId="e-1" onOpenBooking={jest.fn()} />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Decline' }));
    await fireEvent.changeText(screen.getByLabelText('Reason (optional)'), 'Fully booked that week');
    await fireEvent.press(screen.getByRole('button', { name: 'Decline enquiry' }));

    expect(await screen.findByText('You declined: Fully booked that week')).toBeTruthy();
    expect(sent).toContainEqual({ key: 'POST /artists/me/enquiries/e-1/decline', path: '/artists/me/enquiries/e-1/decline', body: { reason: 'Fully booked that week' } });
    expect(screen.queryByRole('button', { name: 'Send quote' })).toBeNull();
  });

  it('links to the booking once the customer accepts', async () => {
    serve({ 'GET /artists/me/enquiries/e-1': { ...OPEN, status: 'accepted', quote: quoteFixture(), booking_id: 'b-9' } });
    const onOpenBooking = jest.fn();
    await wrap(<ArtistEnquiryDetail enquiryId="e-1" onOpenBooking={onOpenBooking} />);
    await fireEvent.press(await screen.findByRole('button', { name: 'View booking' }));
    expect(onOpenBooking).toHaveBeenCalledWith('b-9');
  });

  it('shows a failed load with Try again', async () => {
    serve({ 'GET /artists/me/enquiries/e-1': () => ({ status: 404, json: { code: 'not_found', message: 'Enquiry not found' } }) });
    await wrap(<ArtistEnquiryDetail enquiryId="e-1" onOpenBooking={jest.fn()} />);
    expect(await screen.findByText('Enquiry not found')).toBeTruthy();
  });
});
