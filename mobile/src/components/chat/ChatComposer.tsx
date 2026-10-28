import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { PressableFeedback } from '../common/PressableFeedback';
import { AppText } from '../common/AppText';
import { useTheme } from '../../core/theme/theme-provider';

const MAX_MESSAGE = 2000; // backend MESSAGE_MAX_LENGTH

interface ChatComposerProps {
  sending: boolean;
  error: string | null;
  /** Resolves once sent. The field clears at once (the thread shows the message as pending); a failed send puts the
   *  text back unless something new was typed meanwhile. */
  onSend: (text: string) => Promise<unknown>;
}

/** Prototype composer: a rounded "Message" field and a send button. */
export function ChatComposer({ sending, error, onSend }: ChatComposerProps) {
  const theme = useTheme();
  const [draft, setDraft] = useState('');
  const text = draft.trim();
  const submit = async () => {
    if (!text) return;
    const sent = draft;
    setDraft('');
    try {
      await onSend(text);
    } catch {
      // The failure is shown through `error` from the mutation; the text comes back for a retry.
      setDraft((current) => (current ? current : sent));
    }
  };
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: theme.colors.separator, backgroundColor: theme.colors.surface, paddingHorizontal: 12, paddingVertical: 10, gap: 6 }}>
      {error ? <AppText variant="caption" accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: theme.colors.error }}>{error}</AppText> : null}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
        <TextInput
          accessibilityLabel="Message"
          placeholder="Message"
          placeholderTextColor={theme.colors.textMuted}
          value={draft}
          onChangeText={setDraft}
          maxLength={MAX_MESSAGE}
          multiline
          style={{ flex: 1, maxHeight: 120, minHeight: 42, borderRadius: 21, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.inputBackground, paddingHorizontal: 16, paddingVertical: 10, color: theme.colors.textPrimary, fontFamily: theme.typography.body.fontFamily, fontSize: 14 }}
        />
        <PressableFeedback
          accessibilityRole="button"
          accessibilityLabel="Send"
          accessibilityState={{ disabled: !text, busy: sending }}
          disabled={!text}
          onPress={() => { void submit(); }}
          style={{ height: 42, paddingHorizontal: 18, borderRadius: 21, backgroundColor: theme.colors.brand, alignItems: 'center', justifyContent: 'center', opacity: !text ? 0.5 : 1 }}
        >
          <AppText variant="button" style={{ color: theme.colors.textOnBrand }}>Send</AppText>
        </PressableFeedback>
      </View>
    </View>
  );
}
