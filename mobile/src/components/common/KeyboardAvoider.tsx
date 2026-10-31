import type { ComponentProps } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';

/**
 * The app's only keyboard-reservation frame.
 *
 * Android builds with `windowSoftInputMode="adjustResize"` (Expo's default `softwareKeyboardLayoutMode:
 * "resize"`, and no edge-to-edge override), so the OS already takes the keyboard's height away from the
 * window before React Native lays out. A `behavior` on top of that subtracts it a second time: 'height'
 * collapses the frame to `initial - keyboard` with `flex: 0`, and 'padding' lifts the content by another
 * keyboard height — the form jumps off-screen and the scroll area shrinks twice. iOS resizes nothing, so
 * it is the only platform that has to pad.
 *
 * Screens and `Modal`-hosted sheets need the same rule, so there is exactly one place to decide it.
 */
export function KeyboardAvoider({ style, ...rest }: ComponentProps<typeof KeyboardAvoidingView>) {
  return (
    <KeyboardAvoidingView
      {...rest}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[{ flex: 1 }, style]}
    />
  );
}
