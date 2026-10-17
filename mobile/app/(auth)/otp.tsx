import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppText } from '../../src/core/components/AppText';
import { AppButton } from '../../src/core/components/AppButton';
import { FormScreen, FormHeading } from '../../src/core/components/FormScreen';
import { OtpInput } from '../../src/core/components/OtpInput';
import { formatPhone } from '../../src/core/components/PhoneInput';
import { useTheme } from '../../src/core/theme/theme-provider';
import { useAuth, useMockOtpListener } from '../../src/features/auth/auth-provider';
import { ApiError } from '../../src/core/api/types';
import { errorMessage } from '../../src/core/api/error-message';

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

  // Atelier hi-fi "Verify" (v4): step 2 of 3, six code boxes, resend timer, Verify pinned above the keyboard.
  return (
    <FormScreen
      onBack={() => router.back()}
      step={2}
      footer={<AppButton label="Verify" onPress={() => { void submit(code); }} loading={busy} disabled={code.length !== 6} />}
    >
      <FormHeading
        eyebrow="VERIFY"
        title="Enter the"
        accent="code."
        subtitle={(
          <>
            Sent to {formatPhone(phone)} ·{' '}
            <AppText variant="label" accessibilityRole="link" onPress={() => router.back()} style={{ fontSize: 13, color: theme.colors.brand }}>Edit</AppText>
          </>
        )}
      />
      {mockCode ? (
        <View style={{ alignSelf: 'flex-start', marginTop: theme.spacing.md, backgroundColor: theme.colors.brandSoft, borderRadius: theme.radii.pill, paddingHorizontal: theme.spacing.md - theme.spacing.xs, paddingVertical: theme.spacing.xs }}>
          <AppText variant="caption" style={{ color: theme.colors.brandInk }}>Mock mode: your code is {mockCode}</AppText>
        </View>
      ) : null}
      <View style={{ marginTop: 18 }}>
        <OtpInput onComplete={submit} onChange={(c) => { setCode(c); if (c) setError(null); }} error={shaking} busy={busy} />
      </View>
      {error ? <AppText variant="caption" style={{ color: theme.colors.error, marginTop: theme.spacing.sm }}>{error}</AppText> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !canResend }}
        onPress={canResend ? resend : undefined}
        hitSlop={theme.spacing.sm}
        style={{ alignSelf: 'flex-start', marginTop: 12 }}
      >
        {resending ? (
          <AppText variant="caption" style={{ color: theme.colors.textMuted }}>Sending…</AppText>
        ) : secondsLeft > 0 ? (
          <AppText variant="caption" style={{ color: theme.colors.textMuted }}>
            Resend in <AppText variant="label" style={{ color: theme.colors.textPrimary }}>{`0:${String(secondsLeft).padStart(2, '0')}`}</AppText>
          </AppText>
        ) : (
          <AppText variant="label" style={{ color: theme.colors.brand }}>Resend code</AppText>
        )}
      </Pressable>
    </FormScreen>
  );
}
