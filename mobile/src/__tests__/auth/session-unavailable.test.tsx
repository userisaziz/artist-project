import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../core/theme/theme-provider';
import { SessionUnavailable } from '../../components/auth/SessionUnavailable';

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => { resolve = r; });
  return { promise, resolve };
}

it('explains the problem and retries the restore, busy while it runs', async () => {
  const retry = deferred();
  const onRetry = jest.fn(() => retry.promise);
  await render(<ThemeProvider><SessionUnavailable onRetry={onRetry} /></ThemeProvider>);

  expect(screen.getByText('Can’t reach the server')).toBeTruthy();
  await act(async () => { fireEvent.press(screen.getByRole('button')); });

  expect(onRetry).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button')).toHaveProperty('props.accessibilityState.busy', true);

  await act(async () => { retry.resolve(); });
  expect(screen.getByRole('button')).toHaveProperty('props.accessibilityState.busy', false);
});
