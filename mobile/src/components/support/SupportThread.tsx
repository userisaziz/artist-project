import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { useIsFocused } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '../common/AppButton';
import { AppText } from '../common/AppText';
import { BackHeader } from '../common/BackHeader';
import { StatusPill } from '../common/StatusPill';
import { ErrorView, LoadingView } from '../common/StateViews';
import { useTheme } from '../../core/theme/theme-provider';
import { errorMessage } from '../../core/api/error-message';
import { useMyTicket, useWriteToSupport } from '../../hooks/support/support';
import { formatWhen } from '../../utils/common/time';
import { STATUS_LABEL } from '../../utils/support/issues';

const MESSAGE_MAX = 1000;

/** One ticket: the subject, the thread with support's replies, and a box to write back. */
export function SupportThread({ ticketId }: { ticketId: string }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const ticket = useMyTicket(ticketId, useIsFocused());
  const write = useWriteToSupport(ticketId);
  const [text, setText] = useState('');
  const t = ticket.data;

  const send = () => {
    if (!text.trim() || write.isPending) return;
    write.mutate(text.trim(), { onSuccess: () => setText('') });
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + theme.spacing.sm, paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.lg, gap: 12 }}>
        <BackHeader title={t ? `#${t.code}` : 'Ticket'} />
        {ticket.isPending ? <LoadingView label="Loading the ticket" /> : null}
        {ticket.isError && !t ? <ErrorView error={ticket.error} onRetry={() => { void ticket.refetch(); }} /> : null}
        {t ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <AppText variant="subtitle" style={{ flex: 1, color: theme.colors.textPrimary }}>{t.subject}</AppText>
              <StatusPill label={STATUS_LABEL[t.status]} tone={t.status === 'resolved' ? 'neutral' : 'brand'} />
            </View>
            {t.booking ? <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{`${t.booking.service_name} · ${t.booking.artist_name} · ${t.booking.code}`}</AppText> : null}
            {t.messages.map((m) => (
              <View
                key={m.id}
                accessible
                accessibilityLabel={`${m.author === 'support' ? 'Atelier support' : 'You'}: ${m.text}`}
                style={{ alignSelf: m.author === 'support' ? 'flex-start' : 'flex-end', maxWidth: '85%', borderRadius: 16, padding: 12, backgroundColor: m.author === 'support' ? theme.colors.surface : theme.colors.brandSoft, borderWidth: 1, borderColor: theme.colors.separator }}
              >
                <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{`${m.author === 'support' ? 'Atelier support' : 'You'} · ${formatWhen(m.created_at)}`}</AppText>
                <AppText variant="body" style={{ color: theme.colors.textPrimary }}>{m.text}</AppText>
              </View>
            ))}
            {!t.messages.length ? <AppText variant="body" style={{ color: theme.colors.textMuted }}>We’ve got your report. We usually reply within 2 hours.</AppText> : null}
          </>
        ) : null}
      </ScrollView>
      {t ? (
        <View style={{ padding: theme.spacing.md, paddingBottom: insets.bottom + 12, gap: 8, borderTopWidth: 1, borderTopColor: theme.colors.separator, backgroundColor: theme.colors.surface }}>
          {write.isError ? <AppText variant="caption" accessibilityRole="alert" style={{ color: theme.colors.error }}>{errorMessage(write.error)}</AppText> : null}
          <TextInput
            accessibilityLabel="Write to support"
            placeholder={t.status === 'resolved' ? 'Write to reopen this ticket' : 'Write to support'}
            placeholderTextColor={theme.colors.textMuted}
            value={text}
            onChangeText={setText}
            maxLength={MESSAGE_MAX}
            multiline
            style={{ maxHeight: 120, minHeight: 44, borderRadius: theme.radii.md, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.inputBackground, paddingHorizontal: 14, paddingVertical: 10, color: theme.colors.textPrimary, fontFamily: theme.typography.body.fontFamily, fontSize: 14 }}
          />
          <AppButton label="Send" loading={write.isPending} disabled={!text.trim()} onPress={send} />
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
