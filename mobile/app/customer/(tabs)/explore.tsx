import { useState } from 'react';
import { FlatList, ScrollView, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../../src/components/common/AppText';
import { Chip } from '../../../src/components/common/Chip';
import { EmptyView, ErrorView, LoadingView } from '../../../src/components/common/StateViews';
import { useTheme } from '../../../src/core/theme/theme-provider';
import { useCategories } from '../../../src/hooks/artist-onboarding/artist-onboarding';
import { useArtistList } from '../../../src/hooks/directory/directory';
import { useDebounced } from '../../../src/hooks/common/use-debounced';
import { ArtistCardView } from '../../../src/components/directory/ArtistCardView';

const SEARCH_DEBOUNCE_MS = 300;

/** Home's category circles open Explore with `?categoryId=`; a new param re-selects the chip. */
function useCategoryParam(): [number | null, (id: number | null) => void] {
  const { categoryId } = useLocalSearchParams<{ categoryId?: string }>();
  const fromParam = categoryId && /^\d+$/.test(categoryId) ? Number(categoryId) : null;
  const [seenParam, setSeenParam] = useState(fromParam);
  const [selected, setSelected] = useState(fromParam);
  if (fromParam !== seenParam) { // reset during render (no effect) when navigation brings a new category
    setSeenParam(fromParam);
    setSelected(fromParam);
  }
  return [selected, setSelected];
}

// Spec §2 Explore: debounced search, category chips, "N artists" and an infinite list.
export default function Explore() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const q = useDebounced(query.trim(), SEARCH_DEBOUNCE_MS);
  const [categoryId, setCategoryId] = useCategoryParam();
  const categories = useCategories();
  const list = useArtistList(categoryId, q);
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  const count = `${items.length}${list.hasNextPage ? '+' : ''} ${items.length === 1 && !list.hasNextPage ? 'artist' : 'artists'}`;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top + theme.spacing.md }}>
      <View style={{ paddingHorizontal: theme.spacing.md }}>
        <AppText variant="display" style={{ fontSize: 30, lineHeight: 34, color: theme.colors.heading }}>Explore</AppText>
        <View style={{ marginTop: 12, height: 48, borderRadius: theme.radii.pill, borderWidth: 1, borderColor: theme.colors.border, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16 }}>
          <AppText style={{ color: theme.colors.brand, fontSize: 18 }}>⌕</AppText>
          <TextInput
            accessibilityLabel="Search artists"
            placeholder="Search artists or services"
            placeholderTextColor={theme.colors.textMuted}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            returnKeyType="search"
            cursorColor={theme.colors.brand}
            style={{ flex: 1, height: 46, color: theme.colors.textPrimary, fontFamily: theme.typography.body.fontFamily, fontSize: 15 }}
          />
        </View>
      </View>
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: theme.spacing.md, paddingVertical: 12 }}>
          <Chip label="All" selected={categoryId === null} onPress={() => setCategoryId(null)} />
          {(categories.data ?? []).map((c) => (
            <Chip key={c.id} label={c.name} selected={categoryId === c.id} onPress={() => setCategoryId(categoryId === c.id ? null : c.id)} />
          ))}
        </ScrollView>
      </View>
      <FlatList
        data={items}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.xl, gap: 12 }}
        renderItem={({ item }) => <ArtistCardView artist={item} onPress={() => router.push({ pathname: '/customer/artist/[id]', params: { id: item.id } })} />}
        onEndReachedThreshold={0.5}
        onEndReached={() => { if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage(); }}
        ListHeaderComponent={list.isSuccess ? <AppText variant="label" style={{ color: theme.colors.textMuted }}>{count}</AppText> : null}
        ListEmptyComponent={
          list.isPending ? <LoadingView />
            : list.isError ? <ErrorView error={list.error} onRetry={() => { void list.refetch(); }} />
              : <EmptyView message="No artists match yet. Try another category." />
        }
        ListFooterComponent={list.isFetchingNextPage ? <LoadingView label="Loading more" /> : null}
      />
    </View>
  );
}
