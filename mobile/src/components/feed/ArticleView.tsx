import { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../common/AppText';
import { AppButton } from '../common/AppButton';
import { BackHeader } from '../common/BackHeader';
import { Photo } from '../common/Photo';
import { ErrorView, LoadingView } from '../common/StateViews';
import { ArticleBlockView } from './ArticleBlockView';
import { LikeButton } from './LikeButton';
import { ReportPostButton } from './ReportPostButton';
import { PhotoCarousel } from './PhotoCarousel';
import { PostAuthor } from './PostAuthor';
import { useTheme } from '../../core/theme/theme-provider';
import { usePost } from '../../hooks/feed/feed';
import { useNow } from '../../hooks/common/use-now';
import { articleBlocks, topicLabel } from '../../utils/feed/article';
import type { FeedNavigation } from './navigation';

const HERO_HEIGHT = 260;

/** Prototype Article: hero, "Guide · 6 min read", title, author with Follow, the body, a "Written by" card,
 *  and a footer with likes and "Book <artist>" (the linked service, or the storefront). Photo posts opened
 *  from a link render as the photos with their caption. */
export function ArticleView({ postId, nav }: { postId: string; nav: FeedNavigation }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const now = useNow();
  const post = usePost(postId);
  const p = post.data;
  const blocks = useMemo(() => articleBlocks(p?.body ?? p?.text ?? ''), [p?.body, p?.text]);

  if (!p) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top + theme.spacing.sm, paddingHorizontal: theme.spacing.md }}>
        <BackHeader />
        {post.isError ? <ErrorView error={post.error} onRetry={() => { void post.refetch(); }} /> : <LoadingView label="Loading the article" />}
      </View>
    );
  }
  const { artist, service } = p;
  const firstName = artist.business_name.split(' ')[0];
  const book = () => (service ? nav.book(artist.id, service.id) : nav.openArtist(artist.id));
  const rating = artist.rating_average ? `★ ${artist.rating_average} (${artist.rating_count}) · ${artist.city}` : artist.city;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}>
        <View style={{ paddingTop: insets.top + theme.spacing.sm, paddingHorizontal: theme.spacing.md }}>
          <BackHeader />
        </View>
        {p.kind === 'article' && p.cover_url ? <Photo uri={p.cover_url} style={{ width: '100%', height: HERO_HEIGHT, marginTop: 8 }} /> : null}
        {p.kind === 'photos' ? <View style={{ marginTop: 8 }}><PhotoCarousel key={p.id} photos={p.photos} label={`${artist.business_name}’s post`} /></View> : null}
        <View style={{ padding: theme.spacing.md, gap: 12 }}>
          <AppText variant="caption" style={{ color: theme.colors.brand, textTransform: 'uppercase', letterSpacing: 0.8 }}>{topicLabel(p)}</AppText>
          {p.title ? <AppText variant="display" accessibilityRole="header" style={{ fontSize: 30, lineHeight: 34, color: theme.colors.heading }}>{p.title}</AppText> : null}
          <PostAuthor post={p} now={now} onOpenArtist={nav.openArtist} />
          {blocks.map((b, i) => <ArticleBlockView key={i} block={b} />)}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Written by ${artist.business_name}, ${rating}`}
            onPress={() => nav.openArtist(artist.id)}
            style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: theme.radii.card, backgroundColor: theme.colors.brandSoft }}
          >
            {artist.photo_url ? <Photo uri={artist.photo_url} style={{ width: 52, height: 52, borderRadius: theme.radii.md }} /> : null}
            <View style={{ flex: 1 }}>
              <AppText variant="caption" style={{ color: theme.colors.textMuted, letterSpacing: 0.8 }}>WRITTEN BY</AppText>
              <AppText variant="subtitle" style={{ color: theme.colors.textPrimary }}>{artist.business_name}</AppText>
              <AppText variant="caption" style={{ color: theme.colors.textSecondary }}>{rating}</AppText>
            </View>
            <AppText style={{ color: theme.colors.textMuted, fontSize: 18 }}>›</AppText>
          </Pressable>
        </View>
      </ScrollView>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: theme.spacing.md, paddingTop: 12, paddingBottom: insets.bottom + 12, backgroundColor: theme.colors.surface, borderTopWidth: 1, borderTopColor: theme.colors.separator }}>
        <LikeButton post={p} />
        <ReportPostButton postId={p.id} />
        <View style={{ flex: 1 }}>
          <AppButton label={`Book ${firstName}`} onPress={book} />
        </View>
      </View>
    </View>
  );
}
