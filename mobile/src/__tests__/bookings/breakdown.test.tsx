import { render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../core/theme/theme-provider';
import { Breakdown } from '../../components/bookings/Breakdown';
import { priceBreakdown } from '../../utils/bookings/pricing';

it('without in-app payments, shows no platform fee or deposit, only what is paid to the artist', async () => {
  await render(<ThemeProvider><Breakdown money={priceBreakdown(450_000, 0, false)} /></ThemeProvider>);

  expect(screen.getByText('Pay the artist after the service')).toBeTruthy();
  expect(screen.getByText('₹4,500')).toBeTruthy();
  expect(screen.queryByText(/Deposit|Platform fee|Waived/)).toBeNull();
});

it('shows nothing about a deposit or fee even for an older booking that recorded them', async () => {
  await render(<ThemeProvider><Breakdown money={priceBreakdown(450_000)} paid /></ThemeProvider>);

  expect(screen.getByText('Pay the artist after the service')).toBeTruthy();
  expect(screen.queryByText(/Deposit|Platform fee/)).toBeNull();
});
