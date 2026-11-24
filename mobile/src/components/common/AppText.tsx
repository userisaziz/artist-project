import { Text } from 'react-native';
import type { TextProps, TextStyle } from 'react-native';
import { useTheme } from '../../core/theme/theme-provider';
import type { Theme } from '../../core/theme/types';
import { typeScale } from '../../core/theme/tokens/typography';

type Variant = keyof Theme['typography'];

/** The sizes one variant offers, read off `typeScale`: `never` for a variant the type scale gives no second size to,
 *  so `size` cannot be used to ask for a value that isn't a token. */
type Size<V extends Variant> = V extends keyof typeof typeScale ? keyof (typeof typeScale)[V] : never;

/**
 * The app's text. `variant` is the role; `size` picks a rung of that role's own scale — there is no raw
 * `fontSize`, because a size with no token behind it is the number the next screen will retype.
 */
export function AppText<V extends Variant = 'body'>({ variant = 'body' as V, size, style, ...rest }: TextProps & { variant?: V; size?: Size<V> }) {
  const theme = useTheme();
  const token = size ? typeScale[variant as keyof typeof typeScale][size as never] : variant;
  const variantStyle = theme.typography[token] as TextStyle;
  return <Text {...rest} style={[variantStyle, style]} />;
}

/** Italic rose emphasis inside a headline, e.g. "Discover your <Accent>artist</Accent>". Inherits size from the parent text. */
export function Accent({ children, color, light = false }: { children: string; color?: string; light?: boolean }) {
  const theme = useTheme();
  const family = (light ? theme.typography.accentLight : theme.typography.accent).fontFamily;
  return <Text style={{ fontFamily: family, color: color ?? theme.colors.brand }}>{children}</Text>;
}
