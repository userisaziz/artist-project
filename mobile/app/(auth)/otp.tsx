import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { AppText } from '../../src/components/AppText';
import { AppButton } from '../../src/components/AppButton';
import { OtpInput } from '../../src/components/OtpInput';
import { COUNTRIES } from '../../src/components/PhoneInput';
import { useTheme } from '../../src/theme/theme-provider';
import { useAuth, useMockOtpListener } from '../../src/auth/auth-provider';
import { ApiError } from '../../src/api/types';

const RESEND_SECONDS = 60;

/** "+919845012345" → "+91 98450 12345"; other countries → "{code} {national}". */
function formatPhone(phone: string): string {
  const code = COUNTRIES.map((c) => c.code)
    .filter((c) => phone.startsWith(c))
    .sort((a, b) => b.length - a.length)[0];
  if (!code) return phone;
  const national = phone.slice(code.length);
  if (code === '+91' && national.length === 10) return `+91 ${national.slice(0, 5)} ${national.slice(5)}`;
  return `${code} ${national}`;
}

export default function OtpScreen() {
  const { phone = '' } = useLocalSearchParams<{ phone: string }>();
  const theme = useTheme();
  const router = useRouter();
  const { verifyOtp, requestOtp } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);
  const [busy, setBusy] = useState(false);
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
      const api = e as ApiError;
      setError(api.code === 'network_error' ? api.message : 'That code is incorrect.');
      setShaking(true); // clears + shakes OtpInput; reset below so a repeat failure re-triggers it
      setTimeout(() => setShaking(false), 350);
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    try {
      await requestOtp(phone);
      setSecondsLeft(RESEND_SECONDS);
      setError(null);
    } catch (e) {
      const api = e as ApiError;
      setError(api.code === 'rate_limited' ? 'Please wait before requesting another code' : api.message);
    }
  };

  return (
    <Screen>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} hitSlop={12} style={{ alignSelf: 'flex-start' }}>
        <AppText variant="title" style={{ color: theme.colors.textPrimary }}>‹</AppText>
      </Pressable>
      <View style={{ flex: 1, justifyContent: 'center', gap: theme.spacing.xl }}>
        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="title" style={{ color: theme.colors.textPrimary }}>Enter the code</AppText>
          <AppText variant="body" style={{ color: theme.colors.textSecondary }}>
            Sent to {formatPhone(phone)} ·{' '}
            <AppText variant="body" accessibilityRole="link" onPress={() => router.back()} style={{ color: theme.colors.accent }}>
              Edit
            </AppText>
          </AppText>
        </View>
        {mockCode ? (
          <AppText variant="caption" style={{ color: theme.colors.accent }}>
            Mock mode: your code is {mockCode}
          </AppText>
        ) : null}
        <OtpInput onComplete={submit} onChange={setCode} error={shaking} busy={busy} />
        {error ? <AppText variant="caption" style={{ color: theme.colors.error }}>{error}</AppText> : null}
        <AppButton label="Verify" onPress={() => { void submit(code); }} loading={busy} disabled={code.length !== 6} />
        <AppButton
          label={secondsLeft > 0 ? `Resend code in 0:${String(secondsLeft).padStart(2, '0')}` : 'Resend code'}
          onPress={resend}
          variant="ghost"
          disabled={secondsLeft > 0}
        />
      </View>
    </Screen>
  );
}
