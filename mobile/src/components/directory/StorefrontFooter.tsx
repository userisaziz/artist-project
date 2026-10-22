import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../common/AppText';
import { AppButton } from '../common/AppButton';
import { useTheme } from '../../core/theme/theme-provider';
import { formatPrice } from '../../utils/common/format';
import { packageCountLabel } from '../../utils/directory/storefront';

interface StorefrontFooterProps {
  packageCount: number;
  fromPaise: number | null;
  onCheckAvailability: () => void;
}

/** Pinned to the bottom: how many packages and the lowest price, and "Check availability". */
export function StorefrontFooter({ packageCount, fromPaise, onCheckAvailability }: StorefrontFooterProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: theme.spacing.md, paddingTop: 12, paddingBottom: insets.bottom + 12, backgroundColor: theme.colors.surface, borderTopWidth: 1, borderTopColor: theme.colors.separator }}>
      <View style={{ flex: 1 }}>
        <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{packageCountLabel(packageCount)}</AppText>
        {fromPaise !== null ? <AppText variant="subtitle" style={{ fontSize: 18, color: theme.colors.textPrimary }}>{`from ${formatPrice(fromPaise)}`}</AppText> : null}
      </View>
      <View style={{ flex: 1.3 }}>
        <AppButton label="Check availability" disabled={packageCount === 0} onPress={onCheckAvailability} />
      </View>
    </View>
  );
}
