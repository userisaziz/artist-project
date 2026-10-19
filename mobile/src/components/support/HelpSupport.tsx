import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Accent } from '../common/AppText';
import { BackHeader } from '../common/BackHeader';
import { ErrorView, LoadingView } from '../common/StateViews';
import { FaqItem } from './FaqItem';
import { ReportProblemForm } from './ReportProblemForm';
import { TicketList } from './TicketList';
import { useTheme } from '../../core/theme/theme-provider';
import { useMyTickets } from '../../hooks/support/support';
import { FAQ } from '../../utils/support/issues';
import type { ReportableBooking } from '../../types/support/support';

const SENT = 'Sent. We usually reply within 2 hours.';

/** Design "Help & support": common questions, report a problem, and the customer's tickets. */
export function HelpSupport({ bookings, onOpenTicket }: { bookings: ReportableBooking[]; onOpenTicket: (id: string) => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const tickets = useMyTickets();
  const [sent, setSent] = useState(false);
  const items = tickets.data?.pages.flatMap((p) => p.items) ?? [];
  const section = { fontSize: 11, letterSpacing: 1, color: theme.colors.brand, marginTop: 24, marginBottom: 6 } as const;

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ paddingTop: insets.top + theme.spacing.sm, paddingHorizontal: theme.spacing.md, paddingBottom: insets.bottom + theme.spacing.xl }}
    >
      <BackHeader />
      <AppText variant="display" style={{ fontSize: 30, lineHeight: 34, color: theme.colors.heading, marginTop: 8 }}>Help & <Accent>support</Accent></AppText>

      <AppText variant="caption" style={section}>COMMON QUESTIONS</AppText>
      {FAQ.map((f) => <FaqItem key={f.question} question={f.question} answer={f.answer} />)}

      <AppText variant="caption" style={section}>REPORT A PROBLEM</AppText>
      <ReportProblemForm bookings={bookings} onSent={() => setSent(true)} />
      {sent ? <AppText variant="caption" accessibilityLiveRegion="polite" style={{ color: theme.colors.confirmedInk, marginTop: 8 }}>{SENT}</AppText> : null}

      <AppText variant="caption" style={section}>YOUR TICKETS</AppText>
      {tickets.isPending ? <LoadingView label="Loading your tickets" /> : null}
      {tickets.isError && !tickets.data ? <ErrorView error={tickets.error} onRetry={() => { void tickets.refetch(); }} /> : null}
      {tickets.isSuccess && !items.length ? <AppText variant="body" style={{ color: theme.colors.textMuted }}>No tickets yet.</AppText> : null}
      <View><TicketList tickets={items} onOpen={onOpenTicket} /></View>
    </ScrollView>
  );
}
