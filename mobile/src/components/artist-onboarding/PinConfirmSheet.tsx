import { useState } from 'react';
import { Modal, View } from 'react-native';
import { PressableFeedback } from '../common/PressableFeedback';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../common/AppText';
import { AppButton } from '../common/AppButton';
import { Icon } from '../common/Icon';
import { PinMap } from '../common/PinMap';
import { useTheme } from '../../core/theme/theme-provider';
import type { Coordinates } from '../../core/location/location';

interface PinConfirmSheetProps {
  /** Where the map opens (the phone's position); null keeps the sheet closed. */
  start: Coordinates | null;
  onConfirm: (pin: Coordinates) => void;
  onClose: () => void;
}

/** Full-screen map: the artist nudges the pin onto their studio, then confirms it. */
export function PinConfirmSheet({ start, onConfirm, onClose }: PinConfirmSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [center, setCenter] = useState<Coordinates | null>(start);
  const [seen, setSeen] = useState(start);
  if (start !== seen) { // a new opening starts from the new position (reset during render, no effect)
    setSeen(start);
    setCenter(start);
  }
  return (
    <Modal visible={!!start} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <View style={{ paddingTop: insets.top + 8, paddingHorizontal: theme.spacing.md, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <PressableFeedback accessibilityRole="button" accessibilityLabel="Close map" onPress={onClose} hitSlop={10}>
            <Icon name="close" size={22} color={theme.colors.textPrimary} />
          </PressableFeedback>
          <View style={{ flex: 1 }}>
            <AppText variant="label" style={{ fontSize: 16, color: theme.colors.textPrimary }}>Confirm your studio location</AppText>
            <AppText variant="caption" style={{ color: theme.colors.textMuted }}>Move the map so the pin sits on your studio</AppText>
          </View>
        </View>
        {start ? <PinMap start={start} onMove={setCenter} /> : null}
        <View style={{ padding: theme.spacing.md, paddingBottom: insets.bottom + theme.spacing.md }}>
          <AppButton label="Confirm location" onPress={() => { if (center) onConfirm(center); }} disabled={!center} />
        </View>
      </View>
    </Modal>
  );
}
