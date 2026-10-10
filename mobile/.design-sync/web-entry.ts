// Web entry for the Claude Design sync: the app's real components, compiled with
// react-native-web by .design-sync/web-build.mjs. Re-exports only - no new UI here.
export { AppText, Accent } from '../src/components/AppText';
export { AppButton } from '../src/components/AppButton';
export { AppTextField } from '../src/components/AppTextField';
export { PhoneInput, formatPhone, COUNTRIES } from '../src/components/PhoneInput';
export { OtpInput } from '../src/components/OtpInput';
export { Screen } from '../src/components/Screen';
export { FormScreen } from '../src/components/FormScreen';
export { ThemeProvider, useTheme } from '../src/theme/theme-provider';
export { lightTheme } from '../src/theme/themes/light';
export { palette } from '../src/theme/tokens/palette';
// Screen and FormScreen read safe-area insets, so designs need this provider too.
export { SafeAreaProvider } from 'react-native-safe-area-context';
// Plain RN primitives (react-native-web) so designs lay out glue with the same engine.
export { View, ScrollView, Pressable, Image } from 'react-native';
export { LinearGradient } from 'expo-linear-gradient';
