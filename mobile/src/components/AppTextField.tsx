import { View, TextInput } from 'react-native';
import type { TextInputProps } from 'react-native';
import { useState } from 'react';
import { useTheme } from '../theme/theme-provider';
import { AppText } from './AppText';

interface Props extends TextInputProps {
  label: string;
  error?: string | null;
}

export function AppTextField({ label, error, style, ...rest }: Props) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ marginBottom: theme.spacing.md }}>
      <AppText variant="caption" style={{ color: theme.colors.textSecondary, marginBottom: theme.spacing.xs }}>
        {label}
      </AppText>
      <TextInput
        {...rest}
        onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
        style={[
          {
            height: 52,
            borderRadius: theme.radii.md,
            borderWidth: focused ? 2 : 1,
            borderColor: error ? theme.colors.error : focused ? theme.colors.borderFocus : theme.colors.border,
            backgroundColor: theme.colors.inputBackground,
            color: theme.colors.textPrimary,
            paddingHorizontal: theme.spacing.md,
            fontSize: theme.typography.body.fontSize,
            fontFamily: theme.typography.body.fontFamily,
          },
          style,
        ]}
      />
      {error ? (
        <AppText variant="caption" style={{ color: theme.colors.error, marginTop: theme.spacing.xs }}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}
