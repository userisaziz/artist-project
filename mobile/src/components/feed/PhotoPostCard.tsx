import { View } from 'react-native';
import { AppText } from '../common/AppText';
import { BookLookButton } from './BookLookButton';
import { LikeButton } from './LikeButton';
import { ReportPostButton } from './ReportPostButton';
import { SaveButton } from '../common/SaveButton';
import { PhotoCarousel } from './PhotoCarousel';
import { PostAuthor } from './PostAuthor';
import { useTheme } from '../../core/theme/theme-provider';
import type { Post } from '../../types/feed/feed';
import type { FeedNavigation } from './navigation';

/** Prototype photo post: author row, swipeable photos, "Book this look", likes, and the caption. */
export function PhotoPostCard({ post, now, nav }: { post: Post; now: number; nav: FeedNavigation }) {
  const theme = useTheme();
  const { service } = post;
  return (
    <View style={{ gap: 10, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.colors.separator }}>
      <View style={{ paddingHorizontal: theme.spacing.md }}>
        <PostAuthor post={post} now={now} onOpenArtist={nav.openArtist} />
      </View>
      <PhotoCarousel key={post.id} photos={post.photos} label={`${post.artist.business_name}’s post`} />
      <View style={{ paddingHorizontal: theme.spacing.md, gap: 8 }}>
        {service ? <BookLookButton service={service} onPress={() => nav.book(post.artist.id, service.id)} /> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <LikeButton post={post} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {nav.savePost ? <SaveButton name={`${post.artist.business_name}’s post`} saved={nav.savePost.isSaved(post.id)} onPress={() => nav.savePost?.toggle(post.id)} /> : null}
            <ReportPostButton postId={post.id} />
          </View>
        </View>
        {post.text ? (
          <AppText variant="body" style={{ fontSize: 13.5, color: theme.colors.textPrimary }}>
            <AppText variant="label" style={{ fontSize: 13.5 }}>{post.artist.business_name} </AppText>
            {post.text}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}
