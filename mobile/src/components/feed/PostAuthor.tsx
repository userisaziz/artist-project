import { Alert, Pressable, View } from 'react-native';
import { AppText } from '../common/AppText';
import { Avatar } from '../common/Avatar';
import { useTheme } from '../../core/theme/theme-provider';
import { errorMessage } from '../../core/api/error-message';
import { useToggleFollow } from '../../hooks/feed/feed';
import { shortAgo } from '../../utils/common/time';
import type { Post } from '../../types/feed/feed';
import { Icon } from '../common/Icon';

interface PostAuthorProps {
  post: Post;
  now: number;
  onOpenArtist: (artistId: string) => void;
}

/** Prototype post header: avatar, name with the verified tick, "City · 2h", and Follow / Following. */
export function PostAuthor({ post, now, onOpenArtist }: PostAuthorProps) {
  const theme = useTheme();
  const follow = useToggleFollow();
  const { artist, following } = post;
  const toggle = () =>
    follow.mutate(
      { artistId: artist.id, following: !following },
      { onError: (e) => Alert.alert('Couldn’t update', errorMessage(e)) },
    );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open ${artist.business_name}`} onPress={() => onOpenArtist(artist.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
        <Avatar uri={artist.photo_url} name={artist.business_name} size={40} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <AppText variant="subtitle" numberOfLines={1} style={{ flexShrink: 1, fontSize: 14.5, color: theme.colors.textPrimary }}>{artist.business_name}</AppText>
            <Icon name="verified" size={14} color={theme.colors.brand} label="Verified artist" />
          </View>
          <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{`${artist.city} · ${shortAgo(post.created_at, now)}`}</AppText>
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={following ? `Unfollow ${artist.business_name}` : `Follow ${artist.business_name}`}
        accessibilityState={{ busy: follow.isPending }}
        disabled={follow.isPending}
        onPress={toggle}
        hitSlop={6}
        style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: theme.radii.pill, borderWidth: 1, borderColor: following ? theme.colors.separator : theme.colors.brand, backgroundColor: following ? theme.colors.surface : theme.colors.brandSoft }}
      >
        <AppText variant="label" style={{ fontSize: 12.5, color: following ? theme.colors.textSecondary : theme.colors.brand }}>{following ? 'Following' : 'Follow'}</AppText>
      </Pressable>
    </View>
  );
}
