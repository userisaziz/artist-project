import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider, type InfiniteData } from '@tanstack/react-query';
import { chatKeys, isPendingMessage, useChatOpener, useConversations, useMessages, useSendMessage } from '../../hooks/chat/chat';
import { transport } from '../../core/api/client';
import { ApiError, type Page } from '../../core/api/types';
import type { TransportRequest } from '../../core/api/transport';
import type { ChatMessage } from '../../types/chat/chat';
import { conversationFixture, messageFixture } from '../../mocks/chat/chat';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('../../context/auth/auth-provider', () => ({
  useAuth: () => ({ user: jest.requireActual('../../mocks/auth/auth').userFixture }),
}));

const send = jest.spyOn(transport, 'request');
let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
const sent = (i = 0): TransportRequest => send.mock.calls[i][0];

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  send.mockReset();
});
afterEach(() => client.clear());
afterAll(() => send.mockRestore());

it('the artist inbox reads its own endpoint and passes the search', async () => {
  send.mockResolvedValue({ status: 200, json: { items: [conversationFixture()], next_cursor: null } });
  const { result } = await renderHook(() => useConversations('artist', 'rhea'), { wrapper });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  expect(sent()).toMatchObject({ method: 'GET', path: '/artists/me/conversations?q=rhea' });
  expect(result.current.data?.pages[0].items[0].counterpart.name).toBe('Ananya Rao');
});

it('sending posts the text and puts the message at the top of the cached thread', async () => {
  const older = messageFixture({ id: 'm1', text: 'Hi!' });
  const userId = jest.requireActual('../../mocks/auth/auth').userFixture.id;
  client.setQueryData(chatKeys.messages(userId, 'customer', 'c1'), { pages: [{ items: [older], next_cursor: null }], pageParams: [null] });
  const mine = messageFixture({ id: 'm2', text: 'Can you hide our initials?' });
  send.mockResolvedValue({ status: 201, json: mine });
  const { result } = await renderHook(() => useSendMessage('customer', 'c1'), { wrapper });

  await act(async () => { await result.current.mutateAsync('Can you hide our initials?'); });

  expect(sent()).toMatchObject({ method: 'POST', path: '/conversations/c1/messages', body: { text: 'Can you hide our initials?' } });
  const cached = client.getQueryData<InfiniteData<Page<ChatMessage>>>(chatKeys.messages(userId, 'customer', 'c1'));
  expect(cached?.pages[0].items.map((m) => m.id)).toEqual(['m2', 'm1']);
});

it('shows the message in the thread at once, before the server answers', async () => {
  const userId = jest.requireActual('../../mocks/auth/auth').userFixture.id;
  const key = chatKeys.messages(userId, 'customer', 'c1');
  client.setQueryData(key, { pages: [{ items: [messageFixture({ id: 'm1' })], next_cursor: null }], pageParams: [null] });
  send.mockReturnValue(new Promise(() => {}));
  const { result } = await renderHook(() => useSendMessage('customer', 'c1'), { wrapper });

  await act(async () => { result.current.mutate('On my way'); });

  const items = client.getQueryData<InfiniteData<Page<ChatMessage>>>(key)?.pages[0].items;
  expect(items?.map((m) => [m.text, isPendingMessage(m)])).toEqual([['On my way', true], [messageFixture().text, false]]);
});

it('takes the pending message back out when sending fails', async () => {
  const userId = jest.requireActual('../../mocks/auth/auth').userFixture.id;
  const key = chatKeys.messages(userId, 'customer', 'c1');
  client.setQueryData(key, { pages: [{ items: [messageFixture({ id: 'm1' })], next_cursor: null }], pageParams: [null] });
  send.mockRejectedValue(new ApiError('network_error', 'Network unreachable.', 0));
  const { result } = await renderHook(() => useSendMessage('customer', 'c1'), { wrapper });

  await act(async () => { await result.current.mutateAsync('On my way').catch(() => {}); });

  expect(client.getQueryData<InfiniteData<Page<ChatMessage>>>(key)?.pages[0].items.map((m) => m.id)).toEqual(['m1']);
});

it('opens a chat that is already in the inbox at once, without asking the server', async () => {
  const userId = jest.requireActual('../../mocks/auth/auth').userFixture.id;
  client.setQueryData(chatKeys.inbox(userId, 'artist', ''), { pages: [{ items: [conversationFixture()], next_cursor: null }], pageParams: [null] });
  mockPush.mockReset();
  const { result } = await renderHook(() => useChatOpener('artist'), { wrapper });

  await act(async () => { await result.current.open('b1'); });

  expect(send).not.toHaveBeenCalled();
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/artist/chat/[id]', params: { id: 'c1' } });
});

it('a failed thread load surfaces the ApiError', async () => {
  send.mockResolvedValue({ status: 404, json: { code: 'not_found', message: 'Conversation not found' } });
  const { result } = await renderHook(() => useMessages('artist', 'c9'), { wrapper });

  await waitFor(() => expect(result.current.isError).toBe(true));

  expect(result.current.error).toBeInstanceOf(ApiError);
  expect(result.current.error).toMatchObject({ code: 'not_found' });
});
