import { useState } from 'react';
import { FlatList, Pressable, ScrollView, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../../src/components/common/AppText';
import { ErrorView, LoadingView, EmptyView } from '../../../src/components/common/StateViews';
import { SectionHeader } from '../../../src/components/common/SectionHeader';
import { useTheme } from '../../../src/core/theme/theme-provider';
import { useAuth } from '../../../src/context/auth/auth-provider';
import { useCategories, useCities } from '../../../src/hooks/catalog/catalog';
import { useCity } from '../../../src/context/directory/city-context';
import { CitySheet } from '../../../src/components/directory/CitySheet';
import { LocationCard } from '../../../src/components/directory/LocationCard';
import { useArtistList } from '../../../src/hooks/directory/directory';
import { useSaveToggle } from '../../../src/hooks/saved/saved';
import { HomeHero, type HeroSlide } from '../../../src/components/directory/HomeHero';
import { CategoryIconRow } from '../../../src/components/directory/CategoryIconRow';
import { ArtistTile } from '../../../src/components/directory/ArtistTile';
import { ArtistCompactRow } from '../../../src/components/directory/ArtistCompactRow';
import { ShopBanner } from '../../../src/components/shop/ShopBanner';
import { greeting } from '../../../src/utils/common/time';
import { useNow } from '../../../src/hooks/common/use-now';
import { NotificationBell } from '../../../src/components/notifications/NotificationBell';
import { Icon } from '../../../src/components/common/Icon';
import type { ArtistCard } from '../../../src/types/directory/directory';

// The design's Home carousel photos (docs/design/atelier/README.md), re-encoded as webp.
const HERO_SLIDES: HeroSlide[] = [
  { eyebrow: 'WEDDING SEASON', title: 'Bridal artists, ', accent: 'verified', image: require('../../../assets/hero/home-bridal.webp') },
  { eyebrow: 'AT YOUR DOOR', title: 'Mehendi and makeup, ', accent: 'at home', image: require('../../../assets/hero/home-makeup.webp') },
];
const TOP_RATED_COUNT = 3;
const GRADIENT_HEIGHT = 520;

/** Rated artists only, best first; more reviews break a tie. */
function topRated(artists: ArtistCard[]): ArtistCard[] {
  return artists
    .filter((a) => a.rating !== null && a.review_count > 0)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.review_count - a.review_count)
    .slice(0, TOP_RATED_COUNT);
}

// The design's Home: greeting, cross-fading hero, search, services, "Discover artists", the shop banner and "Top rated".
export default function CustomerHome() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const now = useNow();
  const categories = useCategories();
  const cities = useCities();
  const { city, setCity } = useCity();
  const [picking, setPicking] = useState(false);
  const artists = useArtistList(null, '', city);
  const saveArtist = useSaveToggle('artist');
  const items = artists.data?.pages.flatMap((p) => p.items) ?? [];
  const best = topRated(items);
  const openArtist = (id: string) => router.push({ pathname: '/customer/artist/[id]', params: { id } });
  const explore = () => router.navigate({ pathname: '/customer/explore', params: city ? { city } : {} });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }} contentContainerStyle={{ paddingTop: insets.top + theme.spacing.md, paddingBottom: theme.spacing.xl }}>
      <LinearGradient colors={[theme.colors.brandSoft, theme.colors.washTop, theme.colors.background]} locations={[0, 0.58, 1]} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: GRADIENT_HEIGHT }} />
      <View style={{ paddingHorizontal: theme.spacing.md, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{`${greeting(now)}, ${user?.first_name || 'there'}`}</AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={city ? `Location: ${city}. Change city` : 'Set your location'}
            onPress={() => setPicking(true)}
            hitSlop={6}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}
          >
            <Icon name="map-pin" size={14} color={theme.colors.brand} />
            <AppText variant="label" style={{ fontSize: 14, color: theme.colors.textPrimary }}>{city ?? 'Set your location'}</AppText>
            <Icon name="chevron-down" size={14} color={theme.colors.brand} />
          </Pressable>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Messages"
          onPress={() => router.push('/customer/messages')}
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.separator, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="chat" size={22} />
        </Pressable>
        <NotificationBell onPress={() => router.push('/customer/notifications')} />
      </View>

      {city ? null : (
        <View style={{ marginTop: 14, paddingHorizontal: theme.spacing.md }}>
          <LocationCard onChooseCity={() => setPicking(true)} />
        </View>
      )}

      <View style={{ marginTop: 14 }}>
        <HomeHero slides={HERO_SLIDES} onOpen={explore} />
      </View>

      <Pressable
        accessibilityRole="search"
        accessibilityLabel="Search artists and services"
        onPress={explore}
        style={{ marginTop: 14, marginHorizontal: theme.spacing.md, height: 50, borderRadius: 14, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.separator, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, ...theme.shadows.sm }}
      >
        <Icon name="search" size={18} color={theme.colors.brand} />
        <AppText variant="body" style={{ color: theme.colors.textMuted }}>Search artists, services or styles</AppText>
      </Pressable>

      {categories.data?.length ? (
        <>
          <SectionHeader title="Services" />
          <CategoryIconRow categories={categories.data} onPick={(c) => router.navigate({ pathname: '/customer/explore', params: { categoryId: String(c.id) } })} />
        </>
      ) : null}

      <SectionHeader title="Discover artists" onSeeAll={explore} seeAllLabel="See all artists" />
      {artists.isPending ? <LoadingView /> : null}
      {artists.isError ? <View style={{ paddingHorizontal: theme.spacing.md }}><ErrorView error={artists.error} onRetry={() => { void artists.refetch(); }} /></View> : null}
      {artists.isSuccess && !items.length ? <View style={{ paddingHorizontal: theme.spacing.md }}><EmptyView message="No artists yet. Check back soon." /></View> : null}
      {items.length ? (
        <FlatList
          horizontal
          data={items}
          keyExtractor={(a) => a.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: theme.spacing.md, gap: 12 }}
          renderItem={({ item }) => (
            <ArtistTile artist={item} saved={saveArtist.isSaved(item.id)} onPress={() => openArtist(item.id)} onToggleSave={() => saveArtist.toggle(item.id)} />
          )}
        />
      ) : null}

      <View style={{ marginTop: 28, paddingHorizontal: theme.spacing.md }}>
        <ShopBanner onPress={() => router.navigate('/customer/shop')} />
      </View>

      {best.length ? (
        <>
          <SectionHeader title="Top rated" onSeeAll={explore} seeAllLabel="See all top rated artists" />
          <View accessibilityLabel="Top rated artists" style={{ paddingHorizontal: theme.spacing.md, gap: 10 }}>
            {best.map((a) => <ArtistCompactRow key={a.id} artist={a} onPress={() => openArtist(a.id)} />)}
          </View>
        </>
      ) : null}

      <CitySheet
        visible={picking}
        cities={cities.data ?? []}
        selected={city}
        onPick={(next) => { setCity(next); setPicking(false); }}
        onClose={() => setPicking(false)}
      />
    </ScrollView>
  );
}
