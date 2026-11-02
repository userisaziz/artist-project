import { Platform, StyleSheet, Text } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { PressableFeedback, pressedScaleFor } from '../../components/common/PressableFeedback';

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

it.each(['ios', 'android'] as const)('fades under the finger on %s and keeps its own style', async (os) => {
  Platform.OS = os;
  await render(<PressableFeedback testID="control" onPress={jest.fn()} style={{ padding: 8, backgroundColor: '#FFFFFF' }}><Text>Row</Text></PressableFeedback>);
  expect(StyleSheet.flatten(control().props.style)).toMatchObject({ padding: 8, backgroundColor: '#FFFFFF' });

  expect(await opacityWhilePressed()).toBe(0.85);
  expect(StyleSheet.flatten(control().props.style).padding).toBe(8);
});

it('never paints a grey wash over the surface on Android', async () => {
  Platform.OS = 'android';
  await render(<PressableFeedback testID="control" onPress={jest.fn()} style={{ backgroundColor: '#FFFFFF' }}><Text>Row</Text></PressableFeedback>);

  await opacityWhilePressed();

  expect(control().props.nativeForegroundAndroid).toBeUndefined();
  expect(control().props.nativeBackgroundAndroid).toBeUndefined();
});

it('fades without the dip when scale is off', async () => {
  Platform.OS = 'android';
  await render(<PressableFeedback testID="control" scale={false} onPress={jest.fn()}><Text>Row</Text></PressableFeedback>);

  expect(await opacityWhilePressed()).toBe(0.85);
  expect(StyleSheet.flatten(control().props.style)?.transform).toBeUndefined();
});

it('sizes the dip so a chip and a full-width card move their edges by about the same amount', () => {
  expect(pressedScaleFor(0)).toBe(0.96);
  expect(pressedScaleFor(80)).toBe(0.96);
  expect(pressedScaleFor(360)).toBeCloseTo(1 - 8 / 360);
  expect(pressedScaleFor(2000)).toBe(0.985);
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
