import { Image } from 'expo-image';
import { StyleSheet, type StyleProp, type ImageStyle } from 'react-native';
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
  // The size the image is actually drawn at. Handing it to the native side lets it decode a smaller
  // bitmap: a 1024 px original is not decoded in full to paint a 44 px tile.
  const flat = StyleSheet.flatten(style);
  const source = {
    uri,
    ...(typeof flat?.width === 'number' ? { width: flat.width } : {}),
    ...(typeof flat?.height === 'number' ? { height: flat.height } : {}),
  };
  return (
    <Image
      source={source}
      contentFit="cover"
      transition={150}
      cachePolicy="memory-disk"
      // A recycled list row must not keep showing the row it used to be. The key changes with the
      // image, which is what makes the native view clear itself.
      recyclingKey={uri}
      accessible={!!label}
      accessibilityLabel={label}
      style={[{ backgroundColor: theme.colors.imageFallback }, style]}
    />
  );
}
