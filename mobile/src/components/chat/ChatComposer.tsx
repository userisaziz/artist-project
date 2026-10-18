import { useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { AppText } from '../common/AppText';
import { useTheme } from '../../core/theme/theme-provider';

const MAX_MESSAGE = 2000; // backend MESSAGE_MAX_LENGTH

interface ChatComposerProps {
  sending: boolean;
  error: string | null;
  /** Resolves once sent; the draft is cleared only then, so a failed send keeps the text. */
  onSend: (text: string) => Promise<unknown>;
}

/** Prototype composer: a rounded "Message" field and a send button. */
export function ChatComposer({ sending, error, onSend }: ChatComposerProps) {
  const theme = useTheme();
  const [draft, setDraft] = useState('');
  const inFlight = useRef(false); // render state lags a fast double tap
  const text = draft.trim();
  const submit = async () => {
    if (!text || inFlight.current) return;
    inFlight.current = true;
    const sent = draft;
    try {
      await onSend(text);
      setDraft((current) => (current === sent ? '' : current)); // keep anything typed while it was sending
    } catch {
      // The failure is shown through `error` from the mutation; the draft stays for a retry.
    } finally {
      inFlight.current = false;
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send"
          accessibilityState={{ disabled: !text || sending }}
          disabled={!text || sending}
          onPress={() => { void submit(); }}
          style={{ height: 42, paddingHorizontal: 18, borderRadius: 21, backgroundColor: theme.colors.brand, alignItems: 'center', justifyContent: 'center', opacity: !text || sending ? 0.5 : 1 }}
        >
          <AppText variant="button" style={{ color: theme.colors.textOnBrand }}>Send</AppText>
        </Pressable>
      </View>
    </View>
  );
}
