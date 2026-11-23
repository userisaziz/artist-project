import { View } from 'react-native';
import { Photo } from '../common/Photo';
import { useTheme } from '../../core/theme/theme-provider';

/** One cell of the featured card's photo mosaic; the cover tint stands in while there is no photo. */
export function ExploreMosaicTile({ uri, flex }: { uri: string | undefined; flex: number }) {
  const theme = useTheme();
  return (
    <View style={{ flex, backgroundColor: theme.colors.imageFallback }}>
      {uri ? <Photo uri={uri} style={{ flex: 1 }} /> : null}
    </View>
  );
}
