import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { AppButton } from '../common/AppButton';
import { AppText } from '../common/AppText';
import { Chip } from '../common/Chip';
import { useTheme } from '../../core/theme/theme-provider';
import { errorMessage } from '../../core/api/error-message';
import { useReportProblem } from '../../hooks/support/support';
import { ISSUES, type SupportSide } from '../../utils/support/issues';
import type { ReportableBooking, SupportTicket } from '../../types/support/support';

const DETAILS_MAX = 500;
const ACCOUNT = 'account';

/** Design "Report a problem": what it's about (a recent booking or the account), what happened, details. */
interface ReportProblemFormProps { side: SupportSide; bookings: ReportableBooking[]; onSent: (ticket: SupportTicket) => void }

export function ReportProblemForm({ side, bookings, onSent }: ReportProblemFormProps) {
  const theme = useTheme();
  const report = useReportProblem();
  const [about, setAbout] = useState<string | null>(null); // a booking id, or 'account'
  const [issue, setIssue] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const topic = about === ACCOUNT ? 'account' : 'booking';
  const ready = !!about && !!issue && !report.isPending;

  const pickAbout = (value: string) => {
    setAbout(value);
    setIssue(null);
  };
  const send = () => {
    if (!ready || !about || !issue) return;
    report.mutate(
      { topic, issue, booking_id: topic === 'booking' ? about : null, details: details.trim() || null },
      {
        onSuccess: (ticket) => {
          setAbout(null);
          setIssue(null);
          setDetails('');
          onSent(ticket);
        },
      },
    );
  };

  return (
    <View style={{ gap: 12 }}>
      <AppText variant="label" style={{ color: theme.colors.textPrimary }}>What’s it about?</AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {bookings.map((b) => <Chip key={b.id} label={b.label} selected={about === b.id} onPress={() => pickAbout(b.id)} />)}
        <Chip label="My account" selected={about === ACCOUNT} onPress={() => pickAbout(ACCOUNT)} />
      </View>
      {about ? (
        <>
          <AppText variant="label" style={{ color: theme.colors.textPrimary }}>What happened?</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {ISSUES[side][topic].map((i) => <Chip key={i.value} label={i.label} selected={issue === i.value} onPress={() => setIssue(i.value)} />)}
          </View>
        </>
      ) : null}
      <TextInput
        accessibilityLabel="Tell us more (optional)"
        placeholder="Tell us more (optional)"
        placeholderTextColor={theme.colors.textMuted}
        value={details}
        onChangeText={setDetails}
        maxLength={DETAILS_MAX}
        multiline
        style={{ minHeight: 96, textAlignVertical: 'top', borderRadius: theme.radii.md, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.inputBackground, padding: 14, color: theme.colors.textPrimary, fontFamily: theme.typography.body.fontFamily, fontSize: 14 }}
      />
      {report.isError ? <AppText variant="caption" accessibilityRole="alert" style={{ color: theme.colors.error }}>{errorMessage(report.error)}</AppText> : null}
      <AppButton label="Send to support" loading={report.isPending} disabled={!ready} onPress={send} />
    </View>
  );
}
