import { View } from 'react-native';
import { PressableFeedback } from '../common/PressableFeedback';
import { AppText } from '../common/AppText';
import { StatusPill } from '../common/StatusPill';
import { useTheme } from '../../core/theme/theme-provider';
import { STATUS_LABEL } from '../../utils/support/issues';
import type { SupportTicket } from '../../types/support/support';

const TONE = { new: 'pending', open: 'pending', waiting_on_user: 'brand', resolved: 'neutral' } as const;

/** Design "Your tickets": code and subject, the booking, and where it stands. */
export function TicketList({ tickets, onOpen }: { tickets: SupportTicket[]; onOpen: (id: string) => void }) {
  const theme = useTheme();
  return (
    <View>
      {tickets.map((t) => (
        <PressableFeedback
          key={t.id}
          accessibilityRole="button"
          accessibilityLabel={`${t.code}, ${t.subject}, ${STATUS_LABEL[t.status]}`}
          onPress={() => onOpen(t.id)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.separator }}
        >
          <View style={{ flex: 1 }}>
            <AppText variant="label" style={{ color: theme.colors.textPrimary }}>{`#${t.code} · ${t.subject}`}</AppText>
            {t.booking ? <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{`${t.booking.service_name} · ${t.booking.code}`}</AppText> : null}
          </View>
          <StatusPill label={STATUS_LABEL[t.status]} tone={TONE[t.status]} />
        </PressableFeedback>
      ))}
    </View>
  );
}
