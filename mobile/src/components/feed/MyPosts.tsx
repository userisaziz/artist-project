import { Alert, FlatList, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../common/AppText';
import { AppButton } from '../common/AppButton';
import { BackHeader } from '../common/BackHeader';
import { Photo } from '../common/Photo';
import { EmptyView, ErrorView, LoadingView } from '../common/StateViews';
import { useTheme } from '../../core/theme/theme-provider';
import { errorMessage } from '../../core/api/error-message';
import { useDeletePost, useMyPosts } from '../../hooks/feed/feed';
import { useNow } from '../../hooks/common/use-now';
import { shortAgo } from '../../utils/common/time';
import { compactCount, topicLabel } from '../../utils/feed/article';
import type { Post } from '../../types/feed/feed';

const THUMB = 64;

/** Me → Posts & articles: the artist's posts, newest first, each deletable; "New post" on top. */
export function MyPosts({ onNewPost }: { onNewPost: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const now = useNow();
  const posts = useMyPosts();
  const remove = useDeletePost();
  const items = posts.data?.pages.flatMap((p) => p.items) ?? [];

  const confirmDelete = (post: Post) =>
    Alert.alert('Delete this post?', 'It disappears from the feed for everyone.', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(post.id, { onError: (e) => Alert.alert('Couldn’t delete', errorMessage(e)) }) },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top + theme.spacing.sm, paddingHorizontal: theme.spacing.md }}>
      <BackHeader title="Posts & articles" />
      <View style={{ marginVertical: 12 }}><AppButton label="+ New post" onPress={onNewPost} /></View>
      {posts.isPending ? <LoadingView label="Loading your posts" /> : null}
      {posts.isError && !posts.data ? <ErrorView error={posts.error} onRetry={() => { void posts.refetch(); }} /> : null}
      {posts.isSuccess && !items.length ? <EmptyView message="Share your work: a photo set of a finished look, or a guide for clients." /> : null}
      {items.length ? (
        <FlatList
          data={items}
          keyExtractor={(p) => p.id}
          onEndReached={() => { if (posts.hasNextPage && !posts.isFetchingNextPage) void posts.fetchNextPage(); }}
          renderItem={({ item }) => {
            const thumb = item.cover_url ?? item.photos[0]?.url;
            return (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.separator }}>
                {thumb ? <Photo uri={thumb} style={{ width: THUMB, height: THUMB, borderRadius: theme.radii.md }} /> : null}
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="subtitle" numberOfLines={2} style={{ fontSize: 14, color: theme.colors.textPrimary }}>{item.title ?? item.text ?? ''}</AppText>
                  <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{`${topicLabel(item)} · ${shortAgo(item.created_at, now)} · ♥ ${compactCount(item.like_count)}`}</AppText>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel="Delete post" hitSlop={8} disabled={remove.isPending} onPress={() => confirmDelete(item)}>
                  <AppText variant="label" style={{ color: theme.colors.error }}>Delete</AppText>
                </Pressable>
              </View>
            );
          }}
        />
      ) : null}
    </View>
  );
}
