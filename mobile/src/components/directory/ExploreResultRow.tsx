import { View } from 'react-native';
import { PressableFeedback } from '../common/PressableFeedback';
import { AppText } from '../common/AppText';
import { Icon } from '../common/Icon';
import { Photo } from '../common/Photo';
import { SaveButton } from '../common/SaveButton';
import { ExploreAvailability } from './ExploreAvailability';
import { ExploreRating } from './ExploreRating';
import { VerifiedBadge } from './VerifiedBadge';
import { useTheme } from '../../core/theme/theme-provider';
import { formatPrice } from '../../utils/common/format';
import { ratingLong, ratingShort } from '../../utils/reviews/format';
import { artistCardLabel, artistPlaceLine } from '../../utils/directory/format';
import type { ArtistCard } from '../../types/directory/directory';

interface ExploreResultRowProps {
  artist: ArtistCard;
  availability: string | null;
  saved: boolean;
  onToggleSave: () => void;
  onPress: () => void;
}

// The portrait photo. LoadingView's `explore` shape draws the same block.
const PHOTO_WIDTH = 96;
const PHOTO_HEIGHT = 112;

/** Explore's compact result: a portrait photo beside name, rating, place, price and availability, with a save toggle. */
export function ExploreResultRow({ artist, availability, saved, onToggleSave, onPress }: ExploreResultRowProps) {
  const theme = useTheme();
  const radius = theme.radii.xl;
  const photo = artist.photo_urls[0] ?? artist.cover_url ?? artist.photo_url;
  const photoStyle = { width: PHOTO_WIDTH, height: PHOTO_HEIGHT, borderRadius: theme.radii.md };
  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityLabel={artistCardLabel(artist, ratingLong(artist.rating, artist.review_count), availability)}
      onPress={onPress}
      style={[
        { flexDirection: 'row', gap: theme.spacing[3], padding: theme.spacing[2.5], borderRadius: radius, borderWidth: 1, borderColor: theme.colors.separator, backgroundColor: theme.colors.surface },
        theme.shadows.sm,
      ]}
    >
      {photo ? <Photo uri={photo} style={photoStyle} /> : <View style={[photoStyle, { backgroundColor: theme.colors.imageFallback }]} />}
      <View style={{ flex: 1, gap: theme.spacing[0.75], justifyContent: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, flex: 1 }}>
            <AppText variant="body" numberOfLines={1} style={{ fontWeight: '700', color: theme.colors.textPrimary, flexShrink: 1 }}>{artist.business_name}</AppText>
            <VerifiedBadge verified={artist.id_verified} size={theme.typography.body.fontSize} />
          </View>
          <SaveButton name={artist.business_name} saved={saved} onPress={onToggleSave} />
        </View>
        <ExploreRating text={ratingShort(artist.rating, artist.review_count)} />
        <AppText variant="caption" numberOfLines={1} style={{ color: theme.colors.textMuted }}>{artistPlaceLine(artist)}</AppText>
        {artist.from_price_paise === null ? null : (
          <AppText variant="caption" style={{ color: theme.colors.textSecondary }}>
            {'From '}<AppText variant="caption" style={{ fontWeight: '700', color: theme.colors.textPrimary }}>{formatPrice(artist.from_price_paise)}</AppText>
          </AppText>
        )}
        {availability ? <ExploreAvailability label={availability} /> : null}
      </View>
    </PressableFeedback>
  );
}
