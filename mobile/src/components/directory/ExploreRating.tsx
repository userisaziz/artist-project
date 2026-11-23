import { View } from 'react-native';
import { AppText } from '../common/AppText';
import { Icon } from '../common/Icon';
import { useTheme } from '../../core/theme/theme-provider';

/** A filled brand star beside "4.9 (128)" (or "New"). The row's own label reads it aloud, so the star is decorative. */
export function ExploreRating({ text }: { text: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[0.75] }}>
      <Icon name="star" filled size={theme.typography.caption.fontSize} color={theme.colors.brand} />
      <AppText variant="caption" style={{ fontWeight: '700', color: theme.colors.brand }}>{text}</AppText>
    </View>
  );
}
