import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { AppText } from '../common/AppText';
import { Icon } from '../common/Icon';
import { useTheme } from '../../core/theme/theme-provider';
import { formatPrice } from '../../utils/common/format';
import { ratingShort } from '../../utils/reviews/format';
import { artistPlaceLine } from '../../utils/directory/format';
import type { ArtistCard } from '../../types/directory/directory';

interface ExploreResultRowProps {
  artist: ArtistCard;
  availability: string | null;
  onPress: () => void;
}

const PHOTO_WIDTH = 96;
const PHOTO_HEIGHT = 112;

/** Explore's compact result: a portrait photo beside name, rating, place, price and availability. */
export function ExploreResultRow({ artist, availability, onPress }: ExploreResultRowProps) {
  const theme = useTheme();
  const photo = artist.photo_urls[0] ?? artist.cover_url ?? artist.photo_url;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${artist.business_name}, ${ratingShort(artist.rating, artist.review_count)}`}
      onPress={onPress}
      style={{ flexDirection: 'row', gap: 12, padding: 10, borderRadius: 18, borderWidth: 1, borderColor: theme.colors.separator, backgroundColor: theme.colors.surface }}
    >
      <View style={{ width: PHOTO_WIDTH, height: PHOTO_HEIGHT, borderRadius: theme.radii.md, overflow: 'hidden', backgroundColor: theme.colors.imageFallback }}>
        {photo ? <Image source={{ uri: photo }} style={{ flex: 1 }} contentFit="cover" transition={150} /> : null}
      </View>
      <View style={{ flex: 1, gap: 3, justifyContent: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <AppText variant="subtitle" numberOfLines={1} style={{ fontSize: 14, lineHeight: 19, fontWeight: '700', color: theme.colors.textPrimary, flexShrink: 1 }}>{artist.business_name}</AppText>
          <Icon name="verified" size={14} color={theme.colors.brand} label="Verified" />
        </View>
        <AppText variant="caption" style={{ fontWeight: '700', color: theme.colors.brand }}>{`★ ${ratingShort(artist.rating, artist.review_count)}`}</AppText>
        <AppText variant="caption" numberOfLines={1} style={{ color: theme.colors.textMuted }}>{artistPlaceLine(artist)}</AppText>
        {artist.from_price_paise === null ? null : (
          <AppText variant="caption" style={{ color: theme.colors.textSecondary }}>
            {'From '}<AppText variant="caption" style={{ fontWeight: '700', color: theme.colors.textPrimary }}>{formatPrice(artist.from_price_paise)}</AppText>
          </AppText>
        )}
        {availability ? <AppText variant="caption" style={{ fontWeight: '600', color: theme.colors.confirmedInk }}>{`● ${availability}`}</AppText> : null}
      </View>
    </Pressable>
  );
}
