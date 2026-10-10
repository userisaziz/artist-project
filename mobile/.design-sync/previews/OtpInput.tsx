import { OtpInput, AppButton, View } from '@art-circle/atelier-mobile';

const noop = () => {};

export function Default() {
  return <View style={{ width: 340 }}><OtpInput onComplete={noop} /></View>;
}

export function WrongCode() {
  return <View style={{ width: 340 }}><OtpInput onComplete={noop} error /></View>;
}

export function Verifying() {
  return (
    <View style={{ width: 340, gap: 24 }}>
      <OtpInput onComplete={noop} busy />
      <AppButton label="Verify" onPress={noop} loading />
    </View>
  );
}

export function FourDigits() {
  return <View style={{ width: 240 }}><OtpInput length={4} onComplete={noop} /></View>;
}
