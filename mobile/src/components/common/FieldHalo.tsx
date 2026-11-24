import { View } from 'react-native';
import type { ReactNode } from 'react';
import type { ViewStyle } from 'react-native';
import { useTheme } from '../../core/theme/theme-provider';

const EDGE_WIDTH = 1.5;

/** Field chrome: one constant edge weight, recoloured by state. Widening the border on focus used to shove the
 *  text inside by a point; focus now reads from the colour plus the halo ring below, neither of which moves layout. */
export function fieldBorder(colors: { fieldEdge: string; borderFocus: string; error: string }, focused: boolean, error: boolean): ViewStyle {
  return { borderWidth: EDGE_WIDTH, borderColor: error ? colors.error : focused ? colors.borderFocus : colors.fieldEdge };
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
