import { useMemo } from 'react';
import { View } from 'react-native';
import MapView from 'react-native-maps';
import type { Region } from 'react-native-maps';
import { Icon } from './Icon';
import { useTheme } from '../../core/theme/theme-provider';
import type { Coordinates } from '../../core/location/location';

const ZOOM_DELTA = 0.006; // about 600 m across: street level, enough to find the building

interface PinMapProps {
  start: Coordinates;
  /** The point under the pin, each time the map settles. */
  onMove: (center: Coordinates) => void;
}

/** The one place the app uses react-native-maps: a map you drag under a fixed centre pin (Swiggy / Urban Company
 * style), so the pin always marks the map's centre. Apple Maps on iOS, Google Maps on Android. */
export function PinMap({ start, onMove }: PinMapProps) {
  const theme = useTheme();
  const initialRegion = useMemo<Region>(
    () => ({ ...start, latitudeDelta: ZOOM_DELTA, longitudeDelta: ZOOM_DELTA }),
    [start],
  );
  return (
    <View style={{ flex: 1 }} accessibilityLabel="Map. Move it so the pin sits on your studio.">
      <MapView
        style={{ flex: 1 }}
        initialRegion={initialRegion}
        onRegionChangeComplete={(r) => onMove({ latitude: r.latitude, longitude: r.longitude })}
        showsUserLocation
        toolbarEnabled={false}
      />
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ marginBottom: 34 }}>
          <Icon name="map-pin" size={34} color={theme.colors.brand} filled />
        </View>
      </View>
    </View>
  );
}
