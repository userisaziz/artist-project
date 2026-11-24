import { useState } from 'react';
import { FlatList, View, RefreshControl } from 'react-native';
import { PressableFeedback } from '../../../src/components/common/PressableFeedback';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../../src/components/common/AppText';
import { ErrorView, LoadingView, EmptyView } from '../../../src/components/common/StateViews';
import { AppButton } from '../../../src/components/common/AppButton';
import { SectionHeader } from '../../../src/components/common/SectionHeader';
import { useTheme } from '../../../src/core/theme/theme-provider';
import { useAuth } from '../../../src/context/auth/auth-provider';
import { useCategories } from '../../../src/hooks/catalog/catalog';
import { useCustomerPlace } from '../../../src/context/directory/city-context';
import { useDetectLocation } from '../../../src/hooks/directory/use-detect-location';
import { placeLine } from '../../../src/utils/directory/place';
import { PlaceSheet } from '../../../src/components/directory/PlaceSheet';
import { LocationCard } from '../../../src/components/directory/LocationCard';
import { useArtistList, usePrefetchArtist, useTopRatedArtists } from '../../../src/hooks/directory/directory';
import { useSaveToggle } from '../../../src/hooks/saved/saved';
import { HomeHero, type HeroSlide } from '../../../src/components/directory/HomeHero';
import { CategoryIconRow } from '../../../src/components/directory/CategoryIconRow';
import { ArtistTile } from '../../../src/components/directory/ArtistTile';
import { HomeTopRated } from '../../../src/components/directory/HomeTopRated';
import { MessagesButton } from '../../../src/components/chat/MessagesButton';
import { useUnreadChatCount } from '../../../src/hooks/chat/chat';
import { liveSlides } from '../../../src/utils/directory/home-hero';
import { MotionEntrance } from '../../../src/components/common/MotionEntrance';
import { CollapseOnScroll, ScrollContainer, useScrollLinked } from '../../../src/components/common/ScrollMotion';
import { useEntranceWindow } from '../../../src/core/motion/motion';
import { ShopBanner } from '../../../src/components/shop/ShopBanner';
import { greeting } from '../../../src/utils/common/time';
import { useNow } from '../../../src/hooks/common/use-now';
import { Avatar } from '../../../src/components/common/Avatar';
import { Icon } from '../../../src/components/common/Icon';
import { usePullToRefresh } from '../../../src/hooks/common/use-pull-to-refresh';

// The design's Home carousel photos (docs/design/atelier/README.md), re-encoded as webp.
const HERO_SLIDES: HeroSlide[] = [
  { eyebrow: 'MEHENDI', title: 'Bridal mehendi artists', categorySlug: 'mehendi', image: require('../../../assets/hero/home-bridal.webp') },
  { eyebrow: 'MAKEUP & HAIR', title: 'Glam for your big day', categorySlug: 'makeup', image: require('../../../assets/hero/home-makeup.webp') },
];

const TOP_RATED_COUNT = 3;
const GRADIENT_HEIGHT = 520;

// The design's Home: greeting, search, then (once a place is known) the cross-fading hero, services, "Discover artists",
// "Top rated" and the shop banner. Location is asked for only when the customer taps "Use my location".
export default function CustomerHome() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { scrollY, onScroll, scrollEventThrottle } = useScrollLinked();
  const { user } = useAuth();
  // Plain values, not optional chains inside `||`: the React Compiler can't memoize this screen around those.
  const firstName = user ? user.first_name : null;
  const fullName = user ? [user.first_name, user.last_name].filter(Boolean).join(' ') : '';
  const now = useNow();
  const categories = useCategories();
  const { place, setPlace } = useCustomerPlace();
  const phone = useDetectLocation({ auto: true }); // refreshes a phone-found place without asking; LocationCard asks
  const [picking, setPicking] = useState(false);
  const artists = useArtistList(null, '', place);
  const radiusKm = artists.data?.pages[0]?.radius_km ?? null;
  const topRated = useTopRatedArtists(place, TOP_RATED_COUNT);
  const unreadChats = useUnreadChatCount('customer');
  const pull = usePullToRefresh(() => Promise.all([artists.refetch(), categories.refetch(), topRated.refetch()]));
  const saveArtist = useSaveToggle('artist');
  const items = artists.data?.pages.flatMap((p) => p.items) ?? [];
  // Every slide until artists load (no layout jump), then only categories someone near the place offers.
  const slides = artists.isSuccess ? liveSlides(HERO_SLIDES, items) : HERO_SLIDES;
  // One entrance per first batch, and only while useEntranceWindow says the window is open: a refetch on
  // resume or a row recycled back into view must not replay the cascade.
  const tilesArmed = useEntranceWindow(items.length > 0);
  const prefetchArtist = usePrefetchArtist();
  const openArtist = (id: string) => {
    prefetchArtist(id);
    router.push({ pathname: '/customer/artist/[id]', params: { id } });
  };
  const explore = () => router.navigate('/customer/explore'); // Explore reads the same shared place
  // `at` makes each tap a new link, so Explore focuses its field / re-sorts even when it is already open.
  const search = () => router.navigate({ pathname: '/customer/explore', params: { focus: '1', at: String(Date.now()) } });
  const exploreTopRated = () => router.navigate({ pathname: '/customer/explore', params: { sort: 'rating', at: String(Date.now()) } });
  const openSlide = (slide: HeroSlide) => {
    const category = categories.data?.find((c) => c.slug === slide.categorySlug);
    if (!category) { explore(); return; }
    router.navigate({ pathname: '/customer/explore', params: { categoryId: String(category.id) } });
  };

  return (
    <ScrollContainer onScroll={onScroll} scrollEventThrottle={scrollEventThrottle} style={{ flex: 1, backgroundColor: theme.colors.background }} contentContainerStyle={{ paddingTop: insets.top + theme.spacing.md, paddingBottom: theme.spacing.xl }} refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} tintColor={theme.colors.brand} colors={[theme.colors.brand]} />}>
      <LinearGradient colors={[theme.colors.brandSoft, theme.colors.washTop, theme.colors.background]} locations={[0, 0.58, 1]} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: GRADIENT_HEIGHT }} />
      <CollapseOnScroll scrollY={scrollY} style={{ paddingHorizontal: theme.spacing.md, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{`${greeting(now)}, ${firstName || 'there'}`}</AppText>
          <PressableFeedback
            accessibilityRole="button"
            accessibilityLabel={place ? `Location: ${place.label}. Change` : 'Set your location'}
            onPress={() => setPicking(true)}
            hitSlop={6}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}
          >
            <Icon name="map-pin" size={14} color={theme.colors.brand} />
            <AppText variant="label" numberOfLines={1} style={{ flexShrink: 1, fontSize: 14, color: theme.colors.textPrimary }}>{place?.label ?? (phone.locating ? 'Finding you…' : 'Set your location')}</AppText>
            <Icon name="chevron-down" size={14} color={theme.colors.brand} />
          </PressableFeedback>
        </View>
        <MessagesButton unread={unreadChats} onPress={() => router.push('/customer/messages')} />
        <PressableFeedback accessibilityRole="button" accessibilityLabel="Your profile" onPress={() => router.navigate('/customer/profile')}>
          <Avatar uri={user?.avatar_url ?? null} name={fullName || 'You'} size={44} />
        </PressableFeedback>
      </CollapseOnScroll>

      <PressableFeedback
        accessibilityRole="search"
        accessibilityLabel="Search artists and services"
        onPress={search}
        style={{ marginTop: theme.spacing.lg, marginHorizontal: theme.spacing.md, height: 50, borderRadius: 14, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.separator, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, ...theme.shadows.sm }}
      >
        <Icon name="search" size={18} color={theme.colors.brand} />
        <AppText variant="body" style={{ color: theme.colors.textMuted }}>Search artists, services or styles</AppText>
      </PressableFeedback>

      {place ? null : (
        <View style={{ marginTop: theme.spacing.lg, paddingHorizontal: theme.spacing.md }}>
          <LocationCard phone={phone} onSearch={() => setPicking(true)} />
        </View>
      )}

      {place && slides.length ? (
        <View style={{ marginTop: theme.spacing.lg }}>
          <HomeHero slides={slides} onOpen={openSlide} scrollY={scrollY} />
        </View>
      ) : null}

      {categories.isPending ? (
        <View style={{ marginTop: theme.spacing.lg }}><LoadingView label="Loading services" shape="icons" /></View>
      ) : categories.isError ? (
        <View style={{ marginTop: theme.spacing.lg, paddingHorizontal: theme.spacing.md }}><ErrorView error={categories.error} onRetry={() => { void categories.refetch(); }} /></View>
      ) : categories.data?.length ? (
        <View style={{ marginTop: theme.spacing.lg }}>
          <CategoryIconRow categories={categories.data} onPick={(c) => router.navigate({ pathname: '/customer/explore', params: { categoryId: String(c.id) } })} />
        </View>
      ) : null}

      <SectionHeader title="Discover artists near you" onSeeAll={explore} seeAllLabel="See all artists" />
      {artists.isPending ? <LoadingView label="Loading artists near you" shape="tiles" /> : null}
      {artists.isError ? <View style={{ paddingHorizontal: theme.spacing.md }}><ErrorView error={artists.error} onRetry={() => { void artists.refetch(); }} /></View> : null}
      {artists.isSuccess && !items.length ? (
        <View style={{ paddingHorizontal: theme.spacing.md, gap: theme.spacing.md }}>
          <EmptyView message={place ? `No artists ${placeLine(place, radiusKm)} yet.` : 'No artists yet. Check back soon.'} />
          {place ? <AppButton label="Change location" variant="secondary" onPress={() => setPicking(true)} /> : null}
        </View>
      ) : null}
      {items.length ? (
        <FlatList
          horizontal
          data={items}
          keyExtractor={(a) => a.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: theme.spacing.md, gap: 12 }}
          renderItem={({ item, index }) => (
            <MotionEntrance index={index} armed={tilesArmed}>
              <ArtistTile artist={item} saved={saveArtist.isSaved(item.id)} onPress={() => openArtist(item.id)} onToggleSave={() => saveArtist.toggle(item.id)} />
            </MotionEntrance>
          )}
        />
      ) : null}

      <HomeTopRated artists={topRated.data ?? []} onOpen={openArtist} onSeeAll={exploreTopRated} />

      <View style={{ marginTop: theme.spacing.lg, paddingHorizontal: theme.spacing.md }}>
        <ShopBanner onPress={() => router.navigate('/customer/shop')} />
      </View>

      <PlaceSheet
        visible={picking}
        current={place}
        phone={phone}
        onPick={(next) => { setPlace(next); setPicking(false); }}
        onClose={() => setPicking(false)}
      />
    </ScrollContainer>
  );
}
