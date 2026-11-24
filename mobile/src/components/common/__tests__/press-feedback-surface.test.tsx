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

// The grey cast on pressed cards: a surface that casts a shadow and fades to 0.85 lets its own shadow show
// through it (Android draws the elevation shadow under a translucent view as a grey film). Shadowed
// surfaces answer with the dip alone and stay opaque.
it.each([
  ['an elevated card (Android elevation)', { padding: 12, backgroundColor: '#FFFFFF', elevation: 2 }],
  ['a shadowed card (iOS shadow)', { padding: 12, backgroundColor: '#FFFFFF', shadowColor: '#B64D75', shadowOpacity: 0.12, shadowRadius: 10 }],
])('keeps %s opaque under the finger', async (_label, style) => {
  Platform.OS = 'android';
  await renderTarget(style);
  await grant();
  expect(StyleSheet.flatten(target().props.style)?.opacity).toBeUndefined();
});

it('keeps a shadowed surface opaque on the plain (no-dip) path too', async () => {
  await wrap(
    <PressableFeedback testID="press-target" scale={false} onPress={() => {}} style={{ backgroundColor: '#FFFFFF', elevation: 4 }}>
      <></>
    </PressableFeedback>,
  );
  await grant();
  expect(StyleSheet.flatten(target().props.style)?.opacity).toBeUndefined();
});
