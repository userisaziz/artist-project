import { View } from 'react-native';
import { AppText } from '../common/AppText';
import { useTheme } from '../../core/theme/theme-provider';
import { formatDay } from '../../utils/common/time';
import type { ArtistPublic } from '../../types/directory/directory';

interface StorefrontChipsProps {
  artist: ArtistPublic;
}

const DOT = 6;

/** "Next free: Fri, 9 Oct" (green), how far the artist travels, and the languages they speak. */
export function StorefrontChips({ artist }: StorefrontChipsProps) {
  const theme = useTheme();
  const hasPackages = artist.services.length > 0;
  const languages = artist.languages.join(' · ');
  if (!hasPackages && !artist.travel_radius_km && !languages) return null;
  const chip = { paddingHorizontal: 10, paddingVertical: 5, borderRadius: theme.radii.pill } as const;
  const plain = { ...chip, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.separator } as const;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: theme.spacing.md, paddingTop: 12 }}>
      {hasPackages && artist.next_free_date ? (
        <View style={{ ...chip, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.colors.confirmedSoft }}>
          <View style={{ width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: theme.colors.confirmedInk }} />
          <AppText variant="label" style={{ color: theme.colors.confirmedInk }}>{`Next free: ${formatDay(artist.next_free_date)}`}</AppText>
        </View>
      ) : null}
      {hasPackages && !artist.next_free_date ? (
        <View style={plain}>
          <AppText variant="caption" style={{ color: theme.colors.textSecondary }}>Fully booked for the next two weeks</AppText>
        </View>
      ) : null}
      {artist.travel_radius_km ? (
        <View style={plain}>
          <AppText variant="caption" style={{ color: theme.colors.textSecondary }}>{`Travels ${artist.travel_radius_km} km`}</AppText>
        </View>
      ) : null}
      {languages ? (
        <View style={plain}>
          <AppText variant="caption" accessibilityLabel={`Speaks ${artist.languages.join(', ')}`} style={{ color: theme.colors.textSecondary }}>{languages}</AppText>
        </View>
      ) : null}
    </View>
  );
}
