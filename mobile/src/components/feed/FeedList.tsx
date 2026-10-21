import { useState } from 'react';
import { FlatList, ScrollView, View } from 'react-native';
import { useIsFocused } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../common/AppText';
import { AppTextField } from '../common/AppTextField';
import { Chip } from '../common/Chip';
import { EmptyView, ErrorView, LoadingView } from '../common/StateViews';
import { ArticleCard } from './ArticleCard';
import { PhotoPostCard } from './PhotoPostCard';
import { useTheme } from '../../core/theme/theme-provider';
import { useFeed } from '../../hooks/feed/feed';
import { useNow } from '../../hooks/common/use-now';
import { useDebouncedValue } from '../../hooks/common/use-debounced-value';
import type { FeedTab } from '../../types/feed/feed';
import type { FeedNavigation } from './navigation';
import { Icon } from '../common/Icon';

const SEARCH_MAX = 60; // backend feed SEARCH_MAX

const TABS: { key: FeedTab; label: string; empty: string }[] = [
  { key: 'for_you', label: 'For you', empty: 'Nothing here yet. Artists’ looks and guides will show up here.' },
  { key: 'following', label: 'Following', empty: 'Follow artists to see their posts here.' },
  { key: 'stories', label: 'Stories & guides', empty: 'No stories or guides yet.' },
];

/** Prototype Feed: the title, filter chips, then photo posts and article cards, newest first. */
export function FeedList({ nav }: { nav: FeedNavigation }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const now = useNow();
  const [tab, setTab] = useState<FeedTab>('for_you');
  const [query, setQuery] = useState('');
  const q = useDebouncedValue(query.trim());
  const feed = useFeed(tab, q);
  const focused = useIsFocused();
  const items = feed.data?.pages.flatMap((p) => p.items) ?? [];
  const current = TABS.find((t) => t.key === tab) ?? TABS[0];
  const empty = q ? `No posts match “${q}”.` : current.empty;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top + theme.spacing.sm }}>
      <View style={{ paddingHorizontal: theme.spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <AppText variant="display" style={{ fontSize: 30, lineHeight: 34, color: theme.colors.heading }}>Feed</AppText>
          <Icon name="sparkles" size={20} color={theme.colors.brand} />
        </View>
        <View style={{ marginTop: 10 }}>
          <AppTextField label="Search the feed" hideLabel placeholder="Search looks, guides or artists" value={query} onChangeText={setQuery} maxLength={SEARCH_MAX} autoCorrect={false} returnKeyType="search" />
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: theme.spacing.md, paddingVertical: 12 }} style={{ flexGrow: 0 }}>
        {TABS.map((t) => <Chip key={t.key} label={t.label} selected={t.key === tab} onPress={() => setTab(t.key)} />)}
      </ScrollView>
      {feed.isPending ? <LoadingView label="Loading the feed" /> : null}
      {feed.isError && !feed.data ? <ErrorView error={feed.error} onRetry={() => { void feed.refetch(); }} /> : null}
      {feed.isSuccess && !items.length ? <EmptyView message={empty} /> : null}
      {items.length ? (
        <FlatList
          data={items}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) =>
            item.kind === 'article'
              ? <ArticleCard post={item} now={now} onOpen={() => nav.openPost(item.id)} />
              : <PhotoPostCard post={item} now={now} nav={nav} />
          }
          refreshing={feed.isRefetching && focused}
          onRefresh={() => { void feed.refetch(); }}
          onEndReached={() => { if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage(); }}
          contentContainerStyle={{ paddingBottom: insets.bottom + theme.spacing.xl }}
        />
      ) : null}
    </View>
  );
}
