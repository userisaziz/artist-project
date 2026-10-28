import { View } from 'react-native';
import { PressableFeedback } from '../common/PressableFeedback';
import { AppText } from '../common/AppText';
import { Icon } from '../common/Icon';
import { useTheme } from '../../core/theme/theme-provider';
import { useUnreadCount } from '../../hooks/notifications/notifications';

const SIZE = 40;
const BADGE = 18;
const MAX_SHOWN = 9;

/** The bell on Home, with the unread count. */
export function NotificationBell({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  const unread = useUnreadCount().data ?? 0;
  const label = unread ? `Notifications, ${unread} unread` : 'Notifications';
  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{ width: SIZE, height: SIZE, borderRadius: SIZE / 2, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon name="bell" size={18} color={theme.colors.textPrimary} />
      {unread ? (
        <View style={{ position: 'absolute', top: -2, right: -2, minWidth: BADGE, height: BADGE, borderRadius: BADGE / 2, paddingHorizontal: 4, backgroundColor: theme.colors.brand, alignItems: 'center', justifyContent: 'center' }}>
          <AppText variant="caption" style={{ fontSize: 10, lineHeight: 12, color: theme.colors.textOnBrand }}>{unread > MAX_SHOWN ? `${MAX_SHOWN}+` : String(unread)}</AppText>
        </View>
      ) : null}
    </PressableFeedback>
  );
}
