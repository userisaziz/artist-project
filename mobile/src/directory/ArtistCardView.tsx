import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { AppText } from '../components/AppText';
import { Avatar } from '../components/Avatar';
import { useTheme } from '../theme/theme-provider';
import { formatPrice } from '../artist/format';
import type { ArtistCard } from '../api/types';

interface ArtistCardViewProps {
  artist: ArtistCard;
  onPress: () => void;
  /** `tile`: the Home carousel's tall cover card; `row`: a full-width list card. */
  variant?: 'tile' | 'row';
}

const TILE_WIDTH = 200;

export function categoryLine(artist: Pick<ArtistCard, 'categories' | 'city'>): string {
  return [artist.categories.map((c) => c.name).join(', '), artist.city].filter(Boolean).join(' · ');
}

export function ArtistCardView({ artist, onPress, variant = 'row' }: ArtistCardViewProps) {
  const theme = useTheme();
  const from = artist.from_price_paise === null ? null : `From ${formatPrice(artist.from_price_paise)}`;
  const tile = variant === 'tile';
  return (
    <Pressable
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
        </View>
        {from && !tile ? <AppText variant="label" style={{ color: theme.colors.brand }}>{from}</AppText> : null}
      </View>
      {from && tile ? <AppText variant="label" style={{ color: theme.colors.brand, paddingHorizontal: 12, paddingBottom: 12, marginTop: -4 }}>{from}</AppText> : null}
    </Pressable>
  );
}
