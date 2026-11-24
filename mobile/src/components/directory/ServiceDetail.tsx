import { useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '../common/AppButton';
import { AppText } from '../common/AppText';
import { BackHeader } from '../common/BackHeader';
import { Icon } from '../common/Icon';
import { Photo } from '../common/Photo';
import { EmptyView, ErrorView, LoadingView } from '../common/StateViews';
import { VerifiedBadge } from './VerifiedBadge';
import { useTheme } from '../../core/theme/theme-provider';
import { useArtistPublic } from '../../hooks/directory/directory';
import { formatDuration, formatPrice } from '../../utils/common/format';
import { ratingShort } from '../../utils/reviews/format';
import { addonCountLabel, addonLines, addonsTotal } from '../../utils/bookings/addons';
import type { BookingAddonPick } from '../../types/bookings/bookings';
import type { PublicService } from '../../types/directory/directory';
import { AddonPicker } from './AddonPicker';
import { AnswerList } from '../catalog/AnswerList';
import { QuantityPicker } from '../common/QuantityPicker';
import { MAX_QUANTITY, countLabel, unitWord } from '../../utils/catalog/units';
import { BookingPolicy } from './BookingPolicy';

const HERO_RATIO = 0.62;

function categoryLabel(service: PublicService): string | null {
  const parts = [service.category?.name, service.subcategory?.name].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

interface ServiceDetailProps {
  artistId: string;
  serviceId: string;
  /** `quantity` is the units picked for a per-unit service, else 1. */
  onCheckAvailability: (service: PublicService, addons: BookingAddonPick[], quantity: number) => void;
  /** Made-to-order services are quoted, not booked: opens an enquiry about this service with what was picked. */
  onRequestQuote: (service: PublicService, addons: BookingAddonPick[], quantity: number) => void;
}

/** Design "Service detail": a photo of the artist's work, category, name, rating and artist, the starting price
 *  and duration, what's included, add-ons to pick, and "Check availability" under a running estimate. */
export function ServiceDetail({ artistId, serviceId, onCheckAvailability, onRequestQuote }: ServiceDetailProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const artist = useArtistPublic(artistId);
  const [picks, setPicks] = useState<BookingAddonPick[]>([]);
  // Null until the customer changes it: then the service's own minimum is the starting point.
  const [picked, setPicked] = useState<number | null>(null);
  const service = artist.data?.services.find((s) => s.id === serviceId);
  const shell = { flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top + theme.spacing.sm, paddingHorizontal: theme.spacing.md } as const;

  if (artist.isPending || artist.isError) {
    return (
      <View style={shell}>
        <BackHeader />
        {artist.isError ? <ErrorView error={artist.error} onRetry={() => { void artist.refetch(); }} /> : <LoadingView label="Loading the service" shape="detail" />}
      </View>
    );
  }
  if (!service) {
    return <View style={shell}><BackHeader /><EmptyView message="This service is no longer offered." /></View>;
  }
  const a = artist.data;
  const hero = a.photos[0]?.url;
  const category = categoryLabel(service);
  const lines = addonLines(service.addons, picks);
  const extrasPaise = addonsTotal(lines);
  const perUnit = service.pricing_unit === 'per_unit';
  const quoted = service.fulfilment === 'made_to_order';
  const quantity = perUnit ? Math.max(picked ?? service.min_quantity, service.min_quantity) : 1;
  const each = unitWord(service.quantity_unit, 1);
  const base = service.price_paise * quantity;
  const estimate = base + extrasPaise;
  const extras = addonCountLabel(lines.length);

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
            <VerifiedBadge verified={a.id_verified} />
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
            <View style={{ flex: 1, borderRadius: theme.radii.card, borderWidth: 1, borderColor: theme.colors.separator, padding: 12 }}>
              <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{`${quoted ? 'From' : 'Price'}${perUnit ? ` · per ${each}` : ''}`}</AppText>
              <AppText variant="subtitle" style={{ color: theme.colors.textPrimary }}>{formatPrice(service.price_paise)}</AppText>
            </View>
            <View style={{ flex: 1, borderRadius: theme.radii.card, borderWidth: 1, borderColor: theme.colors.separator, padding: 12 }}>
              <AppText variant="caption" style={{ color: theme.colors.textMuted }}>Duration</AppText>
              <AppText variant="subtitle" style={{ color: theme.colors.textPrimary }}>{formatDuration(service.duration_minutes)}</AppText>
            </View>
          </View>
          {quoted ? (
            <View style={{ borderRadius: theme.radii.md, backgroundColor: theme.colors.brandSoft, padding: theme.spacing[3] }}>
              <AppText variant="label" style={{ color: theme.colors.textPrimary }}>Made to order</AppText>
              <AppText variant="caption" style={{ color: theme.colors.textSecondary }}>Tell the artist what you need and when; they send you a price to accept.</AppText>
            </View>
          ) : null}
          {service.details.length ? <View style={{ marginTop: theme.spacing[2] }}><AnswerList title="Details" answers={service.details} /></View> : null}
          {perUnit ? (
            <View style={{ marginTop: theme.spacing[2], gap: theme.spacing[2] }}>
              <AppText variant="subtitle" style={{ color: theme.colors.textPrimary }}>{`How many ${unitWord(service.quantity_unit, 2)}?`}</AppText>
              <QuantityPicker value={quantity} min={service.min_quantity} max={MAX_QUANTITY} noun={(n) => unitWord(service.quantity_unit, n)} onChange={setPicked} />
              {service.min_quantity > 1 ? (
                <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{`Minimum ${countLabel(service.min_quantity, service.quantity_unit)}.`}</AppText>
              ) : null}
            </View>
          ) : null}
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
              <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{quoted ? 'Optional extras for the artist to include in their price.' : 'Optional extras. You can still change them before you send the request.'}</AppText>
              <AddonPicker addons={service.addons} picks={picks} onChange={setPicks} />
            </>
          ) : null}
          <View style={{ marginTop: theme.spacing[2] }}><BookingPolicy /></View>
        </View>
      </ScrollView>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: theme.spacing.md, paddingTop: 12, paddingBottom: insets.bottom + 12, backgroundColor: theme.colors.surface, borderTopWidth: 1, borderTopColor: theme.colors.separator }}>
        <View accessible accessibilityLabel={quoted ? `From ${formatPrice(service.price_paise)}` : `Total ${formatPrice(estimate)}${extras ? `, includes ${extras}` : ''}`}>
          <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{quoted ? 'From' : ['Total', perUnit ? countLabel(quantity, service.quantity_unit) : null, extras || null].filter(Boolean).join(' · ')}</AppText>
          <AppText variant="subtitle" style={{ color: theme.colors.textPrimary }}>{formatPrice(estimate)}</AppText>
          {extras ? <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{`${formatPrice(base)} + ${formatPrice(extrasPaise)}`}</AppText> : null}
        </View>
        <View style={{ flex: 1 }}>
          {quoted
            ? <AppButton label="Request a quote" onPress={() => onRequestQuote(service, picks, quantity)} />
            : <AppButton label="Check availability" onPress={() => onCheckAvailability(service, picks, quantity)} />}
        </View>
      </View>
    </View>
  );
}
