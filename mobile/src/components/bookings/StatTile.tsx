import { View } from 'react-native';
import { PressableFeedback } from '../common/PressableFeedback';
import { AppText } from '../common/AppText';
import { Icon, type IconName } from '../common/Icon';
import { useTheme } from '../../core/theme/theme-provider';

interface StatTileProps {
  icon: IconName;
  label: string;
  value: string;
  /** One short line under the number, e.g. "3 expire soon". */
  hint: string;
  /** Amber hint: something here needs answering. */
  alert?: boolean;
  onPress: () => void;
}

/** One KPI on the artist home grid: an icon, the number, what it counts and a hint; taps through to the list. */
export function StatTile({ icon, label, value, hint, alert = false, onPress }: StatTileProps) {
  const theme = useTheme();
  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}. ${hint}`}
      onPress={onPress}
      style={{
        flex: 1,
        borderRadius: theme.radii.xl,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.separator,
        padding: theme.spacing[3.5],
        gap: theme.spacing[1],
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ width: theme.spacing[8.5], height: theme.spacing[8.5], borderRadius: theme.radii.pill, backgroundColor: alert ? theme.colors.pendingSoft : theme.colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={17} color={alert ? theme.colors.pendingInk : theme.colors.brand} />
        </View>
        {alert ? <View style={{ width: theme.spacing[2], height: theme.spacing[2], borderRadius: theme.radii.pill, backgroundColor: theme.colors.pendingDot }} /> : null}
      </View>
      <AppText variant="formTitle" style={{ color: theme.colors.heading, marginTop: theme.spacing[1.5] }}>{value}</AppText>
      <AppText variant="label" style={{ color: theme.colors.textPrimary }}>{label}</AppText>
      <AppText variant="caption" numberOfLines={1} style={{ color: alert ? theme.colors.pendingInk : theme.colors.textMuted }}>{hint}</AppText>
    </PressableFeedback>
  );
}
