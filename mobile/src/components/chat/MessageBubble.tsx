import { View } from 'react-native';
import { AppText } from '../common/AppText';
import { useTheme } from '../../core/theme/theme-provider';
import { formatTime } from '../../utils/common/time';
import type { ChatMessage } from '../../types/chat/chat';

/** Prototype chat bubble: mine on the right in brand rose, theirs on the left on white. */
export function MessageBubble({ message, mine, author }: { message: ChatMessage; mine: boolean; author: string }) {
  const theme = useTheme();
  const time = formatTime(message.created_at);
  return (
    <View accessible accessibilityLabel={`${mine ? 'You' : author || 'Them'}: ${message.text}, ${time}`} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '80%', marginVertical: 3 }}>
      <View
        style={{
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 18,
          borderBottomRightRadius: mine ? 6 : 18,
          borderBottomLeftRadius: mine ? 18 : 6,
          backgroundColor: mine ? theme.colors.brand : theme.colors.surface,
          borderWidth: mine ? 0 : 1,
          borderColor: theme.colors.separator,
        }}
      >
        <AppText variant="body" style={{ fontSize: 14, color: mine ? theme.colors.textOnBrand : theme.colors.textPrimary }}>{message.text}</AppText>
      </View>
      <AppText variant="caption" style={{ fontSize: 10.5, color: theme.colors.textMuted, alignSelf: mine ? 'flex-end' : 'flex-start', marginTop: 2 }}>
        {time}
      </AppText>
    </View>
  );
}
