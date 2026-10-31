import { View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../common/AppText';
import { Avatar } from '../common/Avatar';
import { BackHeader } from '../common/BackHeader';
import { EmptyView, ErrorView, LoadingView } from '../common/StateViews';
import { useTheme } from '../../core/theme/theme-provider';
import { useMyFollowers } from '../../hooks/feed/feed';
import { useNow } from '../../hooks/common/use-now';
import { shortAgo } from '../../utils/common/time';

/** Me → Followers: the customers who follow the artist, newest first. */
export function FollowersList() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const now = useNow();
  const followers = useMyFollowers();
  const items = followers.data?.pages.flatMap((p) => p.items) ?? [];
  const total = followers.data?.pages[0]?.total ?? 0;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top + theme.spacing.sm, paddingHorizontal: theme.spacing.md }}>
      <BackHeader title="Followers" />
      {followers.isPending ? <LoadingView label="Loading your followers" /> : null}
      {followers.isError && !followers.data ? <ErrorView error={followers.error} onRetry={() => { void followers.refetch(); }} /> : null}
      {followers.isSuccess && !items.length ? <EmptyView message="No followers yet. Posts and guides bring them in." /> : null}
      {items.length ? (
        <FlashList
          data={items}
          keyExtractor={(f, i) => `${f.followed_at}:${i}`}
          ListHeaderComponent={<AppText variant="caption" style={{ color: theme.colors.textMuted, marginVertical: 8 }}>{total === 1 ? '1 follower' : `${total} followers`}</AppText>}
          renderItem={({ item }) => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.separator }}>
              <Avatar uri={item.photo_url} name={item.name} size={40} />
              <AppText variant="label" style={{ flex: 1, color: theme.colors.textPrimary }}>{item.name}</AppText>
              <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{shortAgo(item.followed_at, now)}</AppText>
            </View>
          )}
          onEndReached={() => { if (followers.hasNextPage && !followers.isFetchingNextPage) void followers.fetchNextPage(); }}
          contentContainerStyle={{ paddingBottom: insets.bottom + theme.spacing.xl }}
        />
      ) : null}
    </View>
  );
}
