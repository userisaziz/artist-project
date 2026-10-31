import { PressableFeedback } from './PressableFeedback';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { useTheme } from '../../core/theme/theme-provider';

/** Atelier selectable pill (Profile "What do you offer?"): filled rose with a tick when selected. */
export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <PressableFeedback
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      haptic="select"
      onPress={onPress}
      style={{
        height: 36, paddingHorizontal: theme.spacing[3.5], borderRadius: theme.radii.pill, justifyContent: 'center',
        flexDirection: 'row', alignItems: 'center', gap: theme.spacing[1],
        backgroundColor: selected ? theme.colors.brand : theme.colors.surface,
        borderWidth: selected ? 0 : 1, borderColor: theme.colors.border,
      }}
    >
      {selected ? <Icon name="check" size={14} color={theme.colors.textOnBrand} /> : null}
      <AppText variant="labelLg" style={{ color: selected ? theme.colors.textOnBrand : theme.colors.textPrimary }}>{label}</AppText>
    </PressableFeedback>
  );
}
