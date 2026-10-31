import { useState } from 'react';
import { Switch, View } from 'react-native';
import { FormScreen, FormHeading } from '../common/FormScreen';
import { AppText } from '../common/AppText';
import { AppButton } from '../common/AppButton';
import { AppTextField } from '../common/AppTextField';
import { useTheme } from '../../core/theme/theme-provider';
import { useAuth } from '../../context/auth/auth-provider';
import { ApiError } from '../../core/api/types';
import { errorMessage } from '../../core/api/error-message';
import { BAD_EMAIL, isValidOptionalEmail } from '../../utils/auth/email';
import { dateOfBirthInput, formatDateOfBirth, readDateOfBirth } from '../../utils/auth/date-of-birth';

interface EditAccountFormProps { onDone: () => void }

/** Profile → Edit profile: name, date of birth, optional email and WhatsApp booking updates (PATCH /users/me). The phone is the login, so it stays. */
export function EditAccountForm({ onDone }: EditAccountFormProps) {
  const theme = useTheme();
  const { user, completeSignup } = useAuth();
  const [first, setFirst] = useState(user?.first_name ?? '');
  const [last, setLast] = useState(user?.last_name ?? '');
  const [dob, setDob] = useState(dateOfBirthInput(user?.date_of_birth));
  const [dobError, setDobError] = useState<string | null>(null);
  const [email, setEmail] = useState(user?.email ?? '');
  const [whatsapp, setWhatsapp] = useState(user?.whatsapp_booking_updates ?? true);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const dateOfBirth = readDateOfBirth(dob);
    if (dateOfBirth.iso === null) { setDobError(dateOfBirth.error); return; }
    if (!isValidOptionalEmail(email)) { setEmailError(BAD_EMAIL); return; }
    setSaving(true);
    setError(null);
    try {
      // Same PATCH /users/me as sign-up; it swaps in the returned user, so Profile shows the new name at once.
      await completeSignup({ first_name: first.trim(), last_name: last.trim() || null, date_of_birth: dateOfBirth.iso, email: email.trim() || null, whatsapp_booking_updates: whatsapp });
      onDone();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'conflict') setEmailError('That email is already used by another account.');
      else setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormScreen onBack={onDone} footer={<AppButton label="Save" onPress={() => { void save(); }} loading={saving} disabled={!first.trim()} />}>
      <FormHeading eyebrow="YOUR DETAILS" title="Edit your" accent="profile" />
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppTextField label="First name" value={first} onChangeText={setFirst} autoCapitalize="words" autoComplete="given-name" textContentType="givenName" />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppTextField label="Last name" value={last} onChangeText={setLast} autoCapitalize="words" autoComplete="family-name" textContentType="familyName" />
        </View>
      </View>
      <View style={{ marginTop: 10 }}>
        <AppTextField
          label="Date of birth"
          placeholder="DD/MM/YYYY"
          value={dob}
          onChangeText={(t) => { setDob(formatDateOfBirth(t)); setDobError(null); }}
          onBlur={() => setDobError(readDateOfBirth(dob).error)}
          error={dobError}
          keyboardType="number-pad"
          maxLength={10}
          autoComplete="birthdate-full" // RN 0.86 types have no `bday`; see Your details
        />
      </View>
      <View style={{ marginTop: 10 }}>
        <AppTextField
          label="Email (optional)"
          value={email}
          onChangeText={(t) => { setEmail(t); setEmailError(null); }}
          error={emailError}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
        />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18 }}>
        <View style={{ flex: 1 }}>
          <AppText variant="label" style={{ color: theme.colors.textPrimary }}>Booking updates on WhatsApp</AppText>
          <AppText variant="caption" style={{ color: theme.colors.textMuted }}>Confirmations and reminders for your bookings</AppText>
        </View>
        <Switch accessibilityLabel="Booking updates on WhatsApp" value={whatsapp} onValueChange={setWhatsapp} trackColor={{ true: theme.colors.brand, false: theme.colors.separator }} />
      </View>
      {error ? <AppText variant="caption" style={{ color: theme.colors.error, marginTop: theme.spacing.md }}>{error}</AppText> : null}
    </FormScreen>
  );
}
