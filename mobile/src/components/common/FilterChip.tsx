import { PressableFeedback } from './PressableFeedback';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { GlossSheen } from './GlossSheen';
import type { IconName } from './Icon';
import { useTheme } from '../../core/theme/theme-provider';

/** An icon inside a chip; `filled` for a solid glyph (a rating star). */
export interface ChipIcon {
  name: IconName;
  filled?: boolean;
}

interface FilterChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
  /** Screen-reader name when the visible label is terse ("4.8+" → "Rated 4.8 and up"). */
  accessibilityLabel?: string;
  /** Leading icon, e.g. a pin for "Near me" or a star for a rating floor. */
  icon?: ChipIcon;
  /** Trailing icon: a caret on a chip that opens a choice sheet, a cross on a removable one. */
  trailingIcon?: ChipIcon;
}

// The platform's minimum touch target. The pill stays visually slimmer; hitSlop makes up the difference.
const MIN_TOUCH = 44;

/** Explore's filter pill: outlined when off, filled plum when on. */
export function FilterChip({ label, active, onPress, accessibilityLabel, icon, trailingIcon }: FilterChipProps) {
  const theme = useTheme();
  const ink = active ? theme.colors.textOnBrand : theme.colors.textPrimary;
  const height = theme.spacing[8.5];
  const glyph = theme.typography.labelMd.lineHeight - theme.spacing[0.5];
  const slop = Math.max(0, (MIN_TOUCH - height) / 2);
  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      hitSlop={{ top: slop, bottom: slop, left: theme.spacing.xs, right: theme.spacing.xs }}
      style={{
        height, paddingHorizontal: theme.spacing[3.5], borderRadius: theme.radii.pill, flexDirection: 'row', alignItems: 'center', gap: theme.spacing[1],
        backgroundColor: active ? theme.colors.heading : theme.colors.surface,
        borderWidth: active ? 0 : 1, borderColor: theme.colors.border,
      }}
    >
      {active ? <GlossSheen radius={theme.radii.pill} /> : null}
      {icon ? <Icon name={icon.name} size={glyph} filled={icon.filled} color={active ? ink : theme.colors.brand} /> : null}
      <AppText variant="labelMd" style={{ color: ink }}>{label}</AppText>
      {trailingIcon ? <Icon name={trailingIcon.name} size={glyph} filled={trailingIcon.filled} color={ink} /> : null}
    </PressableFeedback>
  );
}
