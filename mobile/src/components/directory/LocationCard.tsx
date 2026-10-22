import { Pressable, View } from 'react-native';
import { AppText } from '../common/AppText';
import { Icon } from '../common/Icon';
import { useTheme } from '../../core/theme/theme-provider';

interface LocationCardProps {
  onChooseCity: () => void;
}

const BADGE = 44;

/** Home on a first visit: asks which city to show artists from (the design's "See artists near you" card). */
export function LocationCard({ onChooseCity }: LocationCardProps) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', padding: 14, borderRadius: 18, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.separator, ...theme.shadows.sm }}>
      <View style={{ width: BADGE, height: BADGE, borderRadius: BADGE / 2, backgroundColor: theme.colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="map-pin" size={22} color={theme.colors.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="subtitle" style={{ fontSize: 14, lineHeight: 19, color: theme.colors.textPrimary }}>See artists near you</AppText>
        <AppText variant="caption" style={{ marginTop: 2, color: theme.colors.textMuted }}>Pick your city to see the artists who work there.</AppText>
        <Pressable
          accessibilityRole="button"
          onPress={onChooseCity}
          style={{ alignSelf: 'flex-start', marginTop: 10, height: 34, paddingHorizontal: 14, borderRadius: theme.radii.pill, backgroundColor: theme.colors.brand, justifyContent: 'center' }}
        >
          <AppText variant="label" style={{ fontSize: 12.5, color: theme.colors.textOnBrand }}>Choose city</AppText>
        </Pressable>
      </View>
    </View>
  );
}
