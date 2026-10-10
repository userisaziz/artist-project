import { useState } from 'react';
import { View } from 'react-native';
import { FormScreen, FormHeading } from '../../src/components/FormScreen';
import { AppText } from '../../src/components/AppText';
import { AppButton } from '../../src/components/AppButton';
import { AppTextField } from '../../src/components/AppTextField';
import { useTheme } from '../../src/theme/theme-provider';
import { useAuth } from '../../src/auth/auth-provider';
import { ApiError } from '../../src/api/types';
import { errorMessage } from '../../src/api/error-message';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // same rule as the mock / backend contract
const BAD_EMAIL = 'Enter a valid email, or leave it empty.';

// Atelier hi-fi "Your details" (v4): step 3 of 3, first/last name side by side, optional email, Continue pinned.
export default function SignupScreen() {
  const theme = useTheme();
  const { completeSignup, signOut } = useAuth();
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const trimmedEmail = email.trim();
    if (trimmedEmail && !EMAIL_RE.test(trimmedEmail)) { setEmailError(BAD_EMAIL); return; }
    setSaving(true);
    setError(null);
    try {
      // The design drops the WhatsApp toggle; booking updates stay on (the backend default).
      await completeSignup({ first_name: first.trim(), last_name: last.trim() || null, email: trimmedEmail || null, whatsapp_booking_updates: true });
      // success → the gate moves on to Choose role
    } catch (e) {
      if (e instanceof ApiError && e.code === 'conflict') setEmailError('That email is already used by another account.');
      else if (e instanceof ApiError && e.code === 'validation_error') setEmailError(BAD_EMAIL);
      else setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  // The number is already verified, so there is no OTP to go back to: Back signs out ("not you?").
  return (
    <FormScreen
      onBack={() => { void signOut(); }}
      step={3}
      footer={<AppButton label="Continue" onPress={() => { void submit(); }} loading={saving} disabled={!first.trim()} />}
    >
      <FormHeading eyebrow="YOUR DETAILS" title="What’s your" accent="name?" />
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppTextField label="First name" hideLabel placeholder="First name" value={first} onChangeText={setFirst} autoCapitalize="words" autoComplete="given-name" textContentType="givenName" autoFocus />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppTextField label="Last name" hideLabel placeholder="Last name" value={last} onChangeText={setLast} autoCapitalize="words" autoComplete="family-name" textContentType="familyName" />
        </View>
      </View>
      <View style={{ marginTop: 10 }}>
        <AppTextField
          label="Email (optional)"
          hideLabel
          placeholder="Email"
          value={email}
          onChangeText={(t) => { setEmail(t); setEmailError(null); }}
          error={emailError}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          accessory={(
            <View style={{ paddingHorizontal: theme.spacing.sm, paddingVertical: 2, borderRadius: theme.radii.pill, backgroundColor: theme.colors.fieldHalo }}>
              <AppText variant="eyebrow" style={{ fontSize: 11, letterSpacing: 0, color: theme.colors.brand }}>Optional</AppText>
            </View>
          )}
        />
      </View>
      {error ? <AppText variant="caption" style={{ color: theme.colors.error, marginTop: theme.spacing.md }}>{error}</AppText> : null}
    </FormScreen>
  );
}
