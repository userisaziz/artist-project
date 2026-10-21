import { useState, type ReactElement } from 'react';
import { FlatList, View } from 'react-native';
import type { InfiniteData, UseInfiniteQueryResult } from '@tanstack/react-query';
import type { Page } from '../../core/api/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../common/AppText';
import { BackHeader } from '../common/BackHeader';
import { Segmented } from '../common/Segmented';
import { EmptyView, ErrorView, LoadingView } from '../common/StateViews';
import { useTheme } from '../../core/theme/theme-provider';
import { useSavedArtists, useSavedPosts, useSavedProducts } from '../../hooks/saved/saved';
import type { Post } from '../../types/feed/feed';
import type { ArtistCard } from '../../types/directory/directory';
import type { Product } from '../../types/shop/shop';

type Tab = 'posts' | 'artists' | 'products';

const TABS: { key: Tab; label: string; empty: string }[] = [
  { key: 'posts', label: 'Posts', empty: 'Tap the bookmark on a look or guide to keep it here.' },
  { key: 'artists', label: 'Artists', empty: 'Save artists from their page to find them again.' },
  { key: 'products', label: 'Products', empty: 'Save products from the shop to come back to them.' },
];

/** The app layer draws each item with the owning feature's card, so this screen stays within its feature. */
export interface SavedRenderers {
  post: (post: Post) => ReactElement;
  artist: (artist: ArtistCard) => ReactElement;
  product: (product: Product) => ReactElement;
}

/** Profile → Saved: the customer's saved posts, artists and products, newest saved first. */
export function SavedScreen({ render }: { render: SavedRenderers }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('posts');
  // All three load up front (one small page each), so switching tabs is instant.
  const posts = useSavedPosts();
  const artists = useSavedArtists();
  const products = useSavedProducts();
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top + theme.spacing.sm }}>
      <View style={{ paddingHorizontal: theme.spacing.md, gap: 12, paddingBottom: 8 }}>
        <BackHeader />
        <AppText variant="display" style={{ fontSize: 30, lineHeight: 34, color: theme.colors.heading }}>Saved</AppText>
        <Segmented options={TABS.map(({ key, label }) => ({ key, label }))} value={tab} onChange={setTab} />
      </View>
      {tab === 'posts' ? <SavedList list={posts} empty={TABS[0].empty} renderItem={render.post} /> : null}
      {tab === 'artists' ? <SavedList list={artists} empty={TABS[1].empty} renderItem={render.artist} padded /> : null}
      {tab === 'products' ? <SavedList list={products} empty={TABS[2].empty} renderItem={render.product} padded /> : null}
    </View>
  );
}

interface SavedListProps<T extends { id: string }> {
  list: UseInfiniteQueryResult<InfiniteData<Page<T>, unknown>>;
  empty: string;
  renderItem: (item: T) => ReactElement;
  padded?: boolean;
}

function SavedList<T extends { id: string }>({ list, empty, renderItem, padded = false }: SavedListProps<T>) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  if (list.isPending) return <LoadingView label="Loading your saved items" />;
  if (list.isError && !list.data) return <ErrorView error={list.error} onRetry={() => { void list.refetch(); }} />;
  if (!items.length) return <EmptyView message={empty} />;
  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => renderItem(item)}
      onEndReached={() => { if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage(); }}
      contentContainerStyle={{ gap: padded ? 12 : 0, paddingHorizontal: padded ? theme.spacing.md : 0, paddingBottom: insets.bottom + theme.spacing.xl }}
    />
  );
}
