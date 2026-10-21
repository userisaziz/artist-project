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

  await fireEvent.changeText(screen.getByDisplayValue('Asha'), 'Asha ');
  await fireEvent.changeText(screen.getByDisplayValue('Rao'), 'Rao-Menon');
  await fireEvent.changeText(screen.getByLabelText('Email (optional)'), ' asha@example.com ');
  await fireEvent(screen.getByLabelText('Booking updates on WhatsApp'), 'valueChange', false);
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

  await waitFor(() => expect(onDone).toHaveBeenCalled());
  expect(mockSave).toHaveBeenCalledWith({ first_name: 'Asha', last_name: 'Rao-Menon', email: 'asha@example.com', whatsapp_booking_updates: false });
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
