import { Pressable } from 'react-native';
import { AppText } from './AppText';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import { useTheme } from '../../core/theme/theme-provider';

interface FilterChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
  /** Screen-reader name when the visible label is terse ("★ 4.8+" → "Rated 4.8 and up"). */
  accessibilityLabel?: string;
  /** Leading icon, e.g. a pin for "Near me". */
  icon?: IconName;
  /** A chip that opens a choice sheet shows a caret. */
  opensMenu?: boolean;
}

/** Explore's filter pill: outlined when off, filled plum when on. */
export function FilterChip({ label, active, onPress, accessibilityLabel, icon, opensMenu = false }: FilterChipProps) {
  const theme = useTheme();
  const ink = active ? theme.colors.textOnBrand : theme.colors.textPrimary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{
        height: 34, paddingHorizontal: theme.spacing[3.5], borderRadius: theme.radii.pill, flexDirection: 'row', alignItems: 'center', gap: theme.spacing[1],
        backgroundColor: active ? theme.colors.heading : theme.colors.surface,
        borderWidth: active ? 0 : 1, borderColor: theme.colors.border,
      }}
    >
      {icon ? <Icon name={icon} size={14} color={active ? ink : theme.colors.brand} /> : null}
      <AppText variant="labelMd" style={{ color: ink }}>{label}</AppText>
      {opensMenu ? <Icon name="chevron-down" size={13} color={ink} /> : null}
    </Pressable>
  );
}
