import { render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../core/theme/theme-provider';
import { Breakdown } from '../../components/bookings/Breakdown';
import { priceBreakdown } from '../../utils/bookings/pricing';

it('with no deposit, says the total is paid to the artist after the service', async () => {
  await render(<ThemeProvider><Breakdown money={priceBreakdown(450_000, 0)} /></ThemeProvider>);

  expect(screen.getByText('Pay the artist after the service')).toBeTruthy();
  expect(screen.queryByText(/Deposit/)).toBeNull();
});

it('with a deposit, shows the deposit and the balance', async () => {
  await render(<ThemeProvider><Breakdown money={priceBreakdown(450_000)} /></ThemeProvider>);

  expect(screen.getByText('Deposit today (30%)')).toBeTruthy();
  expect(screen.getByText('Balance after the service')).toBeTruthy();
});
