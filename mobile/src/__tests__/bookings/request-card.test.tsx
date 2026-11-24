import { fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../core/theme/theme-provider';
import { RequestCard } from '../../components/bookings/RequestCard';
import { bookingFixture } from '../../mocks/bookings/bookings';

const NOW = Date.parse('2030-10-30T06:00:00Z');
const priya = bookingFixture({ id: 'b-1', status: 'requested', customer: { id: 'c1', first_name: 'Priya', last_name: 'Sharma' } });
const rohan = bookingFixture({ id: 'b-2', code: 'AT-20000', status: 'requested', customer: { id: 'c2', first_name: 'Rohan', last_name: 'Verma' } });

const card = (booking = priya, onDecline = jest.fn(), onAccept = jest.fn()) => (
  <ThemeProvider>
    <RequestCard booking={booking} now={NOW} busy={false} onAccept={onAccept} onDecline={onDecline} onMessage={jest.fn()} />
  </ThemeProvider>
);

it('keeps a typed decline reason with its own request when the card is reused for another one', async () => {
  const onDecline = jest.fn();
  const view = await render(card(priya, onDecline));
  await fireEvent.press(screen.getByRole('button', { name: 'Decline Priya Sharma' }));
  await fireEvent.changeText(screen.getByPlaceholderText('Tell the customer why'), 'Fully booked that day');

  // A recycling list hands the same card instance a different booking.
  await view.rerender(card(rohan, onDecline));
  expect(screen.queryByPlaceholderText('Tell the customer why')).toBeNull();
  expect(screen.getByRole('button', { name: 'Accept Rohan Verma' })).toBeTruthy();

  await view.rerender(card(priya, onDecline));
  expect(screen.getByDisplayValue('Fully booked that day')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Confirm decline' }));
  expect(onDecline).toHaveBeenCalledWith('Fully booked that day');
});

it('stops offering Accept and Decline once the request has expired', async () => {
  await render(card(bookingFixture({ status: 'requested', expires_at: '2030-10-30T05:59:00Z' })));
  expect(screen.queryByRole('button', { name: /^Accept/ })).toBeNull();
  expect(screen.queryByRole('button', { name: /^Decline/ })).toBeNull();
  expect(screen.getByText(/expired before it was answered/)).toBeTruthy();
});
