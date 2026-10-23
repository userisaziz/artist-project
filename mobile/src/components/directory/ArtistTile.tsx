import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { AppText } from '../common/AppText';
import { Icon } from '../common/Icon';
import { useTheme } from '../../core/theme/theme-provider';
import { formatPrice } from '../../utils/common/format';
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
const HEART = 32;

/** "Locality · 2.1 km": the area (or city) and, after a "Near me" search, the distance. */
export function placeLine(artist: Pick<ArtistCard, 'locality' | 'city' | 'distance_km'>): string {
  return [artist.locality ?? artist.city, artist.distance_km === null ? null : `${artist.distance_km} km`].filter(Boolean).join(' · ');
}

/** Home "Discover artists" tile, as in the design: a tall cover with a heart, then name ✓, rating, place and starting price. */
export function ArtistTile({ artist, saved, onPress, onToggleSave }: ArtistTileProps) {
  const theme = useTheme();
  const bold = theme.typography.eyebrow.fontFamily;
  const category = artist.categories.map((c) => c.name).join(', ');
  const rated = artist.rating !== null && artist.review_count > 0;
  return (
    <View style={{ width: TILE_WIDTH }}>
      <Pressable accessibilityRole="button" accessibilityLabel={artist.business_name} onPress={onPress}>
        <View style={{ height: PHOTO_HEIGHT, borderRadius: PHOTO_RADIUS, overflow: 'hidden', backgroundColor: theme.colors.imageFallback }}>
          {artist.cover_url ? <Image source={{ uri: artist.cover_url }} style={{ flex: 1 }} contentFit="cover" transition={150} /> : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 9 }}>
          <AppText variant="subtitle" numberOfLines={1} style={{ flexShrink: 1, fontFamily: bold, fontSize: 14, lineHeight: 19, color: theme.colors.textPrimary }}>{artist.business_name}</AppText>
          <Icon name="check" size={14} color={theme.colors.brand} label="Verified" />
        </View>
        <AppText variant="caption" numberOfLines={1} style={{ marginTop: 3, color: theme.colors.textMuted }}>
          <AppText variant="caption" style={{ fontFamily: bold, color: theme.colors.brand }}>{rated ? `★ ${(artist.rating ?? 0).toFixed(1)}` : 'New'}</AppText>
          {`${rated ? ` (${artist.review_count})` : ''}${category ? ` · ${category}` : ''}`}
        </AppText>
        <AppText variant="caption" numberOfLines={1} style={{ marginTop: 2, color: theme.colors.textMuted }}>{placeLine(artist)}</AppText>
        {artist.from_price_paise === null ? null : (
          <AppText variant="caption" style={{ marginTop: 3, color: theme.colors.textSecondary }}>
            {'From '}<AppText variant="caption" style={{ fontFamily: bold, color: theme.colors.textPrimary }}>{formatPrice(artist.from_price_paise)}</AppText>
          </AppText>
        )}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={saved ? `Remove ${artist.business_name} from saved` : `Save ${artist.business_name}`}
        accessibilityState={{ selected: saved }}
        onPress={onToggleSave}
        hitSlop={8}
        style={{ position: 'absolute', top: 10, right: 10, width: HEART, height: HEART, borderRadius: HEART / 2, backgroundColor: theme.colors.surface, opacity: 0.92, alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon name="heart" size={16} color={saved ? theme.colors.brand : theme.colors.textPrimary} filled={saved} />
      </Pressable>
    </View>
  );
}
