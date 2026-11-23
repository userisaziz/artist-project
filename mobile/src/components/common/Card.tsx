import { View } from 'react-native';
import type { ReactNode } from 'react';
import type { ViewStyle } from 'react-native';
import { useTheme } from '../../core/theme/theme-provider';
import { GlossSheen } from './GlossSheen';

/** White card with the Atelier hairline border, a soft rose lift, and a faint gloss along its top edge. */
export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const theme = useTheme();
  return (
    <View style={[{ borderRadius: theme.radii.xl, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.separator, padding: theme.spacing[3.5] }, theme.shadows.sm, style]}>
      <GlossSheen radius={theme.radii.xl} variant="card" />
      {children}
    </View>
  );
}
