import { Pressable, View } from 'react-native';
import { AppText } from '../common/AppText';
import { Avatar } from '../common/Avatar';
import { useTheme } from '../../core/theme/theme-provider';
import { bookingTag, inboxTime } from '../../utils/chat/format';
import type { Conversation } from '../../types/chat/chat';

interface ConversationRowProps {
  conversation: Conversation;
  now: number;
  onPress: () => void;
}

/** Prototype Messages row: avatar, name and time, the last message (bold while unread), the booking tag. */
export function ConversationRow({ conversation, now, onPress }: ConversationRowProps) {
  const theme = useTheme();
  const { counterpart, last_message: last, unread_count: unread, booking } = conversation;
  const label = unread ? `${counterpart.name}, ${unread} unread` : counterpart.name;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{ flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.colors.separator }}
    >
      <Avatar uri={counterpart.photo_url} name={counterpart.name} size={48} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          <AppText variant="subtitle" numberOfLines={1} style={{ flex: 1, fontSize: 15, color: theme.colors.textPrimary }}>{counterpart.name}</AppText>
          {last ? <AppText variant="caption" style={{ color: unread ? theme.colors.brand : theme.colors.textMuted }}>{inboxTime(last.created_at, now)}</AppText> : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <AppText
            variant={unread ? 'label' : 'body'}
            numberOfLines={1}
            style={{ flex: 1, fontSize: 13, color: unread ? theme.colors.textPrimary : theme.colors.textSecondary }}
          >
            {last?.text ?? ''}
          </AppText>
          {unread ? (
            <View style={{ minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: theme.colors.brand, alignItems: 'center', justifyContent: 'center' }}>
              <AppText variant="caption" style={{ color: theme.colors.textOnBrand, fontSize: 11 }}>{String(unread)}</AppText>
            </View>
          ) : null}
        </View>
        {booking ? <AppText variant="caption" style={{ color: theme.colors.pendingInk }}>{bookingTag(booking)}</AppText> : null}
      </View>
    </Pressable>
  );
}
