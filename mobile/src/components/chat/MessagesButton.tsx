import { View } from 'react-native';
import { PressableFeedback } from '../common/PressableFeedback';
import { AppText } from '../common/AppText';
import { Icon } from '../common/Icon';
import { useTheme } from '../../core/theme/theme-provider';

interface MessagesButtonProps {
  unread: number;
  onPress: () => void;
  /** Circle diameter; Home's compact header uses 40, elsewhere the default 44. */
  size?: number;
}

const BADGE = 18;
const BADGE_MAX = 9;

/** Home's round Messages button, with a count of unread messages on its corner. */
export function MessagesButton({ unread, onPress, size = 44 }: MessagesButtonProps) {
  const theme = useTheme();
  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityLabel={unread ? `Messages, ${unread} unread` : 'Messages'}
      onPress={onPress}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.separator, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon name="chat" size={Math.round(size / 2)} />
      {unread ? (
        <View style={{ position: 'absolute', top: -2, right: -2, minWidth: BADGE, height: BADGE, borderRadius: BADGE / 2, paddingHorizontal: 4, backgroundColor: theme.colors.brand, borderWidth: 1.5, borderColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center' }}>
          <AppText variant="caption" style={{ color: theme.colors.textOnBrand, fontSize: 10, lineHeight: 12 }}>{unread > BADGE_MAX ? `${BADGE_MAX}+` : String(unread)}</AppText>
        </View>
      ) : null}
    </PressableFeedback>
  );
}
