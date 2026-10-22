import { useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '../common/AppButton';
import { AppText } from '../common/AppText';
import { BackHeader } from '../common/BackHeader';
import { Icon } from '../common/Icon';
import { Photo } from '../common/Photo';
import { EmptyView, ErrorView, LoadingView } from '../common/StateViews';
import { useTheme } from '../../core/theme/theme-provider';
import { useArtistPublic } from '../../hooks/directory/directory';
import { formatDuration, formatPrice } from '../../utils/common/format';
import { ratingShort } from '../../utils/reviews/format';
import { addonLines, addonsTotal } from '../../utils/bookings/addons';
import type { BookingAddonPick } from '../../types/bookings/bookings';
import type { PublicService } from '../../types/directory/directory';
import { AddonPicker } from './AddonPicker';

const HERO_RATIO = 0.62;

function categoryLabel(service: PublicService): string | null {
  const parts = [service.category?.name, service.subcategory?.name].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

interface ServiceDetailProps {
  artistId: string;
  serviceId: string;
  onCheckAvailability: (service: PublicService, addons: BookingAddonPick[]) => void;
}

/** Design "Service detail": a photo of the artist's work, category, name, rating and artist, the starting price
 *  and duration, what's included, add-ons to pick, and "Check availability" under a running estimate. */
export function ServiceDetail({ artistId, serviceId, onCheckAvailability }: ServiceDetailProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const artist = useArtistPublic(artistId);
  const [picks, setPicks] = useState<BookingAddonPick[]>([]);
  const service = artist.data?.services.find((s) => s.id === serviceId);
  const shell = { flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top + theme.spacing.sm, paddingHorizontal: theme.spacing.md } as const;

  if (artist.isPending || artist.isError) {
    return (
      <View style={shell}>
        <BackHeader />
        {artist.isError ? <ErrorView error={artist.error} onRetry={() => { void artist.refetch(); }} /> : <LoadingView label="Loading the service" />}
      </View>
    );
  }
  if (!service) {
    return <View style={shell}><BackHeader /><EmptyView message="This service is no longer offered." /></View>;
  }
  const a = artist.data;
  const hero = a.photos[0]?.url;
  const category = categoryLabel(service);
  const estimate = service.price_paise + addonsTotal(addonLines(service.addons, picks));

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}>
        <View style={{ paddingTop: insets.top + theme.spacing.sm, paddingHorizontal: theme.spacing.md }}><BackHeader /></View>
        {hero ? <Photo uri={hero} label={`${a.business_name}’s work`} style={{ width, height: Math.round(width * HERO_RATIO), marginTop: 8 }} /> : null}
        <View style={{ padding: theme.spacing.md, gap: 10 }}>
          {category ? <AppText variant="caption" style={{ color: theme.colors.brand, textTransform: 'uppercase', letterSpacing: 0.8 }}>{category}</AppText> : null}
          <AppText variant="display" accessibilityRole="header" style={{ fontSize: 28, lineHeight: 32, color: theme.colors.heading }}>{service.name}</AppText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {a.review_count ? <Icon name="star" size={14} color={theme.colors.brand} filled /> : null}
            <AppText variant="label" style={{ color: theme.colors.textPrimary }}>{ratingShort(a.rating, a.review_count)}</AppText>
            <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{`· by ${a.business_name}`}</AppText>
            <Icon name="verified" size={14} color={theme.colors.brand} label="Verified artist" />
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
            <View style={{ flex: 1, borderRadius: theme.radii.card, borderWidth: 1, borderColor: theme.colors.separator, padding: 12 }}>
              <AppText variant="caption" style={{ color: theme.colors.textMuted }}>Starting at</AppText>
              <AppText variant="subtitle" style={{ color: theme.colors.textPrimary }}>{formatPrice(service.price_paise)}</AppText>
            </View>
            <View style={{ flex: 1, borderRadius: theme.radii.card, borderWidth: 1, borderColor: theme.colors.separator, padding: 12 }}>
              <AppText variant="caption" style={{ color: theme.colors.textMuted }}>Duration</AppText>
              <AppText variant="subtitle" style={{ color: theme.colors.textPrimary }}>{formatDuration(service.duration_minutes)}</AppText>
            </View>
          </View>
          {service.description ? (
            <>
              <AppText variant="subtitle" style={{ color: theme.colors.textPrimary, marginTop: 8 }}>About this service</AppText>
              <AppText variant="body" style={{ color: theme.colors.textSecondary }}>{service.description}</AppText>
            </>
          ) : null}
          {service.included_items.length ? (
            <>
              <AppText variant="subtitle" style={{ color: theme.colors.textPrimary, marginTop: 8 }}>What’s included</AppText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {service.included_items.map((item) => (
                  <View key={item} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, paddingHorizontal: 11, borderRadius: theme.radii.pill, backgroundColor: theme.colors.brandSoft }}>
                    <Icon name="check" size={13} color={theme.colors.brand} />
                    <AppText variant="caption" style={{ color: theme.colors.textPrimary }}>{item}</AppText>
                  </View>
                ))}
              </View>
            </>
          ) : null}
          {service.addons.length ? (
            <>
              <AppText variant="subtitle" style={{ color: theme.colors.textPrimary, marginTop: 8 }}>Add-ons</AppText>
              <AddonPicker addons={service.addons} picks={picks} onChange={setPicks} />
            </>
          ) : null}
          <AppText variant="caption" style={{ color: theme.colors.textMuted, marginTop: 4 }}>You pay the artist directly after the service.</AppText>
        </View>
      </ScrollView>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: theme.spacing.md, paddingTop: 12, paddingBottom: insets.bottom + 12, backgroundColor: theme.colors.surface, borderTopWidth: 1, borderTopColor: theme.colors.separator }}>
        <View accessible accessibilityLabel={`Estimate ${formatPrice(estimate)}`}>
          <AppText variant="caption" style={{ color: theme.colors.textMuted }}>Estimate</AppText>
          <AppText variant="subtitle" style={{ color: theme.colors.textPrimary }}>{formatPrice(estimate)}</AppText>
        </View>
        <View style={{ flex: 1 }}>
          <AppButton label="Check availability" onPress={() => onCheckAvailability(service, picks)} />
        </View>
      </View>
    </View>
  );
}
