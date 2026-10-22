import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../../src/components/common/AppText';
import { AppButton } from '../../../src/components/common/AppButton';
import { BackHeader } from '../../../src/components/common/BackHeader';
import { ErrorView } from '../../../src/components/common/StateViews';
import { useTheme } from '../../../src/core/theme/theme-provider';
import { useArtistPublic, useStillAvailable } from '../../../src/hooks/directory/directory';
import { SlotPicker } from '../../../src/components/directory/SlotPicker';
import { useBookingFlow } from '../../../src/context/bookings/flow-context';
import { formatWhen } from '../../../src/utils/common/time';
import { formatPrice, formatDuration } from '../../../src/utils/common/format';
import { addonLines, addonsTotal, decodeAddonPicks } from '../../../src/utils/bookings/addons';

// Spec §2 Date & time (step 1 of 2): a 14-day strip and the day's hourly IST slots; taken ones are struck through.
export default function DateTimeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { artistId = '', serviceId = '', addons = '' } = useLocalSearchParams<{ artistId: string; serviceId: string; addons?: string }>();
  const [startAt, setStartAt] = useState<string | null>(null);
  const { notice, setNotice } = useBookingFlow();
  const artist = useArtistPublic(artistId);
  const service = artist.data?.services.find((s) => s.id === serviceId);
  const price = service ? service.price_paise + addonsTotal(addonLines(service.addons, decodeAddonPicks(addons, service.addons))) : 0;
  // A slot that turned out to be taken (refetch after a conflict) is no longer a choice.
  const chosen = useStillAvailable(artistId, serviceId, startAt);

  const pickSlot = (s: string | null) => { setStartAt(s); if (s) setNotice(null); };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + theme.spacing.sm, paddingHorizontal: theme.spacing.md, paddingBottom: 140 + insets.bottom }}>
        <BackHeader title="Date & time" step="Step 1 of 2" />
        {service ? (
          <AppText variant="body" style={{ color: theme.colors.textSecondary, marginTop: 8 }}>
            {`${service.name} · ${formatDuration(service.duration_minutes)} with ${artist.data?.business_name ?? ''}`}
          </AppText>
        ) : null}
        {notice ? (
          <View accessibilityLiveRegion="polite" style={{ marginTop: 12, borderRadius: theme.radii.md, backgroundColor: theme.colors.pendingSoft, padding: 12 }}>
            <AppText variant="label" style={{ color: theme.colors.pendingInk }}>{notice}</AppText>
          </View>
        ) : null}

        <SlotPicker artistId={artistId} serviceId={serviceId} value={startAt} onChange={pickSlot} />
        {artist.isError ? <ErrorView error={artist.error} onRetry={() => { void artist.refetch(); }} /> : null}
      </ScrollView>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: theme.spacing.md, paddingTop: 12, paddingBottom: insets.bottom + 12, backgroundColor: theme.colors.surface, borderTopWidth: 1, borderTopColor: theme.colors.separator, gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <AppText variant="subtitle" style={{ fontSize: 14.5, color: chosen ? theme.colors.textPrimary : theme.colors.textMuted }}>{chosen ? formatWhen(chosen) : 'Pick a time'}</AppText>
          {service ? <AppText variant="subtitle" style={{ fontSize: 14.5, color: theme.colors.brand }}>{formatPrice(price)}</AppText> : null}
        </View>
        <AppButton
          label="Continue"
          disabled={!chosen || !service}
          onPress={() => { if (chosen) router.push({ pathname: '/customer/book/review', params: { artistId, serviceId, startAt: chosen, addons } }); }}
        />
      </View>
    </View>
  );
}
