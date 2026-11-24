import { useState } from 'react';
import { ActivityIndicator, TextInput, View } from 'react-native';
import { PressableFeedback } from '../common/PressableFeedback';
import { AppText } from '../common/AppText';
import { Icon } from '../common/Icon';
import { useTheme } from '../../core/theme/theme-provider';
import { errorMessage } from '../../core/api/error-message';
import { pickImages, uploadImage } from '../../api/artist-onboarding/upload';
import type { OutgoingMessage } from '../../types/chat/chat';

const MAX_MESSAGE = 2000; // backend MESSAGE_MAX_LENGTH
const CONTROL = 42;

interface ChatComposerProps {
  sending: boolean;
  error: string | null;
  /** Resolves once sent. The field clears at once (the thread shows the message as pending); a failed send puts the
   *  text back unless something new was typed meanwhile. */
  onSend: (message: OutgoingMessage) => Promise<unknown>;
}

/** Prototype composer: a photo button (reference designs, looks), a rounded "Message" field and a send button.
 *  A picked photo uploads first, then goes out with whatever text is typed. */
export function ChatComposer({ sending, error, onSend }: ChatComposerProps) {
  const theme = useTheme();
  const [draft, setDraft] = useState('');
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const text = draft.trim();
  const submit = async () => {
    if (!text) return;
    const sent = draft;
    setDraft('');
    try {
      await onSend({ text });
    } catch {
      // The failure is shown through `error` from the mutation; the text comes back for a retry.
      setDraft((current) => (current ? current : sent));
    }
  };
  const sendPhoto = async () => {
    setPhotoError(null);
    try {
      const [image] = await pickImages(1);
      if (!image) return;
      setUploading(true);
      const uploaded = await uploadImage(image, 'chat');
      const caption = text;
      setDraft('');
      await onSend({ text: caption, photo: { key: uploaded.key, localUri: image.uri } });
    } catch (e) {
      // A failed pick or upload says why here; a failed send shows through `error` like a text message.
      setPhotoError(errorMessage(e));
    } finally {
      setUploading(false);
    }
  };
  const shownError = photoError ?? error;
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: theme.colors.separator, backgroundColor: theme.colors.surface, paddingHorizontal: theme.spacing[3], paddingVertical: theme.spacing[2.5], gap: theme.spacing[1.5] }}>
      {shownError ? <AppText variant="caption" accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: theme.colors.error }}>{shownError}</AppText> : null}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing[2] }}>
        <PressableFeedback
          accessibilityRole="button"
          accessibilityLabel={uploading ? 'Sending photo' : 'Send a photo'}
          accessibilityState={{ disabled: uploading, busy: uploading }}
          disabled={uploading}
          onPress={() => { void sendPhoto(); }}
          style={{ width: CONTROL, height: CONTROL, borderRadius: theme.radii.pill, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' }}
        >
          {uploading ? <ActivityIndicator color={theme.colors.brand} /> : <Icon name="camera" size={20} color={theme.colors.brand} />}
        </PressableFeedback>
        <TextInput
          accessibilityLabel="Message"
          placeholder="Message"
          placeholderTextColor={theme.colors.textMuted}
          value={draft}
          onChangeText={setDraft}
          maxLength={MAX_MESSAGE}
          multiline
          style={{ flex: 1, maxHeight: 120, minHeight: CONTROL, borderRadius: CONTROL / 2, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.inputBackground, paddingHorizontal: theme.spacing[4], paddingVertical: theme.spacing[2.5], color: theme.colors.textPrimary, fontFamily: theme.typography.body.fontFamily, fontSize: theme.typography.body.fontSize }}
        />
        <PressableFeedback
          accessibilityRole="button"
          accessibilityLabel="Send"
          accessibilityState={{ disabled: !text, busy: sending }}
          disabled={!text}
          onPress={() => { void submit(); }}
          style={{ height: CONTROL, paddingHorizontal: theme.spacing[4.5], borderRadius: CONTROL / 2, backgroundColor: theme.colors.brand, alignItems: 'center', justifyContent: 'center', opacity: !text ? 0.5 : 1 }}
        >
          <AppText variant="button" style={{ color: theme.colors.textOnBrand }}>Send</AppText>
        </PressableFeedback>
      </View>
    </View>
  );
}
