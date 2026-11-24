import { useState } from 'react';
import { View } from 'react-native';
import { AppText } from '../common/AppText';
import { Photo } from '../common/Photo';
import { PhotoViewer } from '../common/PhotoViewer';
import { PressableFeedback } from '../common/PressableFeedback';
import { useTheme } from '../../core/theme/theme-provider';
import { formatTime } from '../../utils/common/time';
import { isPendingMessage } from '../../hooks/chat/chat';
import type { ChatMessage } from '../../types/chat/chat';

const PHOTO_WIDTH = 220;
const PHOTO_HEIGHT = 260;

const MODERATION_NOTE: Record<NonNullable<ChatMessage['moderation']>, string> = {
  held: 'Under review · contact details are checked before delivery',
  hidden: 'Not delivered · contact details aren’t allowed before booking',
};

/** Prototype chat bubble: mine on the right in brand rose, theirs on the left on white. A photo sits above its text
 *  and opens full screen. A held or hidden message of mine is faded, with why. */
export function MessageBubble({ message, mine, author }: { message: ChatMessage; mine: boolean; author: string }) {
  const theme = useTheme();
  const time = formatTime(message.created_at);
  const [viewing, setViewing] = useState(false);
  const note = isPendingMessage(message) ? 'Sending…' : mine && message.moderation ? MODERATION_NOTE[message.moderation] : null;
  const who = mine ? 'You' : author || 'Them';
  const said = [message.photo_url ? 'sent a photo' : null, message.text || null].filter(Boolean).join(': ');
  return (
    <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '80%', marginVertical: 3, opacity: note ? 0.6 : 1 }}>
      {message.photo_url ? (
        <>
          <PressableFeedback
            accessibilityRole="imagebutton"
            accessibilityLabel={`${who} sent a photo, open full screen`}
            onPress={() => setViewing(true)}
            style={{ marginBottom: message.text ? theme.spacing[1] : 0, alignSelf: mine ? 'flex-end' : 'flex-start' }}
          >
            <Photo uri={message.photo_url} style={{ width: PHOTO_WIDTH, height: PHOTO_HEIGHT, borderRadius: theme.radii.lg }} />
          </PressableFeedback>
          <PhotoViewer photos={[{ id: message.id, url: message.photo_url }]} startIndex={viewing ? 0 : null} onClose={() => setViewing(false)} label="Chat photo" />
        </>
      ) : null}
      {message.text ? (
      <View
        accessible
        accessibilityLabel={`${who}: ${said}, ${time}${note ? `. ${note}` : ''}`}
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
        <AppText variant="body" style={{ color: mine ? theme.colors.textOnBrand : theme.colors.textPrimary }}>{message.text}</AppText>
      </View>
      ) : null}
      <AppText variant="caption" style={{ fontSize: 10.5, color: theme.colors.textMuted, alignSelf: mine ? 'flex-end' : 'flex-start', marginTop: 2 }}>
        {note ? `${time} · ${note}` : time}
      </AppText>
    </View>
  );
}
