import { Redirect } from 'expo-router';

// `/customer` hub (the root's landing href): the area opens on the Home tab.
export default function CustomerIndex() {
  return <Redirect href="/customer/home" />;
}
