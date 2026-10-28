import { ActivityIndicator, View } from 'react-native';
import { PressableFeedback } from '../common/PressableFeedback';
import { AppText } from '../common/AppText';
import { Icon } from '../common/Icon';
import { useTheme } from '../../core/theme/theme-provider';
import { openLocationSettings } from '../../core/location/location';
import type { PhoneLocation } from './PlaceSheet';

interface LocationCardProps {
  phone: PhoneLocation;
  onSearch: () => void;
}

const BADGE = 44;

/** Home before it knows where the customer is: finding them from the phone, or (refused, switched off, no fix) a way
 *  to search their area instead; Settings when the permission was refused for good. */
export function LocationCard({ phone, onSearch }: LocationCardProps) {
  const theme = useTheme();
  const detail = phone.locating ? 'Finding artists near you…' : phone.error ?? 'Use your location, or search your area to see artists close by.';
  return (
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', padding: 14, borderRadius: 18, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.separator, ...theme.shadows.sm }}>
      <View style={{ width: BADGE, height: BADGE, borderRadius: BADGE / 2, backgroundColor: theme.colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
        {phone.locating ? <ActivityIndicator color={theme.colors.brand} /> : <Icon name="map-pin" size={22} color={theme.colors.brand} />}
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="subtitle" style={{ fontSize: 14, lineHeight: 19, color: theme.colors.textPrimary }}>See artists near you</AppText>
        <AppText variant="caption" accessibilityLiveRegion="polite" style={{ marginTop: 2, color: phone.error ? theme.colors.error : theme.colors.textMuted }}>{detail}</AppText>
        {phone.locating ? null : (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <CardButton label="Search your area" primary onPress={onSearch} />
            {phone.blocked
              ? <CardButton label="Open Settings" onPress={() => { void openLocationSettings(); }} />
              : <CardButton label="Use my location" onPress={() => { void phone.locate(); }} />}
          </View>
        )}
      </View>
    </View>
  );
}

function CardButton({ label, primary = false, onPress }: { label: string; primary?: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <PressableFeedback
      accessibilityRole="button"
      onPress={onPress}
      style={{
        height: 34, paddingHorizontal: 14, borderRadius: theme.radii.pill, justifyContent: 'center', borderWidth: 1,
        backgroundColor: primary ? theme.colors.brand : theme.colors.surface, borderColor: primary ? theme.colors.brand : theme.colors.separator,
      }}
    >
      <AppText variant="label" style={{ fontSize: 12.5, color: primary ? theme.colors.textOnBrand : theme.colors.brand }}>{label}</AppText>
    </PressableFeedback>
  );
}
