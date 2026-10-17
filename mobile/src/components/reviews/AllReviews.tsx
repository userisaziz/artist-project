import { FlatList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackHeader } from '../common/BackHeader';
import { EmptyView, ErrorView, LoadingView } from '../common/StateViews';
import { useTheme } from '../../core/theme/theme-provider';
import { useArtistPublic } from '../../hooks/directory/directory';
import { usePublicReviews } from '../../hooks/reviews/reviews';
import { ReviewCard } from './ReviewCard';
import { ReviewSummaryView } from './ReviewSummaryView';

/** Spec §2.1 artist/[id]/reviews: every public review, page by page, under the summary. */
export function AllReviews({ artistId }: { artistId: string }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const artist = useArtistPublic(artistId);
  const list = usePublicReviews(artistId);
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  const summary = list.data?.pages[0]?.summary;
  const businessName = artist.data?.business_name ?? '';

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top + theme.spacing.sm }}>
      <View style={{ paddingHorizontal: theme.spacing.md }}>
        <BackHeader title="All reviews" />
      </View>
      <FlatList
        data={items}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: insets.bottom + theme.spacing.xl, gap: 12 }}
        ListHeaderComponent={summary ? <View style={{ marginBottom: 4 }}><ReviewSummaryView summary={summary} /></View> : null}
        renderItem={({ item }) => <ReviewCard review={item} businessName={businessName} />}
        onEndReachedThreshold={0.5}
        onEndReached={() => { if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage(); }}
        ListEmptyComponent={
          list.isPending ? <LoadingView />
            : list.isError ? <ErrorView error={list.error} onRetry={() => { void list.refetch(); }} />
              : <EmptyView message="No reviews yet." />
        }
        ListFooterComponent={list.isFetchingNextPage ? <LoadingView label="Loading more" /> : null}
      />
    </View>
  );
}
