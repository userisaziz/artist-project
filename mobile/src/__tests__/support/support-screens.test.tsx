import type { ReactElement } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../../core/theme/theme-provider';
import { transport } from '../../core/api/client';
import type { TransportRequest } from '../../core/api/transport';
import { HelpSupport } from '../../components/support/HelpSupport';
import { SupportThread } from '../../components/support/SupportThread';
import { ticketFixture } from '../../mocks/support/support';

jest.mock('../../context/auth/auth-provider', () => ({
  useAuth: () => ({ user: jest.requireActual('../../mocks/auth/auth').userFixture }),
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }), useIsFocused: () => true }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

// These flows press through several steps; on a loaded machine that outlasts jest's 5s default.
jest.setTimeout(20_000);

const send = jest.spyOn(transport, 'request');
let client: QueryClient;
const wrap = (ui: ReactElement) => render(<QueryClientProvider client={client}><ThemeProvider>{ui}</ThemeProvider></QueryClientProvider>);

function serve(routes: Record<string, unknown>) {
  send.mockImplementation(async (req: TransportRequest) => {
    const key = `${req.method} ${req.path}`;
    if (!(key in routes)) throw new Error(`unexpected request ${key}`);
    const route = routes[key];
    const answer = typeof route === 'function' ? (route as (r: TransportRequest) => unknown)(req) : route;
    return typeof answer === 'object' && answer !== null && 'status' in answer ? (answer as { status: number; json: unknown }) : { status: 200, json: answer };
  });
}

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  send.mockReset();
});
afterEach(() => client.clear());
afterAll(() => send.mockRestore());

it('reports a no-show about a booking and lists the new ticket', async () => {
  const tickets = [ticketFixture({ id: 'old', code: 'T-1000', subject: 'Can’t log in', topic: 'account', booking: null, status: 'resolved' })];
  serve({
    'GET /support/tickets': () => ({ items: [...tickets], next_cursor: null }),
    'POST /support/tickets': (req: TransportRequest) => {
      const created = ticketFixture({ id: 'new', code: 'T-7720' });
      tickets.unshift(created);
      expect(req.body).toEqual({ topic: 'booking', issue: 'artist_no_show', booking_id: 'b-1', details: 'Waited an hour' });
      return { status: 201, json: created };
    },
  });
  await wrap(<HelpSupport bookings={[{ id: 'b-1', label: 'Bridal Classic · Fri, 9 Oct' }]} onOpenTicket={jest.fn()} />);

  expect(await screen.findByText('#T-1000 · Can’t log in')).toBeTruthy();
  await fireEvent.press(screen.getByText('Bridal Classic · Fri, 9 Oct'));
  await fireEvent.press(screen.getByText('Artist didn’t show up'));
  await fireEvent.changeText(screen.getByLabelText('Tell us more (optional)'), 'Waited an hour');
  await fireEvent.press(screen.getByText('Send to support'));

  expect(await screen.findByText('Sent. We usually reply within 2 hours.')).toBeTruthy();
  expect(await screen.findByText('#T-7720 · Artist didn’t show up')).toBeTruthy();
});

it('answers the common questions without mentioning refunds', async () => {
  serve({ 'GET /support/tickets': { items: [], next_cursor: null } });
  await wrap(<HelpSupport bookings={[]} onOpenTicket={jest.fn()} />);

  await fireEvent.press(await screen.findByText('How do I pay?'));

  expect(screen.getByText('You pay the artist directly after the service. Nothing is paid in the app.')).toBeTruthy();
  expect(screen.queryByText(/refund/i)).toBeNull();
});

it('a failed report says why and keeps the choices', async () => {
  serve({
    'GET /support/tickets': { items: [], next_cursor: null },
    'POST /support/tickets': { status: 429, json: { code: 'rate_limited', message: 'Too many requests' } },
  });
  await wrap(<HelpSupport bookings={[]} onOpenTicket={jest.fn()} />);

  await fireEvent.press(await screen.findByText('My account'));
  await fireEvent.press(screen.getByText('Can’t log in'));
  await fireEvent.press(screen.getByText('Send to support'));

  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  expect(screen.queryByText('Sent. We usually reply within 2 hours.')).toBeNull();
});

it('the thread shows support’s reply and sends the customer’s answer', async () => {
  let current = ticketFixture({
    status: 'waiting_on_user',
    messages: [
      ...ticketFixture().messages,
      { id: 'm-2', author: 'support', author_name: 'Atelier support', text: 'So sorry. We have spoken to the artist.', created_at: '2026-10-09T09:10:00Z' },
    ],
  });
  serve({
    'GET /support/tickets/t-1': () => ({ status: 200, json: current }), // a ticket has its own `status` field
    'POST /support/tickets/t-1/messages': (req: TransportRequest) => {
      current = { ...current, status: 'open', messages: [...current.messages, { id: 'm-3', author: 'requester', author_name: 'Ananya Rao', text: (req.body as { text: string }).text, created_at: '2026-10-09T09:20:00Z' }] };
      return { status: 200, json: current };
    },
    'GET /support/tickets': { items: [], next_cursor: null },
  });
  await wrap(<SupportThread ticketId="t-1" />);

  expect(await screen.findByText('So sorry. We have spoken to the artist.')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Write to support'), 'Thank you');
  await fireEvent.press(screen.getByText('Send'));

  expect(await screen.findByText('Thank you')).toBeTruthy();
});
