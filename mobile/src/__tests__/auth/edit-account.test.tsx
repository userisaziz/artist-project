import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '../../core/theme/theme-provider';
import { ApiError } from '../../core/api/types';
import { EditAccountForm } from '../../components/auth/EditAccountForm';

const mockSave = jest.fn();
jest.mock('../../context/auth/auth-provider', () => ({
  useAuth: () => ({ user: jest.requireActual('../../mocks/auth/auth').userFixture, completeSignup: mockSave }),
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const wrap = (onDone = jest.fn()) => render(<ThemeProvider><EditAccountForm onDone={onDone} /></ThemeProvider>);

beforeEach(() => mockSave.mockReset());

it('prefills the account and saves the changes', async () => {
  mockSave.mockResolvedValue(undefined);
  const onDone = jest.fn();
  await wrap(onDone);

  expect(screen.getByDisplayValue('12/04/1995')).toBeTruthy(); // the stored birthday comes back as DD/MM/YYYY
  await fireEvent.changeText(screen.getByDisplayValue('Asha'), 'Asha ');
  await fireEvent.changeText(screen.getByDisplayValue('Rao'), 'Rao-Menon');
  await fireEvent.changeText(screen.getByLabelText('Email (optional)'), ' asha@example.com ');
  await fireEvent(screen.getByLabelText('Booking updates on WhatsApp'), 'valueChange', false);
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

  await waitFor(() => expect(onDone).toHaveBeenCalled());
  expect(mockSave).toHaveBeenCalledWith({ first_name: 'Asha', last_name: 'Rao-Menon', date_of_birth: '1995-04-12', email: 'asha@example.com', whatsapp_booking_updates: false });
});

it('keeps a date of birth the server would reject out of the PATCH', async () => {
  mockSave.mockResolvedValue(undefined);
  await wrap();

  // Born in 2012: a minor for the next decade, so the check does not drift with the calendar.
  await fireEvent.changeText(screen.getByDisplayValue('12/04/1995'), '01112012');
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

  expect(await screen.findByText('You must be at least 18 years old to continue.')).toBeTruthy();
  expect(mockSave).not.toHaveBeenCalled();
});

it('reads a typed birthday digit by digit, and rejects an impossible day', async () => {
  mockSave.mockResolvedValue(undefined);
  await wrap();

  await fireEvent.changeText(screen.getByDisplayValue('12/04/1995'), '31021995'); // 31 February
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText('Enter your date of birth as DD/MM/YYYY.')).toBeTruthy();

  await fireEvent.changeText(screen.getByLabelText('Date of birth'), '2902');
  expect(screen.getByDisplayValue('29/02')).toBeTruthy(); // the mask groups while typing
});

it('rejects a malformed email before saving, and explains an email already in use', async () => {
  mockSave.mockRejectedValue(new ApiError('conflict', 'Email taken', 409));
  await wrap();

  await fireEvent.changeText(screen.getByLabelText('Email (optional)'), 'asha@');
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  expect(screen.getByText('Enter a valid email, or leave it empty.')).toBeTruthy();
  expect(mockSave).not.toHaveBeenCalled();

  await fireEvent.changeText(screen.getByLabelText('Email (optional)'), 'taken@example.com');
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText('That email is already used by another account.')).toBeTruthy();
});
