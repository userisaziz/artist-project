import { useState } from 'react';
import { Switch, View } from 'react-native';
import { FormScreen } from '../src/components/FormScreen';
import { AppText, Accent } from '../src/components/AppText';
import { AppButton } from '../src/components/AppButton';
import { AppTextField } from '../src/components/AppTextField';
import { formatPhone } from '../src/components/PhoneInput';
import { useTheme } from '../src/theme/theme-provider';
import { useAuth } from '../src/auth/auth-provider';
import { ApiError } from '../src/api/types';
import { errorMessage } from '../src/api/error-message';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // same rule as the mock / backend contract
const BAD_EMAIL = 'Enter a valid email, or leave it empty.';

// Sign-up (wireframe A3) in the Atelier form style; the prototype has no screen for it.
export default function SignupScreen() {
  const theme = useTheme();
  const { user, completeSignup, signOut } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState(true);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const trimmedEmail = email.trim();
    if (trimmedEmail && !EMAIL_RE.test(trimmedEmail)) { setEmailError(BAD_EMAIL); return; }
    const [first, ...rest] = name.trim().split(/\s+/);
    setSaving(true);
    setError(null);
    try {
      await completeSignup({ first_name: first, last_name: rest.join(' ') || null, email: trimmedEmail || null, whatsapp_booking_updates: whatsapp });
      // success → the gate moves on to Choose role
    } catch (e) {
      if (e instanceof ApiError && e.code === 'conflict') setEmailError('That email is already used by another account.');
      else if (e instanceof ApiError && e.code === 'validation_error') setEmailError(BAD_EMAIL);
      else setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormScreen>
      <AppText variant="display" style={{ color: theme.colors.textPrimary, marginTop: theme.spacing.xl + theme.spacing.lg, lineHeight: theme.typography.display.fontSize }}>
        {'Create your '}<Accent>account</Accent>
      </AppText>
      <AppText variant="body" style={{ color: theme.colors.textMuted, marginTop: theme.spacing.sm + 2, lineHeight: 18 }}>
        Just three details. Artists will see your name when you book.
      </AppText>

      <View style={{ marginTop: theme.spacing.xl, gap: theme.spacing.lg - theme.spacing.xs }}>
        <AppTextField label="Full name" value={name} onChangeText={setName} placeholder="Ananya Rao" autoCapitalize="words" autoComplete="name" textContentType="name" />

        <View>
          <AppText variant="label" style={{ color: theme.colors.textSecondary, marginBottom: theme.spacing.sm }}>Phone</AppText>
          <View style={{ height: 57, borderRadius: theme.radii.md, borderWidth: 1.5, borderColor: theme.colors.separator, backgroundColor: theme.colors.brandSoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.spacing.md }}>
            <AppText style={{ fontSize: theme.typography.subtitle.fontSize, fontFamily: theme.typography.body.fontFamily, color: theme.colors.textPrimary }}>
              {formatPhone(user?.phone ?? '')}
            </AppText>
            <AppText variant="label" style={{ color: theme.colors.success }}>✓ Verified</AppText>
          </View>
        </View>

        <AppTextField
          label="Email (optional)"
          value={email}
          onChangeText={(t) => { setEmail(t); setEmailError(null); }}
          error={emailError}
          placeholder="name@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
        />

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.md }}>
          <AppText variant="body" style={{ color: theme.colors.textPrimary, flex: 1 }}>Send me booking updates on WhatsApp</AppText>
          <Switch
            accessibilityLabel="Send me booking updates on WhatsApp"
            value={whatsapp}
            onValueChange={setWhatsapp}
            trackColor={{ true: theme.colors.brand, false: theme.colors.border }}
            thumbColor={theme.colors.surface}
            ios_backgroundColor={theme.colors.border}
          />
        </View>
      </View>

      {error ? <AppText variant="caption" style={{ color: theme.colors.error, marginTop: theme.spacing.md }}>{error}</AppText> : null}
      <View style={{ marginTop: theme.spacing.xl }}>
        <AppButton label="Create account" onPress={() => { void submit(); }} loading={saving} disabled={!name.trim()} />
      </View>
      <View style={{ flex: 1, minHeight: theme.spacing.xl }} />
      <AppText variant="caption" style={{ textAlign: 'center', color: theme.colors.textMuted }}>
        Not you?{' '}
        <AppText variant="caption" accessibilityRole="link" onPress={() => { void signOut(); }} style={{ color: theme.colors.brand }}>Log out</AppText>
      </AppText>
    </FormScreen>
  );
}
