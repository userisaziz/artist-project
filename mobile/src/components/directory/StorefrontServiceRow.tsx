import { Pressable, View } from 'react-native';
import { AppText } from '../common/AppText';
import { Icon } from '../common/Icon';
import { Photo } from '../common/Photo';
import { useTheme } from '../../core/theme/theme-provider';
import { formatDuration, formatPrice } from '../../utils/common/format';
import type { PublicService } from '../../types/directory/directory';

interface StorefrontServiceRowProps {
  service: PublicService;
  mostBooked: boolean;
  /** Opens Service detail (customers); the artist's own preview shows the row without it. */
  onOpen?: () => void;
}

const THUMB = 76;

/** "Subcategory · 3 hr": what kind of package and how long it takes. */
export function serviceMeta(service: PublicService): string {
  const kind = service.subcategory?.name ?? service.category?.name;
  return [kind, formatDuration(service.duration_minutes)].filter(Boolean).join(' · ');
}

/** A package on the storefront: its photo (or a placeholder tile), "Most booked" on the favourite, name, kind and length,
 *  price and "Book". */
export function StorefrontServiceRow({ service, mostBooked, onOpen }: StorefrontServiceRowProps) {
  const theme = useTheme();
  const price = formatPrice(service.price_paise);
  return (
    <Pressable
      accessibilityRole={onOpen ? 'button' : undefined}
      accessibilityLabel={[service.name, mostBooked ? 'most booked' : null, price].filter(Boolean).join(', ')}
      disabled={!onOpen}
      onPress={onOpen}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 10,
        borderRadius: theme.radii.card,
        backgroundColor: theme.colors.surface,
        borderWidth: mostBooked ? 2 : 1,
        borderColor: mostBooked ? theme.colors.accent : theme.colors.separator,
      }}
    >
      {service.photo_url ? (
        <Photo uri={service.photo_url} label={`${service.name} photo`} style={{ width: THUMB, height: THUMB, borderRadius: theme.radii.md }} />
      ) : (
        <View style={{ width: THUMB, height: THUMB, borderRadius: theme.radii.md, backgroundColor: theme.colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="sparkles" size={24} color={theme.colors.brand} />
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        {mostBooked ? (
          <View style={{ alignSelf: 'flex-start', paddingHorizontal: theme.spacing.sm, paddingVertical: 2, borderRadius: theme.radii.pill, backgroundColor: theme.colors.brand }}>
            <AppText variant="label" style={{ fontSize: 10, lineHeight: 14, color: theme.colors.textOnBrand }}>Most booked</AppText>
          </View>
        ) : null}
        <AppText variant="subtitle" numberOfLines={2} style={{ fontSize: 14.5, lineHeight: 20, color: theme.colors.textPrimary }}>{service.name}</AppText>
        <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{serviceMeta(service)}</AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
          <AppText variant="subtitle" style={{ fontSize: 15, lineHeight: 20, color: theme.colors.textPrimary }}>{price}</AppText>
          {onOpen ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <AppText variant="label" style={{ color: theme.colors.brand }}>Book</AppText>
              <Icon name="chevron-right" size={14} color={theme.colors.brand} />
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}
