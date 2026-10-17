import { View, TextInput } from 'react-native';
import type { TextInputProps } from 'react-native';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useTheme } from '../../core/theme/theme-provider';
import { AppText } from './AppText';
import { FieldHalo, fieldBorder } from './FieldHalo';

interface Props extends TextInputProps {
  label: string;
  error?: string | null;
  /** Placeholder-only field (the label stays as the accessibility label). */
  hideLabel?: boolean;
  /** Small element shown at the right edge while the field is empty, e.g. an "Optional" pill. */
  accessory?: ReactNode;
}

/** Labelled input in the Atelier field style (same box as the phone field). The label doubles as the accessibility label. */
export function AppTextField({ label, error, hideLabel = false, accessory, style, ...rest }: Props) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View>
      {hideLabel ? null : (
        <AppText variant="label" style={{ color: theme.colors.textSecondary, marginBottom: theme.spacing.sm }}>
          {label}
        </AppText>
      )}
      <FieldHalo focused={focused && !error} radius={theme.radii.md}>
      <TextInput
        accessibilityLabel={label}
        cursorColor={theme.colors.brand}
        selectionColor={`${theme.colors.brand}55`}
        selectionHandleColor={theme.colors.brand}
        placeholderTextColor={theme.colors.textMuted}
        {...rest}
        onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
        style={[
          {
            height: 50,
            borderRadius: theme.radii.md,
            ...fieldBorder(theme.colors, focused, !!error),
            backgroundColor: theme.colors.inputBackground,
            color: theme.colors.textPrimary,
            paddingHorizontal: 12,
            fontSize: theme.typography.subtitle.fontSize,
            fontFamily: theme.typography.body.fontFamily,
          },
          style,
        ]}
      />
      {accessory && !rest.value ? (
        <View pointerEvents="none" style={{ position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' }}>{accessory}</View>
      ) : null}
      </FieldHalo>
      {error ? (
        <AppText variant="caption" style={{ color: theme.colors.error, marginTop: theme.spacing.sm }}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}
