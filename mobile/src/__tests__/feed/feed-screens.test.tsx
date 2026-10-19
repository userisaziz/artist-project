import type { ReactElement } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../../core/theme/theme-provider';
import { transport } from '../../core/api/client';
import type { TransportRequest } from '../../core/api/transport';
import { FeedList } from '../../components/feed/FeedList';
import { ArticleView } from '../../components/feed/ArticleView';
import { NewPostForm } from '../../components/feed/NewPostForm';
import { articleFixture, postFixture } from '../../mocks/feed/feed';

jest.mock('../../context/auth/auth-provider', () => ({
  useAuth: () => ({ user: jest.requireActual('../../mocks/auth/auth').userFixture }),
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }), useIsFocused: () => true }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../../api/artist-onboarding/upload', () => ({
  pickImages: jest.fn(async () => [{ uri: 'file://cover.jpg', width: 1600, height: 900 }]),
  uploadImage: jest.fn(async () => ({ key: 'artists/u1/post/abc', width: 1600, height: 900 })),
}));

const send = jest.spyOn(transport, 'request');
let client: QueryClient;
const nav = { openArtist: jest.fn(), openPost: jest.fn(), book: jest.fn() };
const wrap = (ui: ReactElement) => render(<QueryClientProvider client={client}><ThemeProvider>{ui}</ThemeProvider></QueryClientProvider>);

/** Answers by method + path (query included), like the backend would. */
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
  jest.clearAllMocks();
});
afterEach(() => client.clear());
afterAll(() => send.mockRestore());

it('the feed shows photo posts and articles, books a look, likes, and switches to Stories & guides', async () => {
  serve({
    'GET /feed?tab=for_you': { items: [postFixture(), articleFixture()], next_cursor: null },
    'GET /feed?tab=stories': { items: [articleFixture()], next_cursor: null },
    'PUT /feed/posts/p1/like': { liked: true, like_count: 13 },
  });
  await wrap(<FeedList nav={nav} />);

  expect(await screen.findByText(/Priya’s bridal set/)).toBeTruthy();
  expect(screen.getByText('How to get the darkest bridal mehendi stain')).toBeTruthy();
  expect(screen.getByText('Guide · 6 min read')).toBeTruthy();

  await fireEvent.press(screen.getByRole('button', { name: /Book this look: Bridal Classic/ }));
  expect(nav.book).toHaveBeenCalledWith('a1', 's1');

  await fireEvent.press(screen.getByRole('button', { name: 'Like, 12 likes' }));
  expect(await screen.findByRole('button', { name: 'Unlike, 13 likes' })).toBeTruthy();

  await fireEvent.press(screen.getByText('Stories & guides'));
  const articleCard = await screen.findByRole('button', { name: /How to get the darkest/ }); // the stories page has arrived
  expect(screen.queryByText(/Priya’s bridal set/)).toBeNull();
  await fireEvent.press(articleCard);
  expect(nav.openPost).toHaveBeenCalledWith('a-post');
});

it('the feed shows an error with a retry when it can’t load', async () => {
  serve({ 'GET /feed?tab=for_you': { status: 503, json: { code: 'service_unavailable', message: 'Service temporarily unavailable. Please try again.' } } });
  await wrap(<FeedList nav={nav} />);

  expect(await screen.findByText('Service temporarily unavailable. Please try again.')).toBeTruthy();
  expect(screen.getByRole('button', { name: /try again|retry/i })).toBeTruthy();
});

it('an article renders its headings and quotes, and Book opens the linked service', async () => {
  serve({ 'GET /feed/posts/a-post': articleFixture() });
  await wrap(<ArticleView postId="a-post" nav={nav} />);

  expect(await screen.findByRole('header', { name: '1. Book it 48 hours early' })).toBeTruthy();
  expect(screen.getByText('“Keep the paste on for at least six hours.”')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Book Ayesha' }));

  expect(nav.book).toHaveBeenCalledWith('a1', 's1');
});

it('an artist publishes an article with a cover and a linked service', async () => {
  const posted: unknown[] = [];
  serve({ 'POST /artists/me/posts': (req: TransportRequest) => { posted.push(req.body); return { status: 201, json: articleFixture() }; } });
  const onPosted = jest.fn();
  await wrap(<NewPostForm services={[{ id: 's1', name: 'Bridal Classic' }]} onCancel={jest.fn()} onPosted={onPosted} />);

  await fireEvent.press(screen.getByText('Article'));
  expect(screen.getByRole('button', { name: 'Post' }).props.accessibilityState).toMatchObject({ disabled: true });
  await fireEvent.press(screen.getByRole('button', { name: 'Add a cover photo' }));
  await fireEvent.changeText(screen.getByLabelText('Title'), 'Darkest stain');
  await fireEvent.changeText(screen.getByLabelText('Article'), 'Book it early.');
  await fireEvent.press(screen.getByText('Quote'));
  await fireEvent.press(screen.getByText('Bridal Classic'));
  await fireEvent.press(screen.getByRole('button', { name: 'Post' }));

  await waitFor(() => expect(onPosted).toHaveBeenCalled());
  expect(posted[0]).toEqual({
    kind: 'article',
    topic: 'guide',
    title: 'Darkest stain',
    text: 'Book it early.', // the unused quote shortcut is dropped
    photos: [],
    cover: { key: 'artists/u1/post/abc', width: 1600, height: 900 },
    service_id: 's1',
  });
});

it('a failed publish says why and stays on the form', async () => {
  serve({ 'POST /artists/me/posts': { status: 422, json: { code: 'validation_error', message: 'Posts can’t include phone numbers' } } });
  const onPosted = jest.fn();
  await wrap(<NewPostForm services={[]} onCancel={jest.fn()} onPosted={onPosted} />);

  await fireEvent.press(screen.getByRole('button', { name: 'Add photos' }));
  await fireEvent.changeText(screen.getByLabelText('Caption'), 'Call 98450 67890');
  await fireEvent.press(screen.getByRole('button', { name: 'Post' }));

  expect(await screen.findByText('Posts can’t include phone numbers')).toBeTruthy();
  expect(onPosted).not.toHaveBeenCalled();
});

it('reporting a post asks why and sends it to the moderators', async () => {
  const { Alert } = jest.requireActual('react-native');
  const alert = jest.spyOn(Alert, 'alert').mockImplementation((...args: unknown[]) => {
    const buttons = args[2] as { text: string; onPress?: () => void }[] | undefined;
    buttons?.find((b) => b.text === 'Spam')?.onPress?.();
  });
  serve({
    'GET /feed?tab=for_you': { items: [postFixture()], next_cursor: null },
    'POST /feed/posts/p1/report': { status: 204, json: null },
  });
  await wrap(<FeedList nav={nav} />);

  await fireEvent.press(await screen.findByRole('button', { name: 'Report this post' }));

  await waitFor(() => expect(send.mock.calls.some(([r]) => r.method === 'POST' && r.path === '/feed/posts/p1/report')).toBe(true));
  const posted = send.mock.calls.find(([r]) => r.path === '/feed/posts/p1/report');
  expect(posted?.[0].body).toEqual({ reason: 'spam' });
  alert.mockRestore();
});
