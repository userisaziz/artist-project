import type { ReactElement } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
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
  expect(screen.queryByText(/No services yet/)).toBeNull();
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
  expect(screen.queryByText(/No services yet/)).toBeNull();

  waiting.forEach((answer) => answer());
  expect(await screen.findByText('Bridal makeup')).toBeTruthy();
});

// The artist's own category (Makeup, id 1) with a subcategory and two listed services; one is already on the menu.
const listTree = [{
  id: 1, slug: 'makeup', name: 'Makeup',
  subcategories: [{ id: 12, slug: 'makeup-bridal', name: 'Bridal', services: [{ id: 3, name: 'Bridal makeup', description: null }, { id: 4, name: 'Engagement makeup', description: null }] }],
}];

it('adds a service from the admin\'s list, live', async () => {
  const added: unknown[] = [];
  send.mockImplementation(async (req: TransportRequest) => {
    if (req.path === '/categories') return { status: 200, json: listTree };
    if (req.method === 'POST' && req.path === '/artists/me/services') {
      added.push(req.body);
      return { status: 201, json: { ...profile, services: [templateServiceFixture, { ...templateServiceFixture, id: 'new', template_id: 4, name: 'Engagement makeup' }] } };
    }
    return { status: 200, json: profile };
  });
  await wrap(<MyServices />);

  await fireEvent.press(await screen.findByRole('button', { name: 'Add from the list' }));
  expect(await screen.findByLabelText('Bridal makeup, added')).toBeTruthy(); // already on the menu
  await fireEvent.press(screen.getByLabelText('Engagement makeup'));
  await fireEvent.changeText(screen.getByLabelText('Price (₹)'), '6000');
  await fireEvent.changeText(screen.getByLabelText('Duration (minutes)'), '120');
  await fireEvent.press(screen.getByRole('button', { name: 'Save service' }));

  await waitFor(() => expect(added).toEqual([expect.objectContaining({ template_id: 4, price_paise: 600000, duration_minutes: 120 })]));
  expect(await screen.findByText('Engagement makeup')).toBeTruthy();
});

it('removes a listed service after confirming', async () => {
  const deleted: string[] = [];
  send.mockImplementation(async (req: TransportRequest) => {
    if (req.path === '/categories') return { status: 200, json: listTree };
    if (req.method === 'DELETE') {
      deleted.push(req.path);
      return { status: 200, json: { ...profile, services: [] } };
    }
    return { status: 200, json: profile };
  });
  await wrap(<MyServices />);

  await fireEvent.press(await screen.findByRole('button', { name: 'Delete Bridal makeup' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Yes, delete' }));

  await waitFor(() => expect(deleted).toEqual([`/artists/me/services/${templateServiceFixture.id}`]));
  expect(await screen.findByText('No services yet. Add one so clients can book you.')).toBeTruthy();
});
