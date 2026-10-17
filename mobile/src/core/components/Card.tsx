import { View } from 'react-native';
import type { ReactNode } from 'react';
import type { ViewStyle } from 'react-native';
import { useTheme } from '../theme/theme-provider';

/** White card with the Atelier hairline border. */
export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const theme = useTheme();
  return (
    <View style={[{ borderRadius: 18, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.separator, padding: 14 }, style]}>
      {children}
    </View>
  );
}
