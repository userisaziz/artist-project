import type { ReactElement } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../../core/theme/theme-provider';
import { transport } from '../../core/api/client';
import type { TransportRequest } from '../../core/api/transport';
import { NotificationBell } from '../../components/notifications/NotificationBell';
import { NotificationInbox } from '../../components/notifications/NotificationInbox';
import { notificationFixture } from '../../mocks/notifications/notifications';

jest.mock('../../context/auth/auth-provider', () => ({
  useAuth: () => ({ user: jest.requireActual('../../mocks/auth/auth').userFixture }),
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }), useIsFocused: () => true }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

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
    return answer && typeof answer === 'object' && 'status' in answer ? (answer as { status: number; json: unknown }) : { status: 200, json: answer };
  });
}

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  send.mockReset();
});
afterEach(() => client.clear());
afterAll(() => send.mockRestore());

it('opens a notification: marks it read and goes where it points', async () => {
  const items = [
    notificationFixture(),
    notificationFixture({ id: 'n-2', title: 'Support replied', body: 'Try again now.', link: '/customer/support/t-1', read_at: '2026-10-08T09:00:00Z' }),
  ];
  const marked: unknown[] = [];
  serve({
    'GET /notifications': { items, next_cursor: null },
    'POST /notifications/read': (req: TransportRequest) => { marked.push(req.body); return { status: 204, json: null }; },
  });
  const navigate = jest.fn();
  await wrap(<NotificationInbox onNavigate={navigate} />);

  await fireEvent.press(await screen.findByLabelText('Unread. Booking confirmed. Bridal Classic on Fri 9 Oct, 11:00 AM'));

  expect(navigate).toHaveBeenCalledWith('/customer/booking/b-1');
  await waitFor(() => expect(marked).toEqual([{ ids: ['n-1'] }]));
  expect(screen.getByText('Support replied')).toBeTruthy();
});

it('marks everything read at once', async () => {
  const marked: unknown[] = [];
  serve({
    'GET /notifications': { items: [notificationFixture()], next_cursor: null },
    'POST /notifications/read': (req: TransportRequest) => { marked.push(req.body); return { status: 204, json: null }; },
  });
  await wrap(<NotificationInbox onNavigate={jest.fn()} />);

  await fireEvent.press(await screen.findByText('Mark all read'));

  await waitFor(() => expect(marked).toEqual([{ ids: null }]));
});

it('shows the empty state, and a retry when loading fails', async () => {
  let fail = true;
  serve({
    'GET /notifications': () => (fail ? { status: 500, json: { detail: 'Something went wrong' } } : { items: [], next_cursor: null }),
  });
  await wrap(<NotificationInbox onNavigate={jest.fn()} />);

  const retry = await screen.findByText('Try again');
  fail = false;
  await fireEvent.press(retry);

  expect(await screen.findByText('Nothing yet. Booking updates, orders and messages show up here.')).toBeTruthy();
});

it('the bell shows how many are unread', async () => {
  serve({ 'GET /notifications/unread-count': { count: 12 } });
  const onPress = jest.fn();
  await wrap(<NotificationBell onPress={onPress} />);

  await fireEvent.press(await screen.findByLabelText('Notifications, 12 unread'));

  expect(screen.getByText('9+')).toBeTruthy();
  expect(onPress).toHaveBeenCalled();
});
