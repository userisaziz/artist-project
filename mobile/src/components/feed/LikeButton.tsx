import { Alert } from 'react-native';
import { PressableFeedback } from '../common/PressableFeedback';
import { AppText } from '../common/AppText';
import { useTheme } from '../../core/theme/theme-provider';
import { errorMessage } from '../../core/api/error-message';
import { useToggleLike } from '../../hooks/feed/feed';
import { compactCount } from '../../utils/feed/article';
import type { Post } from '../../types/feed/feed';
import { Icon } from '../common/Icon';

/** A heart and the like count; tapping toggles the reader's like. */
export function LikeButton({ post }: { post: Post }) {
  const theme = useTheme();
  const like = useToggleLike();
  const count = `${post.like_count} ${post.like_count === 1 ? 'like' : 'likes'}`;
  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityLabel={post.liked ? `Unlike, ${count}` : `Like, ${count}`}
      accessibilityState={{ selected: post.liked, busy: like.isPending }}
      hitSlop={8}
      onPress={() => like.mutate(post, { onError: (e) => Alert.alert('Couldn’t update', errorMessage(e)) })}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
    >
      <Icon name="heart" size={20} color={post.liked ? theme.colors.brand : theme.colors.textSecondary} filled={post.liked} />
      <AppText variant="label" style={{ fontSize: 13, color: theme.colors.textPrimary }}>{compactCount(post.like_count)}</AppText>
    </PressableFeedback>
  );
}
