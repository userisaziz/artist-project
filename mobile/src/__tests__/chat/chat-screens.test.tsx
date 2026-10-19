import type { ReactElement } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../../core/theme/theme-provider';
import { transport } from '../../core/api/client';
import type { TransportRequest } from '../../core/api/transport';
import { ChatThread } from '../../components/chat/ChatThread';
import { ChatInbox } from '../../components/chat/ChatInbox';
import { conversationFixture, messageFixture } from '../../mocks/chat/chat';

jest.mock('../../context/auth/auth-provider', () => ({
  useAuth: () => ({ user: jest.requireActual('../../mocks/auth/auth').userFixture }),
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }), useIsFocused: () => true }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const send = jest.spyOn(transport, 'request');
let client: QueryClient;
const wrap = (ui: ReactElement) =>
  render(<QueryClientProvider client={client}><ThemeProvider>{ui}</ThemeProvider></QueryClientProvider>);

/** Answers by method + path, like the backend would. */
function serve(routes: Record<string, unknown>) {
  send.mockImplementation(async (req: TransportRequest) => {
    const key = `${req.method} ${req.path}`;
    if (!(key in routes)) throw new Error(`unexpected request ${key}`);
    const route = routes[key];
    const answer = typeof route === 'function' ? (route as () => unknown)() : route;
    return typeof answer === 'object' && answer !== null && 'status' in answer ? (answer as { status: number; json: unknown }) : { status: 200, json: answer };
  });
}

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  send.mockReset();
});
afterEach(() => client.clear());
afterAll(() => send.mockRestore());

it('a customer reads the thread, it is marked read, and a sent message appears', async () => {
  const theirs = messageFixture({ id: 'm1', sender: 'artist', text: 'Of course 💗 Here’s a quote.' });
  const mine = messageFixture({ id: 'm2', sender: 'customer', text: 'Can we do Saturday?', created_at: '2026-10-09T09:00:00Z' });
  const conversation = conversationFixture({ counterpart: { id: 'a1', name: 'Ayesha Mehendi Art', photo_url: null } });
  const stored = [theirs]; // the server's thread, newest first
  serve({
    'GET /conversations/c1': conversation,
    'GET /conversations/c1/messages': () => ({ items: [...stored], next_cursor: null }),
    'POST /conversations/c1/read': { ...conversation, unread_count: 0 },
    'POST /conversations/c1/messages': () => { stored.unshift(mine); return { status: 201, json: mine }; },
    'GET /conversations': { items: [], next_cursor: null },
  });
  await wrap(<ChatThread side="customer" conversationId="c1" />);

  expect(await screen.findByText('Of course 💗 Here’s a quote.')).toBeTruthy();
  expect(await screen.findByText('Ayesha Mehendi Art')).toBeTruthy();
  await waitFor(() => expect(send.mock.calls.some(([r]) => r.path === '/conversations/c1/read')).toBe(true));

  await fireEvent.changeText(screen.getByLabelText('Message'), '  Can we do Saturday?  ');
  await fireEvent.press(screen.getByRole('button', { name: 'Send' }));

  expect(await screen.findByText('Can we do Saturday?')).toBeTruthy();
  const posted = send.mock.calls.find(([r]) => r.method === 'POST' && r.path === '/conversations/c1/messages');
  expect(posted?.[0].body).toEqual({ text: 'Can we do Saturday?' });
});

it('a failed send keeps the draft and says why', async () => {
  serve({
    'GET /conversations/c1': conversationFixture(),
    'GET /conversations/c1/messages': { items: [], next_cursor: null },
    'POST /conversations/c1/messages': { status: 429, json: { code: 'rate_limited', message: 'Too many requests' } },
  });
  await wrap(<ChatThread side="customer" conversationId="c1" />);
  expect(await screen.findByText(/Say hello/)).toBeTruthy();

  await fireEvent.changeText(screen.getByLabelText('Message'), 'Hello?');
  await fireEvent.press(screen.getByRole('button', { name: 'Send' }));

  await waitFor(() => expect(screen.getByLabelText('Message').props.value).toBe('Hello?'));
  expect(await screen.findByText(/too many|try again/i)).toBeTruthy();
});

it('a message with contact details shows as under review, and a hidden one as not delivered', async () => {
  serve({
    'GET /conversations/c1': conversationFixture(),
    'GET /conversations/c1/messages': {
      items: [
        messageFixture({ id: 'm2', text: 'mail me at a@b.com', moderation: 'hidden', created_at: '2026-10-09T08:59:00Z' }),
        messageFixture({ id: 'm1', text: 'Call me on 98450 67890', moderation: 'held' }),
      ],
      next_cursor: null,
    },
  });
  await wrap(<ChatThread side="customer" conversationId="c1" />);

  expect(await screen.findByText('Call me on 98450 67890')).toBeTruthy();
  expect(screen.getByText(/Under review · contact details are checked before delivery/)).toBeTruthy();
  expect(screen.getByText(/Not delivered · contact details aren’t allowed before booking/)).toBeTruthy();
});

it('the artist inbox shows each client with unread count and booking tag, and opens one', async () => {
  serve({ 'GET /artists/me/conversations': { items: [conversationFixture()], next_cursor: null } });
  const onOpen = jest.fn();
  await wrap(<ChatInbox side="artist" searchable onOpen={onOpen} />);

  const row = await screen.findByRole('button', { name: 'Ananya Rao, 1 unread' });
  expect(screen.getByText('Request · Fri, 9 Oct')).toBeTruthy();
  await fireEvent.press(row);

  expect(onOpen).toHaveBeenCalledWith('c1');
});

it('the inbox shows an error with a retry when it can’t load', async () => {
  serve({ 'GET /artists/me/conversations': { status: 409, json: { code: 'conflict', message: 'Bookings open once your profile is approved' } } });
  await wrap(<ChatInbox side="artist" searchable onOpen={jest.fn()} />);

  expect(await screen.findByText('Bookings open once your profile is approved')).toBeTruthy();
  expect(screen.getByRole('button', { name: /try again|retry/i })).toBeTruthy();
});
