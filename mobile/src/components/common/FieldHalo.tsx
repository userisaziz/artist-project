import { View } from 'react-native';
import type { ReactNode } from 'react';
import type { ViewStyle } from 'react-native';
import { useTheme } from '../../core/theme/theme-provider';

/** Atelier field chrome: 1pt blush border at rest, 2pt rose (or error red) when active. */
export function fieldBorder(colors: { border: string; borderFocus: string; error: string }, focused: boolean, error: boolean): ViewStyle {
  return { borderWidth: focused || error ? 2 : 1, borderColor: error ? colors.error : focused ? colors.borderFocus : colors.border };
}

/** Soft 4pt blush ring drawn outside a focused field (the prototype's `box-shadow: 0 0 0 4px`), without shifting layout. */
export function FieldHalo({ focused, radius, style, children }: { focused: boolean; radius: number; style?: ViewStyle; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[{ margin: -4, borderWidth: 4, borderRadius: radius + 4, borderColor: focused ? theme.colors.fieldHalo : 'transparent' }, style]}>
      {children}
    </View>
  );
}
