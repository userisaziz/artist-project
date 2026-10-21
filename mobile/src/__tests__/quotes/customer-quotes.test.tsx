import type { ReactElement } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../../core/theme/theme-provider';
import { transport } from '../../core/api/client';
import type { TransportRequest } from '../../core/api/transport';
import { EnquiryForm } from '../../components/quotes/EnquiryForm';
import { CustomerEnquiries } from '../../components/quotes/CustomerEnquiries';
import { CustomerEnquiryDetail } from '../../components/quotes/CustomerEnquiryDetail';
import AcceptQuoteScreen from '../../../app/customer/enquiries/[id]/accept';
import { enquiryFixture, quoteFixture } from '../../mocks/quotes/quotes';
import { istDateKey } from '../../utils/common/time';

const mockReplace = jest.fn();
jest.mock('../../context/auth/auth-provider', () => ({
  useAuth: () => ({ user: jest.requireActual('../../mocks/auth/auth').userFixture }),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: mockReplace }),
  useLocalSearchParams: () => ({ id: 'e-1' }),
  useIsFocused: () => true,
}));
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
const dateOf = (path: string) => new URLSearchParams(path.split('?')[1]).get('date') ?? '';
const QUOTED = enquiryFixture({ status: 'quoted', quote: quoteFixture() });

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  sent.length = 0;
  send.mockReset();
  mockReplace.mockReset();
});
afterEach(() => client.clear());
afterAll(() => send.mockRestore());

describe('sending an enquiry', () => {
  it('posts the date, details and budget in paise, then opens the enquiry', async () => {
    serve({ 'POST /enquiries': () => ({ status: 201, json: enquiryFixture({ id: 'e-7' }) }) });
    const onSent = jest.fn();
    await wrap(<EnquiryForm artistId="a1" artistName="Ayesha Mehendi Art" onSent={onSent} />);

    const days = screen.getAllByRole('button').filter((b) => /^[A-Z][a-z]{2}, \d+ [A-Z][a-z]{2}$/.test(b.props.accessibilityLabel ?? ''));
    expect(days).toHaveLength(60);
    await fireEvent.press(days[0]);
    await fireEvent.changeText(screen.getByLabelText('What do you need?'), 'Bridal mehendi for five people');
    await fireEvent.changeText(screen.getByLabelText('Budget in ₹ (optional)'), '12,000');
    expect(screen.getByText('30/1000')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(onSent).toHaveBeenCalledWith('e-7'));
    expect(sent[0]).toEqual({
      key: 'POST /enquiries',
      path: '/enquiries',
      body: { artist_id: 'a1', event_date: istDateKey(Date.now()), details: 'Bridal mehendi for five people', budget_paise: 1_200_000 },
    });
  });

  it('shows why the server refused it (an open enquiry already) and stays', async () => {
    serve({ 'POST /enquiries': () => ({ status: 409, json: { code: 'conflict', message: 'You already have an open enquiry with this artist.' } }) });
    const onSent = jest.fn();
    await wrap(<EnquiryForm artistId="a1" onSent={onSent} />);

    const days = screen.getAllByRole('button').filter((b) => /^[A-Z][a-z]{2}, \d+ [A-Z][a-z]{2}$/.test(b.props.accessibilityLabel ?? ''));
    await fireEvent.press(days[3]);
    await fireEvent.changeText(screen.getByLabelText('What do you need?'), 'Party makeup for two');
    await fireEvent.press(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText('You already have an open enquiry with this artist.')).toBeTruthy();
    expect(onSent).not.toHaveBeenCalled();
  });

  it('asks for a date and enough detail before sending anything', async () => {
    serve({});
    await wrap(<EnquiryForm artistId="a1" onSent={jest.fn()} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Send' }));
    expect(screen.getByText('Pick the date of your event.')).toBeTruthy();
    expect(sent).toHaveLength(0);
  });
});

describe('My quotes', () => {
  it('lists enquiries with their status and quoted price', async () => {
    serve({ 'GET /enquiries': { items: [QUOTED], next_cursor: null } });
    const onOpen = jest.fn();
    await wrap(<CustomerEnquiries onOpen={onOpen} />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Ayesha Mehendi Art, Mon, 25 Nov, Quote ready · ₹12,500' }));
    expect(onOpen).toHaveBeenCalledWith('e-1');
  });

  it('says so when there are none', async () => {
    serve({ 'GET /enquiries': { items: [], next_cursor: null } });
    await wrap(<CustomerEnquiries onOpen={jest.fn()} />);
    expect(await screen.findByText('No quote requests yet. Ask an artist for one from their page.')).toBeTruthy();
  });
});

describe('an enquiry', () => {
  it('shows the quote with Accept & pick a time', async () => {
    serve({ 'GET /enquiries/e-1': QUOTED });
    const onAccept = jest.fn();
    await wrap(<CustomerEnquiryDetail enquiryId="e-1" onAccept={onAccept} onOpenBooking={jest.fn()} />);

    expect(await screen.findByText('₹12,500')).toBeTruthy();
    expect(screen.getByText('4 hr')).toBeTruthy();
    expect(screen.getByText('Includes a trial session')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Accept & pick a time' }));
    expect(onAccept).toHaveBeenCalled();
  });

  it('withdraws after confirming', async () => {
    serve({
      'GET /enquiries/e-1': QUOTED,
      'POST /enquiries/e-1/cancel': { ...QUOTED, status: 'cancelled' },
    });
    await wrap(<CustomerEnquiryDetail enquiryId="e-1" onAccept={jest.fn()} onOpenBooking={jest.fn()} />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Withdraw enquiry' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Yes, withdraw' }));

    expect(await screen.findByText('Withdrawn')).toBeTruthy();
    expect(sent.map((s) => s.key)).toContain('POST /enquiries/e-1/cancel');
    expect(screen.queryByRole('button', { name: 'Accept & pick a time' })).toBeNull();
  });

  it('links to the booking once accepted', async () => {
    serve({ 'GET /enquiries/e-1': { ...QUOTED, status: 'accepted', booking_id: 'b-9' } });
    const onOpenBooking = jest.fn();
    await wrap(<CustomerEnquiryDetail enquiryId="e-1" onAccept={jest.fn()} onOpenBooking={onOpenBooking} />);
    await fireEvent.press(await screen.findByRole('button', { name: 'View booking' }));
    expect(onOpenBooking).toHaveBeenCalledWith('b-9');
  });

  it('shows a failed load with Try again', async () => {
    serve({ 'GET /enquiries/e-1': () => ({ status: 404, json: { code: 'not_found', message: 'Enquiry not found' } }) });
    await wrap(<CustomerEnquiryDetail enquiryId="e-1" onAccept={jest.fn()} onOpenBooking={jest.fn()} />);
    expect(await screen.findByText('Enquiry not found')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });
});

describe('accepting a quote', () => {
  const slots = (req: TransportRequest) => ({ status: 200, json: { date: dateOf(req.path), slots: [{ start_at: `${dateOf(req.path)}T12:00:00+05:30`, available: true }] } });

  it('posts the picked start and address, then opens the new booking', async () => {
    serve({
      'GET /enquiries/e-1': QUOTED,
      'GET /enquiries/e-1/availability': slots,
      'GET /users/me/addresses': [],
      'POST /enquiries/e-1/accept': () => ({ status: 201, json: { enquiry: { ...QUOTED, status: 'accepted', booking_id: 'b-9' }, booking_id: 'b-9' } }),
    });
    await wrap(<AcceptQuoteScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: '12:00 PM, available' }));
    await fireEvent.changeText(screen.getByLabelText('Address'), '12 Residency Rd, Bangalore');
    await fireEvent.press(screen.getByRole('button', { name: 'Confirm booking' }));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith({ pathname: '/customer/booking/[id]', params: { id: 'b-9' } }));
    expect(sent.find((s) => s.key === 'GET /enquiries/e-1/availability')?.path).toBe('/enquiries/e-1/availability?date=2030-11-25');
    expect(sent.find((s) => s.key === 'POST /enquiries/e-1/accept')?.body).toEqual({ start_at: '2030-11-25T12:00:00+05:30', address: '12 Residency Rd, Bangalore', note: null });
  });

  it('shows a taken time inline and stays', async () => {
    serve({
      'GET /enquiries/e-1': QUOTED,
      'GET /enquiries/e-1/availability': slots,
      'GET /users/me/addresses': [],
      'POST /enquiries/e-1/accept': () => ({ status: 409, json: { code: 'conflict', message: 'That time was just taken. Pick another.' } }),
    });
    await wrap(<AcceptQuoteScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: '12:00 PM, available' }));
    await fireEvent.changeText(screen.getByLabelText('Address'), '12 Residency Rd, Bangalore');
    await fireEvent.press(screen.getByRole('button', { name: 'Confirm booking' }));

    expect(await screen.findByText('That time was just taken. Pick another.')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('shows a time outside the offered hours (422) inline', async () => {
    serve({
      'GET /enquiries/e-1': QUOTED,
      'GET /enquiries/e-1/availability': slots,
      'GET /users/me/addresses': [],
      'POST /enquiries/e-1/accept': () => ({ status: 422, json: { code: 'validation_error', message: 'Pick one of the offered times.' } }),
    });
    await wrap(<AcceptQuoteScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: '12:00 PM, available' }));
    await fireEvent.changeText(screen.getByLabelText('Address'), '12 Residency Rd');
    await fireEvent.press(screen.getByRole('button', { name: 'Confirm booking' }));

    expect(await screen.findByText('Pick one of the offered times.')).toBeTruthy();
  });
});
