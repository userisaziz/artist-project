import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '../../core/theme/theme-provider';
import { ApiError } from '../../core/api/types';
import SignupScreen from '../../../app/(onboarding)/signup';

const mockSignup = jest.fn();
const mockChooseRole = jest.fn();
const mockSignOut = jest.fn();
jest.mock('../../context/auth/auth-provider', () => ({
  useAuth: () => ({ completeSignup: mockSignup, chooseRole: mockChooseRole, signOut: mockSignOut }),
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const wrap = () => render(<ThemeProvider><SignupScreen /></ThemeProvider>);
const continueButton = () => screen.getByRole('button', { name: 'Continue' });

beforeEach(() => {
  mockSignup.mockReset();
  mockChooseRole.mockReset();
  mockSignOut.mockReset();
});

it('sends the birthday in the format the API wants, once it is a real adult date', async () => {
  mockSignup.mockResolvedValue(undefined);
  await wrap();

  await fireEvent.changeText(screen.getByLabelText('First name'), 'Asha');
  await fireEvent.press(continueButton());
  expect(await screen.findByText('Enter your date of birth as DD/MM/YYYY.')).toBeTruthy();
  expect(mockSignup).not.toHaveBeenCalled();

  await fireEvent.changeText(screen.getByLabelText('Date of birth'), '12041995');
  expect(screen.getByDisplayValue('12/04/1995')).toBeTruthy(); // the mask groups as the user types
  await fireEvent.press(continueButton());

  await waitFor(() => expect(mockSignup).toHaveBeenCalledWith({
    first_name: 'Asha',
    last_name: null,
    date_of_birth: '1995-04-12',
    email: null,
    whatsapp_booking_updates: true,
  }));
});

it('refuses a minor before the network, in the server’s own words', async () => {
  mockSignup.mockResolvedValue(undefined);
  await wrap();

  await fireEvent.changeText(screen.getByLabelText('First name'), 'Asha');
  await fireEvent.changeText(screen.getByLabelText('Date of birth'), '01012012');
  await fireEvent.press(continueButton());

  expect(await screen.findByText('You must be at least 18 years old to continue.')).toBeTruthy();
  expect(mockSignup).not.toHaveBeenCalled();
});

it('lets a verified user browse as a customer without filling the form', async () => {
  mockChooseRole.mockResolvedValue(undefined);
  await wrap();

  await fireEvent.press(screen.getByRole('button', { name: 'Browse as a customer' }));

  await waitFor(() => expect(mockChooseRole).toHaveBeenCalledWith('customer'));
  expect(mockSignup).not.toHaveBeenCalled();
  expect(mockSignOut).not.toHaveBeenCalled(); // the session stays verified; the gate routes on active_role
});

it('says what failed when the escape does not, and stays on the screen', async () => {
  mockChooseRole.mockRejectedValue(new ApiError('server_error', 'The server is having a moment.', 500));
  await wrap();

  await fireEvent.press(screen.getByRole('button', { name: 'Browse as a customer' }));

  expect(await screen.findByText('The server is having a moment.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Browse as a customer' })).toBeTruthy();
});

it('the chevron leaves the account, because there is no OTP screen behind this one', async () => {
  await wrap();

  await fireEvent.press(screen.getByRole('button', { name: 'Back' }));

  expect(mockSignOut).toHaveBeenCalled();
});
