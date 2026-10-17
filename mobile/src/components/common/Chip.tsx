import { Pressable } from 'react-native';
import { AppText } from './AppText';
import { useTheme } from '../../core/theme/theme-provider';

/** Atelier selectable pill (Profile "What do you offer?"): filled rose with a tick when selected. */
export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={{
        height: 36, paddingHorizontal: 14, borderRadius: theme.radii.pill, justifyContent: 'center',
        backgroundColor: selected ? theme.colors.brand : theme.colors.surface,
        borderWidth: selected ? 0 : 1, borderColor: theme.colors.border,
      }}
    >
      <AppText variant="label" style={{ fontSize: 13, color: selected ? theme.colors.textOnBrand : theme.colors.textPrimary }}>
        {selected ? `✓ ${label}` : label}
      </AppText>
    </Pressable>
  );
}
