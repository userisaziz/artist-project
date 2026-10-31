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

// The grey wash the user keeps seeing: the default Android ripple paints a bounded rectangle even
// when the Pressable's own box is transparent (rows, links, day cells), so a grey bar flashes over
// empty space. Only surfaces that own a background may take the wash.
it('paints no Android ripple across a transparent Pressable', async () => {
  Platform.OS = 'android';
  await renderTarget({ padding: 12 });
  expect(target().props.nativeForegroundAndroid).toBeUndefined();
});

it('keeps the Android ripple on elements that own a background surface', async () => {
  Platform.OS = 'android';
  await renderTarget({ padding: 12, backgroundColor: '#FFFFFF' });
  expect(target().props.nativeForegroundAndroid).toBeDefined();
});

it('dims a transparent Pressable under the finger on Android instead of washing it', async () => {
  Platform.OS = 'android';
  await renderTarget({ padding: 12 });
  await grant();
  expect(StyleSheet.flatten(target().props.style)?.opacity).toBe(0.6);
});

// (A pressed-surfaced-Android assertion is not expressible here: RN's ripple hook needs a native
// view ref, so firing a grant on it throws in the jest renderer. The dim branch is guarded by the
// same `ownsSurface` flag tested above.)

it('still dims every responding Pressable on iOS', async () => {
  Platform.OS = 'ios';
  await renderTarget({ padding: 12 });
  await grant();
  expect(StyleSheet.flatten(target().props.style)?.opacity).toBe(0.6);
});
