import { View } from 'react-native';
import { PressableFeedback } from '../common/PressableFeedback';
import { AppText } from '../common/AppText';
import { Icon, type IconName } from '../common/Icon';
import { useTheme } from '../../core/theme/theme-provider';
import type { AttentionItem, AttentionKey } from '../../utils/bookings/dashboard';

const ICON: Record<AttentionKey, IconName> = { expiring: 'clock', reschedules: 'calendar', enquiries: 'inbox' };

interface AttentionListProps {
  items: AttentionItem[];
  onOpen: (key: AttentionKey) => void;
}

/** Artist home "Needs your attention": one row per thing waiting on the artist, or an all-clear line. */
export function AttentionList({ items, onOpen }: AttentionListProps) {
  const theme = useTheme();
  if (!items.length) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2], borderRadius: theme.radii.lg, backgroundColor: theme.colors.confirmedSoft, padding: theme.spacing[3.5] }}>
        <Icon name="check" size={16} color={theme.colors.confirmedInk} />
        <AppText variant="label" style={{ color: theme.colors.confirmedInk }}>You’re all caught up</AppText>
      </View>
    );
  }
  return (
    <View style={{ borderRadius: theme.radii.xl, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.separator, overflow: 'hidden' }}>
      {items.map((item, i) => (
        <PressableFeedback
          key={item.key}
          accessibilityRole="button"
          accessibilityLabel={`${item.title}. ${item.detail}`}
          onPress={() => onOpen(item.key)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing[3],
            padding: theme.spacing[3.5],
            borderTopWidth: i ? 1 : 0,
            borderTopColor: theme.colors.separator,
          }}
        >
          <View style={{ width: theme.spacing[8.5], height: theme.spacing[8.5], borderRadius: theme.radii.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: item.urgent ? theme.colors.pendingSoft : theme.colors.brandSoft }}>
            <Icon name={ICON[item.key]} size={17} color={item.urgent ? theme.colors.pendingInk : theme.colors.brand} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="label" style={{ color: theme.colors.textPrimary }}>{item.title}</AppText>
            <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{item.detail}</AppText>
          </View>
          <Icon name="chevron-right" size={18} color={theme.colors.textMuted} />
        </PressableFeedback>
      ))}
    </View>
  );
}
