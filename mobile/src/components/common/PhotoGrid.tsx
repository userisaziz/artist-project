import { Children, type ReactNode } from 'react';
import { View } from 'react-native';
import { useTheme } from '../../core/theme/theme-provider';

interface PhotoGridProps {
  children: ReactNode;
  /** Tiles per row. */
  columns?: number;
  /** Space between tiles, in px. Defaults to the theme's small step. */
  gap?: number;
}

/**
 * Equal tiles, `columns` across, left-aligned. Each tile sits in a cell of exactly 1/columns of the width
 * with half the gap as padding, and the grid pulls itself out by the same half-gap, so the outer edges stay
 * flush. That avoids both failure modes of the obvious layouts: `space-between` pushes a short last row
 * to the two edges, and `width: 31.5%` + a px `gap` overflows on narrow phones and drops to two columns.
 */
export function PhotoGrid({ children, columns = 3, gap }: PhotoGridProps) {
  const theme = useTheme();
  const half = (gap ?? theme.spacing.sm) / 2;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', margin: -half }}>
      {Children.map(children, (child) => (child == null || child === false ? null : (
        <View style={{ width: `${100 / columns}%`, padding: half }}>{child}</View>
      )))}
    </View>
  );
}
