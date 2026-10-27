import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../core/theme/theme-provider';
import { ApiError } from '../../core/api/types';
import { ServicePriceSheet } from '../../components/artist-services/ServicePriceSheet';
import { templateServiceFixture } from '../../mocks/artist-onboarding/artist-onboarding';

const METRICS = { frame: { x: 0, y: 0, width: 393, height: 852 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };

async function renderSheet(onSubmit: jest.Mock = jest.fn(async () => {}), onClose = jest.fn()) {
  await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider><ServicePriceSheet service={templateServiceFixture} onClose={onClose} onSubmit={onSubmit} /></ThemeProvider>
    </SafeAreaProvider>,
  );
  return { onSubmit, onClose };
}

it('saves a new price and duration at once, with no review', async () => {
  const { onSubmit, onClose } = await renderSheet();
  expect(screen.getByText(/Customers see the new price straight away/)).toBeTruthy();

  await fireEvent.changeText(screen.getByLabelText('Price (₹)'), '6000');
  await fireEvent.changeText(screen.getByLabelText('Duration (minutes)'), '150');
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

  await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ price_paise: 600000, duration_minutes: 150 }));
  expect(onClose).toHaveBeenCalled();
});

it('checks the numbers before sending', async () => {
  const { onSubmit } = await renderSheet();

  await fireEvent.changeText(screen.getByLabelText('Price (₹)'), '0');
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

  expect(await screen.findByText('Enter a price above ₹0.')).toBeTruthy();
  expect(onSubmit).not.toHaveBeenCalled();
});

it('shows the server error and stays open when saving fails', async () => {
  const failing = jest.fn(async () => { throw new ApiError('conflict', 'Once approved, only a service’s price and duration can change', 409); });
  const { onClose } = await renderSheet(failing);

  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

  expect(await screen.findByText(/only a service’s price and duration can change/)).toBeTruthy();
  expect(onClose).not.toHaveBeenCalled();
});
