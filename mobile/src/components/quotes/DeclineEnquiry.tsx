import { useState } from 'react';
import { View } from 'react-native';
import { AppButton } from '../common/AppButton';
import { AppText } from '../common/AppText';
import { AppTextField } from '../common/AppTextField';
import { useTheme } from '../../core/theme/theme-provider';
import { useDeclineEnquiry } from '../../hooks/quotes/quotes';
import { errorMessage } from '../../core/api/error-message';
import { MAX_NOTE } from '../../utils/quotes/status';

/** Decline an enquiry, with an optional reason the customer sees. */
export function DeclineEnquiry({ enquiryId }: { enquiryId: string }) {
  const theme = useTheme();
  const decline = useDeclineEnquiry();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  return (
    <View style={{ gap: 8 }}>
      {open ? (
        <>
          <AppTextField label="Reason (optional)" placeholder="Tell the customer why" value={reason} onChangeText={setReason} maxLength={MAX_NOTE} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><AppButton label="Back" variant="secondary" disabled={decline.isPending} onPress={() => setOpen(false)} /></View>
            <View style={{ flex: 1 }}><AppButton label="Decline enquiry" loading={decline.isPending} onPress={() => decline.mutate({ id: enquiryId, reason: reason.trim() || null })} /></View>
          </View>
        </>
      ) : (
        <AppButton label="Decline" variant="ghost" onPress={() => setOpen(true)} />
      )}
      {decline.error ? <AppText variant="caption" accessibilityRole="alert" style={{ color: theme.colors.error }}>{errorMessage(decline.error)}</AppText> : null}
    </View>
  );
}
