import { View } from 'react-native';
import { Image } from 'expo-image';
import { AppText } from './AppText';
import { useTheme } from '../../core/theme/theme-provider';

interface AvatarProps {
  uri: string | null | undefined;
  name: string;
  size?: number;
}

/** Round photo, or the name's initial on blush when there is none. */
export function Avatar({ uri, name, size = 44 }: AvatarProps) {
  const theme = useTheme();
  const box = { width: size, height: size, borderRadius: size / 2 };
  if (uri)
    return (
      <Image
        // The avatar's own size, so the native side decodes a bitmap that fits instead of the
        // full-size original behind it.
        source={{ uri, width: size, height: size }}
        style={box}
        contentFit="cover"
        cachePolicy="memory-disk"
        // Changes with the image, so a recycled list row drops the face it used to show.
        recyclingKey={uri}
        accessibilityIgnoresInvertColors
      />
    );
  return (
    <View style={[box, { backgroundColor: theme.colors.brandSoft, alignItems: 'center', justifyContent: 'center' }]}>
      <AppText variant="subtitle" style={{ fontSize: size * 0.4, lineHeight: size * 0.5, color: theme.colors.brand }}>
        {name.slice(0, 1).toUpperCase()}
      </AppText>
    </View>
  );
}
