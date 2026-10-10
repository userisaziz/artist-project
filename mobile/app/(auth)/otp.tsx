import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppText, Accent } from '../../src/components/AppText';
import { AppButton } from '../../src/components/AppButton';
import { FormScreen } from '../../src/components/FormScreen';
import { OtpInput } from '../../src/components/OtpInput';
import { formatPhone } from '../../src/components/PhoneInput';
import { useTheme } from '../../src/theme/theme-provider';
import { useAuth, useMockOtpListener } from '../../src/auth/auth-provider';
import { ApiError } from '../../src/api/types';
import { errorMessage } from '../../src/api/error-message';

const RESEND_SECONDS = 60;

export default function OtpScreen() {
  const { phone = '' } = useLocalSearchParams<{ phone: string }>();
  const theme = useTheme();
  const router = useRouter();
  const { verifyOtp, requestOtp } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const [mockCode, setMockCode] = useState<string | null>(null);

  const onMockOtp = useCallback((p: string, c: string) => { if (p === phone) setMockCode(c); }, [phone]);
  useMockOtpListener(onMockOtp);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  const submit = async (value: string) => {
    setBusy(true);
    setError(null);
    setShaking(false);
    try {
      await verifyOtp(phone, value); // success → gate flips to (app); nothing to navigate here
    } catch (e) {
      if (e instanceof ApiError && e.code === 'auth_error') {
        setError('That code is incorrect.');
        setShaking(true); // clears + shakes OtpInput; reset below so a repeat failure re-triggers it
        setTimeout(() => setShaking(false), 350);
      } else {
        setError(errorMessage(e)); // network/server trouble: keep the digits so Verify can retry as-is
      }
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setResending(true);
    try {
      await requestOtp(phone);
      setSecondsLeft(RESEND_SECONDS);
      setError(null);
    } catch (e) {
      setError(errorMessage(e, { rate_limited: 'Please wait before requesting another code' }));
    } finally {
      setResending(false);
    }
  };

  const canResend = secondsLeft <= 0 && !resending;

  // Same frame as Log in (no OTP screen in the Atelier prototype): blush wash, round back button, headline with italic accent.
  return (
    <FormScreen onBack={() => router.back()}>
      <AppText variant="display" style={{ color: theme.colors.textPrimary, marginTop: theme.spacing.lg + theme.spacing.xs, lineHeight: theme.typography.display.fontSize }}>
        {'Enter the '}<Accent>code</Accent>
      </AppText>
      <AppText variant="body" style={{ color: theme.colors.textMuted, marginTop: theme.spacing.sm + 2, lineHeight: 18 }}>
        Sent to {formatPhone(phone)} ·{' '}
        <AppText variant="label" accessibilityRole="link" onPress={() => router.back()} style={{ color: theme.colors.brand, fontSize: theme.typography.body.fontSize }}>
          Edit
        </AppText>
      </AppText>
      {mockCode ? (
        <View style={{ alignSelf: 'flex-start', marginTop: theme.spacing.md, backgroundColor: theme.colors.brandSoft, borderRadius: theme.radii.pill, paddingHorizontal: theme.spacing.md - theme.spacing.xs, paddingVertical: theme.spacing.xs }}>
          <AppText variant="caption" style={{ color: theme.colors.brandInk }}>Mock mode: your code is {mockCode}</AppText>
        </View>
      ) : null}
      <View style={{ marginTop: theme.spacing.xl }}>
        <OtpInput onComplete={submit} onChange={(c) => { setCode(c); if (c) setError(null); }} error={shaking} busy={busy} />
      </View>
      {error ? (
        <AppText variant="caption" style={{ color: theme.colors.error, marginTop: theme.spacing.sm, textAlign: 'center' }}>{error}</AppText>
      ) : null}
      <View style={{ marginTop: theme.spacing.lg }}>
        <AppButton label="Verify" onPress={() => { void submit(code); }} loading={busy} disabled={code.length !== 6} />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !canResend }}
        onPress={canResend ? resend : undefined}
        hitSlop={theme.spacing.sm}
        style={{ alignSelf: 'center', marginTop: theme.spacing.md + theme.spacing.xs }}
      >
        <AppText variant={canResend ? 'label' : 'caption'} style={{ color: canResend ? theme.colors.brand : theme.colors.textMuted, fontSize: theme.typography.body.fontSize }}>
          {resending ? 'Sending…' : secondsLeft > 0 ? `Resend code in 0:${String(secondsLeft).padStart(2, '0')}` : 'Resend code'}
        </AppText>
      </Pressable>
    </FormScreen>
  );
}
