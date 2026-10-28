import { View } from 'react-native';
import { PressableFeedback } from '../common/PressableFeedback';
import { useRouter } from 'expo-router';
import { AppText } from '../common/AppText';
import { Avatar } from '../common/Avatar';
import { useTheme } from '../../core/theme/theme-provider';
import { bookingTag } from '../../utils/chat/format';
import type { Conversation } from '../../types/chat/chat';
import { Icon } from '../common/Icon';

/** Prototype chat header: back, the other party's avatar and name, and the booking the chat is about. */
export function ChatHeader({ conversation }: { conversation: Conversation | undefined }) {
  const theme = useTheme();
  const router = useRouter();
  const name = conversation?.counterpart.name ?? '';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.separator }}>
      <PressableFeedback accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} onPress={() => router.back()} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="chevron-left" size={26} />
      </PressableFeedback>
      <Avatar uri={conversation?.counterpart.photo_url ?? null} name={name || '?'} size={40} />
      <View style={{ flex: 1 }}>
        <AppText variant="subtitle" numberOfLines={1} style={{ fontSize: 15, color: theme.colors.textPrimary }}>{name}</AppText>
        {conversation?.booking ? <AppText variant="caption" style={{ color: theme.colors.pendingInk }}>{bookingTag(conversation.booking)}</AppText> : null}
      </View>
    </View>
  );
}
