import { View } from 'react-native';
import { PressableFeedback } from '../common/PressableFeedback';
import { AppText } from '../common/AppText';
import { Photo } from '../common/Photo';
import { useTheme } from '../../core/theme/theme-provider';
import { topicLabel } from '../../utils/feed/article';
import type { Post } from '../../types/feed/feed';

interface ArtistPostCardsProps {
  posts: Post[];
  onOpen: (postId: string) => void;
}

const COVER_HEIGHT = 120;

/** An artist's newest posts as small cards side by side ("From the studio" on their storefront). */
export function ArtistPostCards({ posts, onOpen }: ArtistPostCardsProps) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      {posts.map((post) => {
        const cover = post.cover_url ?? post.photos[0]?.url ?? null;
        const headline = post.title ?? post.text ?? '';
        return (
          <PressableFeedback
            key={post.id}
            accessibilityRole="button"
            accessibilityLabel={`${headline}, ${topicLabel(post)}`}
            onPress={() => onOpen(post.id)}
            style={{ flex: 1, borderRadius: theme.radii.md, borderWidth: 1, borderColor: theme.colors.separator, backgroundColor: theme.colors.surface, overflow: 'hidden' }}
          >
            {cover ? <Photo uri={cover} style={{ width: '100%', height: COVER_HEIGHT }} /> : <View style={{ height: COVER_HEIGHT, backgroundColor: theme.colors.imageFallback }} />}
            <View style={{ padding: 10, gap: theme.spacing.xs }}>
              <AppText variant="eyebrow" style={{ fontSize: 10, color: theme.colors.brand }}>{topicLabel(post).toUpperCase()}</AppText>
              <AppText variant="label" numberOfLines={2} style={{ fontSize: 13, lineHeight: 18, color: theme.colors.textPrimary }}>{headline}</AppText>
            </View>
          </PressableFeedback>
        );
      })}
    </View>
  );
}
