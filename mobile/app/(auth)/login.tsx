import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText } from '../../src/components/common/AppText';
import { AppButton } from '../../src/components/common/AppButton';
import { FormScreen, FormHeading } from '../../src/components/common/FormScreen';
import { PhoneInput } from '../../src/components/common/PhoneInput';
import { useTheme } from '../../src/core/theme/theme-provider';
import { useRequestOtp } from '../../src/hooks/auth/auth';
import { errorMessage } from '../../src/core/api/error-message';

const PHONE_RE = /^\+[1-9]\d{6,14}$/; // same rule the backend enforces

export default function LoginScreen() {
  const theme = useTheme();
  const router = useRouter();
  const otp = useRequestOtp();
  const [phone, setPhone] = useState('+91');
  const error = otp.error
    ? errorMessage(otp.error, { rate_limited: 'Please wait before requesting another code' })
    : null;

  const onSubmit = () => {
    otp.mutate(phone, { onSuccess: () => router.push({ pathname: '/otp', params: { phone } }) });
  };

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/welcome'));

  // Atelier hi-fi "Log in" (v4): step 1 of 3, "Your number.", button + terms pinned above the keyboard.
  return (
    <FormScreen
      onBack={goBack}
      step={1}
      footer={(
        <>
          <AppText variant="caption" style={{ fontSize: 11, textAlign: 'center', color: theme.colors.textMuted, marginBottom: theme.spacing.sm }}>
            By continuing you agree to our <AppText variant="caption" style={{ fontSize: 11, color: theme.colors.brand }}>Terms</AppText> &{' '}
            <AppText variant="caption" style={{ fontSize: 11, color: theme.colors.brand }}>Privacy</AppText>.
          </AppText>
          <AppButton label="Send code" onPress={onSubmit} loading={otp.isPending} disabled={!PHONE_RE.test(phone)} />
        </>
      )}
    >
      <FormHeading eyebrow="LOG IN / SIGN UP" title="Your" accent="number." subtitle="We’ll text you a code. No passwords." />
      <View style={{ marginTop: 18 }}>
        <PhoneInput autoFocus value={phone} error={!!error} onChange={(v) => { otp.reset(); setPhone(v); }} />
      </View>
      {error ? <AppText variant="caption" style={{ color: theme.colors.error, marginTop: theme.spacing.sm }}>{error}</AppText> : null}
    </FormScreen>
  );
}
