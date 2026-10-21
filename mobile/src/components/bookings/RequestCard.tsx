import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppText } from '../common/AppText';
import { AppButton } from '../common/AppButton';
import { AppTextField } from '../common/AppTextField';
import { Avatar } from '../common/Avatar';
import { useTheme } from '../../core/theme/theme-provider';
import { customerName } from '../../utils/bookings/status';
import { formatWhen } from '../../utils/common/time';
import { formatMaybePrice } from '../../utils/common/format';
import { Countdown } from './Countdown';
import type { Booking } from '../../types/bookings/bookings';

const MAX_REASON = 500;

interface RequestCardProps {
  booking: Booking;
  now: number;
  busy: boolean;
  error?: string;
  onAccept: () => void;
  onDecline: (reason: string | null) => void;
  /** Opens the chat with this customer. */
  onMessage?: () => void;
  /** Opens the booking's detail page. */
  onOpen?: () => void;
}

/** Spec §3 request card: customer and countdown, Service / When / Where / You earn, the note, Decline, Message and Accept. */
export function RequestCard({ booking, now, busy, error, onAccept, onDecline, onMessage, onOpen }: RequestCardProps) {
  const theme = useTheme();
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');
  const name = customerName(booking.customer);
  const cell = (label: string, value: string, tint?: string) => (
    <View style={{ width: '50%', paddingRight: 8, paddingBottom: 10 }}>
      <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{label}</AppText>
      <AppText variant="label" style={{ fontSize: 12.5, color: tint ?? theme.colors.textPrimary }}>{value}</AppText>
    </View>
  );
  return (
    <View style={{ borderRadius: 18, borderWidth: 1, borderColor: theme.colors.separator, backgroundColor: theme.colors.surface, overflow: 'hidden' }}>
      <Pressable
        accessibilityRole={onOpen ? 'button' : undefined}
        accessibilityLabel={onOpen ? `Open request from ${name}` : undefined}
        disabled={!onOpen}
        onPress={onOpen}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}
      >
        <Avatar uri={null} name={name} size={46} />
        <View style={{ flex: 1 }}>
          <AppText variant="subtitle" style={{ fontSize: 15, color: theme.colors.textPrimary }}>{name}</AppText>
          <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{booking.code}</AppText>
        </View>
        <Countdown deadline={booking.expires_at} now={now} />
      </Pressable>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 14 }}>
        {cell('Service', booking.service_name)}
        {cell('When', formatWhen(booking.start_at))}
        {cell('Where', booking.address)}
        {cell('You earn', formatMaybePrice(booking.artist_earning_paise), theme.colors.brand)}
      </View>
      {booking.note ? (
        <View style={{ paddingHorizontal: 14, paddingVertical: 10, backgroundColor: theme.colors.washTop }}>
          <AppText variant="caption" style={{ fontSize: 12.5, color: theme.colors.textSecondary }}>{`“${booking.note}”`}</AppText>
        </View>
      ) : null}
      {declining ? (
        <View style={{ padding: 14, gap: 10 }}>
          <AppTextField label="Reason (optional)" placeholder="Tell the customer why" value={reason} onChangeText={setReason} maxLength={MAX_REASON} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><AppButton label="Back" variant="secondary" disabled={busy} onPress={() => setDeclining(false)} /></View>
            <View style={{ flex: 1 }}><AppButton label="Confirm decline" loading={busy} onPress={() => onDecline(reason.trim() || null)} /></View>
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: 8, padding: 14 }}>
          <View style={{ flex: 1 }}>
            <AppButton label="Decline" accessibilityLabel={`Decline ${name}`} variant="secondary" disabled={busy} onPress={() => setDeclining(true)} />
          </View>
          {onMessage ? (
            <View style={{ flex: 1 }}>
              <AppButton label="Message" accessibilityLabel={`Message ${name}`} variant="secondary" onPress={onMessage} />
            </View>
          ) : null}
          <View style={{ flex: 1 }}>
            <AppButton label="Accept" accessibilityLabel={`Accept ${name}`} loading={busy} onPress={onAccept} />
          </View>
        </View>
      )}
      {error ? <AppText variant="caption" style={{ color: theme.colors.error, paddingHorizontal: 14, paddingBottom: 12 }}>{error}</AppText> : null}
    </View>
  );
}
