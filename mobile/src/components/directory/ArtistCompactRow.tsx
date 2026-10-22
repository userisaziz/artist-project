import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { AppText } from '../common/AppText';
import { useTheme } from '../../core/theme/theme-provider';
import { formatPrice } from '../../utils/common/format';
import { ratingShort } from '../../utils/reviews/format';
import type { ArtistCard } from '../../types/directory/directory';
import { categoryLine } from './ArtistCardView';

interface ArtistCompactRowProps {
  artist: ArtistCard;
  onPress: () => void;
}

const THUMB = 68;

/** Home "Top rated": a small square photo beside name, rating, category, city and starting price. */
export function ArtistCompactRow({ artist, onPress }: ArtistCompactRowProps) {
  const theme = useTheme();
  const thumb = artist.cover_url ?? artist.photo_url;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{ flexDirection: 'row', gap: 12, padding: 10, borderRadius: 16, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.separator }}
    >
      <View style={{ width: THUMB, height: THUMB, borderRadius: theme.radii.md, overflow: 'hidden', backgroundColor: theme.colors.imageFallback }}>
        {thumb ? <Image source={{ uri: thumb }} style={{ flex: 1 }} contentFit="cover" transition={150} /> : null}
      </View>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <AppText variant="subtitle" numberOfLines={1} style={{ fontSize: 14, lineHeight: 19, color: theme.colors.textPrimary }}>{artist.business_name}</AppText>
        <AppText variant="caption" numberOfLines={1} style={{ marginTop: 3, color: theme.colors.textMuted }}>
          <AppText variant="caption" style={{ fontWeight: '700', color: theme.colors.brand }}>{ratingShort(artist.rating, artist.review_count)}</AppText>
          {` · ${categoryLine(artist)}`}
        </AppText>
        {artist.from_price_paise === null ? null : (
          <AppText variant="caption" style={{ marginTop: 3, color: theme.colors.textSecondary }}>
            {'From '}<AppText variant="caption" style={{ fontWeight: '700', color: theme.colors.textPrimary }}>{formatPrice(artist.from_price_paise)}</AppText>
          </AppText>
        )}
      </View>
    </Pressable>
  );
}
