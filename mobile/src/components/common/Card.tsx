import { View } from 'react-native';
import type { ReactNode } from 'react';
import type { ViewStyle } from 'react-native';
import { useTheme } from '../../core/theme/theme-provider';

/** White card with the Atelier hairline border and a soft cherry lift. */
export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const theme = useTheme();
  return (
    <View style={[{ borderRadius: theme.radii.xl, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.separator, padding: theme.spacing[3.5] }, theme.shadows.sm, style]}>
      {children}
    </View>
  );
}
