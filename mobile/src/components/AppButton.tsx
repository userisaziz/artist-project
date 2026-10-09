import { ActivityIndicator, Pressable } from 'react-native';
import { useTheme } from '../theme/theme-provider';
import { AppText } from './AppText';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
}

export function AppButton({ label, onPress, variant = 'primary', loading = false, disabled = false }: Props) {
  const theme = useTheme();
  const inactive = disabled || loading;
  const isPrimary = variant === 'primary';
  const isSecondary = variant === 'secondary'; // white pill with a hairline border, e.g. "I already have an account"
  return (
    <Pressable
      accessibilityRole="button"
      onPress={inactive ? undefined : onPress}
      style={({ pressed }) => [
        {
          height: 52,
          borderRadius: theme.radii.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isPrimary ? theme.colors.brand : isSecondary ? theme.colors.surface : 'transparent',
          borderColor: isPrimary ? 'transparent' : isSecondary ? theme.colors.separator : theme.colors.brand,
          borderWidth: isPrimary ? 0 : 1,
          opacity: inactive ? 0.4 : pressed && isPrimary ? 0.85 : 1,
          ...(pressed && !inactive && isPrimary ? { backgroundColor: theme.colors.brandPressed } : {}),
        },
        isPrimary ? theme.shadows.md : {},
      ]}
    >
      {loading ? (
        <ActivityIndicator testID="app-button-spinner" color={isPrimary ? theme.colors.textOnBrand : theme.colors.brand} />
      ) : (
        <AppText variant="button" style={{ color: isPrimary ? theme.colors.textOnBrand : isSecondary ? theme.colors.textPrimary : theme.colors.brand }}>
          {label}
        </AppText>
      )}
    </Pressable>
  );
}
