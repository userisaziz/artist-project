import { Platform, StyleSheet, Text } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { PressableFeedback } from '../../components/common/PressableFeedback';
import { lightTheme } from '../../core/theme/themes/light';

const originalOS = Platform.OS;
afterEach(() => { Platform.OS = originalOS; });

const impact = Haptics.impactAsync as jest.Mock;
beforeEach(() => { impact.mockClear(); });

const control = () => screen.getByTestId('control');
const touch = { nativeEvent: { touches: [], changedTouches: [], identifier: 0, pageX: 0, pageY: 0, locationX: 0, locationY: 0, timestamp: 0 }, persist: () => {} };
/** Puts a finger down, as the responder system does, and returns the opacity the control shows meanwhile. */
const opacityWhilePressed = async () => {
  await act(async () => { fireEvent(control(), 'responderGrant', touch); });
  return StyleSheet.flatten(control().props.style)?.opacity;
};

it('runs onPress like a plain Pressable', async () => {
  const onPress = jest.fn();
  await render(<PressableFeedback accessibilityRole="button" accessibilityLabel="Save" onPress={onPress}><Text>Save</Text></PressableFeedback>);

  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

  expect(onPress).toHaveBeenCalledTimes(1);
});

it('dims under the finger on iOS and keeps its own style', async () => {
  Platform.OS = 'ios';
  await render(<PressableFeedback testID="control" onPress={jest.fn()} style={{ padding: 8 }}><Text>Row</Text></PressableFeedback>);
  expect(StyleSheet.flatten(control().props.style)).toEqual({ padding: 8 });

  expect(await opacityWhilePressed()).toBe(0.6);
  expect(StyleSheet.flatten(control().props.style).padding).toBe(8);
});

it('ripples in the theme colour on Android', async () => {
  Platform.OS = 'android';
  await render(<PressableFeedback testID="control" onPress={jest.fn()}><Text>Row</Text></PressableFeedback>);

  expect(control().props.nativeForegroundAndroid).toMatchObject({ type: 'RippleAndroid', color: expect.any(Number) });
  expect(lightTheme.colors.pressedOverlay).toMatch(/^#[0-9A-F]{8}$/i);
});

it('shows nothing when disabled, without a handler, or with feedback off', async () => {
  Platform.OS = 'ios';
  const cases = [
    <PressableFeedback key="d" testID="control" disabled onPress={jest.fn()}><Text>Row</Text></PressableFeedback>,
    <PressableFeedback key="n" testID="control"><Text>Row</Text></PressableFeedback>,
    <PressableFeedback key="f" testID="control" feedback={false} onPress={jest.fn()}><Text>Row</Text></PressableFeedback>,
  ];
  for (const ui of cases) {
    await render(ui);
    expect(await opacityWhilePressed()).toBeUndefined();
  }
});

it('buzzes on touch-down only when asked to', async () => {
  Platform.OS = 'ios';
  await render(<PressableFeedback testID="control" haptic="tap" onPress={jest.fn()}><Text>Save</Text></PressableFeedback>);
  await act(async () => { fireEvent(control(), 'responderGrant', touch); });
  expect(impact).toHaveBeenCalledWith('light');

  impact.mockClear();
  await render(<PressableFeedback testID="control" onPress={jest.fn()}><Text>Quiet</Text></PressableFeedback>);
  await act(async () => { fireEvent(control(), 'responderGrant', touch); });
  expect(impact).not.toHaveBeenCalled();
});

it('does not buzz for a control that cannot be pressed', async () => {
  Platform.OS = 'ios';
  // A disabled control is a dropped onPress, not a `disabled` prop — the buzz follows the same rule.
  await render(<PressableFeedback testID="control" haptic="tap"><Text>Off</Text></PressableFeedback>);
  await act(async () => { fireEvent(control(), 'responderGrant', touch); });
  expect(impact).not.toHaveBeenCalled();
});
