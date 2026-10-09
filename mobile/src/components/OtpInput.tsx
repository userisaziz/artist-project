import { Animated, TextInput } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { useTheme } from '../theme/theme-provider';

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
  const [shake] = useState(() => new Animated.Value(0));
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
    shake.setValue(0);
    Animated.sequence([
      Animated.timing(shake, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }, [error, length, shake]);

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
      style={{ transform: [{ translateX: shake }], gap: theme.spacing.sm, flexDirection: 'row' }}
    >
      {digits.map((d, i) => (
        <TextInput
          key={i}
          testID={`otp-box-${i}`}
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
            flex: 1, minWidth: 0, // boxes share the row and span the same width as the button below
            height: 57, // same height as the phone field
            borderRadius: theme.radii.md,
            borderWidth: 1.5,
            borderColor: error ? theme.colors.error : focusedIndex === i ? theme.colors.borderFocus : theme.colors.border,
            backgroundColor: theme.colors.inputBackground,
            textAlign: 'center',
            fontSize: 22,
            fontFamily: theme.typography.subtitle.fontFamily,
            color: theme.colors.textPrimary,
          }}
        />
      ))}
    </Animated.View>
  );
}
