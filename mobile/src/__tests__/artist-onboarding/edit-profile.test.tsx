import type { ReactElement } from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../../core/theme/theme-provider';
import { transport } from '../../core/api/client';
import { ArtistFlowContext } from '../../context/artist-onboarding/flow-context';
import { EditProfileRow } from '../../components/artist-onboarding/EditProfileRow';
import { artistProfileFixture } from '../../mocks/artist-onboarding/artist-onboarding';
import { userFixture } from '../../mocks/auth/auth';

jest.mock('../../context/auth/auth-provider', () => ({
  useAuth: () => ({ user: jest.requireActual('../../mocks/auth/auth').userFixture }),
}));

type AlertButton = { text?: string; onPress?: () => void };
const send = jest.spyOn(transport, 'request');
const alert = jest.spyOn(Alert, 'alert');
const profileKey = ['artist', 'me', userFixture.id];
let client: QueryClient;
const startEditing = jest.fn();
const wrap = (ui: ReactElement) => render(
  <QueryClientProvider client={client}>
    <ThemeProvider>
      <ArtistFlowContext.Provider value={{ editing: false, startEditing }}>{ui}</ArtistFlowContext.Provider>
    </ThemeProvider>
  </QueryClientProvider>,
);
/** Presses the dialog button labelled `text` in the most recent Alert. */
const choose = (text: string) => {
  const buttons = alert.mock.calls.at(-1)?.[2] as AlertButton[];
  buttons.find((b) => b.text === text)?.onPress?.();
};

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  send.mockReset();
  alert.mockReset();
  startEditing.mockReset();
});
afterEach(() => client.clear());
afterAll(() => { send.mockRestore(); alert.mockRestore(); });

it('asks first, then reopens the profile and starts editing at Profile', async () => {
  const reopened = artistProfileFixture({ status: 'draft' });
  send.mockResolvedValue({ status: 200, json: reopened });
  await wrap(<EditProfileRow />);

  await fireEvent.press(screen.getByRole('button'));
  expect(alert.mock.calls[0][0]).toBe('Edit your profile?');
  expect(send).not.toHaveBeenCalled();
  choose('Edit profile');

  await waitFor(() => expect(client.getQueryData(profileKey)).toEqual(reopened));
  expect(send.mock.calls[0][0]).toMatchObject({ method: 'POST', path: '/artists/me/reopen' });
  expect(startEditing).toHaveBeenCalled();
});

it('does nothing when the artist backs out', async () => {
  await wrap(<EditProfileRow />);
  await fireEvent.press(screen.getByRole('button'));
  choose('Not now');
  expect(send).not.toHaveBeenCalled();
  expect(startEditing).not.toHaveBeenCalled();
});

it('says why when the profile cannot be reopened', async () => {
  send.mockResolvedValue({ status: 409, json: { code: 'conflict', message: 'Profile is pending; only an approved profile can be reopened' } });
  await wrap(<EditProfileRow />);
  await fireEvent.press(screen.getByRole('button'));
  choose('Edit profile');

  await waitFor(() => expect(alert).toHaveBeenLastCalledWith('Couldn’t open your profile', 'Profile is pending; only an approved profile can be reopened'));
});
