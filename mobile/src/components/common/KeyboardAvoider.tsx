import type { ComponentProps } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';

/**
 * The app's only keyboard-reservation frame.
 *
 * Android builds edge-to-edge here (Expo SDK 57 enables it by default, and every prebuild writes
 * `edgeToEdgeEnabled=true`), so `windowSoftInputMode="adjustResize"` no longer shrinks the window for the
 * IME — the keyboard just covers the bottom of a full-height frame, which is where the Send code / Verify
 * footer lives. iOS never resized for the keyboard either. Both therefore pad by one keyboard height.
 *
 * Padding cannot double-count: KeyboardAvoidingView measures its own frame and reserves only the overlap
 * (`frame.height - keyboard.screenY`, clamped at 0), so a window the OS *did* shrink yields zero.
 *
 * Web has no soft keyboard, so it stays behaviourless.
 *
 * Screens and `Modal`-hosted sheets need the same rule, so there is exactly one place to decide it.
 */
export function KeyboardAvoider({ style, ...rest }: ComponentProps<typeof KeyboardAvoidingView>) {
  return (
    <KeyboardAvoidingView
      {...rest}
      behavior={Platform.OS === 'web' ? undefined : 'padding'}
      style={[{ flex: 1 }, style]}
    />
  );
}
