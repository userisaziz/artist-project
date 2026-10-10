import { useState } from 'react';
import { FormScreen, AppText, Accent, AppButton, AppTextField, PhoneInput, View, useTheme } from '@art-circle/atelier-mobile';

const noop = () => {};

export function LogIn() {
  const theme = useTheme();
  const [phone, setPhone] = useState('+91');
  return (
    <View style={{ width: 393, height: 640 }}>
      <FormScreen onBack={noop}>
        <AppText variant="display" style={{ color: theme.colors.textPrimary, marginTop: 28, lineHeight: theme.typography.display.fontSize }}>
          {'Welcome '}<Accent>back</Accent>
        </AppText>
        <AppText variant="body" style={{ color: theme.colors.textMuted, marginTop: 10, lineHeight: 18 }}>
          Enter your mobile number to log in or sign up. No passwords.
        </AppText>
        <AppText variant="label" style={{ color: theme.colors.textSecondary, marginTop: 32, marginBottom: 8 }}>Mobile number</AppText>
        <PhoneInput value={phone} onChange={setPhone} />
        <AppText variant="caption" style={{ color: theme.colors.textMuted, marginTop: 8 }}>We'll send a 6-digit code by SMS.</AppText>
        <View style={{ marginTop: 24 }}>
          <AppButton label="Send code" onPress={noop} disabled={phone.length < 13} />
        </View>
        <View style={{ flex: 1, minHeight: 32 }} />
        <AppText variant="caption" style={{ textAlign: 'center', color: theme.colors.textMuted, lineHeight: 18 }}>
          By continuing you agree to our <AppText variant="caption" style={{ color: theme.colors.brand }}>Terms</AppText> and{' '}
          <AppText variant="caption" style={{ color: theme.colors.brand }}>Privacy Policy</AppText>.
        </AppText>
      </FormScreen>
    </View>
  );
}

export function CreateAccount() {
  const theme = useTheme();
  const [name, setName] = useState('Ananya Rao');
  const [email, setEmail] = useState('');
  return (
    <View style={{ width: 393, height: 640 }}>
      <FormScreen>
        <AppText variant="display" style={{ color: theme.colors.textPrimary, marginTop: 28 }}>
          {'Create your '}<Accent>account</Accent>
        </AppText>
        <View style={{ marginTop: 28, gap: 20 }}>
          <AppTextField label="Full name" value={name} onChangeText={setName} placeholder="Ananya Rao" />
          <AppTextField label="Email (optional)" value={email} onChangeText={setEmail} placeholder="name@email.com" />
        </View>
        <View style={{ flex: 1, minHeight: 32 }} />
        <AppButton label="Create account" onPress={noop} />
      </FormScreen>
    </View>
  );
}
