import { View } from 'react-native';
import type * as MapLibre from '@maplibre/maplibre-react-native';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { useTheme } from '../../core/theme/theme-provider';
import type { Coordinates } from '../../core/location/location';

// OpenFreeMap: free OpenStreetMap vector tiles, no API key, no account, no usage billing. The map keeps its
// "© OpenStreetMap" attribution button, which the tiles' licence requires.
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const STREET_ZOOM = 16; // street level, enough to find the building
const PLACEHOLDER_HEIGHT = 220;

/** A binary without MapLibre — Expo Go, or a dev client built before the library was added — throws as soon as the
 *  library is imported. expo-router requires every route file at boot, so that one throw takes the whole app down
 *  with it; the map is loaded through here so the app survives and the screen says what is missing. */
function loadMaplibre(): typeof MapLibre | null {
  try {
    return require('@maplibre/maplibre-react-native') as typeof MapLibre;
  } catch (error) {
    if (__DEV__) console.warn('The map is off in this build (rebuild the dev client):', error);
    return null;
  }
}
const Native = loadMaplibre();

interface PinMapProps {
  start: Coordinates;
  /** How close the map opens: street level by default; lower to show a whole city when the start is only a guess. */
  zoom?: number;
  /** The point under the pin, each time the map settles. */
  onMove: (center: Coordinates) => void;
}

/** The one place the app uses a map library (MapLibre): a map you drag under a fixed centre pin (Swiggy / Urban
 * Company style), so the pin always marks the map's centre. Same map on iOS and Android; a binary that lacks the
 * library stands in with the pin's coordinates, which keeps every other screen alive. */
export function PinMap({ start, zoom = STREET_ZOOM, onMove }: PinMapProps) {
  const theme = useTheme();
  if (!Native) {
    return (
      <View style={{ height: PLACEHOLDER_HEIGHT, borderRadius: theme.radii.md, backgroundColor: theme.colors.washBottom, alignItems: 'center', justifyContent: 'center', gap: theme.spacing[1.5] }} accessibilityLabel="Map unavailable in this build">
        <Icon name="map-pin" size={28} color={theme.colors.brand} />
        <AppText variant="caption" style={{ color: theme.colors.textSecondary }}>Map isn’t in this build</AppText>
        <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{`${start.latitude.toFixed(5)}, ${start.longitude.toFixed(5)}`}</AppText>
      </View>
    );
  }
  const { Camera, Map } = Native;
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
