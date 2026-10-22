import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { AppText } from '../common/AppText';
import { SaveButton } from '../common/SaveButton';
import { useTheme } from '../../core/theme/theme-provider';
import { formatPrice } from '../../utils/common/format';
import { ratingShort } from '../../utils/reviews/format';
import type { ArtistCard } from '../../types/directory/directory';

interface ArtistTileProps {
  artist: ArtistCard;
  saved: boolean;
  onPress: () => void;
  onToggleSave: () => void;
}

const TILE_WIDTH = 172;
const PHOTO_HEIGHT = 214;
const PHOTO_RADIUS = 16;

/** Home "Discover artists" tile: a tall cover with a save button, then name, rating, category, city and starting price. */
export function ArtistTile({ artist, saved, onPress, onToggleSave }: ArtistTileProps) {
  const theme = useTheme();
  const category = artist.categories.map((c) => c.name).join(', ');
  return (
    <View style={{ width: TILE_WIDTH }}>
      <Pressable accessibilityRole="button" accessibilityLabel={artist.business_name} onPress={onPress}>
        <View style={{ height: PHOTO_HEIGHT, borderRadius: PHOTO_RADIUS, overflow: 'hidden', backgroundColor: theme.colors.imageFallback }}>
          {artist.cover_url ? <Image source={{ uri: artist.cover_url }} style={{ flex: 1 }} contentFit="cover" transition={150} /> : null}
        </View>
        <AppText variant="subtitle" numberOfLines={1} style={{ fontSize: 14, lineHeight: 19, color: theme.colors.textPrimary, marginTop: 9 }}>{artist.business_name}</AppText>
        <AppText variant="caption" numberOfLines={1} style={{ marginTop: 3, color: theme.colors.textMuted }}>
          <AppText variant="caption" style={{ fontWeight: '700', color: theme.colors.brand }}>{ratingShort(artist.rating, artist.review_count)}</AppText>
          {category ? ` · ${category}` : ''}
        </AppText>
        <AppText variant="caption" numberOfLines={1} style={{ marginTop: 2, color: theme.colors.textMuted }}>{artist.city}</AppText>
        {artist.from_price_paise === null ? null : (
          <AppText variant="caption" style={{ marginTop: 3, color: theme.colors.textSecondary }}>
            {'From '}<AppText variant="caption" style={{ fontWeight: '700', color: theme.colors.textPrimary }}>{formatPrice(artist.from_price_paise)}</AppText>
          </AppText>
        )}
      </Pressable>
      <View style={{ position: 'absolute', top: 10, right: 10, width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center' }}>
        <SaveButton name={artist.business_name} saved={saved} onPress={onToggleSave} />
      </View>
    </View>
  );
}
