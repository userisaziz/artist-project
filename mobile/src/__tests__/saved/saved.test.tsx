import type { ReactElement, ReactNode } from 'react';
import { Text } from 'react-native';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../../core/theme/theme-provider';
import { transport } from '../../core/api/client';
import type { TransportRequest } from '../../core/api/transport';
import { SavedScreen } from '../../components/saved/SavedScreen';
import { SaveButton } from '../../components/common/SaveButton';
import { savedKeys, useSaveToggle } from '../../hooks/saved/saved';
import { userFixture } from '../../mocks/auth/auth';
import { postFixture } from '../../mocks/feed/feed';
import { productFixture } from '../../mocks/shop/shop';

jest.mock('../../context/auth/auth-provider', () => ({
  useAuth: () => ({ user: jest.requireActual('../../mocks/auth/auth').userFixture }),
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const send = jest.spyOn(transport, 'request');
let client: QueryClient;
const Providers = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}><ThemeProvider>{children}</ThemeProvider></QueryClientProvider>;
const wrap = (ui: ReactElement) => render(<Providers>{ui}</Providers>);
const page = (items: unknown[]) => ({ status: 200, json: { items, next_cursor: null } });
function serve(routes: Record<string, unknown>) {
  send.mockImplementation(async (req: TransportRequest) => {
    const key = `${req.method} ${req.path}`;
    if (!(key in routes)) throw new Error(`unexpected request ${key}`);
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

function Bookmark({ id }: { id: string }) {
  const save = useSaveToggle('post');
  return <SaveButton name="Bridal look" saved={save.isSaved(id)} onPress={() => save.toggle(id)} />;
}

it('the bookmark fills at once and stays filled once the server saves it', async () => {
  serve({
    'GET /saved/ids': { status: 200, json: { posts: [], artists: [], products: [] } },
    'PUT /saved/post/p-1': { status: 204, json: null },
    'GET /saved/posts': page([]),
  });
  await wrap(<Bookmark id="p-1" />);
  await waitFor(() => expect(send).toHaveBeenCalledWith(expect.objectContaining({ path: '/saved/ids' })));

  await fireEvent.press(await screen.findByRole('button', { name: 'Save Bridal look' }));

  expect(await screen.findByRole('button', { name: 'Remove Bridal look from saved' })).toBeTruthy();
  expect(send.mock.calls.map(([r]) => `${r.method} ${r.path}`)).toContain('PUT /saved/post/p-1');
});

it('the bookmark goes back when saving fails', async () => {
  serve({
    'GET /saved/ids': { status: 200, json: { posts: [], artists: [], products: [] } },
    'PUT /saved/post/p-1': { status: 404, json: { code: 'not_found', message: 'Not found' } },
    'GET /saved/posts': page([]),
  });
  const { result } = await renderHook(() => useSaveToggle('post'), { wrapper: Providers });
  await waitFor(() => expect(client.getQueryData(savedKeys.ids(userFixture.id))).toBeDefined());

  await act(async () => { result.current.toggle('p-1'); });

  await waitFor(() => expect(send.mock.calls.map(([r]) => `${r.method} ${r.path}`)).toContain('PUT /saved/post/p-1'));
  await waitFor(() => expect(client.getQueryData(savedKeys.ids(userFixture.id))).toEqual({ posts: [], artists: [], products: [] }));
  expect(result.current.isSaved('p-1')).toBe(false);
});

it('Saved lists posts, artists and products by tab, each drawn by the app layer', async () => {
  serve({
    'GET /saved/posts': page([postFixture({ id: 'p-1' })]),
    'GET /saved/artists': page([]),
    'GET /saved/products': page([productFixture({ id: 'pr-1', name: 'Henna cones' })]),
  });
  await wrap(<SavedScreen render={{
    post: (p) => <Text>{`post ${p.id}`}</Text>,
    artist: (a) => <Text>{`artist ${a.id}`}</Text>,
    product: (p) => <Text>{`product ${p.name}`}</Text>,
  }} />);

  expect(await screen.findByText('post p-1')).toBeTruthy();
  await fireEvent.press(screen.getByText('Artists'));
  expect(await screen.findByText('Save artists from their page to find them again.')).toBeTruthy();
  await fireEvent.press(screen.getByText('Products'));
  expect(await screen.findByText('product Henna cones')).toBeTruthy();
});

it('a Saved tab that cannot load offers a retry', async () => {
  serve({
    'GET /saved/posts': { status: 503, json: { code: 'service_unavailable', message: 'Try again in a minute' } },
    'GET /saved/artists': page([]),
    'GET /saved/products': page([]),
  });
  await wrap(<SavedScreen render={{ post: () => <Text>x</Text>, artist: () => <Text>x</Text>, product: () => <Text>x</Text> }} />);
  expect(await screen.findByText('Try again in a minute')).toBeTruthy();
});
