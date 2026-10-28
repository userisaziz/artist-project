import { View } from 'react-native';
import { PressableFeedback } from '../common/PressableFeedback';
import { AppText } from '../common/AppText';
import { useTheme } from '../../core/theme/theme-provider';
import { shortAgo } from '../../utils/common/time';
import type { AppNotification } from '../../types/notifications/notifications';

const DOT = 8;

/** One notification: an unread dot, title, body and age. */
export function NotificationRow({ item, now, onOpen }: { item: AppNotification; now: number; onOpen: (n: AppNotification) => void }) {
  const theme = useTheme();
  const unread = !item.read_at;
  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityLabel={`${unread ? 'Unread. ' : ''}${item.title}. ${item.body}`}
      onPress={() => onOpen(item)}
      style={{ flexDirection: 'row', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.colors.separator }}
    >
      <View style={{ width: DOT, height: DOT, borderRadius: DOT / 2, marginTop: 6, backgroundColor: unread ? theme.colors.brand : 'transparent' }} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          <AppText variant="label" style={{ flex: 1, color: theme.colors.textPrimary }}>{item.title}</AppText>
          <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{shortAgo(item.created_at, now)}</AppText>
        </View>
        <AppText variant="body" numberOfLines={2} style={{ color: theme.colors.textSecondary }}>{item.body}</AppText>
      </View>
    </PressableFeedback>
  );
}
