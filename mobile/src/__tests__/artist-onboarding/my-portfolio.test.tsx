import type { ReactElement } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../../core/theme/theme-provider';
import { transport } from '../../core/api/client';
import type { TransportRequest } from '../../core/api/transport';
import { artistProfileFixture, portfolioPhotoFixture } from '../../mocks/artist-onboarding/artist-onboarding';
import MyPortfolio from '../../../app/artist/portfolio';

const mockPickImages = jest.fn();
const mockUploadImage = jest.fn();
jest.mock('../../api/artist-onboarding/upload', () => ({
  pickImages: (...args: unknown[]) => mockPickImages(...args),
  uploadImage: (...args: unknown[]) => mockUploadImage(...args),
}));
jest.mock('../../context/auth/auth-provider', () => ({
  useAuth: () => ({ user: jest.requireActual('../../mocks/auth/auth').userFixture }),
}));
jest.mock('expo-image', () => ({ Image: jest.requireActual('react-native').View }));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const send = jest.spyOn(transport, 'request');
const approved = (photos = [portfolioPhotoFixture(1)]) => artistProfileFixture({ status: 'approved', photos });
let client: QueryClient;
const wrap = (ui: ReactElement) => render(<QueryClientProvider client={client}><ThemeProvider>{ui}</ThemeProvider></QueryClientProvider>);
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  send.mockReset();
  jest.clearAllMocks();
});
afterEach(() => client.clear());
afterAll(() => send.mockRestore());

it('an approved artist adds a photo to their portfolio from Me', async () => {
  const image = { uri: 'file://new.jpg', width: 1200, height: 1500 };
  mockPickImages.mockResolvedValue([image]);
  mockUploadImage.mockResolvedValue({ key: 'portfolio/new', width: 1200, height: 1500 });
  send.mockImplementation(async (req: TransportRequest) => {
    if (req.method === 'POST' && req.path === '/artists/me/photos') return { status: 201, json: approved([portfolioPhotoFixture(1), portfolioPhotoFixture(2)]) };
    return { status: 200, json: approved() };
  });
  await wrap(<MyPortfolio />);

  expect(await screen.findByLabelText('Portfolio photo 1, cover')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Add photos' }));

  await waitFor(() => expect(send.mock.calls.some(([r]) => r.method === 'POST' && r.path === '/artists/me/photos')).toBe(true));
  expect(await screen.findByLabelText('Portfolio photo 2')).toBeTruthy();
});

it('shows the error with Try again when the profile fails to load', async () => {
  send.mockResolvedValue({ status: 500, json: { code: 'server_error', message: 'Something went wrong on our side' } });
  await wrap(<MyPortfolio />);

  expect(await screen.findByText('Something went wrong on our side')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
});
