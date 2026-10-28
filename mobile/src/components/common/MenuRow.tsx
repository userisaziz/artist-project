import { View } from 'react-native';
import { PressableFeedback } from './PressableFeedback';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { useTheme } from '../../core/theme/theme-provider';

interface MenuRowProps {
  label: string;
  onPress: () => void;
  /** Muted value before the chevron, e.g. "4.9 · 128"; read as "Reviews, 4.9 · 128". */
  detail?: string;
}

/** A tappable settings-style row with a chevron. */
export function MenuRow({ label, onPress, detail }: MenuRowProps) {
  const theme = useTheme();
  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityLabel={detail ? `${label}, ${detail}` : undefined}
      onPress={onPress}
      style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: theme.spacing[3.5] }}
    >
      <AppText variant="body" style={{ color: theme.colors.textPrimary, fontFamily: theme.typography.label.fontFamily }}>{label}</AppText>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[1] }}>
        {detail ? <AppText style={{ color: theme.colors.textMuted }}>{detail}</AppText> : null}
        <Icon name="chevron-right" size={18} color={theme.colors.textMuted} />
      </View>
    </PressableFeedback>
  );
}
