import { View } from 'react-native';
import { PressableFeedback } from '../common/PressableFeedback';
import { AppText } from '../common/AppText';
import { Icon } from '../common/Icon';
import { useTheme } from '../../core/theme/theme-provider';
import { useMyRequirements } from '../../hooks/artist-onboarding/artist-onboarding';
import { formatDay, istDateKey } from '../../utils/common/time';
import type { PendingRequirement } from '../../types/artist-onboarding/artist-onboarding';

interface RequirementsBannerProps {
  /** Opens the screen that completes a requirement (its `action` route). */
  onOpen: (action: string) => void;
}

/** "Add your studio location by 29 Oct to stay visible" while in the grace period; red "Your profile is hidden"
 * once overdue. One strip per missing mandatory item; nothing at all when the profile is complete. A failed check
 * also shows nothing: the strip is a nudge, and the server still enforces the hold. */
export function RequirementsBanner({ onOpen }: RequirementsBannerProps) {
  const requirements = useMyRequirements();
  const items = requirements.data?.items ?? [];
  if (!items.length) return null;
  return (
    <View style={{ gap: 8 }}>
      {items.map((item) => <RequirementStrip key={item.key} item={item} onPress={() => onOpen(item.action)} />)}
    </View>
  );
}

function RequirementStrip({ item, onPress }: { item: PendingRequirement; onPress: () => void }) {
  const theme = useTheme();
  const message = item.overdue
    ? `Your profile is hidden. ${item.title} to show up for clients again.`
    : `${item.title} by ${formatDay(istDateKey(item.due_at))} to stay visible to clients.`;
  const ink = item.overdue ? theme.colors.error : theme.colors.pendingInk;
  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityLabel={`${message} Complete now`}
      onPress={onPress}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: theme.radii.md, borderWidth: 1,
        backgroundColor: item.overdue ? theme.colors.errorBackground : theme.colors.pendingSoft, borderColor: ink,
      }}
    >
      <Icon name={item.key === 'location' ? 'map-pin' : 'pen-tool'} size={18} color={ink} />
      <View style={{ flex: 1 }}>
        <AppText variant="label" style={{ color: theme.colors.textPrimary }}>{message}</AppText>
        <AppText variant="caption" style={{ color: ink, fontWeight: '700', marginTop: 4 }}>Complete now</AppText>
      </View>
      <Icon name="chevron-right" size={18} color={ink} />
    </PressableFeedback>
  );
}
