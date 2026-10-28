import { SaveButton, type SaveToggle } from '../common/SaveButton';
import { View } from 'react-native';
import { PressableFeedback } from '../common/PressableFeedback';
import { AppText } from '../common/AppText';
import { Avatar } from '../common/Avatar';
import { Photo } from '../common/Photo';
import { useTheme } from '../../core/theme/theme-provider';
import { shortAgo } from '../../utils/common/time';
import { topicLabel } from '../../utils/feed/article';
import type { Post } from '../../types/feed/feed';

const COVER_HEIGHT = 180;

/** Prototype article card: cover, "Guide · 6 min read", title, excerpt, and the author. Opens the article. */
interface ArticleCardProps { post: Post; now: number; onOpen: () => void; save?: SaveToggle }

export function ArticleCard({ post, now, onOpen, save }: ArticleCardProps) {
  const theme = useTheme();
  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityLabel={`${post.title}, ${topicLabel(post)} by ${post.artist.business_name}`}
      onPress={onOpen}
      style={{ margin: theme.spacing.md, borderRadius: theme.radii.card, borderWidth: 1, borderColor: theme.colors.separator, backgroundColor: theme.colors.surface, overflow: 'hidden' }}
    >
      {post.cover_url ? <Photo uri={post.cover_url} style={{ width: '100%', height: COVER_HEIGHT }} /> : null}
      <View style={{ padding: 14, gap: 6 }}>
        <AppText variant="caption" style={{ color: theme.colors.brand, textTransform: 'uppercase', letterSpacing: 0.8 }}>{topicLabel(post)}</AppText>
        <AppText variant="display" style={{ fontSize: 22, lineHeight: 26, color: theme.colors.heading }}>{post.title ?? ''}</AppText>
        {post.excerpt ? <AppText variant="body" numberOfLines={3} style={{ fontSize: 13.5, color: theme.colors.textSecondary }}>{post.excerpt}</AppText> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <Avatar uri={post.artist.photo_url} name={post.artist.business_name} size={24} />
          <AppText variant="caption" style={{ flex: 1, color: theme.colors.textMuted }}>{`${post.artist.business_name} · ${shortAgo(post.created_at, now)}`}</AppText>
          {save ? <SaveButton name={post.title ?? 'this guide'} saved={save.isSaved(post.id)} onPress={() => save.toggle(post.id)} /> : null}
        </View>
      </View>
    </PressableFeedback>
  );
}
