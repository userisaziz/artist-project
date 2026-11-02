import type { ReactElement } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../../core/theme/theme-provider';
import { PressableFeedback } from '../PressableFeedback';

const originalOS = Platform.OS;
afterEach(() => { Platform.OS = originalOS; });

const wrap = (ui: ReactElement) => render(<ThemeProvider>{ui}</ThemeProvider>);
const touch = { nativeEvent: { touches: [], changedTouches: [], identifier: 0, pageX: 0, pageY: 0, locationX: 0, locationY: 0, timestamp: 0 }, persist: () => {} };

const target = () => screen.getByTestId("press-target");
const renderTarget = async (style: object) => await wrap(
  <PressableFeedback testID="press-target" onPress={() => {}} style={style}>
    <></>
  </PressableFeedback>,
);
const grant = async () => { await act(async () => { fireEvent(target(), 'responderGrant', touch); }); };

// The grey wash the user kept seeing: an Android ripple paints a bounded rectangle over the element,
// which reads as a grey box on white cards and as a grey bar over transparent rows. No surface takes a
// wash any more; every press answers with the same fade (plus the dip) on both platforms.
it.each([
  ['a transparent row', { padding: 12 }],
  ['a surfaced card', { padding: 12, backgroundColor: '#FFFFFF' }],
])('paints no Android ripple across %s', async (_label, style) => {
  Platform.OS = 'android';
  await renderTarget(style);
  expect(target().props.nativeForegroundAndroid).toBeUndefined();
  expect(target().props.nativeBackgroundAndroid).toBeUndefined();
});

it.each([
  ['android', { padding: 12 }],
  ['android', { padding: 12, backgroundColor: '#FFFFFF' }],
  ['ios', { padding: 12 }],
] as const)('fades a responding Pressable under the finger on %s', async (os, style) => {
  Platform.OS = os;
  await renderTarget(style);
  await grant();
  expect(StyleSheet.flatten(target().props.style)?.opacity).toBe(0.85);
});
