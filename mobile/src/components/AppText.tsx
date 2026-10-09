import { Text } from 'react-native';
import type { TextProps, TextStyle } from 'react-native';
import { useTheme } from '../theme/theme-provider';
import type { Theme } from '../theme/types';

type Variant = keyof Theme['typography'];

export function AppText({ variant = 'body', style, ...rest }: TextProps & { variant?: Variant }) {
  const theme = useTheme();
  const variantStyle = theme.typography[variant] as TextStyle;
  return <Text {...rest} style={[variantStyle, style]} />;
}

/** Italic rose emphasis inside a serif headline, e.g. "Discover your <Accent>artist</Accent>". Inherits size from the parent text. */
export function Accent({ children, color, light = false }: { children: string; color?: string; light?: boolean }) {
  const theme = useTheme();
  const family = (light ? theme.typography.accentLight : theme.typography.accent).fontFamily;
  return <Text style={{ fontFamily: family, color: color ?? theme.colors.brand }}>{children}</Text>;
}
