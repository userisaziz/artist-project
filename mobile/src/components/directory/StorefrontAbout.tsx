import { View } from 'react-native';
import { AppText } from '../common/AppText';
import { useTheme } from '../../core/theme/theme-provider';
import { hoursSummary } from '../../utils/common/weekly-hours';
import type { ArtistPublic } from '../../types/directory/directory';

interface StorefrontAboutProps {
  artist: ArtistPublic;
}

/** The bio, working hours and how far the artist travels. */
export function StorefrontAbout({ artist }: StorefrontAboutProps) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.md }}>
      {artist.bio ? <AppText variant="body" style={{ color: theme.colors.textSecondary }}>{artist.bio}</AppText> : null}
      {artist.hours?.length ? ( // an API without working hours yet sends none: skip the block rather than crash
        <View style={{ gap: 2 }}>
          <AppText variant="label" style={{ color: theme.colors.textPrimary }}>Hours</AppText>
          {hoursSummary(artist.hours).map((line) => (
            <AppText key={line} variant="caption" style={{ color: theme.colors.textSecondary }}>{line}</AppText>
          ))}
        </View>
      ) : null}
      {artist.travel_radius_km ? (
        <AppText variant="caption" style={{ color: theme.colors.textSecondary }}>{`Travels up to ${artist.travel_radius_km} km`}</AppText>
      ) : null}
    </View>
  );
}
