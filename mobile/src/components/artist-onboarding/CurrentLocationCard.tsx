import { View } from 'react-native';
import { BrushLoader } from '../common/BrushLoader';
import { PressableFeedback } from '../common/PressableFeedback';
import { AppText } from '../common/AppText';
import { Icon, type IconName } from '../common/Icon';
import { useTheme } from '../../core/theme/theme-provider';

export type CurrentLocationState = 'idle' | 'busy' | 'set';

interface CurrentLocationCardProps {
  state: CurrentLocationState;
  /** The detected place, shown once `state` is 'set': "Koramangala 5th Block" over "Bengaluru 560095". */
  title: string;
  detail: string;
  onDetect: () => void;
  /** Opens the map without GPS, for an artist who isn't at their studio right now. */
  onPickOnMap: () => void;
  onChange: () => void;
}

/** AtelierScreen "onbLocation": the GPS shortcut and "Pick on the map" above the manual fields, as buttons, a progress
 *  row, or the result. */
export function CurrentLocationCard({ state, title, detail, onDetect, onPickOnMap, onChange }: CurrentLocationCardProps) {
  const theme = useTheme();
  const box = { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: theme.radii.md, borderWidth: 1 } as const;

  if (state === 'busy') {
    return (
      <View accessibilityLiveRegion="polite" style={{ ...box, borderColor: theme.colors.border, backgroundColor: theme.colors.surface }}>
        <BrushLoader />
        <View style={{ flex: 1 }}>
          <AppText variant="label" style={{ color: theme.colors.textPrimary }}>Finding your location…</AppText>
          <AppText variant="caption" style={{ color: theme.colors.textMuted, marginTop: 2 }}>This takes a few seconds</AppText>
        </View>
      </View>
    );
  }
  if (state === 'set') {
    return (
      <View style={{ ...box, borderColor: theme.colors.brand, backgroundColor: theme.colors.brandSoft }}>
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: theme.colors.brand, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="check" size={16} color={theme.colors.textOnBrand} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="label" numberOfLines={1} style={{ color: theme.colors.textPrimary }}>{title}</AppText>
          {detail ? <AppText variant="caption" numberOfLines={1} style={{ color: theme.colors.textSecondary, marginTop: 2 }}>{detail}</AppText> : null}
        </View>
        <PressableFeedback accessibilityRole="button" accessibilityLabel="Change location" onPress={onChange} hitSlop={8}>
          <AppText variant="label" style={{ color: theme.colors.brand }}>Change</AppText>
        </PressableFeedback>
      </View>
    );
  }
  return (
    <View style={{ gap: theme.spacing.sm }}>
      <OptionRow icon="map-pin" title="Use my current location" detail={'Fastest · uses your phone’s GPS'} onPress={onDetect} />
      <OptionRow icon="map" title="Pick on the map" detail="Not at your studio? Find it on the map" onPress={onPickOnMap} />
    </View>
  );
}

function OptionRow({ icon, title, detail, onPress }: { icon: IconName; title: string; detail: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: theme.radii.md, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface }}
    >
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={18} color={theme.colors.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="label" style={{ color: theme.colors.textPrimary }}>{title}</AppText>
        <AppText variant="caption" style={{ color: theme.colors.textMuted, marginTop: 2 }}>{detail}</AppText>
      </View>
      <Icon name="chevron-right" size={18} color={theme.colors.brand} />
    </PressableFeedback>
  );
}
