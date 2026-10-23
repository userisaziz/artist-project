import { useEffect } from 'react';
import { View } from 'react-native';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { useTheme } from '../../core/theme/theme-provider';
import type { Coordinates } from '../../core/location/location';

interface PinMapProps {
  start: Coordinates;
  /** The point under the pin, each time the map settles. */
  onMove: (center: Coordinates) => void;
}

const HEIGHT = 220;

/** Web stand-in for PinMap: react-native-maps has no web build, so the dev web preview shows the pin's coordinates
 * and keeps the starting point (the native app drags a real map). */
export function PinMap({ start, onMove }: PinMapProps) {
  const theme = useTheme();
  useEffect(() => { onMove(start); }, [start, onMove]);
  return (
    <View style={{ height: HEIGHT, borderRadius: theme.radii.md, backgroundColor: theme.colors.washBottom, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
      <Icon name="map-pin" size={28} color={theme.colors.brand} />
      <AppText variant="caption" style={{ color: theme.colors.textSecondary }}>Map preview isn’t available on web</AppText>
      <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{`${start.latitude.toFixed(5)}, ${start.longitude.toFixed(5)}`}</AppText>
    </View>
  );
}
