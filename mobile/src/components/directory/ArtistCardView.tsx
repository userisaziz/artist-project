import { View } from 'react-native';
import { PressableFeedback } from '../common/PressableFeedback';
import { Image } from 'expo-image';
import { AppText } from '../common/AppText';
import { Avatar } from '../common/Avatar';
import { useTheme } from '../../core/theme/theme-provider';
import { formatPrice } from '../../utils/common/format';
import { ratingShort } from '../../utils/reviews/format';
import type { ArtistCard } from '../../types/directory/directory';

interface ArtistCardViewProps {
  artist: ArtistCard;
  onPress: () => void;
  /** `tile`: the Home carousel's tall cover card; `row`: a full-width list card. */
  variant?: 'tile' | 'row';
}

const TILE_WIDTH = 200;

/** "Mehendi, Makeup · BTM Layout, Bangalore"; just the city for artists who haven't set their area yet. */
export function categoryLine(artist: Pick<ArtistCard, 'categories' | 'city' | 'locality'>): string {
  const area = artist.locality?.trim();
  const place = area ? `${area}, ${artist.city}` : artist.city;
  return [artist.categories.map((c) => c.name).join(', '), place].filter(Boolean).join(' · ');
}

export function ArtistCardView({ artist, onPress, variant = 'row' }: ArtistCardViewProps) {
  const theme = useTheme();
  const from = artist.from_price_paise === null ? null : `From ${formatPrice(artist.from_price_paise)}`;
  const tile = variant === 'tile';
  return (
    <PressableFeedback
      accessibilityRole="button"
      onPress={onPress}
      style={{ width: tile ? TILE_WIDTH : undefined, borderRadius: theme.radii.card, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.separator, overflow: 'hidden' }}
    >
      <View style={{ height: tile ? 220 : 150, backgroundColor: theme.colors.imageFallback }}>
        {artist.cover_url ? <Image source={{ uri: artist.cover_url }} style={{ flex: 1 }} contentFit="cover" transition={150} /> : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 }}>
        <Avatar uri={artist.photo_url} name={artist.business_name} size={38} />
        <View style={{ flex: 1 }}>
          <AppText variant="subtitle" numberOfLines={1} style={{ fontSize: 14.5, lineHeight: 20, color: theme.colors.textPrimary }}>{artist.business_name}</AppText>
          <AppText variant="caption" numberOfLines={1} style={{ color: theme.colors.textMuted }}>{categoryLine(artist)}</AppText>
          <AppText variant="caption" style={{ color: theme.colors.brand }}>{ratingShort(artist.rating, artist.review_count)}</AppText>
        </View>
        {from && !tile ? <AppText variant="label" style={{ color: theme.colors.brand }}>{from}</AppText> : null}
      </View>
      {from && tile ? <AppText variant="label" style={{ color: theme.colors.brand, paddingHorizontal: 12, paddingBottom: 12, marginTop: -4 }}>{from}</AppText> : null}
    </PressableFeedback>
  );
}
