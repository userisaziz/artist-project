import { View } from 'react-native';
import { PressableFeedback } from '../common/PressableFeedback';
import { Image } from 'expo-image';
import { AppText } from '../common/AppText';
import { Icon } from '../common/Icon';
import { SaveButton } from '../common/SaveButton';
import { useTheme } from '../../core/theme/theme-provider';
import { formatPrice } from '../../utils/common/format';
import { ratingShort } from '../../utils/reviews/format';
import { artistPlaceLine } from '../../utils/directory/format';
import type { ArtistCard } from '../../types/directory/directory';

interface ExploreFeaturedCardProps {
  artist: ArtistCard;
  /** "Available tomorrow" etc.; null hides the line. */
  availability: string | null;
  saved: boolean;
  onToggleSave: () => void;
  onPress: () => void;
}

const MOSAIC_ROW = 80;

/** Explore's first result: a three-photo mosaic (one tall, two stacked) over name, rating, place and price. */
export function ExploreFeaturedCard({ artist, availability, saved, onToggleSave, onPress }: ExploreFeaturedCardProps) {
  const theme = useTheme();
  const photos = artist.photo_urls.length ? artist.photo_urls : [artist.cover_url].filter((u): u is string => !!u);
  const tile = (uri: string | undefined, flex: number) => (
    <View style={{ flex, backgroundColor: theme.colors.imageFallback }}>
      {uri ? <Image source={{ uri }} style={{ flex: 1 }} contentFit="cover" transition={150} /> : null}
    </View>
  );
  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityLabel={`${artist.business_name}, ${ratingShort(artist.rating, artist.review_count)}`}
      onPress={onPress}
      style={{ borderRadius: 18, borderWidth: 1, borderColor: theme.colors.separator, overflow: 'hidden', backgroundColor: theme.colors.surface }}
    >
      <View style={{ height: MOSAIC_ROW * 2 + 2, flexDirection: 'row', gap: 2 }}>
        {tile(photos[0], 2)}
        <View style={{ flex: 1, gap: 2 }}>
          {tile(photos[1], 1)}
          {tile(photos[2], 1)}
        </View>
      </View>
      <View style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
            <AppText variant="subtitle" numberOfLines={1} style={{ fontSize: 15, lineHeight: 20, fontWeight: '700', color: theme.colors.textPrimary, flexShrink: 1 }}>{artist.business_name}</AppText>
            <Icon name="verified" size={15} color={theme.colors.brand} label="Verified" />
          </View>
          <SaveButton name={artist.business_name} saved={saved} onPress={onToggleSave} />
        </View>
        <AppText variant="caption" numberOfLines={1} style={{ marginTop: 3, color: theme.colors.textMuted }}>
          <AppText variant="caption" style={{ fontWeight: '700', color: theme.colors.brand }}>{`★ ${ratingShort(artist.rating, artist.review_count)}`}</AppText>
          {' · '}
          <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{artistPlaceLine(artist)}</AppText>
        </AppText>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
          {artist.from_price_paise === null ? <View /> : (
            <AppText variant="caption" style={{ color: theme.colors.textSecondary }}>
              {'From '}<AppText variant="caption" style={{ fontWeight: '700', color: theme.colors.textPrimary }}>{formatPrice(artist.from_price_paise)}</AppText>
            </AppText>
          )}
          {availability ? <AppText variant="caption" style={{ fontWeight: '600', color: theme.colors.confirmedInk }}>{`● ${availability}`}</AppText> : null}
        </View>
      </View>
    </PressableFeedback>
  );
}
