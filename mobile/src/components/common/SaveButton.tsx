import { PressableFeedback } from './PressableFeedback';
import { Icon } from './Icon';
import { useTheme } from '../../core/theme/theme-provider';

/** Route-supplied saving for one kind of thing (posts, artists or products): features show the button, the app layer owns the state. */
export interface SaveToggle {
  isSaved: (id: string) => boolean;
  toggle: (id: string) => void;
}

interface SaveButtonProps {
  /** What is being saved, for screen readers: "Bridal look by Ayesha". */
  name: string;
  saved: boolean;
  onPress: () => void;
}

/** A bookmark: filled when saved. */
export function SaveButton({ name, saved, onPress }: SaveButtonProps) {
  const theme = useTheme();
  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityLabel={saved ? `Remove ${name} from saved` : `Save ${name}`}
      accessibilityState={{ selected: saved }}
      onPress={onPress}
      hitSlop={8}
      style={{ padding: theme.spacing[1] }}
    >
      <Icon name="bookmark" size={20} color={saved ? theme.colors.brand : theme.colors.textMuted} filled={saved} />
    </PressableFeedback>
  );
}
