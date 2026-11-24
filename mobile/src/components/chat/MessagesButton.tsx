import { View } from 'react-native';
import { PressableFeedback } from '../common/PressableFeedback';
import { AppText } from '../common/AppText';
import { Icon } from '../common/Icon';
import { useTheme } from '../../core/theme/theme-provider';

interface MessagesButtonProps {
  unread: number;
  onPress: () => void;
}

const SIZE = 44;
const BADGE = 18;
const BADGE_MAX = 9;

/** Home's round Messages button, with a count of unread messages on its corner. */
export function MessagesButton({ unread, onPress }: MessagesButtonProps) {
  const theme = useTheme();
  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityLabel={unread ? `Messages, ${unread} unread` : 'Messages'}
      onPress={onPress}
      style={{ width: SIZE, height: SIZE, borderRadius: SIZE / 2, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.separator, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon name="chat" size={22} />
      {unread ? (
        <View style={{ position: 'absolute', top: -2, right: -2, minWidth: BADGE, height: BADGE, borderRadius: BADGE / 2, paddingHorizontal: 4, backgroundColor: theme.colors.brand, borderWidth: 1.5, borderColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center' }}>
          <AppText variant="caption" style={{ color: theme.colors.textOnBrand, fontSize: 10, lineHeight: 12 }}>{unread > BADGE_MAX ? `${BADGE_MAX}+` : String(unread)}</AppText>
        </View>
      ) : null}
    </PressableFeedback>
  );
}
