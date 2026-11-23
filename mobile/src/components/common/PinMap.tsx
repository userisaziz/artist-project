import { View } from 'react-native';
import { Camera, Map } from '@maplibre/maplibre-react-native';
import { Icon } from './Icon';
import { useTheme } from '../../core/theme/theme-provider';
import type { Coordinates } from '../../core/location/location';

// OpenFreeMap: free OpenStreetMap vector tiles, no API key, no account, no usage billing. The map keeps its
// "© OpenStreetMap" attribution button, which the tiles' licence requires.
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const STREET_ZOOM = 16; // street level, enough to find the building

interface PinMapProps {
  start: Coordinates;
  /** How close the map opens: street level by default; lower to show a whole city when the start is only a guess. */
  zoom?: number;
  /** The point under the pin, each time the map settles. */
  onMove: (center: Coordinates) => void;
}

/** The one place the app uses a map library (MapLibre): a map you drag under a fixed centre pin (Swiggy / Urban
 * Company style), so the pin always marks the map's centre. Same map on iOS and Android. */
export function PinMap({ start, zoom = STREET_ZOOM, onMove }: PinMapProps) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1 }} accessibilityLabel="Map. Move it so the pin sits on your studio.">
      <Map
        style={{ flex: 1 }}
        mapStyle={MAP_STYLE}
        logo={false}
        compass={false}
        touchRotate={false}
        touchPitch={false}
        onRegionDidChange={(e) => {
          const [longitude, latitude] = e.nativeEvent.center;
          onMove({ latitude, longitude });
        }}
      >
        <Camera initialViewState={{ center: [start.longitude, start.latitude], zoom }} />
      </Map>
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ marginBottom: theme.spacing[8.5] }}>
          <Icon name="map-pin" size={34} color={theme.colors.brand} filled />
        </View>
      </View>
    </View>
  );
}
