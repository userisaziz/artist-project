import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { ThemeProvider } from '../../../core/theme/theme-provider';
import { AppText } from '../AppText';
import { PressableScale } from '../PressableScale';

const wrap = (ui: ReactElement) => render(<ThemeProvider>{ui}</ThemeProvider>);

it('PressableScale keeps its child tappable and answers presses', async () => {
  const onPress = jest.fn();
  await wrap(
    <PressableScale accessibilityRole="button" accessibilityLabel="Open artist" onPress={onPress}>
      <AppText>Ananya Rao</AppText>
    </PressableScale>,
  );
  await fireEvent(screen.getByLabelText('Open artist'), 'pressIn');
  await fireEvent(screen.getByLabelText('Open artist'), 'pressOut');
  await fireEvent.press(screen.getByLabelText('Open artist'));
  expect(onPress).toHaveBeenCalled();
});

it('still fires onPress with feedback off', async () => {
  const onPress = jest.fn();
  await wrap(
    <PressableScale feedback={false} accessibilityRole="button" accessibilityLabel="Tap" onPress={onPress}>
      <AppText>Tap me</AppText>
    </PressableScale>,
  );
  await fireEvent.press(screen.getByLabelText('Tap'));
  expect(onPress).toHaveBeenCalled();
});

it('attaches the animated dip handle so the spring can drive the view', async () => {
  await wrap(
    <PressableScale accessibilityRole="button" accessibilityLabel="Probe" onPress={() => {}}>
      <AppText>Probe</AppText>
    </PressableScale>,
  );
  const host = screen.getByLabelText('Probe');
  const animated = (host.props as { jestAnimatedStyle?: { value?: unknown } }).jestAnimatedStyle;
  expect(animated?.value).toEqual({ transform: [{ scale: 1 }] });
});

it('forwards user press handlers alongside the dip', async () => {
  const onPressIn = jest.fn();
  const onPressOut = jest.fn();
  await wrap(
    <PressableScale accessibilityRole="button" accessibilityLabel="Fwd" onPressIn={onPressIn} onPressOut={onPressOut} onPress={() => {}}>
      <AppText>Fwd</AppText>
    </PressableScale>,
  );
  await fireEvent(screen.getByLabelText('Fwd'), 'pressIn');
  await fireEvent(screen.getByLabelText('Fwd'), 'pressOut');
  expect(onPressIn).toHaveBeenCalledTimes(1);
  expect(onPressOut).toHaveBeenCalledTimes(1);
});
