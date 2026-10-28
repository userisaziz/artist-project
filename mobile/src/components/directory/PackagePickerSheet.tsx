import { View } from 'react-native';
import { PressableFeedback } from '../common/PressableFeedback';
import { AppText } from '../common/AppText';
import { BottomSheet } from '../common/BottomSheet';
import { useTheme } from '../../core/theme/theme-provider';
import { formatPrice } from '../../utils/common/format';
import type { PublicService } from '../../types/directory/directory';
import { serviceMeta } from './StorefrontServiceRow';

interface PackagePickerSheetProps {
  visible: boolean;
  services: PublicService[];
  onPick: (service: PublicService) => void;
  onClose: () => void;
}

/** "Book now" with several packages: the customer picks one, then goes on to Date & time. */
export function PackagePickerSheet({ visible, services, onPick, onClose }: PackagePickerSheetProps) {
  const theme = useTheme();
  return (
    <BottomSheet visible={visible} title="Choose a package" onClose={onClose}>
      {services.map((s) => (
        <PressableFeedback
          key={s.id}
          accessibilityRole="button"
          accessibilityLabel={`Book ${s.name}`}
          onPress={() => onPick(s)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: theme.radii.md, borderWidth: 1, borderColor: theme.colors.separator }}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="subtitle" style={{ fontSize: 15, lineHeight: 20, color: theme.colors.textPrimary }}>{s.name}</AppText>
            <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{serviceMeta(s)}</AppText>
          </View>
          <AppText variant="subtitle" style={{ fontSize: 15, lineHeight: 20, color: theme.colors.brand }}>{formatPrice(s.price_paise)}</AppText>
        </PressableFeedback>
      ))}
    </BottomSheet>
  );
}
