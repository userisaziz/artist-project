import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '../../core/theme/theme-provider';
import { ApiError } from '../../core/api/types';
import IntroScreen from '../../../app/artist/onboarding/intro';

const mockPush = jest.fn();
const mockChooseRole = jest.fn();
const mockSignOut = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('../../context/auth/auth-provider', () => ({
  useAuth: () => ({ chooseRole: mockChooseRole, signOut: mockSignOut }),
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('expo-image', () => ({ Image: require('react-native').View }));

const wrap = () => render(<ThemeProvider><IntroScreen /></ThemeProvider>);
const browseButton = () => screen.getByRole('button', { name: 'Browse as a customer' });

beforeEach(() => {
  mockPush.mockReset();
  mockChooseRole.mockReset();
  mockSignOut.mockReset();
});

it('gives an artist who changed their mind a way into the customer app', async () => {
  mockChooseRole.mockResolvedValue(undefined);
  await wrap();

  await fireEvent.press(browseButton());

  await waitFor(() => expect(mockChooseRole).toHaveBeenCalledWith('customer'));
  expect(mockSignOut).not.toHaveBeenCalled(); // the session stays; the gate routes on active_role
  expect(mockPush).not.toHaveBeenCalled(); // and the flow does not march on to the Profile step
});

it('says what failed when the escape does not, and stays on the screen', async () => {
  mockChooseRole.mockRejectedValue(new ApiError('server_error', 'The server is having a moment.', 500));
  await wrap();

  await fireEvent.press(browseButton());

  expect(await screen.findByText('The server is having a moment.')).toBeTruthy();
  expect(browseButton()).toBeTruthy();
});

it('still signs out from the close button', async () => {
  mockChooseRole.mockResolvedValue(undefined);
  await wrap();

  await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));

  expect(mockSignOut).toHaveBeenCalled();
  expect(mockChooseRole).not.toHaveBeenCalled();
});
