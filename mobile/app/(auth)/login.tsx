import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Accent } from '../../src/components/AppText';
import { AppButton } from '../../src/components/AppButton';
import { PhoneInput } from '../../src/components/PhoneInput';
import { useTheme } from '../../src/theme/theme-provider';
import { useAuth } from '../../src/auth/auth-provider';
import { errorMessage } from '../../src/api/error-message';

const PHONE_RE = /^\+[1-9]\d{6,14}$/; // same rule the backend enforces

export default function LoginScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
      setError(errorMessage(e, { rate_limited: 'Please wait before requesting another code' }));
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/welcome'));

  // Atelier hi-fi "Log in": blush wash fading to white, round back button, serif headline with italic accent.
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <LinearGradient colors={[theme.colors.brandSoft, theme.colors.surface]} locations={[0, 0.38]} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + theme.spacing.sm, paddingHorizontal: theme.spacing.lg, paddingBottom: insets.bottom + theme.spacing.sm }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={goBack}
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.separator, alignItems: 'center', justifyContent: 'center' }}
          >
            <AppText style={{ fontSize: 22, lineHeight: 26, color: theme.colors.textPrimary }}>‹</AppText>
          </Pressable>
          <AppText variant="display" style={{ color: theme.colors.textPrimary, marginTop: theme.spacing.lg + theme.spacing.xs, lineHeight: theme.typography.display.fontSize }}>
            {'Welcome '}<Accent>back</Accent>
          </AppText>
          <AppText variant="body" style={{ color: theme.colors.textMuted, marginTop: theme.spacing.sm + 2, lineHeight: 18 }}>
            Enter your mobile number to log in or sign up. No passwords.
          </AppText>
          <AppText variant="label" style={{ color: theme.colors.textSecondary, marginTop: theme.spacing.xl, marginBottom: theme.spacing.sm }}>Mobile number</AppText>
          <PhoneInput value={phone} error={!!error} onChange={(v) => { setError(null); setPhone(v); }} />
          <AppText variant="caption" style={{ color: error ? theme.colors.error : theme.colors.textMuted, marginTop: theme.spacing.sm }}>
            {error ?? "We'll send a 6-digit code by SMS."}
          </AppText>
          <View style={{ marginTop: theme.spacing.lg }}>
            <AppButton label="Send code" onPress={onSubmit} loading={loading} disabled={!PHONE_RE.test(phone)} />
          </View>
          <View style={{ flex: 1, minHeight: theme.spacing.xl }} />
          <AppText variant="caption" style={{ textAlign: 'center', color: theme.colors.textMuted, lineHeight: 18 }}>
            By continuing you agree to our <AppText variant="caption" style={{ color: theme.colors.brand }}>Terms</AppText> and{' '}
            <AppText variant="caption" style={{ color: theme.colors.brand }}>Privacy Policy</AppText>.
          </AppText>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
