import { View } from 'react-native';
import { PressableFeedback } from '../common/PressableFeedback';
import { AppText } from '../common/AppText';
import { Icon } from '../common/Icon';
import { SaveButton } from '../common/SaveButton';
import { ExploreAvailability } from './ExploreAvailability';
import { ExploreMosaicTile } from './ExploreMosaicTile';
import { ExploreRating } from './ExploreRating';
import { useTheme } from '../../core/theme/theme-provider';
import { formatPrice } from '../../utils/common/format';
import { ratingLong, ratingShort } from '../../utils/reviews/format';
import { artistCardLabel, artistPlaceLine } from '../../utils/directory/format';
import type { ArtistCard } from '../../types/directory/directory';

interface ExploreFeaturedCardProps {
  artist: ArtistCard;
  /** "Available tomorrow" etc.; null hides the line. */
  availability: string | null;
  saved: boolean;
  onToggleSave: () => void;
  onPress: () => void;
}

/** Height of one stacked mosaic cell; the tall cell spans two. LoadingView's `explore` shape mirrors it. */
const MOSAIC_ROW = 80;
const MOSAIC_TILES = 3;

/** Explore's first result: a three-photo mosaic (one tall, two stacked) over name, rating, place and price. With
 *  fewer than three photos the first one fills the whole width rather than leaving empty cells. */
export function ExploreFeaturedCard({ artist, availability, saved, onToggleSave, onPress }: ExploreFeaturedCardProps) {
  const theme = useTheme();
  const radius = theme.radii.xl;
  const seam = theme.spacing[0.5];
  const photos = artist.photo_urls.length ? artist.photo_urls : [artist.cover_url].filter((u): u is string => !!u);
  const nameSize = theme.typography.subtitle.fontSize;
  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityLabel={artistCardLabel(artist, ratingLong(artist.rating, artist.review_count), availability)}
      onPress={onPress}
      style={[{ borderRadius: radius, borderWidth: 1, borderColor: theme.colors.separator, backgroundColor: theme.colors.surface }, theme.shadows.sm]}
    >
      {/* Clipping lives on an inner view: on iOS `overflow: hidden` on the lifted surface would cut its shadow off. */}
      <View style={{ borderRadius: radius, overflow: 'hidden' }}>
        <View style={{ height: MOSAIC_ROW * 2 + seam, flexDirection: 'row', gap: seam }}>
          {photos.length >= MOSAIC_TILES ? (
            <>
              <ExploreMosaicTile uri={photos[0]} flex={2} />
              <View style={{ flex: 1, gap: seam }}>
                <ExploreMosaicTile uri={photos[1]} flex={1} />
                <ExploreMosaicTile uri={photos[2]} flex={1} />
              </View>
            </>
          ) : <ExploreMosaicTile uri={photos[0]} flex={1} />}
        </View>
        <View style={{ paddingHorizontal: theme.spacing[3.5], paddingVertical: theme.spacing[3] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, flex: 1 }}>
              <AppText variant="subtitle" numberOfLines={1} style={{ fontWeight: '700', color: theme.colors.textPrimary, flexShrink: 1 }}>{artist.business_name}</AppText>
              <Icon name="verified" size={nameSize} color={theme.colors.brand} label="Verified" />
            </View>
            <SaveButton name={artist.business_name} saved={saved} onPress={onToggleSave} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, marginTop: theme.spacing[0.75] }}>
            <ExploreRating text={ratingShort(artist.rating, artist.review_count)} />
            <AppText variant="caption" style={{ color: theme.colors.textMuted }}>·</AppText>
            <AppText variant="caption" numberOfLines={1} style={{ color: theme.colors.textMuted, flexShrink: 1 }}>{artistPlaceLine(artist)}</AppText>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: theme.spacing[1.5] }}>
            {artist.from_price_paise === null ? <View /> : (
              <AppText variant="caption" style={{ color: theme.colors.textSecondary }}>
                {'From '}<AppText variant="caption" style={{ fontWeight: '700', color: theme.colors.textPrimary }}>{formatPrice(artist.from_price_paise)}</AppText>
              </AppText>
            )}
            {availability ? <ExploreAvailability label={availability} /> : null}
          </View>
        </View>
      </View>
    </PressableFeedback>
  );
}
