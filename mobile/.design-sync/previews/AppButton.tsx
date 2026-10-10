import { AppButton, View } from '@art-circle/atelier-mobile';

const noop = () => {};

export function Primary() {
  return <View style={{ width: 320 }}><AppButton label="Send code" onPress={noop} /></View>;
}

export function Variants() {
  return (
    <View style={{ width: 320, gap: 10 }}>
      <AppButton label="Get started" onPress={noop} />
      <AppButton label="I already have an account" variant="secondary" onPress={noop} />
      <AppButton label="Resend code" variant="ghost" onPress={noop} />
    </View>
  );
}

export function Loading() {
  return <View style={{ width: 320 }}><AppButton label="Verify" onPress={noop} loading /></View>;
}

export function Disabled() {
  return <View style={{ width: 320 }}><AppButton label="Create account" onPress={noop} disabled /></View>;
}
