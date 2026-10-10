import { useState } from 'react';
import { PhoneInput, AppText, View, useTheme } from '@art-circle/atelier-mobile';

export function IndiaNumber() {
  const [phone, setPhone] = useState('+919845012345');
  return <View style={{ width: 340 }}><PhoneInput value={phone} onChange={setPhone} /></View>;
}

export function Empty() {
  const [phone, setPhone] = useState('+91');
  return <View style={{ width: 340 }}><PhoneInput value={phone} onChange={setPhone} /></View>;
}

export function WithError() {
  const theme = useTheme();
  const [phone, setPhone] = useState('+9198450');
  return (
    <View style={{ width: 340 }}>
      <PhoneInput value={phone} onChange={setPhone} error />
      <AppText variant="caption" style={{ color: theme.colors.error, marginTop: 8 }}>Enter a valid mobile number.</AppText>
    </View>
  );
}

export function OtherCountry() {
  const [phone, setPhone] = useState('+447700900123');
  return <View style={{ width: 340 }}><PhoneInput value={phone} onChange={setPhone} /></View>;
}
