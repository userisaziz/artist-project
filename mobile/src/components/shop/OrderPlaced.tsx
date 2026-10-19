import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '../common/AppButton';
import { AppText, Accent } from '../common/AppText';
import { useTheme } from '../../core/theme/theme-provider';

/** Design "Order placed": the order codes, what happens next, and Track / Keep shopping. */
export function OrderPlaced({ codes, onTrack, onKeepShopping }: { codes: string[]; onTrack: () => void; onKeepShopping: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, justifyContent: 'center', padding: theme.spacing.lg, paddingBottom: insets.bottom + theme.spacing.lg, gap: 14 }}>
      <AppText variant="display" style={{ fontSize: 34, lineHeight: 38, color: theme.colors.heading, textAlign: 'center' }}>Order <Accent>placed</Accent></AppText>
      <AppText variant="body" style={{ color: theme.colors.textSecondary, textAlign: 'center' }}>
        {`${codes.map((c) => `#${c}`).join(', ')}. Each artist confirms, packs and ships their own items. You pay them the way you chose.`}
      </AppText>
      <View style={{ gap: 8, marginTop: 12 }}>
        <AppButton label="Track order" onPress={onTrack} />
        <AppButton label="Keep shopping" variant="ghost" onPress={onKeepShopping} />
      </View>
    </View>
  );
}
