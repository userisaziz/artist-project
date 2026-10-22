import type { ReactElement } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../../core/theme/theme-provider';
import { transport } from '../../core/api/client';
import type { MyRequirements, PendingRequirement } from '../../types/artist-onboarding/artist-onboarding';
import { RequirementsBanner } from '../../components/artist-onboarding/RequirementsBanner';

jest.mock('../../context/auth/auth-provider', () => ({
  useAuth: () => ({ user: jest.requireActual('../../mocks/auth/auth').userFixture }),
}));

// Mirrors backend GET /artists/me/requirements (app/requirement/schemas.py).
const LOCATION: PendingRequirement = {
  key: 'location', title: 'Add your studio location', body: 'Clients nearby can only find you once your area and pincode are on your profile.',
  action: '/artist/location', due_at: '2026-10-29T06:30:00Z', overdue: false,
};
const send = jest.spyOn(transport, 'request');
let client: QueryClient;
const wrap = (ui: ReactElement) => render(<QueryClientProvider client={client}><ThemeProvider>{ui}</ThemeProvider></QueryClientProvider>);
const serve = (body: MyRequirements | null, status = 200) =>
  send.mockResolvedValue(body ? { status, json: body } : { status: 500, json: { code: 'server_error', message: 'Something went wrong' } });

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  send.mockReset();
});
afterEach(() => client.clear());
afterAll(() => send.mockRestore());

it('warns with the deadline during the grace period and opens the fix', async () => {
  serve({ on_hold: false, items: [LOCATION] });
  const onOpen = jest.fn();
  await wrap(<RequirementsBanner onOpen={onOpen} />);

  expect(await screen.findByText('Add your studio location by Thu, 29 Oct to stay visible to clients.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: /Complete now/ }));
  expect(onOpen).toHaveBeenCalledWith('/artist/location');
});

it('says the profile is hidden once a requirement is overdue', async () => {
  serve({ on_hold: true, items: [{ ...LOCATION, overdue: true }] });
  await wrap(<RequirementsBanner onOpen={jest.fn()} />);

  expect(await screen.findByText('Your profile is hidden. Add your studio location to show up for clients again.')).toBeTruthy();
});

it('shows nothing when everything is done, or when the check itself fails', async () => {
  serve({ on_hold: false, items: [] });
  const done = await wrap(<RequirementsBanner onOpen={jest.fn()} />);
  await waitFor(() => expect(send).toHaveBeenCalled());
  await waitFor(() => expect(client.isFetching()).toBe(0));
  expect(screen.queryByRole('button')).toBeNull();
  done.unmount();

  serve(null);
  await wrap(<RequirementsBanner onOpen={jest.fn()} />);
  await waitFor(() => expect(send).toHaveBeenCalled());
  await waitFor(() => expect(client.isFetching()).toBe(0));
  expect(screen.queryByRole('button')).toBeNull();
});
