import type { ReactElement } from 'react';
import { render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../../core/theme/theme-provider';
import { transport } from '../../core/api/client';
import { FollowersList } from '../../components/feed/FollowersList';

jest.mock('../../context/auth/auth-provider', () => ({
  useAuth: () => ({ user: jest.requireActual('../../mocks/auth/auth').userFixture }),
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const send = jest.spyOn(transport, 'request');
let client: QueryClient;
const wrap = (ui: ReactElement) => render(<QueryClientProvider client={client}><ThemeProvider>{ui}</ThemeProvider></QueryClientProvider>);

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  send.mockReset();
});
afterEach(() => client.clear());
afterAll(() => send.mockRestore());

it('lists followers newest first with the total', async () => {
  // Mirrors backend FollowerPage (shortened names, no ids).
  send.mockResolvedValue({ status: 200, json: { total: 2, next_cursor: null, items: [
    { name: 'Meera N.', photo_url: null, followed_at: '2026-10-21T09:00:00Z' },
    { name: 'Asha R.', photo_url: null, followed_at: '2026-10-20T09:00:00Z' },
  ] } });
  await wrap(<FollowersList />);

  expect(await screen.findByText('2 followers')).toBeTruthy();
  expect(screen.getByText('Meera N.')).toBeTruthy();
  expect(screen.getByText('Asha R.')).toBeTruthy();
  expect(send.mock.calls[0][0]).toMatchObject({ method: 'GET', path: '/artists/me/followers' });
});

it('says so when nobody follows yet, and retries when loading fails', async () => {
  send.mockResolvedValueOnce({ status: 200, json: { total: 0, next_cursor: null, items: [] } });
  const first = await wrap(<FollowersList />);
  expect(await screen.findByText('No followers yet. Posts and guides bring them in.')).toBeTruthy();
  first.unmount();
  client.clear();

  send.mockResolvedValue({ status: 503, json: { code: 'service_unavailable', message: 'Try again in a minute' } });
  await wrap(<FollowersList />);
  expect(await screen.findByText('Try again in a minute')).toBeTruthy();
});
