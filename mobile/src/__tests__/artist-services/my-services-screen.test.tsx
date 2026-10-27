import type { ReactElement } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../../core/theme/theme-provider';
import { transport } from '../../core/api/client';
import type { TransportRequest } from '../../core/api/transport';
import { artistProfileFixture, templateServiceFixture } from '../../mocks/artist-onboarding/artist-onboarding';
import { userFixture } from '../../mocks/auth/auth';
import MyServices from '../../../app/artist/services';

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../../context/auth/auth-provider', () => ({
  useAuth: () => ({ user: jest.requireActual('../../mocks/auth/auth').userFixture }),
}));

const send = jest.spyOn(transport, 'request');
const profileKey = ['artist', 'me', userFixture.id];
const tree = [{ id: 12, slug: 'makeup', name: 'Makeup', subcategories: [] }];
const profile = artistProfileFixture({ status: 'approved', services: [templateServiceFixture] });
const ok = (req: TransportRequest) => ({ status: 200, json: req.path === '/categories' ? tree : profile });
let client: QueryClient;
const wrap = (ui: ReactElement) => render(<QueryClientProvider client={client}><ThemeProvider>{ui}</ThemeProvider></QueryClientProvider>);

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  client.setQueryData(profileKey, profile);
  send.mockReset();
});
afterEach(() => client.clear());
afterAll(() => send.mockRestore());

it('shows the error with Try again when the categories fail to load, then the services once they do', async () => {
  let failing = true;
  send.mockImplementation(async (req: TransportRequest) => {
    if (req.path === '/categories' && failing) return { status: 500, json: { code: 'server_error', message: 'Something went wrong on our side' } };
    return ok(req);
  });
  await wrap(<MyServices />);

  expect(await screen.findByText('Something went wrong on our side')).toBeTruthy();
  expect(screen.queryByText('No services yet.')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Add a custom service' })).toBeNull();

  failing = false;
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));

  expect(await screen.findByText('Bridal makeup')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Add a custom service' })).toBeTruthy();
});

it('shows a loading state while the categories load', async () => {
  const waiting: (() => void)[] = [];
  send.mockImplementation((req: TransportRequest) => new Promise((resolve) => { waiting.push(() => resolve(ok(req))); }));
  await wrap(<MyServices />);

  expect(screen.getByLabelText('Loading your services')).toBeTruthy();
  expect(screen.queryByText('No services yet.')).toBeNull();

  waiting.forEach((answer) => answer());
  expect(await screen.findByText('Bridal makeup')).toBeTruthy();
});
