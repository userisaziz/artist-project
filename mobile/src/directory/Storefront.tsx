import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../components/AppText';
import { AppButton } from '../components/AppButton';
import { Avatar } from '../components/Avatar';
import { BackHeader } from '../components/BackHeader';
import { ErrorView, LoadingView } from '../components/StateViews';
import { useTheme } from '../theme/theme-provider';
import { formatDuration, formatPrice } from '../artist/format';
import { formatMonthShort } from '../bookings/time';
import { categoryLine } from './ArtistCardView';
import { useArtistPublic } from './queries';
import { StorefrontReviews } from '../reviews/StorefrontReviews';
import { formatAverage, ratingLong, reviewCountLabel } from '../reviews/format';
import type { PublicService } from '../api/types';

interface StorefrontProps {
  artistId: string;
  /** Customers pick a package and go on to Date & time; an artist previewing their own page can't. */
  onCheckAvailability?: (service: PublicService) => void;
  /** Opens every review; the artist's own preview has no such screen. */
  onSeeAllReviews?: () => void;
}

const COVER_HEIGHT = 230;
const AVATAR = 84;

/** Services grouped by subcategory (or category), in menu order. */
function groupServices(services: PublicService[]): [string, PublicService[]][] {
  const groups = new Map<string, PublicService[]>();
  for (const s of services) {
    const title = s.subcategory?.name ?? s.category?.name ?? 'Packages';
    groups.set(title, [...(groups.get(title) ?? []), s]);
  }
  return [...groups.entries()];
}

/** Spec §2 Artist storefront: hero, stats, packages, work and about, with a sticky "Check availability" footer. */
export function Storefront({ artistId, onCheckAvailability, onSeeAllReviews }: StorefrontProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { data: artist, isPending, isError, error, refetch } = useArtistPublic(artistId);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (isPending || isError) {
    return (
      <View style={{ flex: 1, paddingTop: insets.top + theme.spacing.sm, paddingHorizontal: theme.spacing.md }}>
        <BackHeader />
        {isError ? <ErrorView error={error} onRetry={() => { void refetch(); }} /> : <LoadingView />}
      </View>
    );
  }
  const selected = artist.services.find((s) => s.id === selectedId) ?? null;
  const bookable = !!onCheckAvailability;
  const section = { fontSize: 22, lineHeight: 28, color: theme.colors.heading, marginTop: 26, marginBottom: 10 } as const;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: (bookable ? 120 : 40) + insets.bottom }}>
        <View style={{ height: COVER_HEIGHT, backgroundColor: theme.colors.imageFallback }}>
          {artist.cover_url ? <Image source={{ uri: artist.cover_url }} style={{ flex: 1 }} contentFit="cover" /> : null}
          <View style={{ position: 'absolute', top: insets.top + theme.spacing.sm, left: theme.spacing.md, right: theme.spacing.md }}>
            <BackHeader />
          </View>
        </View>
        <View style={{ paddingHorizontal: theme.spacing.md, marginTop: -AVATAR / 2 }}>
          <View style={{ width: AVATAR + 6, height: AVATAR + 6, borderRadius: (AVATAR + 6) / 2, padding: 3, backgroundColor: theme.colors.surface, ...theme.shadows.sm }}>
            <Avatar uri={artist.photo_url} name={artist.business_name} size={AVATAR} />
          </View>
          <View style={{ marginTop: 10, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radii.pill, backgroundColor: theme.colors.confirmedSoft }}>
            <AppText variant="label" style={{ fontSize: 11.5, color: theme.colors.confirmedInk }}>✓ Verified artist</AppText>
          </View>
          <AppText variant="display" style={{ fontSize: 28, lineHeight: 32, color: theme.colors.heading, marginTop: 8 }}>{artist.business_name}</AppText>
          <AppText variant="body" style={{ color: theme.colors.textMuted }}>{categoryLine(artist)}</AppText>

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
            <Stat
              value={artist.rating === null || !artist.review_count ? 'New' : `★ ${formatAverage(artist.rating)}`}
              label={reviewCountLabel(artist.review_count)}
              accessibilityLabel={ratingLong(artist.rating, artist.review_count)}
            />
            <Stat value={String(artist.completed_bookings)} label="Bookings completed" />
            <Stat value={artist.member_since ? formatMonthShort(artist.member_since) : '—'} label="On Atelier since" />
          </View>

          <AppText variant="title" style={section}>Packages</AppText>
          {groupServices(artist.services).map(([title, services]) => (
            <View key={title} style={{ marginBottom: 12, gap: 8 }}>
              <AppText variant="eyebrow" style={{ color: theme.colors.brand, letterSpacing: 1.5 }}>{title.toUpperCase()}</AppText>
              {services.map((s) => (
                <PackageCard key={s.id} service={s} selected={s.id === selectedId} bookable={bookable} onSelect={() => setSelectedId(s.id === selectedId ? null : s.id)} />
              ))}
            </View>
          ))}

          {artist.photos.length ? (
            <>
              <AppText variant="title" style={section}>Work</AppText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {artist.photos.map((p, i) => (
                  <Image key={p.id} source={{ uri: p.thumb_url }} accessibilityLabel={`Work photo ${i + 1}`} style={{ width: '48.5%', aspectRatio: 3 / 4, borderRadius: 14, backgroundColor: theme.colors.imageFallback }} contentFit="cover" />
                ))}
              </View>
            </>
          ) : null}

          <StorefrontReviews artistId={artist.id} businessName={artist.business_name} onSeeAll={onSeeAllReviews} />

          {artist.bio ? (
            <>
              <AppText variant="title" style={section}>About</AppText>
              <AppText variant="body" style={{ color: theme.colors.textSecondary }}>{artist.bio}</AppText>
            </>
          ) : null}
        </View>
      </ScrollView>

      {bookable ? (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: theme.spacing.md, paddingTop: 12, paddingBottom: insets.bottom + 12, backgroundColor: theme.colors.surface, borderTopWidth: 1, borderTopColor: theme.colors.separator, gap: 10 }}>
          {selected ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <AppText variant="subtitle" numberOfLines={1} style={{ flex: 1, fontSize: 14.5, color: theme.colors.textPrimary }}>{selected.name}</AppText>
              <AppText variant="subtitle" style={{ fontSize: 14.5, color: theme.colors.brand }}>{formatPrice(selected.price_paise)}</AppText>
            </View>
          ) : (
            <AppText variant="caption" style={{ color: theme.colors.textMuted, textAlign: 'center' }}>Select a package to see open times</AppText>
          )}
          <AppButton label="Check availability" disabled={!selected} onPress={() => { if (selected) onCheckAvailability(selected); }} />
        </View>
      ) : null}
    </View>
  );
}

function Stat({ value, label, accessibilityLabel }: { value: string; label: string; accessibilityLabel?: string }) {
  const theme = useTheme();
  return (
    <View accessible={!!accessibilityLabel} accessibilityLabel={accessibilityLabel} style={{ flex: 1, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.separator, padding: 12 }}>
      <AppText variant="subtitle" style={{ fontSize: 18, color: theme.colors.textPrimary }}>{value}</AppText>
      <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{label}</AppText>
    </View>
  );
}

interface PackageCardProps {
  service: PublicService;
  selected: boolean;
  bookable: boolean;
  onSelect: () => void;
}

function PackageCard({ service, selected, bookable, onSelect }: PackageCardProps) {
  const theme = useTheme();
  return (
    <View style={{ borderRadius: 16, borderWidth: selected ? 1.5 : 1, borderColor: selected ? theme.colors.brand : theme.colors.separator, backgroundColor: selected ? theme.colors.washTop : theme.colors.surface, padding: 14, gap: 4 }}>
      <AppText variant="subtitle" style={{ fontSize: 15, color: theme.colors.textPrimary }}>{service.name}</AppText>
      {service.description ? <AppText variant="caption" style={{ color: theme.colors.textSecondary }}>{service.description}</AppText> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
        <AppText variant="label" style={{ flex: 1, color: theme.colors.textMuted }}>{`${formatDuration(service.duration_minutes)} · `}<AppText variant="label" style={{ color: theme.colors.brand }}>{formatPrice(service.price_paise)}</AppText></AppText>
        {bookable ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Select ${service.name}`}
            accessibilityState={{ selected }}
            onPress={onSelect}
            style={{ height: 34, paddingHorizontal: 16, borderRadius: theme.radii.pill, justifyContent: 'center', backgroundColor: selected ? theme.colors.brand : theme.colors.brandSoft }}
          >
            <AppText variant="label" style={{ fontSize: 13, color: selected ? theme.colors.textOnBrand : theme.colors.brand }}>{selected ? '✓ Selected' : 'Select'}</AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
