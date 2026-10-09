import { render, screen, fireEvent } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme/theme-provider';
import { OtpInput } from '../OtpInput';

const wrap = (onComplete: (code: string) => void, onChange?: (code: string) => void) =>
  render(
    <ThemeProvider>
      <OtpInput onComplete={onComplete} onChange={onChange} />
    </ThemeProvider>,
  );

it('typing digits auto-advances and fires onComplete exactly once at six digits', async () => {
  const onComplete = jest.fn();
  await wrap(onComplete);
  const boxes = screen.getAllByTestId(/otp-box-\d/);
  for (const [i, d] of '123456'.split('').entries()) {
    await fireEvent.changeText(boxes[i], d);
  }
  expect(onComplete).toHaveBeenCalledTimes(1);
  expect(onComplete).toHaveBeenCalledWith('123456');
});

it('pasting 6 digits into the first box distributes them across boxes and completes', async () => {
  const onComplete = jest.fn();
  await wrap(onComplete);
  await fireEvent.changeText(screen.getByTestId('otp-box-0'), '234567');
  expect(onComplete).toHaveBeenCalledWith('234567');
  expect(
    screen
      .getAllByTestId(/otp-box-\d/)
      .map((b) => b.props.value)
      .join(''),
  ).toBe('234567');
});

it('error=true clears digits so the user can retry immediately', async () => {
  const onComplete = jest.fn();
  const { rerender } = await render(
    <ThemeProvider>
      <OtpInput onComplete={onComplete} />
    </ThemeProvider>,
  );
  const boxes = screen.getAllByTestId(/otp-box-\d/);
  for (const [i, d] of '123456'.split('').entries()) {
    await fireEvent.changeText(boxes[i], d);
  }
  await rerender(
    <ThemeProvider>
      <OtpInput onComplete={onComplete} error />
    </ThemeProvider>,
  );
  expect(screen.getAllByTestId(/otp-box-\d/).every((b) => b.props.value === '')).toBe(true);
});

it('backspace on an empty box clears the previous box', async () => {
  await wrap(jest.fn());
  await fireEvent.changeText(screen.getByTestId('otp-box-0'), '1');
  expect(screen.getByTestId('otp-box-0').props.value).toBe('1');
  await fireEvent(screen.getByTestId('otp-box-1'), 'keyPress', { nativeEvent: { key: 'Backspace' } });
  expect(screen.getByTestId('otp-box-0').props.value).toBe('');
});

it('onChange receives the partial joined code', async () => {
  const onChange = jest.fn();
  await wrap(jest.fn(), onChange);
  await fireEvent.changeText(screen.getByTestId('otp-box-0'), '1');
  await fireEvent.changeText(screen.getByTestId('otp-box-1'), '2');
  expect(onChange).toHaveBeenLastCalledWith('12');
});
