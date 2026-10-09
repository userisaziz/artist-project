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
