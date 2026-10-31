import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../../src/components/common/AppText';
import { AppButton } from '../../../src/components/common/AppButton';
import { ChoiceSheet } from '../../../src/components/common/ChoiceSheet';
import { EmptyView, ErrorView, LoadingView } from '../../../src/components/common/StateViews';
import { MotionEntrance } from '../../../src/components/common/MotionEntrance';
import { useEntranceWindow } from '../../../src/core/motion/motion';
import { Icon } from '../../../src/components/common/Icon';
import { PlaceSheet } from '../../../src/components/directory/PlaceSheet';
import { ExploreFeaturedCard } from '../../../src/components/directory/ExploreFeaturedCard';
import { ExploreFilterBar } from '../../../src/components/directory/ExploreFilterBar';
import type { FilterChipSpec } from '../../../src/components/directory/ExploreFilterBar';
import { ExploreResultRow } from '../../../src/components/directory/ExploreResultRow';
import { ExploreResultsHeader } from '../../../src/components/directory/ExploreResultsHeader';
import { useCity, useCustomerPlace } from '../../../src/context/directory/city-context';
import { placeLine } from '../../../src/utils/directory/place';
import { useTheme } from '../../../src/core/theme/theme-provider';
import { useCategories } from '../../../src/hooks/catalog/catalog';
import { useDebounced } from '../../../src/hooks/common/use-debounced';
import { useNow } from '../../../src/hooks/common/use-now';
import { useArtistSearch, usePrefetchArtist } from '../../../src/hooks/directory/directory';
import { TOP_RATED, useExploreFilters } from '../../../src/hooks/directory/use-explore-filters';
import { useSaveToggle } from '../../../src/hooks/saved/saved';
import { formatPrice } from '../../../src/utils/common/format';
import { formatDay, istDateKey } from '../../../src/utils/common/time';
import { availabilityLabel } from '../../../src/utils/directory/format';
import { SORT_LABELS, dateChoices, priceChoices, sortChoices } from '../../../src/utils/directory/explore-choices';
import { usePullToRefresh } from '../../../src/hooks/common/use-pull-to-refresh';

const SEARCH_DEBOUNCE_MS = 300;
const PLACEHOLDER_OPACITY = 0.55;
type Sheet = 'city' | 'date' | 'price' | 'sort' | null;

/** A chip selection seeded from a search param; a new param re-selects the chip. */
function useParamSelection<T>(fromParam: T): [T, (value: T) => void] {
  const [seenParam, setSeenParam] = useState(fromParam);
  const [selected, setSelected] = useState(fromParam);
  if (fromParam !== seenParam) { // reset during render (no effect) when navigation brings a new category
    setSeenParam(fromParam);
    setSelected(fromParam);
  }
  return [selected, setSelected];
}

/** Home's category circles open Explore with `?categoryId=`; any screen can open it with `?city=`. */
function useExploreParams(): { categoryId: number | null; city: string | null } {
  const { categoryId, city } = useLocalSearchParams<{ categoryId?: string; city?: string }>();
  return { categoryId: categoryId && /^\d+$/.test(categoryId) ? Number(categoryId) : null, city: city || null };
}

// AtelierScreen "explore": search, filter chips (Near me, Date, Price, 4.8+, Home visit), "N artists in City" with a
// sort, then a featured first artist and compact rows. The city is shared with Home.
export default function Explore() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const q = useDebounced(query.trim(), SEARCH_DEBOUNCE_MS);
  const params = useExploreParams();
  const [categoryId, setCategoryId] = useParamSelection(params.categoryId);
  const { setCity } = useCity();
  const { place, setPlace } = useCustomerPlace();
  useEffect(() => { if (params.city) setCity(params.city); }, [params.city, setCity]); // a `?city=` link wins
  const categories = useCategories();
  const explore = useExploreFilters({ place, categoryId, q });
  const { filters, set } = explore;
  const list = useArtistSearch(explore.search);
  const pull = usePullToRefresh(list.refetch);
  const saveArtist = useSaveToggle('artist');
  const [sheet, setSheet] = useState<Sheet>(null);
  const todayKey = istDateKey(useNow());

  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  const rowsArmed = useEntranceWindow(items.length > 0); // only the first batch cascades; a new search keeps `armed` closed
  const total = list.data?.pages[0]?.total ?? null;
  const shown = total ?? items.length;
  const count = `${shown}${total === null && list.hasNextPage ? '+' : ''} ${shown === 1 && !list.hasNextPage ? 'artist' : 'artists'}`;
  const where = placeLine(place, list.data?.pages[0]?.radius_km);
  const category = categories.data?.find((c) => c.id === categoryId);
  const filtered = explore.active || !!category;
  const prefetchArtist = usePrefetchArtist();
  const openArtist = (id: string) => {
    prefetchArtist(id);
    router.push({ pathname: '/customer/artist/[id]', params: { id } });
  };
  const close = () => setSheet(null);

  const chips: FilterChipSpec[] = [
    ...(category ? [{ key: 'category', label: `${category.name} ×`, accessibilityLabel: `Remove ${category.name} filter`, active: true, onPress: () => setCategoryId(null) }] : []),
    { key: 'near', label: explore.locating ? 'Locating…' : 'Near me', accessibilityLabel: 'Near me', icon: 'map-pin', active: explore.nearMe, onPress: () => { void explore.toggleNear(); } },
    { key: 'date', label: filters.availableOn ? formatDay(filters.availableOn) : 'Date', accessibilityLabel: 'Date', opensMenu: true, active: !!filters.availableOn, onPress: () => setSheet('date') },
    { key: 'price', label: filters.maxPricePaise ? `Under ${formatPrice(filters.maxPricePaise)}` : 'Price', accessibilityLabel: 'Price', opensMenu: true, active: filters.maxPricePaise !== null, onPress: () => setSheet('price') },
    { key: 'rating', label: `★ ${TOP_RATED}+`, accessibilityLabel: `Rated ${TOP_RATED} and up`, active: filters.minRating !== null, onPress: () => set({ minRating: filters.minRating === null ? TOP_RATED : null }) },
    { key: 'home', label: 'Home visit', active: filters.homeVisit, onPress: () => set({ homeVisit: !filters.homeVisit }) },
  ];

  const empty = list.isPending ? <LoadingView label="Loading artists" count={5} />
    : list.isError ? <ErrorView error={list.error} onRetry={() => { void list.refetch(); }} />
      : (
        <View style={{ gap: theme.spacing.md }}>
          <EmptyView message={filtered ? 'No artists match these filters.' : `No artists ${where} yet.`} />
          {filtered ? <AppButton label="Clear filters" variant="secondary" onPress={() => { explore.clear(); setCategoryId(null); }} /> : null}
        </View>
      );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top + theme.spacing.md }}>
      <View style={{ paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.sm }}>
        <AppText variant="display" style={{ fontSize: 36, lineHeight: 38, color: theme.colors.heading }}>Explore</AppText>
        <View style={{ marginTop: 14, height: 46, borderRadius: 12, backgroundColor: theme.colors.brandSoft, borderWidth: 1, borderColor: theme.colors.separator, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 }}>
          <Icon name="search" size={17} color={theme.colors.brand} />
          <TextInput
            accessibilityLabel="Search artists"
            placeholder="Search artists or services"
            placeholderTextColor={theme.colors.textMuted}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            returnKeyType="search"
            cursorColor={theme.colors.brand}
            style={{ flex: 1, height: 44, color: theme.colors.textPrimary, fontFamily: theme.typography.body.fontFamily, fontSize: 14 }}
          />
        </View>
      </View>
      <ExploreFilterBar chips={chips} />
      {explore.locationError ? (
        <AppText variant="caption" accessibilityLiveRegion="polite" style={{ color: theme.colors.error, paddingHorizontal: theme.spacing.md, marginTop: 8 }}>{explore.locationError}</AppText>
      ) : null}
      <FlashList
        refreshing={pull.refreshing}
        onRefresh={pull.onRefresh}
        data={items}
        keyExtractor={(a) => a.id}
        style={{ opacity: list.isPlaceholderData ? PLACEHOLDER_OPACITY : 1 }} // the previous search, until the new one answers
        contentContainerStyle={{ paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.xl, gap: 12 }}
        renderItem={({ item, index }) => (index === 0 ? (
          <MotionEntrance index={index} armed={rowsArmed}>
            <ExploreFeaturedCard
              artist={item}
              availability={availabilityLabel(item.free_on, todayKey)}
              saved={saveArtist.isSaved(item.id)}
              onToggleSave={() => saveArtist.toggle(item.id)}
              onPress={() => openArtist(item.id)}
            />
          </MotionEntrance>
        ) : (
          <MotionEntrance index={index} armed={rowsArmed}>
            <ExploreResultRow artist={item} availability={availabilityLabel(item.free_on, todayKey)} onPress={() => openArtist(item.id)} />
          </MotionEntrance>
        ))}
        onEndReachedThreshold={0.5}
        onEndReached={() => { if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage(); }}
        ListHeaderComponent={
          <ExploreResultsHeader
            count={list.isSuccess ? count : ''}
            where={where}
            sortLabel={SORT_LABELS[filters.sort]}
            onWhere={() => setSheet('city')}
            onSort={() => setSheet('sort')}
          />
        }
        ListEmptyComponent={empty}
        ListFooterComponent={list.isFetchingNextPage ? <LoadingView label="Loading more" shape="spinner" /> : null}
      />
      <PlaceSheet visible={sheet === 'city'} current={place} phone={explore.phone} onPick={(next) => { setPlace(next); close(); }} onClose={close} />
      <ChoiceSheet visible={sheet === 'date'} title="Free on" choices={dateChoices(todayKey)} selected={filters.availableOn} onPick={(availableOn) => { set({ availableOn }); close(); }} onClose={close} />
      <ChoiceSheet visible={sheet === 'price'} title="Starting price" choices={priceChoices()} selected={filters.maxPricePaise} onPick={(maxPricePaise) => { set({ maxPricePaise }); close(); }} onClose={close} />
      <ChoiceSheet visible={sheet === 'sort'} title="Sort by" choices={sortChoices(explore.hasPoint)} selected={filters.sort} onPick={(sort) => { set({ sort }); close(); }} onClose={close} />
    </View>
  );
}
