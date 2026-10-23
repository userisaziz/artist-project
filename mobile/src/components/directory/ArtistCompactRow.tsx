import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { AppText } from '../common/AppText';
import { Icon } from '../common/Icon';
import { useTheme } from '../../core/theme/theme-provider';
import { formatPrice } from '../../utils/common/format';
import type { ArtistCard } from '../../types/directory/directory';

interface ArtistCompactRowProps {
  artist: ArtistCard;
  onPress: () => void;
}

const THUMB = 68;
const RADIUS = 16;

/** Home "Top rated", as in the design: a square photo beside name ✓, "★ 5.0 (412) · Hair · Whitefield" and the price. */
export function ArtistCompactRow({ artist, onPress }: ArtistCompactRowProps) {
  const theme = useTheme();
  const bold = theme.typography.eyebrow.fontFamily;
  const thumb = artist.cover_url ?? artist.photo_url;
  const rated = artist.rating !== null && artist.review_count > 0;
  const rest = [rated ? `(${artist.review_count})` : null, artist.categories.map((c) => c.name).join(', ') || null, artist.locality ?? artist.city]
    .filter(Boolean).join(' · ');
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{ flexDirection: 'row', gap: 12, padding: 10, borderRadius: RADIUS, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.separator }}
    >
      <View style={{ width: THUMB, height: THUMB, borderRadius: theme.radii.md, overflow: 'hidden', backgroundColor: theme.colors.imageFallback }}>
        {thumb ? <Image source={{ uri: thumb }} style={{ flex: 1 }} contentFit="cover" transition={150} /> : null}
      </View>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <AppText variant="subtitle" numberOfLines={1} style={{ flexShrink: 1, fontFamily: bold, fontSize: 14, lineHeight: 19, color: theme.colors.textPrimary }}>{artist.business_name}</AppText>
          <Icon name="check" size={14} color={theme.colors.brand} label="Verified" />
        </View>
        <AppText variant="caption" numberOfLines={1} style={{ marginTop: 3, color: theme.colors.textMuted }}>
          <AppText variant="caption" style={{ fontFamily: bold, color: theme.colors.brand }}>{rated ? `★ ${(artist.rating ?? 0).toFixed(1)}` : 'New'}</AppText>
          {` ${rest}`}
        </AppText>
        {artist.from_price_paise === null ? null : (
          <AppText variant="caption" style={{ marginTop: 3, color: theme.colors.textPrimary }}>
            {'From '}<AppText variant="caption" style={{ fontFamily: bold, color: theme.colors.textPrimary }}>{formatPrice(artist.from_price_paise)}</AppText>
          </AppText>
        )}
      </View>
    </Pressable>
  );
}
