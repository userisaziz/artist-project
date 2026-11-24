import { View } from 'react-native';
import { AppText } from './AppText';
import { useTheme } from '../../core/theme/theme-provider';

export type PillTone = 'pending' | 'confirmed' | 'brand' | 'neutral' | 'danger';

interface StatusPillProps {
  label: string;
  tone: PillTone;
}

/** Small rounded status label, e.g. "Awaiting confirmation" (amber) or "Confirmed" (green). */
export function StatusPill({ label, tone }: StatusPillProps) {
  const { colors, radii, spacing } = useTheme();
  const palette: Record<PillTone, [string, string]> = {
    pending: [colors.pendingSoft, colors.pendingInk],
    confirmed: [colors.confirmedSoft, colors.confirmedInk],
    brand: [colors.brandSoft, colors.brandInk], // brand measured 3.86:1 on its own tint
    neutral: [colors.neutralSoft, colors.textSecondary],
    danger: [colors.errorBackground, colors.errorOnSoft], // error measured 3.92:1 on errorBackground
  };
  const [bg, fg] = palette[tone];
  return (
    <View style={{ alignSelf: 'flex-start', paddingHorizontal: spacing[2.5], paddingVertical: spacing[1], borderRadius: radii.pill, backgroundColor: bg }}>
      <AppText variant="label" size="xs" style={{ color: fg }}>{label}</AppText>
    </View>
  );
}
