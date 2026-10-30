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

it('PressableScale with feedback off stays silent on press but still fires', async () => {
  const onPress = jest.fn();
  await wrap(
    <PressableScale feedback={false} accessibilityRole="button" accessibilityLabel="Tap" onPress={onPress}>
      <AppText>Tap me</AppText>
    </PressableScale>,
  );
  await fireEvent.press(screen.getByLabelText('Tap'));
  expect(onPress).toHaveBeenCalled();
});
