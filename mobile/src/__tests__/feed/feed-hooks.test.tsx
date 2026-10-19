import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider, type InfiniteData } from '@tanstack/react-query';
import { feedKeys, useToggleFollow, useToggleLike } from '../../hooks/feed/feed';
import { transport } from '../../core/api/client';
import type { Page } from '../../core/api/types';
import type { Post } from '../../types/feed/feed';
import { postFixture } from '../../mocks/feed/feed';

jest.mock('../../context/auth/auth-provider', () => ({
  useAuth: () => ({ user: jest.requireActual('../../mocks/auth/auth').userFixture }),
}));

const userId = jest.requireActual('../../mocks/auth/auth').userFixture.id;
const send = jest.spyOn(transport, 'request');
let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
const cached = () => client.getQueryData<InfiniteData<Page<Post>>>(feedKeys.list(userId, 'for_you'))?.pages[0].items;

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  client.setQueryData(feedKeys.list(userId, 'for_you'), {
    pages: [{ items: [postFixture({ id: 'p1' }), postFixture({ id: 'p2', artist: { ...postFixture().artist, id: 'a2' } })], next_cursor: null }],
    pageParams: [null],
  });
  send.mockReset();
});
afterEach(() => client.clear());
afterAll(() => send.mockRestore());

it('liking PUTs the like and updates the post wherever it is cached', async () => {
  send.mockResolvedValue({ status: 200, json: { liked: true, like_count: 13 } });
  const { result } = await renderHook(() => useToggleLike(), { wrapper });

  await act(async () => { await result.current.mutateAsync(postFixture({ id: 'p1' })); });

  expect(send.mock.calls[0][0]).toMatchObject({ method: 'PUT', path: '/feed/posts/p1/like' });
  expect(cached()?.[0]).toMatchObject({ liked: true, like_count: 13 });
  expect(cached()?.[1]).toMatchObject({ liked: false });
});

it('unfollowing DELETEs and clears the flag on every post by that artist', async () => {
  client.setQueryData(feedKeys.list(userId, 'for_you'), (d: InfiniteData<Page<Post>> | undefined) =>
    d && { ...d, pages: d.pages.map((p) => ({ ...p, items: p.items.map((i) => ({ ...i, following: true })) })) });
  send.mockResolvedValue({ status: 200, json: { following: false } });
  const { result } = await renderHook(() => useToggleFollow(), { wrapper });

  await act(async () => { await result.current.mutateAsync({ artistId: 'a2', following: false }); });

  expect(send.mock.calls[0][0]).toMatchObject({ method: 'DELETE', path: '/feed/artists/a2/follow' });
  expect(cached()?.map((p) => p.following)).toEqual([true, false]);
});
