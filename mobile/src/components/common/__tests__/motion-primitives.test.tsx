import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { ThemeProvider } from '../../../core/theme/theme-provider';
import { AppText } from '../AppText';
import { CrossfadeStack } from '../CrossfadeStack';
import { MotionEntrance } from '../MotionEntrance';
import { PressableScale } from '../PressableScale';
import { Skeleton } from '../Skeleton';

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
it('MotionEntrance renders its children', async () => {
  await wrap(
    <MotionEntrance index={2} armed>
      <AppText>Card</AppText>
    </MotionEntrance>,
  );
  expect(screen.getByText('Card')).toBeTruthy();
});

it('CrossfadeStack keeps every layer mounted, so swapping never pops', async () => {
  await wrap(
    <CrossfadeStack active={1} durationMs={240}>
      <AppText>First</AppText>
      <AppText>Second</AppText>
    </CrossfadeStack>,
  );
  // Both layers stay in the tree at all times; only their opacity differs. Unmounting the outgoing one
  // is what makes a cross-fade flash.
  expect(screen.getByText('First')).toBeTruthy();
  expect(screen.getByText('Second')).toBeTruthy();
});

it('Skeleton renders a loading placeholder instead of a spinner', async () => {
  await wrap(<Skeleton height={112} width={96} />);
  expect(screen.getByLabelText('Loading')).toBeTruthy();
});
