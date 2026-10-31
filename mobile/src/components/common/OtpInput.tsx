import { TextInput } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { haptic } from '../../core/motion/haptics';
import { useReducedMotion } from '../../core/motion/motion';
import { useTheme } from '../../core/theme/theme-provider';
import { FieldHalo, fieldBorder } from './FieldHalo';

/** One leg of the refusal shake. Half the quick timing: at 120ms a leg the buzz reads as a slow sway. */
const SHAKE_STEP_MS = 60;

interface Props {
  length?: number;
  onComplete: (code: string) => void;
  onChange?: (code: string) => void; // joined digits, called on every change (partial codes included)
  error?: boolean;   // parent sets true on 401; toggling back re-arms input
  busy?: boolean;    // parent sets true while verifying
}

export function OtpInput({ length = 6, onComplete, onChange, error = false, busy = false }: Props) {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const theme = useTheme();
  const [digits, setDigits] = useState<string[]>(Array(length).fill(''));
  const inputs = useRef<(TextInput | null)[]>([]);
  const reduced = useReducedMotion();
  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
  const completedFor = useRef<string | null>(null); // onComplete fires once per code, not per keystroke
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!error) return;
    // Intentional: the parent's error flag is the trigger that clears the boxes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDigits(Array(length).fill(''));
    onChangeRef.current?.('');
    completedFor.current = null;
    inputs.current[0]?.focus();
    // The buzz is the half of the refusal that survives reduced motion: it carries the "wrong code"
    // message even when the shake is suppressed.
    haptic('error');
    if (reduced) {
      shake.set(0); // a field that shudders is exactly what reduced motion asks us not to do
      return;
    }
    shake.set(withSequence(
      withTiming(10, { duration: SHAKE_STEP_MS }),
      withTiming(-10, { duration: SHAKE_STEP_MS }),
      withTiming(8, { duration: SHAKE_STEP_MS }),
      withTiming(0, { duration: SHAKE_STEP_MS }),
    ));
  }, [error, length, reduced, shake]);

  const update = (next: string[]) => {
    if (next.some((d) => d === '')) completedFor.current = null; // incomplete -> re-arm onComplete
    setDigits(next);
    onChange?.(next.join(''));
  };

  const tryComplete = (next: string[]) => {
    const code = next.join('');
    if (next.every((d) => d !== '') && completedFor.current !== code) {
      completedFor.current = code;
      onComplete(code);
    }
  };

  const setDigit = (i: number, raw: string) => {
    const clean = raw.replace(/\D/g, '');
    const old = digits[i];
    if (old && clean.length === 2 && clean.includes(old)) {  // overtype into a filled box: keep the new char only
      const next = [...digits];
      next[i] = clean.startsWith(old) ? clean[1] : clean[0];
      update(next);
      if (i < length - 1) inputs.current[i + 1]?.focus();
      tryComplete(next);
      return;
    }
    if (clean.length > 1) {  // autofill/paste lands as one string in the focused box — distribute it
      const next = Array(length).fill('');
      clean.slice(0, length).split('').forEach((c, idx) => { next[idx] = c; });
      update(next);
      inputs.current[Math.min(clean.length, length) - 1]?.focus();
      tryComplete(next);
      return;
    }
    const next = [...digits];
    next[i] = clean;
    update(next);
    if (clean && i < length - 1) inputs.current[i + 1]?.focus();
    tryComplete(next);
  };

  const onBackspace = (i: number) => {
    const next = [...digits];
    if (next[i]) next[i] = '';
    else if (i > 0) { next[i - 1] = ''; inputs.current[i - 1]?.focus(); }
    update(next);
  };

  return (
    <Animated.View
      style={[{ gap: theme.spacing[1.75], flexDirection: 'row' }, shakeStyle]}
    >
      {digits.map((d, i) => (
        <FieldHalo key={i} focused={focusedIndex === i && !error} radius={theme.radii.md} style={{ flex: 1, minWidth: 0 }}>
        <TextInput
          testID={`otp-box-${i}`}
          cursorColor={theme.colors.brand}
          selectionColor={`${theme.colors.brand}55`}
          selectionHandleColor={theme.colors.brand}
          ref={(el) => { inputs.current[i] = el; }}
          value={d}
          onChangeText={(v) => setDigit(i, v)}
          onKeyPress={(e) => { if (e.nativeEvent.key === 'Backspace') onBackspace(i); }}
          onFocus={() => setFocusedIndex(i)}
          onBlur={() => setFocusedIndex((f) => (f === i ? null : f))}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          autoFocus={i === 0}
          editable={!busy}
          maxLength={length - i} // first box accepts a paste; later boxes accept the remainder
          style={{
            height: 56, // boxes share the row (flex on the halo) and span the same width as the button below
            borderRadius: theme.radii.md,
            ...fieldBorder(theme.colors, focusedIndex === i, error),
            backgroundColor: theme.colors.inputBackground,
            textAlign: 'center',
            fontSize: theme.typography.otpDigit.fontSize,
            fontFamily: theme.typography.otpDigit.fontFamily,
            color: theme.colors.textPrimary,
          }}
        />
        </FieldHalo>
      ))}
    </Animated.View>
  );
}
