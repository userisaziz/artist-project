import { Image } from 'expo-image';
import type { StyleProp, ImageStyle } from 'react-native';
import { useTheme } from '../../core/theme/theme-provider';

interface PhotoProps {
  uri: string;
  style: StyleProp<ImageStyle>;
  /** Read by screen readers; omit for decorative images. */
  label?: string;
}

/** The app's image: cover-fit, cached, fading in over the theme's placeholder tint. */
export function Photo({ uri, style, label }: PhotoProps) {
  const theme = useTheme();
  return (
    <Image
      source={{ uri }}
      contentFit="cover"
      transition={150}
      accessible={!!label}
      accessibilityLabel={label}
      style={[{ backgroundColor: theme.colors.imageFallback }, style]}
    />
  );
}
