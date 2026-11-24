import { View } from 'react-native';
import { PressableFeedback } from '../common/PressableFeedback';
import { AppText } from '../common/AppText';
import { Icon, type IconName } from '../common/Icon';
import { useTheme } from '../../core/theme/theme-provider';

export type QuickActionKey = 'block-time' | 'new-post' | 'services' | 'profile';

const ACTIONS: { key: QuickActionKey; icon: IconName; label: string }[] = [
  { key: 'block-time', icon: 'calendar', label: 'Calendar' },
  { key: 'new-post', icon: 'image-plus', label: 'New post' },
  { key: 'services', icon: 'sparkles', label: 'Services' },
  { key: 'profile', icon: 'share', label: 'My profile' },
];

/** Artist home shortcuts to the four things an artist does most outside of answering requests. */
export function QuickActions({ onAction }: { onAction: (key: QuickActionKey) => void }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: theme.spacing[2] }}>
      {ACTIONS.map((a) => (
        <PressableFeedback
          key={a.key}
          accessibilityRole="button"
          accessibilityLabel={a.label}
          onPress={() => onAction(a.key)}
          style={{ flex: 1, alignItems: 'center', gap: theme.spacing[1.5], paddingVertical: theme.spacing[3], borderRadius: theme.radii.lg, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.separator }}
        >
          <Icon name={a.icon} size={20} color={theme.colors.brand} />
          <AppText variant="labelSm" style={{ color: theme.colors.textPrimary }}>{a.label}</AppText>
        </PressableFeedback>
      ))}
    </View>
  );
}
