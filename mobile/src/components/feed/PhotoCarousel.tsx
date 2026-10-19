import { useState } from 'react';
import { FlatList, View, useWindowDimensions } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { AppText } from '../common/AppText';
import { Photo } from '../common/Photo';
import { useTheme } from '../../core/theme/theme-provider';
import type { PostPhoto } from '../../types/feed/feed';

const TALLEST = 5 / 4; // portrait 4:5, the prototype's post frame
const WIDEST = 1 / 1.91;

/** Swipeable photos at the first photo's shape (clamped to 4:5 … 1.91:1), with a "1 / 4" counter. */
export function PhotoCarousel({ photos, label }: { photos: PostPhoto[]; label: string }) {
  const theme = useTheme();
  const window = useWindowDimensions();
  const [measured, setMeasured] = useState<number | null>(null);
  const width = measured ?? window.width;
  const [index, setIndex] = useState(0);
  const first = photos[0];
  const ratio = first && first.width > 0 && first.height > 0 ? Math.min(TALLEST, Math.max(WIDEST, first.height / first.width)) : TALLEST;
  const onLayout = (e: LayoutChangeEvent) => setMeasured(e.nativeEvent.layout.width);
  const height = Math.round(width * ratio);
  return (
    <View onLayout={onLayout}>
      <FlatList
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        data={photos}
        keyExtractor={(p, i) => `${p.url}:${i}`}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item, index: i }) => <Photo uri={item.url} label={`${label}, photo ${i + 1} of ${photos.length}`} style={{ width, height }} />}
      />
      {photos.length > 1 ? (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', top: 12, right: 12, borderRadius: theme.radii.pill, backgroundColor: theme.colors.photoScrim, paddingHorizontal: 10, paddingVertical: 3 }}>
          <AppText variant="caption" style={{ color: theme.colors.textOnBrand }}>{`${index + 1} / ${photos.length}`}</AppText>
        </View>
      ) : null}
    </View>
  );
}
