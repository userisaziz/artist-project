import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { Logo } from '../../src/components/Logo';
import { AppText } from '../../src/components/AppText';
import { AppButton } from '../../src/components/AppButton';
import { PhoneInput } from '../../src/components/PhoneInput';
import { useTheme } from '../../src/theme/theme-provider';
import { useAuth } from '../../src/auth/auth-provider';
import { ApiError } from '../../src/api/types';

const PHONE_RE = /^\+[1-9]\d{6,14}$/; // same rule the backend enforces

export default function LoginScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { requestOtp } = useAuth();
  const [phone, setPhone] = useState('+91');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      await requestOtp(phone);
      router.push({ pathname: '/otp', params: { phone } });
    } catch (e) {
      const api = e as ApiError;
      // network_error and everything else carry a user-facing message already.
      setError(api.code === 'rate_limited' ? 'Please wait before requesting another code' : api.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll>
      <View style={{ flex: 1, justifyContent: 'center', gap: theme.spacing.xl, paddingVertical: theme.spacing.xl }}>
        <Logo />
        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="title" style={{ color: theme.colors.textPrimary }}>Welcome back</AppText>
          <AppText variant="body" style={{ color: theme.colors.textSecondary }}>Continue with your phone number</AppText>
        </View>
        <PhoneInput value={phone} onChange={(v) => { setError(null); setPhone(v); }} />
        {error ? (
          <AppText variant="caption" style={{ color: theme.colors.error }}>{error}</AppText>
        ) : null}
        <AppButton label="Continue" onPress={onSubmit} loading={loading} disabled={!PHONE_RE.test(phone)} />
        <AppText variant="caption" style={{ textAlign: 'center', color: theme.colors.textMuted }}>
          By continuing you agree to the Terms & Privacy Policy
        </AppText>
      </View>
    </Screen>
  );
}
