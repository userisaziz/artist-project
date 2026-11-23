import type { ReactElement } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../../core/theme/theme-provider';
import { transport } from '../../core/api/client';
import type { TransportRequest } from '../../core/api/transport';
import { artistProfileFixture, portfolioPhotoFixture } from '../../mocks/artist-onboarding/artist-onboarding';
import PortfolioStep from '../../../app/artist/onboarding/portfolio';

const mockPickImages = jest.fn();
const mockUploadImage = jest.fn();
// The picker and the signed storage upload are device / bucket work; the profile writes go through the API.
jest.mock('../../api/artist-onboarding/upload', () => ({
  pickImages: (...args: unknown[]) => mockPickImages(...args),
  uploadImage: (...args: unknown[]) => mockUploadImage(...args),
}));
jest.mock('../../context/auth/auth-provider', () => ({
  useAuth: () => ({ user: jest.requireActual('../../mocks/auth/auth').userFixture }),
}));
jest.mock('expo-image', () => ({ Image: require('react-native').View }));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, dismissTo: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const send = jest.spyOn(transport, 'request');
const photos = Array.from({ length: 6 }, (_, i) => portfolioPhotoFixture(i + 1));
const draft = (overrides = {}) => artistProfileFixture({ status: 'draft', photos, ...overrides });

function serve(routes: Record<string, unknown>) {
  send.mockImplementation(async (req: TransportRequest) => {
    const key = `${req.method} ${req.path}`;
    if (!(key in routes)) throw new Error(`unexpected request ${key}`);
    const route = routes[key];
    return (typeof route === 'function' ? (route as (r: TransportRequest) => unknown)(req) : route) as { status: number; json: unknown };
  });
}

let client: QueryClient;
const wrap = (ui: ReactElement) => render(<QueryClientProvider client={client}><ThemeProvider>{ui}</ThemeProvider></QueryClientProvider>);
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  send.mockReset();
  jest.clearAllMocks();
});
afterEach(() => client.clear());
afterAll(() => send.mockRestore());

it('makes a tapped photo the cover and lets the artist continue', async () => {
  let order: unknown;
  serve({
    'GET /artists/me': { status: 200, json: draft() },
    'PUT /artists/me/photos/order': (req: TransportRequest) => {
      order = req.body;
      return { status: 200, json: draft({ photos: [photos[2], ...photos.filter((_, i) => i !== 2)] }) };
    },
  });
  await wrap(<PortfolioStep />);

  await fireEvent.press(await screen.findByLabelText('Portfolio photo 3'));
  await fireEvent.press(screen.getByRole('button', { name: 'Make cover' }));

  await waitFor(() => expect(order).toEqual({ photo_ids: ['photo-3', 'photo-1', 'photo-2', 'photo-4', 'photo-5', 'photo-6'] }));
  expect(await screen.findByLabelText('Portfolio photo 1, cover')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  expect(mockPush).toHaveBeenCalledWith('/artist/onboarding/identity');
});

it('asks before removing a photo, and Keep backs out', async () => {
  const deleted: string[] = [];
  serve({
    'GET /artists/me': { status: 200, json: draft() },
    'DELETE /artists/me/photos/photo-2': () => {
      deleted.push('photo-2');
      return { status: 200, json: draft({ photos: photos.filter((p) => p.id !== 'photo-2') }) };
    },
  });
  await wrap(<PortfolioStep />);

  await fireEvent.press(await screen.findByLabelText('Portfolio photo 2'));
  await fireEvent.press(screen.getByRole('button', { name: 'Remove photo' }));
  expect(screen.getByText('Remove this photo?')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Keep' }));
  expect(deleted).toHaveLength(0);

  await fireEvent.press(screen.getByRole('button', { name: 'Remove photo' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Remove photo' })); // the confirm button
  await waitFor(() => expect(deleted).toEqual(['photo-2']));
  // Five left: below the minimum again, so Continue says how many are missing.
  expect(await screen.findByRole('button', { name: 'Continue · 5 of 6 photos' })).toBeTruthy();
});

it('keeps a failed upload on the grid with Retry, and retrying adds it', async () => {
  const added: unknown[] = [];
  serve({
    'GET /artists/me': { status: 200, json: draft({ photos: photos.slice(0, 2) }) },
    'POST /artists/me/photos': (req: TransportRequest) => {
      added.push(req.body);
      return { status: 201, json: draft({ photos: photos.slice(0, 3) }) };
    },
  });
  mockPickImages.mockResolvedValue([{ uri: 'file:///picked.jpg', width: 1000, height: 1000 }]);
  mockUploadImage
    .mockRejectedValueOnce(new Error('network down'))
    .mockResolvedValueOnce({ key: 'artists/9a8b/portfolio/new.jpg', width: 1000, height: 1000 });
  await wrap(<PortfolioStep />);

  await fireEvent.press(await screen.findByRole('button', { name: 'Add photos' }));
  const retry = await screen.findByRole('button', { name: /^Retry upload/ });
  expect(added).toHaveLength(0);

  await fireEvent.press(retry);
  await waitFor(() => expect(added).toEqual([{ key: 'artists/9a8b/portfolio/new.jpg', width: 1000, height: 1000 }]));
  await waitFor(() => expect(screen.queryByRole('button', { name: /^Retry upload/ })).toBeNull());
  expect(screen.getByLabelText('Portfolio photo 3')).toBeTruthy();
});

it('shows the error with Try again when the profile fails to load', async () => {
  serve({ 'GET /artists/me': { status: 500, json: { detail: 'Server is down' } } });
  await wrap(<PortfolioStep />);
  expect(await screen.findByRole('button', { name: 'Try again' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Add photos' })).toBeNull();
});
