import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { PressableFeedback } from '../common/PressableFeedback';
import { AppText } from '../common/AppText';
import { AppTextField } from '../common/AppTextField';
import { BottomSheet } from '../common/BottomSheet';
import { Icon } from '../common/Icon';
import { useTheme } from '../../core/theme/theme-provider';
import { errorMessage } from '../../core/api/error-message';
import { openLocationSettings } from '../../core/location/location';
import { useDebouncedValue } from '../../hooks/common/use-debounced-value';
import { PLACE_SEARCH_MIN_CHARS, usePlaceSearch } from '../../hooks/directory/places';
import type { CustomerPlace, PlaceResult } from '../../types/directory/directory';

/** The phone's side of the sheet: finding the customer from GPS, and why it failed. */
export interface PhoneLocation {
  locating: boolean;
  error: string | null;
  /** Refused for good: offer Settings. */
  blocked: boolean;
  locate: () => Promise<boolean>;
}

interface PlaceSheetProps {
  visible: boolean;
  current: CustomerPlace | null;
  phone: PhoneLocation;
  onPick: (place: CustomerPlace | null) => void;
  onClose: () => void;
}

const toPlace = (r: PlaceResult): CustomerPlace => ({
  label: r.label, city: r.city, areaId: r.area_id, coords: { latitude: r.latitude, longitude: r.longitude }, source: 'search',
});

/** "Where are you?": use the phone's location, or search an area or place ("BTM Layout"); no list to browse. */
export function PlaceSheet({ visible, current, phone, onPick, onClose }: PlaceSheetProps) {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const q = useDebouncedValue(query.trim());
  const results = usePlaceSearch(q, current?.coords ?? null);
  const pick = (place: CustomerPlace | null) => { setQuery(''); onPick(place); };
  const locateAndClose = async () => { if (await phone.locate()) { setQuery(''); onClose(); } };

  return (
    <BottomSheet visible={visible} title="Where are you?" onClose={onClose}>
      <PressableFeedback
        accessibilityRole="button"
        accessibilityState={{ busy: phone.locating }}
        onPress={() => { void locateAndClose(); }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 }}
      >
        <Icon name="map-pin" size={18} color={theme.colors.brand} />
        <AppText variant="label" style={{ flex: 1, color: theme.colors.brand }}>{phone.locating ? 'Finding you…' : 'Use my current location'}</AppText>
        {phone.locating ? <ActivityIndicator color={theme.colors.brand} /> : null}
      </PressableFeedback>
      {phone.error ? (
        <View style={{ gap: 6 }}>
          <AppText variant="caption" accessibilityLiveRegion="polite" style={{ color: theme.colors.error }}>{phone.error}</AppText>
          {phone.blocked ? (
            <PressableFeedback accessibilityRole="button" onPress={() => { void openLocationSettings(); }} hitSlop={8} style={{ alignSelf: 'flex-start' }}>
              <AppText variant="label" style={{ color: theme.colors.brand }}>Open Settings</AppText>
            </PressableFeedback>
          ) : null}
        </View>
      ) : null}
      <AppTextField label="Search your area" hideLabel placeholder="Search your area, e.g. BTM Layout" value={query} onChangeText={setQuery} autoCorrect={false} />
      <PlaceResults q={q} results={results} onPick={(r) => pick(toPlace(r))} />
      {current ? (
        <PressableFeedback accessibilityRole="button" onPress={() => pick(null)} hitSlop={8} style={{ alignSelf: 'flex-start', marginTop: 8 }}>
          <AppText variant="label" style={{ color: theme.colors.brand }}>Show artists everywhere</AppText>
        </PressableFeedback>
      ) : null}
    </BottomSheet>
  );
}

interface PlaceResultsProps {
  q: string;
  results: ReturnType<typeof usePlaceSearch>;
  onPick: (result: PlaceResult) => void;
}

function PlaceResults({ q, results, onPick }: PlaceResultsProps) {
  const theme = useTheme();
  const muted = { color: theme.colors.textMuted };
  if (q.length < PLACE_SEARCH_MIN_CHARS) return <AppText variant="caption" style={muted}>Type at least {PLACE_SEARCH_MIN_CHARS} letters.</AppText>;
  if (results.isPending) return <ActivityIndicator color={theme.colors.brand} />;
  if (results.isError) return <AppText variant="caption" accessibilityRole="alert" style={{ color: theme.colors.error }}>{errorMessage(results.error)}</AppText>;
  if (!results.data.length) return <AppText variant="caption" style={muted}>No places match “{q}”.</AppText>;
  return (
    <View style={{ opacity: results.isPlaceholderData ? 0.55 : 1 }}>
      {results.data.map((r) => (
        <PressableFeedback
          key={`${r.source}-${r.area_id ?? ''}-${r.latitude},${r.longitude}`}
          accessibilityRole="button"
          onPress={() => onPick(r)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.separator }}
        >
          <Icon name="map-pin" size={16} color={theme.colors.textMuted} />
          <AppText variant="body" numberOfLines={1} style={{ flex: 1, color: theme.colors.textPrimary }}>{r.label}</AppText>
        </PressableFeedback>
      ))}
    </View>
  );
}
