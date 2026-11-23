import { PressableFeedback } from '../common/PressableFeedback';
import { AppText } from '../common/AppText';
import { Icon } from '../common/Icon';
import { useTheme } from '../../core/theme/theme-provider';

/** The dashed "Add" square at the end of the portfolio grid. */
export function AddPhotoTile({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityLabel="Add photos"
      onPress={onPress}
      style={{
        aspectRatio: 1, borderRadius: theme.radii.lg, borderWidth: 1.5, borderStyle: 'dashed', borderColor: theme.colors.border,
        backgroundColor: theme.colors.washTop, alignItems: 'center', justifyContent: 'center', gap: theme.spacing[1],
      }}
    >
      <Icon name="plus" size={22} color={theme.colors.brand} />
      <AppText variant="label" style={{ color: theme.colors.brand }}>Add</AppText>
    </PressableFeedback>
  );
}
